const EstablecimientoService = require("../services/EstablecimientoService");

class EstablecimientoController {
  #service;

  constructor() {
    this.#service = new EstablecimientoService();
  }

  async crear(req, res) {
    try {
      const establecimiento = await this.#service.crear(req.body);
      res.status(201).json({ mensaje: "Establecimiento creado", establecimiento });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async obtenerTodos(req, res) {
    try {
      const establecimientos = await this.#service.obtenerTodos();
      res.json(establecimientos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async obtenerPorId(req, res) {
    try {
      const establecimiento = await this.#service.obtenerPorId(req.params.id);
      if (!establecimiento) return res.status(404).json({ error: "Establecimiento no encontrado" });
      res.json(establecimiento);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async actualizar(req, res) {
    try {
      const establecimiento = await this.#service.actualizar(req.params.id, req.body);
      if (!establecimiento) return res.status(404).json({ error: "Establecimiento no encontrado" });
      res.json({ mensaje: "Establecimiento actualizado", establecimiento });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async eliminar(req, res) {
    try {
      const eliminado = await this.#service.eliminar(req.params.id);
      if (!eliminado) return res.status(404).json({ error: "Establecimiento no encontrado" });
      res.json({ mensaje: "Establecimiento eliminado" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = EstablecimientoController;