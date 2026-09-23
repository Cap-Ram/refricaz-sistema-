const axios = require("axios");

const URL_NOMINATIM =
  "https://nominatim.openstreetmap.org/search";

// Memoria temporal para evitar repetir consultas.
const cacheUbicaciones = new Map();

// Control para respetar el límite de una petición por segundo.
let ultimaPeticion = 0;

function esperar(milisegundos) {
  return new Promise((resolve) => {
    setTimeout(resolve, milisegundos);
  });
}

function crearError(mensaje, statusCode) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
}

function obtenerMunicipio(direccion) {
  return (
    direccion.city ||
    direccion.town ||
    direccion.municipality ||
    direccion.county ||
    direccion.village ||
    null
  );
}

async function buscarUbicacion(criterio) {
  const criterioLimpio = String(criterio || "").trim();
  const claveCache = criterioLimpio.toLowerCase();

  if (cacheUbicaciones.has(claveCache)) {
    return cacheUbicaciones.get(claveCache);
  }

  const tiempoTranscurrido = Date.now() - ultimaPeticion;
  const tiempoRestante = 1000 - tiempoTranscurrido;

  if (tiempoRestante > 0) {
    await esperar(tiempoRestante);
  }

  try {
    ultimaPeticion = Date.now();

    const respuesta = await axios.get(URL_NOMINATIM, {
      params: {
        q: `${criterioLimpio}, México`,
        format: "jsonv2",
        addressdetails: 1,
        limit: 1,
        countrycodes: "mx",
        "accept-language": "es"
      },
      headers: {
        "User-Agent": "REFRICAZ-Academic-Project/1.0"
      },
      timeout: 8000
    });

    if (
      !Array.isArray(respuesta.data) ||
      respuesta.data.length === 0
    ) {
      throw crearError(
        "No se encontró la ubicación solicitada.",
        404
      );
    }

    const resultadoOriginal = respuesta.data[0];
    const direccion = resultadoOriginal.address || {};
    const latitud = Number(resultadoOriginal.lat);
    const longitud = Number(resultadoOriginal.lon);

    const resultadoFiltrado = {
      id: `${resultadoOriginal.osm_type}-${resultadoOriginal.osm_id}`,
      nombre: resultadoOriginal.display_name,
      categoria:
        resultadoOriginal.addresstype ||
        resultadoOriginal.type ||
        "ubicacion",
      estado: direccion.state || null,
      municipio: obtenerMunicipio(direccion),
      codigo_postal: direccion.postcode || null,
      latitud,
      longitud,
      recurso_visual:
        `https://www.openstreetmap.org/?mlat=${latitud}` +
        `&mlon=${longitud}#map=14/${latitud}/${longitud}`,
      fuente: "OpenStreetMap"
    };

    cacheUbicaciones.set(claveCache, resultadoFiltrado);

    return resultadoFiltrado;
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    if (error.response && error.response.status === 429) {
      throw crearError(
        "Se alcanzó temporalmente el límite de consultas.",
        503
      );
    }

    throw crearError(
      "No fue posible consultar el servicio de ubicaciones.",
      502
    );
  }
}

module.exports = {
  buscarUbicacion
};