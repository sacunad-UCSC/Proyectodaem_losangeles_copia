const SolicitudService = require("../services/SolicitudService");

class SolicitudController {
  #service;

  constructor() {
    this.#service = new SolicitudService();
  }

  async obtenerTodos(req, res) {
    try {
      const solicitudes = await this.#service.obtenerTodos(req.usuario);
      res.json(solicitudes);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async cambiarEstado(req, res) {
    try {
      const solicitud = await this.#service.cambiarEstado(
        req.params.id,
        req.body.estado,
        req.body.respuesta,
        req.usuario
      );
      res.json({ mensaje: `Solicitud ${req.body.estado}`, solicitud });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async eliminar(req, res) {
    try {
      const eliminado = await this.#service.eliminar(req.params.id, req.usuario);
      if (!eliminado) return res.status(404).json({ error: "Solicitud no encontrada" });
      res.json({ mensaje: "Solicitud eliminada" });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = SolicitudController;