const AuthService = require("../services/AuthService");

class AuthController {
  #service;

  constructor() {
    this.#service = new AuthService();
  }

  async login(req, res) {
    try {
      const { rut, clave } = req.body || {};
      if (!rut || !clave) {
        return res.status(400).json({ error: "Debe ingresar RUT y clave" });
      }
      const resultado = await this.#service.login(rut, clave);
      res.json({
        mensaje: "Sesion iniciada correctamente",
        token: resultado.token,
        usuario: resultado.usuario.obtenerPublico ? resultado.usuario.obtenerPublico() : resultado.usuario,
      });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  }

  async perfil(req, res) {
    try {
      const usuario = req.usuario;
      const publico = usuario.obtenerPublico ? usuario.obtenerPublico() : usuario;
      res.json(publico);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = AuthController;