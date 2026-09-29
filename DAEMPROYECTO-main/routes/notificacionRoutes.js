const { Router } = require("express");
const autenticar = require("../middleware/auth");
const autorizarRol = require("../middleware/validateRol");
const controller = new (require("../controllers/NotificacionController"))();

const router = Router();

router.use(autenticar);

// Notificaciones del coordinador logueado (campana y panel).
router.get("/", autorizarRol("coordinador", "admin"), (req, res) => controller.listar(req, res));
// Marca una notificacion como leida al hacer clic en ella.
router.post("/:id/leer", autorizarRol("coordinador", "admin"), (req, res) => controller.marcarLeida(req, res));
// Marca todas como leidas (boton del panel).
router.post("/leer-todas", autorizarRol("coordinador", "admin"), (req, res) => controller.marcarTodasLeidas(req, res));

module.exports = router;
