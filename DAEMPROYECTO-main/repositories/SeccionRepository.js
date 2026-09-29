const { obtenerConexion } = require("../db/conexion");
const { aplanar, nowISO } = require("../db/util");

class SeccionRepository {
  crear(seccion) {
    const bd = obtenerConexion();
    const r = bd
      .prepare(`INSERT INTO secciones (nombre, area, anio) VALUES (?,?,?)`)
      .run(seccion.nombre, seccion.area, seccion.anio);
    return this.obtenerPorId(r.lastInsertRowid);
  }

  obtenerTodos(filtro = {}) {
    const bd = obtenerConexion();
    const condiciones = [];
    const params = [];
    if (filtro.nombre !== undefined) {
      condiciones.push("nombre = ?");
      params.push(filtro.nombre);
    }
    if (filtro.area !== undefined) {
      condiciones.push("area = ?");
      params.push(filtro.area);
    }
    if (filtro.anio !== undefined) {
      condiciones.push("anio = ?");
      params.push(filtro.anio);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
    return bd
      .prepare(`SELECT * FROM secciones ${where} ORDER BY area ASC, nombre ASC`)
      .all(...params)
      .map((f) => aplanar("secciones", f));
  }

  obtenerPorId(id) {
    const bd = obtenerConexion();
    const fila = bd.prepare(`SELECT * FROM secciones WHERE id = ?`).get(id);
    return fila ? aplanar("secciones", fila) : null;
  }

  actualizar(id, datos) {
    const bd = obtenerConexion();
    const campos = [];
    const params = [];
    const mapeo = {
      nombre: "nombre",
      area: "area",
      anio: "anio",
    };
    for (const [clave, destino] of Object.entries(mapeo)) {
      if (datos[clave] !== undefined) {
        campos.push(`${clave} = ?`);
        params.push(datos[clave]);
      }
    }
    if (!campos.length) return this.obtenerPorId(id);
    campos.push(`updatedAt = ?`);
    params.push(nowISO());
    params.push(id);
    bd.prepare(`UPDATE secciones SET ${campos.join(", ")} WHERE id = ?`).run(...params);
    return this.obtenerPorId(id);
  }

  eliminar(id) {
    const bd = obtenerConexion();
    const r = bd.prepare(`DELETE FROM secciones WHERE id = ?`).run(id);
    return r.changes > 0;
  }
}

/**
 * Contrato de metodos que usan los servicios (equivalencia con Mongo):
 *  - crear(seccion)         -> model.create
 *  - obtenerTodos(filtro)   -> find(filtro) + sort({area:1,nombre:1}) + lean
 *  - obtenerPorId(id)       -> findById + lean
 *  - actualizar(id,datos)   -> findByIdAndUpdate(new:true) + toObject
 *  - eliminar(id)           -> findByIdAndDelete
 * Nota: _id -> id numerico.
 */
module.exports = SeccionRepository;