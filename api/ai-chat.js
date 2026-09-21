const SYSTEM_PROMPT = `
Eres el asistente de soporte de REFRICAZ, una empresa mexicana de servicio tecnico para linea blanca.
Responde en espanol claro, breve y profesional.
Tu objetivo es orientar, recopilar datos utiles y facilitar que el usuario agende por WhatsApp o formulario.
No inventes precios, garantias ni disponibilidad exacta. No solicites datos bancarios ni informacion sensible.
Si el usuario reporta una emergencia o necesita visita, pide ciudad, equipo, marca, falla y telefono de contacto.
`;

function applyCors(req, res) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function extractOutputText(data) {
    if (data.output_text) return data.output_text;

    const parts = [];
    for (const item of data.output || []) {
        for (const content of item.content || []) {
            if (content.type === "output_text" && content.text) parts.push(content.text);
        }
    }
    return parts.join("\n").trim();
}

export default async function handler(req, res) {
    applyCors(req, res);

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Metodo no permitido. Usa POST." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(503).json({
            error: "IA no configurada",
            message: "Agrega OPENAI_API_KEY en tus variables de entorno del backend."
        });
    }

    const { message, context = {} } = req.body || {};
    const safeMessage = String(message || "").trim().slice(0, 1200);

    if (!safeMessage) {
        return res.status(400).json({ error: "El campo message es obligatorio." });
    }

    const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
    const payload = {
        model,
        instructions: SYSTEM_PROMPT,
        input: [
            {
                role: "user",
                content: [
                    {
                        type: "input_text",
                        text: `Contexto del sitio: ${JSON.stringify(context).slice(0, 1200)}\n\nMensaje del usuario: ${safeMessage}`
                    }
                ]
            }
        ],
        reasoning: { effort: "low" },
        text: { verbosity: "low" },
        max_output_tokens: 450
    };

    try {
        const upstream = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await upstream.json();

        if (!upstream.ok) {
            return res.status(upstream.status).json({
                error: "OpenAI rechazo la solicitud",
                detail: data.error?.message || "Revisa la llave, el modelo y el saldo del proyecto."
            });
        }

        return res.status(200).json({
            reply: extractOutputText(data) || "Gracias, ya tengo tu mensaje. Un asesor puede continuar por WhatsApp.",
            model,
            responseId: data.id
        });
    } catch (error) {
        return res.status(500).json({
            error: "No se pudo contactar al proveedor de IA",
            detail: "Intenta de nuevo en unos minutos."
        });
    }
}
