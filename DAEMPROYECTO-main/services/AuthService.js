const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Usuario = require("../domain/Usuario");
const UsuarioRepository = require("../repositories/UsuarioRepository");

class AuthService {
  #usuarios;

  constructor() {
    this.#usuarios = new UsuarioRepository();
  }

  async login(rut, clave) {
    if (!rut || !clave) throw new Error("Debe ingresar RUT y clave");

    const usuario = await this.#usuarios.obtenerPorRut(rut);
    if (!usuario) throw new Error("Credenciales invalidas");

    const claveValida = bcrypt.compareSync(clave, usuario.claveHash);
    if (!claveValida) throw new Error("Credenciales invalidas");

    if (!usuario.activo) throw new Error("El usuario esta desactivado");

    const token = jwt.sign(
      { sub: usuario.id, rut: usuario.rut, rol: usuario.rol },
      process.env.JWT_SECRET || "daem_clave_super_secreta",
      { expiresIn: "12h" }
    );

    return { token, usuario: this.#limpiarUsuario(usuario) };
  }

  // El repositorio ya devuelve objetos planos (id numerico): solo elimina el
  // hash y asegura `_id` para la respuesta de login del front.
  #limpiarUsuario(usuario) {
    if (!usuario) return usuario;
    const copia = { ...usuario, _id: usuario.id };
    delete copia.claveHash;
    return copia;
  }

  async crearAdmin(rut, nombre, clave) {
    const existente = await this.#usuarios.obtenerPorRut(rut);
    if (existente) return null; // ya existe un admin

    const admin = new Usuario(
      rut,
      nombre || "Administrador DAEM",
      "admin@daem.local",
      "",
      "admin",
      clave || "admin123"
    );

    const doc = await this.#usuarios.crear({
      ...admin.obtenerResumen(),
      claveHash: bcrypt.hashSync(admin.clave, 10),
    });
    const poblado = await this.#usuarios.obtenerPorId(doc.id);
    return poblado;
  }
}

module.exports = AuthService;