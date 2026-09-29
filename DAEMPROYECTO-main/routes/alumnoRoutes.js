const express = require("express");
const AlumnoController = require("../controllers/AlumnoController");
const autenticar = require("../middleware/auth");
const autorizarRol = require("../middleware/validateRol");
const soloLecturaDireccion = require("../middleware/soloLectura");

const router = express.Router();
const controller = new AlumnoController();

// Gestion de alumnos y asistencia (Admin DAEM).
router.use(autenticar);
router.use(soloLecturaDireccion);
router.use(autorizarRol("admin"));

router.get("/mios", (req, res) => controller.obtenerMios(req, res));
router.get("/agenda", (req, res) => controller.agenda(req, res));
router.post("/:id/asistencia/:encuentroId", (req, res) => controller.registrarAsistencia(req, res));

module.exports = router;