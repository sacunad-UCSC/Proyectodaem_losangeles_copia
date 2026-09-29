const SolicitudRepository = require("../repositories/SolicitudRepository");

class SolicitudService {
  #solicitudes;

  constructor() {
    this.#solicitudes = new SolicitudRepository();
  }

  // El coordinador ve las solicitudes de su establecimiento; admin las ve todas.
  async obtenerTodos(usuario) {
    if (usuario.rol === "coordinador") {
      return this.#solicitudes.obtenerTodos({
        establecimiento: usuario.establecimiento?.id,
      });
    }
    return this.#solicitudes.obtenerTodos();
  }

  // El coordinador aprueba o rechaza la solicitud de su establecimiento.
  async cambiarEstado(id, estado, respuesta, usuario) {
    if (usuario.rol !== "coordinador") {
      throw new Error("Solo el Coordinador puede responder solicitudes internas");
    }
    if (!["aprobada", "rechazada"].includes(estado)) {
      throw new Error("Estado invalido: use aprobada/rechazada");
    }
    const solicitud = await this.#solicitudes.obtenerPorId(id);
    if (!solicitud) throw new Error("Solicitud no encontrada");
    if (String(solicitud.establecimiento?.id) !== String(usuario.establecimiento?.id)) {
      throw new Error("La solicitud no pertenece a su establecimiento");
    }
    return this.#solicitudes.cambiarEstado(id, estado, respuesta || "");
  }

  async eliminar(id, usuario) {
    const solicitud = await this.#solicitudes.obtenerPorId(id);
    if (!solicitud) throw new Error("Solicitud no encontrada");
    if (solicitud.estado !== "en_proceso") {
      throw new Error("No se puede eliminar una solicitud ya respondida");
    }
    return this.#solicitudes.eliminar(id);
  }
}

module.exports = SolicitudService;