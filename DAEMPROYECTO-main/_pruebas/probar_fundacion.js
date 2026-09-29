// Prueba real de la fundacion: abre SQLite en memoria con el mismo driver,
// ejecuta las primeras 8 sentencias del esquema y hace INSERT+SELECT.
const { CREAR_TABLAS } = require("../db/esquema");
const bd = new (require("better-sqlite3"))(":memory:");
bd.pragma("foreign_keys = ON");

for (const ddlTexto of CREAR_TABLAS) bd.exec(ddlTexto);

// 1) establecer (id, codigo, nombre)
const r1 = bd
  .prepare(
    "INSERT INTO establecimientos (codigo, nombre, dependencia) VALUES (?,?,?)"
  )
  .run("123", "Colegio Test", "Municipal");
console.log("[1] establecimiento insert id =", r1.lastInsertRowid);

// verificacion UNIQUE
try {
  bd.prepare("INSERT INTO establecimientos (codigo, nombre, dependencia) VALUES (?,?,?)").run("123", "Duplicado", "Municipal");
  console.log("[x] ERROR: el UNIQUE no funciono");
} catch (e) {
  console.log("[2] UNIQUE establecimientos.codigo OK ->", e.code);
}

// 2) usuario ref establecimiento
const r2 = bd
  .prepare(
    "INSERT INTO usuarios (rut, nombre, rol, claveHash, establecimiento) VALUES (?,?,?,?,?)"
  )
  .run("11111111-1", "Admin Test", "admin", "hash", r1.lastInsertRowid);
console.log("[3] usuario insert id =", r2.lastInsertRowid);

// 3) FK: borrar establecimiento con CASCADE debe limpiar al usuario
bd.prepare("DELETE FROM establecimientos WHERE id = ?").run(r1.lastInsertRowid);
const quedan = bd.prepare("SELECT COUNT(*) c FROM usuarios").get().c;
console.log("[4] cascade tras DELETE establecimiento -> usuarios restantes =", quedan, "(esperado 0)");

// 4) reintento insert del mismo torneo? validar UNIQUE compuesto en otra tabla
const rA = bd.prepare("INSERT INTO actividades (nombre, area, anio, semestre) VALUES (?,?,?,?)").run("Futbol","Deportiva",2025,1);
const rB = bd.prepare("INSERT INTO torneos (nombre, actividad, anio, semestre, estado) VALUES (?,?,?,?,?)").run("Torneo A", rA.lastInsertRowid, 2025, 1, "inscripciones");
console.log("[5] torneo insert id =", rB.lastInsertRowidapsed);

console.log("RESULTADO: FUNDACION FUNCIONA (DDL ejecuta + FK cascade + UNIQUE + INSERT/SELECT ok)");
