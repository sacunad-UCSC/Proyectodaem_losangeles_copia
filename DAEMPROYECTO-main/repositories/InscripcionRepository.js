const { obtenerConexion } = require("../db/conexion");
const { descodificarJson, nowISO } = require("../db/util");

const SELECT_INSCRIPCION = `
  SELECT i.*,
         e.nombre AS establecimientoNombre,
         e.codigo AS establecimientoCodigo,
         e.dependencia AS establecimientoDependencia,
         e.direccion AS establecimientoDireccion,
         e.contacto AS establecimientoContacto,
         a.nombre AS actividadNombre,
         a.area AS actividadArea,
         a.divisiones AS actividadDivisiones,
         a.anio AS actividadAnio,
         a.semestre AS actividadSemestre,
         a.estado AS actividadEstado,
         a.edadMinima AS actividadEdadMinima,
         a.edadMaxima AS actividadEdadMaxima,
         a.limiteInscritos AS actividadLimiteInscritos
  FROM inscripciones i
  JOIN establecimientos e ON e.id = i.establecimiento
  JOIN actividades a ON a.id = i.actividad
`;

const CAMPOS_FILTRO = ["establecimiento", "actividad", "division", "estado", "torneo", "grupo"];

function aplanarInscripcion(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    establecimiento: {
      id: fila.establecimiento,
      codigo: fila.establecimientoCodigo,
      nombre: fila.establecimientoNombre,
      dependencia: fila.establecimientoDependencia,
      direccion: fila.establecimientoDireccion,
      contacto: fila.establecimientoContacto,
    },
    actividad: {
      id: fila.actividad,
      nombre: fila.actividadNombre,
      area: fila.actividadArea,
      divisiones: descodificarJson(fila.actividadDivisiones, []),
      anio: fila.actividadAnio,
      semestre: fila.actividadSemestre,
      estado: fila.actividadEstado,
      edadMinima: fila.actividadEdadMinima,
      edadMaxima: fila.actividadEdadMaxima,
      limiteInscritos: fila.actividadLimiteInscritos,
    },
    division: fila.division,
    estado: fila.estado,
    rutCoordinador: fila.rutCoordinador,
    torneo: fila.torneo,
    grupo: fila.grupo,
    detalle: fila.detalle,
    alumnos: [],
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
  };
}

function cargarAlumnos(bd, filas) {
  if (!filas.length) return;
  const ids = filas.map((f) => f.id);
  const marcadores = ids.map(() => "?").join(",");
  const filasAlumnos = bd
    .prepare(
      `SELECT ia.inscripcion, a.id, a.rut, a.nombre, a.genero, a.fechaNacimiento,
              a.apoderado, a.email, a.telefono, a.establecimiento, a.actividad,
              a.division, a.inscripcion AS alumnoInscripcion,
              a.createdAt, a.updatedAt
       FROM inscripcion_alumnos ia
       JOIN alumnos a ON a.id = ia.alumno
       WHERE ia.inscripcion IN (${marcadores})
       ORDER BY ia.rowid`
    )
    .all(...ids);
  const porInscripcion = {};
  for (const f of filasAlumnos) {
    const alumno = {
      id: f.id,
      rut: f.rut,
      nombre: f.nombre,
      genero: f.genero,
      fechaNacimiento: f.fechaNacimiento,
      apoderado: f.apoderado,
      email: f.email,
      telefono: f.telefono,
      establecimiento: f.establecimiento,
      actividad: f.actividad,
      division: f.division,
      inscripcion: f.alumnoInscripcion,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    };
    (porInscripcion[f.inscripcion] = porInscripcion[f.inscripcion] || []).push(alumno);
  }
  for (const f of filas) {
    f.alumnos = porInscripcion[f.id] || [];
  }
}

