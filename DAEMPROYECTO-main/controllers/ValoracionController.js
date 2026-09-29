const ValoracionService = require("../services/ValoracionService");

class ValoracionController {
  #service;

  constructor() {
    this.#service = new ValoracionService();
  }

  async asignar(req, res) {
    try {
      const valoracion = await this.#service.asignar(req.body);
      res.json({ mensaje: "Valoracion de cumplimiento asignada", valoracion });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async obtenerTodos(req, res) {
    try {
      const filtro = {};
      if (req.query.anio) filtro.anio = Number(req.query.anio);
      if (req.query.semestre) filtro.semestre = Number(req.query.semestre);
      if (req.query.actividad) filtro.actividad = req.query.actividad;
      const valoraciones = await this.#service.obtenerTodos(filtro);
      res.json(valoraciones);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async ranking(req, res) {
    try {
      const filtro = {};
      if (req.query.anio) filtro.anio = Number(req.query.anio);
      if (req.query.semestre) filtro.semestre = Number(req.query.semestre);
      const ranking = await this.#service.ranking(filtro);
      res.json(ranking);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ValoracionController;