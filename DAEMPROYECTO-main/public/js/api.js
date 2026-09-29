// Capa de acceso a la API REST del backend DAEM.
// Maneja el token JWT y respuestas JSON consistentes ({error}) del servidor.

const API = {
  token: null,
  usuario: null,

  setToken(t) {
    this.token = t;
    localStorage.setItem("daem_token", t);
  },
  loadToken() {
    const t = localStorage.getItem("daem_token");
    if (t) this.token = t;
    return this.token;
  },
  limpiar() {
    this.token = null;
    this.usuario = null;
    localStorage.removeItem("daem_token");
  },

  cabecera(contenidoJSON) {
    const h = { Authorization: `Bearer ${this.token}` };
    if (contenidoJSON) h["Content-Type"] = "application/json";
    return h;
  },

  async peticion(metodo, url, cuerpo) {
    const opciones = {
      method: metodo,
      headers: this.cabecera(cuerpo !== undefined),
    };
    if (cuerpo !== undefined) opciones.body = JSON.stringify(cuerpo);
    const resp = await fetch(url, opciones);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      if (resp.status === 401 && this.token) {
        this.limpiar();
        window.location.hash = "#login";
        window.dispatchEvent(new Event("daem:sesion-caducada"));
      }
      const err = new Error(
        (data && data.error) || (data && data.mensaje) || "Error en la peticion"
      );
      err.status = resp.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  async login(rut, clave) {
    const data = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut, clave }),
    }).then((r) => r.json());
    if (!data.token) throw new Error((data && data.error) || "No se pudo iniciar sesion");
    this.setToken(data.token);
    this.usuario = data.usuario;
    return data;
  },

  async perfil() {
    const u = await this.peticion("GET", "/api/auth/me");
    this.usuario = u;
    return u;
  },

  // ---------- Establecimientos ----------
  async establecimientos() { return this.peticion("GET", "/api/establecimientos"); },
  async crearEstablecimiento(datos) { return this.peticion("POST", "/api/establecimientos", datos); },

  // ---------- Usuarios ----------
  async usuarios() { return this.peticion("GET", "/api/usuarios"); },
  async crearUsuario(datos) { return this.peticion("POST", "/api/usuarios", datos); },

  // ---------- Secciones ----------
  async secciones() { return this.peticion("GET", "/api/secciones"); },
  async crearSeccion(datos) { return this.peticion("POST", "/api/secciones", datos); },
  async actualizarSeccion(id, datos) { return this.peticion("PUT", `/api/secciones/${id}`, datos); },
  async eliminarSeccion(id) { return this.peticion("DELETE", `/api/secciones/${id}`); },

  // ---------- Actividades ----------
  async actividades() { return this.peticion("GET", "/api/actividades"); },
  async crearActividad(datos) { return this.peticion("POST", "/api/actividades", datos); },
  async actualizarActividad(id, datos) { return this.peticion("PUT", `/api/actividades/${id}`, datos); },
  async eliminarActividad(id) { return this.peticion("DELETE", `/api/actividades/${id}`); },

  // ---------- Torneos / Sorteo ----------
  async torneos() { return this.peticion("GET", "/api/torneos"); },
  async agendaTorneos() { return this.peticion("GET", "/api/torneos/agenda"); },
  async crearTorneo(datos) { return this.peticion("POST", "/api/torneos", datos); },
  async actualizarTorneo(id, datos) { return this.peticion("PUT", `/api/torneos/${id}`, datos); },
  async suspenderTorneo(id) { return this.peticion("POST", `/api/torneos/${id}/suspender`); },
  async reactivarTorneo(id) { return this.peticion("POST", `/api/torneos/${id}/reactivar`); },
  async eliminarTorneo(id) { return this.peticion("DELETE", `/api/torneos/${id}`); },
  async ejecutarSorteo(id) { return this.peticion("POST", `/api/torneos/${id}/sorteo`); },
  async ejecutarBracket(id, datos = {}) { return this.peticion("POST", `/api/torneos/${id}/bracket`, datos); },
  async actualizarLlave(llaveId, datos) {
    return this.peticion("PUT", `/api/resultados/llaves/${llaveId}`, datos);
  },
  async llaves(id) { return this.peticion("GET", `/api/torneos/${id}/llaves`); },
  async tabla(id) { return this.peticion("GET", `/api/torneos/${id}/tabla`); },
  async equipos(id) { return this.peticion("GET", `/api/torneos/${id}/equipos`); },
  async poolEquipos(id) { return this.peticion("GET", `/api/torneos/${id}/equipos/pool`); },
  async sortearEquipos(id, cantidad) {
    return this.peticion("POST", `/api/torneos/${id}/equipos/sortear`, { cantidad });
  },
  async crearEquipo(id, datos) {
    return this.peticion("POST", `/api/torneos/${id}/equipos`, datos);
  },
  async eliminarEquipo(id, equipoId) {
    return this.peticion("DELETE", `/api/torneos/${id}/equipos/${equipoId}`);
  },
  async registrarResultadoLlave(llaveId, datos) {
    return this.peticion("POST", `/api/resultados/llaves/${llaveId}`, datos);
  },

  // ---------- Inscripciones ----------
  async inscripciones() { return this.peticion("GET", "/api/inscripciones"); },
  async crearInscripcion(datos) { return this.peticion("POST", "/api/inscripciones", datos); },
  async asociarTorneo(inscripcionId, torneo) { return this.peticion("POST", `/api/inscripciones/${inscripcionId}/torneo`, { torneo }); },
  async cambiarEstadoInscripcion(id, estado) {
    return this.peticion("PUT", `/api/inscripciones/${id}/estado`, { estado });
  },
  async agregarAlumno(inscripcionId, datos) {
    return this.peticion("POST", `/api/inscripciones/${inscripcionId}/alumnos`, datos);
  },
  async nomina() { return this.peticion("GET", "/api/inscripciones/nomina"); },
  async torneosPostulables() { return this.peticion("GET", "/api/inscripciones/torneos/postulables"); },
  async torneoPostulados(torneoId) { return this.peticion("GET", `/api/inscripciones/torneos/${torneoId}/postulados`); },
  async postularTorneo(torneoId, datos) { return this.peticion("POST", `/api/inscripciones/torneos/${torneoId}/postular`, datos); },

  // ---------- Solicitudes ----------
  async solicitudes() { return this.peticion("GET", "/api/solicitudes"); },
  async responderSolicitud(id, estado, respuesta) {
    return this.peticion("PUT", `/api/solicitudes/${id}/estado`, { estado, respuesta });
  },

  // ---------- Valoraciones ----------
  async ranking() { return this.peticion("GET", "/api/reportes/ranking"); },
  async asignarValoracion(datos) { return this.peticion("POST", "/api/reportes/asignar", datos); },

  // ---------- Reportes ----------
  async nominaReporte() { return this.peticion("GET", "/api/reportes/nomina"); },
  async participaciones() { return this.peticion("GET", "/api/reportes/participaciones"); },
  async beneficiarios() { return this.peticion("GET", "/api/reportes/beneficiarios"); },
  async historico() { return this.peticion("GET", "/api/reportes/historico"); },
  async reporteTorneos() { return this.peticion("GET", "/api/reportes/torneos"); },

  async catalogos() { return this.peticion("GET", "/api/catalogos"); },

  // Notificaciones (campana) para el coordinador: listado + marcar leidas.
  async notificaciones() { return this.peticion("GET", "/api/notificaciones"); },
  async marcarNotificacionLeida(id) { return this.peticion("POST", `/api/notificaciones/${id}/leer`); },
  async marcarTodasNotificacionesLeidas() { return this.peticion("POST", "/api/notificaciones/leer-todas"); },
};
