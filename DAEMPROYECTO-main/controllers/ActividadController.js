const ActividadService = require("../services/ActividadService");

class ActividadController {
  #service;

  constructor() {
    this.#service = new ActividadService();
  }

  async crear(req, res) {
    try {
      const actividad = await this.#service.crear(req.body);
      res.status(201).json({ mensaje: "Actividad creada", actividad });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async obtenerTodos(req, res) {
    try {
      const filtro = {};
      if (req.query.area) filtro.area = req.query.area;
      if (req.query.anio) filtro.anio = Number(req.query.anio);
      if (req.query.estado) filtro.estado = req.query.estado;
      const actividades = await this.#service.obtenerTodos(filtro);
      res.json(actividades);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async obtenerPorId(req, res) {
    try {
      const actividad = await this.#service.obtenerPorId(req.params.id);
      if (!actividad) return res.status(404).json({ error: "Actividad no encontrada" });
      res.json(actividad);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async actualizar(req, res) {
    try {
      const actividad = await this.#service.actualizar(req.params.id, req.body);
      if (!actividad) return res.status(404).json({ error: "Actividad no encontrada" });
      res.json({ mensaje: "Actividad actualizada", actividad });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async agregarEncuentro(req, res) {
    try {
      const actividad = await this.#service.agregarEncuentro(req.params.id, req.body);
      res.status(201).json({ mensaje: "Encuentro agregado al calendario", actividad });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async modificarEncuentro(req, res) {
    try {
      const actividad = await this.#service.modificarEncuentro(
        req.params.id,
        req.params.encuentroId,
        req.body
      );
      res.json({ mensaje: "Encuentro modificado", actividad });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async eliminar(req, res) {
    try {
      const eliminado = await this.#service.eliminar(req.params.id);
      if (!eliminado) return res.status(404).json({ error: "Actividad no encontrada" });
      res.json({ mensaje: "Actividad eliminada" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ActividadController;