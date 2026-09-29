const express = require("express");
const EstablecimientoController = require("../controllers/EstablecimientoController");
const autenticar = require("../middleware/auth");
const autorizarRol = require("../middleware/validateRol");
const soloLecturaDireccion = require("../middleware/soloLectura");

const router = express.Router();
const controller = new EstablecimientoController();

// Lectura para Admin y Coordinador (el lector no accede al listado); escritura solo Admin.
router.use(autenticar);
router.use(soloLecturaDireccion);

router.get("/", autorizarRol("admin", "coordinador"), (req, res) => controller.obtenerTodos(req, res));
router.get("/:id", autorizarRol("admin", "coordinador"), (req, res) => controller.obtenerPorId(req, res));

router.post("/", autorizarRol("admin"), (req, res) => controller.crear(req, res));
router.put("/:id", autorizarRol("admin"), (req, res) => controller.actualizar(req, res));
router.delete("/:id", autorizarRol("admin"), (req, res) => controller.eliminar(req, res));

module.exports = router;