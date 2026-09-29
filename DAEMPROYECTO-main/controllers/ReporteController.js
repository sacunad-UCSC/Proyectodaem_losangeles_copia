const ReporteService = require("../services/ReporteService");

class ReporteController {
  #service;

  constructor() {
    this.#service = new ReporteService();
  }

  async nomina(req, res) {
    try {
      const nomina = await this.#service.nomina();
      res.json({ total: nomina.length, establecimientos: nomina });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async participaciones(req, res) {
    try {
      const datos = await this.#service.participaciones(req.query);
      res.json(datos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async beneficiarios(req, res) {
    try {
      const datos = await this.#service.beneficiarios(req.query);
      res.json(datos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async historico(req, res) {
    try {
      const datos = await this.#service.historico();
      res.json(datos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async torneos(req, res) {
    try {
      const datos = await this.#service.torneos(req.query);
      res.json(datos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ReporteController;