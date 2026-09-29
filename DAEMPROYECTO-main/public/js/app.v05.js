// ============================================================
// SPA DAEM: orquesta login, autenticacion por rol y paneles.
// ============================================================

const $ = (sel) => document.querySelector(sel);
const esc = (txt = "") => String(txt).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Banner verde temporal de exito. Flotante sobre el body para que sobreviva
// a la recarga interna del panel (#vista-contenido se re-renderiza al guardar).
let __timerExito = null;
const mostrarExito = (msg) => {
  let preview = document.querySelector(".banner-exito");
  if (!preview) {
    preview = document.createElement("div");
    preview.className = "banner-exito";
    preview.style.cssText = "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:8px;background:#e8f5e9;border:1px solid #81c784;color:#1b5e20;padding:10px 16px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.15);font-weight:600;font-size:14px;transition:opacity .25s;";
    document.body.appendChild(preview);
  }
  preview.innerHTML = `<span>&#10004;</span><span>${esc(msg)}</span>`;
  clearTimeout(__timerExito);
  __timerExito = setTimeout(() => { preview.style.opacity = "0"; setTimeout(() => preview.remove(), 300); }, 3200);
};

// ---------- Combobox con busqueda ----------
// comboHtml(id, idsSugerencia) crea: <input type="text" id="id"> + <div id="idsSugerencia">.
// initCombo(id, opciones, onSelect) con opciones [{ valor, texto, extra }] permite escribir
// para filtrar la lista de sugerencias.
function comboHtml(id, placeholder = "Escriba para buscar...") {
  return `<span class="cb"><input type="text" id="${id}" class="cb-txt" placeholder="${esc(placeholder)}" autocomplete="off"></span>`;
}
function initCombo(id, opciones, onSelect, placeholder) {
  const inp = $("#" + id);
  if (!inp) return;
  inp.placeholder = placeholder || "Escriba para buscar...";
  let sug = document.getElementById(id + "-sug");
  if (!sug) {
    sug = document.createElement("div");
    sug.id = id + "-sug";
    sug.className = "cb-sug";
    const cb = inp.closest(".cb") || inp.parentElement;
    cb.appendChild(sug);
  }
  const pintar = (filtro) => {
    const f = (filtro || "").toLowerCase().trim();
    const vis = opciones.filter((o) => !f || String(o.texto).toLowerCase().includes(f)).slice(0, 60);
    sug.innerHTML = vis.length
      ? vis.map((o, i) => `<div class="cb-item" data-i="${i}">${esc(o.texto)}</div>`).join("")
      : '<div class="cb-item muted">Sin coincidencias</div>';
    sug.classList.add("abierta");
  };
  inp.addEventListener("input", () => {
    if (onSelect) {
      const exacto = opciones.find((o) => String(o.valor) === inp.value);
      if (exacto) { onSelect(exacto); sug.classList.remove("abierta"); return; }
    }
    pintar(inp.value);
  });
  inp.addEventListener("focus", () => pintar(inp.value));
  inp.addEventListener("blur", () => setTimeout(() => sug.classList.remove("abierta"), 150));
  inp.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = [...sug.querySelectorAll(".cb-item")];
      const idx = items.findIndex((el) => el.classList.contains("sel"));
      let n = idx === -1 ? 0 : (e.key === "ArrowDown" ? idx + 1 : idx - 1);
      if (n < 0) n = items.length - 1;
      if (n >= items.length) n = 0;
      items.forEach((el) => el.classList.remove("sel"));
      items[n] && items[n].classList.add("sel");
    }
    if (e.key === "Enter") {
      const sel = sug.querySelector(".cb-item.sel");
      if (sel) { sel.click(); }
    }
  });
  sug.addEventListener("mousedown", (e) => {
    const it = e.target.closest(".cb-item");
    if (!it) return;
    e.preventDefault();
    const o = opciones[Number(it.dataset.i)];
    if (!o) return;
    inp.value = o.texto;
    if (onSelect) onSelect(o);
    sug.classList.remove("abierta");
  });
}

// Opciones combinadas "Actividad - Categoria": por cada actividad y cada division.
function opcionesActividadCategoria(act) {
  const out = [];
  act.forEach((a) => {
    const divs = (a.divisiones && a.divisiones.length) ? a.divisiones : [""];
    divs.forEach((d) => {
      out.push({
        valor: String(a._id),
        texto: d ? `${a.nombre} - ${d}` : a.nombre,
        extra: { actividad: String(a._id), division: d, nombre: a.nombre },
      });
    });
  });
  return out;
}

let CAT = {}; // catalogos cargados

function cargarCatalogos() {
  return API.catalogos().then((c) => { CAT = c; });
}

// ---------- Autenticacion ----------
async function iniciarSesion(rut, clave) {
  await API.login(rut, clave);
  API.usuario = await API.perfil();
  await cargarCatalogos();
  mostrarDashboard();
}

// ---------- Login ----------
function mostrarLogin() {
  $("#app-dashboard").classList.add("oculta");
  $("#vista-login").classList.remove("oculta");
}

function cerrarMenu() {
  document.body.classList.remove("menu-abierto");
}

function abrirMenu() {
  document.body.classList.add("menu-abierto");
}

function mostrarDashboard() {
  $("#vista-login").classList.add("oculta");
  $("#app-dashboard").classList.remove("oculta");
  const u = API.usuario;
  $("#usuario-actual").innerHTML =
    `<strong>${esc(u.nombre)}</strong><span class="badge-rol">${esc(u.rol)}</span>` +
    (u.establecimiento && u.establecimiento.nombre ? `<div class="muted">${esc(u.establecimiento.nombre)}</div>` : "");
  construirNav();
  navegar("");

  $("#btn-menu").onclick = abrirMenu;
  $("#btn-cerrar-menu").onclick = cerrarMenu;
  $("#overlay-menu").onclick = cerrarMenu;
}

function construirNav() {
  const nav = $("#nav");
  nav.innerHTML = "";
  const items = MenuPorRol[API.usuario.rol] || [];
  items.forEach((it) => {
    const b = document.createElement("button");
    b.textContent = it.label;
    b.dataset.opcion = it.clave;
    b.onclick = () => { document.querySelectorAll("#nav button").forEach((x) => x.classList.remove("activo")); b.classList.add("activo"); cerrarMenu(); navegar(it.clave); };
    nav.appendChild(b);
  });
}

function navegar(opcion) {
  const items = MenuPorRol[API.usuario.rol] || [];
  const active = opcion || (items[0] && items[0].clave);
  if (!active) {
    $("#contenido").innerHTML = "<div class='seccion'><p class='muted'>Sin opciones para este perfil.</p></div>";
    return;
  }
  (PANELES[active] || PANELES.inicio).call(null);
}

// ---------- Helpers de render ----------
function contenido(html) { $("#contenido").innerHTML = html; }

function mensajeError(err) {
  return `<div class="mensaje" style="border-color:#f1c8c2;background:#fdf0ee;color:#8a3b30">${esc(err && err.message ? err.message : "Ocurrio un error")}</div>`;
}

async function CargarPanel(fn) {
  try {
    $("#contenido").innerHTML = `<div class="mensaje">Cargando...</div>`;
    await fn();
  } catch (err) {
    contenido(mensajeError(err));
  }
}

// ============================================================
// NAVEGACION POR ROL
// ============================================================
const MenuPorRol = {
  admin: [
    { clave: "adminResumen", label: "Resumen" },
    { clave: "adminEstablecimientos", label: "Establecimientos" },
    { clave: "adminUsuarios", label: "Usuarios" },
    { clave: "adminActividades", label: "Actividades" },
    { clave: "adminTorneos", label: "Torneos y Sorteo" },
    { clave: "adminInscripciones", label: "Inscripciones" },
    { clave: "adminSolicitudes", label: "Solicitudes" },
    { clave: "adminAgenda", label: "Agenda" },
    { clave: "adminValoraciones", label: "Ranking Cumplimiento" },
    { clave: "adminReportes", label: "Reportes" },
  ],
  coordinador: [
    { clave: "coordResumen", label: "Resumen" },
    { clave: "coordLectores", label: "Lectores" },
    { clave: "coordInscribir", label: "Postulaciones" },
    { clave: "coordTorneos", label: "Postular Torneos" },
    { clave: "coordSolicitudes", label: "Mis Solicitudes" },
    { clave: "coordNomina", label: "Nomina Estudiantes" },
  ],
  lector: [
    { clave: "lectorResumen", label: "Resumen" },
    { clave: "lectorEstudiantes", label: "Estudiantes" },
    { clave: "lectorAgenda", label: "Agenda" },
  ],
};

const PANELES = {
  inicio: () => CargarPanel(panelBienvenida),
  adminResumen: () => CargarPanel(panelAdminResumen),
  adminEstablecimientos: () => CargarPanel(panelAdminEstablecimientos),
  adminUsuarios: () => CargarPanel(panelAdminUsuarios),
  adminActividades: () => CargarPanel(panelAdminActividades),
  adminTorneos: () => CargarPanel(panelAdminTorneos),
  adminInscripciones: () => CargarPanel(panelAdminInscripciones),
  adminValoraciones: () => CargarPanel(panelAdminValoraciones),
  adminSolicitudes: () => CargarPanel(panelAdminSolicitudes),
  adminAgenda: () => CargarPanel(panelAdminAgenda),
  adminReportes: () => CargarPanel(panelAdminReportes),
  coordResumen: () => CargarPanel(panelCoordResumen),
  coordLectores: () => CargarPanel(panelCoordLectores),
  coordInscribir: () => CargarPanel(panelCoordInscribir),
  coordTorneos: () => CargarPanel(panelCoordTorneos),
  coordSolicitudes: () => CargarPanel(panelCoordSolicitudes),
  coordNomina: () => CargarPanel(panelCoordNomina),
  lectorResumen: () => CargarPanel(panelLectorResumen),
  lectorEstudiantes: () => CargarPanel(panelLectorEstudiantes),
  lectorAgenda: () => CargarPanel(panelAdminAgenda),
};

async function panelBienvenida() {
  const u = API.usuario;
  contenido(
    `<div class="encabezado"><div><h2 class="pagina">Bienvenido/a, ${esc(u.nombre)}</h2><p class="muted">Perfil: ${esc(u.rol)}</p></div></div>
     <div class="tarjeta"><p>Seleccione una opcion del menu lateral para comenzar.</p></div>`
  );
}

// ============================================================
// PANELES ADMIN
// ============================================================
async function panelAdminResumen() {
  const [est, act, tor, sol] = await Promise.all([
    API.establecimientos().catch(() => []),
    API.actividades().catch(() => []),
    API.torneos().catch(() => []),
    API.solicitudes().catch(() => []),
  ]);

  const solicitudesPendientes = sol.filter((s) => s.estado === "en_proceso");

  const etiquetasEstado = {
    activo: { label: "Activo", clase: "est-activo" },
    en_curso: { label: "En curso", clase: "est-activo" },
    inscripciones: { label: "Inscripciones", clase: "est-inscripciones" },
    pausado: { label: "Pausado", clase: "est-pausado" },
    postergado: { label: "Postergado", clase: "est-postergado" },
    cancelado: { label: "Cancelado", clase: "est-cancelado" },
    finalizado: { label: "Finalizado", clase: "est-finalizado" },
  };

  const torneosVigentes = tor.filter((t) => ["activo", "en_curso", "inscripciones"].includes(t.estado));

  const haceUnMes = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const cambiosRecientes = tor
    .filter((t) => {
      const ref = t.updatedAt || t.createdAt;
      return ref && new Date(ref).getTime() >= haceUnMes;
    })
    .sort((a, b) => new Date((b.updatedAt || b.createdAt)) - new Date((a.updatedAt || a.createdAt)));

  const formatearEstado = (estado) => {
    const e = etiquetasEstado[estado] || { label: estado, clase: "est-regular" };
    return `<span class="badge-estado-tor ${e.clase}">${esc(e.label)}</span>`;
  };

  contenido(
    `<h2 class="pagina">Resumen DAEM</h2>
     <div class="stats-fila">
       <div class="stat">
         <div class="num">${est.length}</div><div class="lbl">Establecimientos</div>
       </div>
       <div class="stat">
         <div class="num">${act.length}</div><div class="lbl">Actividades</div>
       </div>
       <div class="stat">
         <div class="num">${tor.length}</div><div class="lbl">Torneos</div>
       </div>
       <div class="stat">
         <div class="num">${solicitudesPendientes.length}</div><div class="lbl">Solicitudes Pend.</div>
       </div>
     </div>
     <div class="seccion">
       <button class="btn btn-primario2" id="btn-admin-sol">Solicitudes</button>
       <button class="btn btn-primario2" id="btn-admin-agenda">Agenda</button>
     </div>

     <h3 class="subtitulo-seccion">Torneos Activos</h3>
     <div class="tarjeta">
       ${torneosVigentes.length ? `
         <table><thead><tr><th>Torneo</th><th>Actividad / Deporte</th><th>Ano / Semestre</th><th>Estado</th></tr></thead>
         <tbody>${torneosVigentes.map((t) => `
           <tr>
             <td><strong>${esc(t.nombre)}</strong></td>
             <td>${esc(t.actividad ? t.actividad.nombre : "-")}</td>
             <td>${esc(t.anio)} S${esc(t.semestre)}</td>
             <td>${formatearEstado(t.estado)}</td>
           </tr>`).join("")}</tbody></table>`
         : "<p class='muted'>No hay torneos activos en este momento.</p>"}
     </div>

     <h3 class="subtitulo-seccion">Cambios Recientes (ultimo mes)</h3>
     <div class="tarjeta">
       ${cambiosRecientes.length ? cambiosRecientes.map((t) => {
         const creadoRecientemente = t.createdAt && new Date(t.createdAt).getTime() >= haceUnMes;
         return `<div class="campo cambio-torneo">
           <strong>${esc(t.nombre)}</strong>
           <span class="badge-rol cambio-tipo ${creadoRecientemente ? "cambio-nuevo" : ""}">${creadoRecientemente ? "Nuevo" : "Modificado"}</span>
           ${formatearEstado(t.estado)}
           <p class="muted">${esc(t.actividad ? t.actividad.nombre : "-")} | ${esc(new Date((t.updatedAt || t.createdAt)).toLocaleDateString("es-CL"))}</p>
         </div>`;
       }).join("") : "<p class='muted'>No hubo cambios de torneos en el ultimo mes.</p>"}
     </div>`
  );

  $("#btn-admin-sol").onclick = () => navegar("adminSolicitudes");
  $("#btn-admin-agenda").onclick = () => navegar("adminAgenda");
}

async function panelAdminEstablecimientos() {
  const est = await API.establecimientos();
  contenido(
    `<div class="encabezado"><h2 class="pagina">Establecimientos</h2><button class="btn btn-primario2" id="btn-nuevo-est">+ Nuevo</button></div>
     <div id="form-nuevo-est" class="tarjeta oculta">
       <div class="grid-2">
         <div class="campo"><label>Codigo (ej. A-59)</label><input id="est-codigo" placeholder="A-59"></div>
         <div class="campo"><label>Nombre</label><input id="est-nombre"></div>
         <div class="campo"><label>Dependencia</label>
           <select id="est-dep">${(CAT.dependencias || []).map((d) => `<option>${esc(d)}</option>`).join("")}</select></div>
       </div>
       <div class="campo"><label>Direccion</label><input id="est-dir"></div>
       <button class="btn btn-ok" id="btn-guardar-est">Guardar</button>
     </div>
     <div class="tarjeta"><table><thead><tr><th>Codigo</th><th>Nombre</th><th>Dependencia</th></tr></thead>
     <tbody>${est.map((e) => `<tr><td>${esc(e.codigo)}</td><td>${esc(e.nombre)}</td><td>${esc(e.dependencia)}</td></tr>`).join("")}</tbody></table></div>`
  );
  $("#btn-nuevo-est").onclick = () => $("#form-nuevo-est").classList.toggle("oculta");
  $("#btn-guardar-est").onclick = async () => {
    try {
      await API.crearEstablecimiento({
        codigo: $("#est-codigo").value, nombre: $("#est-nombre").value,
        dependencia: $("#est-dep").value, direccion: $("#est-dir").value,
      });
      panelAdminEstablecimientos();
    } catch (err) { alert(err.message); }
  };
}

