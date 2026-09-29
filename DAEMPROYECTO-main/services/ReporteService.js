const EstablecimientoRepository = require("../repositories/EstablecimientoRepository");
const TorneoRepository = require("../repositories/TorneoRepository");
const PosicionRepository = require("../repositories/PosicionRepository");
const { obtenerConexion } = require("../db/conexion");
const { descodificarJson } = require("../db/util");

// Los repos no agregan _id: la capa de servicio que expone a la API agrega
// _id (mirror de id) para conservar el contrato que consumia el front.
function conId(v) {
  if (v === null || v === undefined || typeof v !== "object") return v;
  if (v.id !== undefined && v._id === undefined) v._id = v.id;
  return v;
}

// El repo de torneos devuelve la actividad como campo plano; aqui el reporte
// consume actividad.nombre/area del torneo.
function aTorneo(t) {
  if (!t) return t;
  t._id = t.id;
  if (t.actividad != null) {
    t.actividad = {
      id: t.actividad,
      _id: t.actividad,
      nombre: t.actividadNombre,
      area: t.actividadArea,
      divisiones: descodificarJson(t.actividadDivisiones, []),
      anio: t.actividadAnio,
    };
  }
  return t;
}

// Reportes y estadisticas: nomina de establecimientos, participaciones,
// beneficiarios y trazabilidad historica por anio/semestre. Los agregados
// que antes eran pipelines de Mongo ahora son consultas SQL (GROUP BY/JOIN);
// createdAt se filtra por anio con strftime('%Y') para tolerar el formato
// TEXT del nuevo esquema.
class ReporteService {
  #establecimientos;
  #torneos;
  #posiciones;

  constructor() {
    this.#establecimientos = new EstablecimientoRepository();
    this.#torneos = new TorneoRepository();
    this.#posiciones = new PosicionRepository();
  }

  async nomina() {
    return this.#establecimientos.obtenerTodos().map(conId);
  }

  // Total de participaciones por establecimiento.
  async participaciones(filtro = {}) {
    const bd = obtenerConexion();
    const condiciones = [];
    const params = [];
    if (filtro.anio) {
      condiciones.push(`strftime('%Y', i.createdAt) = ?`);
      params.push(String(filtro.anio));
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
    const filas = bd
      .prepare(
        `SELECT i.establecimiento AS id,
                COUNT(*) AS total,
                SUM(CASE WHEN i.estado = 'aceptada' THEN 1 ELSE 0 END) AS aceptadas,
                e.codigo, e.nombre, e.dependencia
         FROM inscripciones i
         JOIN establecimientos e ON e.id = i.establecimiento
         ${where}
         GROUP BY i.establecimiento, e.codigo, e.nombre, e.dependencia
         ORDER BY total DESC`
      )
      .all(...params);
    return filas.map((f) => ({
      _id: f.id,
      codigo: f.codigo,
      nombre: f.nombre,
      dependencia: f.dependencia,
      total: f.total,
      aceptadas: f.aceptadas || 0,
    }));
  }

  // Total de beneficiarios (alumnos inscritos) general y semestral.
  async beneficiarios(filtro = {}) {
    const bd = obtenerConexion();
    const condiciones = [];
    const params = [];
    if (filtro.anio) {
      condiciones.push(`strftime('%Y', a.createdAt) = ?`);
      params.push(String(filtro.anio));
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

    const total = bd
      .prepare(`SELECT COUNT(*) AS total FROM alumnos a ${where}`)
      .get(...params).total;

    // Desglose por semestre del mismo anio.
    const porSemestre = bd
      .prepare(
        `SELECT CASE WHEN CAST(strftime('%m', a.createdAt) AS INTEGER) >= 7 THEN 2 ELSE 1 END AS s,
                COUNT(*) AS total
         FROM alumnos a ${where}
         GROUP BY s
         ORDER BY s ASC`
      )
      .all(...params)
      .map((f) => ({ _id: f.s, total: f.total }));

    const porEstablecimiento = bd
      .prepare(
        `SELECT a.establecimiento AS id, e.nombre, e.codigo, COUNT(*) AS total
         FROM alumnos a
         JOIN establecimientos e ON e.id = a.establecimiento
         ${where}
         GROUP BY a.establecimiento, e.nombre, e.codigo
         ORDER BY total DESC`
      )
      .all(...params)
      .map((f) => ({ _id: f.id, nombre: f.nombre, codigo: f.codigo, total: f.total }));

    return {
      total,
      semestres: porSemestre,
      porEstablecimiento,
    };
  }

  // Trazabilidad historica: comparacion anual de participacion.
  async historico() {
    const bd = obtenerConexion();
    const inscripciones = bd
      .prepare(
        `SELECT strftime('%Y', createdAt) AS anio, establecimiento, COUNT(*) AS inscripciones
         FROM inscripciones
         GROUP BY anio, establecimiento
         ORDER BY anio DESC`
      )
      .all();

    const alumnos = bd
      .prepare(
        `SELECT strftime('%Y', createdAt) AS anio, COUNT(*) AS beneficiarios
         FROM alumnos
         GROUP BY anio
         ORDER BY anio DESC`
      )
      .all();

    const colegios = await this.#establecimientos.contar();

    return {
      colegios: { total: colegios },
      porAnio: alumnos.map((a) => ({
        anio: a.anio,
        beneficiarios: a.beneficiarios,
      })),
      inscripcionesPorAnio: inscripciones.reduce((acc, fila) => {
        const anio = fila.anio;
        if (!acc[anio]) acc[anio] = { anio, establecimientos: [], total: 0 };
        acc[anio].establecimientos.push({
          establecimiento: fila.establecimiento,
          inscripciones: fila.inscripciones,
        });
        acc[anio].total += fila.inscripciones;
        return acc;
      }, {}),
    };
  }

  // Resumen de torneos: llaves jugadas y posiciones.
  async torneos(filtro = {}) {
    const bd = obtenerConexion();
    const contarLlaves = bd.prepare(`SELECT COUNT(*) AS total FROM llaves WHERE torneo = ?`);
    const contarJugadas = bd.prepare(
      `SELECT COUNT(*) AS total FROM llaves WHERE torneo = ? AND estado = 'jugado'`
    );
    const torneos = await this.#torneos.obtenerTodos(filtro);

    const resumen = [];
    for (const t of torneos) {
      const detalle = aTorneo(t);
      const llaves = contarLlaves.get(t.id).total;
      const jugadas = contarJugadas.get(t.id).total;
      const posiciones = await this.#posiciones.obtenerPorTorneo(t.id);
      resumen.push({
        torneo: t.nombre,
        actividad: detalle.actividad ? detalle.actividad.nombre : "",
        area: detalle.actividad ? detalle.actividad.area : "",
        anio: t.anio,
        semestre: t.semestre,
        estado: t.estado,
        llaves,
        jugadas,
        posiciones: posiciones.map((p) => ({
          posicion: p.posicion,
          establecimiento: p.establecimiento ? p.establecimiento.nombre : "",
        })),
      });
    }
    return resumen;
  }
}

module.exports = ReporteService;