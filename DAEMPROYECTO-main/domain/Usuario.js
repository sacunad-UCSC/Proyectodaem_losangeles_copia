const Persona = require("./Persona");
const { ROLES } = require("../constants/catalogos");

// Usuario del sistema (Admin DAEM, Coordinador o Lector).
// Hereda de Persona (encapsulamiento + validaciones) y agrega rol + hashing de clave.
class Usuario extends Persona {
  #clave;
  #rol;
  #establecimiento;

  constructor(rut, nombre, email, telefono, rol, clave, establecimiento = null) {
    super(rut, nombre, email, telefono);
    this.rol = rol;
    this.clave = clave;
    this.#establecimiento = establecimiento;
  }

  static esRolValido(rol) {
    return Object.values(ROLES).includes(rol);
  }

  get rol() {
    return this.#rol;
  }

  set rol(valor) {
    if (!Usuario.esRolValido(valor)) {
      throw new Error(`Rol invalido. Roles permitidos: ${Object.values(ROLES).join(", ")}`);
    }
    this.#rol = valor;
  }

  // La clave se almacena solo en forma de hash (bcrypt). Nunca se expone.
  get clave() {
    return this.#clave;
  }

  set clave(valor) {
    if (!valor || String(valor).length < 6) {
      throw new Error("La clave debe tener al menos 6 caracteres");
    }
    this.#clave = valor;
  }

  get establecimiento() {
    return this.#establecimiento;
  }

  set establecimiento(valor) {
    this.#establecimiento = valor || null;
  }

  // Reglas por rol
  puedeAdministrar() {
    return this.#rol === ROLES.ADMIN;
  }

  puedeInscribir() {
    return this.#rol === ROLES.COORDINADOR || this.#rol === ROLES.ADMIN;
  }

  esCoordinador() {
    return this.#rol === ROLES.COORDINADOR;
  }

  esLector() {
    return this.#rol === ROLES.LECTOR;
  }

  obtenerResumen() {
    return {
      ...super.obtenerResumen(),
      rol: this.#rol,
      establecimiento: this.#establecimiento,
    };
  }
}

module.exports = Usuario;