async function panelAdminUsuarios() {
  const [usuarios, est] = await Promise.all([API.usuarios(), API.establecimientos()]);
  const opEst = est.map((e) => ({ valor: String(e._id), texto: `${e.codigo} - ${e.nombre}` }));
  contenido(
    `<div class="encabezado"><h2 class="pagina">Usuarios</h2><button class="btn btn-primario2" id="btn-nuevo-usr">+ Nuevo</button></div>
     <div id="form-nuevo-usr" class="tarjeta oculta">
       <div class="grid-2">
         <div class="campo"><label>RUT</label><input id="usr-rut"></div>
         <div class="campo"><label>Nombre</label><input id="usr-nombre"></div>
         <div class="campo"><label>Rol</label><select id="usr-rol"><option value="coordinador">Coordinador</option><option value="lector">Lector</option></select></div>
         <div class="campo"><label>Clave</label><input id="usr-clave"></div>
         <div class="campo"><label>Establecimiento</label>
           ${comboHtml("usr-est-txt", "Buscar establecimiento...")}<input type="hidden" id="usr-est"></div>
       </div>
       <button class="btn btn-ok" id="btn-guardar-usr">Guardar</button>
     </div>
     <div class="tarjeta"><table><thead><tr><th>RUT</th><th>Nombre</th><th>Rol</th><th>Establecimiento</th></tr></thead>
     <tbody>${usuarios.map((u) => `<tr><td>${esc(u.rut)}</td><td>${esc(u.nombre)}</td><td>${esc(u.rol)}</td><td>${esc(u.establecimiento ? u.establecimiento.nombre : "-")}</td></tr>`).join("")}</tbody></table></div>`
  );
  $("#btn-nuevo-usr").onclick = () => $("#form-nuevo-usr").classList.toggle("oculta");
  initCombo("usr-est-txt", opEst, (o) => { $("#usr-est").value = o.valor; }, "Buscar establecimiento...");
  $("#btn-guardar-usr").onclick = async () => {
    try {
      await API.crearUsuario({
        rut: $("#usr-rut").value, nombre: $("#usr-nombre").value, rol: $("#usr-rol").value,
        clave: $("#usr-clave").value, establecimiento: $("#usr-est").value,
      });
      panelAdminUsuarios();
    } catch (err) { alert(err.message); }
  };
}

let __actEditando = null;

function categoriasATexto(categorias) {
  return (categorias || [])
    .map((c) => {
      const nombre = String(c.nombre || "").trim();
      const subs = (c.subcategorias || []).map((s) => String(s || "").trim()).filter(Boolean);
      return subs.length ? `${nombre} > ${subs.join(", ")}` : nombre;
    })
    .join("\n");
}

function textoACategorias(texto) {
  return String(texto || "")
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      const [nombreRaw, subsRaw] = linea.split(">");
      const nombre = String(nombreRaw || "").trim();
      if (!nombre) return null;
      const subcategorias = String(subsRaw || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return { nombre, subcategorias };
    })
    .filter(Boolean);
}

async function panelAdminActividades() {
  const [act, ins, secs] = await Promise.all([
    API.actividades(),
    API.inscripciones(),
    API.secciones().catch(() => []),
  ]);
  const secPorId = {};
  secs.forEach((s) => { secPorId[s._id] = s; });
  const porAct = {};
  ins.forEach((i) => {
    if (!i || i.estado === "rechazada") return;
    const id = i.actividad ? String(i.actividad._id || i.actividad) : null;
    if (!id) return;
    porAct[id] = porAct[id] || {};
    const div = i.division || "Sin categoria";
    porAct[id][div] = porAct[id][div] || { total: 0, varones: 0, damas: 0 };
    (i.alumnos || []).forEach((al) => {
      porAct[id][div].total += 1;
      if (al.genero === "M") porAct[id][div].varones += 1;
      else if (al.genero === "F") porAct[id][div].damas += 1;
    });
  });

  const nombresCategorias = (a) => {
    if (a.categorias && a.categorias.length) return a.categorias.map((c) => c.nombre);
    return (a.divisiones || []).length ? a.divisiones : [];
  };
  const filasDesglose = (a, idA) => {
    const nombres = nombresCategorias(a);
    if (!nombres.length) {
      return `<tr><td>Sin categorias</td><td class="act-num">0</td><td class="act-num">0</td><td class="act-num">0</td></tr>`;
    }
    return nombres.map((nombreCat) => {
      const d = porAct[idA] && porAct[idA][nombreCat];
      const total = d ? d.total : 0;
      const varones = d ? d.varones : 0;
      const damas = d ? d.damas : 0;
      const cat = (a.categorias || []).find((c) => c.nombre === nombreCat);
      const subs = cat && cat.subcategorias && cat.subcategorias.length
        ? ` <span class="muted">(${esc(cat.subcategorias.join(" / "))})</span>` : "";
      return `<tr><td><strong>${esc(nombreCat)}</strong>${subs}</td><td class="act-num">${total}</td><td class="act-num">${varones}</td><td class="act-num">${damas}</td></tr>`;
    }).join("");
  };
  const totalesFila = (a, idA) => {
    const nombres = nombresCategorias(a);
    let t = 0, v = 0, d = 0;
    nombres.forEach((n) => {
      const c = porAct[idA] && porAct[idA][n];
      if (c) { t += c.total; v += c.varones; d += c.damas; }
    });
    return `<tr class="act-fila-tot"><td>Total</td><td class="act-num">${t}</td><td class="act-num">${v}</td><td class="act-num">${d}</td></tr>`;
  };
  const renderCategorias = (a) => {
    if (a.categorias && a.categorias.length) {
      return a.categorias
        .map((c) => {
          const subs = (c.subcategorias || []).join(" / ");
          return `<strong>${esc(c.nombre)}</strong>${subs ? ` <span class="muted">(${esc(subs)})</span>` : ""}`;
        })
        .join(" · ");
    }
    return esc((a.divisiones || []).join(", ") || "-");
  };

  const actConvSeccion = act.map((a) => ({
    ...a,
    seccionNombre: a.seccion && secPorId[a.seccion] ? secPorId[a.seccion].nombre : "Sin sección",
  }));

  const grupos = [];
  secs.forEach((s) => {
    const items = actConvSeccion.filter((a) => String(a.seccion) === String(s._id));
    if (items.length) grupos.push({ seccion: s.nombre, items });
  });
  const libres = actConvSeccion.filter((a) => !a.seccion);
  if (libres.length) grupos.push({ seccion: "Sin sección", items: libres });

  contenido(
    `<div class="encabezado"><h2 class="pagina">Actividades</h2>
       <button class="btn btn-primario2" id="btn-nuevo-act">+ Nueva</button>
       <button class="btn btn-mini" id="btn-seccion-act">+ Sección</button></div>

     <div id="form-nuevo-act" class="tarjeta oculta">
       <h3 id="act-form-titulo">Nueva actividad</h3>
       <div class="grid-2">
         <div class="campo"><label>Nombre</label><input id="act-nombre"></div>
         <div class="campo"><label>Area</label><select id="act-area">${(CAT.areas || []).map((a) => `<option>${esc(a)}</option>`).join("")}</select></div>
         <div class="campo"><label>Seccion</label>
           <select id="act-seccion"><option value="">Sin seccion</option>${secs.map((s) => `<option value="${s._id}">${esc(s.nombre)}</option>`).join("")}</select></div>
       </div>
       <div class="campo"><label>Categorias y subcategorias (una por linea: "Categoria > Sub1, Sub2")</label>
         <textarea id="act-categorias" rows="4" placeholder="SUB 13 > Damas, Varones"></textarea></div>
       <div class="grid-2">
         <div class="campo"><label>Recintos (separados por coma)</label><input id="act-recintos" placeholder="Cancha 1, Polideportivo"></div>
         <div class="campo"><label>Limite de inscritos (0 = sin limite)</label><input type="number" id="act-limite" value="0" min="0"></div>
         <div class="campo"><label>Estado</label><select id="act-estado">
           <option value="publicada">Publicada</option>
           <option value="en_inscripcion">En inscripcion</option>
           <option value="cerrada">Cerrada</option></select></div>
         <div class="campo"><label>Apertura inscripciones</label><input type="date" id="act-apertura"></div>
         <div class="campo"><label>Cierre inscripciones</label><input type="date" id="act-cierre"></div>
         <div class="campo"><label>Edad minima (opcional)</label><input type="number" id="act-edad-min" value="" min="0" max="120" placeholder="6"></div>
         <div class="campo"><label>Edad maxima (opcional)</label><input type="number" id="act-edad-max" value="" min="0" max="120" placeholder="18"></div>
       </div>
       <button class="btn btn-ok" id="btn-guardar-act">Guardar</button>
       <button class="btn btn-mini" id="btn-cancelar-act">Cancelar</button>
     </div>

     ${grupos.map((g, gi) => `
       <div class="tarjeta sec-tarjeta">
        <button type="button" class="sec-titulo" data-toggle-sec="${gi}" aria-expanded="false">
          <span class="act-chevron">&#9656;</span><span class="sec-nombre-titulo">${esc(g.seccion)}</span>
          <span class="badge-rol">${g.items.length} ${g.items.length === 1 ? "actividad" : "actividades"}</span>
        </button>
        <div class="sec-desg oculta" id="sec-det-${gi}">
        ${g.items.map((a) => {
          const idA = String(a._id);
          const ahora = new Date();
          const abierta = a.estado === "en_inscripcion" || a.estado === "publicada";
          const inicio = a.fechaAperturaInscripcion ? new Date(a.fechaAperturaInscripcion) : null;
          const fin = a.fechaCierreInscripcion ? new Date(a.fechaCierreInscripcion) : null;
          const dentroVentana = (!inicio || ahora >= inicio) && (!fin || ahora <= fin);
          const estadoIns = (abierta && dentroVentana) ? "Inscripciones Abiertas" : "Cerrada";
          return `<div class="tarjeta act-tarjeta">
           <button type="button" class="act-titulo" data-toggle="${idA}" aria-expanded="false">
             <span class="act-chevron">&#9656;</span><span class="act-nombre-titulo">${esc(a.nombre)}</span> <span class="badge-rol">${esc(a.area)}</span>
           </button>
           <div class="act-desg oculta" id="act-det-${idA}">
             <div class="act-grid">
               <div class="act-campo"><span class="act-label">Categorias</span><span>${renderCategorias(a)}</span></div>
               <div class="act-campo"><span class="act-label">Seccion</span><span>${esc(a.seccionNombre)}</span></div>
               <div class="act-campo"><span class="act-label">Recintos</span><span>${esc((a.recintos || []).join(", ") || "-")}</span></div>
               <div class="act-campo"><span class="act-label">Estado</span><span>${esc(a.estado)}</span></div>
               <div class="act-campo"><span class="act-label">Limite inscritos</span><span>${a.limiteInscritos ? a.limiteInscritos : "Sin limite"}</span></div>
               ${(a.edadMinima || a.edadMaxima) ? `<div class="act-campo"><span class="act-label">Edad</span><span>${a.edadMinima ?? "?"}-${a.edadMaxima ?? "?"} anios</span></div>` : ""}
             </div>
             <div class="act-desglose">
               <h4 class="act-labdesg">Estudiantes por categoria</h4>
               <table class="tabla-desglose">
                 <thead><tr><th>Categoria</th><th>Total</th><th>Varones</th><th>Damas</th></tr></thead>
                 <tbody>${filasDesglose(a, idA)}${totalesFila(a, idA)}</tbody>
               </table>
             </div>
             <p class="muted act-fila"><span class="estado ${dentroVentana ? "est-activo" : "est-cancelado"}">${estadoIns}</span>
             ${inicio ? ` Apertura: ${inicio.toLocaleDateString("es-CL")}` : ""}${fin ? ` | Cierre: ${fin.toLocaleDateString("es-CL")}` : ""}</p>
             <div class="seccion">
               <button class="btn btn-mini" data-editar-act="${idA}">Editar</button>
               <button class="btn btn-mini" data-agregar-encuentro="${idA}">Agregar Encuentro</button>
               <button class="btn btn-mini btn-peligro" data-eliminar-act="${idA}">Eliminar</button>
             </div>
           </div>
         </div>`;
        }).join("")}
        </div>
      </div>`).join("")}`
  );

  document.querySelectorAll(".sec-titulo").forEach((b) => {
    b.onclick = () => {
      const det = document.getElementById(`sec-det-${b.dataset.toggleSec}`);
      const abierto = !det.classList.contains("oculta");
      det.classList.toggle("oculta", abierto);
      b.setAttribute("aria-expanded", String(!abierto));
      b.querySelector(".act-chevron").textContent = abierto ? "▸" : "▾";
    };
  });
  document.querySelectorAll(".act-titulo").forEach((b) => {
    b.onclick = () => {
      const det = document.getElementById(`act-det-${b.dataset.toggle}`);
      const abierto = !det.classList.contains("oculta");
      det.classList.toggle("oculta", abierto);
      b.setAttribute("aria-expanded", String(!abierto));
      b.querySelector(".act-chevron").textContent = abierto ? "▸" : "▾";
    };
  });
  document.querySelectorAll("[data-editar-act]").forEach((b) => {
    b.onclick = () => {
      const a = act.find((x) => String(x._id) === String(b.dataset.editarAct));
      if (!a) return;
      abrirFormActividad(a);
    };
  });
  document.querySelectorAll("[data-agregar-encuentro]").forEach((b) => {
    b.onclick = () => {
      const fecha = prompt("Fecha del encuentro (AAAA-MM-DD):");
      if (!fecha) return;
      const hora = prompt("Hora (HH:MM):");
      const lugar = prompt("Lugar (opcional):") || "Por definir";
      API.peticion("POST", `/api/actividades/${b.dataset.agregarEncuentro}/encuentros`, { fecha, hora, lugar })
        .then(() => { panelAdminActividades(); })
        .catch((err) => alert(err.message));
    };
  });
  document.querySelectorAll("[data-eliminar-act]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Seguro que desea eliminar esta actividad?")) return;
      try {
        await API.eliminarActividad(b.dataset.eliminarAct);
        panelAdminActividades();
      } catch (err) { alert(err.message); }
    };
  });

  $("#btn-nuevo-act").onclick = () => { abrirFormActividad(null); };
  $("#btn-seccion-act").onclick = async () => {
    const nombre = prompt("Nombre de la nueva seccion:");
    if (!nombre) return;
    const area = prompt("Area (Deportiva o Artístico/Cultural):");
    try {
      await API.crearSeccion({ nombre, area });
      panelAdminActividades();
    } catch (err) { alert(err.message); }
  };
  $("#btn-cancelar-act").onclick = () => {
    __actEditando = null;
    document.getElementById("form-nuevo-act").classList.add("oculta");
  };
  $("#btn-guardar-act").onclick = async () => {
    try {
      const datos = {
        nombre: $("#act-nombre").value,
        area: $("#act-area").value,
        seccion: $("#act-seccion").value || null,
        categorias: textoACategorias($("#act-categorias").value),
        recintos: $("#act-recintos").value.split(",").map((s) => s.trim()).filter(Boolean),
        limiteInscritos: Number($("#act-limite").value) || 0,
        estado: $("#act-estado").value,
        fechaAperturaInscripcion: $("#act-apertura").value || null,
        fechaCierreInscripcion: $("#act-cierre").value || null,
        edadMinima: $("#act-edad-min").value ? Number($("#act-edad-min").value) : null,
        edadMaxima: $("#act-edad-max").value ? Number($("#act-edad-max").value) : null,
        encuentros: [],
      };
      if (__actEditando) {
        delete datos.encuentros;
        await API.actualizarActividad(__actEditando, datos);
      } else {
        await API.crearActividad(datos);
      }
      __actEditando = null;
      panelAdminActividades();
    } catch (err) { alert(err.message); }
  };
}

