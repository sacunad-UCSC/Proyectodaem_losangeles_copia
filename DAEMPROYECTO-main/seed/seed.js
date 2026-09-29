require("dotenv").config();
const bcrypt = require("bcryptjs");
const { initDatabase } = require("../config/database");
const { obtenerConexion } = require("../db/conexion");

const Sorteo = require("../domain/Sorteo");
const EstablecimientoRepository = require("../repositories/EstablecimientoRepository");
const UsuarioRepository = require("../repositories/UsuarioRepository");
const SeccionRepository = require("../repositories/SeccionRepository");
const ActividadRepository = require("../repositories/ActividadRepository");
const TorneoRepository = require("../repositories/TorneoRepository");
const InscripcionRepository = require("../repositories/InscripcionRepository");
const AlumnoRepository = require("../repositories/AlumnoRepository");
const EquipoRepository = require("../repositories/EquipoRepository");
const LlaveRepository = require("../repositories/LlaveRepository");
const ValoracionRepository = require("../repositories/ValoracionRepository");

const ROLES_ADMIN = { rut: process.env.SEED_ADMIN_RUT, clave: process.env.SEED_ADMIN_CLAVE, nombre: "Directora DAEM" };

const COLEGIOS = [
  { codigo: "A-59", nombre: "Escuela Basica Los Aromos", dependencia: "Municipal" },
  { codigo: "B-112", nombre: "Liceo San Gabriel", dependencia: "Particular Subvencionado" },
  { codigo: "C-204", nombre: "Colegio Amanecer de La Serena", dependencia: "Particular Subvencionado" },
  { codigo: "D-868", nombre: "Escuela Diferencial Aurora", dependencia: "Municipal" },
];

const COORDINADORES = [
  { rut: "22222222-2", nombre: "Pedro Gonzalez", email: "pedro@a59.cl", colegio: "A-59" },
  { rut: "33333333-3", nombre: "Maria Fuentes", email: "maria@b112.cl", colegio: "B-112" },
  { rut: "44444444-4", nombre: "Jorge Rojas", email: "jorge@c204.cl", colegio: "C-204" },
  { rut: "55555555-5", nombre: "Carolina Diaz", email: "carolina@d868.cl", colegio: "D-868" },
];

// Perfiles lector (directores de un solo establecimiento), con acceso a la
// nomina de estudiantes de su propio colegio.
const LECTORES = [
  { rut: "88888888-8", nombre: "Director Escuela Basica Los Aromos", email: "direccion@a59.cl", colegio: "A-59" },
  { rut: "99999999-9", nombre: "Director Liceo San Gabriel", email: "direccion@b112.cl", colegio: "B-112" },
  { rut: "10101010-4", nombre: "Director Colegio Amanecer de La Serena", email: "direccion@c204.cl", colegio: "C-204" },
  { rut: "77777777-7", nombre: "Director Escuela Diferencial Aurora", email: "direccion@d868.cl", colegio: "D-868" },
];

// Nombres para generar la nomina de estudiantes de cada establecimiento.
const NOMBRES_M = [
  "Matias", "Benjamin", "Vicente", "Martin", "Joaquin", "Tomas", "Agustin",
  "Cristobal", "Sebastian", "Diego", "Lucas", "Felipe", "Ignacio", "Nicolas",
  "Alejandro", "Gabriel", "Rodrigo", "Alvaro", "Mauricio", "Cristian",
  "Hector", "Patricio", "Gonzalo", "Andres",
];
const NOMBRES_F = [
  "Sofia", "Isidora", "Emilia", "Florencia", "Antonia", "Josefa", "Catalina",
  "Fernanda", "Constanza", "Martina", "Amanda", "Trinidad", "Maite", "Paz",
  "Javiera", "Camila", "Valentina", "Ignacia", "Renata", "Colomba",
  "Magdalena", "Rocio", "Daniela", "Francisca",
];
const APELLIDOS = [
  "Gonzalez", "Munoz", "Rojas", "Diaz", "Perez", "Soto", "Contreras", "Silva",
  "Martinez", "Sepulveda", "Morales", "Rodriguez", "Lopez", "Fuentes",
  "Hernandez", "Torres", "Araya", "Flores", "Espinoza", "Valenzuela",
  "Castillo", "Ramirez", "Reyes", "Cortes",
];

// Cupos (actividad + division) donde se reparte la nomina de cada colegio.
const CUPOS_ESTUDIANTES = [
  { act: "JDM_Futsal", division: "SUB 13" },
  { act: "JDM_Basquetbol", division: "SUB 13" },
  { act: "JDM_Basquetbol", division: "JUVENIL" },
  { act: "JDM_Voleibol", division: "SUB 13" },
  { act: "JDM_Voleibol", division: "JUVENIL" },
  { act: "JDM_Balonmano", division: "SUB 13" },
  { act: "JDM_Balonmano", division: "JUVENIL" },
  { act: "JDM_Ajedrez", division: "SUB 13" },
  { act: "JDM_Ajedrez", division: "JUVENIL" },
  { act: "JDM_Atletismo", division: "SUB 13" },
  { act: "JDM_Atletismo", division: "JUVENIL" },
  { act: "JDE_Futsal", division: "SUB 14" },
  { act: "JDE_Basquetbol", division: "SUB 14" },
  { act: "JDE_Basquetbol", division: "JUVENIL" },
  { act: "JDE_Ajedrez", division: "SUB 14" },
];

// Rango de anios de nacimiento validos por division (coincide con catalogos).
const RANGO_NACIMIENTO = {
  "SUB 13": [2013, 2015],
  "SUB 14": [2012, 2014],
  JUVENIL: [2009, 2012],
};

