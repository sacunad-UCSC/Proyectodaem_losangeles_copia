const { POSICIONES } = require("../constants/catalogos");

// Resultado de una llave/encuentro: puntajes, ganador y posiciones obtenidas.
class Resultado {
  #llave;
  #puntajeA;
  #puntajeB;
  #ganador;
  #posicion;

  constructor(llave, puntajeA = null, puntajeB = null, ganador = null, posicion = null) {
    this.llave = llave;
    this.puntajeA = puntajeA;
    this.puntajeB = puntajeB;
    this.ganador = ganador;
    this.posicion = posicion;
  }

  get llave() {
    return this.#llave;
  }

  set llave(valor) {
    if (!valor) throw new Error("El resultado requiere una llave");
    this.#llave = valor;
  }

  get puntajeA() {
    return this.#puntajeA;
  }

  set puntajeA(valor) {
    this.#puntajeA = valor === null || valor === "" ? null : parseInt(valor, 10);
    if (this.#puntajeA !== null && (Number.isNaN(this.#puntajeA) || this.#puntajeA < 0)) {
      throw new Error("Puntaje invalido (debe ser 0 o mas)");
    }
  }

  get puntajeB() {
    return this.#puntajeB;
  }

  set puntajeB(valor) {
    this.#puntajeB = valor === null || valor === "" ? null : parseInt(valor, 10);
    if (this.#puntajeB !== null && (Number.isNaN(this.#puntajeB) || this.#puntajeB < 0)) {
      throw new Error("Puntaje invalido (debe ser 0 o mas)");
    }
  }

  get ganador() {
    return this.#ganador;
  }

  set ganador(valor) {
    this.#ganador = valor || null;
  }

  get posicion() {
    return this.#posicion;
  }

  set posicion(valor) {
    if (valor && !POSICIONES.includes(valor)) {
      throw new Error(`Posicion invalida. Opciones: ${POSICIONES.join(", ")}`);
    }
    this.#posicion = valor || null;
  }

  estaJugada() {
    return this.#puntajeA !== null && this.#puntajeB !== null;
  }

  // Polimorfismo: calcula ganador segun tipos de competencia (mayor puntaje).
  calcularGanador() {
    if (!this.estaJugada()) return null;
    if (this.#puntajeA === this.#puntajeB) return "empate";
    return this.#puntajeA > this.#puntajeB ? "equipoA" : "equipoB";
  }

  obtenerResumen() {
    return {
      llave: this.#llave,
      puntajeA: this.#puntajeA,
      puntajeB: this.#puntajeB,
      ganador: this.calcularGanador(),
      posicion: this.#posicion,
    };
  }
}

module.exports = Resultado;