function abrirFormActividad(a) {
  const form = document.getElementById("form-nuevo-act");
  document.getElementById("act-form-titulo").textContent = a ? `Editar: ${a.nombre}` : "Nueva actividad";
  $("#act-nombre").value = a ? a.nombre : "";
  $("#act-area").value = a ? a.area : (CAT.areas && CAT.areas[0]);
  $("#act-seccion").value = a && a.seccion ? String(a.seccion) : "";
  $("#act-categorias").value = a ? categoriasATexto(a.categorias) : "";
  $("#act-recintos").value = a ? (a.recintos || []).join(", ") : "";
  $("#act-limite").value = a && a.limiteInscritos ? a.limiteInscritos : 0;
  $("#act-estado").value = a ? a.estado : "publicada";
  $("#act-apertura").value = a && a.fechaAperturaInscripcion ? String(a.fechaAperturaInscripcion).slice(0, 10) : "";
  $("#act-cierre").value = a && a.fechaCierreInscripcion ? String(a.fechaCierreInscripcion).slice(0, 10) : "";
  $("#act-edad-min").value = a && a.edadMinima != null ? a.edadMinima : "";
  $("#act-edad-max").value = a && a.edadMaxima != null ? a.edadMaxima : "";
  __actEditando = a ? String(a._id) : null;
  form.classList.remove("oculta");
  form.scrollIntoView({ behavior: "smooth" });
}

async function panelAdminTorneos() {
  const [tor, act] = await Promise.all([API.torneos(), API.actividades()]);
  window.__actividadesAdmin = act;
  const opActCat = opcionesActividadCategoria(act);
  contenido(
    `<div class="encabezado"><h2 class="pagina">Torneos y Sorteo</h2><button class="btn btn-primario2" id="btn-nuevo-tor">+ Nuevo Torneo</button></div>
     <div id="form-nuevo-tor" class="tarjeta oculta">
       <div class="grid-2">
         <div class="campo"><label>Nombre</label><input id="tor-nombre"></div>
         <div class="campo"><label>Actividad (Categoria)</label>${comboHtml("tor-act-txt", "Buscar actividad y categoria...")}<input type="hidden" id="tor-act"><input type="hidden" id="tor-div"></div>
         <div class="campo"><label>Formato</label><select id="tor-formato"><option value="amistoso">Amistoso</option><option value="competitivo">Competitivo</option></select></div>
         <div class="campo"><label>Semestre</label><select id="tor-sem"><option value="1">1</option><option value="2">2</option></select></div>
       </div>
       <button class="btn btn-ok" id="btn-guardar-tor">Guardar</button>
     </div>
${tor.map((t) => `<div class="tarjeta">
       <h3>${esc(t.nombre)} <span class="badge-rol">${esc(t.division || "Sin categoria")}</span> <span class="badge-rol">${esc(t.formato === "competitivo" ? "Competitivo" : "Amistoso")}</span> <span class="badge-rol">${esc(t.estado)}</span></h3>
       <p class="muted">Actividad: ${esc(t.actividad ? t.actividad.nombre : "-")} | ${esc(t.anio)} S${esc(t.semestre)} | Llave unica</p>
       ${programacionTorneoResumen(t)}
 <div class="seccion">
       <button class="btn btn-mini" data-equipos="${t._id}">Equipos</button>
       <button class="btn btn-mini" data-partidos="${t._id}" data-nombre="${esc(t.nombre)}" data-formato="${esc(t.formato || "amistoso")}">Partidos</button>
       <button class="btn btn-primario2 btn-programar" data-programar="${t._id}">Programar Torneo</button>
       <button class="btn btn-mini" data-llaves="${t._id}" data-nombre="${esc(t.nombre)}">Ver Mapa del Torneo</button></div>
       <div class="form-programar oculta" data-form-programar="${t._id}" data-torneo-nombre="${esc(t.nombre)}" data-torneo-actividad="${esc(t.actividad ? t.actividad._id || t.actividad : "")}"></div>
      </div>`).join("")}`
  );
  $("#btn-nuevo-tor").onclick = () => $("#form-nuevo-tor").classList.toggle("oculta");
  initCombo("tor-act-txt", opActCat, (o) => {
    $("#tor-act").value = o.extra.actividad;
    $("#tor-div").value = o.extra.division;
    const nombre = $("#tor-nombre");
    if (nombre && !nombre.value.trim()) {
      nombre.value = o.extra.division ? `Torneo de ${o.extra.nombre} ${o.extra.division}` : `Torneo de ${o.extra.nombre}`;
    }
  });
  $("#btn-guardar-tor").onclick = async () => {
    try {
      const nombre = $("#tor-nombre").value.trim();
      if (!nombre) { alert("Indique el nombre del torneo"); return; }
      if (!$("#tor-act").value) { alert("Seleccione una actividad (categoria)"); return; }
      await API.crearTorneo({
        nombre, actividad: $("#tor-act").value, division: $("#tor-div").value,
        semestre: Number($("#tor-sem").value), anio: new Date().getFullYear(),
        formato: $("#tor-formato").value,
        grupos: ["Llave"],
        formulario: {},
      });
      panelAdminTorneos();
    } catch (err) { alert(err.message); }
  };
  document.querySelectorAll("[data-equipos]").forEach((b) => {
    b.onclick = () => panelAdminEquipos(b.dataset.equipos);
  });
  document.querySelectorAll("[data-partidos]").forEach((b) => {
    b.onclick = () => verPartidos(b.dataset.partidos, b.dataset.nombre || "Partidos", b.dataset.formato || "amistoso");
  });
  document.querySelectorAll("[data-llaves]").forEach((b) => {
    b.onclick = () => abrirMapaTorneo(b.dataset.llaves, b.dataset.nombre).catch((err) => alert(err.message));
  });
  document.querySelectorAll("[data-programar]").forEach((b) => {
    b.onclick = () => {
      const torneoId = b.dataset.programar;
      const box = document.querySelector(`[data-form-programar="${torneoId}"]`);
      if (!box) return;
      if (box.innerHTML === "") {
        const torneo = (window.__torneosProgramables || []).find((t) => String(t._id) === String(torneoId));
        box.innerHTML = formProgramarTorneo(torneo);
      }
      box.classList.toggle("oculta");
    };
  });

  // Delegacion: guardar programacion y toggle de requisitos del formulario.
  const torCont = document.querySelector("#vista-contenido") || document.body;
  const onProgramarClick = async (e) => {
    const btn = e.target.closest("[data-guardar-programar]");
    const check = e.target.closest(".pr-req");
    if (btn) {
      const cont = btn.closest(".form-programar");
      const torneoId = cont?.dataset.formProgramar;
      if (!torneoId) { alert("Torneo invalido"); return; }
      const combinarFechaHora = (fecha, hora, porDefecto) => {
        if (!fecha) return null;
        const partes = String(hora || "");
        const hh = partes.slice(0, 2);
        const mm = partes.length >= 5 ? partes.slice(3, 5) : "00";
        const d = new Date(`${fecha}T${porDefecto || "00:00"}${porDefecto === "finDia" ? ":00" : ""}`);
        if (hh && !isNaN(Number(hh)) && hh !== "99" && !(porDefecto === "finDia" && !partes)) {
          d.setHours(Number(hh), Number(mm) || 0, porDefecto === "finDia" ? 59 : 0, porDefecto === "finDia" ? 999 : 0);
        } else if (porDefecto === "finDia") {
          d.setHours(23, 59, 59, 999);
        } else {
          d.setHours(0, 0, 0, 0);
        }
        return d.toISOString();
      };
      const datos = {
        fechaAperturaInscripcion: combinarFechaHora(
          cont.querySelector(".pr-apertura")?.value,
          cont.querySelector(".pr-apertura-h")?.value,
          "00:00"
        ),
        fechaCierreInscripcion: combinarFechaHora(
          cont.querySelector(".pr-cierre")?.value,
          cont.querySelector(".pr-cierre-h")?.value,
          "finDia"
        ),
        requisitos: {
          activo: cont.querySelector(".pr-req")?.checked || false,
          edadMinima: cont.querySelector(".pr-edad-min")?.value ? Number(cont.querySelector(".pr-edad-min").value) : null,
          edadMaxima: cont.querySelector(".pr-edad-max")?.value ? Number(cont.querySelector(".pr-edad-max").value) : null,
          genero: cont.querySelector(".pr-genero")?.value || "",
        },
      };
      try {
        await API.actualizarTorneo(torneoId, datos);
        mostrarExito("Programacion guardada correctamente. El torneo ya esta disponible en el perfil del coordinador.");
        const desglose = cont.closest("[data-form-programar]");
        if (desglose) desglose.classList.add("oculta");
        panelAdminTorneos();
      } catch (err) { alert(err.message); }
      return;
    }
    if (check) actualizarEstadoRequisitos(check);
  };
  torCont.addEventListener("click", onProgramarClick);
  torCont.addEventListener("change", onProgramarClick);
  window.__torneosProgramables = tor;
}

// Rersumen de la programacion del torneo (fechas y requisitos).
function programacionTorneoResumen(t) {
  const r = t.requisitos || {};
  const partes = [];
  if (t.fechaAperturaInscripcion) partes.push(`Apertura: ${new Date(t.fechaAperturaInscripcion).toLocaleDateString("es-CL")}`);
  if (t.fechaCierreInscripcion) partes.push(`Cierre: ${new Date(t.fechaCierreInscripcion).toLocaleDateString("es-CL")}`);
  if (r.activo) {
    const req = [];
    if (r.edadMinima != null || r.edadMaxima != null) req.push(`Edad: ${r.edadMinima ?? "?"} - ${r.edadMaxima ?? "?"}`);
    if (r.genero) req.push(`Genero: ${r.genero}`);
    partes.push(`Requisitos: ${req.join(", ") || "ver requisitos"}`);
  } else {
    partes.push("Sin requisitos");
  }
  return partes.length ? `<p class="muted">${esc(partes.join(" | "))}</p>` : "";
}

// Formulario para programar la inscripcion del torneo (fechas y requisitos).
function formProgramarTorneo(t) {
  const torneo = t || {};
  const r = torneo.requisitos || {};
  const fA = torneo.fechaAperturaInscripcion ? new Date(torneo.fechaAperturaInscripcion).toISOString().slice(0, 10) : "";
  const fC = torneo.fechaCierreInscripcion ? new Date(torneo.fechaCierreInscripcion).toISOString().slice(0, 10) : "";
  const hA = torneo.fechaAperturaInscripcion
    ? new Date(torneo.fechaAperturaInscripcion).toISOString().slice(11, 16)
    : "";
  const hC = torneo.fechaCierreInscripcion
    ? new Date(torneo.fechaCierreInscripcion).toISOString().slice(11, 16)
    : "";
  const selGenero = (v) => ["varones", "damas", "mixto"].map((g) => `<option value="${g}" ${String(r.genero) === g ? "selected" : ""}>${g === "varones" ? "Varones" : g === "damas" ? "Damas" : "Mixto"}</option>`).join("");
  return `<div class="tarjeta form-programar-inner">
      <p class="muted">Programe la ventana de inscripcion del torneo. Aparecera en el perfil del coordinador para inscribir estudiantes.</p>
      <div class="grid-2">
        <div class="campo">
          <label>Fecha de apertura</label><input type="date" class="pr-apertura" value="${fA}">
          <label style="margin-top:6px">Hora de apertura</label><input type="time" class="pr-apertura-h" value="${hA}" step="60">
        </div>
        <div class="campo">
          <label>Fecha de cierre</label><input type="date" class="pr-cierre" value="${fC}">
          <label style="margin-top:6px">Hora de cierre</label><input type="time" class="pr-cierre-h" value="${hC}" step="60">
          <p class="muted" style="margin-top:4px">Sin hora, el cierre sera a las 23:59 del dia indicado.</p>
        </div>
      </div>
      <div class="campo pr-req-row">
        <span class="pr-req-titulo">Requisitos</span>
        <label class="pr-req-check"><input type="checkbox" class="pr-req" ${r.activo ? "checked" : ""}></label>
      </div>
      <div class="grid-2 pr-req-box ${r.activo ? "" : "oculta"}">
        <div class="campo"><label>Edad minima</label><input type="number" class="pr-edad-min" min="0" value="${r.edadMinima ?? ""}"></div>
        <div class="campo"><label>Edad maxima</label><input type="number" class="pr-edad-max" min="0" value="${r.edadMaxima ?? ""}"></div>
        <div class="campo"><label>Genero permitido</label><select class="pr-genero">${selGenero()}</select></div>
      </div>
      <div class="seccion">
        <button class="btn btn-ok btn-mini" data-guardar-programar="${torneo._id || ""}">Guardar Programacion</button>
      </div>
    </div>`;
}

function actualizarEstadoRequisitos(check) {
  const box = check.closest(".form-programar-inner")?.querySelector(".pr-req-box");
  if (box) box.classList.toggle("oculta", !check.checked);
}

