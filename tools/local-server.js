const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 5600);
const host = "127.0.0.1";

const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
};

const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://${host}:${port}`);
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === "/") pathname = "/index.html";

    const filePath = path.resolve(root, `.${pathname}`);
    if (!filePath.startsWith(root)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Acceso denegado");
        return;
    }

    fs.readFile(filePath, (error, data) => {
        if (error) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Archivo no encontrado");
            return;
        }

        res.writeHead(200, {
            "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
            "Cache-Control": "no-store"
        });
        res.end(data);
    });
});

server.listen(port, host, () => {
    console.log(`Servidor Refricaz activo en http://${host}:${port}`);
});

server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.log(`Servidor Refricaz activo en http://${host}:${port}`);
        setInterval(() => {}, 60_000);
        return;
    }

    console.error(error);
    process.exit(1);
});
