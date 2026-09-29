const express = require("express");
const autenticar = require("../middleware/auth");
const {
  ROLES,
  AREAS,
  DEPENDENCIAS,
  DIVISIONES,
  ESTADOS_INSCRIPCION,
  ESTADOS_SOLICITUD,
  ESTADOS_ACTIVIDAD,
  ESTADOS_TORNEO,
  ESTADOS_CUMPLIMIENTO,
  TIPOS_SOLICITUD,
  POSICIONES,
} = require("../constants/catalogos");

const router = express.Router();

// Catalogos de la aplicacion para poblar formularios del frontend.
router.get("/", autenticar, (req, res) => {
  res.json({
    roles: ROLES,
    areas: Object.values(AREAS),
    dependencias: Object.values(DEPENDENCIAS),
    divisiones: DIVISIONES,
    estadosInscripcion: ESTADOS_INSCRIPCION,
    estadosSolicitud: ESTADOS_SOLICITUD,
    estadosActividad: ESTADOS_ACTIVIDAD,
    estadosTorneo: ESTADOS_TORNEO,
    estadosCumplimiento: ESTADOS_CUMPLIMIENTO,
    tiposSolicitud: TIPOS_SOLICITUD,
    posiciones: POSICIONES,
  });
});

module.exports = router;