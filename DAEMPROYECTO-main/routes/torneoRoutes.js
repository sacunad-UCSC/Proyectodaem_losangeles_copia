const express = require("express");
const TorneoController = require("../controllers/TorneoController");
const EquipoController = require("../controllers/EquipoController");
const autenticar = require("../middleware/auth");
const autorizarRol = require("../middleware/validateRol");
const soloLecturaDireccion = require("../middleware/soloLectura");

const router = express.Router();
const controller = new TorneoController();
const equipos = new EquipoController();

router.use(autenticar);
router.use(soloLecturaDireccion);

// Lectura para todos los roles.
router.get("/", (req, res) => controller.obtenerTodos(req, res));
router.get("/agenda", (req, res) => controller.obtenerAgenda(req, res));
router.get("/:id", (req, res) => controller.obtenerPorId(req, res));
router.get("/:id/llaves", (req, res) => controller.obtenerLlaves(req, res));
router.get("/:id/tabla", (req, res) => controller.obtenerTabla(req, res));
router.get("/:id/equipos", (req, res) => equipos.listar(req, res));
router.get("/:id/equipos/pool", (req, res) => equipos.pool(req, res));
router.get("/:id/posiciones", autorizarRol("admin", "coordinador"), (req, res) =>
  controller.obtenerPosiciones(req, res)
);

// Organizacion/sorteo: solo Admin DAEM.
router.post("/", autorizarRol("admin"), (req, res) => controller.crear(req, res));
router.post("/:id/sorteo", autorizarRol("admin"), (req, res) => controller.ejecutarSorteo(req, res));
router.post("/:id/bracket", autorizarRol("admin"), (req, res) => controller.ejecutarBracket(req, res));
router.post("/:id/equipos/sortear", autorizarRol("admin"), (req, res) => equipos.sortear(req, res));
router.post("/:id/equipos", autorizarRol("admin"), (req, res) => equipos.crear(req, res));
router.delete("/:id/equipos/:equipoId", autorizarRol("admin"), (req, res) => equipos.eliminar(req, res));
router.post("/:id/posiciones", autorizarRol("admin"), (req, res) =>
  controller.registrarPosiciones(req, res)
);
router.put("/:id", autorizarRol("admin"), (req, res) => controller.actualizar(req, res));
router.post("/:id/suspender", autorizarRol("admin"), (req, res) => controller.suspender(req, res));
router.post("/:id/reactivar", autorizarRol("admin"), (req, res) => controller.reactivar(req, res));
router.delete("/:id", autorizarRol("admin"), (req, res) => controller.eliminar(req, res));

module.exports = router;