const express = require("express");
const ActividadController = require("../controllers/ActividadController");
const autenticar = require("../middleware/auth");
const autorizarRol = require("../middleware/validateRol");
const soloLecturaDireccion = require("../middleware/soloLectura");

const router = express.Router();
const controller = new ActividadController();

router.use(autenticar);
router.use(soloLecturaDireccion);

// Cartelera visible para todos los roles.
router.get("/", (req, res) => controller.obtenerTodos(req, res));
router.get("/:id", (req, res) => controller.obtenerPorId(req, res));

// Publicacion/clasificacion/calendario: solo Admin DAEM.
router.post("/", autorizarRol("admin"), (req, res) => controller.crear(req, res));
router.put("/:id", autorizarRol("admin"), (req, res) => controller.actualizar(req, res));
router.post("/:id/encuentros", autorizarRol("admin"), (req, res) => controller.agregarEncuentro(req, res));
router.put("/:id/encuentros/:encuentroId", autorizarRol("admin"), (req, res) =>
  controller.modificarEncuentro(req, res)
);
router.delete("/:id", autorizarRol("admin"), (req, res) => controller.eliminar(req, res));

module.exports = router;