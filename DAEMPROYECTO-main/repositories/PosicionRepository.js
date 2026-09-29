const { obtenerConexion } = require("../db/conexion");
const { nowISO } = require("../db/util");

const SQL_POSICIONES = `
  SELECT p.*,
         e.nombre AS establecimientoNombre, e.codigo AS establecimientoCodigo,
         e.dependencia AS establecimientoDependencia, e.direccion AS establecimientoDireccion,
         e.contacto AS establecimientoContacto, e.createdAt AS establecimientoCreatedAt,
         e.updatedAt AS establecimientoUpdatedAt
  FROM posiciones p
  JOIN establecimientos e ON e.id = p.establecimiento
`;

function aPosicion(p) {
  return {
    id: p.id,
    _id: p.id,
    torneo: p.torneo,
    establecimiento: {
      _id: p.establecimiento,
      id: p.establecimiento,
      codigo: p.establecimientoCodigo,
      nombre: p.establecimientoNombre,
      dependencia: p.establecimientoDependencia,
      direccion: p.establecimientoDireccion,
      contacto: p.establecimientoContacto,
      createdAt: p.establecimientoCreatedAt,
      updatedAt: p.establecimientoUpdatedAt,
    },
    posicion: p.posicion,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

class PosicionRepository {
  upsert(posicion) {
    const bd = obtenerConexion();
    const ahora = nowISO();
    bd.prepare(
      `INSERT INTO posiciones (torneo, establecimiento, posicion, createdAt, updatedAt)
       VALUES (?,?,?,?,?)
       ON CONFLICT (torneo, establecimiento, posicion)
       DO UPDATE SET updatedAt = excluded.updatedAt`
    ).run(posicion.torneo, posicion.establecimiento, posicion.posicion, ahora, ahora);
    const fila = bd
      .prepare(
        `${SQL_POSICIONES}
         WHERE p.torneo = ? AND p.establecimiento = ? AND p.posicion = ?`
      )
      .get(posicion.torneo, posicion.establecimiento, posicion.posicion);
    return fila ? aPosicion(fila) : null;
  }

  obtenerPorTorneo(torneoId) {
    const bd = obtenerConexion();
    return bd
      .prepare(`${SQL_POSICIONES} WHERE p.torneo = ? ORDER BY p.posicion ASC`)
      .all(torneoId)
      .map(aPosicion);
  }

  reemplazarPorTorneo(torneoId, posiciones) {
    const bd = obtenerConexion();
    const tx = bd.transaction((lista) => {
      bd.prepare(`DELETE FROM posiciones WHERE torneo = ?`).run(torneoId);
      const stmt = bd.prepare(
        `INSERT INTO posiciones (torneo, establecimiento, posicion) VALUES (?,?,?)`
      );
      for (const p of lista || []) {
        stmt.run(p.torneo ?? torneoId, p.establecimiento, p.posicion);
      }
    });
    tx(posiciones || []);
    return this.obtenerPorTorneo(torneoId);
  }
}

module.exports = PosicionRepository;