const express = require("express");
const UsuarioController = require("../controllers/UsuarioController");
const autenticar = require("../middleware/auth");
const autorizarRol = require("../middleware/validateRol");
const soloLecturaDireccion = require("../middleware/soloLectura");

const router = express.Router();
const controller = new UsuarioController();

router.use(autenticar);
router.use(soloLecturaDireccion);

// Admin administra todo; Coordinador crea/gestiona lectores de su colegio.
router.post("/", autorizarRol("admin", "coordinador"), (req, res) => controller.crear(req, res));
router.get("/", autorizarRol("admin", "coordinador"), (req, res) => controller.obtenerTodos(req, res));
router.put("/:id", autorizarRol("admin", "coordinador"), (req, res) => controller.actualizar(req, res));
router.delete("/:id", autorizarRol("admin", "coordinador"), (req, res) => controller.eliminar(req, res));

module.exports = router;