// Vista de la fase de grupos (todos contra todos) en horizontal con
// asignacion de horario (fecha, hora inicio, hora termino, lugar) que
// se sincroniza con la agenda.
async function verPartidos(torneoId, nombreTorneo = "Partidos", formato = "amistoso", llaveIdFoco) {
  const llaves = await API.llaves(torneoId);
  const todas = (llaves || []).slice().sort((a, b) => (a.nivel || 0) - (b.nivel || 0) || (a.orden || 0) - (b.orden || 0));

  const NOMBRE_FASES = { 1: "Final", 2: "Semifinal", 3: "Cuartos de Final", 4: "Octavos de Final" };
  const aTexto = (l) => (l.nivel >= 1 ? l.grupo || (NOMBRE_FASES[l.nivel] || "Eliminatoria") : "Fase de Grupos");
  const ORDEN_FASE = { "Fase de Grupos": 0, "Octavos de Final": 1, "Cuartos de Final": 2, "Semifinal": 3, Final: 4 };

  // Competitivo: solo los cruces del mapa del torneo (eliminatorias).
  // Si viene un partido concreto para editar, se incluye siempre aunque su fase
  // no se muestre por defecto.
  let visibles = formato === "competitivo" ? todas.filter((l) => (l.nivel || 0) >= 1) : todas;
  if (llaveIdFoco) {
    const foco = todas.find((l) => String(l._id) === String(llaveIdFoco));
    if (foco && !visibles.some((l) => String(l._id) === String(foco._id))) visibles = visibles.concat(foco);
  }

  const grupos = {};
  visibles.forEach((l) => {
    const fase = aTexto(l);
    (grupos[fase] = grupos[fase] || []).push(l);
  });
  const fasesOrden = Object.keys(grupos).sort((x, y) => (ORDEN_FASE[x] ?? 9) - (ORDEN_FASE[y] ?? 9));

  const fechaVal = (f) => (f ? new Date(f) : null);
  const dateStr = (f) => (f ? new Date(f).toISOString().slice(0, 10) : "");

  const tarjetaPartido = (p) => `<div class="tarjeta partido-horario">
        <div class="partido-linea">
          <strong>${esc(p.equipos && p.equipos[0] ? p.equipos[0].nombre : "Por definir")}</strong>
          <span class="partido-vs">VS</span>
          <strong>${esc(p.equipos && p.equipos[1] ? p.equipos[1].nombre : "Por definir")}</strong>
          <button class="btn btn-mini btn-primario2 partido-asig" data-toggle-horario="${p._id}">Asignar Horario</button>
        </div>
        <p class="muted partido-asignado">${fechaVal(p.fecha)
          ? `Fecha: ${esc(new Date(p.fecha).toLocaleDateString("es-CL"))} · Hora: ${esc(p.hora || "-")}${p.horaTermino ? ` a ${esc(p.horaTermino)}` : ""} · Lugar: ${esc(p.lugar && p.lugar !== "Por definir" ? p.lugar : "-")}`
          : "Sin horario asignado"}</p>
        <div class="horario-form oculta" data-horario-llave="${p._id}">
          <div class="grid-4">
            <div class="campo"><label>Fecha</label><input type="date" class="h-fecha" data-horario="${p._id}" value="${dateStr(p.fecha)}"></div>
            <div class="campo"><label>Hora inicio</label><input type="time" class="h-hora" data-horario="${p._id}" value="${esc(p.hora || "")}"></div>
            <div class="campo"><label>Hora termino</label><input type="time" class="h-termino" data-horario="${p._id}" value="${esc(p.horaTermino || "")}"></div>
            <div class="campo"><label>Lugar</label><input class="h-lugar" data-horario="${p._id}" value="${esc(p.lugar && p.lugar !== "Por definir" ? p.lugar : "")}" placeholder="Gimnasio, cancha..."></div>
          </div>
          <button class="btn btn-ok" data-guardar-horario="${p._id}">Guardar Horario</button>
        </div>
      </div>`;

  const cuerpoPartidos = fasesOrden.length
    ? fasesOrden.map((fase) => `
        <h3 class="subtitulo-fase">${esc(fase)}</h3>
        ${grupos[fase].map(tarjetaPartido).join("")}
      `).join("")
    : `<div class="tarjeta"><p class="muted">Aun no hay partidos. Ejecute el sorteo desde la seccion Equipos del torneo.</p></div>`;

  contenido(
    `<div class="encabezado"><h2 class="pagina">Partidos del Torneo</h2>
       <button class="btn btn-mini" id="btn-volver-partidos">Volver</button></div>
     <p class="muted">${esc(nombreTorneo)} · ${formato === "competitivo" ? "Torneo competitivo: se muestran los cruces del mapa del torneo" : "Amistoso: todos contra todos por fase"} . Asigne fecha, horario y lugar a cada partido (se sincroniza con la agenda).</p>
     ${cuerpoPartidos}`
  );
  $("#btn-volver-partidos").onclick = () => panelAdminTorneos();
  document.querySelectorAll("[data-toggle-horario]").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.toggleHorario;
      document.querySelector(`[data-horario-llave="${id}"]`)?.classList.toggle("oculta");
    };
  });
  document.querySelectorAll("[data-guardar-horario]").forEach((b) => {
    b.onclick = async () => {
      try {
        const id = b.dataset.guardarHorario;
        await API.actualizarLlave(id, {
          fecha: document.querySelector(`[data-horario="${id}"].h-fecha`)?.value,
          hora: document.querySelector(`[data-horario="${id}"].h-hora`)?.value,
          horaTermino: document.querySelector(`[data-horario="${id}"].h-termino`)?.value,
          lugar: document.querySelector(`[data-horario="${id}"].h-lugar`)?.value,
        });
        alert("Horario guardado");
        verPartidos(torneoId, nombreTorneo);
      } catch (err) { alert(err.message); }
    };
  });

  // Viniendo desde la agenda (boton "Editar"): abrir el horario del partido
  // correspondiente y resaltarlo para modificar el dia y guardar.
  if (llaveIdFoco) {
    const f = document.querySelector(`[data-horario-llave="${llaveIdFoco}"]`);
    const card = f ? f.closest(".partido-horario") : null;
    if (card) {
      f.classList.remove("oculta");
      card.style.boxShadow = "0 0 0 2px var(--acento)";
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

let __torneoBracket = null;

async function abrirModalBracket(torneoId) {
  __torneoBracket = torneoId;
  const modal = document.getElementById("modal-bracket");
  if (!modal) return;
  modal.classList.remove("oculta");
  const inter = document.getElementById("br-manual");
  if (inter) {
    inter.innerHTML = "";
    inter.classList.add("oculta");
  }
  const modo = document.getElementById("br-modo");
  if (modo) modo.value = "desempeno";
  modal.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function cargarCrucesManuales(contenedor) {
  if (!__torneoBracket) return;
  try {
    const tablas = await API.tabla(__torneoBracket);
    const tablaUnica = (tablas || [])[0] || { tabla: [] };
    const equipos = (tablaUnica.tabla || []).map((f) => f.equipo).filter(Boolean);
    if (equipos.length < 2) {
      contenedor.innerHTML = `<p class="muted">Se necesitan al menos 2 equipos con puntuacion.</p>`;
      return;
    }
    const par = equipos.map((e) => `<option value="${e._id}">${esc(e.nombre)}</option>`).join("");
    const nPares = Math.ceil(equipos.length / 2);
    let html = "<p class='muted'>Seleccione que equipo compite contra que equipo:</p>";
    for (let i = 0; i < nPares; i++) {
      html += `<div class="grid-2 br-par">
        <select data-br-eq-a>${par}</select>
        <select data-br-eq-b><option value="">(Libre / bye)</option>${par}</select>
      </div>`;
    }
    contenedor.innerHTML = html;
  } catch (err) {
    contenedor.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
  }
}

async function generarBracket() {
  const torneoId = __torneoBracket;
  if (!torneoId) return;
  const modo = document.getElementById("br-modo")?.value || "desempeno";
  const datos = { modo };
  if (modo === "manual") {
    const pares = Array.from(document.querySelectorAll(".br-par")).map((p) => {
      const a = p.querySelector("[data-br-eq-a]").value;
      const b = p.querySelector("[data-br-eq-b]").value;
      return b ? [a, b] : [a];
    });
    datos.cruces = pares.filter((p) => p[0]);
  }
  try {
    const res = await API.ejecutarBracket(torneoId, datos);
    alert(`Eliminatorias generadas (${res.totalRondas} ronda${res.totalRondas > 1 ? "s" : ""})`);
    document.getElementById("modal-bracket")?.classList.add("oculta");
    __torneoBracket = null;
    panelAdminEquipos(torneoId);
  } catch (err) {
    alert(err.message);
  }
}

// Rellena el selector de categoria (division) con las categorias de la
// actividad seleccionada y sugiere un nombre de torneo para esa categoria.
// Panel de gestion de equipos del torneo (estudiantes de distintos
// establecimientos agrupados en equipos por sorteo automatico o manual).
async function panelAdminEquipos(torneoId) {
  const [equipos, pool] = await Promise.all([
    API.equipos(torneoId),
    API.poolEquipos(torneoId),
  ]);
  contenido(
    `<div class="encabezado"><h2 class="pagina">Equipos del Torneo</h2>
       <button class="btn btn-mini" id="btn-volver-equipos">Volver</button></div>
     <div class="tarjeta">
       <h3>Ejecutar Sorteo</h3>
       <p class="muted">Genera la fase de grupos (todos contra todos) y arma las eliminatorias automaticamente segun la cantidad de equipos: 2 -> Final, 4 -> Semifinal, 8 -> Cuartos de Final, 16 -> Octavos de Final.</p>
       <button class="btn btn-ok" id="btn-ejecutar-sorteo-equipos">Ejecutar Sorteo</button>
       <button class="btn btn-mini" id="btn-generar-bracket-equipos">Generar Eliminatorias (opciones)</button>
     </div>
     <div class="tarjeta">
       <h3>Sortear Equipos Automaticamente</h3>
       <p class="muted">Distribuye los ${pool.total} estudiantes sin equipo en la cantidad indicada (min 2 estudiantes por equipo).</p>
       <div class="grid-2">
         <div class="campo"><label>Cantidad de equipos</label><input id="eq-cantidad" type="number" value="2" min="2"></div>
       </div>
       <button class="btn btn-ok" id="btn-sortear-equipos">Sortear Equipos</button>
     </div>
     <div class="tarjeta">
       <h3>Crear Equipo Manual / Mixto</h3>
       <p class="muted">Seleccione estudiantes de cualquier establecimiento (el equipo puede mezclar establecimientos).</p>
       <div class="grid-2">
         <div class="campo"><label>Nombre del equipo</label><input id="eq-nombre" placeholder="Equipo Estrellas"></div>
       </div>
       <div class="campo"><label>Estudiantes disponibles</label>
         <div id="eq-pool" class="select-pool">
           ${pool.pool.length ? pool.pool.map((a) => `<label class="pool-item">
             <input type="checkbox" value="${a._id}"> ${esc(a.nombre)} <span class="muted">- ${esc(a.establecimiento ? a.establecimiento.nombre : "Sin establecimiento")}</span>
           </label>`).join("") : '<p class="muted">No hay estudiantes sin equipo en este torneo.</p>'}
         </div>
       </div>
       <button class="btn btn-ok" id="btn-crear-equipo">Crear Equipo</button>
     </div>
     <div id="modal-bracket" class="tarjeta oculta">
       <h3>Generar Eliminatorias</h3>
       <p class="muted">Todos los equipos clasifican. Segun la cantidad se arma: 4 equipos hasta Semifinal, 8 hasta Cuartos de Final, 16 hasta Octavos de Final.</p>
       <div class="campo"><label>Modo de sorteo</label>
         <select id="br-modo">
           <option value="desempeno">Desempeno (igualado: 1° con el ultimo)</option>
           <option value="azar">Al azar</option>
           <option value="manual">Manual (elegir los enfrentamientos)</option>
         </select>
       </div>
       <div id="br-manual" class="oculta"></div>
       <button class="btn btn-ok" id="btn-generar-bracket">Generar</button>
       <button class="btn btn-mini" id="btn-cancelar-bracket">Cancelar</button>
     </div>
     <h3 class="subtitulo-seccion">Equipos actuales (${equipos.length})</h3>
     ${equipos.length ? equipos.map((e) => `<div class="tarjeta">
       <h3>${esc(e.nombre)} <button class="btn btn-mini btn-peligro float-der" data-elim-equipo="${e._id}">Eliminar</button></h3>
       <ul class="lista-alumnos">${(e.alumnos || []).map((a) => `<li><strong>${esc(a.nombre)}</strong> <span class="muted">- ${esc(a.establecimiento ? a.establecimiento.nombre : "Sin establecimiento")}</span></li>`).join("") || '<li class="muted">Sin estudiantes asignados</li>'}</ul>
     </div>`).join("") : '<p class="muted">Aun no hay equipos en este torneo.</p>'}`
  );
  $("#btn-volver-equipos").onclick = () => panelAdminTorneos();
  $("#btn-ejecutar-sorteo-equipos").onclick = async () => {
    try {
      await API.ejecutarSorteo(torneoId);
      alert("Sorteo ejecutado: fase de grupos + eliminatorias automaticas");
      panelAdminEquipos(torneoId);
    } catch (err) { alert(err.message); }
  };
  $("#btn-generar-bracket-equipos").onclick = () => abrirModalBracket(torneoId);
  $("#btn-generar-bracket")?.addEventListener("click", generarBracket);
  $("#btn-cancelar-bracket")?.addEventListener("click", () => {
    $("#modal-bracket")?.classList.add("oculta");
    window.__torneoBracket = null;
  });
  $("#br-modo")?.addEventListener("change", () => {
    const manual = document.getElementById("br-manual");
    if (!manual) return;
    manual.classList.toggle("oculta", document.getElementById("br-modo").value !== "manual");
    if (document.getElementById("br-modo").value === "manual") cargarCrucesManuales(manual);
  });
  $("#btn-sortear-equipos").onclick = async () => {
    try {
      await API.sortearEquipos(torneoId, Number($("#eq-cantidad").value));
      panelAdminEquipos(torneoId);
    } catch (err) { alert(err.message); }
  };
  $("#btn-crear-equipo").onclick = async () => {
    const alumnos = Array.from(document.querySelectorAll("#eq-pool input:checked")).map((c) => c.value);
    try {
      await API.crearEquipo(torneoId, { nombre: $("#eq-nombre").value, alumnos });
      panelAdminEquipos(torneoId);
    } catch (err) { alert(err.message); }
  };
  document.querySelectorAll("[data-elim-equipo]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("¿Eliminar este equipo?")) return;
      try { await API.eliminarEquipo(torneoId, b.dataset.elimEquipo); panelAdminEquipos(torneoId); }
      catch (err) { alert(err.message); }
    };
  });
}

// ============================================================
// Mapa (bracket) del torneo estilo Copa del Mundo.
// Se abre en pantalla completa: zoom (lupa), giro horizontal/
// vertical y arrastre con mouse o tacto (responsivo en movil).
// ============================================================
const MAPA = { CARD_W: 210, TH: 84, VS: 34, PAD: 18, H_COL_W: 260, H_GAP: 110, H_LBL: 32, V_GAP: 150, V_LEAF: 40 };
const wcMH = () => MAPA.TH * 2 + MAPA.VS;

const wcIdxGanador = (l) => {
  if (!l.ganador || !l.equipos || !l.equipos.length) return -1;
  const g = l.ganador._id || l.ganador;
  return String(l.equipos[0]._id || l.equipos[0]) === String(g) ? 0 : 1;
};

const wcIntegrantes = (equipo) => {
  if (!equipo || !equipo.alumnos || !equipo.alumnos.length) return "";
  return (equipo.alumnos || []).map((a) => a && a.nombre ? a.nombre : "").filter(Boolean).join(", ");
};

const wcTeamCard = (l, equipo, idx, top) => {
  if (!equipo) return `<div class="wc-team wc-libre" style="height:${MAPA.TH}px;top:${top}px"><span class="wc-nombre">Por definir</span></div>`;
  const gana = wcIdxGanador(l) === idx;
  const pts = l.puntajeA !== null && l.puntajeA !== undefined
    ? `<span class="wc-puntaje">${idx === 0 ? l.puntajeA : l.puntajeB}</span>` : "";
  const integrantes = wcIntegrantes(equipo);
  return `<div class="wc-team ${gana ? "ganador" : ""}" style="height:${MAPA.TH}px;top:${top}px"><span class="wc-nombre">${esc(equipo.nombre || "Libre")}</span>${integrantes ? `<span class="wc-integrantes">${esc(integrantes)}</span>` : ""}${pts}</div>`;
};

const wcDuo = (l, x, y, equipos = []) => {
  const a = l.equipos && l.equipos[0] ? l.equipos[0] : null;
  const b = l.equipos && l.equipos[1] ? l.equipos[1] : null;
  const jugable = !l.bye && l.estado === "pendiente" && a && b;
  const editable = !l.bye && l.estado === "pendiente" && l.nivel >= 1;
  const MH = wcMH();
  const topB = MAPA.TH + MAPA.VS;
  const actualA = a ? String(a._id || a) : "";
  const actualB = b ? String(b._id || b) : "";
  const opcionesEq = (lado) => (equipos.length
    ? equipos.map((e) => `<option value="${e._id}" ${String(e._id) === (lado === "a" ? actualA : actualB) ? "selected" : ""}>${esc(e.nombre)}</option>`).join("")
    : "");

  // Tablita de acciones flotante sobre el partido: Registrar Resultado /
  // Editar Emparejamiento. Se superpone al mapa del torneo.
  const acciones = [];
  if (jugable) acciones.push(`<button class="wc-reg" data-toggle-llave="${l._id}">Registrar Resultado</button>`);
  if (editable) acciones.push(`<button class="wc-reg wc-reg-editar" data-edit-llave="${l._id}">Editar Emparejamiento</button>`);
  const barH = acciones.length ? acciones.length * 26 + 4 : 0;
  const barTop = acciones.length ? Math.round(MH / 2 - barH / 2 - 8) : 0;
  const barHTML = acciones.length ? `<div class="wc-acciones" style="top:${barTop}px">${acciones.join("")}</div>` : "";
  const formTop = acciones.length ? barTop + barH + 6 : MH + 8;
  const nombreA = a ? (a.nombre || "Equipo A") : "Equipo A";
  const nombreB = b ? (b.nombre || "Equipo B") : "Equipo B";

  return `<div class="wc-duo" style="left:${Math.round(x)}px;top:${Math.round(y)}px;width:${MAPA.CARD_W}px;height:${MH}px">
    ${wcTeamCard(l, a, 0, 0)}
    ${wcTeamCard(l, b, 1, topB)}
    <div class="wc-vs" style="top:${MAPA.TH + MAPA.VS / 2 - 10}px">${l.bye ? "BYE" : "VS"}</div>
    ${barHTML}
    ${jugable ? `<div class="wc-form oculta" data-form-llave="${l._id}" style="top:${formTop}px">
        <span class="wc-form-equipo">${esc(nombreA)}</span>
        <input class="llave-in" data-in-llave="${l._id}" data-lado="a" placeholder="0" inputmode="numeric">
        <span class="wc-form-equipo">${esc(nombreB)}</span>
        <input class="llave-in" data-in-llave="${l._id}" data-lado="b" placeholder="0" inputmode="numeric">
        <button class="wc-reg" data-guardar-llave="${l._id}">Guardar</button>
      </div>` : ""}
    ${editable ? `<div class="wc-form oculta" data-form-edit-llave="${l._id}" style="top:${formTop + 40}px">
        <select class="llave-in edit-a" data-in-edit-llave="${l._id}" data-lado="a">${opcionesEq("a")}</select>
        <select class="llave-in edit-b" data-in-edit-llave="${l._id}" data-lado="b">${opcionesEq("b")}</select>
        <button class="wc-reg" data-guardar-edicion="${l._id}">OK</button>
      </div>` : ""}
  </div>`;
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const MapaTorneo = { torneoId: null, or: "h", zoom: 1, panX: 0, panY: 0 };

// Renderiza el mapa (horizontal o vertical) dentro del contenedor dado.
async function mostrarBracket(torneoId, div, or = "h") {
  const [llaves, tablas, equipos] = await Promise.all([
    API.llaves(torneoId),
    API.tabla(torneoId).catch(() => []),
    API.equipos(torneoId).catch(() => []),
  ]);
  if (!llaves || !llaves.length) {
    div.innerHTML = `<div class="world-cup"><p class="world-cup-vacio">Aun no hay partidos. Ejecute el sorteo para ver el mapa del torneo.</p></div>`;
    return;
  }
  const llavesElim = llaves.filter((l) => l.nivel >= 1);

  // ---- Tabla de puntuacion unica del torneo ----
  const grupoUnico = (tablas || [])[0] || { grupo: null, tabla: [] };
  const enOrden = (grupoUnico.tabla || []).slice().sort((x, y) => (y.pts - x.pts) || String(x.equipo && x.equipo.nombre ? x.equipo.nombre : "").localeCompare(String(y.equipo && y.equipo.nombre ? y.equipo.nombre : "")));
  const filasT = enOrden.map((f) => `<tr class="${f.pos <= 3 ? "fase-clas" : ""}"><td>${f.pos}</td><td>${esc(f.equipo && f.equipo.nombre ? f.equipo.nombre : "")}</td><td class="fase-pts">${f.pts}</td></tr>`).join("");
  const clasifican = llavesElim.length
    ? "todos clasifican a las eliminatorias"
    : "puntaje general";
  const bandGrupos = `<div class="fase-grupos"><div class="fase-group">
      <div class="fase-titulo">Tabla de puntuacion <span class="fase-sub">${clasifican}</span></div>
      ${filasT ? `<table class="fase-tabla"><thead><tr><th>#</th><th>Equipo</th><th>Pts</th></tr></thead><tbody>${filasT}</tbody></table>` : `<p class="fase-vacio">Sin partidos jugados aun</p>`}
    </div></div>`;

  // ---- Eliminatorias (bracket de clasificacion segun cantidad de equipos) ----
  let elimHTML = "";
  if (llavesElim.length) {
    const maxNivel = Math.max(...llavesElim.map((l) => l.nivel));
    const porNivel = {};
    llavesElim.forEach((l) => {
      (porNivel[l.nivel] = porNivel[l.nivel] || []).push(l);
    });
    Object.values(porNivel).forEach((lista) => lista.sort((a, b) => (a.orden || 0) - (b.orden || 0)));

    const NOMBRES = { 1: ["Final"], 2: ["Semifinal", "Final"], 3: ["Cuartos de Final", "Semifinal", "Final"], 4: ["Octavos de Final", "Cuartos de Final", "Semifinal", "Final"] };
    const nombres = NOMBRES[maxNivel] || [];

    // Calculo del layout vertical del bracket clasico.
    const MH = wcMH();
    const gapV = 64;
    const top = {};
    (porNivel[1] || []).forEach((l, i) => { top[l._id] = 40 + i * (MH + gapV); });
    for (let nv = 2; nv <= maxNivel; nv++) {
      (porNivel[nv] || []).forEach((l, i) => {
        const h1 = porNivel[nv - 1][i * 2];
        const h2 = porNivel[nv - 1][i * 2 + 1];
        const c1 = h1 ? top[h1._id] + MH / 2 : 0;
        const c2 = h2 ? top[h2._id] + MH / 2 : c1;
        top[l._id] = Math.round((c1 + c2) / 2 - MH / 2);
      });
    }

    const colW = MAPA.CARD_W + 110;
    const altoTotal = Math.max(60, Math.max(...Object.keys(top).map((k) => top[k] + MH))) + 90 + 60;
    let canvas = "";
    for (let nv = 1; nv <= maxNivel; nv++) {
      const lista = porNivel[nv] || [];
      const duos = lista.map((l) => wcDuo(l, 26, top[l._id], equipos)).join("");
      canvas += `<div class="wc-col" style="left:${(nv - 1) * colW}px;width:${MAPA.CARD_W + 90}px">
        <div class="wc-ronda-nombre" style="height:26px">${(nombres[nv - 1] || "Ronda " + nv)}</div>
        ${duos}</div>`;
    }
    const final = porNivel[maxNivel] && porNivel[maxNivel][0];
    const campeonEq = final && final.ganador
      ? (final.equipos || []).find((e) => e && (String(e._id) === String(final.ganador._id || final.ganador)))
      : null;
    const campeonHTML = `<div class="wc-campeon" style="left:${maxNivel * colW + 18}px;top:${(top[final && final._id] || 0) + MH / 2 - 28}px">
      <div class="wc-cam-titulo">Campeon</div>
      <div class="wc-cam-nombre">${campeonEq ? esc(campeonEq.nombre) : "Por definir"}</div>
    </div>`;

    elimHTML = `<div class="world-cup"><div class="world-cup-titulo">Eliminatorias</div>
      <div class="world-cup-canvas" style="width:${maxNivel * colW + 240}px;height:${altoTotal}px;position:relative">
        ${campeonHTML}${canvas}
      </div></div>`;
  }

  div.innerHTML = bandGrupos + elimHTML;
  wcEnlazarAcciones(div, torneoId, or);
}

// Botones dentro del mapa (registro de resultados).
// Los botones de la tabla ("Registrar") y del mapa ("Registrar Resultado")
// estan sincronizados: abren/cierran el mismo formulario de la llave.
function wcEnlazarAcciones(cont, torneoId, or) {
  cont.querySelectorAll("[data-toggle-llave]").forEach((bb) => {
    bb.onclick = () => {
      const id = bb.dataset.toggleLlave;
      const form = cont.querySelector(`[data-form-llave="${id}"]`);
      const abierto = form && !form.classList.contains("oculta");
      cont.querySelectorAll(`[data-form-llave="${id}"]`).forEach((f) => f.classList.add("oculta"));
      cont.querySelectorAll(`[data-form-edit-llave="${id}"]`).forEach((f) => f.classList.add("oculta"));
      if (form && !abierto) form.classList.remove("oculta");
    };
  });
  cont.querySelectorAll("[data-in-llave]").forEach((inp) => {
    inp.oninput = () => {
      const id = inp.dataset.inLlave;
      const lado = inp.dataset.lado;
      cont.querySelectorAll(`[data-in-llave="${id}"][data-lado="${lado}"]`).forEach((o) => {
        if (o !== inp) o.value = inp.value;
      });
    };
  });
  cont.querySelectorAll("[data-guardar-llave]").forEach((bb) => {
    bb.onclick = async () => {
      try {
        const id = bb.dataset.guardarLlave;
        const pa = cont.querySelector(`[data-in-llave="${id}"][data-lado="a"]`).value;
        const pb = cont.querySelector(`[data-in-llave="${id}"][data-lado="b"]`).value;
        await API.registrarResultadoLlave(id, { puntajeA: pa, puntajeB: pb });
        alert("Resultado registrado");
        await refrescarMapa();
      } catch (err) { alert(err.message); }
    };
  });
  cont.querySelectorAll("[data-edit-llave]").forEach((bb) => {
    bb.onclick = () => {
      const id = bb.dataset.editLlave;
      const form = cont.querySelector(`[data-form-edit-llave="${id}"]`);
      const abierto = form && !form.classList.contains("oculta");
      cont.querySelectorAll(`[data-form-edit-llave="${id}"]`).forEach((f) => f.classList.add("oculta"));
      cont.querySelectorAll(`[data-form-llave="${id}"]`).forEach((f) => f.classList.add("oculta"));
      if (form && !abierto) form.classList.remove("oculta");
    };
  });
  cont.querySelectorAll("[data-guardar-edicion]").forEach((bb) => {
    bb.onclick = async () => {
      try {
        const id = bb.dataset.guardarEdicion;
        const a = cont.querySelector(`[data-in-edit-llave="${id}"][data-lado="a"]`).value;
        const b = cont.querySelector(`[data-in-edit-llave="${id}"][data-lado="b"]`).value;
        if (a === b) { alert("El equipo A y B no pueden ser el mismo"); return; }
        await API.actualizarLlave(id, { equipos: [a, b] });
        alert("Emparejamiento actualizado");
        await refrescarMapa();
      } catch (err) { alert(err.message); }
    };
  });
}

// ---------- Pantalla completa del mapa ----------
function asegurarOverlay() {
  let ovl = document.getElementById("mapa-ovl");
  if (ovl) return ovl;
  ovl = document.createElement("div");
  ovl.id = "mapa-ovl";
  ovl.className = "mapa-ovl oculta";
  ovl.innerHTML = `
    <div class="mapa-ovl-bar">
      <div class="mapa-ovl-titulo">Mapa del Torneo</div>
      <div class="mapa-ovl-ctrls">
        <span class="mapa-icono" title="Lupa (zoom)">&#128269;</span>
        <button class="mapa-btn" id="mapa-out" title="Alejar">-</button>
        <span class="mapa-zoom-val" id="mapa-pct">100%</span>
        <button class="mapa-btn" id="mapa-in" title="Acercar">+</button>
        <button class="mapa-btn" id="mapa-girar" title="Girar orientacion (horizontal/vertical)">Girar</button>
        <button class="mapa-btn mapa-btn-cerrar" id="mapa-cerrar" title="Salir del mapa">Salir</button>
      </div>
    </div>
    <div class="mapa-vista" id="mapa-vista">
      <div class="mapa-mundo" id="mapa-mundo">
        <div class="mapa-lienzo" id="mapa-lienzo"></div>
      </div>
      <div class="mapa-hint">Arrastra para desplazar · Girar: horizontal/vertical · Zoom: lupa o rueda (Ctrl)</div>
    </div>`;
  document.body.appendChild(ovl);

  document.getElementById("mapa-cerrar").onclick = cerrarMapa;
  document.getElementById("mapa-in").onclick = () => ajustarZoom(1.25);
  document.getElementById("mapa-out").onclick = () => ajustarZoom(1 / 1.25);
  document.getElementById("mapa-girar").onclick = async () => {
    MapaTorneo.or = MapaTorneo.or === "h" ? "v" : "h";
    await refrescarMapa();
    ajustarAjuste();
  };

  document.addEventListener("keydown", (e) => {
    if (!ovl.classList.contains("oculta") && e.key === "Escape") cerrarMapa();
  });

  // Arrastre (mouse / tactil) y zoom con rueda o pellizco.
  const vista = document.getElementById("mapa-vista");
  const puntos = new Map();
  let pinza = null;
  vista.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, input, select")) return;
    puntos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (puntos.size === 2) {
      const p = [...puntos.values()];
      pinza = { base: Math.max(1, Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)), zoom: MapaTorneo.zoom };
    } else {
      pinza = null;
    }
    vista.classList.add("arrastrando");
    vista.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  vista.addEventListener("pointermove", (e) => {
    if (!puntos.has(e.pointerId)) return;
    const antes = puntos.get(e.pointerId);
    puntos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (puntos.size === 2 && pinza) {
      const p = [...puntos.values()];
      const md = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const zn = clamp(pinza.zoom * (md / pinza.base), 0.3, 3);
      const rect = vista.getBoundingClientRect();
      const mx = (p[0].x + p[1].x) / 2 - rect.left;
      const my = (p[0].y + p[1].y) / 2 - rect.top;
      MapaTorneo.panX = mx - (mx - MapaTorneo.panX) * (zn / MapaTorneo.zoom);
      MapaTorneo.panY = my - (my - MapaTorneo.panY) * (zn / MapaTorneo.zoom);
      MapaTorneo.zoom = zn;
    } else if (puntos.size === 1) {
      MapaTorneo.panX += e.clientX - antes.x;
      MapaTorneo.panY += e.clientY - antes.y;
    }
    aplicarVista();
  });
  const soltar = (e) => {
    puntos.delete(e.pointerId);
    pinza = null;
    if (puntos.size === 0) vista.classList.remove("arrastrando");
  };
  vista.addEventListener("pointerup", soltar);
  vista.addEventListener("pointercancel", soltar);
  vista.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.ctrlKey) {
      const rect = vista.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const zn = clamp(MapaTorneo.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.3, 3);
      MapaTorneo.panX = cx - (cx - MapaTorneo.panX) * (zn / MapaTorneo.zoom);
      MapaTorneo.panY = cy - (cy - MapaTorneo.panY) * (zn / MapaTorneo.zoom);
      MapaTorneo.zoom = zn;
    } else {
      MapaTorneo.panX -= e.deltaX;
      MapaTorneo.panY -= e.deltaY;
    }
    aplicarVista();
  }, { passive: false });

  return ovl;
}

async function refrescarMapa() {
  const lienzo = document.getElementById("mapa-lienzo");
  if (!lienzo) return;
  lienzo.innerHTML = "<div class='world-cup'><p class='world-cup-vacio'>Cargando mapa del torneo...</p></div>";
  try {
    await mostrarBracket(MapaTorneo.torneoId, lienzo, MapaTorneo.or);
  } catch (err) {
    lienzo.innerHTML = `<div class="world-cup"><p class="world-cup-vacio">${mensajeError(err)}</p></div>`;
  }
}

function aplicarVista() {
  const mundo = document.getElementById("mapa-mundo");
  const pct = document.getElementById("mapa-pct");
  if (mundo) mundo.style.transform = `translate(${MapaTorneo.panX}px, ${MapaTorneo.panY}px) scale(${MapaTorneo.zoom})`;
  if (pct) pct.textContent = Math.round(MapaTorneo.zoom * 100) + "%";
}

function centrarMapa() {
  const vista = document.getElementById("mapa-vista");
  const lienzo = document.getElementById("mapa-lienzo");
  if (!vista || !lienzo) return;
  const vw = vista.clientWidth;
  const vh = vista.clientHeight;
  const w = Math.max(lienzo.offsetWidth, 1);
  const h = Math.max(lienzo.offsetHeight, 1);
  MapaTorneo.panX = (vw - w * MapaTorneo.zoom) / 2;
  MapaTorneo.panY = (vh - h * MapaTorneo.zoom) / 2;
  aplicarVista();
}

// Ajusta el zoom inicial al 200% (mapa grande y legible) y lo centra.
function ajustarAjuste() {
  const vista = document.getElementById("mapa-vista");
  const lienzo = document.getElementById("mapa-lienzo");
  if (!vista || !lienzo) return;
  MapaTorneo.zoom = clamp(2, 0.3, 3);
  centrarMapa();
}

function ajustarZoom(factor) {
  const vista = document.getElementById("mapa-vista");
  const rect = vista ? vista.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const zn = clamp(MapaTorneo.zoom * factor, 0.3, 3);
  MapaTorneo.panX = cx - (cx - MapaTorneo.panX) * (zn / MapaTorneo.zoom);
  MapaTorneo.panY = cy - (cy - MapaTorneo.panY) * (zn / MapaTorneo.zoom);
  MapaTorneo.zoom = zn;
  aplicarVista();
}

async function abrirMapaTorneo(torneoId, nombreTorneo = "") {
  const ovl = asegurarOverlay();
  ovl.classList.remove("oculta");
  document.body.classList.add("mapa-abierto");
  MapaTorneo.torneoId = torneoId;
  const titulo = ovl.querySelector(".mapa-ovl-titulo");
  if (titulo) titulo.textContent = nombreTorneo || "Mapa del Torneo";
  MapaTorneo.or = "h";
  MapaTorneo.zoom = 2;
  MapaTorneo.panX = 0;
  MapaTorneo.panY = 0;
  await refrescarMapa();
  ajustarAjuste();
}

function cerrarMapa() {
  const ovl = document.getElementById("mapa-ovl");
  if (ovl) ovl.classList.add("oculta");
  document.body.classList.remove("mapa-abierto");
}

async function panelAdminInscripciones() {
  const [ins, est, act, tor] = await Promise.all([
    API.inscripciones(), API.establecimientos(), API.actividades(), API.torneos(),
  ]);
  const opEst = est.map((e) => ({ valor: String(e._id), texto: `${e.codigo} - ${e.nombre}` }));
  const opActCat = opcionesActividadCategoria(act);
  const opTor = tor.map((t) => ({ valor: String(t._id), texto: t.nombre }));
  contenido(
    `<h2 class="pagina">Control de Inscripciones</h2>
     <div class="seccion"><button class="btn btn-primario2" id="btn-nueva-ins">+ Nueva Inscripcion</button></div>
     <div id="form-nueva-ins" class="tarjeta oculta">
       <div class="grid-2">
         <div class="campo"><label>Establecimiento</label>${comboHtml("ins-est-txt", "Buscar establecimiento...")}<input type="hidden" id="ins-est"></div>
         <div class="campo"><label>Actividad (Categoria)</label>${comboHtml("ins-act-txt", "Buscar actividad y categoria...")}<input type="hidden" id="ins-act"><input type="hidden" id="ins-div"></div>
         <div class="campo"><label>Torneo (opcional)</label>${comboHtml("ins-tor-txt", "Buscar torneo...")}<input type="hidden" id="ins-tor"></div>
       </div>
       <button class="btn btn-ok" id="btn-guardar-ins">Enviar</button>
     </div>
     <div class="tarjeta"><table><thead><tr><th>Establecimiento</th><th>Actividad</th><th>Division</th><th>Estado</th><th>Acciones</th></tr></thead>
     <tbody>${ins.map((i) => `<tr>
       <td>${esc(i.establecimiento ? i.establecimiento.nombre : i.establecimiento)}</td>
       <td>${esc(i.actividad ? i.actividad.nombre : i.actividad)}</td>
       <td>${esc(i.division)}</td>
       <td><span class="estado est-${esc(i.estado)}">${esc(i.estado)}</span></td>
       <td>${i.estado === "en_proceso" ? `<button class="btn btn-ok btn-mini" data-acc="${i._id}" data-est="aceptada">Aceptar</button> <button class="btn btn-err2 btn-mini" data-acc="${i._id}" data-est="rechazada">Rechazar</button>` : "-"}</td>
     </tr>`).join("")}</tbody></table></div>`
  );
  $("#btn-nueva-ins").onclick = () => $("#form-nueva-ins").classList.toggle("oculta");
  initCombo("ins-est-txt", opEst, (o) => { $("#ins-est").value = o.valor; }, "Buscar establecimiento...");
  initCombo("ins-act-txt", opActCat, (o) => {
    $("#ins-act").value = o.extra.actividad;
    $("#ins-div").value = o.extra.division;
  }, "Buscar actividad y categoria...");
  initCombo("ins-tor-txt", opTor, (o) => { $("#ins-tor").value = o.valor; }, "Buscar torneo...");
  $("#btn-guardar-ins").onclick = async () => {
    try {
      const nuevo = await API.crearInscripcion({ establecimiento: $("#ins-est").value, actividad: $("#ins-act").value, division: $("#ins-div").value });
      if ($("#ins-tor").value) { /* asociacion requiere endpoint aparte; se omite por simplicidad */ }
      void nuevo;
      panelAdminInscripciones();
    } catch (err) { alert(err.message); }
  };
  document.querySelectorAll("[data-acc]").forEach((b) => {
    b.onclick = async () => {
      try { await API.cambiarEstadoInscripcion(b.dataset.acc, b.dataset.est); panelAdminInscripciones(); }
      catch (err) { alert(err.message); }
    };
  });
}

async function panelAdminValoraciones() {
  const [est, act] = await Promise.all([API.establecimientos(), API.actividades()]);
  const opEst = est.map((e) => ({ valor: String(e._id), texto: `${e.codigo} - ${e.nombre}` }));
  const opActCat = opcionesActividadCategoria(act);
  contenido(
    `<div class="encabezado"><h2 class="pagina">Ranking de Cumplimiento</h2><button class="btn btn-primario2" id="btn-nueva-val">+ Asignar</button></div>
     <div id="form-nueva-val" class="tarjeta oculta">
       <div class="grid-2">
         <div class="campo"><label>Establecimiento</label>${comboHtml("val-est-txt", "Buscar establecimiento...")}<input type="hidden" id="val-est"></div>
         <div class="campo"><label>Actividad (Categoria)</label>${comboHtml("val-act-txt", "Buscar actividad y categoria...")}<input type="hidden" id="val-act"></div>
         <div class="campo"><label>Estado</label><select id="val-estado"><option value="cumple">cumple</option><option value="regular">regular</option><option value="no_cumple">no_cumple</option></select></div>
       </div>
       <button class="btn btn-ok" id="btn-guardar-val">Guardar</button>
     </div>
     <div id="ranking"></div>`
  );
  $("#btn-nueva-val").onclick = () => $("#form-nueva-val").classList.toggle("oculta");
  initCombo("val-est-txt", opEst, (o) => { $("#val-est").value = o.valor; }, "Buscar establecimiento...");
  initCombo("val-act-txt", opActCat, (o) => { $("#val-act").value = o.extra.actividad; }, "Buscar actividad y categoria...");
  $("#btn-guardar-val").onclick = async () => {
    try {
      await API.asignarValoracion({
        establecimiento: $("#val-est").value, actividad: $("#val-act").value,
        estado: $("#val-estado").value, anio: new Date().getFullYear(), semestre: 1,
      });
      panelAdminValoraciones();
    } catch (err) { alert(err.message); }
  };
  const ranking = await API.ranking();
  $("#ranking").innerHTML = Object.entries(ranking).map(([nombre, filas]) =>
    `<div class="tarjeta"><h3>${esc(nombre)}</h3>` +
    filas.map((f) => `<span class="stat"><strong>${esc(f.establecimiento)}</strong><br><span class="badge-rol">${esc(f.estado)} (${f.valor})</span></span>`).join("") +
    `</div>`).join("");
}

async function panelAdminSolicitudes() {
  const sol = await API.solicitudes();
  contenido(
    `<h2 class="pagina">Solicitudes Pendientes</h2>
     <div class="tarjeta"><table><thead><tr><th>Tipo</th><th>Detalle</th><th>Estado</th><th>Acciones</th></tr></thead>
     <tbody>${sol.map((s) => `<tr>
       <td>${esc(s.tipo)}</td>
       <td>${esc(s.detalle)}</td>
       <td><span class="estado est-${esc(s.estado)}">${esc(s.estado)}</span></td>
       <td>${s.estado === "en_proceso" ? `<button class="btn btn-ok btn-mini" data-sol-acc="${s._id}" data-sol-est="aprobada">Aprobar</button> <button class="btn btn-err2 btn-mini" data-sol-acc="${s._id}" data-sol-est="rechazada">Rechazar</button>` : "-"}</td>
     </tr>`).join("")}</tbody></table></div>`
  );
  document.querySelectorAll("[data-sol-acc]").forEach((b) => {
    b.onclick = async () => {
      try {
        await API.responderSolicitud(b.dataset.solAcc, b.dataset.solEst, "");
        panelAdminSolicitudes();
      } catch (err) { alert(err.message); }
    };
  });
}

async function panelAdminAgenda() {
  const { eventos } = await API.agendaTorneos().catch(() => ({ eventos: [] }));
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const aYMD = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const hoyStr = aYMD(hoy);

  const eventosPorDia = {};
  for (const ev of eventos) {
    const d = new Date(ev.fecha);
    const clave = aYMD(d);
    if (!eventosPorDia[clave]) eventosPorDia[clave] = [];
    eventosPorDia[clave].push(ev);
  }

  // ------- Constructor del calendario mensual -------
  function construirCalendario() {
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth();
    const primerDia = new Date(anio, mes, 1);
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    const offset = primerDia.getDay(); // 0 = domingo
    const nombresDias = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    let html = `<div class="cal-nombre">${meses[mes]} ${anio}</div>`;
    html += `<div class="cal-grid cal-dias">${nombresDias.map((n) => `<div class="cal-dia-nombre">${n}</div>`).join("")}</div>`;
    html += `<div class="cal-grid">`;
    for (let i = 0; i < offset; i++) html += `<div class="cal-celda vacio"></div>`;
    for (let d = 1; d <= diasEnMes; d++) {
      const clave = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const hayEventos = !!eventosPorDia[clave];
      const esHoy = clave === hoyStr;
      html += `<div class="cal-celda ${esHoy ? "hoy" : ""} ${hayEventos ? "con-evento" : ""}" data-dia="${clave}">
        <span class="cal-num">${d}</span>
        ${hayEventos ? `<span class="punto-torneo" title="${eventosPorDia[clave].length} torneo(s)"></span>` : ""}
      </div>`;
    }
    html += `</div>`;
    return html;
  }

  function listarEventos(seleccionDia, buscarTexto) {
    const buscar = (buscarTexto || "").toLowerCase().trim();
    const seleccion = seleccionDia || hoyStr;

    // Busqueda global: por nombre del torneo o por fecha.
    let filtrados = eventos;
    let esFecha = false;
    if (buscar) {
      const normBuscar = buscar
        .replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1")
        .replace(/(\d{1,2})-(\d{1,2})-(\d{4})/, (m, d, mo, y) => `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
      esFecha = /^\d{4}-\d{2}-\d{2}$/.test(normBuscar);
      filtrados = eventos.filter((ev) => {
        if (esFecha) return aYMD(new Date(ev.fecha)) === normBuscar;
        return ev.torneo.toLowerCase().includes(buscar) || ev.actividad.toLowerCase().includes(buscar);
      });
    } else if (seleccionDia) {
      filtrados = eventos.filter((ev) => aYMD(new Date(ev.fecha)) === seleccionDia);
    } else {
      filtrados = eventos.filter((ev) => aYMD(new Date(ev.fecha)) === hoyStr);
    }
    filtrados.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const mostrando = buscar ? "Resultados de busqueda" : (seleccionDia ? `Torneos del ${seleccionDia}` : "Torneos de hoy");
    const puedeEditar = API.usuario && API.usuario.rol === "admin";

    const lista = filtrados.length ? filtrados.map((ev) => `
      <div class="item-agenda">
        <div class="item-agenda-cuerpo">
          <strong>${esc(ev.torneo)}</strong>
          <span class="badge-rol">${esc(ev.division || ev.actividad)}</span>
          <p class="muted"><span class="badge-rol">${esc(ev.fase || ev.grupo || "Fase de Grupos")}</span></p>
          <p class="agenda-equipos"><strong>${esc(ev.equipos && ev.equipos[0] ? ev.equipos[0] : "Por definir")}</strong> vs <strong>${esc(ev.equipos && ev.equipos[1] ? ev.equipos[1] : "Por definir")}</strong></p>
          <p class="muted">${esc(new Date(ev.fecha).toLocaleDateString("es-CL"))} - ${esc(ev.hora)}${ev.horaTermino ? ` a ${esc(ev.horaTermino)}` : ""} @ ${esc(ev.lugar)}</p>
        </div>
        ${puedeEditar ? `<button class="btn btn-mini btn-primario2 item-agenda-editar" data-editar-partido="${ev.llaveId}" data-t-id="${ev.torneoId}" data-t-nombre="${esc(ev.torneo)}" data-t-formato="${esc(ev.formato || "amistoso")}">Editar</button>` : ""}
      </div>`).join("")
      : `<p class="muted">No hay torneos para esta fecha.</p>`;

    return `
      <div class="separador-agenda">${esc(mostrando)}</div>
      ${lista}`;
  }

  contenido(
    `<h2 class="pagina">Agenda de Torneos</h2>
     <div class="agenda-layout">
       <div class="panel-calendario">
         ${construirCalendario()}
       </div>
       <div class="panel-lista">
         <div class="campo">
           <label>Buscar torneo o fecha</label>
           <input id="agenda-buscar" placeholder="Nombre del torneo o fecha (aaaa-mm-dd)">
         </div>
         <div id="agenda-lista">${listarEventos(null, "")}</div>
       </div>
     </div>`
  );

  const render = () => {
    $("#agenda-lista").innerHTML = listarEventos(null, $("#agenda-buscar").value);
  };

  $("#agenda-buscar").addEventListener("input", render);

  // Boton "Editar" de cada partido: abre los partidos del torneo (Torneos y Sorteo)
  // con el horario de ese partido listo para cambiar el dia y guardar.
  $("#agenda-lista").addEventListener("click", (e) => {
    const b = e.target.closest("[data-editar-partido]");
    if (!b) return;
    verPartidos(b.dataset.tId, b.dataset.tNombre || "Partidos", b.dataset.tFormato || "amistoso", b.dataset.editarPartido);
  });

  document.querySelectorAll(".cal-celda").forEach((c) => {
    if (c.classList.contains("vacio")) return;
    c.onclick = () => {
      document.querySelectorAll(".cal-celda").forEach((x) => x.classList.remove("seleccionado"));
      c.classList.add("seleccionado");
      $("#agenda-buscar").value = "";
      $("#agenda-lista").innerHTML = listarEventos(c.dataset.dia, "");
    };
  });
}

