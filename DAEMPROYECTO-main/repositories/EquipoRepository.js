const { obtenerConexion } = require("../db/conexion");
const { nowISO } = require("../db/util");

function aplanarEquipo(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    torneo: fila.torneo,
    nombre: fila.nombre,
    alumnos: [],
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
  };
}

function cargarAlumnos(bd, equipos) {
  if (!equipos.length) return;
  const ids = equipos.map((e) => e.id);
  const marcadores = ids.map(() => "?").join(",");
  const filas = bd
    .prepare(
      `SELECT ea.equipo, a.id, a.rut, a.nombre, a.genero, a.fechaNacimiento,
              a.apoderado, a.email, a.telefono, a.establecimiento, a.actividad,
              a.division, a.inscripcion, a.createdAt, a.updatedAt,
              e.nombre AS establecimientoNombre,
              e.codigo AS establecimientoCodigo,
              e.dependencia AS establecimientoDependencia,
              e.direccion AS establecimientoDireccion,
              e.contacto AS establecimientoContacto
       FROM equipo_alumnos ea
       JOIN alumnos a ON a.id = ea.alumno
       LEFT JOIN establecimientos e ON e.id = a.establecimiento
       WHERE ea.equipo IN (${marcadores})
       ORDER BY ea.rowid`
    )
    .all(...ids);
  const porEquipo = {};
  for (const f of filas) {
    const alumno = {
      id: f.id,
      rut: f.rut,
      nombre: f.nombre,
      genero: f.genero,
      fechaNacimiento: f.fechaNacimiento,
      apoderado: f.apoderado,
      email: f.email,
      telefono: f.telefono,
      establecimiento: f.establecimiento
        ? {
            id: f.establecimiento,
            codigo: f.establecimientoCodigo,
            nombre: f.establecimientoNombre,
            dependencia: f.establecimientoDependencia,
            direccion: f.establecimientoDireccion,
            contacto: f.establecimientoContacto,
          }
        : null,
      actividad: f.actividad,
      division: f.division,
      inscripcion: f.inscripcion,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    };
    (porEquipo[f.equipo] = porEquipo[f.equipo] || []).push(alumno);
  }
  for (const e of equipos) {
    e.alumnos = porEquipo[e.id] || [];
  }
}

function idDe(valor) {
  if (valor && typeof valor === "object" && valor._id !== undefined) return valor._id;
  return valor;
}

class EquipoRepository {
  crear(datos) {
    const bd = obtenerConexion();
    const r = bd
      .prepare(`INSERT INTO equipos (torneo, nombre) VALUES (?,?)`)
      .run(datos.torneo, datos.nombre);
    const id = r.lastInsertRowid;
    const insertar = bd.prepare(
      `INSERT OR IGNORE INTO equipo_alumnos (equipo, alumno) VALUES (?,?)`
    );
    for (const a of datos.alumnos || []) {
      const alumnoId = idDe(a);
      if (alumnoId !== null && alumnoId !== undefined) insertar.run(id, alumnoId);
    }
    return this.obtenerPorId(id);
  }

  obtenerPorTorneo(torneoId) {
    const bd = obtenerConexion();
    const filas = bd
      .prepare(`SELECT * FROM equipos WHERE torneo = ? ORDER BY nombre ASC`)
      .all(torneoId);
    const equipos = filas.map(aplanarEquipo);
    cargarAlumnos(bd, equipos);
    return equipos;
  }

  obtenerPorId(id) {
    const bd = obtenerConexion();
    const fila = bd.prepare(`SELECT * FROM equipos WHERE id = ?`).get(id);
    if (!fila) return null;
    const equipo = aplanarEquipo(fila);
    cargarAlumnos(bd, [equipo]);
    return equipo;
  }

  eliminar(id) {
    const bd = obtenerConexion();
    const r = bd.prepare(`DELETE FROM equipos WHERE id = ?`).run(id);
    return r.changes > 0;
  }

  eliminarPorTorneo(torneoId) {
    const bd = obtenerConexion();
    const r = bd.prepare(`DELETE FROM equipos WHERE torneo = ?`).run(torneoId);
    return { deletedCount: r.changes };
  }
}

module.exports = EquipoRepository;