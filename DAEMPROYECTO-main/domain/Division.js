const { obtenerDivision } = require("../constants/catalogos");

// Division / categoria de competencia (MINIS, SUB 13, JUVENIL, DAMAS, VARONES).
// Valida la fecha de nacimiento de un alumno contra el rango de la categoria.
// Las categorias libres (no catalogadas) no restringen edad.
class Division {
  #nombre;
  #desde;
  #hasta;

  constructor(nombre) {
    const division = obtenerDivision(nombre);
    this.#nombre = String(nombre || "").trim();
    if (!this.#nombre) throw new Error("Division/categoria es obligatoria");
    this.#desde = division ? division.desde : null;
    this.#hasta = division ? division.hasta : null;
  }

  get nombre() {
    return this.#nombre;
  }

  get desde() {
    return this.#desde;
  }

  get hasta() {
    return this.#hasta;
  }

  get restringeEdad() {
    return this.#desde !== null && this.#hasta !== null;
  }

  // Polimorfismo de validacion: cada division valida su propio rango.
  validarFechaNacimiento(fechaNacimiento) {
    if (!this.restringeEdad) return true;
    const anio = new Date(fechaNacimiento).getFullYear();
    if (!Number.isInteger(anio) || anio < 1950 || anio > new Date().getFullYear()) {
      throw new Error("Fecha de nacimiento invalida");
    }
    const valido = anio >= this.#desde && anio <= this.#hasta;
    if (!valido) {
      throw new Error(
        `El alumno nacio en ${anio}; ${this.#nombre} requiere nacer entre ${this.#desde} y ${this.#hasta}`
      );
    }
    return true;
  }

  obtenerResumen() {
    return {
      nombre: this.#nombre,
      rangoNacimiento:
        this.restringeEdad ? `${this.#desde}-${this.#hasta}` : "(sin rango fijo)",
    };
  }
}

module.exports = Division;