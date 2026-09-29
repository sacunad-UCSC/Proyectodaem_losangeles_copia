const Valoracion = require("../domain/Valoracion");
const ValoracionRepository = require("../repositories/ValoracionRepository");

class ValoracionService {
  #valoraciones;

  constructor() {
    this.#valoraciones = new ValoracionRepository();
  }

  // El Admin asigna/actualiza el estado de cumplimiento de un establecimiento
  // en una actividad para un anio/semestre (base del ranking para el sorteo).
  async asignar(datos) {
    const valoracion = new Valoracion(
      datos.establecimiento,
      datos.actividad,
      datos.estado,
      datos.anio,
      datos.semestre
    );
    return this.#valoraciones.upsert(valoracion);
  }

  async obtenerTodos(filtro = {}) {
    return this.#valoraciones.obtenerTodos(filtro);
  }

  // Tabla resumen: ranking de establecimientos por actividad y periodo.
  async ranking(filtro = {}) {
    const filas = await this.#valoraciones.obtenerTodos(filtro);
    const agrupado = filas.reduce((acc, f) => {
      const nombreAct = f.actividad ? f.actividad.nombre : f.actividad;
      if (!acc[nombreAct]) acc[nombreAct] = [];
      acc[nombreAct].push({
        establecimiento:
          f.establecimiento && f.establecimiento.nombre
            ? f.establecimiento.nombre
            : String(f.establecimiento || ""),
        estado: f.estado,
        valor: Valoracion.valorNumerico(f.estado),
      });
      return acc;
    }, {});
    return agrupado;
  }
}

module.exports = ValoracionService;