const { obtenerConexion } = require("../db/conexion");
const { nowISO } = require("../db/util");

// Los repos no cubren notificaciones: se accede directo con SQL. El output
// replica el shape de Mongoose (leida booleano) y agrega _id para el front.
function aNotificacion(f) {
  if (!f) return null;
  return {
    id: f.id,
    _id: f.id,
    destinatario: f.destinatario,
    tipo: f.tipo,
    torneo: f.torneo,
    mensaje: f.mensaje,
    leida: !!f.leida,
    refNombre: f.refNombre,
    fechaCreacion: f.fechaCreacion,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

// Bitacora de cambios del Admin sobre los torneos, dirigida a los
// coordinadores. Cada accion (abrir/dejar de abrir inscripciones, cambiar
// requisitos, suspender, reactivar o eliminar un torneo) genera una
// notificacion persistente. El coordinador la ve en su campana/panel y al
// hacer clic es llevado a la vista del torneo correspondiente.
class NotificacionService {
  async crear({ destinatario, tipo, torneoId, mensaje, refNombre = "" }) {
    if (!destinatario) return null;
    const bd = obtenerConexion();
    const ahora = nowISO();
    const r = bd
      .prepare(
        `INSERT INTO notificaciones
          (destinatario, tipo, torneo, mensaje, leida, refNombre, fechaCreacion, createdAt, updatedAt)
         VALUES (?,?,?,?,0,?,?,?,?)`
      )
      .run(destinatario, tipo, torneoId || null, mensaje, refNombre || "", ahora, ahora, ahora);
    return this.#obtenerPorId(r.lastInsertRowid);
  }

  #obtenerPorId(id) {
    const bd = obtenerConexion();
    return aNotificacion(bd.prepare(`SELECT * FROM notificaciones WHERE id = ?`).get(id));
  }

  // Notifica a todos los coordinadores (un torneo es comunal; cualquier
  // coordinador puede estar postulando estudiantes al mismo).
  async crearParaCoordinadores(datos) {
    const bd = obtenerConexion();
    const coords = bd.prepare(`SELECT id FROM usuarios WHERE rol = 'coordinador'`).all();
    const creadas = [];
    for (const c of coords) {
      creadas.push(
        await this.crear({
          destinatario: c.id,
          tipo: datos.tipo,
          torneoId: datos.torneoId,
          mensaje: datos.mensaje,
          refNombre: datos.refNombre || "",
        })
      );
    }
    return creadas;
  }

  async listar(usuarioId) {
    const bd = obtenerConexion();
    return bd
      .prepare(
        `SELECT * FROM notificaciones
          WHERE destinatario = ? AND tipo != 'eliminacion'
          ORDER BY createdAt DESC`
      )
      .all(usuarioId)
      .map(aNotificacion);
  }

  async noLeidas(usuarioId) {
    const bd = obtenerConexion();
    const fila = bd
      .prepare(
        `SELECT COUNT(*) AS total FROM notificaciones
          WHERE destinatario = ? AND tipo != 'eliminacion' AND leida = 0`
      )
      .get(usuarioId);
    return fila.total;
  }

  async marcarLeida(id, usuarioId) {
    const bd = obtenerConexion();
    const r = bd
      .prepare(
        `UPDATE notificaciones SET leida = 1, updatedAt = ? WHERE id = ? AND destinatario = ?`
      )
      .run(nowISO(), id, usuarioId);
    if (r.changes === 0) throw new Error("Notificacion no encontrada");
    return this.#obtenerPorId(id);
  }

  async marcarTodasLeidas(usuarioId) {
    const bd = obtenerConexion();
    bd.prepare(
      `UPDATE notificaciones SET leida = 1, updatedAt = ? WHERE destinatario = ? AND leida = 0`
    ).run(nowISO(), usuarioId);
    return { ok: true };
  }
}

module.exports = NotificacionService;