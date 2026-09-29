// Equipo de un torneo: agrupa estudiantes de distintos establecimientos.
class Equipo {
  #torneo;
  #nombre;
  #alumnos;

  constructor(torneo, nombre, alumnos = []) {
    this.torneo = torneo;
    this.nombre = nombre;
    this.alumnos = alumnos;
  }

  get torneo() {
    return this.#torneo;
  }

  set torneo(valor) {
    if (!valor) throw new Error("El equipo requiere un torneo asociado");
    this.#torneo = valor;
  }

  get nombre() {
    return this.#nombre;
  }

  set nombre(valor) {
    const limpio = String(valor || "").trim();
    if (limpio.length < 3) throw new Error("El nombre del equipo debe tener al menos 3 caracteres");
    this.#nombre = limpio;
  }

  get alumnos() {
    return this.#alumnos;
  }

  set alumnos(valor) {
    const lista = Array.isArray(valor) ? valor : [];
    this.#alumnos = lista.filter(Boolean).map((a) => a._id || a);
  }

  obtenerResumen() {
    return {
      torneo: this.#torneo,
      nombre: this.#nombre,
      alumnos: this.#alumnos,
    };
  }
}

module.exports = Equipo;