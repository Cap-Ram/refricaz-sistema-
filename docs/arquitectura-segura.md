# Arquitectura segura para REFRICAZ

Este proyecto todavia es un sitio estatico, sin API de IA y sin base de datos real. Por eso la primera version queda preparada en dos capas:

1. Cliente estatico: `index.html`, `style.css`, `script.js`, `admin.html`.
2. Backend minimalista: funciones serverless en `api/`, pensadas para Vercel.

## 1. Variables de entorno

Una variable de entorno es un valor que vive fuera del codigo fuente. Sirve para guardar llaves, tokens, URLs privadas o configuraciones por ambiente.

Ejemplo:

```bash
OPENAI_API_KEY=tu_llave_openai
OPENAI_MODEL=gpt-5.4-mini
LEADS_WEBHOOK_URL=https://...
```

Reglas:

- El archivo real debe llamarse `.env.local` y no se sube al repositorio.
- `.env.example` solo documenta nombres de variables, sin valores reales.
- El navegador nunca debe recibir llaves privadas.

## 2. Backend minimalista con Vercel Functions

Vercel ejecuta archivos dentro de `api/` como endpoints de servidor. El sitio estatico llama a endpoints propios como `/api/ai-chat`; esa funcion llama a OpenAI usando `process.env.OPENAI_API_KEY`.

Flujo:

```text
Browser -> /api/ai-chat -> OpenAI Responses API
Browser -> /api/leads -> Webhook temporal o Firebase futuro
```

Pasos:

1. Crear proyecto en Vercel.
2. Subir este repositorio.
3. Crear variables en Vercel: `OPENAI_API_KEY`, `OPENAI_MODEL`, `LEADS_WEBHOOK_URL`.
4. En local, copiar `.env.example` como `.env.local`.
5. Probar con Vercel CLI usando `vercel dev`.

## 3. Integracion IA

El archivo `api/ai-chat.js` ya esta listo para usar OpenAI cuando exista la llave. La autenticacion se hace con header `Authorization: Bearer ${OPENAI_API_KEY}` del lado servidor.

Desde cliente, la llamada correcta es:

```js
const response = await fetch("/api/ai-chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: "Mi refrigerador Samsung no enfria",
    context: { region: "CDMX", equipo: "Refrigerador" }
  })
});

const data = await response.json();
console.log(data.reply);
```

Por ahora `REF_FEATURES.aiChatbot` esta en `false` dentro de `script.js`, asi que no cambia el flujo actual del chatbot.

## 4. Leads sin base de datos todavia

El sitio registra leads en `localStorage` bajo la llave `refricaz_leads`. Esto alimenta `admin.html` mientras no exista Firebase.

Cuando el sitio este en Vercel, tambien intentara enviar cada lead a `/api/leads`. Si configuras `LEADS_WEBHOOK_URL`, puedes mandar esos datos a SheetDB, Zapier, Make o Google Sheets antes de migrar a Firestore.

## 5. Firebase Firestore futuro

Recomendacion: no escribas leads directo desde el navegador a Firestore en produccion. Usa `/api/leads` con Firebase Admin SDK para validar, limpiar y guardar datos.

Estructura sugerida:

```text
leads/{leadId}
  origen: "formulario" | "chatbot" | "modal"
  region: "CDMX"
  nombre: "..."
  telefono: "..."
  equipo: "Refrigerador"
  marca: "Samsung"
  falla: "No enfria"
  createdAt: timestamp
```

Lectura basica para el dashboard con Firestore Web SDK:

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, orderBy, query, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "tu_api_key_publica_de_firebase",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const leadsQuery = query(collection(db, "leads"), orderBy("createdAt", "desc"), limit(100));
const snapshot = await getDocs(leadsQuery);
const leads = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
```

Regla base para dashboard protegido con Firebase Auth:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leads/{leadId} {
      allow read, write: if request.auth != null && request.auth.token.admin == true;
    }
  }
}
```

## 6. Google Maps

La key visible se elimino del HTML. Para una sede fija, el sitio usa un iframe de Google Maps sin API key.

Si despues se necesita Maps JavaScript API, Places, Geocoding o Routes:

- Usa llaves separadas por entorno.
- Restringe la key por dominio y por API.
- Las llamadas de servicios REST deben pasar por backend.

## 7. Ofertas dinamicas

`script.js` tiene un array `ofertasPorMes`. Cada elemento define mes, titulo, descripcion e imagen. Al cargar la pagina, `aplicarOfertaDinamica()` toma `new Date().getMonth()` y actualiza el banner.

## 8. PWA basica

Se agregaron:

- `manifest.json`
- `service-worker.js`
- registro automatico desde `script.js`

Esto permite instalacion como app en navegadores compatibles cuando el sitio corre en HTTPS o localhost.

## Referencias oficiales

- OpenAI Responses API: https://developers.openai.com/api/reference/resources/responses/methods/create
- OpenAI modelos: https://developers.openai.com/api/docs/models
- Vercel Functions: https://vercel.com/docs/functions
- Vercel variables de entorno: https://vercel.com/docs/environment-variables
- Firebase Firestore: https://firebase.google.com/docs/firestore/quickstart
- Chart.js: https://www.chartjs.org/docs/latest/getting-started/
- Google Maps API security: https://developers.google.com/maps/api-security-best-practices
