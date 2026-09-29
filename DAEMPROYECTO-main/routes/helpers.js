const UsuarioController = require("../controllers/UsuarioController");
const autenticar = require("../middleware/auth");

function enrutar(controller) {
  return {
    crear: (req, res) => controller.crear(req, res),
    obtenerTodos: (req, res) => controller.obtenerTodos(req, res),
    obtenerPorId: (req, res) => controller.obtenerPorId(req, res),
    actualizar: (req, res) => controller.actualizar(req, res),
    asignarActividades: (req, res) => controller.asignarActividades(req, res),
    eliminar: (req, res) => controller.eliminar(req, res),
  };
}

module.exports = enrutar;