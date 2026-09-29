const { obtenerConexion, cerrarConexion, RUTA_DB } = require("../db/conexion");
const { crearEsquema } = require("../db/esquema");

async function initDatabase() {
  crearEsquema();
  console.log(`[DB] Conectado a SQLite en ${RUTA_DB}`);
  return obtenerConexion();
}

async function detenerDatabase() {
  cerrarConexion();
}

module.exports = { initDatabase, detenerDatabase };
