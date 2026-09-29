const NotificacionService = require("../services/NotificacionService");

class NotificacionController {
  #service;
  constructor(service) {
    this.#service = service || new NotificacionService();
  }

  async listar(req, res) {
    try {
      const [notificaciones, noLeidas] = await Promise.all([
        this.#service.listar(req.usuario._id),
        this.#service.noLeidas(req.usuario._id),
      ]);
      res.json({ notificaciones, noLeidas });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async marcarLeida(req, res) {
    try {
      const n = await this.#service.marcarLeida(req.params.id, req.usuario._id);
      res.json(n);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async marcarTodasLeidas(req, res) {
    try {
      const r = await this.#service.marcarTodasLeidas(req.usuario._id);
      res.json(r);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = NotificacionController;
