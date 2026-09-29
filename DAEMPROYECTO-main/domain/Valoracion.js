const { ESTADOS_CUMPLIMIENTO } = require("../constants/catalogos");

// Valoracion (ranking de cumplimiento) de un establecimiento en una actividad.
// Ej: Futbol > cumple, Ajedrez > no_cumple. Es la base del algoritmo de sorteo.
class Valoracion {
  #establecimiento;
  #actividad;
  #anio;
  #semestre;
  #estado;
  #fechaActualizacion;

  constructor(establecimiento, actividad, estado, anio, semestre) {
    this.establecimiento = establecimiento;
    this.actividad = actividad;
    this.estado = estado;
    this.anio = anio;
    this.semestre = semestre;
    this.fechaActualizacion = new Date();
  }

  static esEstadoValido(estado) {
    return Object.values(ESTADOS_CUMPLIMIENTO).some((e) => e.nombre === estado);
  }

  static valorNumerico(estado) {
    const item = Object.values(ESTADOS_CUMPLIMIENTO).find((e) => e.nombre === estado);
    return item ? item.valor : 0;
  }

  get establecimiento() {
    return this.#establecimiento;
  }

  set establecimiento(valor) {
    if (!valor) throw new Error("La valoracion requiere un establecimiento");
    this.#establecimiento = valor;
  }

  get actividad() {
    return this.#actividad;
  }

  set actividad(valor) {
    if (!valor) throw new Error("La valoracion requiere una actividad");
    this.#actividad = valor;
  }

  get estado() {
    return this.#estado;
  }

  set estado(valor) {
    if (!Valoracion.esEstadoValido(valor)) {
      throw new Error(`Estado de cumplimiento invalido. Opciones: ${Object.values(ESTADOS_CUMPLIMIENTO).map((e) => e.nombre).join(", ")}`);
    }
    this.#estado = valor;
  }

  get anio() {
    return this.#anio;
  }

  set anio(valor) {
    const n = parseInt(valor, 10);
    if (!Number.isInteger(n) || n < 2000 || n > 2100) throw new Error("Anio invalido");
    this.#anio = n;
  }

  get semestre() {
    return this.#semestre;
  }

  set semestre(valor) {
    const n = parseInt(valor, 10);
    if (n !== 1 && n !== 2) throw new Error("El semestre debe ser 1 o 2");
    this.#semestre = n;
  }

  get fechaActualizacion() {
    return this.#fechaActualizacion;
  }

  set fechaActualizacion(valor) {
    this.#fechaActualizacion = valor ? new Date(valor) : new Date();
  }

  obtenerValor() {
    return Valoracion.valorNumerico(this.#estado);
  }

  obtenerResumen() {
    return {
      establecimiento: this.#establecimiento,
      actividad: this.#actividad,
      estado: this.#estado,
      valor: this.obtenerValor(),
      anio: this.#anio,
      semestre: this.#semestre,
      fechaActualizacion: this.#fechaActualizacion,
    };
  }
}

module.exports = Valoracion;