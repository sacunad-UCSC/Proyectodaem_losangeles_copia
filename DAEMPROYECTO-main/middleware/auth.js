const jwt = require("jsonwebtoken");
const UsuarioRepository = require("../repositories/UsuarioRepository");
const EstablecimientoRepository = require("../repositories/EstablecimientoRepository");

// Verifica el token JWT y adjunta el usuario autenticado al request.
async function autenticar(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ mensaje: "Token no proporcionado" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || "daem_clave_super_secreta");

    const usuario = new UsuarioRepository().obtenerPorId(payload.sub);

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ mensaje: "Usuario no valido o desactivado" });
    }

    req.usuario = construirUsuario(usuario);
    next();
  } catch (err) {
    return res.status(401).json({ mensaje: `No autorizado: ${err.message}` });
  }
}

// Reconstruye el usuario manteniendo las propiedades que consume el resto del
// codigo: id, _id, rut, nombre, rol, establecimiento y actividades como objetos.
function construirUsuario(usuario) {
  const establecimiento = usuario.establecimiento
    ? new EstablecimientoRepository().obtenerPorId(usuario.establecimiento)
    : null;

  const copia = { ...usuario };
  delete copia.claveHash;
  copia.id = usuario.id;
  copia._id = usuario.id;
  copia.establecimiento = establecimiento
    ? {
        id: establecimiento.id,
        _id: establecimiento.id,
        codigo: establecimiento.codigo,
        nombre: establecimiento.nombre,
        dependencia: establecimiento.dependencia,
        direccion: establecimiento.direccion,
        contacto: establecimiento.contacto,
      }
    : null;
  copia.actividades = (usuario.actividades || []).map((a) => ({ ...a, _id: a.id }));
  return copia;
}

module.exports = autenticar;