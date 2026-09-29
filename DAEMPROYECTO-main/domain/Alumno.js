const Persona = require("./Persona");

// Alumno participante. Guarda fecha de nacimiento para poder validar
// la categoria (division) al momento de la inscripcion.
class Alumno extends Persona {
  #fechaNacimiento;
  #apoderado;
  #genero;

  constructor(rut, nombre, fechaNacimiento, apoderado = "", email = "", telefono = "", genero = "Otro") {
    super(rut, nombre, email, telefono);
    this.fechaNacimiento = fechaNacimiento;
    this.apoderado = apoderado;
    this.genero = genero;
  }

  get fechaNacimiento() {
    return this.#fechaNacimiento;
  }

  set fechaNacimiento(valor) {
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) throw new Error("Fecha de nacimiento invalida");
    if (fecha.getFullYear() < 1950 || fecha.getFullYear() > new Date().getFullYear()) {
      throw new Error("La fecha de nacimiento no es coherente");
    }
    this.#fechaNacimiento = fecha;
  }

  get apoderado() {
    return this.#apoderado;
  }

  set apoderado(valor) {
    this.#apoderado = String(valor || "").trim();
  }

  get genero() {
    return this.#genero;
  }

  set genero(valor) {
    const g = String(valor || "Otro").trim();
    if (!["M", "F", "Otro"].includes(g)) throw new Error("Genero invalido: use M, F o Otro");
    this.#genero = g;
  }

  calcularEdad() {
    const hoy = new Date();
    let anios = hoy.getFullYear() - this.#fechaNacimiento.getFullYear();
    const mesDia = hoy.getMonth() - this.#fechaNacimiento.getMonth();
    if (mesDia < 0 || (mesDia === 0 && hoy.getDate() < this.#fechaNacimiento.getDate())) {
      anios -= 1;
    }
    return anios;
  }

  anioNacimiento() {
    return this.#fechaNacimiento.getFullYear();
  }

  obtenerResumen() {
    return {
      ...super.obtenerResumen(),
      genero: this.#genero,
      fechaNacimiento: this.#fechaNacimiento,
      edad: this.calcularEdad(),
      anioNacimiento: this.anioNacimiento(),
      apoderado: this.#apoderado,
    };
  }
}

module.exports = Alumno;