const { ESTADOS_TORNEO } = require("../constants/catalogos");

// Torneo organizado por el Admin DAEM para una actividad.
// Genera grupos (ej: Grupo A) y contiene las llaves del sorteo.
class Torneo {
  #nombre;
  #actividad;
  #division;
  #formato;
  #anio;
  #semestre;
  #estado;
  #grupos;
  #formulario;
  #requisitos;
  #fechaAperturaInscripcion;
  #fechaCierreInscripcion;

  constructor(nombre, actividad, division, anio, semestre, estado = ESTADOS_TORNEO.INSCRIPCIONES, grupos = [], formulario = {}, formato = "amistoso") {
    this.nombre = nombre;
    this.actividad = actividad;
    this.division = division;
    this.formato = formato;
    this.anio = anio;
    this.semestre = semestre;
    this.estado = estado;
    this.grupos = grupos;
    this.formulario = formulario;
    this.requisitos = formulario?.requisitos || {};
    this.fechaAperturaInscripcion = formulario?.fechaAperturaInscripcion || null;
    this.fechaCierreInscripcion = formulario?.fechaCierreInscripcion || null;
  }

  get nombre() {
    return this.#nombre;
  }

  set nombre(valor) {
    const limpio = String(valor || "").trim();
    if (limpio.length < 3) throw new Error("El nombre del torneo debe tener al menos 3 caracteres");
    this.#nombre = limpio;
  }

  get actividad() {
    return this.#actividad;
  }

  set actividad(valor) {
    if (!valor) throw new Error("El torneo requiere una actividad asociada");
    this.#actividad = valor;
  }

  get division() {
    return this.#division;
  }

  set division(valor) {
    this.#division = String(valor || "").trim();
  }

  get formato() {
    return this.#formato;
  }

  set formato(valor) {
    const f = String(valor || "").trim().toLowerCase();
    if (!["amistoso", "competitivo"].includes(f)) throw new Error("Formato de torneo invalido");
    this.#formato = f;
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

  get estado() {
    return this.#estado;
  }

  set estado(valor) {
    if (!Object.values(ESTADOS_TORNEO).includes(valor)) {
      throw new Error("Estado de torneo invalido");
    }
    this.#estado = valor;
  }

  get grupos() {
    return this.#grupos;
  }

  set grupos(valor) {
    const lista = Array.isArray(valor) ? valor : [];
    this.#grupos = lista.length
      ? lista.filter((g) => String(g || "").trim().length > 0)
      : ["Llave"];
  }

  get formulario() {
    return this.#formulario;
  }

  set formulario(valor) {
    this.#formulario = valor && typeof valor === "object" ? valor : {};
  }

  get requisitos() {
    return this.#requisitos;
  }

  set requisitos(valor) {
    const r = valor && typeof valor === "object" ? valor : {};
    this.#requisitos = {
      activo: !!r.activo,
      edadMinima: r.edadMinima != null ? parseInt(r.edadMinima, 10) || null : null,
      edadMaxima: r.edadMaxima != null ? parseInt(r.edadMaxima, 10) || null : null,
      genero: ["varones", "damas", "mixto"].includes(r.genero) ? r.genero : "",
    };
  }

  get fechaAperturaInscripcion() {
    return this.#fechaAperturaInscripcion;
  }

  set fechaAperturaInscripcion(valor) {
    this.#fechaAperturaInscripcion = valor ? new Date(valor) : null;
  }

  get fechaCierreInscripcion() {
    return this.#fechaCierreInscripcion;
  }

  set fechaCierreInscripcion(valor) {
    this.#fechaCierreInscripcion = valor ? new Date(valor) : null;
  }

  permitirInscripciones() {
    return this.#estado === ESTADOS_TORNEO.INSCRIPCIONES;
  }

  obtenerResumen() {
    return {
      nombre: this.#nombre,
      actividad: this.#actividad,
      division: this.#division,
      formato: this.#formato,
      anio: this.#anio,
      semestre: this.#semestre,
      estado: this.#estado,
      grupos: this.#grupos,
      formulario: this.#formulario,
      requisitos: this.#requisitos,
      fechaAperturaInscripcion: this.#fechaAperturaInscripcion,
      fechaCierreInscripcion: this.#fechaCierreInscripcion,
    };
  }
}

module.exports = Torneo;