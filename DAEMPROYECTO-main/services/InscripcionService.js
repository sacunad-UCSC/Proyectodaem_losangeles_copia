const Inscripcion = require("../domain/Inscripcion");
const Division = require("../domain/Division");
const Alumno = require("../domain/Alumno");
const InscripcionRepository = require("../repositories/InscripcionRepository");
const AlumnoRepository = require("../repositories/AlumnoRepository");
const ActividadRepository = require("../repositories/ActividadRepository");
const TorneoRepository = require("../repositories/TorneoRepository");
const { obtenerConexion } = require("../db/conexion");
const { descodificarJson } = require("../db/util");

function calcularEdadInline(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const mes = hoy.getMonth() - nac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

// Los repos no agregan _id: la capa de servicio que expone a la API agrega
// _id (mirror de id) en objetos y subobjetos (establecimiento, actividad,
// alumnos) para conservar el contrato que consumia el front.
function conId(v) {
  if (v === null || v === undefined || typeof v !== "object") return v;
  if (v.id !== undefined && v._id === undefined) v._id = v.id;
  for (const clave of Object.keys(v)) {
    const valor = v[clave];
    if (Array.isArray(valor)) {
      for (const item of valor) conId(item);
    } else if (valor && typeof valor === "object") {
      conId(valor);
    }
  }
  return v;
}

// El repo de torneos devuelve la actividad como campo plano (actividad +
// actividadNombre/Area/...); el front consume t.actividad como objeto.
function aTorneo(t) {
  if (!t) return t;
  t._id = t.id;
  if (t.actividad != null) {
    t.actividad = {
      id: t.actividad,
      _id: t.actividad,
      nombre: t.actividadNombre,
      area: t.actividadArea,
      divisiones: descodificarJson(t.actividadDivisiones, []),
      anio: t.actividadAnio,
    };
  }
  return t;
}

function fechaValida(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

class InscripcionService {
  #inscripciones;
  #alumnos;
  #actividades;
  #torneos;

  constructor() {
    this.#inscripciones = new InscripcionRepository();
    this.#alumnos = new AlumnoRepository();
    this.#actividades = new ActividadRepository();
    this.#torneos = new TorneoRepository();
  }

  // El coordinador inscribe a su establecimiento en una actividad/division.
  async crear(datos, usuario) {
    if (usuario.rol !== "admin" && String(datos.establecimiento) !== String(usuario.establecimiento?._id)) {
      throw new Error("El coordinador solo puede inscribir a su propio establecimiento");
    }

    const actividad = await this.#actividades.obtenerPorId(datos.actividad);
    if (!actividad) throw new Error("Actividad no encontrada");
    if (!actividad.divisiones.includes(datos.division)) {
      throw new Error(`La actividad no ofrece la division ${datos.division}`);
    }

    // Validacion de ventana de inscripcion.
    const ahora = new Date();
    const apertura = fechaValida(actividad.fechaAperturaInscripcion);
    if (apertura && ahora < apertura) {
      throw new Error(
        `Las inscripciones abre el ${apertura.toLocaleDateString("es-CL")}`
      );
    }
    const cierre = fechaValida(actividad.fechaCierreInscripcion);
    if (cierre && ahora > cierre) {
      throw new Error(
        `Las inscripciones cerradas desde el ${cierre.toLocaleDateString("es-CL")}`
      );
    }

    // Validaciones de estado/cupo.
    const existente = await this.#inscripciones.buscar(
      datos.establecimiento,
      datos.actividad,
      datos.division
    );
    if (existente) {
      throw new Error("Este establecimiento ya esta inscrito a esa actividad/division");
    }

    const inscripcion = new Inscripcion(
      datos.establecimiento,
      datos.actividad,
      datos.division,
      usuario.rut
    );

    const doc = await this.#inscripciones.crear(inscripcion);
    return conId(doc);
  }

  async asociarTorneo(inscripcionId, torneoId, usuario) {
    const inscripcion = await this.#inscripciones.obtenerPorId(inscripcionId);
    if (!inscripcion) throw new Error("Inscripcion no encontrada");
    if (usuario.rol !== "admin" && String(inscripcion.establecimiento.id) !== String(usuario.establecimiento?._id)) {
      throw new Error("No puede asociar una inscripcion de otro establecimiento");
    }

    const torneo = await this.#torneos.obtenerPorId(torneoId);
    if (!torneo) throw new Error("Torneo no encontrado");

    // Ventana de inscripcion del torneo programado.
    const ahora = new Date();
    const apertura = fechaValida(torneo.fechaAperturaInscripcion);
    if (apertura && ahora < apertura) {
      throw new Error(
        `Las inscripciones al torneo abren el ${apertura.toLocaleDateString("es-CL")}`
      );
    }
    const cierre = fechaValida(torneo.fechaCierreInscripcion);
    if (cierre && ahora > cierre) {
      throw new Error(
        `Las inscripciones al torneo cerraron el ${cierre.toLocaleDateString("es-CL")}`
      );
    }

    // Requisitos del torneo: edad min/max y genero sobre los alumnos inscritos.
    const req = torneo.requisitos || {};
    if (req.activo) {
      const alumnos = inscripcion.alumnos || [];
      if (req.edadMinima != null || req.edadMaxima != null) {
        const fueraRango = alumnos.find((a) => {
          const edad = a.calcularEdad ? a.calcularEdad() : calcularEdadInline(a.fechaNacimiento);
          return (req.edadMinima != null && edad < req.edadMinima) || (req.edadMaxima != null && edad > req.edadMaxima);
        });
        if (fueraRango) {
          throw new Error(`Hay alumnos fuera del rango de edad permitido (${req.edadMinima ?? "?"}-${req.edadMaxima ?? "?"})`);
        }
      }
      if (req.genero && ["varones", "damas"].includes(req.genero)) {
        const permitido = req.genero === "varones" ? "M" : "F";
        const fueraGenero = alumnos.find((a) => a.genero && a.genero !== permitido && a.genero !== "mixto" && a.genero !== "");
        if (fueraGenero) {
          throw new Error(`El torneo es solo para ${req.genero === "varones" ? "varones" : "damas"}`);
        }
      }
      if (!alumnos.length) {
        throw new Error("Debe inscribir al menos un alumno antes de asociar el torneo");
      }
    }

    return conId(await this.#inscripciones.actualizar(inscripcionId, { torneo: torneoId, grupo: "" }));
  }

  async obtenerTodos(usuario, filtro = {}) {
    if (usuario.rol === "coordinador") {
      filtro.establecimiento = usuario.establecimiento?._id;
    }
    return this.#inscripciones.obtenerTodos(filtro).map(conId);
  }

  async obtenerPorId(id) {
    return conId(this.#inscripciones.obtenerPorId(id));
  }

  // El admin acepta o rechaza la solicitud del coordinador.
  async cambiarEstado(id, estado, usuario) {
    if (usuario.rol !== "admin") throw new Error("Solo el Admin DAEM puede aceptar o rechazar");
    if (!["aceptada", "rechazada"].includes(estado)) {
      throw new Error("Estado invalido: use aceptada/rechazada");
    }
    return conId(await this.#inscripciones.cambiarEstado(id, estado));
  }

  // El coordinador modifica o retracta su solicitud mientras este en proceso.
  async modificar(id, datos, usuario) {
    const inscripcion = await this.#inscripciones.obtenerPorId(id);
    if (!inscripcion) throw new Error("Inscripcion no encontrada");
    if (usuario.rol !== "admin" && String(inscripcion.establecimiento.id) !== String(usuario.establecimiento?._id)) {
      throw new Error("No puede modificar una inscripcion de otro establecimiento");
    }
    if (inscripcion.estado !== "en_proceso") {
      throw new Error("Solo se puede modificar una inscripcion en estado 'en proceso'");
    }

    const actualizar = {};
    if (datos.division) {
      const actividad = inscripcion.actividad;
      if (!actividad.divisiones.includes(datos.division)) {
        throw new Error(`La actividad no ofrece la division ${datos.division}`);
      }
      actualizar.division = datos.division;
    }
    if (datos.detalle !== undefined) actualizar.detalle = datos.detalle;

    return conId(await this.#inscripciones.actualizar(id, actualizar));
  }

  async retractar(id, usuario) {
    const inscripcion = await this.#inscripciones.obtenerPorId(id);
    if (!inscripcion) throw new Error("Inscripcion no encontrada");
    if (usuario.rol !== "admin" && String(inscripcion.establecimiento.id) !== String(usuario.establecimiento?._id)) {
      throw new Error("No puede retractar una inscripcion de otro establecimiento");
    }
    if (inscripcion.estado === "aceptada") {
      throw new Error("Una inscripcion aceptada no puede retractarse; contacte al DAEM");
    }
    return this.#inscripciones.eliminar(id);
  }

  // El coordinador agrega un alumno validando su año de nacimiento por division.
  async agregarAlumno(inscripcionId, datos, usuario) {
    const inscripcion = await this.#inscripciones.obtenerPorId(inscripcionId);
    if (!inscripcion) throw new Error("Inscripcion no encontrada");
    if (usuario.rol !== "admin" && String(inscripcion.establecimiento.id) !== String(usuario.establecimiento?._id)) {
      throw new Error("No puede agregar alumnos a esa inscripcion");
    }
    return this.#agregarAlumnoAInscripcion(inscripcion, datos);
  }

  // El coordinador postula un estudiante directo a la actividad/division:
  // crea (o reutiliza) la inscripcion aceptada de su establecimiento y el
  // alumno queda en la nomina de la actividad y en la nomina general.
  async postular(datos, usuario) {
    const estId = datos.establecimiento || usuario.establecimiento?._id;
    if (!estId) throw new Error("No hay establecimiento asignado");
    if (usuario.rol !== "admin" && String(estId) !== String(usuario.establecimiento?._id)) {
      throw new Error("El coordinador solo puede postular a su propio establecimiento");
    }

    const actividad = await this.#actividades.obtenerPorId(datos.actividad);
    if (!actividad) throw new Error("Actividad no encontrada");
    if (!actividad.divisiones.includes(datos.division)) {
      throw new Error(`La actividad no ofrece la division ${datos.division}`);
    }

    let inscripcion = await this.#inscripciones.buscar(estId, datos.actividad, datos.division);
    if (!inscripcion) {
      inscripcion = await this.#inscripciones.crear(
        new Inscripcion(estId, datos.actividad, datos.division, usuario.rut)
      );
    }
    if (inscripcion.estado !== "aceptada") {
      await this.#inscripciones.cambiarEstado(inscripcion.id, "aceptada");
    }
    inscripcion = await this.#inscripciones.obtenerPorId(inscripcion.id);

    return this.#agregarAlumnoAInscripcion(inscripcion, datos.alumno || datos);
  }

  async #agregarAlumnoAInscripcion(inscripcion, datos) {
    // Validacion de categoria por años de nacimiento (clase Division).
    new Division(inscripcion.division).validarFechaNacimiento(datos.fechaNacimiento);

    const alumno = new Alumno(
      datos.rut,
      datos.nombre,
      datos.fechaNacimiento,
      datos.apoderado,
      datos.email,
      datos.telefono,
      datos.genero
    );

    // Validacion de rango de edad definido por la actividad.
    const edadAlumno = alumno.calcularEdad();
    const eMin = inscripcion.actividad.edadMinima;
    const eMax = inscripcion.actividad.edadMaxima;
    if (eMin != null && edadAlumno < eMin) {
      throw new Error(`El alumno tiene ${edadAlumno} anios, menor a la edad minima de ${eMin}`);
    }
    if (eMax != null && edadAlumno > eMax) {
      throw new Error(`El alumno tiene ${edadAlumno} anios, mayor a la edad maxima de ${eMax}`);
    }

    const duplicado = await this.#alumnos.buscarPorRutEnActividad(alumno.rut, inscripcion.actividad.id);
    if (duplicado) throw new Error(`El alumno ${alumno.nombre} ya esta registrado en esta actividad`);

    const limite = inscripcion.actividad.limiteInscritos || 0;
    if (limite > 0 && inscripcion.alumnos.length >= limite) {
      throw new Error(`La actividad ${inscripcion.actividad.nombre} alcanzo su limite de ${limite} inscritos`);
    }

    const doc = await this.#alumnos.crear({
      rut: alumno.rut,
      nombre: alumno.nombre,
      genero: alumno.genero,
      fechaNacimiento: alumno.fechaNacimiento,
      apoderado: alumno.apoderado,
      email: alumno.email,
      telefono: alumno.telefono,
      establecimiento: inscripcion.establecimiento.id,
      actividad: inscripcion.actividad.id,
      division: inscripcion.division,
      inscripcion: inscripcion.id,
    });

    await this.#inscripciones.actualizar(inscripcion.id, {
      alumnos: [...inscripcion.alumnos.map((a) => a.id), doc.id],
    });

    return conId(this.#alumnos.obtenerPorId(doc.id));
  }

  async eliminarAlumno(inscripcionId, alumnoId, usuario) {
    const inscripcion = await this.#inscripciones.obtenerPorId(inscripcionId);
    if (!inscripcion) throw new Error("Inscripcion no encontrada");
    if (usuario.rol !== "admin" && String(inscripcion.establecimiento.id) !== String(usuario.establecimiento?._id)) {
      throw new Error("No puede eliminar alumnos de esa inscripcion");
    }
    const nuevos = inscripcion.alumnos
      .filter((a) => String(a.id) !== String(alumnoId))
      .map((a) => a.id);
    await this.#inscripciones.actualizar(inscripcionId, { alumnos: nuevos });
    return this.#alumnos.eliminar(alumnoId);
  }

  // Torneos a los que el coordinador puede postular estudiantes: solo cuando el
  // Todos los torneos se muestran en el panel del coordinador (excepto
  // suspendidos/cancelados/finalizados), con o sin fechas programadas. La
  // ventana de inscripcion (apertura..cierre) se valida al postular.
  async torneosParaPostulacion(usuario) {
    const todos = await this.#torneos.obtenerTodos();
    const torneos = todos.filter((t) => !["suspendido", "cancelado", "finalizado"].includes(t.estado));
    const estId = usuario.establecimiento?._id;
    const bd = obtenerConexion();
    const contarPostulados = bd.prepare(
      `SELECT COUNT(*) AS total
       FROM alumnos a JOIN alumno_torneos at ON at.alumno = a.id
       WHERE a.establecimiento = ? AND at.torneo = ?`
    );
    const postulables = [];
    for (const t of torneos) {
      const postulados = estId ? contarPostulados.get(estId, t.id).total : 0;
      postulables.push({ ...aTorneo(t), postulados });
    }
    return postulables;
  }

  // Estudiantes del establecimiento ya postulados a un torneo.
  async postuladosTorneo(torneoId, usuario) {
    const estId = usuario.establecimiento?._id;
    if (!estId) return [];
    return this.#alumnos.obtenerTodos({ establecimiento: estId, torneos: torneoId }).map(conId);
  }

  // El coordinador postula un estudiante a un torneo programado por el admin:
  // - datos.alumnoId: estudiante que ya esta en la nomina de la actividad/categoria
  //   del torneo (se enrrolla tal cual).
  // - sino, registra un estudiante nuevo (queda tambien en la nomina de la
  //   actividad/categoria del torneo) y lo enrrolla.
  async postularTorneo(torneoId, datos, usuario) {
    const estId = datos.establecimiento || usuario.establecimiento?._id;
    if (!estId) throw new Error("No hay establecimiento asignado");
    if (usuario.rol !== "admin" && String(estId) !== String(usuario.establecimiento?._id)) {
      throw new Error("El coordinador solo puede postular a su propio establecimiento");
    }

    const torneo = await this.#torneos.obtenerPorId(torneoId);
    if (!torneo) throw new Error("Torneo no encontrado");
    if (torneo.estado !== "inscripciones") {
      throw new Error("El torneo no esta en periodo de inscripciones");
    }
    const ahora = new Date();
    const apertura = fechaValida(torneo.fechaAperturaInscripcion);
    if (apertura && ahora < apertura) {
      throw new Error(`Las inscripciones al torneo abren el ${apertura.toLocaleDateString("es-CL")}`);
    }
    const cierre = fechaValida(torneo.fechaCierreInscripcion);
    if (cierre && ahora > cierre) {
      throw new Error(`Las inscripciones al torneo cerraron el ${cierre.toLocaleDateString("es-CL")}`);
    }

    const actId = torneo.actividad && (torneo.actividad.id ?? torneo.actividad);
    const division = torneo.division;
    if (!actId || !division) throw new Error("El torneo no tiene actividad o categoria definida");

    let alumno;
    if (datos.alumnoId) {
      const existente = await this.#alumnos.obtenerPorId(datos.alumnoId);
      if (!existente) throw new Error("Estudiante no encontrado");
      if (String(existente.establecimiento.id) !== String(estId)) {
        throw new Error("El estudiante no pertenece a su establecimiento");
      }
      const actAlumno = existente.actividad && (existente.actividad.id != null ? existente.actividad.id : existente.actividad);
      if (String(actAlumno) !== String(actId) || existente.division !== division) {
        throw new Error("El estudiante pertenece a otra actividad/categoria: postule uno de la nomina de este torneo o registrelo como nuevo");
      }
      alumno = conId(existente);
    } else {
      const req = torneo.requisitos || {};
      if (req.activo) {
        const datosAlumno = datos.alumno || datos;
        const edad = calcularEdadInline(datosAlumno.fechaNacimiento);
        if (req.edadMinima != null && edad != null && edad < req.edadMinima) {
          throw new Error(`El estudiante tiene ${edad} anios, menor a la edad minima del torneo (${req.edadMinima})`);
        }
        if (req.edadMaxima != null && edad != null && edad > req.edadMaxima) {
          throw new Error(`El estudiante tiene ${edad} anios, mayor a la edad maxima del torneo (${req.edadMaxima})`);
        }
        if (req.genero && ["varones", "damas"].includes(req.genero) && datosAlumno.genero && datosAlumno.genero !== "Otro") {
          const permitido = req.genero === "varones" ? "M" : "F";
          if (datosAlumno.genero !== permitido) {
            throw new Error(`El torneo es solo para ${req.genero === "varones" ? "varones" : "damas"}`);
          }
        }
      }

      // Crea (o reutiliza) la inscripcion aceptada de la actividad/categoria del
      // torneo; el estudiante nuevo queda en la nomina de esa actividad.
      let inscripcion = await this.#inscripciones.buscar(estId, actId, division);
      if (!inscripcion) {
        inscripcion = await this.#inscripciones.crear(
          new Inscripcion(estId, actId, division, usuario.rut)
        );
      }
      if (inscripcion.estado !== "aceptada") {
        await this.#inscripciones.cambiarEstado(inscripcion.id, "aceptada");
      }
      inscripcion = await this.#inscripciones.obtenerPorId(inscripcion.id);
      alumno = await this.#agregarAlumnoAInscripcion(inscripcion, datos.alumno || datos);
    }

    const yaPostulado = (alumno.torneos || []).some((t) => String(t._id || t) === String(torneoId));
    if (!yaPostulado) {
      await this.#alumnos.actualizar(alumno.id, { $addToSet: { torneos: torneoId } });
      alumno = conId(await this.#alumnos.obtenerPorId(alumno.id));
    }

    return { alumno, yaPostulado };
  }

  // Nómina interna: registro centralizado de estudiantes del establecimiento.
  async nominaEstablecimiento(usuario) {
    const estId = usuario.establecimiento?._id;
    if (!estId) {
      return { total: 0, alumnos: [], porActividad: [] };
    }
    const alumnos = this.#alumnos.obtenerTodos({ establecimiento: estId }).map(conId);
    const porActividad = alumnos.reduce((acc, a) => {
      const clave = a.actividad ? a.actividad.nombre : "Sin actividad";
      acc[clave] = (acc[clave] || 0) + 1;
      return acc;
    }, {});
    return {
      total: alumnos.length,
      alumnos,
      porActividad: Object.entries(porActividad).map(([actividad, cantidad]) => ({ actividad, cantidad })),
    };
  }
}

module.exports = InscripcionService;