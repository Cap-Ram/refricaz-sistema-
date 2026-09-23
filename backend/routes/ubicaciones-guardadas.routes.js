const {
  crearUbicacionController,
  listarUbicacionesController,
  obtenerUbicacionController,
  actualizarUbicacionController,
  eliminarUbicacionController
} = require(
  "../controllers/ubicaciones-guardadas.controller"
);

const RUTA_BASE = "/api/ubicaciones-guardadas";

function enviarErrorRuta(
  res,
  statusCode,
  mensaje,
  metodosPermitidos
) {
  const encabezados = {
    "Content-Type": "application/json; charset=utf-8"
  };

  if (metodosPermitidos) {
    encabezados.Allow = metodosPermitidos;
  }

  res.writeHead(statusCode, encabezados);

  res.end(
    JSON.stringify({
      status: "error",
      message: mensaje
    })
  );
}

function obtenerRuta(req) {
  const url = new URL(
    req.url,
    "http://127.0.0.1"
  );

  if (
    url.pathname.length > 1 &&
    url.pathname.endsWith("/")
  ) {
    return url.pathname.slice(0, -1);
  }

  return url.pathname;
}

function obtenerId(ruta) {
  const expresion =
    /^\/api\/ubicaciones-guardadas\/([^/]+)$/;

  const coincidencia = ruta.match(expresion);

  if (!coincidencia) {
    return null;
  }

  return decodeURIComponent(coincidencia[1]);
}

function manejarRutaUbicacionesGuardadas(req, res) {
  let ruta;

  try {
    ruta = obtenerRuta(req);
  } catch {
    enviarErrorRuta(
      res,
      400,
      "La dirección solicitada no es válida."
    );
    return true;
  }

  if (ruta === RUTA_BASE) {
    if (req.method === "POST") {
      crearUbicacionController(req, res);
      return true;
    }

    if (req.method === "GET") {
      listarUbicacionesController(req, res);
      return true;
    }

    enviarErrorRuta(
      res,
      405,
      "Método no permitido para esta ruta.",
      "GET, POST"
    );

    return true;
  }

  let id;

  try {
    id = obtenerId(ruta);
  } catch {
    enviarErrorRuta(
      res,
      400,
      "El identificador contiene caracteres no válidos."
    );
    return true;
  }

  if (!id) {
    return false;
  }

  if (req.method === "GET") {
    obtenerUbicacionController(req, res, id);
    return true;
  }

  if (
    req.method === "PATCH" ||
    req.method === "PUT"
  ) {
    actualizarUbicacionController(req, res, id);
    return true;
  }

  if (req.method === "DELETE") {
    eliminarUbicacionController(req, res, id);
    return true;
  }

  enviarErrorRuta(
    res,
    405,
    "Método no permitido para esta ruta.",
    "GET, PATCH, PUT, DELETE"
  );

  return true;
}

module.exports = {
  manejarRutaUbicacionesGuardadas
};