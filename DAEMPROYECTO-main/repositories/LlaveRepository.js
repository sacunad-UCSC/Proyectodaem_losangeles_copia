const { obtenerConexion } = require("../db/conexion");
const { nowISO } = require("../db/util");

const SQL_LLAVE_BASE = `
  SELECT l.*,
         t.nombre AS torneoNombre, t.division AS torneoDivision,
         t.formato AS torneoFormato, t.estado AS torneoEstado,
         t.anio AS torneoAnio, t.semestre AS torneoSemestre,
         t.createdAt AS torneoCreatedAt, t.updatedAt AS torneoUpdatedAt,
         a.id AS actividadId, a.nombre AS actividadNombre, a.area AS actividadArea,
         a.anio AS actividadAnio, a.estado AS actividadEstado
  FROM llaves l
  JOIN torneos t ON t.id = l.torneo
  JOIN actividades a ON a.id = t.actividad
`;

const COLUMNAS_LLAVE = new Set([
  "id", "torneo", "actividad", "division", "grupo", "estado", "fecha", "hora",
  "horaTermino", "lugar", "puntajeA", "puntajeB", "ganador", "posicion",
  "nivel", "orden", "padre",
]);

function aIso(v) {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : v;
}

function construirFiltro(filtro) {
  const cond = [];
  const params = [];
  const extra = {};
  for (const [k, v] of Object.entries(filtro || {})) {
    if (v === undefined) continue;
    if (k === "bye") {
      extra.bye = v;
      continue;
    }
    if (!COLUMNAS_LLAVE.has(k)) continue;
    if (v === null) {
      cond.push(`l.${k} IS NULL`);
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v) && "$in" in v) {
      const lista = (Array.isArray(v.$in) ? v.$in : []).filter((x) => x != null && x !== "");
      if (!lista.length) {
        cond.push("0");
      } else {
        cond.push(`l.${k} IN (${lista.map(() => "?").join(",")})`);
        params.push(...lista);
      }
      continue;
    }
    cond.push(`l.${k} = ?`);
    params.push(v);
  }
  return { where: cond.length ? `WHERE ${cond.join(" AND ")}` : "", params, extra };
}

function transf(fila) {
  const o = { ...fila };
  o.torneo = {
    _id: o.torneo,
    id: o.torneo,
    nombre: o.torneoNombre,
    division: o.torneoDivision,
    formato: o.torneoFormato,
    estado: o.torneoEstado,
    anio: o.torneoAnio,
    semestre: o.torneoSemestre,
    createdAt: o.torneoCreatedAt,
    updatedAt: o.torneoUpdatedAt,
    actividad: o.actividadId == null ? null : {
      _id: o.actividadId,
      id: o.actividadId,
      nombre: o.actividadNombre,
      area: o.actividadArea,
      anio: o.actividadAnio,
      estado: o.actividadEstado,
    },
  };
  delete o.torneoNombre;
  delete o.torneoDivision;
  delete o.torneoFormato;
  delete o.torneoEstado;
  delete o.torneoAnio;
  delete o.torneoSemestre;
  delete o.torneoCreatedAt;
  delete o.torneoUpdatedAt;
  delete o.actividadId;
  delete o.actividadNombre;
  delete o.actividadArea;
  delete o.actividadAnio;
  delete o.actividadEstado;
  o._id = o.id;
  return o;
}