class InscripcionRepository {
  crear(inscripcion) {
    const bd = obtenerConexion();
    const r = bd
      .prepare(
        `INSERT INTO inscripciones
          (establecimiento, actividad, division, estado, rutCoordinador,
           torneo, grupo, detalle)
         VALUES (?,?,?,?,?,?,?,?)`
      )
      .run(
        inscripcion.establecimiento,
        inscripcion.actividad,
        inscripcion.division,
        inscripcion.estado ?? "en_proceso",
        inscripcion.rutCoordinador ?? "",
        inscripcion.torneo ?? null,
        inscripcion.grupo ?? "",
        inscripcion.detalle ?? ""
      );
    return this.obtenerPorId(r.lastInsertRowid);
  }

  obtenerTodos(filtro = {}) {
    const bd = obtenerConexion();
    const condiciones = [];
    const params = [];
    for (const [clave, valor] of Object.entries(filtro)) {
      if (!CAMPOS_FILTRO.includes(clave)) continue;
      if (valor && typeof valor === "object" && !Array.isArray(valor) && Array.isArray(valor.$in)) {
        condiciones.push(`i.${clave} IN (${valor.$in.map(() => "?").join(",")})`);
        params.push(...valor.$in);
      } else {
        condiciones.push(`i.${clave} = ?`);
        params.push(valor && valor._id !== undefined ? valor._id : valor);
      }
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
    const filas = bd
      .prepare(`${SELECT_INSCRIPCION} ${where} ORDER BY i.createdAt DESC`)
      .all(...params);
    const inscripciones = filas.map(aplanarInscripcion);
    cargarAlumnos(bd, inscripciones);
    return inscripciones;
  }

  obtenerPorId(id) {
    const bd = obtenerConexion();
    const fila = bd.prepare(`${SELECT_INSCRIPCION} WHERE i.id = ?`).get(id);
    if (!fila) return null;
    const inscripcion = aplanarInscripcion(fila);
    cargarAlumnos(bd, [inscripcion]);
    return inscripcion;
  }

  buscar(establecimiento, actividad, division) {
    const bd = obtenerConexion();
    const fila = bd
      .prepare(
        `SELECT * FROM inscripciones
         WHERE establecimiento = ? AND actividad = ? AND division = ?`
      )
      .get(establecimiento, actividad, division);
    if (!fila) return null;
    return {
      id: fila.id,
      establecimiento: fila.establecimiento,
      actividad: fila.actividad,
      division: fila.division,
      estado: fila.estado,
      rutCoordinador: fila.rutCoordinador,
      torneo: fila.torneo,
      grupo: fila.grupo,
      detalle: fila.detalle,
      createdAt: fila.createdAt,
      updatedAt: fila.updatedAt,
    };
  }

  actualizar(id, datos) {
    const bd = obtenerConexion();
    const columnas = [
      "establecimiento",
      "actividad",
      "division",
      "estado",
      "rutCoordinador",
      "torneo",
      "grupo",
      "detalle",
    ];
    const campos = [];
    const params = [];
    for (const c of columnas) {
      if (datos[c] !== undefined) {
        campos.push(`${c} = ?`);
        params.push(datos[c]);
      }
    }
    if (datos.alumnos !== undefined) {
      const ids = (Array.isArray(datos.alumnos) ? datos.alumnos : [])
        .map((v) => (v && v._id !== undefined ? v._id : v))
        .filter((v) => v !== null && v !== undefined);
      bd.prepare(`DELETE FROM inscripcion_alumnos WHERE inscripcion = ?`).run(id);
      const insertar = bd.prepare(
        `INSERT OR IGNORE INTO inscripcion_alumnos (inscripcion, alumno) VALUES (?,?)`
      );
      for (const alumnoId of ids) insertar.run(id, alumnoId);
    }
    if (campos.length || datos.alumnos !== undefined) {
      campos.push("updatedAt = ?");
      params.push(nowISO());
      params.push(id);
      bd.prepare(`UPDATE inscripciones SET ${campos.join(", ")} WHERE id = ?`).run(...params);
    }
    return this.obtenerPorId(id);
  }

  cambiarEstado(id, estado) {
    return this.actualizar(id, { estado });
  }

  eliminar(id) {
    const bd = obtenerConexion();
    const r = bd.prepare(`DELETE FROM inscripciones WHERE id = ?`).run(id);
    return r.changes > 0;
  }
}

module.exports = InscripcionRepository;