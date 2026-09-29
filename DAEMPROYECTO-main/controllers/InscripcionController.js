const InscripcionService = require("../services/InscripcionService");

class InscripcionController {
  #service;

  constructor() {
    this.#service = new InscripcionService();
  }

  async crear(req, res) {
    try {
      const inscripcion = await this.#service.crear(req.body, req.usuario);
      res.status(201).json({ mensaje: "Inscripcion enviada (en proceso)", inscripcion });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async obtenerTodos(req, res) {
    try {
      const filtro = {};
      if (req.query.estado) filtro.estado = req.query.estado;
      if (req.query.actividad) filtro.actividad = req.query.actividad;
      const inscripciones = await this.#service.obtenerTodos(req.usuario, filtro);
      res.json(inscripciones);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async obtenerPorId(req, res) {
    try {
      const inscripcion = await this.#service.obtenerPorId(req.params.id);
      if (!inscripcion) return res.status(404).json({ error: "Inscripcion no encontrada" });
      res.json(inscripcion);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Admin: aceptar o rechazar.
  async cambiarEstado(req, res) {
    try {
      const inscripcion = await this.#service.cambiarEstado(req.params.id, req.body.estado, req.usuario);
      res.json({ mensaje: `Inscripcion ${req.body.estado}`, inscripcion });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Coordinador: modificar dentro del plazo (solo en proceso).
  async modificar(req, res) {
    try {
      const inscripcion = await this.#service.modificar(req.params.id, req.body, req.usuario);
      res.json({ mensaje: "Inscripcion modificada", inscripcion });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async retractar(req, res) {
    try {
      await this.#service.retractar(req.params.id, req.usuario);
      res.json({ mensaje: "Inscripcion retractada/eliminada" });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async asociarTorneo(req, res) {
    try {
      const inscripcion = await this.#service.asociarTorneo(req.params.id, req.body.torneo, req.usuario);
      res.json({ mensaje: "Inscripcion asociada al torneo", inscripcion });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Alumnos vinculados a la inscripcion.
  async agregarAlumno(req, res) {
    try {
      const alumno = await this.#service.agregarAlumno(req.params.id, req.body, req.usuario);
      res.status(201).json({ mensaje: "Alumno agregado con validacion de categoria", alumno });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Postulante directo a la nomina (crea la inscripcion aceptada).
  async postular(req, res) {
    try {
      const alumno = await this.#service.postular(req.body, req.usuario);
      res.status(201).json({ mensaje: "Postulante agregado a la nomina", alumno });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Torneos programados por el admin a los que el coordinador puede postular.
  async torneosPostulables(req, res) {
    try {
      const torneos = await this.#service.torneosParaPostulacion(req.usuario);
      res.json(torneos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Estudiantes del establecimiento ya postulados a un torneo.
  async postuladosTorneo(req, res) {
    try {
      const alumnos = await this.#service.postuladosTorneo(req.params.torneoId, req.usuario);
      res.json({ total: alumnos.length, alumnos });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Coordinador postula un estudiante (de la nomina o nuevo) a un torneo.
  async postularTorneo(req, res) {
    try {
      const { alumno, yaPostulado } = await this.#service.postularTorneo(req.params.torneoId, req.body, req.usuario);
      res.status(201).json({
        mensaje: yaPostulado ? "El estudiante ya estaba postulado al torneo" : "Estudiante postulado al torneo",
        alumno,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async eliminarAlumno(req, res) {
    try {
      await this.#service.eliminarAlumno(req.params.id, req.params.alumnoId, req.usuario);
      res.json({ mensaje: "Alumno eliminado de la inscripcion" });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async nomina(req, res) {
    try {
      const nomina = await this.#service.nominaEstablecimiento(req.usuario);
      res.json(nomina);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async eliminar(req, res) {
    try {
      await this.#service.retractar(req.params.id, req.usuario);
      res.json({ mensaje: "Inscripcion eliminada" });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = InscripcionController;