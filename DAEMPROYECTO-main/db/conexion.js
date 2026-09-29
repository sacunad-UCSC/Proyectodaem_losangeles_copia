const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DIR_DATOS = path.join(__dirname, "..", "data");
const RUTA_DB = process.env.DB_PATH
  ? process.env.DB_PATH
  : path.join(DIR_DATOS, "daem.db");

let bd = null;

function obtenerConexion() {
  if (bd) return bd;

  if (!fs.existsSync(DIR_DATOS)) {
    fs.mkdirSync(DIR_DATOS, { recursive: true });
  }

  bd = new Database(RUTA_DB);

  // FKs ON por defecto (SQLite no las activa solo).
  bd.pragma("foreign_keys = ON");
  // WAL: mejor concurrencia lectura/escritura y tolerancia a cortes.
  bd.pragma("journal_mode = WAL");
  bd.pragma("busy_timeout = 3000");
  return bd;
}

function cerrarConexion() {
  if (bd) {
    bd.close();
    bd = null;
  }
}

module.exports = { obtenerConexion, cerrarConexion, RUTA_DB };
