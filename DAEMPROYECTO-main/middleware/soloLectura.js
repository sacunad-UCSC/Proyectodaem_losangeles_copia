// Bloquea operaciones de escritura para el rol "lector" (solo lectura).
// Debe ejecutarse despues de "autenticar".
function soloLecturaDireccion(req, res, next) {
  if (
    req.usuario &&
    req.usuario.rol === "lector" &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)
  ) {
    return res.status(403).json({
      mensaje: "El rol lector es de solo lectura y no puede realizar esta accion",
    });
  }
  next();
}

module.exports = soloLecturaDireccion;