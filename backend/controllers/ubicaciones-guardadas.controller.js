const {
  guardarUbicacion,
  listarUbicaciones,
  obtenerUbicacion,
  actualizarUbicacion,
  eliminarUbicacion
} = require("../services/ubicaciones-guardadas.service");

function enviarJson(res, statusCode, contenido) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(JSON.stringify(contenido));
}

function crearError(mensaje, statusCode) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
}

function obtenerUsuarioId(req) {
  const usuarioId = String(
    req.headers["x-user-id"] || ""
  ).trim();

  if (!usuarioId) {
    throw crearError(
      "Debe proporcionar el encabezado x-user-id.",
      401
    );
  }

  return usuarioId;
}

function leerJson(req) {
  return new Promise((resolve, reject) => {
    let cuerpo = "";
    let limiteSuperado = false;

    req.on("data", (fragmento) => {
      if (limiteSuperado) return;

      cuerpo += fragmento;

      if (Buffer.byteLength(cuerpo) > 100000) {
        limiteSuperado = true;
      }
    });

    req.on("end", () => {
      if (limiteSuperado) {
        reject(
          crearError(
            "El cuerpo de la petición es demasiado grande.",
            413
          )
        );
        return;
      }

      if (!cuerpo.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(cuerpo));
      } catch {
        reject(
          crearError(
            "El cuerpo de la petición debe ser un JSON válido.",
            400
          )
        );
      }
    });

    req.on("error", () => {
      reject(
        crearError(
          "No fue posible leer la petición.",
          400
        )
      );
    });
  });
}

function manejarError(res, error) {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error("Error interno:", error);
  }

  enviarJson(res, statusCode, {
    status: "error",
    message:
      statusCode >= 500
        ? "Ocurrió un error interno en el servidor."
        : error.message
  });
}

async function crearUbicacionController(req, res) {
  try {
    const usuarioId = obtenerUsuarioId(req);
    const datos = await leerJson(req);

    const ubicacion = await guardarUbicacion(
      datos,
      usuarioId
    );

    enviarJson(res, 201, {
      status: "success",
      message: "Ubicación guardada correctamente.",
      data: ubicacion
    });
  } catch (error) {
    manejarError(res, error);
  }
}

async function listarUbicacionesController(req, res) {
  try {
    const usuarioId = obtenerUsuarioId(req);

    const ubicaciones = await listarUbicaciones(
      usuarioId
    );

    enviarJson(res, 200, {
      status: "success",
      total: ubicaciones.length,
      data: ubicaciones
    });
  } catch (error) {
    manejarError(res, error);
  }
}

async function obtenerUbicacionController(
  req,
  res,
  id
) {
  try {
    const usuarioId = obtenerUsuarioId(req);

    const ubicacion = await obtenerUbicacion(
      id,
      usuarioId
    );

    enviarJson(res, 200, {
      status: "success",
      data: ubicacion
    });
  } catch (error) {
    manejarError(res, error);
  }
}

async function actualizarUbicacionController(
  req,
  res,
  id
) {
  try {
    const usuarioId = obtenerUsuarioId(req);
    const datos = await leerJson(req);

    const ubicacion = await actualizarUbicacion(
      id,
      datos,
      usuarioId
    );

    enviarJson(res, 200, {
      status: "success",
      message: "Ubicación actualizada correctamente.",
      data: ubicacion
    });
  } catch (error) {
    manejarError(res, error);
  }
}

async function eliminarUbicacionController(
  req,
  res,
  id
) {
  try {
    const usuarioId = obtenerUsuarioId(req);

    const resultado = await eliminarUbicacion(
      id,
      usuarioId
    );

    enviarJson(res, 200, {
      status: "success",
      message: "Ubicación eliminada correctamente.",
      data: resultado
    });
  } catch (error) {
    manejarError(res, error);
  }
}

module.exports = {
  crearUbicacionController,
  listarUbicacionesController,
  obtenerUbicacionController,
  actualizarUbicacionController,
  eliminarUbicacionController
};