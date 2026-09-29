const { obtenerConexion } = require("../db/conexion");
const { nowISO } = require("../db/util");

const SQL_SOLICITUDES = `
  SELECT s.*,
         a.id AS actividadId, a.nombre AS actividadNombre, a.area AS actividadArea,
         a.anio AS actividadAnio, a.estado AS actividadEstado,
         e.id AS establecimientoId, e.nombre AS establecimientoNombre,
         e.codigo AS establecimientoCodigo, e.dependencia AS establecimientoDependencia,
         e.direccion AS establecimientoDireccion, e.contacto AS establecimientoContacto,
         e.createdAt AS establecimientoCreatedAt, e.updatedAt AS establecimientoUpdatedAt
  FROM solicitudes s
  LEFT JOIN actividades a ON a.id = s.actividad
  LEFT JOIN establecimientos e ON e.id = s.establecimiento
`;

const COLUMNAS_SOLICITUD = new Set([
  "tipo", "detalle", "estado", "rutSolicitante", "rutCoordinador",
  "actividad", "establecimiento", "respuesta",
]);

function aSolicitud(s) {
  return {
    id: s.id,
    _id: s.id,
    tipo: s.tipo,
    detalle: s.detalle,
    estado: s.estado,
    rutSolicitante: s.rutSolicitante,
    rutCoordinador: s.rutCoordinador,
    actividad: s.actividadId == null ? null : {
      _id: s.actividadId,
      id: s.actividadId,
      nombre: s.actividadNombre,
      area: s.actividadArea,
      anio: s.actividadAnio,
      estado: s.actividadEstado,
    },
    establecimiento: s.establecimientoId == null ? null : {
      _id: s.establecimientoId,
      id: s.establecimientoId,
      codigo: s.establecimientoCodigo,
      nombre: s.establecimientoNombre,
      dependencia: s.establecimientoDependencia,
      direccion: s.establecimientoDireccion,
      contacto: s.establecimientoContacto,
      createdAt: s.establecimientoCreatedAt,
      updatedAt: s.establecimientoUpdatedAt,
    },
    respuesta: s.respuesta,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function construirFiltro(filtro) {
  const cond = [];
  const params = [];
  for (const [k, v] of Object.entries(filtro || {})) {
    if (v === undefined) continue;
    if (!COLUMNAS_SOLICITUD.has(k)) continue;
    if (v === null) {
      cond.push(`s.${k} IS NULL`);
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v) && "$in" in v) {
      const lista = (Array.isArray(v.$in) ? v.$in : []).filter((x) => x != null && x !== "");
      if (!lista.length) {
        cond.push("0");
      } else {
        cond.push(`s.${k} IN (${lista.map(() => "?").join(",")})`);
        params.push(...lista);
      }
      continue;
    }
    cond.push(`s.${k} = ?`);
    params.push(v);
  }
  return { where: cond.length ? `WHERE ${cond.join(" AND ")}` : "", params };
}

class SolicitudRepository {
  crear(solicitud) {
    const bd = obtenerConexion();
    const r = bd
      .prepare(
        `INSERT INTO solicitudes
          (tipo, detalle, estado, rutSolicitante, rutCoordinador, actividad,
           establecimiento, respuesta)
         VALUES (?,?,?,?,?,?,?,?)`
      )
      .run(
        solicitud.tipo,
        solicitud.detalle,
        solicitud.estado ?? "en_proceso",
        solicitud.rutSolicitante,
        solicitud.rutCoordinador ?? "",
        solicitud.actividad ?? null,
        solicitud.establecimiento ?? null,
        solicitud.respuesta ?? ""
      );
    return this.obtenerPorId(r.lastInsertRowid);
  }

  obtenerTodos(filtro = {}) {
    const bd = obtenerConexion();
    const { where, params } = construirFiltro(filtro);
    return bd
      .prepare(`${SQL_SOLICITUDES} ${where} ORDER BY s.createdAt DESC`)
      .all(...params)
      .map(aSolicitud);
  }

  obtenerPorId(id) {
    const bd = obtenerConexion();
    const fila = bd.prepare(`${SQL_SOLICITUDES} WHERE s.id = ?`).get(id);
    return fila ? aSolicitud(fila) : null;
  }

  actualizar(id, datos) {
    const bd = obtenerConexion();
    const campos = [];
    const params = [];
    for (const c of [...COLUMNAS_SOLICITUD]) {
      if (datos[c] === undefined) continue;
      campos.push(`${c} = ?`);
      params.push(datos[c]);
    }
    if (campos.length) {
      campos.push(`updatedAt = ?`);
      params.push(nowISO());
      params.push(id);
      bd.prepare(`UPDATE solicitudes SET ${campos.join(", ")} WHERE id = ?`).run(...params);
    }
    return this.obtenerPorId(id);
  }

  cambiarEstado(id, estado, respuesta = "") {
    return this.actualizar(id, { estado, respuesta });
  }

  eliminar(id) {
    const bd = obtenerConexion();
    const r = bd.prepare(`DELETE FROM solicitudes WHERE id = ?`).run(id);
    return r.changes > 0;
  }
}

module.exports = SolicitudRepository;