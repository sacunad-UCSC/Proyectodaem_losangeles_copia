const express = require("express");
const SeccionController = require("../controllers/SeccionController");
const autenticar = require("../middleware/auth");
const autorizarRol = require("../middleware/validateRol");
const soloLecturaDireccion = require("../middleware/soloLectura");

const router = express.Router();
const controller = new SeccionController();

router.use(autenticar);
router.use(soloLecturaDireccion);

router.get("/", (req, res) => controller.obtenerTodos(req, res));
router.post("/", autorizarRol("admin"), (req, res) => controller.crear(req, res));
router.put("/:id", autorizarRol("admin"), (req, res) => controller.actualizar(req, res));
router.delete("/:id", autorizarRol("admin"), (req, res) => controller.eliminar(req, res));

module.exports = router;