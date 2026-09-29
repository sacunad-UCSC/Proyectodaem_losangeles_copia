// ============================================================
// Clase base (abstracta) del dominio.
// Encapsulamiento: atributos privados (#) con getters/setters.
// ============================================================

class Persona {
  #rut;
  #nombre;
  #email;
  #telefono;

  constructor(rut, nombre, email = "", telefono = "") {
    this.rut = rut;
    this.nombre = nombre;
    this.email = email;
    this.telefono = telefono;
  }

  // --- RUT ---
  static formatearRut(rut) {
    let limpio = String(rut).replace(/[^0-9kK]/g, "");
    if (limpio.length < 2) throw new Error("RUT invalido");
    const digito = limpio.slice(-1).toUpperCase();
    const cuerpo = limpio.slice(0, -1);
    return `${cuerpo}-${digito}`;
  }

  static validarDigitoVerificador(rut) {
    const limpio = String(rut).replace(/[^0-9kK]/g, "");
    if (limpio.length < 2) return false;
    const dvEsperado = limpio.slice(-1).toUpperCase();
    const cuerpo = limpio.slice(0, -1);
    let suma = 0;
    let multiplicador = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) {
      suma += parseInt(cuerpo[i], 10) * multiplicador;
      multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }
    const resto = suma % 11;
    let dvCalculado = 11 - resto;
    dvCalculado = dvCalculado === 11 ? "0" : dvCalculado === 10 ? "K" : String(dvCalculado);
    return dvCalculado === dvEsperado;
  }

  get rut() {
    return this.#rut;
  }

  set rut(valor) {
    const formateado = Persona.formatearRut(valor);
    if (!Persona.validarDigitoVerificador(formateado)) {
      throw new Error(`RUT invalido (digito verificador no coincide): ${valor}`);
    }
    this.#rut = formateado;
  }

  // --- NOMBRE ---
  get nombre() {
    return this.#nombre;
  }

  set nombre(valor) {
    const limpio = String(valor || "").trim();
    if (limpio.length < 3) throw new Error("El nombre debe tener al menos 3 caracteres");
    this.#nombre = limpio;
  }

  // --- EMAIL ---
  get email() {
    return this.#email;
  }

  set email(valor) {
    const limpio = String(valor || "").trim();
    if (limpio && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) {
      throw new Error("Email invalido");
    }
    this.#email = limpio;
  }

  // --- TELEFONO ---
  get telefono() {
    return this.#telefono;
  }

  set telefono(valor) {
    const limpio = String(valor || "").trim();
    if (limpio && !/^[0-9+\-\s]{6,15}$/.test(limpio)) {
      throw new Error("Telefono invalido (solo numeros, +, - o espacios)");
    }
    this.#telefono = limpio;
  }

  obtenerResumen() {
    return {
      rut: this.#rut,
      nombre: this.#nombre,
      email: this.#email,
      telefono: this.#telefono,
    };
  }
}

module.exports = Persona;