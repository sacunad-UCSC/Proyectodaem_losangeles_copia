const { ESTADOS_SOLICITUD, TIPOS_SOLICITUD } = require("../constants/catalogos");

// Solicitud interna que levanta un establecimiento hacia su Coordinador
// (recursos o participacion) para la actividad que ejecuta.
class Solicitud {
  #tipo;
  #detalle;
  #estado;
  #rutSolicitante;
  #rutCoordinador;
  #actividad;
  #fecha;

  constructor(tipo, detalle, rutSolicitante, rutCoordinador, actividad, estado = ESTADOS_SOLICITUD.EN_PROCESO) {
    this.tipo = tipo;
    this.detalle = detalle;
    this.estado = estado;
    this.rutSolicitante = rutSolicitante;
    this.rutCoordinador = rutCoordinador;
    this.actividad = actividad;
    this.fecha = new Date();
  }

  static esTipoValido(tipo) {
    return Object.values(TIPOS_SOLICITUD).includes(tipo);
  }

  get tipo() {
    return this.#tipo;
  }

  set tipo(valor) {
    if (!Solicitud.esTipoValido(valor)) {
      throw new Error(`Tipo de solicitud invalido. Opciones: ${Object.values(TIPOS_SOLICITUD).join(", ")}`);
    }
    this.#tipo = valor;
  }

  get detalle() {
    return this.#detalle;
  }

  set detalle(valor) {
    const limpio = String(valor || "").trim();
    if (limpio.length < 5) throw new Error("El detalle de la solicitud es obligatorio");
    this.#detalle = limpio;
  }

  get estado() {
    return this.#estado;
  }

  set estado(valor) {
    if (!Object.values(ESTADOS_SOLICITUD).includes(valor)) {
      throw new Error("Estado de solicitud invalido");
    }
    this.#estado = valor;
  }

  get rutSolicitante() {
    return this.#rutSolicitante;
  }

  set rutSolicitante(valor) {
    this.#rutSolicitante = String(valor || "").trim();
  }

  get rutCoordinador() {
    return this.#rutCoordinador;
  }

  set rutCoordinador(valor) {
    this.#rutCoordinador = String(valor || "").trim();
  }

  get actividad() {
    return this.#actividad;
  }

  set actividad(valor) {
    this.#actividad = valor || null;
  }

  get fecha() {
    return this.#fecha;
  }

  set fecha(valor) {
    this.#fecha = valor ? new Date(valor) : new Date();
  }

  estaPendiente() {
    return this.#estado === ESTADOS_SOLICITUD.EN_PROCESO;
  }

  obtenerResumen() {
    return {
      tipo: this.#tipo,
      detalle: this.#detalle,
      estado: this.#estado,
      rutSolicitante: this.#rutSolicitante,
      rutCoordinador: this.#rutCoordinador,
      actividad: this.#actividad,
      fecha: this.#fecha,
    };
  }
}

module.exports = Solicitud;