const { obtenerConexion } = require("../db/conexion");
const { descodificarJson, nowISO } = require("../db/util");

const SELECT_ALUMNO = `
  SELECT a.*,
         e.nombre AS establecimientoNombre,
         e.codigo AS establecimientoCodigo,
         e.dependencia AS establecimientoDependencia,
         e.direccion AS establecimientoDireccion,
         e.contacto AS establecimientoContacto,
         ac.nombre AS actividadNombre,
         ac.area AS actividadArea,
         ac.divisiones AS actividadDivisiones,
         ac.anio AS actividadAnio,
         ac.semestre AS actividadSemestre,
         ac.estado AS actividadEstado,
         ac.edadMinima AS actividadEdadMinima,
         ac.edadMaxima AS actividadEdadMaxima,
         ac.limiteInscritos AS actividadLimiteInscritos
  FROM alumnos a
  LEFT JOIN establecimientos e ON e.id = a.establecimiento
  LEFT JOIN actividades ac ON ac.id = a.actividad
`;

const CAMPOS_FILTRO = ["rut", "nombre", "genero", "division", "establecimiento", "actividad", "inscripcion"];

function aplanarAlumno(fila) {
  if (!fila) return null;
  const establecimiento = fila.establecimiento
    ? {
        id: fila.establecimiento,
        codigo: fila.establecimientoCodigo,
        nombre: fila.establecimientoNombre,
        dependencia: fila.establecimientoDependencia,
        direccion: fila.establecimientoDireccion,
        contacto: fila.establecimientoContacto,
      }
    : null;
  const actividad = fila.actividad
    ? {
        id: fila.actividad,
        nombre: fila.actividadNombre,
        area: fila.actividadArea,
        divisiones: descodificarJson(fila.actividadDivisiones, []),
        anio: fila.actividadAnio,
        semestre: fila.actividadSemestre,
        estado: fila.actividadEstado,
        edadMinima: fila.actividadEdadMinima,
        edadMaxima: fila.actividadEdadMaxima,
        limiteInscritos: fila.actividadLimiteInscritos,
      }
    : null;
  return {
    id: fila.id,
    rut: fila.rut,
    nombre: fila.nombre,
    genero: fila.genero,
    fechaNacimiento: fila.fechaNacimiento,
    apoderado: fila.apoderado,
    email: fila.email,
    telefono: fila.telefono,
    establecimiento,
    actividad,
    division: fila.division,
    inscripcion: fila.inscripcion,
    torneos: [],
    asistencia: [],
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
  };
}

function aplanarBasico(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    rut: fila.rut,
    nombre: fila.nombre,
    genero: fila.genero,
    fechaNacimiento: fila.fechaNacimiento,
    apoderado: fila.apoderado,
    email: fila.email,
    telefono: fila.telefono,
    establecimiento: fila.establecimiento,
    actividad: fila.actividad,
    division: fila.division,
    inscripcion: fila.inscripcion,
    torneos: [],
    asistencia: [],
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
  };
}

function cargarAdyacentes(bd, filas) {
  if (!filas.length) return;
  const ids = filas.map((f) => f.id);
  const marcadores = ids.map(() => "?").join(",");
  const filasTorneo = bd
    .prepare(`SELECT alumno, torneo FROM alumno_torneos WHERE alumno IN (${marcadores})`)
    .all(...ids);
  const porTorneo = {};
  for (const t of filasTorneo) {
    (porTorneo[t.alumno] = porTorneo[t.alumno] || []).push(t.torneo);
  }
  const filasAsistencia = bd
    .prepare(`SELECT alumno, encuentro, presente FROM asistencias WHERE alumno IN (${marcadores})`)
    .all(...ids);
  const porAsistencia = {};
  for (const a of filasAsistencia) {
    (porAsistencia[a.alumno] = porAsistencia[a.alumno] || []).push({
      encuentro: a.encuentro,
      presente: !!a.presente,
    });
  }
  for (const f of filas) {
    f.torneos = porTorneo[f.id] || [];
    f.asistencia = porAsistencia[f.id] || [];
  }
}

function idDe(valor) {
  if (valor && typeof valor === "object" && valor._id !== undefined) return valor._id;
  return valor;
}

function fechaTexto(valor) {
  if (valor instanceof Date) return valor.toISOString();
  return valor;
}

