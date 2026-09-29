// Helpers SQLite compartidos por repositorios:
//  - nowISO(): timestamp ISO actual (compatible con los que antes daba Mongoose).
//  - filasAJson(columna, valor): serializa subdocumentos/arrays que viven como JSON.
//  - jsonAObj(enteroCol, ...): parsea segun el campo (para respuestas API).
//  - filaDe(stmt, params): una fila o null.
const JSON_CAMPOS = {
  actividades: ["categorias", "divisiones", "recintos"],
  torneos: ["grupos", "formulario", "requisitos"],
};

function nowISO() {
  return new Date().toISOString();
}

// better-sqlite3 no acepta Date como bind: normaliza a texto ISO (o null).
function fechaISO(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function codificarJson(valor, fallback = null) {
  if (valor === undefined || valor === null) return fallback;
  if (typeof valor === "string") {
    try {
      JSON.parse(valor);
      return valor;
    } catch {
      return JSON.stringify(valor);
    }
  }
  return JSON.stringify(valor);
}

function descodificarJson(texto, fallback = null) {
  if (texto === undefined || texto === null) return fallback;
  try {
    return JSON.parse(texto);
  } catch {
    return fallback;
  }
}

// Convierte una fila con campos JSON en cadena a un objeto API "aplanado"
// como los que antes devolvía .lean() (cada _id -> id numerico).
function aplanar(tabla, fila) {
  if (!fila) return null;
  const copia = { ...fila };
  for (const campo of JSON_CAMPOS[tabla] || []) {
    if (copia[campo] !== undefined && typeof copia[campo] === "string") {
      copia[campo] = descodificarJson(copia[campo], copia[campo]);
    }
  }
  return copia;
}

// Prepara una sentencia reutilizable (cache por SQL).
const cacheStmts = new Map();

function preparar(bd, sql) {
  if (!cacheStmts.has(sql)) {
    cacheStmts.set(sql, bd.prepare(sql));
  }
  return cacheStmts.get(sql);
}

module.exports = {
  nowISO,
  fechaISO,
  codificarJson,
  descodificarJson,
  aplanar,
  preparar,
};
