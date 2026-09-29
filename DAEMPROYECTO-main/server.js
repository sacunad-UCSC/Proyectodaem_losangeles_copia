const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const { initDatabase, detenerDatabase } = require("./config/database");
const { obtenerConexion } = require("./db/conexion");
const { ejecutarSeed } = require("./seed/seed");

const authRoutes = require("./routes/authRoutes");
const usuarioRoutes = require("./routes/usuarioRoutes");
const establecimientoRoutes = require("./routes/establecimientoRoutes");
const actividadRoutes = require("./routes/actividadRoutes");
const seccionRoutes = require("./routes/seccionRoutes");
const torneoRoutes = require("./routes/torneoRoutes");
const inscripcionRoutes = require("./routes/inscripcionRoutes");
const alumnoRoutes = require("./routes/alumnoRoutes");
const solicitudRoutes = require("./routes/solicitudRoutes");
const resultadoRoutes = require("./routes/resultadoRoutes");
const reporteRoutes = require("./routes/reporteRoutes");
const catalogRoutes = require("./routes/catalogRoutes");
const notificacionRoutes = require("./routes/notificacionRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Servir los estaticos sin cache: los cambios de JS/CSS/HTML deben reflejarse
// de inmediato (el admin programa torneos y el coordinador los postula; un
// app.js cacheado hacia que el mensaje de exito y las horas no se vieran).
app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders: (res, ruta) => {
      if (/\.(js|css|html|json)$/i.test(ruta)) {
        res.setHeader("Cache-Control", "no-store");
      } else {
        res.setHeader("Cache-Control", "public, max-age=3600");
      }
    },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/establecimientos", establecimientoRoutes);
app.use("/api/actividades", actividadRoutes);
app.use("/api/secciones", seccionRoutes);
app.use("/api/torneos", torneoRoutes);
app.use("/api/inscripciones", inscripcionRoutes);
app.use("/api/alumnos", alumnoRoutes);
app.use("/api/solicitudes", solicitudRoutes);
app.use("/api/resultados", resultadoRoutes);
app.use("/api/reportes", reporteRoutes);
app.use("/api/catalogos", catalogRoutes);
app.use("/api/notificaciones", notificacionRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    estado: "activo",
    proyecto: "DAEM",
    version: "1.0.0",
    baseDatos: "SQLite",
    roles: ["admin", "coordinador", "lector"],
  });
});

app.get("/api/sync", (req, res) => {
  const db = obtenerConexion();
  const tablas = [
    "establecimientos",
    "usuarios",
    "secciones",
    "actividades",
    "encuentros",
    "torneos",
    "inscripciones",
    "alumnos",
    "equipos",
    "llaves",
    "valoraciones",
    "solicitudes",
    "notificaciones",
  ];

  const snapshot = {};
  for (const tabla of tablas) {
    try {
      snapshot[tabla] = db.prepare(`SELECT * FROM ${tabla} ORDER BY id`).all();
    } catch (err) {
      snapshot[tabla] = [];
    }
  }

  const hashActual = crypto
    .createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");

  const lastHash = String(req.query.lastHash || "");
  res.json({
    changed: lastHash !== hashActual,
    hash: hashActual,
    panel: req.query.panel || "global",
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function iniciarServidor() {
  await initDatabase();
  await ejecutarSeed();
  app.listen(PORT, () => {
    console.log(`DAEM corriendo en http://localhost:${PORT}`);
    console.log(`API disponible en http://localhost:${PORT}/api`);
  });
}

iniciarServidor().catch((err) => {
  console.error("Error al iniciar:", err);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await detenerDatabase().catch(() => {});
  process.exit(0);
});

module.exports = app;