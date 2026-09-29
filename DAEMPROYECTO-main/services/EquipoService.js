const Equipo = require("../domain/Equipo");
const EquipoRepository = require("../repositories/EquipoRepository");
const InscripcionRepository = require("../repositories/InscripcionRepository");
const AlumnoRepository = require("../repositories/AlumnoRepository");
const TorneoRepository = require("../repositories/TorneoRepository");
const { obtenerConexion } = require("../db/conexion");
const { descodificarJson } = require("../db/util");

// Los repos no agregan _id: la capa de servicio que expone a la API agrega
// _id (mirror de id) en equipos y alumnos para el front.
function aEquipo(e) {
  if (!e) return e;
  e._id = e.id;
  (e.alumnos || []).forEach((a) => {
    a._id = a.id;
    if (a.establecimiento && typeof a.establecimiento === "object") {
      a.establecimiento._id = a.establecimiento.id;
    }
  });
  return e;
}

// Gestiona los equipos de un torneo. Un equipo agrupa estudiantes de
// distintos establecimientos: se puede armar por sorteo automatico
// (distribuye la nomina de inscritos) o manualmente.
class EquipoService {
  #equipos;
  #inscripciones;
  #alumnos;
  #torneos;

  constructor() {
    this.#equipos = new EquipoRepository();
    this.#inscripciones = new InscripcionRepository();
    this.#alumnos = new AlumnoRepository();
    this.#torneos = new TorneoRepository();
  }

