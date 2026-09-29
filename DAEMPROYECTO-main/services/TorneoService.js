const Sorteo = require("../domain/Sorteo");
const Torneo = require("../domain/Torneo");
const TorneoRepository = require("../repositories/TorneoRepository");
const LlaveRepository = require("../repositories/LlaveRepository");
const PosicionRepository = require("../repositories/PosicionRepository");
const EquipoRepository = require("../repositories/EquipoRepository");
const AlumnoRepository = require("../repositories/AlumnoRepository");
const InscripcionRepository = require("../repositories/InscripcionRepository");
const NotificacionService = require("./NotificacionService");
const { obtenerConexion } = require("../db/conexion");
const { descodificarJson } = require("../db/util");

// Edad en anios a partir de la fecha de nacimiento (misma logica que InscripcionService).
function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nac = new Date(fechaNacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad -= 1;
  return edad;
}

// El repo de torneos devuelve la actividad como campo plano (actividad +
// actividadNombre/Area/...); el front consume t.actividad como objeto con
// _id. Tambien se agrega _id a nivel torneo (los repos no lo ponen).
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

// Normaliza la actividad de un torneo (objeto tras aTorneo o numero crudo
// del repo) a su id entero para usarla en inserciones de llaves/SQL.
function idActividad(t) {
  if (!t || t.actividad == null) return null;
  return t.actividad.id != null ? t.actividad.id : t.actividad;
}

class TorneoService {
  #torneos;
  #llaves;
  #posiciones;
  #equipos;
  #alumnos;
  #inscripciones;
  #notificaciones;

  constructor() {
    this.#torneos = new TorneoRepository();
    this.#llaves = new LlaveRepository();
    this.#posiciones = new PosicionRepository();
    this.#equipos = new EquipoRepository();
    this.#alumnos = new AlumnoRepository();
    this.#inscripciones = new InscripcionRepository();
    this.#notificaciones = new NotificacionService();
  }

  async crear(datos) {
    const torneo = new Torneo(
      datos.nombre,
      datos.actividad,
      datos.division,
      datos.anio,
      datos.semestre ?? 1,
      datos.estado,
      datos.grupos,
      {
        ...(datos.formulario || {}),
        requisitos: datos.requisitos,
        fechaAperturaInscripcion: datos.fechaAperturaInscripcion,
        fechaCierreInscripcion: datos.fechaCierreInscripcion,
      },
      datos.formato || "amistoso"
    );
    const doc = await this.#torneos.crear(torneo);
    return aTorneo(doc);
  }

  async obtenerTodos(filtro = {}) {
    return this.#torneos.obtenerTodos(filtro).map(aTorneo);
  }

