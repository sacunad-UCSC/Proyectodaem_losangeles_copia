const express = require("express");
const TorneoController = require("../controllers/TorneoController");
const autenticar = require("../middleware/auth");
const autorizarRol = require("../middleware/validateRol");
const soloLecturaDireccion = require("../middleware/soloLectura");

const router = express.Router();
const controller = new TorneoController();

// Resultados y llaves: registro/edicion solo Admin DAEM; lectura para todos.
router.use(autenticar);
router.use(soloLecturaDireccion);

router.get("/llaves/:llaveId", (req, res) => controller.obtenerLlaves(req, res));
router.put("/llaves/:llaveId", autorizarRol("admin"), (req, res) => controller.actualizarLlave(req, res));
router.post("/llaves/:llaveId", autorizarRol("admin"), (req, res) => controller.registrarResultado(req, res));

module.exports = router;