  // Pool de estudiantes disponibles: los de inscripciones aceptadas del
  // torneo que aun no estan asignados a ningun equipo. Incluye tanto las
  // inscripciones completas asociadas al torneo como los estudiantes
  // postulados individualmente (alumno.torneos).
  async obtenerPool(torneoId) {
    const inscripciones = await this.#inscripciones.obtenerTodos({
      torneo: torneoId,
      estado: "aceptada",
    });
    const directos = await this.#alumnos.obtenerTodos({ torneos: torneoId });

    const asignados = await this.#equipos.obtenerPorTorneo(torneoId);
    const usados = new Set();
    asignados.forEach((e) => (e.alumnos || []).forEach((a) => usados.add(String(a.id))));

    const alumnos = [];
    const vistos = new Set();
    const agregar = (a) => {
      const id = String(a.id);
      if (vistos.has(id) || usados.has(id)) return;
      vistos.add(id);
      alumnos.push(a);
    };
    directos.forEach(agregar);
    for (const insc of inscripciones) {
      for (const a of insc.alumnos || []) agregar(a);
    }

    return this.#enriquecerConEstablecimiento(alumnos);
  }

  async #enriquecerConEstablecimiento(alumnos) {
    if (!alumnos.length) return [];
    const ids = alumnos.map((a) => a.id);
    const marcadores = ids.map(() => "?").join(",");
    const bd = obtenerConexion();
    const filas = bd
      .prepare(
        `SELECT a.*,
                e.id AS establecimientoId, e.codigo AS establecimientoCodigo,
                e.nombre AS establecimientoNombre, e.dependencia AS establecimientoDependencia,
                e.direccion AS establecimientoDireccion, e.contacto AS establecimientoContacto,
                ac.id AS actividadId, ac.nombre AS actividadNombre, ac.area AS actividadArea,
                ac.divisiones AS actividadDivisiones, ac.anio AS actividadAnio,
                ac.semestre AS actividadSemestre, ac.estado AS actividadEstado
         FROM alumnos a
         LEFT JOIN establecimientos e ON e.id = a.establecimiento
         LEFT JOIN actividades ac ON ac.id = a.actividad
         WHERE a.id IN (${marcadores})`
      )
      .all(...ids);
    const porId = {};
    filas.forEach((f) => {
      porId[String(f.id)] = f;
    });
    return alumnos.map((a) => {
      const f = porId[String(a.id)];
      if (!f) return a;
      const establecimiento = f.establecimientoId
        ? {
            id: f.establecimientoId,
            _id: f.establecimientoId,
            codigo: f.establecimientoCodigo,
            nombre: f.establecimientoNombre,
            dependencia: f.establecimientoDependencia,
            direccion: f.establecimientoDireccion,
            contacto: f.establecimientoContacto,
          }
        : null;
      const actividad = f.actividadId
        ? {
            id: f.actividadId,
            _id: f.actividadId,
            nombre: f.actividadNombre,
            area: f.actividadArea,
            divisiones: descodificarJson(f.actividadDivisiones, []),
            anio: f.actividadAnio,
            semestre: f.actividadSemestre,
            estado: f.actividadEstado,
          }
        : null;
      return {
        id: f.id,
        _id: f.id,
        rut: f.rut,
        nombre: f.nombre,
        genero: f.genero,
        fechaNacimiento: f.fechaNacimiento,
        apoderado: f.apoderado,
        email: f.email,
        telefono: f.telefono,
        establecimiento,
        actividad,
        division: f.division,
        inscripcion: f.inscripcion,
        torneos: a.torneos || [],
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      };
    });
  }

  // Distribuye automaticamente a los inscritos en N equipos balanceados.
  async sortear(torneoId, { cantidad }) {
    const torneo = await this.#torneos.obtenerPorId(torneoId);
    if (!torneo) throw new Error("Torneo no encontrado");
    const pool = await this.obtenerPool(torneoId);
    if (pool.length < 2) {
      throw new Error(
        "Necesita al menos 2 estudiantes inscritos (sin equipo) para sortear equipos"
      );
    }

    const n = Math.max(2, parseInt(cantidad, 10) || 2);
    if (n > pool.length) {
      throw new Error(`No puede crear ${n} equipos con solo ${pool.length} estudiantes`);
    }

    // Orden alfabetico: los equipos no llevan numeros, se nombran con una
    // letra del abecedario (Equipo A, Equipo B, ...).
    const base = pool.slice().sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));
    const torque = Array.from({ length: n }, (_, i) => ({
      torneo: torneoId,
      nombre: `Equipo ${String.fromCharCode(65 + i)}`,
      alumnos: [],
    }));
    base.forEach((a, idx) => torque[idx % n].alumnos.push(a.id));

    await this.#eliminarPorTorneo(torneoId);
    const creados = [];
    for (const t of torque) creados.push(await this.#equipos.crear(t));
    return this.#equipos.obtenerPorTorneo(torneoId).map(aEquipo);
  }

  // Crea un equipo manual con estudiantes seleccionados del pool.
  async crear(torneoId, { nombre, alumnos = [] }) {
    const torneo = await this.#torneos.obtenerPorId(torneoId);
    if (!torneo) throw new Error("Torneo no encontrado");
    const pool = await this.obtenerPool(torneoId);
    const disponibles = new Set(pool.map((a) => String(a.id)));
    const ids = (Array.isArray(alumnos) ? alumnos : [])
      .filter((id) => id && disponibles.has(String(id)))
      .map((id) => String(id));

    if (!ids.length) throw new Error("Seleccione al menos 1 estudiante disponible");

    const equipo = new Equipo(torneoId, nombre, ids);
    const doc = await this.#equipos.crear(equipo.obtenerResumen());
    return aEquipo(this.#equipos.obtenerPorId(doc.id));
  }

  async listar(torneoId) {
    return this.#equipos.obtenerPorTorneo(torneoId).map(aEquipo);
  }

  async eliminar(torneoId, equipoId) {
    const equipo = await this.#equipos.obtenerPorId(equipoId);
    if (!equipo || String(equipo.torneo?._id || equipo.torneo) !== String(torneoId)) {
      throw new Error("Equipo no encontrado en este torneo");
    }
    return this.#equipos.eliminar(equipoId);
  }

  async #eliminarPorTorneo(torneoId) {
    return this.#equipos.eliminarPorTorneo(torneoId);
  }
}

module.exports = EquipoService;