const ESTUDIANTES_POR_COLEGIO = 20;
let rutContador = 30000000;

// Genera un RUT correlativo con digito verificador valido.
function nuevoRut() {
  rutContador += 1;
  const cuerpo = String(rutContador);
  const invertido = cuerpo.split("").reverse().join("");
  let suma = 0;
  let factor = 2;
  for (const d of invertido) {
    suma += Number(d) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  const dv = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
  return `${cuerpo}-${dv}`;
}

function anioNacimientoDe(division, semilla) {
  const [desde, hasta] = RANGO_NACIMIENTO[division] || [2010, 2014];
  return desde + (semilla % (hasta - desde + 1));
}

// Categorias del listado "Creacion de Actividades Extraescolares".
// Seccion -> Actividad (disciplina) -> Categoria -> Subcategoria.
const DC = (nombre, subcategorias = []) => ({ nombre, subcategorias });
const DV = ["Damas", "Varones"];

const SECCIONES = [
  { clave: "JDM", nombre: "Juegos Deportivos Municipales de la Educación Pública", area: "Deportiva" },
  { clave: "JDE", nombre: "Juegos Deportivos Escolares (JDE) Intercursos", area: "Deportiva" },
  { clave: "ENCMINI", nombre: "Encuentros Mini", area: "Deportiva" },
  { clave: "DIAESP", nombre: "Días Especiales", area: "Deportiva" },
  { clave: "ARTISTICO", nombre: "Artístico Cultural", area: "Artístico/Cultural" },
  { clave: "MUESTRAS", nombre: "Muestras Culturales", area: "Artístico/Cultural" },
];

// Disciplinas segun el listado (Juegos Deportivos Municipales de la
// Educacion Publica): los torneos municipales se despliegan por categoria.
const ACTIVIDADES_JDM = [
  "Futsal", "Basquetbol", "Voleibol", "Balonmano",
  "Tenis de mesa", "Ajedrez", "Atletismo",
];

// En JUVENIL el listado no incluye Futsal (solo SUB 13).
const ACTIVIDADES_JDM_JUVENIL = [
  "Basquetbol", "Voleibol", "Balonmano",
  "Tenis de mesa", "Ajedrez", "Atletismo",
];

// JDE Intercursos: SUB 14 y JUVENIL. Futsal solo en SUB 14.
const ACTIVIDADES_JDE = [
  "Futsal", "Basquetbol", "Voleibol", "Balonmano", "Tenis de mesa",
  "Ajedrez", "Atletismo", "Para atletismo", "Ciclismo", "Judo", "Natación",
];
const ACTIVIDADES_JDE_JUVENIL = [
  "Basquetbol", "Voleibol", "Balonmano", "Tenis de mesa",
  "Ajedrez", "Atletismo", "Para atletismo", "Ciclismo", "Judo", "Natación",
];

const ACTIVIDADES_ARTISTICAS = [
  { nombre: "Cueca", categorias: ["Huasa E. Basica", "Huasa E. Media", "Lugareña E. Basica", "Lugareña E. Media"].map((c) => DC(c)) },
  { nombre: "Dibujo y pintura", categorias: ["NT1 y NT2", "1° a 2° Básico", "3° a 4° Básico", "5° a 6° Básico", "7° a 8° Básico", "1° a 4° Medio"].map((c) => DC(c)) },
  { nombre: "Declamación", categorias: ["NT1 y NT2", "1° a 4° Básico", "5° a 8° Básico", "1° a 4° Medio"].map((c) => DC(c)) },
  { nombre: "Festival de la voz", categorias: ["1° a 4° Básico", "5° a 8° Básico", "1° a 4° Medio", "Docentes/Asistentes de la educación"].map((c) => DC(c)) },
  { nombre: "Team de baile", categorias: ["1° Ciclo Básica", "2° Ciclo Básica", "Enseñanza Media"].map((c) => DC(c)) },
];

const ACTIVIDADES_MUESTRAS = [
  "Muestra de Danzas Folclóricas", "Muestra de conjuntos folclóricos",
  "Pañuelos al viento", "Teatro",
];

const ACTIVIDADES_MINI = [
  "Mini Basquetbol", "Mini Voleibol", "Mini Balonmano", "Mini Futsal",
  "Mini Tenis de mesa", "Mini Atletismo", "Mini Ajedrez",
];

// Filtro de division solamente para valoraciones de ejemplo (Futsal/Ajedrez JDM).
const VALORACIONES = [
  { colegio: "A-59", actividad: "JDM_Futsal", estado: "cumple" },
  { colegio: "B-112", actividad: "JDM_Futsal", estado: "regular" },
  { colegio: "C-204", actividad: "JDM_Futsal", estado: "no_cumple" },
  { colegio: "D-868", actividad: "JDM_Futsal", estado: "regular" },
  { colegio: "C-204", actividad: "JDM_Ajedrez", estado: "no_cumple" },
  { colegio: "A-59", actividad: "JDM_Ajedrez", estado: "cumple" },
];

// Conteo directo sobre la base SQLite.
function contarTabla(tabla, donde = {}) {
  const bd = obtenerConexion();
  const claves = Object.keys(donde);
  const where = claves.length ? `WHERE ${claves.map((k) => `${k} = ?`).join(" AND ")}` : "";
  const fila = bd.prepare(`SELECT COUNT(*) AS total FROM ${tabla} ${where}`).get(...Object.values(donde));
  return fila.total;
}

function existenDocumentos(tabla, donde = {}) {
  return contarTabla(tabla, donde) > 0;
}

async function ejecutarSeed() {
  const bd = obtenerConexion();
  const estRepo = new EstablecimientoRepository();
  const usuRepo = new UsuarioRepository();
  const secRepo = new SeccionRepository();
  const actRepo = new ActividadRepository();
  const torRepo = new TorneoRepository();
  const inscRepo = new InscripcionRepository();
  const alumRepo = new AlumnoRepository();
  const eqRepo = new EquipoRepository();
  const llaveRepo = new LlaveRepository();
  const valRepo = new ValoracionRepository();

  const anio = 2026;
  const semestre = 1;

  const hashClave = (clave) => bcrypt.hashSync(clave, 10);

  // Divisiones derivadas de las categorias (misma regla que la clase Actividad).
  function divisionesDeCategorias(categorias) {
    const norm = (Array.isArray(categorias) ? categorias : [])
      .filter((c) => c && String(c.nombre || "").trim());
    return [...new Set(norm.map((c) => c.nombre))];
  }

  // Agrega un alumno a una inscripcion: crea el estudiante y lo vincula.
  function agregarAlumnoAInscripcion(inscripcionId, datos) {
    const insc = inscRepo.obtenerPorId(inscripcionId);
    if (!insc) throw new Error("Inscripcion no encontrada");
    const alumno = alumRepo.crear({
      rut: datos.rut,
      nombre: datos.nombre,
      genero: datos.genero,
      fechaNacimiento: datos.fechaNacimiento,
      apoderado: datos.apoderado || "",
      email: datos.email || "",
      telefono: datos.telefono || "",
      establecimiento: insc.establecimiento.id,
      actividad: insc.actividad.id,
      division: insc.division,
      inscripcion: insc.id,
    });
    const actual = inscRepo.obtenerPorId(insc.id);
    const actuales = (actual.alumnos || []).map((a) => a.id ?? a._id);
    if (!actuales.includes(alumno.id ?? alumno._id)) {
      inscRepo.actualizar(insc.id, { alumnos: [...actuales, alumno.id ?? alumno._id] });
    }
    return alumno;
  }

  // 1) Admin DAEM
  if (!existenDocumentos("usuarios")) {
    usuRepo.crear({
      rut: ROLES_ADMIN.rut,
      nombre: ROLES_ADMIN.nombre,
      email: "admin@daem.local",
      rol: "admin",
      claveHash: hashClave(ROLES_ADMIN.clave),
      establecimiento: null,
    });
    console.log("[SEED] Admin DAEM creado:", ROLES_ADMIN.rut);
  }

  // 2) Establecimientos
  const idsColegios = {};
  if (estRepo.contar() === 0) {
    for (const c of COLEGIOS) {
      const creado = estRepo.crear({ codigo: c.codigo, nombre: c.nombre, dependencia: c.dependencia });
      idsColegios[c.codigo] = creado.id;
      console.log("[SEED] Establecimiento:", c.codigo, "-", c.nombre);
    }
  } else {
    for (const c of COLEGIOS) {
      idsColegios[c.codigo] = estRepo.obtenerPorCodigo(c.codigo).id;
    }
  }

  // 3) Coordinadores por establecimiento
  if (!existenDocumentos("usuarios", { rol: "coordinador" })) {
    for (const coord of COORDINADORES) {
      usuRepo.crear({
        rut: coord.rut,
        nombre: coord.nombre,
        email: coord.email,
        rol: "coordinador",
        claveHash: hashClave("coord123"),
        establecimiento: idsColegios[coord.colegio],
      });
      console.log("[SEED] Coordinador:", coord.nombre, "->", coord.colegio);
    }
  }

  // 3b) Secciones (eventos que agrupan actividades)
  const idsSecciones = {};
  if (!existenDocumentos("secciones")) {
    for (const s of SECCIONES) {
      const creada = secRepo.crear({ nombre: s.nombre, area: s.area, anio });
      idsSecciones[s.clave] = creada.id;
      console.log("[SEED] Seccion:", s.nombre, "(" + s.area + ")");
    }
  } else {
    for (const s of SECCIONES) {
      const doc = secRepo.obtenerTodos({ nombre: s.nombre })[0];
      idsSecciones[s.clave] = doc ? doc.id : null;
    }
  }

  // 4) Actividades (listado extraescolar jerarquico, todas con seccion)
  const idsActividades = {};

  function crearActividadSiNoExiste(a) {
    const filtro = { nombre: a.nombre, area: a.area, anio };
    if (a.seccion) filtro.seccion = a.seccion;
    const existente = actRepo.obtenerTodos(filtro)[0];
    if (existente) return existente.id;
    const creada = actRepo.crear({
      ...a,
      anio,
      estado: "en_inscripcion",
      divisiones: Array.isArray(a.categorias) ? divisionesDeCategorias(a.categorias) : [],
    });
    console.log("[SEED] Actividad:", a.nombre, "(" + a.area + ")" + (a.seccion ? " [seccion]" : ""));
    return creada.id;
  }

  function sembrarActividades() {
    const categoriasCon = (cats) =>
      cats.map((c) => (typeof c === "string" ? { nombre: c, subcategorias: [] } : c));

    // Juegos Deportivos Municipales: SUB 13 (Damas/Varones) y JUVENIL.
    for (const disciplina of ACTIVIDADES_JDM) {
      const categorias = [DC("SUB 13", DV)];
      if (ACTIVIDADES_JDM_JUVENIL.includes(disciplina)) categorias.push(DC("JUVENIL", DV));
      crearActividadSiNoExiste({
        clave: disciplina,
        nombre: disciplina,
        area: "Deportiva",
        seccion: idsSecciones.JDM,
        categorias,
      });
    }

    // JDE Intercursos: SUB 14 (Damas/Varones) y JUVENIL.
    for (const disciplina of ACTIVIDADES_JDE) {
      const categorias = [DC("SUB 14", DV)];
      if (ACTIVIDADES_JDE_JUVENIL.includes(disciplina)) categorias.push(DC("JUVENIL", DV));
      crearActividadSiNoExiste({
        clave: disciplina,
        nombre: disciplina,
        area: "Deportiva",
        seccion: idsSecciones.JDE,
        categorias,
      });
    }

    // Encuentros Mini: disciplinas mini (sin categorias fijas).
    for (const disciplina of ACTIVIDADES_MINI) {
      crearActividadSiNoExiste({
        clave: disciplina,
        nombre: disciplina,
        area: "Deportiva",
        seccion: idsSecciones.ENCMINI,
        categorias: [],
      });
    }

    // Dias Especiales (no competitivos): sin categorias.
    for (const nombre of ["Día de la Actividad Física", "Día del Extraescolar"]) {
      crearActividadSiNoExiste({
        clave: nombre,
        nombre,
        area: "Deportiva",
        seccion: idsSecciones.DIAESP,
        categorias: [],
      });
    }

    // Artistico Cultural: actividades con categorias libres.
    for (const a of ACTIVIDADES_ARTISTICAS) {
      crearActividadSiNoExiste({
        clave: a.nombre,
        nombre: a.nombre,
        area: "Artístico/Cultural",
        seccion: idsSecciones.ARTISTICO,
        categorias: categoriasCon(a.categorias),
      });
    }

    // Muestras Culturales: actividades con Enseñanza Basica / Media.
    for (const nombre of ACTIVIDADES_MUESTRAS) {
      crearActividadSiNoExiste({
        clave: nombre,
        nombre,
        area: "Artístico/Cultural",
        seccion: idsSecciones.MUESTRAS,
        categorias: [DC("Enseñanza Básica"), DC("Enseñanza Media")],
      });
    }
  }

  if (!existenDocumentos("actividades")) {
    sembrarActividades();
  }

  // Reconstruye el mapa de ids para los bloques posteriores (torneo, etc),
  // tanto si las actividades se crearon recien como si ya existian.
  const existentes = actRepo.obtenerTodos({ anio });
  const JDM_SIN_SUFFIX = ACTIVIDADES_JDM.concat(ACTIVIDADES_JDM_JUVENIL);
  const JDE_SIN_SUFFIX = ACTIVIDADES_JDE.concat(ACTIVIDADES_JDE_JUVENIL);
  const deClave = (lista, prefijo) => {
    for (const nombre of lista) {
      const doc = existentes.find((a) => a.nombre === nombre && a.area === "Deportiva");
      if (doc) {
        if (!idsActividades[`${prefijo}_${nombre}`]) idsActividades[`${prefijo}_${nombre}`] = doc.id;
      }
    }
  };
  deClave(JDM_SIN_SUFFIX, "JDM");
  deClave(JDE_SIN_SUFFIX, "JDE");
  for (const nombre of ACTIVIDADES_MINI) {
    const doc = existentes.find((a) => a.nombre === nombre);
    if (doc && !idsActividades[`JDM_${nombre}`]) idsActividades[`JDM_${nombre}`] = doc.id;
  }

  // 5) Lectores (directores): uno por establecimiento, cada uno ligado a su
  // colegio y con acceso solo a la nomina de ese establecimiento.
  for (const d of LECTORES) {
    if (usuRepo.obtenerPorRut(d.rut)) continue;
    usuRepo.crear({
      rut: d.rut,
      nombre: d.nombre,
      email: d.email,
      rol: "lector",
      claveHash: hashClave("director123"),
      establecimiento: idsColegios[d.colegio],
    });
    console.log("[SEED] Lector (director):", d.nombre, "->", d.colegio);
  }

  // 6) Torneo de Futsal JDM (una categoria especifica de la actividad)
  const NOMBRE_TORNEO = "Torneo Comunal de Futsal SUB 13 2026";
  const filaTorneo = bd.prepare(`SELECT id FROM torneos WHERE nombre = ?`).get(NOMBRE_TORNEO);
  let torneo = filaTorneo ? torRepo.obtenerPorId(filaTorneo.id) : null;
  if (!torneo) {
    torneo = torRepo.crear({
      nombre: NOMBRE_TORNEO,
      actividad: idsActividades.JDM_Futsal,
      division: "SUB 13",
      anio,
      semestre,
      estado: "inscripciones",
      grupos: ["Llave"],
      formulario: { permitePostulaciones: true, fechaToPe: new Date("2026-03-30").toISOString() },
      requisitos: { activo: false, edadMinima: null, edadMaxima: null, genero: "" },
      fechaAperturaInscripcion: new Date("2026-01-01").toISOString(),
      fechaCierreInscripcion: new Date("2027-12-31").toISOString(),
    });
    console.log("[SEED] Torneo:", torneo.nombre, "|", torneo.division);
  }

  // 7) Inscripciones de establecimientos al torneo (una aceptada, otra en proceso)
  const inscripciones = inscRepo.obtenerTodos({ torneo: torneo.id });
  if (inscripciones.length === 0) {
    const inscA = inscRepo.crear({
      establecimiento: idsColegios["A-59"],
      actividad: idsActividades.JDM_Futsal,
      division: "SUB 13",
    });
    inscRepo.actualizar(inscA.id, { torneo: torneo.id, grupo: "" });
    inscRepo.cambiarEstado(inscA.id, "aceptada");

    const inscB = inscRepo.crear({
      establecimiento: idsColegios["B-112"],
      actividad: idsActividades.JDM_Futsal,
      division: "SUB 13",
    });
    inscRepo.actualizar(inscB.id, { torneo: torneo.id, grupo: "" });
    inscRepo.cambiarEstado(inscB.id, "aceptada");

    // Alumnos de ejemplo en la inscripcion aceptada (validan categoria SUB 13).
    agregarAlumnoAInscripcion(inscA.id, {
      rut: "12121212-9",
      nombre: "Mateo Aguilera",
      genero: "M",
      fechaNacimiento: "2014-05-10",
      apoderado: "Luis Aguilera",
    });
    agregarAlumnoAInscripcion(inscA.id, {
      rut: "13131313-6",
      nombre: "Ignacia Rojas",
      genero: "F",
      fechaNacimiento: "2013-02-14",
      apoderado: "Paula Rojas",
    });

    // Alumnos para el resto de inscripciones del torneo: el pool de
    // estudiantes permite formar equipos mixtos (sorteo automatico).
    agregarAlumnoAInscripcion(inscB.id, {
      rut: "17171717-5",
      nombre: "Fernando Silva",
      genero: "M",
      fechaNacimiento: "2014-11-03",
      apoderado: "Rosa Silva",
    });
    agregarAlumnoAInscripcion(inscB.id, {
      rut: "18181818-2",
      nombre: "Camila Nunez",
      genero: "F",
      fechaNacimiento: "2013-06-21",
      apoderado: "Diego Nunez",
    });

    const inscB2 = inscRepo.crear({
      establecimiento: idsColegios["C-204"],
      actividad: idsActividades.JDM_Futsal,
      division: "SUB 13",
    });
    inscRepo.actualizar(inscB2.id, { torneo: torneo.id, grupo: "" });
    inscRepo.cambiarEstado(inscB2.id, "aceptada");
    agregarAlumnoAInscripcion(inscB2.id, {
      rut: "20202020-8",
      nombre: "Mateo Paredes",
      genero: "M",
      fechaNacimiento: "2014-04-12",
      apoderado: "Andrea Paredes",
    });

    const inscC = inscRepo.crear({
      establecimiento: idsColegios["D-868"],
      actividad: idsActividades.JDM_Futsal,
      division: "SUB 13",
    });
    inscRepo.actualizar(inscC.id, { torneo: torneo.id, grupo: "" });
    inscRepo.cambiarEstado(inscC.id, "aceptada");
    agregarAlumnoAInscripcion(inscC.id, {
      rut: "23232323-K",
      nombre: "Diego Fuentes",
      genero: "M",
      fechaNacimiento: "2013-09-19",
      apoderado: "Sara Fuentes",
    });

    // A-59 (coordinador Pedro Gonzalez) recibe inscripciones aceptadas en varias
    // categorias para que pueda agregar estudiantes a mas de una division.
    const inscA59Voleibol = inscRepo.crear({
      establecimiento: idsColegios["A-59"],
      actividad: idsActividades.JDM_Voleibol,
      division: "JUVENIL",
    });
    inscRepo.cambiarEstado(inscA59Voleibol.id, "aceptada");

    const inscA59Juvenil = inscRepo.crear({
      establecimiento: idsColegios["A-59"],
      actividad: idsActividades.JDM_Balonmano,
      division: "JUVENIL",
    });
    inscRepo.cambiarEstado(inscA59Juvenil.id, "aceptada");

    const inscA59Basquet = inscRepo.crear({
      establecimiento: idsColegios["A-59"],
      actividad: idsActividades.JDM_Basquetbol,
      division: "JUVENIL",
    });
    inscRepo.cambiarEstado(inscA59Basquet.id, "aceptada");

    // Ajedrez: inscripciones aceptadas con alumnos para el desglose por
    // categoria y el total de participantes del modulo Actividades.
    const inscAjeA = inscRepo.crear({
      establecimiento: idsColegios["A-59"],
      actividad: idsActividades.JDM_Ajedrez,
      division: "SUB 13",
    });
    inscRepo.cambiarEstado(inscAjeA.id, "aceptada");
    agregarAlumnoAInscripcion(inscAjeA.id, {
      rut: "14141414-3",
      nombre: "Emma Soto",
      genero: "F",
      fechaNacimiento: "2015-03-22",
      apoderado: "Claudia Soto",
    });
    agregarAlumnoAInscripcion(inscAjeA.id, {
      rut: "15151515-0",
      nombre: "Benjamin Cruz",
      genero: "M",
      fechaNacimiento: "2014-07-08",
      apoderado: "Rosa Cruz",
    });

    const inscAjeB = inscRepo.crear({
      establecimiento: idsColegios["C-204"],
      actividad: idsActividades.JDM_Ajedrez,
      division: "SUB 13",
    });
    inscRepo.cambiarEstado(inscAjeB.id, "aceptada");
    agregarAlumnoAInscripcion(inscAjeB.id, {
      rut: "16161616-8",
      nombre: "Valentina Pino",
      genero: "F",
      fechaNacimiento: "2015-09-30",
      apoderado: "Jorge Pino",
    });

    console.log("[SEED] Inscripciones y alumnos de ejemplo creados");
  }

  // 7a) Nomina ampliada: cada establecimiento queda con hasta 20 estudiantes
  // repartidos en varias actividades/divisiones validas. Los perfiles lector
  // acceden a esta nomina filtrada por su propio colegio.
  function obtenerOCrearInscripcionAceptada(estId, actId, division) {
    let ins = inscRepo.buscar(estId, actId, division);
    if (!ins) {
      ins = inscRepo.crear({ establecimiento: estId, actividad: actId, division });
    }
    if (ins.estado !== "aceptada") {
      ins = inscRepo.cambiarEstado(ins.id, "aceptada");
    }
    return ins.id;
  }

  for (const c of COLEGIOS) {
    const estId = idsColegios[c.codigo];
    let total = alumRepo.obtenerTodos({ establecimiento: estId }).length;
    let slot = 0;
    let intentos = 0;
    while (total < ESTUDIANTES_POR_COLEGIO && intentos < 300) {
      intentos += 1;
      const cupo = CUPOS_ESTUDIANTES[slot % CUPOS_ESTUDIANTES.length];
      slot += 1;
      const actId = idsActividades[cupo.act];
      if (!actId) continue;
      try {
        const inscId = obtenerOCrearInscripcionAceptada(estId, actId, cupo.division);
        const esM = total % 2 === 0;
        const nombres = esM ? NOMBRES_M : NOMBRES_F;
        const nombre = `${nombres[(total + slot) % nombres.length]} ${APELLIDOS[(total * 3 + slot) % APELLIDOS.length]}`;
        const anioNacimiento = anioNacimientoDe(cupo.division, total + slot);
        const mes = String(((total * 5 + slot) % 12) + 1).padStart(2, "0");
        const dia = String(((total * 7 + slot) % 27) + 1).padStart(2, "0");
        agregarAlumnoAInscripcion(inscId, {
          rut: nuevoRut(),
          nombre,
          genero: esM ? "M" : "F",
          fechaNacimiento: `${anioNacimiento}-${mes}-${dia}`,
          apoderado: `Apoderado ${APELLIDOS[(total + 5) % APELLIDOS.length]}`,
        });
        total += 1;
      } catch (e) {
        // Si un cupo falla, se continua con el siguiente sin cortar el seed.
        continue;
      }
    }
    console.log("[SEED] Nomina", c.codigo, "->", total, "estudiantes");
  }

  // 7b) Sorteo de ejemplo y fechas de encuentro (para la agenda de torneos)
  // Pool de estudiantes disponibles: los de inscripciones aceptadas del
  // torneo que aun no estan asignados a ningun equipo.
  function obtenerPool(torneoId) {
    const inscripciones = inscRepo.obtenerTodos({ torneo: torneoId, estado: "aceptada" });
    const directos = alumRepo.obtenerTodos({ torneos: [torneoId] });
    const asignados = eqRepo.obtenerPorTorneo(torneoId);
    const usados = new Set();
    asignados.forEach((eq) => (eq.alumnos || []).forEach((a) => usados.add(String(a.id ?? a._id ?? a))));
    const alumnos = [];
    const vistos = new Set();
    const agregar = (a) => {
      const id = String(a.id ?? a._id ?? a);
      if (vistos.has(id) || usados.has(id)) return;
      vistos.add(id);
      alumnos.push(a);
    };
    (directos || []).forEach(agregar);
    for (const insc of inscripciones) {
      (insc.alumnos || []).forEach(agregar);
    }
    return alumnos;
  }

  function sortearEquipos(torneoId, cantidad) {
    const pool = obtenerPool(torneoId);
    if (pool.length < 2) {
      throw new Error("Necesita al menos 2 estudiantes inscritos (sin equipo) para sortear equipos");
    }
    const n = Math.max(2, parseInt(cantidad, 10) || 2);
    if (n > pool.length) {
      throw new Error(`No puede crear ${n} equipos con solo ${pool.length} estudiantes`);
    }
    const base = pool.slice().sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));
    const grupos = Array.from({ length: n }, (_, i) => ({
      torneo: torneoId,
      nombre: `Equipo ${String.fromCharCode(65 + i)}`,
      alumnos: [],
    }));
    base.forEach((a, idx) => grupos[idx % n].alumnos.push(a.id ?? a._id ?? a));
    eqRepo.eliminarPorTorneo(torneoId);
    for (const g of grupos) eqRepo.crear(g);
    return eqRepo.obtenerPorTorneo(torneoId);
  }

  function participantesDeEquipos(torneoId) {
    const equipos = eqRepo.obtenerPorTorneo(torneoId);
    if (!equipos.length) {
      throw new Error("El torneo no tiene equipos. Cree o sortee los equipos antes de ejecutar el sorteo");
    }
    return equipos.map((eq) => ({
      establecimiento: eq.id,
      nombre: eq.nombre,
      division: "Libre",
      estado: "regular",
      valor: 1,
    }));
  }

  function obtenerTabla(torneoId) {
    const llavesGrupo = llaveRepo.obtenerTodos({ torneo: torneoId, nivel: 0 });
    const porGrupo = {};
    for (const l of llavesGrupo) {
      const name = l.grupo || "Llave";
      porGrupo[name] = porGrupo[name] || { nombre: name, llaves: [] };
      porGrupo[name].llaves.push(l);
    }
    return Object.values(porGrupo).map((g) => {
      const filas = {};
      g.llaves.forEach((l) => {
        (l.equipos || []).forEach((e) => {
          if (!e) return;
          const id = String(e.id ?? e._id ?? e);
          if (!filas[id]) filas[id] = { equipo: e, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
        });
        if (l.estado !== "jugado") return;
        const [a, b] = l.equipos || [];
        if (!a || !b) return;
        const pa = l.puntajeA ?? 0;
        const pb = l.puntajeB ?? 0;
        const filaA = filas[String(a.id ?? a._id ?? a)];
        const filaB = filas[String(b.id ?? b._id ?? b)];
        if (filaA) {
          filaA.pj++; filaA.gf += pa; filaA.gc += pb;
          if (pa > pb) filaA.g++; else if (pa === pb) filaA.e++; else filaA.p++;
        }
        if (filaB) {
          filaB.pj++; filaB.gf += pb; filaB.gc += pa;
          if (pb > pa) filaB.g++; else if (pb === pa) filaB.e++; else filaB.p++;
        }
      });
      const tabla = Object.values(filas).map((f) => { f.dg = f.gf - f.gc; f.pts = f.g * 3 + f.e; return f; });
      tabla.sort((x, y) => (y.pts - x.pts) || (y.dg - x.dg) || (y.gf - x.gf) || String(x.equipo.nombre || "").localeCompare(String(y.equipo.nombre || "")));
      tabla.forEach((f, i) => { f.pos = i + 1; });
      return { grupo: g.nombre, tabla };
    });
  }

  // Empuja el ganador de una llave hacia la llave de la siguiente ronda.
  function avanzar(ganadorId, padreId) {
    if (!ganadorId || !padreId) return;
    const padre = llaveRepo.obtenerPorId(padreId);
    if (!padre) return;
    const ids = (padre.equipos || []).map((e) => String(e.id ?? e._id ?? e));
    if (!ids.includes(String(ganadorId))) {
      llaveRepo.actualizar(padreId, { equipos: [...ids, String(ganadorId)] });
    }
  }

  // Registra el resultado de una llave y hace avanzar al ganador.
  function registrarResultadoLlave(llave, pa, pb) {
    const ganador =
      pa === pb
        ? null
        : pa > pb
          ? (llave.equipos[0] && (llave.equipos[0].id ?? llave.equipos[0]._id ?? llave.equipos[0]))
          : (llave.equipos[1] && (llave.equipos[1].id ?? llave.equipos[1]._id ?? llave.equipos[1]));
    const doc = llaveRepo.registrarResultado(llave.id, { puntajeA: pa, puntajeB: pb, ganador });
    if (ganador && doc && doc.padre) {
      avanzar(ganador, doc.padre);
    }
    return doc;
  }

  // Bracket eliminatorio: todos los equipos clasifican despues de la fase
  // de grupos. La primera ronda depende de la cantidad de equipos:
  // 4 -> semifinal, 8 -> cuartos de final, 16 -> octavos de final.
  function ejecutarBracket(torneoId) {
    const torneo = torRepo.obtenerPorId(torneoId);
    if (!torneo) throw new Error("Torneo no encontrado");
    const tablas = obtenerTabla(torneoId);
    const participantes = participantesDeEquipos(torneoId);
    const porId = {};
    participantes.forEach((p) => { porId[String(p.establecimiento)] = p; });

    // Amistoso: todos los equipos de la fase de grupos clasifican al bracket.
    let clasificados;
    if (torneo.formato === "competitivo") {
      clasificados = participantes;
    } else {
      const tablaUnica = (tablas && tablas[0]) || { tabla: [] };
      clasificados = tablaUnica.tabla
        .map((f) => porId[String(f.equipo.id ?? f.equipo._id ?? f.equipo)])
        .filter(Boolean);
    }
    if (clasificados.length < 2) {
      throw new Error("Se necesitan al menos 2 equipos con puntuacion para armar las eliminatorias");
    }
    const idsClasificados = clasificados.map((p) => String(p.establecimiento));
    bd.prepare(`DELETE FROM llaves WHERE torneo = ? AND nivel >= 1`).run(torneoId);

    // Desempeno (igualado): 1° con el ultimo, 2° con el penultimo, etc.
    const cruces = [];
    let i = 0;
    let j = idsClasificados.length - 1;
    while (i <= j) {
      cruces.push([idsClasificados[i], i === j ? null : idsClasificados[j]]);
      i += 1;
      j -= 1;
    }

    const NOMBRES_FASES = {
      1: ["Final"],
      2: ["Semifinal", "Final"],
      3: ["Cuartos de Final", "Semifinal", "Final"],
      4: ["Octavos de Final", "Cuartos de Final", "Semifinal", "Final"],
    };
    const totalRondas = Sorteo.nivelesNecesarios(clasificados.length);
    const fases = NOMBRES_FASES[totalRondas] || ["Final"];

    const docsR1 = [];
    cruces.forEach(([a, b], idx) => {
      docsR1.push({
        torneo: torneoId,
        actividad: torneo.actividad ?? null,
        division: "Libre",
        grupo: fases[0] || "Eliminatoria",
        equipos: [a, b].filter(Boolean).map(Number),
        bye: !b,
        estado: "pendiente",
        nivel: 1,
        orden: idx,
      });
    });
    const ronda1 = llaveRepo.crearMuchas(docsR1);
    let rondaAnterior = ronda1;
    for (let nivel = 2; nivel <= totalRondas; nivel++) {
      const count = Math.ceil(rondaAnterior.length / 2);
      const specs = [];
      for (let k = 0; k < count; k++) {
        specs.push({
          torneo: torneoId,
          actividad: torneo.actividad ?? null,
          division: "Libre",
          grupo: fases[nivel - 1] || "Eliminatoria",
          equipos: [],
          bye: false,
          estado: "pendiente",
          nivel,
          orden: k,
        });
      }
      const docsNivel = llaveRepo.crearMuchas(specs);
      for (let k = 0; k < docsNivel.length; k++) {
        const padre = docsNivel[k];
        const hijos = [rondaAnterior[k * 2]];
        if (rondaAnterior[k * 2 + 1]) hijos.push(rondaAnterior[k * 2 + 1]);
        llaveRepo.actualizar(padre.id ?? padre._id, { hijos: hijos.map((h) => h.id ?? h._id) });
        for (const h of hijos) llaveRepo.actualizar(h.id ?? h._id, { padre: padre.id ?? padre._id });
      }
      rondaAnterior = docsNivel;
    }

    const llavesBye = llaveRepo.obtenerTodos({ torneo: torneoId, bye: true, nivel: 1 });
    for (const l of llavesBye) {
      if (l.equipos.length === 1) {
        const ganadorId = l.equipos[0].id ?? l.equipos[0]._id ?? l.equipos[0];
        llaveRepo.actualizar(l.id ?? l._id, { estado: "jugado", ganador: ganadorId });
        avanzar(ganadorId, l.padre);
      }
    }
    return { totalRondas, fases, llaves: llaveRepo.obtenerTodos({ torneo: torneoId }) };
  }

  // Fase de grupos (round-robin en "Llave") + bracket automatico.
  function ejecutarSorteo(torneoId) {
    const torneo = torRepo.obtenerPorId(torneoId);
    if (!torneo) throw new Error("Torneo no encontrado");
    const participantes = participantesDeEquipos(torneoId);
    if (participantes.length < 2) throw new Error("Se necesitan al menos 2 equipos para el sorteo");
    llaveRepo.eliminarPorTorneo(torneoId);

    if (torneo.formato === "competitivo") {
      return ejecutarBracket(torneoId);
    }

    const grupos = ["Llave"];
    const repartidos = Sorteo.repartirEnGrupos(participantes, grupos);
    for (const g of repartidos) {
      const cruces = Sorteo.crucesRoundRobin(g.participantes);
      if (cruces.length) {
        llaveRepo.crearMuchas(cruces.map(([a, b], idx) => ({
          torneo: torneoId,
          actividad: torneo.actividad ?? null,
          division: [a.division, b.division].find(Boolean) || "Libre",
          grupo: g.nombre,
          equipos: [a.establecimiento, b.establecimiento].map(Number),
          bye: false,
          estado: "pendiente",
          nivel: 0,
          orden: idx,
        })));
      }
    }
    torRepo.actualizar(torneoId, { estado: "en_curso" });
    return ejecutarBracket(torneoId);
  }

  const tieneEquipos = eqRepo.obtenerPorTorneo(torneo.id).length;
  if (tieneEquipos === 0) {
    try {
      sortearEquipos(torneo.id, 4);
      console.log("[SEED] Equipos sorteados para el torneo de Futsal");
    } catch (e) {
      console.log("[SEED] Sorteo de equipos omitido:", e.message);
    }
  }

  const tieneLlaves = llaveRepo.obtenerTodos({ torneo: torneo.id }).length;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaHoy = hoy.toISOString();
  if (tieneLlaves === 0) {
    try {
      ejecutarSorteo(torneo.id);
      const llavesGrupo = llaveRepo.obtenerTodos({ torneo: torneo.id, nivel: 0 });
      // Juega algunos cruces de la fase de grupos para una tabla de puntajes viva.
      const marcadores = [1, 2, 0];
      for (let k = 0; k < llavesGrupo.length && k < 3; k++) {
        const l = llavesGrupo[k];
        if (!l.equipos || l.equipos.length < 2) continue;
        const pa = marcadores[k % marcadores.length];
        const pb = pa === 0 ? 2 : pa - 1;
        registrarResultadoLlave(l, pa, pb);
      }
      ejecutarBracket(torneo.id);
      const pendientes = llaveRepo.obtenerTodos({ torneo: torneo.id, estado: "pendiente" });
      for (const ll of pendientes) {
        llaveRepo.actualizar(ll.id ?? ll._id, { estado: "pendiente", fecha: fechaHoy, hora: "10:00", lugar: "Cancha 1" });
      }
      console.log("[SEED] Sorteo de ejemplo ejecutado y fechas asignadas");
    } catch (e) {
      console.log("[SEED] Sorteo omitido:", e.message);
    }
  } else {
    // Asignar fechas a llaves que aun no tienen fecha (para que se vean en la agenda).
    const sinFecha = llaveRepo.obtenerTodos({ torneo: torneo.id, fecha: null });
    for (const ll of sinFecha) {
      llaveRepo.actualizar(ll.id ?? ll._id, { fecha: fechaHoy, hora: "10:00", lugar: "Cancha 1" });
    }
  }

  // 8) Valoraciones (ranking de cumplimiento) para el sorteo
  for (const v of VALORACIONES) {
    const existe = valRepo.buscar(idsColegios[v.colegio], idsActividades[v.actividad], anio, semestre);
    if (!existe) {
      valRepo.crear({
        establecimiento: idsColegios[v.colegio],
        actividad: idsActividades[v.actividad],
        estado: v.estado,
        anio,
        semestre,
      });
    }
  }
  console.log("[SEED] Valoraciones de cumplimiento listas");
}

if (require.main === module) {
  initDatabase()
    .then(async () => {
      await ejecutarSeed();
      console.log("[SEED] Proceso completado");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[SEED] Error:", err);
      process.exit(1);
    });
}

module.exports = { ejecutarSeed };