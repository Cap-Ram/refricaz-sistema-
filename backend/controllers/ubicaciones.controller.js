const {
  buscarUbicacion
} = require("../services/geocoding.service");

function enviarJson(res, codigoHttp, contenido) {
  res.writeHead(codigoHttp, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(JSON.stringify(contenido, null, 2));
}

async function buscarUbicacionController(req, res, criterio) {
  const criterioLimpio = String(criterio || "").trim();

  if (criterioLimpio.length < 2) {
    enviarJson(res, 400, {
      status: "error",
      message: "El criterio de búsqueda debe tener al menos dos caracteres."
    });
    return;
  }

  try {
    const ubicacion = await buscarUbicacion(criterioLimpio);

    enviarJson(res, 200, ubicacion);
  } catch (error) {
    const codigoHttp = error.statusCode || 500;

    enviarJson(res, codigoHttp, {
      status: "error",
      message:
        error.message ||
        "Ocurrió un error interno al buscar la ubicación."
    });
  }
}

module.exports = {
  buscarUbicacionController
};