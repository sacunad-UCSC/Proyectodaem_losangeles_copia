const Establecimiento = require("../domain/Establecimiento");
const EstablecimientoRepository = require("../repositories/EstablecimientoRepository");

class EstablecimientoService {
  #establecimientos;

  constructor() {
    this.#establecimientos = new EstablecimientoRepository();
  }

  async crear(datos) {
    const establecimiento = new Establecimiento(
      datos.codigo,
      datos.nombre,
      datos.dependencia,
      datos.direccion,
      datos.contacto
    );
    const doc = await this.#establecimientos.crear(establecimiento);
    return this.#conId(this.#establecimientos.obtenerPorId(doc.id));
  }

  async obtenerTodos() {
    return this.#establecimientos.obtenerTodos().map((e) => this.#conId(e));
  }

  async obtenerPorId(id) {
    return this.#conId(this.#establecimientos.obtenerPorId(id));
  }

  async actualizar(id, datos) {
    const existente = await this.#establecimientos.obtenerPorId(id);
    if (!existente) throw new Error("Establecimiento no encontrado");

    const actualizar = {};
    if (datos.codigo) {
      new Establecimiento(datos.codigo, existente.nombre, existente.dependencia);
      actualizar.codigo = datos.codigo.toUpperCase();
    }
    if (datos.nombre) {
      new Establecimiento(existente.codigo, datos.nombre, existente.dependencia);
      actualizar.nombre = datos.nombre;
    }
    if (datos.dependencia) {
      new Establecimiento(existente.codigo, existente.nombre, datos.dependencia);
      actualizar.dependencia = datos.dependencia;
    }
    if (datos.direccion !== undefined) actualizar.direccion = datos.direccion;
    if (datos.contacto !== undefined) actualizar.contacto = datos.contacto;

    return this.#conId(this.#establecimientos.actualizar(id, actualizar));
  }

  async eliminar(id) {
    return this.#establecimientos.eliminar(id);
  }

  // La BD interna usa `id`; el front consume `_id`. Las respuestas de API
  // llevan ambos para no romper el contrato de api.js/app.js.
  #conId(item) {
    if (!item) return item;
    return { ...item, _id: item.id };
  }
}

module.exports = EstablecimientoService;