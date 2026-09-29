// E2E completo sobre SQLite: levanta server, proba auth+datos+notif, cierra.
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

const RAÍZ = path.join(__dirname, "..");
const DB_TEST = path.join(RAÍZ, "data", "daem-e2e.db");
const JWT_SECRET = "test_secret";

const server = spawn("node", ["server.js"], {
  cwd: RAÍZ,
  env: { ...process.env, PORT: "3210", DB_PATH: DB_TEST, JWT_SECRET },
  stdio: ["ignore", "pipe", "pipe"],
});

let salida = "";
server.stdout.on("data", (d) => (salida += d.toString()));
server.stderr.on("data", (d) => (salida += d.toString()));

const BASE = "http://localhost:3210";

function peticion(method, ruta, body, token) {
  return new Promise((resolve, reject) => {
    const datos = body ? JSON.stringify(body) : null;
    const op = {
      hostname: "localhost",
      port: 3210,
      path: ruta,
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (token) op.headers.Authorization = `Bearer ${token}`;
    if (datos) op.headers["Content-Length"] = Buffer.byteLength(datos);
    const req = http.request(op, (res) => {
      let acum = "";
      res.on("data", (c) => (acum += c));
      res.on("end", () => { try { resolve({ status: res.statusCode, body: JSON.parse(acum || "{}") }); } catch (e) { resolve({ status: res.statusCode, body: acum }); } });
    });
    req.on("error", reject);
    if (datos) req.write(datos);
    req.end();
  });
}

const pruebas = [];
function t(nombre, cond, detalle) {
  pruebas.push({ nombre, cond: !!cond, detalle: cond ? "" : detalle || "" });
  console.log((cond ? "PASS" : "FAIL") + "  " + nombre + (cond ? "" : "  -> " + (detalle || "")));
}

async function esperarArranque() {
  for (let i = 0; i < 60; i++) {
    try {
      const h = await peticion("GET", "/api/health");
      if (h.body.estado) return true;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

(async () => {
  try {
    const ok = await esperarArranque();
    t("server arranca con SQLite", ok, salida.slice(-800));

    if (ok) {
      const health = await peticion("GET", "/api/health");
      t("health.baseDatos = SQLite", health.body.baseDatos === "SQLite", JSON.stringify(health.body));

      // Login admin (seed idempotente lo crea)
      const adm = await peticion("POST", "/api/auth/login", { rut: "11111111-1", clave: "admin123" });
      t("login admin 200", adm.status === 200, JSON.stringify(adm.body).slice(0, 200));

      // Login coordinador
      const coord = await peticion("POST", "/api/auth/login", { rut: "22222222-2", clave: "coord123" });
      t("login coordinador 200", coord.status === 200, JSON.stringify(coord.body).slice(0, 200));

      if (adm.body.token && coord.body.token) {
        const ta = adm.body.token;
        const tc = coord.body.token;

        // Catálogos (admin)
        const cat = await peticion("GET", "/api/catalogos", null, ta);
        t("catalogos admin 200", cat.status === 200 && Array.isArray(cat.body.areas), JSON.stringify(cat.body).slice(0, 120));
        const areas = cat.body.areas || [];
        t("catalogo incluye area 'Artistico/Cultural'", areas.includes("Artístico/Cultural"), JSON.stringify(areas));

        // Torneos list (admin) — seed crea torneos
        const torneos = await peticion("GET", "/api/torneos", null, ta);
        t("torneos admin 200", torneos.status === 200, JSON.stringify(torneos.body).slice(0, 160));
        const lista = Array.isArray(torneos.body) ? torneos.body : torneos.body.torneos || [];
        const primerTorneo = lista[0];
        if (primerTorneo && primerTorneo._id) {
          // Suspender -> genera notificación para coordinadores
          const susp = await peticion("POST", `/api/torneos/${primerTorneo._id}/suspender`, {}, ta);
          t("suspender torneo (genera notif) 200", susp.status === 200, JSON.stringify(susp.body).slice(0, 120));
        } else {
          t("suspender torneo (no hay torneo seed para probar)", false, JSON.stringify(lista).slice(0, 200));
        }

        // Notificaciones del coordinador (debe haber >=1: requisitos o suspension)
        const notif = await peticion("GET", "/api/notificaciones", null, tc);
        t("notificaciones coordinador 200", notif.status === 200 && Array.isArray(notif.body.notificaciones), JSON.stringify(notif.body).slice(0, 200));
        const noLeidas = notif.body.noLeidas;
        t("noLeidas > 0 tras acciones admin", noLeidas > 0, "noLeidas=" + noLeidas);

        const primerNotif = Array.isArray(notif.body.notificaciones) ? notif.body.notificaciones[0] : null;
        if (primerNotif && primerNotif._id) {
          const marcar = await peticion("POST", `/api/notificaciones/${primerNotif._id}/leer`, {}, tc);
          t("marcar notif leida 200", marcar.status === 200, JSON.stringify(marcar.body).slice(0, 120));
        }

        // Inscripciones / alumnos presentes en seed
        const insc = await peticion("GET", "/api/inscripciones", null, ta);
        t("inscripciones admin 200", insc.status === 200, JSON.stringify(insc.body).slice(0, 100));

        // Datos seed de coordinador (nomina exige admin; probamos rol correcto)
        const nomina = await peticion("GET", "/api/reportes/nomina", null, ta);
        t("reporte nomina admin 200", nomina.status === 200, JSON.stringify(nomina.body).slice(0, 100));
      }
    }
  } catch (err) {
    t("ejecucion e2e sin excepcion", false, String(err));
  } finally {
    server.kill();
    // esperar salida
    await new Promise((r) => setTimeout(r, 800));
    if (fs.existsSync(DB_TEST)) {
      try { fs.unlinkSync(DB_TEST); } catch (e) {}
      for (const ext of ["-wal", "-shm"]) {
        try { if (fs.existsSync(DB_TEST + ext)) fs.unlinkSync(DB_TEST + ext); } catch (e) {}
      }
    }
    const total = pruebas.length;
    const okn = pruebas.filter((p) => p.cond).length;
    console.log("\n================ RESUMEN ================");
    console.log(`PASS ${okn}/${total}`);
    if (salida.toLowerCase().includes("error") || salida.toLowerCase().includes("throw")) {
      console.log("--- salida server (últimas líneas) ---");
      console.log(salida.slice(-1500));
    }
    process.exit(okn === total ? 0 : 1);
  }
})();