async function panelAdminReportes() {
  const [part, ben, hist] = await Promise.all([
    API.participaciones().catch(() => []),
    API.beneficiarios().catch(() => ({ total: 0, semestres: [], porEstablecimiento: [] })),
    API.historico().catch(() => ({})),
  ]);
  contenido(
    `<h2 class="pagina">Reportes y Estadisticas</h2>
     <div class="tarjeta"><h3>Total de Beneficiarios</h3>
       <div class="stat"><div class="num">${ben.total}</div><div class="lbl">Beneficiarios</div></div>
       ${(ben.semestres || []).map((s) => `<span class="stat"><div class="num">${s.total}</div><div class="lbl">Semestre ${s._id}</div></span>`).join("")}
     </div>
     <div class="tarjeta"><h3>Participaciones por Establecimiento</h3>
       <table><thead><tr><th>Codigo</th><th>Establecimiento</th><th>Total</th><th>Aceptadas</th></tr></thead>
       <tbody>${part.map((p) => `<tr><td>${esc(p.codigo)}</td><td>${esc(p.nombre)}</td><td>${p.total}</td><td>${p.aceptadas}</td></tr>`).join("")}</tbody></table>
     </div>
     <div class="tarjeta"><h3>Trazabilidad Historica</h3>
       <p class="muted">${esc(JSON.stringify(hist.porAnio || []))}</p>
     </div>`
  );
}

