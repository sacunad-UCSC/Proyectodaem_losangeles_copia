const { obtenerConexion } = require("../db/conexion");
const { aplanar, codificarJson, fechaISO, nowISO } = require("../db/util");

class TorneoRepository {
  crear(datos) {
    const bd = obtenerConexion();
    const r = bd
      .prepare(
        `INSERT INTO torneos
          (nombre, actividad, division, formato, anio, semestre, estado,
           estadoPrevio, grupos, formulario, requisitos,
           fechaAperturaInscripcion, fechaCierreInscripcion)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        datos.nombre,
        datos.actividad ?? null,
        datos.division ?? "",
        datos.formato ?? "amistoso",
        datos.anio,
        datos.semestre ?? 1,
        datos.estado ?? "inscripciones",
        datos.estadoPrevio ?? "",
        codificarJson(datos.grupos ?? []),
        codificarJson(datos.formulario ?? {}),
        codificarJson(datos.requisitos ?? {}),
        fechaISO(datos.fechaAperturaInscripcion),
        fechaISO(datos.fechaCierreInscripcion)
      );
    return this.obtenerPorId(r.lastInsertRowid);
  }

  obtenerTodos(filtro = {}) {
    const bd = obtenerConexion();
    const condiciones = [];
    const params = [];
    if (filtro.actividad !== undefined) {
      condiciones.push("t.actividad = ?");
      params.push(filtro.actividad);
    }
    if (filtro.estado !== undefined) {
      condiciones.push("t.estado = ?");
      params.push(filtro.estado);
    }
    if (filtro.anio !== undefined) {
      condiciones.push("t.anio = ?");
      params.push(filtro.anio);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
    const filas = bd
      .prepare(
        `SELECT t.*, a.nombre AS actividadNombre, a.area AS actividadArea,
                a.divisiones AS actividadDivisiones, a.anio AS actividadAnio
         FROM torneos t
         JOIN actividades a ON a.id = t.actividad
         ${where}
         ORDER BY t.anio DESC, t.semestre DESC`
      )
      .all(...params);
    return filas.map((f) => aplanar("torneos", f));
  }

  obtenerPorId(id) {
    const bd = obtenerConexion();
    const fila = bd
      .prepare(
        `SELECT t.*, a.nombre AS actividadNombre, a.area AS actividadArea,
                a.divisiones AS actividadDivisiones, a.anio AS actividadAnio
         FROM torneos t
         JOIN actividades a ON a.id = t.actividad
         WHERE t.id = ?`
      )
      .get(id);
    return fila ? aplanar("torneos", fila) : null;
  }

  actualizar(id, datos) {
    const bd = obtenerConexion();
    const campos = [];
    const params = [];
    const mapeo = {
      nombre: "nombre",
      actividad: "actividad",
      division: "division",
      formato: "formato",
      anio: "anio",
      semestre: "semestre",
      estado: "estado",
      estadoPrevio: "estadoPrevio",
      grupos: (v) => codificarJson(v),
      formulario: (v) => codificarJson(v),
      requisitos: (v) => codificarJson(v),
      fechaAperturaInscripcion: (v) => fechaISO(v),
      fechaCierreInscripcion: (v) => fechaISO(v),
    };
    for (const [clave, destino] of Object.entries(mapeo)) {
      if (datos[clave] !== undefined) {
        campos.push(`${clave} = ?`);
        params.push(typeof destino === "function" ? destino(datos[clave]) : datos[clave]);
      }
    }
    if (!campos.length) return this.obtenerPorId(id);
    campos.push(`updatedAt = ?`);
    params.push(nowISO());
    params.push(id);
    bd.prepare(`UPDATE torneos SET ${campos.join(", ")} WHERE id = ?`).run(...params);
    return this.obtenerPorId(id);
  }

  eliminar(id) {
    const bd = obtenerConexion();
    const r = bd.prepare(`DELETE FROM torneos WHERE id = ?`).run(id);
    return r.changes > 0;
  }

  obtenerPorActividad(actividadId) {
    return this.obtenerTodos({ actividad: actividadId });
  }
}

/**
 * Contrato de metodos que usan los servicios/repos (equivalencia con Mongo):
 *  - crear(datos)          -> equivalente a model.create
 *  - obtenerTodos(filtro)  -> find + populate(actividad) + sort + lean
 *  - obtenerPorId(id)      -> findById + populate(actividad) + lean
 *  - actualizar(id,datos)  -> findByIdAndUpdate(new:true) + toObject
 *  - eliminar(id)          -> findByIdAndDelete
 *  - obtenerPorActividad   -> comodidad adicional
 */
module.exports = TorneoRepository;
