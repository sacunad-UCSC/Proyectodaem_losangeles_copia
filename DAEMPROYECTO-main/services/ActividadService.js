const Actividad = require("../domain/Actividad");
const ActividadRepository = require("../repositories/ActividadRepository");

class ActividadService {
  #actividades;

  constructor() {
    this.#actividades = new ActividadRepository();
  }

  async crear(datos) {
    const actividad = new Actividad(
      datos.nombre,
      datos.area,
      datos.divisiones,
      datos.anio,
      datos.estado,
      datos.fechaAperturaInscripcion,
      datos.fechaCierreInscripcion,
      datos.recintos,
      datos.edadMinima,
      datos.edadMaxima,
      datos.seccion,
      datos.categorias
    );
    if (Array.isArray(datos.encuentros)) {
      for (const e of datos.encuentros) {
        actividad.agregarEncuentro(e.fecha, e.hora, e.lugar);
      }
    }
    const doc = await this.#actividades.crear({ ...actividad.obtenerResumen(), limiteInscritos: datos.limiteInscritos || 0 });
    return this.#conId(this.#actividades.obtenerPorId(doc.id));
  }

  async obtenerTodos(filtro = {}) {
    return this.#actividades.obtenerTodos(filtro).map((a) => this.#conId(a));
  }

  async obtenerPorId(id) {
    return this.#conId(this.#actividades.obtenerPorId(id));
  }

  async actualizar(id, datos) {
    const existente = await this.#actividades.obtenerPorId(id);
    if (!existente) throw new Error("Actividad no encontrada");

    const actualizar = {};
    if (datos.nombre) {
      new Actividad(datos.nombre, existente.area, existente.divisiones, existente.anio);
      actualizar.nombre = datos.nombre;
    }
    if (datos.area) {
      new Actividad(existente.nombre, datos.area, existente.divisiones, existente.anio);
      actualizar.area = datos.area;
    }
    if (datos.divisiones) {
      new Actividad(existente.nombre, existente.area, datos.divisiones, existente.anio);
      actualizar.divisiones = datos.divisiones;
    }
    if (datos.categorias !== undefined) {
      const dom = new Actividad(existente.nombre, existente.area, [], existente.anio);
      dom.categorias = datos.categorias;
      actualizar.categorias = dom.categorias;
      actualizar.divisiones = dom.divisiones;
    }
    if (datos.seccion !== undefined) actualizar.seccion = datos.seccion || null;
    if (datos.anio) actualizar.anio = datos.anio;
    if (datos.estado) actualizar.estado = datos.estado;
    if (datos.fechaAperturaInscripcion !== undefined) {
      actualizar.fechaAperturaInscripcion = datos.fechaAperturaInscripcion
        ? new Date(datos.fechaAperturaInscripcion)
        : null;
    }
    if (datos.fechaCierreInscripcion !== undefined) {
      actualizar.fechaCierreInscripcion = datos.fechaCierreInscripcion
        ? new Date(datos.fechaCierreInscripcion)
        : null;
    }
    if (datos.recintos !== undefined) actualizar.recintos = datos.recintos;
    if (datos.limiteInscritos !== undefined) actualizar.limiteInscritos = Number(datos.limiteInscritos) || 0;
    if (datos.edadMinima !== undefined) actualizar.edadMinima = datos.edadMinima ? Number(datos.edadMinima) : null;
    if (datos.edadMaxima !== undefined) actualizar.edadMaxima = datos.edadMaxima ? Number(datos.edadMaxima) : null;

    return this.#conId(this.#actividades.actualizar(id, actualizar));
  }

  // Coordina el calendario: cambia fecha/hora/lugar de un encuentro existente.
  async modificarEncuentro(actividadId, encuentroId, cambios) {
    const actividad = await this.#actividades.obtenerPorId(actividadId);
    if (!actividad) throw new Error("Actividad no encontrada");

    const encuentro = actividad.encuentros.find(
      (e) => String(e.id ?? e._id) === String(encuentroId)
    );
    if (!encuentro) throw new Error("Encuentro no encontrado");

    const idEncuentro = encuentro.id ?? encuentro._id;
    const actualizado = {
      fecha: cambios.fecha ? new Date(cambios.fecha) : encuentro.fecha,
      hora: cambios.hora || encuentro.hora,
      lugar: cambios.lugar || encuentro.lugar,
      id: idEncuentro,
      _id: idEncuentro,
    };

    const nuevosEncuentros = actividad.encuentros.map((e) =>
      String(e.id ?? e._id) === String(encuentroId) ? actualizado : e
    );
    return this.#conId(this.#actividades.actualizar(actividadId, { encuentros: nuevosEncuentros }));
  }

  async agregarEncuentro(actividadId, datos) {
    const actividad = await this.#actividades.obtenerPorId(actividadId);
    if (!actividad) throw new Error("Actividad no encontrada");
    const dom = new Actividad(actividad.nombre, actividad.area, actividad.divisiones, actividad.anio);
    dom.agregarEncuentro(datos.fecha, datos.hora, datos.lugar);
    const encuentro = dom.encuentros[0];
    return this.#conId(this.#actividades.agregarEncuentro(actividadId, encuentro));
  }

  async eliminar(id) {
    return this.#actividades.eliminar(id);
  }

  // Respuestas API: mantiene _id (id numerico) y en los encuentros como hacia
  // el .lean() original (la BD interna los devuelve solo con `id`).
  #conId(actividad) {
    if (!actividad) return actividad;
    return {
      ...actividad,
      _id: actividad.id,
      encuentros: (actividad.encuentros || []).map((e) => ({ ...e, _id: e.id })),
    };
  }
}

module.exports = ActividadService;