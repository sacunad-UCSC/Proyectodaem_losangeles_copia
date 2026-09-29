const Usuario = require("../domain/Usuario");
const bcrypt = require("bcryptjs");
const UsuarioRepository = require("../repositories/UsuarioRepository");
const EstablecimientoRepository = require("../repositories/EstablecimientoRepository");

// Extrae el id numerico de un establecimiento (objeto poblado o id plano).
function idDeEstablecimiento(valor) {
  if (valor === null || valor === undefined) return valor;
  if (typeof valor === "object") return valor.id ?? valor._id ?? null;
  return valor;
}

class UsuarioService {
  #usuarios;
  #establecimientos;

  constructor() {
    this.#usuarios = new UsuarioRepository();
    this.#establecimientos = new EstablecimientoRepository();
  }

  async crearUsuario(datos, usuarioLogueado) {
    // Admin: puede crear coordinadores y lectores.
    // Coordinador: crea lectores de SU establecimiento.
    if (usuarioLogueado.rol === "admin") {
      if (datos.rol === "lector" && !datos.establecimiento) {
        throw new Error("Un lector debe tener un establecimiento asignado");
      }
    } else if (usuarioLogueado.rol === "coordinador") {
      if (datos.rol !== "lector") {
        throw new Error("El coordinador solo puede crear perfiles de Lector");
      }
      const propio = idDeEstablecimiento(usuarioLogueado.establecimiento);
      if (!datos.establecimiento || String(datos.establecimiento) !== String(propio)) {
        throw new Error("El lector debe asignarse al establecimiento del coordinador");
      }
    } else {
      throw new Error("No tiene permisos para crear usuarios");
    }

    const usuario = new Usuario(
      datos.rut,
      datos.nombre,
      datos.email,
      datos.telefono,
      datos.rol,
      datos.clave,
      datos.establecimiento || null
    );
    if (usuario.rol === "coordinador" && !datos.establecimiento) {
      throw new Error("Un coordinador debe tener un establecimiento asignado");
    }

    const doc = await this.#usuarios.crear({
      ...usuario.obtenerResumen(),
      claveHash: bcrypt.hashSync(datos.clave, 10),
    });
    return this.#aPublico(this.#usuarios.obtenerPorId(doc.id));
  }

  async obtenerTodos(usuarioLogueado) {
    const todos = this.#usuarios.obtenerTodos();
    const filtro = {};
    if (usuarioLogueado.rol === "coordinador") {
      filtro.rol = "lector";
      filtro.establecimiento = idDeEstablecimiento(usuarioLogueado.establecimiento);
    }
    // El repo no aplica filtros: se filtra aqui para mantener el alcance del
    // coordinador (solo lectores de SU establecimiento).
    const visibles = todos.filter((u) => {
      if (filtro.rol && u.rol !== filtro.rol) return false;
      if (filtro.establecimiento !== undefined && filtro.establecimiento !== null) {
        const fk = typeof u.establecimiento === "object" ? (u.establecimiento.id ?? u.establecimiento._id) : u.establecimiento;
        if (String(fk) !== String(filtro.establecimiento)) return false;
      }
      return true;
    });
    return visibles.map((u) => this.#aPublico(u));
  }

  async obtenerPorId(id) {
    return this.#aPublico(this.#usuarios.obtenerPorId(id));
  }

  async actualizar(id, datos, usuarioLogueado) {
    const existente = await this.#usuarios.obtenerPorId(id);
    if (!existente) throw new Error("Usuario no encontrado");

    if (usuarioLogueado.rol === "coordinador") {
      if (existente.rol !== "lector") {
        throw new Error("El coordinador solo administra a sus Lectores");
      }
      if (String(idDeEstablecimiento(existente.establecimiento)) !==
          String(idDeEstablecimiento(usuarioLogueado.establecimiento))) {
        throw new Error("El Lector no pertenece a su establecimiento");
      }
    }

    // Valida con la clase de dominio (POO) los campos sensibles.
    if (datos.rut || datos.nombre || datos.rol) {
      new Usuario(
        datos.rut || existente.rut,
        datos.nombre || existente.nombre,
        datos.email || existente.email,
        datos.telefono || existente.telefono,
        datos.rol || existente.rol,
        "XXXXXXXXXX" // placeholder, no se envia clave al actualizar perfil
      );
    }

    const actualizar = {};
    if (datos.nombre) actualizar.nombre = datos.nombre;
    if (datos.email !== undefined) actualizar.email = datos.email;
    if (datos.telefono !== undefined) actualizar.telefono = datos.telefono;
    if (datos.rol) actualizar.rol = datos.rol;
    if (datos.establecimiento !== undefined) actualizar.establecimiento = datos.establecimiento;
    if (datos.activo !== undefined) actualizar.activo = datos.activo;

    await this.#usuarios.actualizar(id, actualizar);
    return this.#aPublico(this.#usuarios.obtenerPorId(id));
  }

  async eliminar(id, usuarioLogueado) {
    const existente = await this.#usuarios.obtenerPorId(id);
    if (!existente) throw new Error("Usuario no encontrado");
    if (usuarioLogueado.rol === "coordinador") {
      if (existente.rol !== "lector") {
        throw new Error("El coordinador solo administra a sus Lectores");
      }
      if (String(idDeEstablecimiento(existente.establecimiento)) !==
          String(idDeEstablecimiento(usuarioLogueado.establecimiento))) {
        throw new Error("El Lector no pertenece a su establecimiento");
      }
    }
    return this.#usuarios.eliminar(id);
  }

  // Respuestas API: el front lee `_id` y `establecimiento.nombre`. Internamente
  // el repositorio usa `id`; aqui se devuelven ambos y el establecimiento como
  // objeto (con el nombre que trae el JOIN de obtenerTodos cuando aplica).
  #aPublico(u) {
    if (!u) return u;
    const copia = { ...u, _id: u.id };
    delete copia.claveHash;
    const est = copia.establecimiento;
    if (est && typeof est === "object") {
      const id = est.id ?? est._id;
      copia.establecimiento = { ...est, id, _id: id };
    } else if (est) {
      if (copia.establecimientoNombre) {
        copia.establecimiento = { id: est, _id: est, nombre: copia.establecimientoNombre };
      } else {
        const e = this.#establecimientos.obtenerPorId(est);
        copia.establecimiento = e ? { ...e, _id: e.id } : { id: est, _id: est, nombre: "" };
      }
    } else {
      copia.establecimiento = null;
    }
    copia.actividades = (copia.actividades || []).map((a) => ({ ...a, _id: a.id }));
    delete copia.establecimientoNombre;
    return copia;
  }
}

module.exports = UsuarioService;