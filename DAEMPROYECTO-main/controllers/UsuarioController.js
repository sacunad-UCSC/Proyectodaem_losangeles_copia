const UsuarioService = require("../services/UsuarioService");

class UsuarioController {
  #service;

  constructor() {
    this.#service = new UsuarioService();
  }

  async crear(req, res) {
    try {
      const usuario = await this.#service.crearUsuario(req.body, req.usuario);
      res.status(201).json({ mensaje: "Usuario creado", usuario });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async obtenerTodos(req, res) {
    try {
      const usuarios = await this.#service.obtenerTodos(req.usuario);
      res.json(usuarios);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async actualizar(req, res) {
    try {
      const usuario = await this.#service.actualizar(req.params.id, req.body, req.usuario);
      if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
      res.json({ mensaje: "Usuario actualizado", usuario });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async eliminar(req, res) {
    try {
      const eliminado = await this.#service.eliminar(req.params.id, req.usuario);
      if (!eliminado) return res.status(404).json({ error: "Usuario no encontrado" });
      res.json({ mensaje: "Usuario eliminado" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = UsuarioController;