// ============================================================
// PANELES COORDINADOR
// ============================================================
async function panelCoordResumen() {
  const nomina = await API.nomina().catch(() => ({ total: 0, porActividad: [] }));
  contenido(
    `<h2 class="pagina">Resumen del Establecimiento</h2>
     <div class="stat"><div class="num">${nomina.total}</div><div class="lbl">Estudiantes inscritos</div></div>
     <div class="seccion"><button class="btn" id="btn-vercat">Ver Cartelera</button></div>
     <div id="cartelera" class="oculta"></div>`
  );
  $("#btn-vercat").onclick = () => cargarCarteleraEn("#cartelera");
}

async function cargarCarteleraEn(sel) {
  const div = $(sel);
  if (div.innerHTML) { div.classList.toggle("oculta"); return; }
  const act = await API.actividades();
  div.innerHTML = `<div class="grid-2 cartelera-f">
      <div class="campo"><label>Buscar actividad</label><input id="cart-buscar" placeholder="Por nombre o area..." autocomplete="off"></div>
      <div class="campo"><label>Area</label><select id="cart-area"><option value="">Todas las areas</option><option value="Deportiva">Deportiva</option><option value="Artistico/Cultural">Artistico / Cultural</option></select></div>
    </div><div id="cart-items">${act.map((a) => {
    const ahora = new Date();
    const inicio = a.fechaAperturaInscripcion ? new Date(a.fechaAperturaInscripcion) : null;
    const fin = a.fechaCierreInscripcion ? new Date(a.fechaCierreInscripcion) : null;
    const dentroVentana = (!inicio || ahora >= inicio) && (!fin || ahora <= fin);
    const abierta = a.estado === "en_inscripcion" || a.estado === "publicada";
    const puedeInscribir = abierta && dentroVentana;
    return `<div class="tarjeta" data-busq="${esc((a.nombre + " " + a.area).toLowerCase())}" data-area="${esc(a.area)}"><h3>${esc(a.nombre)} <span class="badge-rol">${esc(a.area)}</span></h3>
    <p class="muted">Categorias: ${esc(a.divisiones.join(", "))} | Estado: ${esc(a.estado)}${a.limiteInscritos ? ` | Cupos: ${a.limiteInscritos}` : ""}${a.edadMinima || a.edadMaxima ? ` | Edad: ${a.edadMinima ?? "?"}-${a.edadMaxima ?? "?"} anios` : ""}</p>
    <p class="muted"><span class="estado ${puedeInscribir ? "est-activo" : "est-cancelado"}">${puedeInscribir ? "Inscripciones Abiertas" : "Cerrada"}</span>
    ${inicio ? ` Apertura: ${inicio.toLocaleDateString("es-CL")}` : ""}${fin ? ` | Cierre: ${fin.toLocaleDateString("es-CL")}` : ""}</p>
    <div class="seccion">
      ${puedeInscribir ? `<button class="btn btn-mini" data-ins-act="${a._id}">Inscribir</button>` : ""}
      <button class="btn btn-mini" data-ver-part="${a._id}">Ver Participantes</button>
    </div>
    <div id="form-act-${a._id}" class="oculta campo">
      <label>Categoria</label>${comboHtml(`div-${a._id}-txt`, "Buscar categoria...")}<input type="hidden" id="div-${a._id}">
      <div id="form-post-${a._id}" class="oculta">
        <div class="grid-2">
          <div class="campo"><label>RUT</label><input data-pp-rut="${a._id}" autocomplete="off"></div>
          <div class="campo"><label>Nombres</label><input data-pp-nom="${a._id}" autocomplete="off"></div>
          <div class="campo"><label>Apellidos</label><input data-pp-ape="${a._id}" autocomplete="off"></div>
          <div class="campo"><label>Genero</label><select data-pp-gen="${a._id}"><option value="M">Masculino</option><option value="F">Femenino</option></select></div>
          <div class="campo"><label>Fecha nacimiento</label><input type="date" data-pp-fec="${a._id}"></div>
          <div class="campo"><label>Edad (automatica)</label><input data-pp-edad="${a._id}" readonly></div>
        </div>
        <button class="btn btn-ok btn-mini" data-aceptar-post="${a._id}">Aceptar</button>
      </div>
    </div>
    <div id="part-${a._id}" class="oculta tarjeta-tor"></div></div>`;
    }).join("")}</div>`;
  const cartBuscar = $("#cart-buscar");
  const cartArea = $("#cart-area");
  const itemsCart = $("#cart-items");
  const filtrarCart = () => {
    const q = (cartBuscar.value || "").toLowerCase();
    const ar = cartArea.value;
    itemsCart.querySelectorAll(".tarjeta").forEach((t) => {
      const okB = !q || (t.dataset.busq || "").includes(q);
      const okA = !ar || (t.dataset && t.dataset.area) === ar;
      t.classList.toggle("oculta", !(okB && okA));
    });
  };
  if (cartBuscar) cartBuscar.oninput = filtrarCart;
  if (cartArea) cartArea.onchange = filtrarCart;
  div.classList.remove("oculta");
  let nomina = await API.nomina().catch(() => ({ alumnos: [] }));
  const renderPart = (id) => {
    const cont = $(`#part-${id}`);
    if (!cont) return;
    const lista = (nomina.alumnos || []).filter((x) => String(x.actividad && x.actividad._id) === String(id));
    cont.innerHTML = lista.length
      ? `<table><thead><tr><th>RUT</th><th>Nombre</th><th>Categoria</th></tr></thead>
         <tbody>${lista.map((x) => `<tr><td>${esc(x.rut)}</td><td>${esc(x.nombre)}</td><td>${esc(x.division)}</td></tr>`).join("")}</tbody></table>`
      : "<p class='muted'>Sin participantes registrados.</p>";
    cont.classList.toggle("oculta");
  };
  div.querySelectorAll("[data-ins-act]").forEach((b) => b.onclick = () => $(`#form-act-${b.dataset.insAct}`).classList.toggle("oculta"));
  div.querySelectorAll("[data-ver-part]").forEach((b) => b.onclick = () => renderPart(b.dataset.verPart));
  act.forEach((a) => {
    if (!a.divisiones || !a.divisiones.length) return;
    initCombo(`div-${a._id}-txt`, a.divisiones.map((d) => ({ valor: d, texto: d })), (o) => {
      $(`#div-${a._id}`).value = o.valor;
      const fp = $(`#form-post-${a._id}`);
      if (fp) fp.classList.remove("oculta");
    }, "Buscar categoria...");
  });
  div.querySelectorAll("[data-pp-fec]").forEach((f) => f.addEventListener("input", () => {
    const id = f.dataset.ppFec;
    const nac = new Date(f.value);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    const campo = document.querySelector(`[data-pp-edad="${id}"]`);
    if (campo) campo.value = f.value && Number.isFinite(edad) ? `${edad} anio(s)` : "";
  }));
  div.querySelectorAll("[data-aceptar-post]").forEach((b) => b.onclick = async () => {
    const id = b.dataset.aceptarPost;
    const divTxt = document.querySelector(`#div-${id}-txt`).value.trim();
    const division = $(`#div-${id}`).value || divTxt;
    const rut = document.querySelector(`[data-pp-rut="${id}"]`).value.trim();
    const nom = document.querySelector(`[data-pp-nom="${id}"]`).value.trim();
    const ape = document.querySelector(`[data-pp-ape="${id}"]`).value.trim();
    const gen = document.querySelector(`[data-pp-gen="${id}"]`).value;
    const fec = document.querySelector(`[data-pp-fec="${id}"]`).value;
    if (!division) { alert("Seleccione la categoria primero"); return; }
    if (!rut || !nom || !fec) { alert("Complete al menos RUT, Nombres y Fecha de nacimiento"); return; }
    try {
      await API.peticion("POST", "/api/inscripciones/postular", {
        actividad: id,
        division,
        alumno: { rut, nombre: `${nom} ${ape}`.trim(), genero: gen, fechaNacimiento: fec },
      });
      alert("Postulante agregado a la nomina");
      nomina = await API.nomina().catch(() => nomina);
      document.querySelector(`[data-pp-rut="${id}"]`).value = "";
      document.querySelector(`[data-pp-nom="${id}"]`).value = "";
      document.querySelector(`[data-pp-ape="${id}"]`).value = "";
      document.querySelector(`[data-pp-fec="${id}"]`).value = "";
      document.querySelector(`[data-pp-edad="${id}"]`).value = "";
      const contPart = $(`#part-${id}`);
      if (contPart && !contPart.classList.contains("oculta")) renderPart(id);
    } catch (err) { alert(err.message); }
  });

  // Torneos programados (admin definio fechas/requisitos) visibles para inscribirse.
  const tor = await API.torneos().catch(() => []);
  const torneoAbiertos = tor.filter((t) => {
    if (t.estado !== "inscripciones") return false;
    const ahora = new Date();
    const inicio = t.fechaAperturaInscripcion ? new Date(t.fechaAperturaInscripcion) : null;
    const fin = t.fechaCierreInscripcion ? new Date(t.fechaCierreInscripcion) : null;
    if (inicio && ahora < inicio) return false;
    if (fin && ahora > fin) return false;
    return t.fechaAperturaInscripcion || t.fechaCierreInscripcion || (t.requisitos && t.requisitos.activo);
  });
  if (torneoAbiertos.length) {
    const blocTorneos = document.createElement("div");
    blocTorneos.innerHTML = `<h3 class="pagina">Torneos con inscripcion</h3>` + torneoAbiertos.map((t) => {
      const req = t.requisitos || {};
      const inicio = t.fechaAperturaInscripcion ? new Date(t.fechaAperturaInscripcion) : null;
      const fin = t.fechaCierreInscripcion ? new Date(t.fechaCierreInscripcion) : null;
      const reqTxt = req.activo
        ? `Edad ${req.edadMinima ?? "?"}-${req.edadMaxima ?? "?"} anios${req.genero ? ` | Solo ${req.genero}` : ""}`
        : "Sin requisitos";
      return `<div class="tarjeta"><h3>${esc(t.nombre)} <span class="badge-rol">${esc(t.division || "")}</span></h3>
      <p class="muted">Actividad: ${esc(t.actividad ? t.actividad.nombre : "-")} | Categoria: ${esc(t.division || "Sin categoria")}</p>
      <p class="muted">Apertura: ${inicio ? inicio.toLocaleDateString("es-CL") : "-"} | Cierre: ${fin ? fin.toLocaleDateString("es-CL") : "-"}</p>
      <p class="muted">Requisitos: ${esc(reqTxt)}</p></div>`;
    }).join("");
    div.appendChild(blocTorneos);
  }
}

