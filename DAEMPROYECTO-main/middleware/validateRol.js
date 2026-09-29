// Restringe el acceso segun el rol del usuario autenticado.
// Uso: proteger(...rolesPermitidos)
function autorizarRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ mensaje: "No autenticado" });
    }
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({
        mensaje: `Acceso denegado: se requiere rol ${roles.join(" o ")}, tienes ${req.usuario.rol}`,
      });
    }
    next();
  };
}

module.exports = autorizarRol;