const { ESTADOS_INSCRIPCION } = require("../constants/catalogos");

// Inscripcion de un establecimiento (via su coordinador) a una actividad.
// Tiene un ciclo de vida: en_proceso -> aceptada | rechazada.
class Inscripcion {
  #establecimiento;
  #actividad;
  #division;
  #estado;
  #rutCoordinador;
  #fecha;

  constructor(establecimiento, actividad, division, rutCoordinador, estado = ESTADOS_INSCRIPCION.EN_PROCESO) {
    this.establecimiento = establecimiento;
    this.actividad = actividad;
    this.division = division;
    this.estado = estado;
    this.rutCoordinador = rutCoordinador;
    this.fecha = new Date();
  }

  get establecimiento() {
    return this.#establecimiento;
  }

  set establecimiento(valor) {
    if (!valor) throw new Error("La inscripcion requiere un establecimiento");
    this.#establecimiento = valor;
  }

  get actividad() {
    return this.#actividad;
  }

  set actividad(valor) {
    if (!valor) throw new Error("La inscripcion requiere una actividad");
    this.#actividad = valor;
  }

  get division() {
    return this.#division;
  }

  set division(valor) {
    if (!valor) throw new Error("La inscripcion requiere una division");
    this.#division = valor;
  }

  get estado() {
    return this.#estado;
  }

  set estado(valor) {
    if (!Object.values(ESTADOS_INSCRIPCION).includes(valor)) {
      throw new Error("Estado de inscripcion invalido");
    }
    this.#estado = valor;
  }

  get rutCoordinador() {
    return this.#rutCoordinador;
  }

  set rutCoordinador(valor) {
    this.#rutCoordinador = String(valor || "").trim();
  }

  get fecha() {
    return this.#fecha;
  }

  set fecha(valor) {
    this.#fecha = valor ? new Date(valor) : new Date();
  }

  estaPendiente() {
    return this.#estado === ESTADOS_INSCRIPCION.EN_PROCESO;
  }

  esModificable() {
    return this.estaPendiente();
  }

  // Guarda la traza historica (anio/semestre) para reportes y comparaciones.
  periodo() {
    const anio = this.#fecha.getFullYear();
    const semestre = this.#fecha.getMonth() >= 6 ? 2 : 1;
    return { anio, semestre };
  }

  obtenerResumen() {
    return {
      establecimiento: this.#establecimiento,
      actividad: this.#actividad,
      division: this.#division,
      estado: this.#estado,
      rutCoordinador: this.#rutCoordinador,
      fecha: this.#fecha,
      periodo: this.periodo(),
    };
  }
}

module.exports = Inscripcion;