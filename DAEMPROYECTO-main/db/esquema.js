
const { obtenerConexion } = require("./conexion");

// auxiliar: crea la tabla si no existe (idempotente).
function tabla(ddl) {
  return ddl
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}


const CREAR_TABLAS = [
  // ---------- Establecimiento ----------
  `CREATE TABLE IF NOT EXISTS establecimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    dependencia TEXT NOT NULL DEFAULT 'Municipal'
      CHECK (dependencia IN ('Municipal','Particular Subvencionado','Particular Pagado')),
    direccion TEXT NOT NULL DEFAULT '',
    contacto TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ---------- Seccion ----------
  `CREATE TABLE IF NOT EXISTS secciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    area TEXT NOT NULL DEFAULT 'Deportiva'
      CHECK (area IN ('Deportiva','Artístico/Cultural')),
    anio INTEGER NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_secciones_nombre_anio ON secciones (nombre, anio)`,

  // ---------- Actividad ----------
  `CREATE TABLE IF NOT EXISTS actividades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    area TEXT NOT NULL DEFAULT 'Deportiva'
      CHECK (area IN ('Deportiva','Artístico/Cultural')),
    seccion INTEGER DEFAULT NULL REFERENCES secciones (id) ON DELETE SET NULL,
    categorias TEXT NOT NULL DEFAULT '[]',   -- JSON: [{nombre, subcategorias:[..]}]
    divisiones TEXT NOT NULL DEFAULT '[]',   -- JSON: [String]
    anio INTEGER NOT NULL,
    semestre INTEGER NOT NULL DEFAULT 1 CHECK (semestre IN (1,2)),
    estado TEXT NOT NULL DEFAULT 'publicada'
      CHECK (estado IN ('publicada','en_inscripcion','cerrada')),
    fechaAperturaInscripcion TEXT DEFAULT NULL,
    fechaCierreInscripcion TEXT DEFAULT NULL,
    edadMinima INTEGER DEFAULT NULL,
    edadMaxima INTEGER DEFAULT NULL,
    recintos TEXT NOT NULL DEFAULT '[]',      -- JSON: [String]
    limiteInscritos INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_actividades_nombre_area_anio_seccion
    ON actividades (nombre, area, anio, seccion)`,

  // ---------- Encuentro (antes subdocumento embebido de Actividad) ----------
  `CREATE TABLE IF NOT EXISTS encuentros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actividad INTEGER NOT NULL REFERENCES actividades (id) ON DELETE CASCADE,
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL DEFAULT '',
    lugar TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_encuentros_actividad ON encuentros (actividad)`,

  // ---------- Usuario ----------
  `CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rut TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    telefono TEXT NOT NULL DEFAULT '',
    rol TEXT NOT NULL DEFAULT 'coordinador'
      CHECK (rol IN ('admin','coordinador','lector')),
    claveHash TEXT NOT NULL,
    establecimiento INTEGER DEFAULT NULL REFERENCES establecimientos (id) ON DELETE SET NULL,
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_usuarios_establecimiento ON usuarios (establecimiento)`,

  // usuario <-> actividades (era array en el usuario)
  `CREATE TABLE IF NOT EXISTS usuario_actividades (
    usuario INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    actividad INTEGER NOT NULL REFERENCES actividades (id) ON DELETE CASCADE,
    PRIMARY KEY (usuario, actividad)
  )`,

  // ---------- Alumno ----------
  `CREATE TABLE IF NOT EXISTS alumnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rut TEXT NOT NULL,
    nombre TEXT NOT NULL,
    genero TEXT NOT NULL CHECK (genero IN ('M','F','Otro')),
    fechaNacimiento TEXT NOT NULL,
    apoderado TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    telefono TEXT NOT NULL DEFAULT '',
    establecimiento INTEGER NOT NULL REFERENCES establecimientos (id) ON DELETE CASCADE,
    actividad INTEGER NOT NULL REFERENCES actividades (id) ON DELETE CASCADE,
    division TEXT NOT NULL DEFAULT '',
    inscripcion INTEGER DEFAULT NULL REFERENCES inscripciones (id) ON DELETE SET NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_alumnos_rut_actividad ON alumnos (rut, actividad)`,
  `CREATE INDEX IF NOT EXISTS idx_alumnos_establecimiento ON alumnos (establecimiento)`,

  // alumno <-> torneo (era array torneos en el alumno; soporta $pull/$in)
  `CREATE TABLE IF NOT EXISTS alumno_torneos (
    alumno INTEGER NOT NULL REFERENCES alumnos (id) ON DELETE CASCADE,
    torneo INTEGER NOT NULL REFERENCES torneos (id) ON DELETE CASCADE,
    PRIMARY KEY (alumno, torneo)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_alumno_torneos_torneo ON alumno_torneos (torneo)`,

  // Asistencia (era subdocumento de Alumno)
  `CREATE TABLE IF NOT EXISTS asistencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alumno INTEGER NOT NULL REFERENCES alumnos (id) ON DELETE CASCADE,
    encuentro INTEGER NOT NULL REFERENCES encuentros (id) ON DELETE CASCADE,
    presente INTEGER NOT NULL DEFAULT 1 CHECK (presente IN (0,1)),
    UNIQUE (alumno, encuentro)
  )`,

  // ---------- Torneo ----------
  `CREATE TABLE IF NOT EXISTS torneos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    actividad INTEGER NOT NULL REFERENCES actividades (id) ON DELETE CASCADE,
    division TEXT NOT NULL DEFAULT '',
    formato TEXT NOT NULL DEFAULT 'amistoso' CHECK (formato IN ('amistoso','competitivo')),
    anio INTEGER NOT NULL,
    semestre INTEGER NOT NULL CHECK (semestre IN (1,2)),
    estado TEXT NOT NULL DEFAULT 'inscripciones'
      CHECK (estado IN ('inscripciones','activo','en_curso','pausado','postergado','cancelado','suspendido','finalizado')),
    estadoPrevio TEXT NOT NULL DEFAULT '',
    grupos TEXT NOT NULL DEFAULT '[]',          -- JSON [String]
    formulario TEXT NOT NULL DEFAULT '{}',      -- JSON Mixed
    requisitos TEXT NOT NULL DEFAULT '{}',      -- JSON {activo,edadMinima,edadMaxima,genero}
    fechaAperturaInscripcion TEXT DEFAULT NULL,
    fechaCierreInscripcion TEXT DEFAULT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_torneos_actividad ON torneos (actividad)`,

  // ---------- Inscripcion ----------
  `CREATE TABLE IF NOT EXISTS inscripciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    establecimiento INTEGER NOT NULL REFERENCES establecimientos (id) ON DELETE CASCADE,
    actividad INTEGER NOT NULL REFERENCES actividades (id) ON DELETE CASCADE,
    division TEXT NOT NULL DEFAULT '',
    estado TEXT NOT NULL DEFAULT 'en_proceso'
      CHECK (estado IN ('en_proceso','aceptada','rechazada')),
    rutCoordinador TEXT NOT NULL DEFAULT '',
    torneo INTEGER DEFAULT NULL REFERENCES torneos (id) ON DELETE SET NULL,
    grupo TEXT NOT NULL DEFAULT '',
    detalle TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (establecimiento, actividad, division)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_inscripciones_torneo ON inscripciones (torneo)`,

  // inscripcion <-> alumno (alumnos[] de la inscripcion)
  `CREATE TABLE IF NOT EXISTS inscripcion_alumnos (
    inscripcion INTEGER NOT NULL REFERENCES inscripciones (id) ON DELETE CASCADE,
    alumno INTEGER NOT NULL REFERENCES alumnos (id) ON DELETE CASCADE,
    PRIMARY KEY (inscripcion, alumno)
  )`,

  // ---------- Equipo ----------
  `CREATE TABLE IF NOT EXISTS equipos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    torneo INTEGER NOT NULL REFERENCES torneos (id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_equipos_torneo ON equipos (torneo)`,

  // equipo <-> alumno (alumnos[] del equipo)
  `CREATE TABLE IF NOT EXISTS equipo_alumnos (
    equipo INTEGER NOT NULL REFERENCES equipos (id) ON DELETE CASCADE,
    alumno INTEGER NOT NULL REFERENCES alumnos (id) ON DELETE CASCADE,
    PRIMARY KEY (equipo, alumno)
  )`,

  // ---------- Llave ----------
  `CREATE TABLE IF NOT EXISTS llaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    torneo INTEGER NOT NULL REFERENCES torneos (id) ON DELETE CASCADE,
    actividad INTEGER DEFAULT NULL REFERENCES actividades (id) ON DELETE SET NULL,
    division TEXT NOT NULL DEFAULT '',
    grupo TEXT NOT NULL DEFAULT 'Llave',
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','jugado')),
    fecha TEXT DEFAULT NULL,
    hora TEXT NOT NULL DEFAULT '',
    horaTermino TEXT NOT NULL DEFAULT '',
    lugar TEXT NOT NULL DEFAULT 'Por definir',
    puntajeA INTEGER DEFAULT NULL,
    puntajeB INTEGER DEFAULT NULL,
    ganador INTEGER DEFAULT NULL REFERENCES equipos (id) ON DELETE SET NULL,
    posicion TEXT NOT NULL DEFAULT '',
    nivel INTEGER NOT NULL DEFAULT 1,
    orden INTEGER NOT NULL DEFAULT 0,
    padre INTEGER DEFAULT NULL REFERENCES llaves (id) ON DELETE SET NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_llaves_torneo ON llaves (torneo)`,
  `CREATE INDEX IF NOT EXISTS idx_llaves_padre ON llaves (padre)`,

  // llave <-> equipo (equipos[])
  `CREATE TABLE IF NOT EXISTS llave_equipos (
    llave INTEGER NOT NULL REFERENCES llaves (id) ON DELETE CASCADE,
    equipo INTEGER NOT NULL REFERENCES equipos (id) ON DELETE CASCADE,
    PRIMARY KEY (llave, equipo)
  )`,

  // llave -> hijos (hijos[])
  `CREATE TABLE IF NOT EXISTS llave_hijos (
    llave INTEGER NOT NULL REFERENCES llaves (id) ON DELETE CASCADE,
    hijo INTEGER NOT NULL REFERENCES llaves (id) ON DELETE CASCADE,
    PRIMARY KEY (llave, hijo)
  )`,

  // ---------- Posicion ----------
  `CREATE TABLE IF NOT EXISTS posiciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    torneo INTEGER NOT NULL REFERENCES torneos (id) ON DELETE CASCADE,
    establecimiento INTEGER NOT NULL REFERENCES establecimientos (id) ON DELETE CASCADE,
    posicion TEXT NOT NULL CHECK (posicion IN ('1','2','3')),
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (torneo, establecimiento, posicion)
  )`,

  // ---------- Valoracion ----------
  `CREATE TABLE IF NOT EXISTS valoraciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    establecimiento INTEGER NOT NULL REFERENCES establecimientos (id) ON DELETE CASCADE,
    actividad INTEGER NOT NULL REFERENCES actividades (id) ON DELETE CASCADE,
    estado TEXT NOT NULL CHECK (estado IN ('cumple','regular','no_cumple')),
    anio INTEGER NOT NULL,
    semestre INTEGER NOT NULL CHECK (semestre IN (1,2)),
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (establecimiento, actividad, anio, semestre)
  )`,

  // ---------- Solicitud ----------
  `CREATE TABLE IF NOT EXISTS solicitudes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK (tipo IN ('recursos','participacion','otro')),
    detalle TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'en_proceso'
      CHECK (estado IN ('en_proceso','aprobada','rechazada')),
    rutSolicitante TEXT NOT NULL,
    rutCoordinador TEXT NOT NULL DEFAULT '',
    actividad INTEGER DEFAULT NULL REFERENCES actividades (id) ON DELETE SET NULL,
    establecimiento INTEGER DEFAULT NULL REFERENCES establecimientos (id) ON DELETE SET NULL,
    respuesta TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ---------- Notificacion ----------
  `CREATE TABLE IF NOT EXISTS notificaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    destinatario INTEGER DEFAULT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    tipo TEXT NOT NULL DEFAULT 'general'
      CHECK (tipo IN ('requisitos','apertura','suspension','reactivacion','eliminacion','general')),
    torneo INTEGER DEFAULT NULL REFERENCES torneos (id) ON DELETE CASCADE,
    mensaje TEXT NOT NULL,
    leida INTEGER NOT NULL DEFAULT 0 CHECK (leida IN (0,1)),
    refNombre TEXT NOT NULL DEFAULT '',
    fechaCreacion TEXT NOT NULL DEFAULT (datetime('now')),
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notificaciones_destinatario ON notificaciones (destinatario)`,
];

function crearEsquema() {
  const bd = obtenerConexion();
  bd.exec("BEGIN");
  try {
    for (const ddl of CREAR_TABLAS) {
      bd.exec(tabla(ddl));
    }
    bd.exec("COMMIT");
  } catch (err) {
    bd.exec("ROLLBACK");
    throw err;
  }
  return bd;
}

module.exports = { crearEsquema, CREAR_TABLAS };
