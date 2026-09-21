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

function limpiarLead(rawLead) {
    const lead = rawLead || {};
    return {
        id: String(lead.id || `lead-${Date.now()}`).slice(0, 80),
        origen: String(lead.origen || "web").slice(0, 40),
        region: String(lead.region || "Oficina").slice(0, 60),
        createdAt: lead.createdAt || new Date().toISOString(),
        nombre: String(lead.nombre || lead.Nombre || "").slice(0, 140),
        telefono: String(lead.telefono || lead.Telefono || "").slice(0, 60),
        email: String(lead.email || lead.Email || "").slice(0, 180),
        equipo: String(lead.equipo || lead.Tipo_De_Servicio || "").slice(0, 120),
        marca: String(lead.marca || "").slice(0, 80),
        falla: String(lead.falla || lead.Mensaje || lead.Detalle || "").slice(0, 1200)
    };
}

export default async function handler(req, res) {
    applyCors(req, res);

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Metodo no permitido. Usa POST." });
    }

    const lead = limpiarLead(req.body);
    const webhookUrl = process.env.LEADS_WEBHOOK_URL;

    if (webhookUrl) {
        try {
            const webhookResponse = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(lead)
            });

            if (!webhookResponse.ok) {
                return res.status(502).json({ error: "El webhook de leads no acepto el registro." });
            }
        } catch (error) {
            return res.status(502).json({ error: "No se pudo enviar el lead al webhook configurado." });
        }
    }

    console.info("[REFRICAZ] Lead recibido", {
        id: lead.id,
        origen: lead.origen,
        region: lead.region,
        equipo: lead.equipo
    });

    return res.status(200).json({
        ok: true,
        id: lead.id,
        storage: webhookUrl ? "webhook" : "serverless-log",
        message: webhookUrl ? "Lead enviado al webhook." : "Lead recibido. Configura LEADS_WEBHOOK_URL o Firebase para persistencia real."
    });
}
