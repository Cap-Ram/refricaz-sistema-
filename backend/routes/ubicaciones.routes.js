const {
  buscarUbicacionController
} = require("../controllers/ubicaciones.controller");

const RUTA_BASE = "/api/ubicaciones";

function enviarErrorRuta(res, mensaje) {
  res.writeHead(400, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(
    JSON.stringify(
      {
        status: "error",
        message: mensaje
      },
      null,
      2
    )
  );
}

function manejarRutaUbicaciones(req, res) {
  const url = new URL(req.url, "http://localhost");
  const esRutaBase = url.pathname === RUTA_BASE;
  const esRutaConCriterio = url.pathname.startsWith(
    `${RUTA_BASE}/`
  );

  if (
    req.method !== "GET" ||
    (!esRutaBase && !esRutaConCriterio)
  ) {
    return false;
  }

  const criterioCodificado = esRutaBase
    ? ""
    : url.pathname.slice(RUTA_BASE.length + 1);

  let criterio;

  try {
    criterio = decodeURIComponent(criterioCodificado);
  } catch {
    enviarErrorRuta(
      res,
      "El criterio contiene caracteres no válidos."
    );
    return true;
  }

  buscarUbicacionController(req, res, criterio);

  return true;
}

module.exports = {
  manejarRutaUbicaciones
};