function poblar(filas) {
  if (!filas.length) return [];
  const bd = obtenerConexion();
  const objetos = filas.map(transf);

  const conLlaves = filas.map((f) => f.id);
  const places = conLlaves.map(() => "?").join(",");

  const filasEquipos = bd
    .prepare(
      `SELECT le.llave, e.*
       FROM llave_equipos le JOIN equipos e ON e.id = le.equipo
       WHERE le.llave IN (${places}) ORDER BY e.nombre`
    )
    .all(...conLlaves);

  const equiposPorLlave = new Map();
  const idsEquipos = [];
  for (const r of filasEquipos) {
    const key = Number(r.llave);
    if (!equiposPorLlave.has(key)) equiposPorLlave.set(key, []);
    equiposPorLlave.get(key).push(r);
    if (!idsEquipos.includes(Number(r.id))) idsEquipos.push(Number(r.id));
  }

  const alumnosPorEquipo = new Map();
  if (idsEquipos.length) {
    const eqPlaces = idsEquipos.map(() => "?").join(",");
    const filasAlumnos = bd
      .prepare(
        `SELECT ea.equipo, al.*
         FROM equipo_alumnos ea JOIN alumnos al ON al.id = ea.alumno
         WHERE ea.equipo IN (${eqPlaces}) ORDER BY al.nombre`
      )
      .all(...idsEquipos);
    for (const r of filasAlumnos) {
      const key = Number(r.equipo);
      if (!alumnosPorEquipo.has(key)) alumnosPorEquipo.set(key, []);
      const al = { ...r };
      delete al.equipo;
      al._id = al.id;
      alumnosPorEquipo.get(key).push(al);
    }
  }

  const idsGanadores = [...new Set(filas.map((f) => f.ganador).filter((v) => v != null).map(Number))];
  const ganadorPorId = new Map();
  if (idsGanadores.length) {
    const gPlaces = idsGanadores.map(() => "?").join(",");
    const filasG = bd.prepare(`SELECT * FROM equipos WHERE id IN (${gPlaces})`).all(...idsGanadores);
    for (const g of filasG) {
      ganadorPorId.set(Number(g.id), {
        _id: g.id,
        id: g.id,
        torneo: g.torneo,
        nombre: g.nombre,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
        alumnos: [],
      });
    }
  }

  const filasHijos = bd
    .prepare(`SELECT llave, hijo FROM llave_hijos WHERE llave IN (${places})`)
    .all(...conLlaves);
  const hijosPorLlave = new Map();
  const idsHijos = [];
  for (const r of filasHijos) {
    const key = Number(r.llave);
    if (!hijosPorLlave.has(key)) hijosPorLlave.set(key, []);
    hijosPorLlave.get(key).push(Number(r.hijo));
    if (!idsHijos.includes(Number(r.hijo))) idsHijos.push(Number(r.hijo));
  }
  const infoHijos = new Map();
  if (idsHijos.length) {
    const hPlaces = idsHijos.map(() => "?").join(",");
    const filasInfo = bd
      .prepare(
        `SELECT id, torneo, division, grupo, estado, nivel, orden
         FROM llaves WHERE id IN (${hPlaces})`
      )
      .all(...idsHijos);
    for (const h of filasInfo) {
      infoHijos.set(Number(h.id), {
        _id: h.id,
        id: h.id,
        torneo: h.torneo,
        division: h.division,
        grupo: h.grupo,
        estado: h.estado,
        nivel: h.nivel,
        orden: h.orden,
      });
    }
  }

  conLlaves.forEach((id, i) => {
    const o = objetos[i];
    const filasEq = equiposPorLlave.get(Number(id)) || [];
    o.equipos = filasEq.map((r) => ({
      _id: r.id,
      id: r.id,
      torneo: r.torneo,
      nombre: r.nombre,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      alumnos: alumnosPorEquipo.get(Number(r.id)) || [],
    }));
    o.bye = o.equipos.length === 1;
    o.ganador = filas[i].ganador == null ? null : ganadorPorId.get(Number(filas[i].ganador)) || null;
    o.hijos = (hijosPorLlave.get(Number(id)) || []).map((h) => infoHijos.get(h)).filter(Boolean);
  });

  return objetos;
}

function reemplazarEquipos(bd, id, lista) {
  bd.prepare(`DELETE FROM llave_equipos WHERE llave = ?`).run(id);
  const stmt = bd.prepare(`INSERT OR IGNORE INTO llave_equipos (llave, equipo) VALUES (?,?)`);
  for (const v of lista || []) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0) stmt.run(id, n);
  }
}

function reemplazarHijos(bd, id, lista) {
  bd.prepare(`DELETE FROM llave_hijos WHERE llave = ?`).run(id);
  const stmt = bd.prepare(`INSERT OR IGNORE INTO llave_hijos (llave, hijo) VALUES (?,?)`);
  for (const v of lista || []) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0) stmt.run(id, n);
  }
}