async function panelCoordLectores() {
  const usuarios = await API.usuarios();
  contenido(
    `<div class="encabezado"><h2 class="pagina">Lectores del Establecimiento</h2><button class="btn btn-primario2" id="btn-nuevo-enc">+ Nuevo Lector</button></div>
     <div id="form-nuevo-enc" class="tarjeta oculta">
       <div class="grid-2">
         <div class="campo"><label>RUT</label><input id="enc-rut"></div>
         <div class="campo"><label>Nombre</label><input id="enc-nombre"></div>
         <div class="campo"><label>Clave</label><input id="enc-clave"></div>
       </div>
       <button class="btn btn-ok" id="btn-guardar-enc">Guardar</button>
     </div>
     <div class="tarjeta"><table><thead><tr><th>RUT</th><th>Nombre</th><th>Establecimiento</th></tr></thead>
     <tbody>${usuarios.map((u) => `<tr><td>${esc(u.rut)}</td><td>${esc(u.nombre)}</td><td>${esc(u.establecimiento ? u.establecimiento.nombre : "-")}</td></tr>`).join("")}</tbody></table></div>`
  );
  $("#btn-nuevo-enc").onclick = () => $("#form-nuevo-enc").classList.toggle("oculta");
  $("#btn-guardar-enc").onclick = async () => {
    try {
      await API.crearUsuario({
        rut: $("#enc-rut").value, nombre: $("#enc-nombre").value, rol: "lector",
        clave: $("#enc-clave").value, establecimiento: API.usuario.establecimiento._id,
      });
      panelCoordLectores();
    } catch (err) { alert(err.message); }
  };
}

async function panelCoordInscribir() {
  const [ins, tor] = await Promise.all([API.inscripciones(), API.torneos().catch(() => [])]);
  const ahora = new Date();
  const torAbiertos = tor.filter((t) => {
    if (t.estado !== "inscripciones") return false;
    const inicio = t.fechaAperturaInscripcion ? new Date(t.fechaAperturaInscripcion) : null;
    const fin = t.fechaCierreInscripcion ? new Date(t.fechaCierreInscripcion) : null;
    return (!inicio || ahora >= inicio) && (!fin || ahora <= fin);
  });
  const opcionesTorneo = torAbiertos.map((t) => `<option value="${t._id}">${esc(t.nombre)}</option>`).join("");
  const opAsocTor = torAbiertos.map((t) => ({ valor: String(t._id), texto: t.nombre }));
  contenido(
    `<h2 class="pagina">Postulaciones</h2>
     <div class="postula-fila">
       <div class="postula-cartelera">
         <h3>Cartelera de Actividades</h3>
         <div id="cartelera-c"></div>
       </div>
       <div class="postula-ins tarjeta">
         <h3>Mis Inscripciones</h3>
         <table><thead><tr><th>Actividad</th><th>Division</th><th>Estado</th><th>Acciones</th></tr></thead>
         <tbody>${ins.map((i) => `<tr>
           <td>${esc(i.actividad ? i.actividad.nombre : "-")}</td><td>${esc(i.division)}</td>
           <td><span class="estado est-${esc(i.estado)}">${esc(i.estado)}</span></td>
           <td>${i.estado === "en_proceso" ? '<button class="btn btn-err2 btn-mini" data-retract="' + i._id + '">Retractar</button>' : "-"}</td>
         </tr>`).join("")}</tbody></table>${opcionesTorneo ? `<div class="campo" style="margin-top:12px"><label>Asociar al Torneo (requisitos validados)</label>
         <div class="seccion"><select id="asoc-ins"></select>${comboHtml("asoc-tor-txt", "Buscar torneo...")}<input type="hidden" id="asoc-tor">
         <button class="btn btn-ok btn-mini" id="btn-asoc-tor">Asociar</button></div></div>` : ""}
       </div>
     </div>`
  );
  cargarCarteleraEn("#cartelera-c");
  document.querySelectorAll("[data-retract]").forEach((b) => {
    b.onclick = async () => { try { await API.peticion("DELETE", `/api/inscripciones/${b.dataset.retract}`); panelCoordInscribir(); } catch (err) { alert(err.message); } };
  });
  initCombo("asoc-tor-txt", opAsocTor, (o) => { $("#asoc-tor").value = o.valor; }, "Buscar torneo...");
  const selAsocIns = $("#asoc-ins");
  if (selAsocIns) {
    const aceptadas = ins.filter((i) => i.estado === "aceptada");
    selAsocIns.innerHTML = aceptadas.map((i) => `<option value="${i._id}">${esc(i.actividad ? i.actividad.nombre : "-")} - ${esc(i.division)}</option>`).join("") || "<option value=''>Sin inscripciones aceptadas</option>";
    $("#btn-asoc-tor").onclick = async () => {
      try {
        const res = await API.asociarTorneo(selAsocIns.value, $("#asoc-tor").value);
        alert("Inscripcion asociada al torneo\n" + (res.inscripcion && res.inscripcion.torneo || ""));
        panelCoordInscribir();
      } catch (err) { alert(err.message); }
    };
  }
}

{ /* notas de soporte para agregar alumnos dentro del panel coordinador */ }
function panelCoordSolicitudes() { return panelCoordSolicitudesImpl(); }

// Modulo del coordinador: postular estudiantes a los torneos programados por
// el Admin DAEM. Se puede postular desde la nomina de la actividad/categoria
// del torneo o registrando un estudiante nuevo (queda en la nomina y se
// inscribe al torneo).
async function panelCoordTorneos() {
  const [torneos, nomina] = await Promise.all([
    API.torneosPostulables().catch(() => []),
    API.nomina().catch(() => ({ alumnos: [] })),
  ]);
  const alumnos = nomina.alumnos || [];

  const tarjetaTorneo = (t) => {
    const actId = t.actividad ? String(t.actividad._id || t.actividad) : "";
    const actNombre = t.actividad ? t.actividad.nombre : "Sin actividad";
    const division = t.division || "";

    const yaPostulados = alumnos.filter((a) =>
      (a.torneos || []).some((x) => String(x._id || x) === String(t._id))
    );
    const candidatos = alumnos.filter((a) => {
      if (a.actividad && String(a.actividad._id || a.actividad) !== actId) return false;
      if (a.division !== division) return false;
      return !(a.torneos || []).some((x) => String(x._id || x) === String(t._id));
    });

    const opciones = candidatos.length
      ? candidatos.map((a) => `<option value="${a._id}">${esc(a.rut)} - ${esc(a.nombre)} (${esc(a.division)})</option>`).join("")
      : `<option value="">Sin estudiantes disponibles en esta categoria</option>`;

    const aYTxt = [
      t.fechaAperturaInscripcion ? `Apertura: ${new Date(t.fechaAperturaInscripcion).toLocaleDateString("es-CL")}` : "",
      t.fechaCierreInscripcion ? `Cierre: ${new Date(t.fechaCierreInscripcion).toLocaleDateString("es-CL")}` : "",
    ].filter(Boolean).join(" | ");

    return `<div class="tarjeta">
      <h3>${esc(t.nombre)} <span class="badge-rol">${esc(division)}</span> <span class="badge-rol">${esc(t.formato === "competitivo" ? "Competitivo" : "Amistoso")}</span></h3>
      <p class="muted">Actividad: ${esc(actNombre)} | ${esc(aYTxt)} | Postulados de mi establecimiento: ${t.postulados ?? yaPostulados.length}</p>
      <div class="grid-2">
        <div class="campo">
          <label>Postular desde la nomina (${esc(actNombre)} - ${esc(division)})</label>
          <select data-tor-nom="${t._id}">${opciones}</select>
          <button class="btn btn-ok btn-mini" data-post-nom="${t._id}">Postular seleccionado</button>
        </div>
        <div class="campo">
          <label>O registrar un estudiante nuevo</label>
          <div class="grid-2">
            <div class="campo"><input data-n-rut="${t._id}" placeholder="RUT"></div>
            <div class="campo"><input data-n-nom="${t._id}" placeholder="Nombres"></div>
            <div class="campo"><input data-n-ape="${t._id}" placeholder="Apellidos"></div>
            <div class="campo"><select data-n-gen="${t._id}"><option value="M">Masculino</option><option value="F">Femenino</option></select></div>
            <div class="campo"><input type="date" data-n-fec="${t._id}"></div>
            <div class="campo"><input data-n-edad="${t._id}" placeholder="Edad (auto)" readonly></div>
          </div>
          <button class="btn btn-ok btn-mini" data-post-nuevo="${t._id}">Agregar y postular</button>
        </div>
      </div>
      <p class="muted" style="margin-top:8px">Postulados:</p>
      ${yaPostulados.length
        ? `<table class="tabla-desglose"><thead><tr><th>RUT</th><th>Nombre</th><th>Categoria</th></tr></thead>
           <tbody>${yaPostulados.map((a) => `<tr><td>${esc(a.rut)}</td><td>${esc(a.nombre)}</td><td>${esc(a.division)}</td></tr>`).join("")}</tbody></table>`
        : `<p class="muted">Aun no hay postulados de su establecimiento.</p>`}
    </div>`;
  };

  contenido(
    `<h2 class="pagina">Postular a Torneos</h2>
     <p class="muted">Torneos programados por el Admin DAEM. Postule estudiantes de la nomina de la actividad correspondiente o registre uno nuevo (se agrega a la nomina y se inscribe al torneo).</p>
     ${torneos.length ? torneos.map(tarjetaTorneo).join("") : `<div class="tarjeta"><p class="muted">No hay torneos en periodo de inscripciones.</p></div>`}`
  );

  // Edad automatica al elegir la fecha de nacimiento del estudiante nuevo.
  const calcEdad = (fec) => {
    if (!fec) return "";
    const nac = new Date(fec);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return Number.isFinite(edad) ? `${edad} anio(s)` : "";
  };
  document.querySelectorAll("[data-n-fec]").forEach((f) => {
    f.addEventListener("input", () => {
      const campo = document.querySelector(`[data-n-edad="${f.dataset.nFec}"]`);
      if (campo) campo.value = calcEdad(f.value);
    });
  });

  const obtenerNuevo = (id) => ({
    rut: document.querySelector(`[data-n-rut="${id}"]`)?.value.trim() || "",
    nombre: document.querySelector(`[data-n-nom="${id}"]`)?.value.trim() || "",
    apellidos: document.querySelector(`[data-n-ape="${id}"]`)?.value.trim() || "",
    genero: document.querySelector(`[data-n-gen="${id}"]`)?.value || "M",
    fechaNacimiento: document.querySelector(`[data-n-fec="${id}"]`)?.value || "",
  });

  const refrescar = () => panelCoordTorneos();

  document.querySelectorAll("[data-post-nom]").forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.postNom;
      const sel = document.querySelector(`[data-tor-nom="${id}"]`);
      const alumnoId = sel && sel.value;
      if (!alumnoId) { alert("Seleccione un estudiante de la nomina"); return; }
      try {
        const r = await API.postularTorneo(id, { alumnoId });
        alert(r.mensaje); refrescar();
      } catch (err) { alert(err.message); }
    };
  });

  document.querySelectorAll("[data-post-nuevo]").forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.postNuevo;
      const n = obtenerNuevo(id);
      if (!n.rut || !n.nombre || !n.fechaNacimiento) { alert("Complete RUT, Nombres y Fecha de nacimiento"); return; }
      try {
        const r = await API.postularTorneo(id, { alumno: { rut: n.rut, nombre: `${n.nombre} ${n.apellidos}`.trim(), genero: n.genero, fechaNacimiento: n.fechaNacimiento } });
        alert(r.mensaje); refrescar();
      } catch (err) { alert(err.message); }
    };
  });
}

