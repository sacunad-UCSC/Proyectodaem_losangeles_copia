const { obtenerConexion } = require("../db/conexion");
const { aplanar, nowISO } = require("../db/util");

class EstablecimientoRepository {
  crear(datos) {
    const bd = obtenerConexion();
    const r = bd
      .prepare(
        `INSERT INTO establecimientos
          (codigo, nombre, dependencia, direccion, contacto)
         VALUES (?,?,?,?,?)`
      )
      .run(
        datos.codigo,
        datos.nombre,
        datos.dependencia || "Municipal",
        datos.direccion || "",
        datos.contacto || ""
      );
    return this.obtenerPorId(r.lastInsertRowid);
  }

  obtenerTodos() {
    const bd = obtenerConexion();
    return bd
      .prepare(`SELECT * FROM establecimientos ORDER BY codigo`)
      .all()
      .map(aplanar.bind(null, "establecimientos"));
  }

  obtenerPorId(id) {
    const bd = obtenerConexion();
    const fila = bd.prepare(`SELECT * FROM establecimientos WHERE id = ?`).get(id);
    return fila ? aplanar("establecimientos", fila) : null;
  }

  obtenerPorCodigo(codigo) {
    const bd = obtenerConexion();
    const fila = bd.prepare(`SELECT * FROM establecimientos WHERE codigo = ?`).get(codigo);
    return fila ? aplanar("establecimientos", fila) : null;
  }

  actualizar(id, datos) {
    const bd = obtenerConexion();
    const campos = [];
    const params = [];
    for (const c of ["codigo", "nombre", "dependencia", "direccion", "contacto"]) {
      if (datos[c] !== undefined) {
        campos.push(`${c} = ?`);
        params.push(datos[c]);
      }
    }
    if (campos.length) {
      params.push(nowISO());
      params.push(id);
      bd.prepare(`UPDATE establecimientos SET ${campos.join(", ")} , updatedAt = ? WHERE id = ?`).run(...params);
    }
    return this.obtenerPorId(id);
  }

  eliminar(id) {
    const bd = obtenerConexion();
    const r = bd.prepare(`DELETE FROM establecimientos WHERE id = ?`).run(id);
    return r.changes > 0;
  }

  contar() {
    const bd = obtenerConexion();
    return bd.prepare(`SELECT COUNT(*) AS total FROM establecimientos`).get().total;
  }
}

module.exports = EstablecimientoRepository;