class AlumnoRepository {
  crear(alumno) {
    const bd = obtenerConexion();
    const r = bd
      .prepare(
        `INSERT INTO alumnos
          (rut, nombre, genero, fechaNacimiento, apoderado, email, telefono,
           establecimiento, actividad, division, inscripcion)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        alumno.rut,
        alumno.nombre,
        alumno.genero,
        fechaTexto(alumno.fechaNacimiento),
        alumno.apoderado || "",
        alumno.email || "",
        alumno.telefono || "",
        alumno.establecimiento,
        alumno.actividad,
        alumno.division,
        alumno.inscripcion ?? null
      );
    return this.obtenerPorId(r.lastInsertRowid);
  }

  obtenerPorId(id) {
    const bd = obtenerConexion();
    const fila = bd.prepare(`${SELECT_ALUMNO} WHERE a.id = ?`).get(id);
    if (!fila) return null;
    const alumno = aplanarAlumno(fila);
    cargarAdyacentes(bd, [alumno]);
    return alumno;
  }

  obtenerTodos(filtro = {}) {
    const bd = obtenerConexion();
    const condiciones = [];
    const params = [];
    for (const [clave, valor] of Object.entries(filtro)) {
      if (clave === "torneos") {
        const lista = (Array.isArray(valor) ? valor : [valor]).map((v) => idDe(v));
        condiciones.push(
          `a.id IN (SELECT alumno FROM alumno_torneos WHERE torneo IN (${lista.map(() => "?").join(",")}))`
        );
        params.push(...lista);
        continue;
      }
      if (!CAMPOS_FILTRO.includes(clave)) continue;
      if (valor && typeof valor === "object" && !Array.isArray(valor) && Array.isArray(valor.$in)) {
        condiciones.push(`a.${clave} IN (${valor.$in.map(() => "?").join(",")})`);
        params.push(...valor.$in);
      } else {
        condiciones.push(`a.${clave} = ?`);
        params.push(idDe(valor));
      }
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
    const filas = bd.prepare(`${SELECT_ALUMNO} ${where} ORDER BY a.nombre ASC`).all(...params);
    const alumnos = filas.map(aplanarAlumno);
    cargarAdyacentes(bd, alumnos);
    return alumnos;
  }

  buscarPorRutEnActividad(rut, actividad) {
    const bd = obtenerConexion();
    const fila = bd
      .prepare(`SELECT * FROM alumnos WHERE rut = ? AND actividad = ?`)
      .get(rut, actividad);
    if (!fila) return null;
    const alumno = aplanarBasico(fila);
    cargarAdyacentes(bd, [alumno]);
    return alumno;
  }

  actualizar(id, datos) {
    const bd = obtenerConexion();
    const columnas = [
      "rut",
      "nombre",
      "genero",
      "fechaNacimiento",
      "apoderado",
      "email",
      "telefono",
      "establecimiento",
      "actividad",
      "division",
      "inscripcion",
    ];
    const campos = [];
    const params = [];
    for (const c of columnas) {
      if (datos[c] !== undefined) {
        campos.push(`${c} = ?`);
        params.push(datos[c]);
      }
    }
    const agregar = [];
    if (datos.$addToSet && datos.$addToSet.torneos !== undefined) {
      const lista = Array.isArray(datos.$addToSet.torneos)
        ? datos.$addToSet.torneos
        : [datos.$addToSet.torneos];
      for (const t of lista) agregar.push(idDe(t));
    }
    const quitar = [];
    if (datos.$pull && datos.$pull.torneos !== undefined) {
      const lista = Array.isArray(datos.$pull.torneos)
        ? datos.$pull.torneos
        : [datos.$pull.torneos];
      for (const t of lista) quitar.push(idDe(t));
    }
    if (campos.length || agregar.length || quitar.length) {
      campos.push("updatedAt = ?");
      params.push(nowISO());
      params.push(id);
      bd.prepare(`UPDATE alumnos SET ${campos.join(", ")} WHERE id = ?`).run(...params);
    }
    const insertar = bd.prepare(
      `INSERT OR IGNORE INTO alumno_torneos (alumno, torneo) VALUES (?,?)`
    );
    for (const t of agregar) if (t !== null && t !== undefined) insertar.run(id, t);
    const borrar = bd.prepare(`DELETE FROM alumno_torneos WHERE alumno = ? AND torneo = ?`);
    for (const t of quitar) if (t !== null && t !== undefined) borrar.run(id, t);
    return this.obtenerPorId(id);
  }

  registrarAsistencia(id, encuentroId, presente) {
    const bd = obtenerConexion();
    bd.prepare(
      `INSERT INTO asistencias (alumno, encuentro, presente)
       VALUES (?,?,?)
       ON CONFLICT(alumno, encuentro) DO UPDATE SET presente = excluded.presente`
    ).run(id, encuentroId, presente ? 1 : 0);
    bd.prepare(`UPDATE alumnos SET updatedAt = ? WHERE id = ?`).run(nowISO(), id);
    return this.obtenerPorId(id);
  }

  eliminar(id) {
    const bd = obtenerConexion();
    const r = bd.prepare(`DELETE FROM alumnos WHERE id = ?`).run(id);
    return r.changes > 0;
  }
}

module.exports = AlumnoRepository;