class LlaveRepository {
  crear(llave) {
    const bd = obtenerConexion();
    const r = bd
      .prepare(
        `INSERT INTO llaves
          (torneo, actividad, division, grupo, estado, fecha, hora, horaTermino,
           lugar, puntajeA, puntajeB, ganador, posicion, nivel, orden, padre)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        llave.torneo,
        llave.actividad ?? null,
        llave.division ?? "",
        llave.grupo ?? "Llave",
        llave.estado ?? "pendiente",
        aIso(llave.fecha),
        llave.hora ?? "",
        llave.horaTermino ?? "",
        llave.lugar ?? "Por definir",
        llave.puntajeA ?? null,
        llave.puntajeB ?? null,
        llave.ganador ?? null,
        llave.posicion ?? "",
        llave.nivel ?? 1,
        llave.orden ?? 0,
        llave.padre ?? null
      );
    const id = r.lastInsertRowid;
    if (llave.equipos !== undefined) reemplazarEquipos(bd, id, llave.equipos);
    if (llave.hijos !== undefined) reemplazarHijos(bd, id, llave.hijos);
    return this.obtenerPorId(id);
  }

  crearMuchas(llaves) {
    const bd = obtenerConexion();
    const tx = bd.transaction((lista) => lista.map((l) => this.crear(l)));
    return tx(llaves);
  }

  obtenerTodos(filtro = {}) {
    const bd = obtenerConexion();
    const { where, params, extra } = construirFiltro(filtro);
    const filas = bd
      .prepare(
        `${SQL_LLAVE_BASE} ${where}
         ORDER BY l.nivel ASC, l.orden ASC, l.createdAt ASC`
      )
      .all(...params);
    let lista = poblar(filas);
    if (extra.bye !== undefined) {
      lista = lista.filter((l) => l.bye === !!extra.bye);
    }
    return lista;
  }

  obtenerPorId(id) {
    const bd = obtenerConexion();
    const fila = bd.prepare(`${SQL_LLAVE_BASE} WHERE l.id = ?`).get(id);
    return fila ? poblar([fila])[0] : null;
  }

  actualizar(id, datos) {
    const bd = obtenerConexion();
    const campos = [];
    const params = [];
    const mapeo = {
      torneo: true,
      actividad: (v) => v ?? null,
      division: true,
      grupo: true,
      estado: true,
      fecha: aIso,
      hora: true,
      horaTermino: true,
      lugar: true,
      puntajeA: true,
      puntajeB: true,
      ganador: true,
      posicion: true,
      nivel: true,
      orden: true,
      padre: (v) => v ?? null,
    };
    for (const [clave, cfg] of Object.entries(mapeo)) {
      if (datos[clave] === undefined) continue;
      campos.push(`${clave} = ?`);
      params.push(typeof cfg === "function" ? cfg(datos[clave]) : datos[clave]);
    }
    if (campos.length) {
      campos.push(`updatedAt = ?`);
      params.push(nowISO());
      params.push(id);
      bd.prepare(`UPDATE llaves SET ${campos.join(", ")} WHERE id = ?`).run(...params);
    }
    if (datos.equipos !== undefined) reemplazarEquipos(bd, id, datos.equipos);
    if (datos.hijos !== undefined) reemplazarHijos(bd, id, datos.hijos);
    return this.obtenerPorId(id);
  }

  registrarResultado(id, { puntajeA, puntajeB, ganador }) {
    const bd = obtenerConexion();
    bd.prepare(
      `UPDATE llaves SET puntajeA = ?, puntajeB = ?, ganador = ?, estado = 'jugado', updatedAt = ?
       WHERE id = ?`
    ).run(puntajeA, puntajeB, ganador, nowISO(), id);
    return this.obtenerPorId(id);
  }

  eliminarPorTorneo(torneoId) {
    const bd = obtenerConexion();
    const r = bd.prepare(`DELETE FROM llaves WHERE torneo = ?`).run(torneoId);
    return { deletedCount: r.changes };
  }
}

module.exports = LlaveRepository;