// Catalogos globales del sistema DAEM (reglas de negocio)

const ROLES = {
  ADMIN: "admin",
  COORDINADOR: "coordinador",
  LECTOR: "lector",
};

const AREAS = {
  DEPORTIVA: "Deportiva",
  ARTISTICO_CULTURAL: "Artístico/Cultural",
};

const DEPENDENCIAS = {
  MUNICIPAL: "Municipal",
  PARTICULAR_SUB: "Particular Subvencionado",
};

// Divisiones con rango de anios de nacimiento validos.
// Las categorias DAMAS y VARONES no restringen edad (se combinan con una de edad).
const DIVISIONES = [
  { nombre: "MINIS", desde: 2016, hasta: 2018 },
  { nombre: "SUB 13", desde: 2013, hasta: 2015 },
  { nombre: "SUB 14", desde: 2012, hasta: 2014 },
  { nombre: "JUVENIL", desde: 2009, hasta: 2012 },
  { nombre: "DAMAS", desde: null, hasta: null },
  { nombre: "VARONES", desde: null, hasta: null },
];

const ESTADOS_INSCRIPCION = {
  EN_PROCESO: "en_proceso",
  ACEPTADA: "aceptada",
  RECHAZADA: "rechazada",
};

const ESTADOS_SOLICITUD = {
  EN_PROCESO: "en_proceso",
  APROBADA: "aprobada",
  RECHAZADA: "rechazada",
};

const ESTADOS_ACTIVIDAD = {
  PUBLICADA: "publicada",
  EN_INSCRIPCION: "en_inscripcion",
  CERRADA: "cerrada",
};

const ESTADOS_TORNEO = {
  INSCRIPCIONES: "inscripciones",
  EN_CURSO: "en_curso",
  FINALIZADO: "finalizado",
};

// Estados de cumplimiento (valor) por establecimiento/actividad,
// usados por el algoritmo de sorteo para nivelar los emparejamientos.
// El valor numerico permite ordenar: cumple(3) > regular(2) > no_cumple(1).
const ESTADOS_CUMPLIMIENTO = {
  CUMPLE: { nombre: "cumple", valor: 3 },
  REGULAR: { nombre: "regular", valor: 2 },
  NO_CUMPLE: { nombre: "no_cumple", valor: 1 },
};

const TIPOS_SOLICITUD = {
  RECURSOS: "recursos",
  PARTICIPACION: "participacion",
  OTRO: "otro",
};

const POSICIONES = ["1º", "2º", "3º"];

function obtenerDivision(nombre) {
  return DIVISIONES.find((d) => d.nombre === nombre) || null;
}

function validarNacimientoEnDivision(fechaNacimiento, nombreDivision) {
  const division = obtenerDivision(nombreDivision);
  if (!division) throw new Error(`Division desconocida: ${nombreDivision}`);
  if (!division.desde) return true; // division sin rango de edad fijo
  const anio = new Date(fechaNacimiento).getFullYear();
  const valido = anio >= division.desde && anio <= division.hasta;
  if (!valido) {
    throw new Error(
      `El alumno nacio en ${anio}; la categoria ${nombreDivision} requiere nacer entre ${division.desde} y ${division.hasta}`
    );
  }
  return true;
}

module.exports = {
  ROLES,
  AREAS,
  DEPENDENCIAS,
  DIVISIONES,
  ESTADOS_INSCRIPCION,
  ESTADOS_SOLICITUD,
  ESTADOS_ACTIVIDAD,
  ESTADOS_TORNEO,
  ESTADOS_CUMPLIMIENTO,
  TIPOS_SOLICITUD,
  POSICIONES,
  obtenerDivision,
  validarNacimientoEnDivision,
};