const { obtenerConexion } = require("../db/conexion");
const { aplanar, nowISO } = require("../db/util");

class ValoracionRepository {
  crear(valoracion) {
    const bd = obtenerConexion();
    bd.prepare(
      `INSERT INTO valoraciones (establecimiento, actividad, estado, anio, semestre)
       VALUES (?,?,?,?,?)`
    ).run(
      valoracion.establecimiento,
      valoracion.actividad,
      valoracion.estado,
      valoracion.anio,
      valoracion.semestre
    );
    return this.buscar(
      valoracion.establecimiento,
      valoracion.actividad,
      valoracion.anio,
      valoracion.semestre
    );
  }

  obtenerTodos(filtro = {}) {
    const bd = obtenerConexion();
    const condiciones = [];
    const params = [];
    if (filtro.establecimiento !== undefined) {
      condiciones.push("v.establecimiento = ?");
      params.push(filtro.establecimiento);
    }
    if (filtro.actividad !== undefined) {
      condiciones.push("v.actividad = ?");
      params.push(filtro.actividad);
    }
    if (filtro.anio !== undefined) {
      condiciones.push("v.anio = ?");
      params.push(filtro.anio);
    }
    if (filtro.semestre !== undefined) {
      condiciones.push("v.semestre = ?");
      params.push(filtro.semestre);
    }
    if (filtro.estado !== undefined) {
      condiciones.push("v.estado = ?");
      params.push(filtro.estado);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
    const filas = bd
      .prepare(
        `SELECT v.*, a.nombre AS actividadNombre, a.area AS actividadArea,
                a.anio AS actividadAnio, e.nombre AS establecimientoNombre,
                e.codigo AS establecimientoCodigo, e.dependencia AS establecimientoDependencia
         FROM valoraciones v
         LEFT JOIN actividades a ON a.id = v.actividad
         LEFT JOIN establecimientos e ON e.id = v.establecimiento
         ${where}
         ORDER BY v.anio DESC, v.semestre DESC`
      )
      .all(...params);
    return filas.map((f) => this.#poblarRefs(f));
  }

  buscar(establecimiento, actividad, anio, semestre) {
    const bd = obtenerConexion();
    const fila = bd
      .prepare(
        `SELECT * FROM valoraciones
         WHERE establecimiento = ? AND actividad = ? AND anio = ? AND semestre = ?`
      )
      .get(establecimiento, actividad, anio, semestre);
    return fila ? aplanar("valoraciones", fila) : null;
  }

  upsert(valoracion) {
    const bd = obtenerConexion();
    const ts = nowISO();
    bd.prepare(
      `INSERT INTO valoraciones (establecimiento, actividad, estado, anio, semestre, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT (establecimiento, actividad, anio, semestre)
       DO UPDATE SET estado = excluded.estado, updatedAt = excluded.updatedAt`
    ).run(
      valoracion.establecimiento,
      valoracion.actividad,
      valoracion.estado,
      valoracion.anio,
      valoracion.semestre,
      ts,
      ts
    );
    return this.buscar(
      valoracion.establecimiento,
      valoracion.actividad,
      valoracion.anio,
      valoracion.semestre
    );
  }

  // Convierte el populate de Mongo en objetos anidados con las columnas del JOIN.
  #poblarRefs(f) {
    const fila = aplanar("valoraciones", f);
    fila.actividad = {
      id: f.actividad,
      nombre: f.actividadNombre,
      area: f.actividadArea,
      anio: f.actividadAnio,
    };
    fila.establecimiento = {
      id: f.establecimiento,
      nombre: f.establecimientoNombre,
      codigo: f.establecimientoCodigo,
      dependencia: f.establecimientoDependencia,
    };
    delete fila.actividadNombre;
    delete fila.actividadArea;
    delete fila.actividadAnio;
    delete fila.establecimientoNombre;
    delete fila.establecimientoCodigo;
    delete fila.establecimientoDependencia;
    return fila;
  }
}

/**
 * Contrato de metodos que usan los servicios (equivalencia con Mongo):
 *  - crear(valoracion)      -> model.create
 *  - obtenerTodos(filtro)   -> find(filtro) + populate(establecimiento) + populate(actividad) + sort + lean
 *  - buscar(est,act,anio,sem) -> findOne (sin populate) + lean
 *  - upsert(valoracion)     -> findOneAndUpdate({new:true,upsert:true}) sobre la UNIQUE
 *                              (establecimiento, actividad, anio, semestre)
 * Nota: _id -> id numerico; el populate se devuelve como objetos anidados
 * (actividad/establecimiento con sus columnas JOIN).
 */
module.exports = ValoracionRepository;