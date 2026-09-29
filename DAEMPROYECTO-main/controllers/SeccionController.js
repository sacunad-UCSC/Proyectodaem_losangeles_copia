const SeccionService = require("../services/SeccionService");

class SeccionController {
  #service;

  constructor() {
    this.#service = new SeccionService();
  }

  async crear(req, res) {
    try {
      const seccion = await this.#service.crear(req.body);
      res.status(201).json({ mensaje: "Seccion creada", seccion });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async obtenerTodos(req, res) {
    try {
      const secciones = await this.#service.obtenerTodos();
      res.json(secciones);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async actualizar(req, res) {
    try {
      const seccion = await this.#service.actualizar(req.params.id, req.body);
      if (!seccion) return res.status(404).json({ error: "Seccion no encontrada" });
      res.json({ mensaje: "Seccion actualizada", seccion });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async eliminar(req, res) {
    try {
      const eliminada = await this.#service.eliminar(req.params.id);
      if (!eliminada) return res.status(404).json({ error: "Seccion no encontrada" });
      res.json({ mensaje: "Seccion eliminada" });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = SeccionController;