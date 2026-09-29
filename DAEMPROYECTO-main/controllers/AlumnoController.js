const AlumnoRepository = require("../repositories/AlumnoRepository");
const InscripcionRepository = require("../repositories/InscripcionRepository");
const ActividadRepository = require("../repositories/ActividadRepository");

// Gestion de alumnos y el registro de asistencia (Admin DAEM).
class AlumnoController {
  #alumnos;
  #inscripciones;
  #actividades;

  constructor() {
    this.#alumnos = new AlumnoRepository();
    this.#inscripciones = new InscripcionRepository();
    this.#actividades = new ActividadRepository();
  }

  // Lista los alumnos de las actividades asignadas al usuario.
  async obtenerMios(req, res) {
    try {
      const actividades = (req.usuario.actividades || []).map((a) => a._id || a.id || a);
      const filtro = actividades.length ? { actividad: { $in: actividades } } : { actividad: null };
      const alumnos = await this.#alumnos.obtenerTodos(filtro);
      res.json(alumnos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Agenda: calendario de las actividades que ejecuta el usuario.
  async agenda(req, res) {
    try {
      const actividades = (req.usuario.actividades || []).map((a) => a._id || a.id || a);
      const inscripciones = this.#inscripciones.obtenerTodos(
        actividades.length ? { actividad: { $in: actividades } } : { actividad: null }
      );
      const todas = this.#actividades.obtenerTodos();
      const porId = new Map(todas.map((a) => [a.id, a]));

      const encuentros = [];
      for (const insc of inscripciones) {
        const actividad = insc.actividad ? porId.get(insc.actividad.id) : null;
        if (!actividad || !actividad.encuentros) continue;
        for (const e of actividad.encuentros) {
          encuentros.push({
            encuentro: { ...e, _id: e.id },
            actividad: actividad.nombre,
            area: actividad.area,
            division: insc.division,
            establecimiento: insc.establecimiento ? insc.establecimiento.nombre : "",
            lugar: e.lugar,
          });
        }
      }

      encuentros.sort((a, b) => new Date(a.encuentro.fecha) - new Date(b.encuentro.fecha));
      res.json({
        mios: encuentros,
        actividadesPublicas: todas.map((t) => ({
          id: t.id,
          nombre: t.nombre,
          area: t.area,
          encuentros: (t.encuentros || []).map((e) => ({ ...e, _id: e.id })),
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Registra asistencia de un alumno a un encuentro de su actividad.
  async registrarAsistencia(req, res) {
    try {
      const { presente } = req.body;
      const alumno = await this.#alumnos.obtenerPorId(req.params.id);
      if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

      const permitidas = (req.usuario.actividades || []).map((a) => a._id || a.id || a);
      if (req.usuario.rol !== "admin" && !permitidas.some((a) => String(a) === String(alumno.actividad.id))) {
        return res.status(403).json({ error: "La actividad del alumno no esta asignada a usted" });
      }

      const actualizado = await this.#alumnos.registrarAsistencia(
        alumno.id,
        req.params.encuentroId,
        presente !== false
      );
      res.json({ mensaje: "Asistencia registrada", alumno: { ...actualizado, _id: actualizado.id } });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = AlumnoController;