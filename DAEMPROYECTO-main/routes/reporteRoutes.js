const express = require("express");
const ValoracionController = require("../controllers/ValoracionController");
const ReporteController = require("../controllers/ReporteController");
const autenticar = require("../middleware/auth");
const autorizarRol = require("../middleware/validateRol");
const soloLecturaDireccion = require("../middleware/soloLectura");

const router = express.Router();
const valoraciones = new ValoracionController();
const reportes = new ReporteController();

router.use(autenticar);
router.use(soloLecturaDireccion);

// Valoraciones (ranking de cumplimiento): solo Admin DAEM (el lector no accede).
router.post("/asignar", autorizarRol("admin"), (req, res) => valoraciones.asignar(req, res));
router.get("/valoraciones", autorizarRol("admin"), (req, res) => valoraciones.obtenerTodos(req, res));
router.get("/ranking", autorizarRol("admin"), (req, res) => valoraciones.ranking(req, res));

// Reportes y estadisticas: Admin DAEM (y lecturas para coordinadores).
router.get("/nomina", autorizarRol("admin"), (req, res) => reportes.nomina(req, res));
router.get("/participaciones", autorizarRol("admin"), (req, res) => reportes.participaciones(req, res));
router.get("/beneficiarios", autorizarRol("admin"), (req, res) => reportes.beneficiarios(req, res));
router.get("/historico", autorizarRol("admin", "coordinador"), (req, res) => reportes.historico(req, res));
router.get("/torneos", autorizarRol("admin", "coordinador"), (req, res) => reportes.torneos(req, res));

module.exports = router;