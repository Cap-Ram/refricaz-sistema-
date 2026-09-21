const http = require("node:http");

const PORT = process.env.PORT || 8000;
const HOST = "0.0.0.0";

// =====================================================
// FASE 1 - MIDDLEWARE CORS
// AllowAnyOrigin: durante desarrollo se acepta cualquier origen.
// =====================================================
function aplicarCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  // Respuesta a la verificación previa (preflight) del navegador.
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  if (aplicarCors(req, res)) return;

  // ===================================================
  // HEALTH CHECK
  // GET /
  // Confirma que el servicio está operando correctamente.
  // ===================================================
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        status: "online",
        message: "Servidor Arriba",
        server_time: new Date().toISOString()
      })
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({
      status: "error",
      message: "Ruta no encontrada"
    })
  );
});

server.listen(PORT, HOST, () => {
  console.log("========================================");
  console.log("  REFRICAZ - Backend Fase 1");
  console.log("========================================");
  console.log(`Servidor activo en el puerto ${PORT}`);
  console.log(`Health Check: http://127.0.0.1:${PORT}/`);
  console.log("CORS: AllowAnyOrigin (*)");
  console.log("Presiona Ctrl + C para detener el servidor.");
});