  async obtenerPorId(id) {
    return aTorneo(this.#torneos.obtenerPorId(id));
  }

  async actualizar(id, datos) {
    const existente = await this.#torneos.obtenerPorId(id);
    if (!existente) throw new Error("Torneo no encontrado");

    const actualizar = {};
    if (datos.nombre) actualizar.nombre = datos.nombre;
    if (datos.division !== undefined) actualizar.division = datos.division;
    if (datos.formato !== undefined) {
      const f = String(datos.formato || "").trim().toLowerCase();
      if (!["amistoso", "competitivo"].includes(f)) throw new Error("Formato de torneo invalido");
      actualizar.formato = f;
    }
    if (datos.estado) actualizar.estado = datos.estado;
    if (datos.grupos) actualizar.grupos = datos.grupos;
    if (datos.formulario !== undefined) actualizar.formulario = datos.formulario;
    if (datos.requisitos !== undefined) actualizar.requisitos = datos.requisitos;
    if (datos.fechaAperturaInscripcion !== undefined) {
      actualizar.fechaAperturaInscripcion = datos.fechaAperturaInscripcion ? new Date(datos.fechaAperturaInscripcion) : null;
    }
    if (datos.fechaCierreInscripcion !== undefined) {
      actualizar.fechaCierreInscripcion = datos.fechaCierreInscripcion ? new Date(datos.fechaCierreInscripcion) : null;
    }

    const torneo = await this.#torneos.actualizar(id, actualizar);

    // Si se ajustaron los requisitos y habia estudiantes inscritos, se retiran
    // SOLO los que ya no cumplen los nuevos requisitos y se avisa al admin.
    let aviso = "";
    if (datos.requisitos !== undefined) {
      const req = { ...(existente.requisitos || {}), ...datos.requisitos };
      const genero = String(req.genero || "").trim().toLowerCase();
      const min = req.edadMinima != null ? Number(req.edadMinima) : null;
      const max = req.edadMaxima != null ? Number(req.edadMaxima) : null;
      const inscritos = await this.#alumnos.obtenerTodos({ torneos: id });
      const aRetirar = inscritos.filter((a) => {
        if (genero === "varones" && a.genero !== "M") return true;
        if (genero === "damas" && a.genero !== "F") return true;
        if (a.fechaNacimiento) {
          const edad = calcularEdad(a.fechaNacimiento);
          if (min !== null && (edad === null || edad < min)) return true;
          if (max !== null && (edad === null || edad > max)) return true;
        }
        return false;
      });
      if (aRetirar.length) {
        const ids = aRetirar.map((a) => a.id);
        const marcadores = ids.map(() => "?").join(",");
        const bd = obtenerConexion();
        // $pull del torneo en alumnos asociados.
        bd.prepare(`DELETE FROM alumno_torneos WHERE torneo = ? AND alumno IN (${marcadores})`).run(id, ...ids);
        // Posiciones de los establecimientos afectados.
        const ests = bd
          .prepare(`SELECT DISTINCT establecimiento FROM alumnos WHERE id IN (${marcadores})`)
          .all(...ids)
          .map((r) => r.establecimiento);
        if (ests.length) {
          const marcadoresEst = ests.map(() => "?").join(",");
          bd.prepare(`DELETE FROM posiciones WHERE torneo = ? AND establecimiento IN (${marcadoresEst})`).run(id, ...ests);
        }
        // Los saca de las inscripciones asociadas al torneo.
        bd.prepare(
          `DELETE FROM inscripcion_alumnos
           WHERE inscripcion IN (SELECT i.id FROM inscripciones i WHERE i.torneo = ?)
             AND alumno IN (${marcadores})`
        ).run(id, ...ids);
        aviso = `Se retiraron ${aRetirar.length} estudiante(s) que ya no cumplen los requisitos del torneo.`;
      }
    }

    if (datos.requisitos !== undefined) {
      await this.#notificaciones.crearParaCoordinadores({
        tipo: "requisitos",
        torneoId: id,
        mensaje: `El Admin actualizo los requisitos del torneo "${existente.nombre}". Revisa que tus inscritos sigan cumpliendolos.`,
      }).catch(() => {});
    }
    return { torneo: aTorneo(torneo), aviso };
  }

  // Empuja el ganador de una llave hacia la llave de la siguiente ronda.
  async #avanzar(ganadorId, padreId) {
    if (!ganadorId || !padreId) return;
    const padre = await this.#llaves.obtenerPorId(padreId);
    if (!padre) return;
    const ids = (padre.equipos || []).map((e) => String((e && e._id) || e));
    if (!ids.includes(String(ganadorId))) {
      const nuevos = [...ids, String(ganadorId)];
      await this.#llaves.actualizar(padreId, { equipos: nuevos });
    }
  }

  // ============================================================
  // Fase de grupos: genera round-robin por grupo.
  // La eliminatoria se genera aparte con ejecutarBracket().
  // Los participantes son los EQUIPOS del torneo (estudiantes de
  // distintos establecimientos), no los establecimientos.
  // ============================================================
  async #obtenerParticipantes(torneoId) {
    const torneo = await this.#torneos.obtenerPorId(torneoId);
    if (!torneo) throw new Error("Torneo no encontrado");
    const equipos = await this.#equipos.obtenerPorTorneo(torneoId);
    if (!equipos.length) {
      throw new Error(
        "El torneo no tiene equipos. Cree o sortee los equipos antes de ejecutar el sorteo"
      );
    }
    return equipos.map((eq) => ({
      establecimiento: eq.id,
      nombre: eq.nombre,
      division: "Libre",
      estado: "regular",
      valor: 1,
    }));
  }

  async ejecutarSorteo(torneoId) {
    const torneo = await this.#torneos.obtenerPorId(torneoId);
    if (!torneo) throw new Error("Torneo no encontrado");
    const participantes = await this.#obtenerParticipantes(torneoId);
    if (participantes.length < 2) throw new Error("Se necesitan al menos 2 equipos para el sorteo");
    await this.#llaves.eliminarPorTorneo(torneoId);

    // Competitivo: sin fase de grupos; todos avanzan directo al bracket.
    if (torneo.formato === "competitivo") {
      const bracket = await this.ejecutarBracket(torneoId, { modo: "desempeno" });
      return { faseGrupos: false, ...bracket, llaves: await this.#llaves.obtenerTodos({ torneo: torneoId }) };
    }

    const grupos = ["Llave"];
    const repartidos = Sorteo.repartirEnGrupos(participantes, grupos);
    const resumen = [];
    for (const g of repartidos) {
      const cruces = Sorteo.crucesRoundRobin(g.participantes);
      if (cruces.length) {
        await this.#llaves.crearMuchas(cruces.map(([a, b], idx) => ({
          torneo: torneoId, actividad: idActividad(torneo), division: [a.division, b.division].find(Boolean) || "Libre",
          grupo: g.nombre, equipos: [a.establecimiento, b.establecimiento], bye: false, estado: "pendiente", nivel: 0, orden: idx,
        })));
      }
      resumen.push({ grupo: g.nombre, equipos: g.participantes.length });
    }
    await this.#torneos.actualizar(torneoId, { estado: "en_curso" });
    // El bracket se genera automaticamente segun la cantidad de equipos:
    // 2 -> Final, 4 -> Semifinal, 8 -> Cuartos, 16 -> Octavos.
    const bracket = await this.ejecutarBracket(torneoId, { modo: "desempeno" });
    return { faseGrupos: true, grupos: resumen, ...bracket, llaves: await this.#llaves.obtenerTodos({ torneo: torneoId }) };
  }

  // Tabla de posiciones de la fase de grupos.
  async obtenerTabla(torneoId) {
    const llavesGrupo = await this.#llaves.obtenerTodos({ torneo: torneoId, nivel: 0 });
    const porGrupo = {};
    for (const l of llavesGrupo) {
      const name = l.grupo || "Llave";
      porGrupo[name] = porGrupo[name] || { nombre: name, llaves: [] };
      porGrupo[name].llaves.push(l);
    }
    return Object.values(porGrupo).map((g) => {
      const filas = {};
      g.llaves.forEach((l) => {
        (l.equipos || []).forEach((e) => {
          if (!e) return; const id = String(e._id || e);
          if (!filas[id]) filas[id] = { equipo: e, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
        });
        if (l.estado !== "jugado") return;
        const [a, b] = l.equipos || [];
        if (!a || !b) return;
        const pa = l.puntajeA ?? 0, pb = l.puntajeB ?? 0;
        const filaA = filas[String(a._id || a)], filaB = filas[String(b._id || b)];
        if (filaA) { filaA.pj++; filaA.gf += pa; filaA.gc += pb; if (pa > pb) filaA.g++; else if (pa === pb) filaA.e++; else filaA.p++; }
        if (filaB) { filaB.pj++; filaB.gf += pb; filaB.gc += pa; if (pb > pa) filaB.g++; else if (pb === pa) filaB.e++; else filaB.p++; }
      });
      const tabla = Object.values(filas).map((f) => { f.dg = f.gf - f.gc; f.pts = f.g * 3 + f.e; return f; });
      tabla.sort((x, y) => (y.pts - x.pts) || (y.dg - x.dg) || (y.gf - x.gf) || String(x.equipo.nombre || "").localeCompare(String(y.equipo.nombre || "")));
      tabla.forEach((f, i) => { f.pos = i + 1; });
      return { grupo: g.nombre, tabla };
    });
  }

  // Bracket eliminatorio: todos los equipos clasifican despues de la fase
  // de grupos. La primera ronda depende de la cantidad de equipos:
  // 4 -> semifinal, 8 -> cuartos de final, 16 -> octavos de final.
  // El emparejamiento se hace segun `modo` ("desempeno" igualando al mejor
  // con el peor segun la tabla, "azar" o "manual" con cruces indicados).
  async ejecutarBracket(torneoId, { modo = "desempeno", crucesManuales = [] } = {}) {
    const torneo = await this.#torneos.obtenerPorId(torneoId);
    if (!torneo) throw new Error("Torneo no encontrado");
    const tablas = await this.obtenerTabla(torneoId);
    const participantes = await this.#obtenerParticipantes(torneoId);
    const porId = {};
    participantes.forEach((p) => { porId[String(p.establecimiento)] = p; });

    // Competitivo: no existe fase de grupos, clasifican todos los equipos inscritos.
    // Amistoso: todos los equipos de la fase de grupos clasifican al bracket.
    let clasificados;
    if (torneo.formato === "competitivo") {
      clasificados = participantes;
    } else {
      const tablaUnica = (tablas && tablas[0]) || { tabla: [] };
      clasificados = tablaUnica.tabla
        .map((f) => porId[String(f.equipo._id || f.equipo)])
        .filter(Boolean);
    }
    if (clasificados.length < 2) {
      throw new Error("Se necesitan al menos 2 equipos con puntuacion para armar las eliminatorias");
    }
    const idsClasificados = clasificados.map((p) => String(p.establecimiento));

    // Limpia rondas anteriores (nivel >= 1) del torneo.
    const bd = obtenerConexion();
    bd.prepare(`DELETE FROM llaves WHERE torneo = ? AND nivel >= 1`).run(torneoId);

    // Primera ronda segun el modo de sorteo elegido.
    let cruces;
    if (modo === "manual" && crucesManuales.length) {
      cruces = crucesManuales.map((par) => {
        const ids = (Array.isArray(par) ? par : []).map((x) => (x ? String(x) : null));
        return ids.length === 1 ? [ids[0], null] : ids;
      });
    } else if (modo === "azar") {
      const revueltos = Sorteo.mezclar(idsClasificados);
      cruces = [];
      for (let i = 0; i < revueltos.length; i += 2) {
        cruces.push([revueltos[i], revueltos[i + 1] || null]);
      }
    } else {
      // Desempeno (igualado): 1° con el ultimo, 2° con el penultimo, etc.
      cruces = [];
      let i = 0;
      let j = idsClasificados.length - 1;
      while (i <= j) {
        cruces.push([idsClasificados[i], i === j ? null : idsClasificados[j]]);
        i += 1;
        j -= 1;
      }
    }

    const NOMBRES_FASES = {
      1: ["Final"],
      2: ["Semifinal", "Final"],
      3: ["Cuartos de Final", "Semifinal", "Final"],
      4: ["Octavos de Final", "Cuartos de Final", "Semifinal", "Final"],
    };
    const totalRondas = Sorteo.nivelesNecesarios(clasificados.length);
    const fases = NOMBRES_FASES[totalRondas] || ["Final"];

    const docsR1 = [];
    cruces.forEach(([a, b], idx) => {
      docsR1.push({
        torneo: torneoId, actividad: idActividad(torneo), division: "Libre",
        grupo: fases[0] || "Eliminatoria", equipos: [a, b].filter(Boolean),
        bye: !b, estado: "pendiente", nivel: 1, orden: idx,
      });
    });
    const ronda1 = await this.#llaves.crearMuchas(docsR1);
    let rondaAnterior = ronda1;
    for (let nivel = 2; nivel <= totalRondas; nivel++) {
      const count = Math.ceil(rondaAnterior.length / 2);
      const specs = [];
      for (let i = 0; i < count; i++) {
        specs.push({ torneo: torneoId, actividad: idActividad(torneo), division: "Libre", grupo: fases[nivel - 1] || "Eliminatoria", equipos: [], bye: false, estado: "pendiente", nivel, orden: i });
      }
      const docsNivel = await this.#llaves.crearMuchas(specs);
      for (let i = 0; i < docsNivel.length; i++) {
        const padre = docsNivel[i];
        const hijos = [rondaAnterior[i * 2]];
        if (rondaAnterior[i * 2 + 1]) hijos.push(rondaAnterior[i * 2 + 1]);
        await this.#llaves.actualizar(padre._id, { hijos: hijos.map((h) => h._id) });
        for (const h of hijos) await this.#llaves.actualizar(h._id, { padre: padre._id });
      }
      rondaAnterior = docsNivel;
    }
    const llavesBye = await this.#llaves.obtenerTodos({ torneo: torneoId, bye: true, nivel: 1 });
    for (const l of llavesBye) {
      if (l.equipos.length === 1) {
        const ganadorId = l.equipos[0]._id || l.equipos[0];
        await this.#llaves.actualizar(l._id, { estado: "jugado", ganador: ganadorId });
        await this.#avanzar(ganadorId, l.padre);
      }
    }
    return { totalRondas, fases, totalLlaves: Math.ceil(clasificados.length / 2), llaves: await this.#llaves.obtenerTodos({ torneo: torneoId }) };
  }

  async obtenerLlaves(torneoId) {
    return this.#llaves.obtenerTodos({ torneo: torneoId });
  }

  async obtenerAgenda() {
    const torneosVigentes = await this.#torneos.obtenerTodos();
    const vigentes = torneosVigentes.filter((t) =>
      ["activo", "en_curso", "inscripciones"].includes(t.estado)
    );
    const ids = vigentes.map((t) => t.id);
    const llaves = ids.length
      ? await this.#llaves.obtenerTodos({ torneo: { $in: ids } })
      : [];

    const llavesConFecha = llaves.filter((l) => l.fecha);
    const mapaTorneo = {};
    for (const t of vigentes) mapaTorneo[String(t.id)] = aTorneo(t);

    const eventos = llavesConFecha.map((l) => {
      const torneo = mapaTorneo[String(l.torneo._id || l.torneo)] || {};
      const equipos = (l.equipos || []).map((e) => e && (e.nombre || e._id)).filter(Boolean);
      return {
        llaveId: l._id,
        formato: torneo.formato || "amistoso",
        fecha: l.fecha,
        hora: l.hora,
        horaTermino: l.horaTermino || "",
        lugar: l.lugar,
        grupo: l.grupo,
        fase: l.nivel >= 1 ? l.grupo : "Fase de Grupos",
        division: torneo.division || l.division || "",
        torneoId: torneo._id || l.torneo,
        torneo: torneo.nombre || "Torneo",
        actividad: torneo.actividad ? torneo.actividad.nombre : "-",
        equipos,
      };
    });

    eventos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    return { eventos };
  }

  async actualizarLlave(llaveId, datos) {
    const llave = await this.#llaves.obtenerPorId(llaveId);
    if (!llave) throw new Error("Llave no encontrada");
    const actualizar = {};
    if (datos.fecha) actualizar.fecha = new Date(datos.fecha);
    if (datos.hora) actualizar.hora = datos.hora;
    if (datos.horaTermino !== undefined) actualizar.horaTermino = datos.horaTermino;
    if (datos.lugar) actualizar.lugar = datos.lugar;
    if (datos.grupo) actualizar.grupo = datos.grupo;
    // Edicion manual del sorteo: permite reasignar los equipos de la llave.
    if (datos.equipos !== undefined) {
      if (llave.estado === "jugado") throw new Error("No puede editar los equipos de una llave ya jugada");
      actualizar.equipos = (Array.isArray(datos.equipos) ? datos.equipos : [])
        .filter((e) => e)
        .map((e) => String(e));
    }
    return this.#llaves.actualizar(llaveId, actualizar);
  }

  // Registro de resultados y puntajes de una llave.
  async registrarResultado(llaveId, { puntajeA, puntajeB }) {
    const llave = await this.#llaves.obtenerPorId(llaveId);
    if (!llave) throw new Error("Llave no encontrada");
    if (llave.bye) throw new Error("Una llave 'libre' no registra resultados");

    const pa = parseInt(puntajeA, 10);
    const pb = parseInt(puntajeB, 10);
    if (Number.isNaN(pa) || Number.isNaN(pb) || pa < 0 || pb < 0) {
      throw new Error("Puntajes invalidos");
    }

    const ganador = pa === pb ? null : pa > pb ? llave.equipos[0] : llave.equipos[1];
    const ganadorId = ganador ? (ganador._id || ganador) : null;
    const doc = await this.#llaves.registrarResultado(llaveId, {
      puntajeA: pa,
      puntajeB: pb,
      ganador: ganadorId,
    });
    // El ganador avanza a la siguiente ronda del bracket.
    await this.#avanzar(ganadorId, doc.padre || null);
    return doc;
  }

  // Posiciones finales (1º, 2º, 3º) del torneo.
  async registrarPosiciones(torneoId, posiciones) {
    const existente = await this.#torneos.obtenerPorId(torneoId);
    if (!existente) throw new Error("Torneo no encontrado");

    const aInsertar = posiciones.map((p) => ({
      torneo: torneoId,
      establecimiento: p.establecimiento,
      posicion: p.posicion,
    }));

    await this.#posiciones.reemplazarPorTorneo(torneoId, aInsertar);
    await this.#torneos.actualizar(torneoId, { estado: "finalizado" });
    return this.#posiciones.obtenerPorTorneo(torneoId);
  }

  async obtenerPosiciones(torneoId) {
    return this.#posiciones.obtenerPorTorneo(torneoId);
  }

  async suspender(id) {
    const existente = await this.#torneos.obtenerPorId(id);
    if (!existente) throw new Error("Torneo no encontrado");
    const torneo = await this.#torneos.actualizar(id, {
      estado: "suspendido",
      estadoPrevio: existente.estado,
    });
    // El admin suspendio el torneo: aviso inmediato a los coordinadores.
    await this.#notificaciones.crearParaCoordinadores({
      tipo: "suspension",
      torneoId: id,
      mensaje: `El Admin suspendio el torneo "${existente.nombre}". Los coordinadores no podran inscribir estudiantes hasta que se reactive.`,
    }).catch(() => {});
    return aTorneo(torneo);
  }

  async reactivar(id) {
    const suspendido = await this.#torneos.obtenerPorId(id);
    if (!suspendido) throw new Error("Torneo no encontrado");
    const torneo = await this.#torneos.actualizar(id, {
      estado: suspendido.estadoPrevio || "programado",
    });
    // Se reactivo: los coordinadores vuelven a poder inscribir.
    await this.#notificaciones.crearParaCoordinadores({
      tipo: "reactivacion",
      torneoId: id,
      mensaje: `El Admin reabrio el torneo "${suspendido.nombre}". Las inscripciones vuelven a estar disponibles para los coordinadores.`,
    }).catch(() => {});
    return aTorneo(torneo);
  }

  async eliminar(id) {
    const existente = await this.#torneos.obtenerPorId(id);
    // Cascada completa: cualquier dato que referencia al torneo se borra con el.
    await this.#llaves.eliminarPorTorneo(id);
    await this.#equipos.eliminarPorTorneo(id);
    const bd = obtenerConexion();
    await bd.prepare(`DELETE FROM posiciones WHERE torneo = ?`).run(id);
    await bd.prepare(`DELETE FROM inscripciones WHERE torneo = ?`).run(id);
    // Quita el torneo de los alumnos que lo tenian asociado.
    await bd.prepare(`DELETE FROM alumno_torneos WHERE torneo = ?`).run(id);
    if (existente) {
      await this.#notificaciones.crearParaCoordinadores({
        tipo: "eliminacion",
        torneoId: null,
        mensaje: `El Admin elimino definitivamente el torneo "${existente.nombre}".`,
      }).catch(() => {});
    }
    return this.#torneos.eliminar(id);
  }
}

module.exports = TorneoService;