async function panelCoordSolicitudesImpl() {
  const solicitudes = await API.solicitudes();
  const encAlumnos = await API.inscripciones();
  const opAlIns = encAlumnos.filter((i) => i.estado === "aceptada")
    .sort((a, b) => (a.actividad?.nombre || "").localeCompare(b.actividad?.nombre || "") || (a.division || "").localeCompare(b.division || ""))
    .map((i) => ({ valor: String(i._id), texto: `${i.actividad ? i.actividad.nombre : ""} - ${i.division}` }));
  contenido(
    `<h2 class="pagina">Solicitudes y Estado</h2>
     <div class="seccion"><button class="btn btn-ok" id="btn-agregar-alumno">Agregar Estudiante a Inscripcion</button></div>
     <div id="agregar-alumno-box" class="oculta tarjeta">
       <div class="grid-2">
         <div class="campo"><label>Inscripcion (aceptada)</label>${comboHtml("al-ins-txt", "Buscar inscripcion...")}<input type="hidden" id="al-ins"></div>
         <div class="campo"><label>RUT alumno</label><input id="al-rut"></div>
         <div class="campo"><label>Nombre</label><input id="al-nombre"></div>
         <div class="campo"><label>Genero</label><select id="al-genero"><option value="M">Masculino</option><option value="F">Femenino</option><option value="Otro">Otro</option></select></div>
         <div class="campo"><label>Fecha nacimiento (validada por categoria)</label><input type="date" id="al-fecha"></div>
       </div>
       <button class="btn btn-ok" id="btn-guardar-al">Agregar</button>
     </div>
     <div class="tarjeta"><h3>Estado de Solicitudes</h3>
       <table><thead><tr><th>Tipo</th><th>Detalle</th><th>Estado</th></tr></thead>
       <tbody>${solicitudes.map((s) => `<tr><td>${esc(s.tipo)}</td><td>${esc(s.detalle)}</td><td><span class="estado est-${esc(s.estado)}">${esc(s.estado)}</span></td></tr>`).join("")}</tbody></table>
     </div>`
  );
  $("#btn-agregar-alumno").onclick = () => $("#agregar-alumno-box").classList.toggle("oculta");
  initCombo("al-ins-txt", opAlIns, (o) => { $("#al-ins").value = o.valor; }, "Buscar inscripcion...");
  $("#btn-guardar-al").onclick = async () => {
    try {
      await API.agregarAlumno($("#al-ins").value, {
        rut: $("#al-rut").value, nombre: $("#al-nombre").value, fechaNacimiento: $("#al-fecha").value, genero: $("#al-genero").value,
      });
      alert("Estudiante agregado (la categoria valida el anio de nacimiento)"); panelCoordSolicitudes();
    } catch (err) { alert(err.message); }
  };
}

// Tabla de la nomina (reutilizada por el listado siempre visible del panel).
function tablaAlumnosNomina(alumnos) {
  return `<div class="tarjeta"><h3>Nomina de Estudiantes <span class="muted">(${alumnos.length})</span></h3>
    <table><thead><tr><th>RUT</th><th>Nombre</th><th>Genero</th><th>Actividad</th><th>Categoria</th></tr></thead>
    <tbody>${alumnos.length
      ? alumnos.map((a) => `<tr><td>${esc(a.rut)}</td><td>${esc(a.nombre)}</td><td>${esc(a.genero === "M" ? "Masc" : a.genero === "F" ? "Fem" : "Otro")}</td><td>${esc(a.actividad ? a.actividad.nombre : "")}</td><td>${esc(a.division)}</td></tr>`).join("")
      : '<tr><td colspan="5" class="muted">Sin estudiantes para los filtros seleccionados.</td></tr>'}</tbody></table>
  </div>`;
}

async function panelCoordNomina() {
  const nomina = await API.nomina();
  const alumnos = nomina.alumnos || [];
  // Actividades y categorias presentes en la nomina del propio establecimiento.
  const actividades = [...new Set(alumnos.map((a) => a.actividad && a.actividad.nombre).filter(Boolean))].sort();
  const categorias = [...new Set(alumnos.map((a) => a.division).filter(Boolean))].sort();
  const subcategorias = ["Damas", "Varones"].map((s) => ({ valor: s, texto: s }));

  contenido(
    `<div class="encabezado"><h2 class="pagina">Nomina Interna de Estudiantes</h2>
       <button class="btn btn-primario2" id="btn-filtrar">Filtrar</button></div>
     <div class="stat"><div class="num">${nomina.total}</div><div class="lbl">Total</div></div>
     <div class="nomina-fila">
       <div class="nomina-lista" id="alumnos-lista"></div>
       <div class="tarjeta oculta nomina-filtros" id="nomina-filtros">
         <h3>Filtrar</h3>
         <div class="campo"><label>Nombre</label><input id="flt-nombre" autocomplete="off"></div>
         <div class="campo"><label>Actividad</label>${comboHtml("flt-act-txt", "Buscar actividad...")}</div>
         <div class="campo"><label>Categoria</label>${comboHtml("flt-cat-txt", "Buscar categoria...")}</div>
         <div class="campo"><label>Subcategoria</label>${comboHtml("flt-sub-txt", "Damas / Varones...")}</div>
         <button class="btn btn-mini" id="btn-limpiar-filtros">Limpiar filtros</button>
       </div>
     </div>`
  );

  const filtro = { nombre: "", actividad: "", categoria: "", subcategoria: "" };
  const norm = (v) => String(v || "").toLowerCase().trim();

  const render = () => {
    const fNombre = norm(filtro.nombre);
    const fAct = norm(filtro.actividad);
    const fCat = norm(filtro.categoria);
    const fSub = norm(filtro.subcategoria);
    const lista = alumnos.filter((a) => {
      if (fNombre && !norm(a.nombre).includes(fNombre)) return false;
      if (fAct && !norm(a.actividad && a.actividad.nombre).includes(fAct)) return false;
      if (fCat && !norm(a.division).includes(fCat)) return false;
      if (fSub) {
        const genero = fSub.includes("dam") || fSub.includes("fem") ? "F"
          : (fSub.includes("var") || fSub.includes("masc")) ? "M" : "";
        if (genero && String(a.genero) !== genero) return false;
      }
      return true;
    });
    $("#alumnos-lista").innerHTML = tablaAlumnosNomina(lista);
  };

  $("#btn-filtrar").onclick = () => $("#nomina-filtros").classList.toggle("oculta");
  $("#flt-nombre").addEventListener("input", (e) => { filtro.nombre = e.target.value; render(); });
  initCombo("flt-act-txt", actividades.map((n) => ({ valor: n, texto: n })), (o) => { filtro.actividad = o.texto; render(); }, "Buscar actividad...");
  initCombo("flt-cat-txt", categorias.map((d) => ({ valor: d, texto: d })), (o) => { filtro.categoria = o.texto; render(); }, "Buscar categoria...");
  initCombo("flt-sub-txt", subcategorias, (o) => { filtro.subcategoria = o.texto; render(); }, "Damas / Varones...");
  $("#flt-act-txt").addEventListener("input", (e) => { filtro.actividad = e.target.value; render(); });
  $("#flt-cat-txt").addEventListener("input", (e) => { filtro.categoria = e.target.value; render(); });
  $("#flt-sub-txt").addEventListener("input", (e) => { filtro.subcategoria = e.target.value; render(); });
  $("#btn-limpiar-filtros").onclick = () => {
    filtro.nombre = filtro.actividad = filtro.categoria = filtro.subcategoria = "";
    $("#flt-nombre").value = "";
    $("#flt-act-txt").value = $("#flt-cat-txt").value = $("#flt-sub-txt").value = "";
    render();
  };
  render();
}

// ============================================================
// PANELES LECTOR (SOLO LECTURA)
// ============================================================
async function panelLectorResumen() {
  const u = API.usuario || {};
  const establecimiento = u.establecimiento && u.establecimiento.nombre ? u.establecimiento.nombre : null;
  const [act, tor] = await Promise.all([
    API.actividades().catch(() => []),
    API.torneos().catch(() => []),
  ]);

  const etiquetasEstado = {
    activo: { label: "Activo", clase: "est-activo" },
    en_curso: { label: "En curso", clase: "est-activo" },
    inscripciones: { label: "Inscripciones", clase: "est-inscripciones" },
    pausado: { label: "Pausado", clase: "est-pausado" },
    postergado: { label: "Postergado", clase: "est-postergado" },
    cancelado: { label: "Cancelado", clase: "est-cancelado" },
    finalizado: { label: "Finalizado", clase: "est-finalizado" },
  };
  const formatearEstado = (est) =>
    etiquetasEstado[est]
      ? `<span class="estado ${etiquetasEstado[est].clase}">${etiquetasEstado[est].label}</span>`
      : `<span class="estado">${esc(est)}</span>`;

  const torneosVigentes = tor.filter((t) => ["activo", "en_curso", "inscripciones"].includes(t.estado));

  contenido(
    `<div class="encabezado"><h2 class="pagina">Vista de Solo Lectura</h2><p class="muted">Perfil Lector - no puede modificar datos.${establecimiento ? ` | Establecimiento: ${esc(establecimiento)}` : ""}</p></div>
     <div class="tarjeta"><h3>Torneos Vigentes</h3>
       ${torneosVigentes.length
         ? torneosVigentes.map((t) => `<div class="cambio-torneo">${formatearEstado(t.estado)} <strong>${esc(t.nombre)}</strong> <span class="muted">${esc(t.actividad ? t.actividad.nombre : "")} | ${esc(new Date((t.updatedAt || t.createdAt)).toLocaleDateString("es-CL"))}</span></div>`).join("")
         : "<p class='muted'>No hay torneos vigentes.</p>"}
     </div>
     <div class="tarjeta"><h3>Cartelera de Actividades</h3>
       ${act.length
         ? act.map((a) => {
             const inicio = a.fechaAperturaInscripcion ? new Date(a.fechaAperturaInscripcion) : null;
             const fin = a.fechaCierreInscripcion ? new Date(a.fechaCierreInscripcion) : null;
             return `<div class="cambio-torneo"><strong>${esc(a.nombre)}</strong> <span class="badge-rol">${esc(a.area)}</span> <span class="muted">| Categorias: ${esc(a.divisiones.join(", "))} | Estado: ${esc(a.estado)}</span>
             ${(inicio || fin) ? `<span class="muted">| Inscripcion: ${inicio ? inicio.toLocaleDateString("es-CL") : "-"} a ${fin ? fin.toLocaleDateString("es-CL") : "-"}</span>` : ""}</div>`;
           }).join("")
         : "<p class='muted'>No hay actividades publicadas.</p>"}
     </div>`
  );
}

// Nomina del propio establecimiento: estudiantes con la actividad en que participan.
async function panelLectorEstudiantes() {
  const u = API.usuario || {};
  const establecimiento = u.establecimiento && u.establecimiento.nombre ? u.establecimiento.nombre : "";
  const nomina = await API.nomina();
  contenido(
    `<div class="encabezado"><h2 class="pagina">Estudiantes del Establecimiento</h2>
       <p class="muted">${establecimiento ? esc(establecimiento) : "Sin establecimiento asignado"} - solo lectura</p></div>
     <div class="stat"><div class="num">${nomina.total}</div><div class="lbl">Estudiantes inscritos</div></div>
     <div class="tarjeta"><h3>Por Actividad</h3>
       ${nomina.porActividad.length
         ? `<table><thead><tr><th>Actividad</th><th>Cantidad</th></tr></thead>
            <tbody>${nomina.porActividad.map((p) => `<tr><td>${esc(p.actividad)}</td><td>${p.cantidad}</td></tr>`).join("")}</tbody></table>`
         : "<p class='muted'>Sin estudiantes registrados.</p>"}
     </div>
     <div class="tarjeta"><h3>Listado de Estudiantes</h3>
       ${nomina.alumnos.length
         ? `<table><thead><tr><th>RUT</th><th>Nombre</th><th>Genero</th><th>Actividad</th><th>Division</th></tr></thead>
            <tbody>${nomina.alumnos.map((a) => `<tr><td>${esc(a.rut)}</td><td>${esc(a.nombre)}</td><td>${esc(a.genero === "M" ? "Masc" : a.genero === "F" ? "Fem" : "Otro")}</td><td>${esc(a.actividad ? a.actividad.nombre : "")}</td><td>${esc(a.division)}</td></tr>`).join("")}</tbody></table>`
         : "<p class='muted'>Sin estudiantes registrados.</p>"}
     </div>`
  );
}

// ---------- Init ----------
function init() {
  API.loadToken();
  $("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#login-error").classList.add("oculta");
    try {
      await iniciarSesion($("#login-rut").value, $("#login-clave").value);
    } catch (err) {
      $("#login-error").textContent = err.message;
      $("#login-error").classList.remove("oculta");
    }
  });
  $("#btn-salir").onclick = () => { API.limpiar(); mostrarLogin(); };

  if (API.token) {
    API.perfil()
      .then(async () => { await cargarCatalogos(); mostrarDashboard(); })
      .catch(() => { API.limpiar(); mostrarLogin(); });
  } else {
    mostrarLogin();
  }
}

init();
