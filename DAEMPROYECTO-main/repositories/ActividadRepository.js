const { obtenerConexion } = require("../db/conexion");
const { aplanar, codificarJson, nowISO } = require("../db/util");

// Fecha como TEXT ISO (formato de la base SQLite); null si viene vacio.
function aIso(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  return new Date(valor).toISOString();
}

// Devuelve la fila de actividad con su calendario (tabla hija encuentros) y
// los campos JSON ya parseados via aplanar.
function conEncuentros(bd, fila) {
  if (!fila) return null;
  const out = aplanar("actividades", fila);
  out.encuentros = bd
    .prepare(`SELECT id, fecha, hora, lugar FROM encuentros WHERE actividad = ? ORDER BY id`)
    .all(fila.id);
  return out;
}

// Reemplaza el calendario de encuentros: actualiza los que ya traen id,
// inserta los nuevos y borra los que ya no estan (equivale a asignar el
// array encuentros en findByIdAndUpdate).
function reemplazarEncuentros(bd, actividadId, encuentros) {
  const lista = Array.isArray(encuentros) ? encuentros : [];
  const idDe = (e) => {
    const x = e && (e.id ?? e._id);
    return x !== undefined && x !== null && Number.isInteger(Number(x)) ? Number(x) : null;
  };
  const ids = lista.map(idDe).filter((x) => x !== null);
  const insertar = bd.prepare(
    `INSERT INTO encuentros (actividad, fecha, hora, lugar) VALUES (?,?,?,?)`
  );
  const actualizar = bd.prepare(
    `UPDATE encuentros SET fecha = ?, hora = ?, lugar = ? WHERE id = ? AND actividad = ?`
  );
  for (const e of lista) {
    const eid = idDe(e);
    if (eid !== null) {
      actualizar.run(aIso(e.fecha), e.hora ?? "", e.lugar ?? "", eid, actividadId);
    } else {
      insertar.run(actividadId, aIso(e.fecha), e.hora ?? "", e.lugar ?? "");
    }
  }
  if (ids.length) {
    const marca = ids.map(() => "?").join(", ");
    bd.prepare(`DELETE FROM encuentros WHERE actividad = ? AND id NOT IN (${marca})`).run(
      actividadId,
      ...ids
    );
  } else {
    bd.prepare(`DELETE FROM encuentros WHERE actividad = ?`).run(actividadId);
  }
}

class ActividadRepository {
  crear(datos) {
    const bd = obtenerConexion();
    const r = bd
      .prepare(
        `INSERT INTO actividades
          (nombre, area, seccion, categorias, divisiones, anio, semestre, estado,
           fechaAperturaInscripcion, fechaCierreInscripcion, edadMinima, edadMaxima,
           recintos, limiteInscritos)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        datos.nombre,
        datos.area,
        datos.seccion ?? null,
        codificarJson(datos.categorias ?? []),
        codificarJson(datos.divisiones ?? []),
        datos.anio,
        datos.semestre ?? 1,
        datos.estado ?? "publicada",
        aIso(datos.fechaAperturaInscripcion),
        aIso(datos.fechaCierreInscripcion),
        datos.edadMinima ?? null,
        datos.edadMaxima ?? null,
        codificarJson(datos.recintos ?? []),
        datos.limiteInscritos ?? 0
      );
    const insertar = bd.prepare(
      `INSERT INTO encuentros (actividad, fecha, hora, lugar) VALUES (?,?,?,?)`
    );
    for (const e of datos.encuentros || []) {
      insertar.run(r.lastInsertRowid, aIso(e.fecha), e.hora ?? "", e.lugar ?? "");
    }
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
    if (filtro.seccion !== undefined) {
      condiciones.push("seccion IS ?");
      params.push(filtro.seccion);
    }
    if (filtro.anio !== undefined) {
      condiciones.push("anio = ?");
      params.push(filtro.anio);
    }
    if (filtro.semestre !== undefined) {
      condiciones.push("semestre = ?");
      params.push(filtro.semestre);
    }
    if (filtro.estado !== undefined) {
      condiciones.push("estado = ?");
      params.push(filtro.estado);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
    const filas = bd
      .prepare(`SELECT * FROM actividades ${where} ORDER BY anio DESC, nombre ASC`)
      .all(...params);
    return filas.map((f) => conEncuentros(bd, f));
  }

  obtenerPorId(id) {
    const bd = obtenerConexion();
    const fila = bd.prepare(`SELECT * FROM actividades WHERE id = ?`).get(id);
    return conEncuentros(bd, fila);
  }

  actualizar(id, datos) {
    const bd = obtenerConexion();
    const campos = [];
    const params = [];
    const mapeo = {
      nombre: "nombre",
      area: "area",
      seccion: "seccion",
      anio: "anio",
      semestre: "semestre",
      estado: "estado",
      fechaAperturaInscripcion: (v) => aIso(v),
      fechaCierreInscripcion: (v) => aIso(v),
      edadMinima: "edadMinima",
      edadMaxima: "edadMaxima",
      limiteInscritos: "limiteInscritos",
      categorias: (v) => codificarJson(v),
      divisiones: (v) => codificarJson(v),
      recintos: (v) => codificarJson(v),
    };
    for (const [clave, destino] of Object.entries(mapeo)) {
      if (datos[clave] !== undefined) {
        campos.push(`${clave} = ?`);
        params.push(typeof destino === "function" ? destino(datos[clave]) : datos[clave]);
      }
    }
    if (campos.length) {
      campos.push(`updatedAt = ?`);
      params.push(nowISO());
      params.push(id);
      bd.prepare(`UPDATE actividades SET ${campos.join(", ")} WHERE id = ?`).run(...params);
    }
    if (datos.encuentros !== undefined) {
      reemplazarEncuentros(bd, id, datos.encuentros);
    }
    return this.obtenerPorId(id);
  }

  agregarEncuentro(id, encuentro) {
    const bd = obtenerConexion();
    if (!bd.prepare(`SELECT id FROM actividades WHERE id = ?`).get(id)) return null;
    bd.prepare(`INSERT INTO encuentros (actividad, fecha, hora, lugar) VALUES (?,?,?,?)`).run(
      id,
      aIso(encuentro.fecha),
      encuentro.hora ?? "",
      encuentro.lugar ?? ""
    );
    return this.obtenerPorId(id);
  }

  eliminar(id) {
    const bd = obtenerConexion();
    const r = bd.prepare(`DELETE FROM actividades WHERE id = ?`).run(id);
    return r.changes > 0;
  }
}

/**
 * Contrato de metodos que usan los servicios (equivalencia con Mongo):
 *  - crear(datos)           -> model.create (inserta tambien su calendario en encuentros)
 *  - obtenerTodos(filtro)   -> find(filtro) + sort({anio:-1,nombre:1}) + lean; encuentros[] adjuntos
 *  - obtenerPorId(id)       -> findById + lean; encuentros[] adjuntos
 *  - actualizar(id,datos)   -> findByIdAndUpdate(new:true); si llega encuentros[] se reemplaza la tabla hija
 *  - agregarEncuentro(id,e) -> $push en encuentros (INSERT en tabla encuentros) + new:true
 *  - eliminar(id)           -> findByIdAndDelete (CASCADE borra encuentros)
 * Nota: _id -> id numerico; categorias/divisiones/recintos viajan como TEXT JSON
 * (codificarJson al escribir, aplanar al leer).
 */
module.exports = ActividadRepository;