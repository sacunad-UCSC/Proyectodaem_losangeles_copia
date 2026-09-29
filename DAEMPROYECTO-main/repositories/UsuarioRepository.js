const { obtenerConexion } = require("../db/conexion");
const { aplanar, nowISO } = require("../db/util");

class UsuarioRepository {
  crear(datos) {
    const bd = obtenerConexion();
    const r = bd
      .prepare(
        `INSERT INTO usuarios
          (rut, nombre, email, telefono, rol, claveHash, establecimiento)
         VALUES (?,?,?,?,?,?,?)`
      )
      .run(
        String(datos.rut || "").toUpperCase(),
        datos.nombre,
        datos.email || "",
        datos.telefono || "",
        datos.rol || "coordinador",
        datos.claveHash,
        datos.establecimiento ?? null
      );
    const id = r.lastInsertRowid;
    for (const activ of datos.actividades || []) {
      bd.prepare(
        `INSERT OR IGNORE INTO usuario_actividades (usuario, actividad) VALUES (?,?)`
      ).run(id, activ);
    }
    return this.obtenerPorId(id);
  }

  obtenerPorRut(rut) {
    const bd = obtenerConexion();
    const fila = bd
      .prepare(`SELECT * FROM usuarios WHERE rut = ?`)
      .get(String(rut || "").toUpperCase());
    return fila ? aplanar("usuarios", fila) : null;
  }

  obtenerPorId(id) {
    const bd = obtenerConexion();
    const fila = bd.prepare(`SELECT * FROM usuarios WHERE id = ?`).get(id);
    if (!fila) return null;
    const u = aplanar("usuarios", fila);
    u.id = u.id;
    u.actividades = bd
      .prepare(
        `SELECT a.* FROM usuario_actividades ua
         JOIN actividades a ON a.id = ua.actividad
         WHERE ua.usuario = ?`
      )
      .all(id)
      .map(aplanar.bind(null, "actividades"));
    return u;
  }

  obtenerTodos() {
    const bd = obtenerConexion();
    const filas = bd
      .prepare(
        `SELECT u.*, e.nombre AS establecimientoNombre
         FROM usuarios u
         LEFT JOIN establecimientos e ON e.id = u.establecimiento
         ORDER BY u.nombre`
      )
      .all();
    return filas.map((f) => aplanar("usuarios", f));
  }

  actualizar(id, datos) {
    const bd = obtenerConexion();
    const campos = [];
    const params = [];
    const directos = ["rut", "nombre", "email", "telefono", "rol", "claveHash", "activo"];
    for (const c of directos) {
      if (datos[c] !== undefined) {
        campos.push(`${c} = ?`);
        params.push(c === "rut" ? String(datos[c]).toUpperCase() : datos[c]);
      }
    }
    if (datos.establecimiento !== undefined) {
      campos.push(`establecimiento = ?`);
      params.push(datos.establecimiento ?? null);
    }
    if (campos.length) {
      params.push(nowISO());
      params.push(id);
      bd.prepare(`UPDATE usuarios SET ${campos.join(", ")} , updatedAt = ? WHERE id = ?`).run(...params);
    }
    if (datos.actividades !== undefined) {
      bd.prepare(`DELETE FROM usuario_actividades WHERE usuario = ?`).run(id);
      for (const activ of datos.actividades || []) {
        bd.prepare(
          `INSERT OR IGNORE INTO usuario_actividades (usuario, actividad) VALUES (?,?)`
        ).run(id, activ);
      }
    }
    return this.obtenerPorId(id);
  }

  eliminar(id) {
    const bd = obtenerConexion();
    bd.prepare(`DELETE FROM usuario_actividades WHERE usuario = ?`).run(id);
    const r = bd.prepare(`DELETE FROM usuarios WHERE id = ?`).run(id);
    return r.changes > 0;
  }
}

module.exports = UsuarioRepository;
