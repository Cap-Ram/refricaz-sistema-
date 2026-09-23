require("dotenv").config();

const http = require("node:http");

const {
  manejarRutaUbicacionesGuardadas
} = require("./routes/ubicaciones-guardadas.routes");

const {
  manejarRutaUbicaciones
} = require("./routes/ubicaciones.routes");

const PORT = process.env.PORT || 8000;
const HOST = "0.0.0.0";

// =====================================================
// MIDDLEWARE CORS
// Durante el desarrollo se acepta cualquier origen.
// =====================================================
function aplicarCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-User-Id"
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  if (aplicarCors(req, res)) {
    return;
  }

if (manejarRutaUbicacionesGuardadas(req, res)) {
  return;
}
  // ===================================================
  // HEALTH CHECK
  // GET /
  // ===================================================
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8"
    });

    res.end(
      JSON.stringify(
        {
          status: "online",
          message: "Servidor REFRICAZ funcionando",
          fase: 2,
          server_time: new Date().toISOString()
        },
        null,
        2
      )
    );

    return;
  }

  // ===================================================
  // FASE 2 - BÚSQUEDA DE UBICACIONES
  // GET /api/ubicaciones/:criterio
  // ===================================================
  if (manejarRutaUbicaciones(req, res)) {
    return;
  }

  // ===================================================
  // RUTA NO ENCONTRADA
  // ===================================================
  res.writeHead(404, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(
    JSON.stringify(
      {
        status: "error",
        message: "Ruta no encontrada"
      },
      null,
      2
    )
  );
});

server.listen(PORT, HOST, () => {
  console.log("========================================");
  console.log("  REFRICAZ - Backend Fase 3");
  console.log("========================================");
  console.log(`Servidor activo en el puerto ${PORT}`);
  console.log(`Health Check: http://127.0.0.1:${PORT}/`);
  console.log(
    `Ubicaciones: http://127.0.0.1:${PORT}/api/ubicaciones/Guadalajara`
  );
  console.log(
  `CRUD Firestore: http://127.0.0.1:${PORT}/api/ubicaciones-guardadas`
);
  console.log("CORS: AllowAnyOrigin (*)");
  console.log("Presiona Ctrl + C para detener el servidor.");
});