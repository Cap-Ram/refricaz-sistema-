# REFRICAZ - Backend Fase 1

Este servidor utiliza **JavaScript**, **Node.js**, **npm** como gestor de ejecución y el módulo HTTP nativo de Node.js, sin dependencias externas.

## Ejecutar

Abre una terminal en la carpeta `backend` y ejecuta:

```bash
npm start
```

También puede ejecutarse directamente con:

```bash
node server.js
```

## Evidencia A - Servidor

Toma una captura de la terminal después de ejecutar `npm start`. Deben verse:

- `Servidor activo en el puerto 8000`
- `CORS: AllowAnyOrigin (*)`

## Evidencia B - Health Check

En Postman selecciona `GET` y usa:

```text
http://127.0.0.1:8000/
```

La respuesta será:

```json
{
  "status": "online",
  "message": "Servidor Arriba",
  "server_time": "..."
}
```

## Evidencia C - Código

En Visual Studio Code abre `backend/server.js` y toma una captura donde se vean:

- `Access-Control-Allow-Origin: *`
- Manejo de `OPTIONS`
- Endpoint `GET /`
- Respuesta JSON
