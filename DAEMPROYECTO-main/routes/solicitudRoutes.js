const express = require("express");
const SolicitudController = require("../controllers/SolicitudController");
const autenticar = require("../middleware/auth");
const autorizarRol = require("../middleware/validateRol");
const soloLecturaDireccion = require("../middleware/soloLectura");

const router = express.Router();
const controller = new SolicitudController();

router.use(autenticar);
router.use(soloLecturaDireccion);

// El coordinador responde las solicitudes de su establecimiento; admin las administra.
router.get("/", autorizarRol("admin", "coordinador"), (req, res) =>
  controller.obtenerTodos(req, res)
);
router.put("/:id/estado", autorizarRol("coordinador"), (req, res) => controller.cambiarEstado(req, res));
router.delete("/:id", autorizarRol("admin"), (req, res) => controller.eliminar(req, res));

module.exports = router;