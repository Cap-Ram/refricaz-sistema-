// =========================================================================
// 1. ZONA DE CONFIGURACIÓN Y VARIABLES GENERALES
// =========================================================================

// Diccionario maestro con los números oficiales de la empresa
const telefonosPorRegion = {
    "CDMX": "5560838761",
    "Puebla": "2224475927",
    "Querétaro": "4461029556",
    "Guadalajara": "3312273063",
    "Oficina": "5512728352" // Respaldo oficial de la web si algo falla
};

const REGION_RESPALDO = "Oficina";
const STORAGE_LEADS_KEY = "refricaz_leads";
const STORAGE_ANALYTICS_KEY = "refricaz_analytics";
const STORAGE_OFFERS_KEY = "refricaz_offers";
const STORAGE_OFFER_BANNER_KEY = "refricaz_offer_banner";
const STORAGE_OFFER_CARDS_KEY = "refricaz_offer_cards";
const STORAGE_HISTORY_KEY = "refricaz_service_history";
const STORAGE_COMMENTS_KEY = "refricaz_comments";
const STORAGE_USERS_KEY = "refricaz_users";
const STORAGE_SESSION_USER_KEY = "refricaz_current_user";
const REF_FEATURES = {
    aiChatbot: false,
    backendLeads: false
};

// Memoria interna del Chatbot
let chatData = { municipio: "", equipo: "", marca: "", falla: "", nombre: "" };
let currentStep = 1; 
let regionActiva = REGION_RESPALDO;
let usuarioFirebaseActual = null;
let contenidoFirebaseSitio = null;
let seccionMenuActiva = "";

function normalizarTexto(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function escaparHTML(valor) {
    return String(valor || "").replace(/[&<>"']/g, function(caracter) {
        const entidades = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
        return entidades[caracter];
    });
}

function resolverRegionServicio(region) {
    return telefonosPorRegion[region] ? region : REGION_RESPALDO;
}

function obtenerTelefonoPorRegion(region) {
    return telefonosPorRegion[resolverRegionServicio(region)];
}

function construirUrlWhatsApp(numero, mensaje = "") {
    const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : "";
    return `https://wa.me/52${numero}${texto}`;
}

function leerLeadsLocales() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_LEADS_KEY)) || [];
    } catch (error) {
        return [];
    }
}

function construirLead(origen, datos) {
    return {
        id: `lead-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        origen,
        region: datos.region || regionActiva,
        createdAt: new Date().toISOString(),
        ...datos
    };
}

function guardarLeadLocal(origen, datos) {
    const lead = construirLead(origen, datos);
    const leads = leerLeadsLocales();
    leads.unshift(lead);
    localStorage.setItem(STORAGE_LEADS_KEY, JSON.stringify(leads.slice(0, 250)));
    console.info("[REFRICAZ] Lead registrado", {
        origen: lead.origen,
        region: lead.region,
        equipo: lead.equipo || lead.Tipo_De_Servicio || "No especificado"
    });
    return lead;
}

async function enviarLeadAlBackend(lead) {
    if (!REF_FEATURES.backendLeads || window.location.protocol === "file:") return;

    try {
        await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(lead)
        });
    } catch (error) {
        console.info("[REFRICAZ] Backend de leads no disponible todavía. Se conserva el registro local.");
    }
}

async function enviarLeadAFirebase(lead) {
    if (!window.refricazFirebase?.guardarLead) return false;

    try {
        const firebaseId = await window.refricazFirebase.guardarLead(lead);
        console.info("[REFRICAZ] Lead sincronizado con Firestore", firebaseId);
        return true;
    } catch (error) {
        console.info("[REFRICAZ] Firestore aun no acepta leads. Revisa reglas de seguridad.");
        return false;
    }
}

function registrarLead(origen, datos) {
    const lead = construirLead(origen, datos);
    enviarLeadAlBackend(lead);
    enviarLeadAFirebase(lead).then((guardado) => {
        if (!guardado && !window.refricazFirebase?.guardarLead) {
            guardarLeadLocal(origen, datos);
        }
    });
    return lead;
}

function formularioAObjeto(form) {
    return Object.fromEntries(new FormData(form).entries());
}

function leerJSONLocal(clave, respaldo = []) {
    try {
        return JSON.parse(localStorage.getItem(clave)) || respaldo;
    } catch (error) {
        return respaldo;
    }
}

function guardarJSONLocal(clave, valor) {
    localStorage.setItem(clave, JSON.stringify(valor));
}

function normalizarEmail(email) {
    return String(email || "").trim().toLowerCase();
}

async function hashPassword(password) {
    const texto = String(password || "");
    if (window.crypto?.subtle) {
        const data = new TextEncoder().encode(texto);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(hashBuffer)).map(byte => byte.toString(16).padStart(2, "0")).join("");
    }

    let hash = 0;
    for (let i = 0; i < texto.length; i++) {
        hash = ((hash << 5) - hash) + texto.charCodeAt(i);
        hash |= 0;
    }
    return `fallback-${Math.abs(hash)}`;
}

function obtenerUsuarioActual() {
    if (usuarioFirebaseActual) return usuarioFirebaseActual;
    if (window.refricazFirebase) return null;
    const users = leerJSONLocal(STORAGE_USERS_KEY, []);
    const currentId = localStorage.getItem(STORAGE_SESSION_USER_KEY);
    return users.find(user => user.id === currentId) || null;
}

function observarSesionFirebase() {
    if (!window.refricazFirebase?.observarSesion) return;

    window.refricazFirebase.observarSesion((usuario) => {
        usuarioFirebaseActual = usuario;
        if (usuario) {
            localStorage.setItem(STORAGE_SESSION_USER_KEY, usuario.id);
        }
        aplicarEstadoAdmin();
    });
}

function aplicarEstadoAdmin() {
    const usuario = obtenerUsuarioActual();
    document.body.classList.toggle("is-admin", usuario?.role === "admin");
    const accountBtn = document.getElementById("accountNavBtn");
    if (accountBtn) accountBtn.textContent = usuario ? `Mi cuenta` : "Iniciar sesión";
    const sessionText = document.getElementById("accountSessionText");
    const sessionBox = document.getElementById("accountSessionBox");
    if (sessionText && sessionBox) {
        sessionBox.classList.toggle("active", Boolean(usuario));
        sessionText.textContent = usuario ? `Sesión activa: ${usuario.nombre} (${usuario.role === "admin" ? "Administrador" : "Usuario"})` : "";
    }
    const commentUser = document.getElementById("commentUser");
    if (commentUser && usuario) {
        commentUser.value = usuario.nombre;
    }
}

function abrirModalCuenta(tab = "login", mensaje = "Inicia sesión o crea una cuenta para publicar comentarios.") {
    const modal = document.getElementById("modalCuenta");
    if (!modal) return;
    const hint = document.getElementById("accountModalHint");
    if (hint) hint.textContent = mensaje;
    modal.style.display = "flex";
    cambiarTabCuenta(tab);
}

function cerrarModalCuenta() {
    const modal = document.getElementById("modalCuenta");
    if (modal) modal.style.display = "none";
}

function cambiarTabCuenta(tab) {
    document.querySelectorAll(".account-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.accountTab === tab));
    document.querySelectorAll(".account-form").forEach(form => form.classList.remove("active"));
    document.getElementById(tab === "register" ? "registerForm" : "loginForm")?.classList.add("active");
}

async function crearUsuarioDesdeSitio(nombre, email, password) {
    if (window.refricazFirebase?.crearUsuarioSitio) {
        const usuarioFirebase = await window.refricazFirebase.crearUsuarioSitio(nombre.trim(), email, password);
        usuarioFirebaseActual = usuarioFirebase;
        localStorage.setItem(STORAGE_SESSION_USER_KEY, usuarioFirebase.id);
        registrarEvento("usuario_creado", { source: "sitio", userRole: usuarioFirebase.role, backend: "firebase" });
        return usuarioFirebase;
    }

    const users = leerJSONLocal(STORAGE_USERS_KEY, []);
    const correo = normalizarEmail(email);
    if (users.some(user => user.email === correo)) {
        throw new Error("Ese correo ya está registrado.");
    }
    const user = {
        id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        nombre: nombre.trim(),
        email: correo,
        passwordHash: await hashPassword(password),
        role: "user",
        createdAt: new Date().toISOString()
    };
    users.push(user);
    guardarJSONLocal(STORAGE_USERS_KEY, users);
    localStorage.setItem(STORAGE_SESSION_USER_KEY, user.id);
    registrarEvento("usuario_creado", { source: "sitio", userRole: user.role });
    return user;
}

async function iniciarSesion(email, password) {
    if (window.refricazFirebase?.iniciarSesionSitio) {
        const usuarioFirebase = await window.refricazFirebase.iniciarSesionSitio(email, password);
        usuarioFirebaseActual = usuarioFirebase;
        localStorage.setItem(STORAGE_SESSION_USER_KEY, usuarioFirebase.id);
        registrarEvento("login", { source: "sitio", userRole: usuarioFirebase.role, backend: "firebase" });
        return usuarioFirebase;
    }

    const users = leerJSONLocal(STORAGE_USERS_KEY, []);
    const correo = normalizarEmail(email);
    const passwordHash = await hashPassword(password);
    const user = users.find(item => item.email === correo && item.passwordHash === passwordHash);
    if (!user) {
        throw new Error("Correo o contraseña incorrectos.");
    }
    localStorage.setItem(STORAGE_SESSION_USER_KEY, user.id);
    registrarEvento("login", { source: "sitio", userRole: user.role });
    return user;
}

function cerrarSesion() {
    if (window.refricazFirebase?.cerrarSesionFirebase) {
        window.refricazFirebase.cerrarSesionFirebase().catch(() => {});
    }
    usuarioFirebaseActual = null;
    localStorage.removeItem(STORAGE_SESSION_USER_KEY);
    aplicarEstadoAdmin();
    registrarEvento("logout", { source: "sitio" });
}

function registrarEvento(tipo, detalle = {}) {
    const eventos = leerJSONLocal(STORAGE_ANALYTICS_KEY, []);
    eventos.unshift({
        id: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: tipo,
        section: detalle.section || "",
        source: detalle.source || "",
        createdAt: new Date().toISOString(),
        ...detalle
    });
    guardarJSONLocal(STORAGE_ANALYTICS_KEY, eventos.slice(0, 2000));
}

async function consultarAsistenteIA(mensaje, contexto = {}) {
    if (!REF_FEATURES.aiChatbot) {
        return { reply: "IA pendiente de activar. Configura OPENAI_API_KEY en el backend y habilita aiChatbot." };
    }

    const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: mensaje, context: contexto })
    });

    if (!response.ok) {
        throw new Error("No se pudo consultar el asistente IA.");
    }

    return response.json();
}

const ofertasPorMes = [
    { mes: 0, etiqueta: "Enero preventivo", titulo: "Arranca el año con equipos listos", descripcion: "Diagnóstico preferente en lavadoras y refrigeradores para evitar fallas después de vacaciones.", imagen: "img/tecnico.jpg", alt: "Técnico Refricaz revisando equipo" },
    { mes: 1, etiqueta: "Febrero hogar", titulo: "Servicio para línea blanca esencial", descripcion: "Revisión de lavadora, secadora o refrigerador con atención prioritaria en zonas activas.", imagen: "img/lavadora.jpg", alt: "Lavadora moderna en servicio" },
    { mes: 2, etiqueta: "Marzo mantenimiento", titulo: "Mantenimiento antes de temporada de calor", descripcion: "Limpieza y diagnóstico para refrigeradores con síntomas de bajo enfriamiento.", imagen: "img/refrigerador.png", alt: "Refrigerador para mantenimiento" },
    { mes: 3, etiqueta: "Abril frío seguro", titulo: "Refrigeradores listos para el calor", descripcion: "Atención especial en fugas, sensores, empaques y carga de refrigerante.", imagen: "img/hero-bg.jpg", alt: "Servicio técnico especializado en refrigeración" },
    { mes: 4, etiqueta: "Mayo mamá", titulo: "Lavadoras y centros de lavado al día", descripcion: "Revisión de ciclos, bombas y mantenimiento preventivo para uso intensivo en casa.", imagen: "img/centro-lavado.png", alt: "Centro de lavado" },
    { mes: 5, etiqueta: "Junio express", titulo: "Servicio express para refrigeración", descripcion: "Prioridad en reportes de refrigeradores que no enfrían durante la temporada de calor.", imagen: "img/ingenieros.jpg", alt: "Ingenieros Refricaz listos para servicio" },
    { mes: 6, etiqueta: "Julio técnico", titulo: "Diagnóstico especializado multimarca", descripcion: "Atención para LG, Samsung, Mabe, Whirlpool, Maytag, GE y Sub-Zero.", imagen: "img/tecnico.jpg", alt: "Técnico especializado Refricaz" },
    { mes: 7, etiqueta: "Agosto regreso", titulo: "Equipos listos para la rutina", descripcion: "Mantenimiento de lavadoras y secadoras antes del regreso a clases.", imagen: "img/secadora.png", alt: "Secadora para mantenimiento" },
    { mes: 8, etiqueta: "Septiembre seguro", titulo: "Garantía por escrito en reparaciones", descripcion: "Servicio técnico con refacciones originales y respaldo por escrito.", imagen: "img/ingenieros.jpg", alt: "Servicio técnico con garantía" },
    { mes: 9, etiqueta: "Octubre preventivo", titulo: "Prevención de fallas eléctricas", descripcion: "Revisión de tarjetas electrónicas, sensores y sistemas de seguridad.", imagen: "img/microondas.png", alt: "Microondas para revisión técnica" },
    { mes: 10, etiqueta: "Noviembre ofertas", titulo: "Buen fin de mantenimiento", descripcion: "Cotización preferente en reparaciones generales y mantenimiento preventivo.", imagen: "img/lavadora.jpg", alt: "Lavadora en promoción de mantenimiento" },
    { mes: 11, etiqueta: "Diciembre hogar", titulo: "Equipos listos para reuniones", descripcion: "Atención prioritaria en refrigeradores, lavadoras y microondas antes de fiestas.", imagen: "img/hero-bg.jpg", alt: "Hogar con equipos listos para diciembre" }
];

const ofertaBannerBase = {
    etiqueta: "Promoción vigente",
    titulo: "Diagnóstico con atención preferente",
    descripcion: "Cotiza tu reparación o mantenimiento con respuesta rápida de un técnico especializado.",
    imagen: "img/refrigerador.png",
    alt: "Promoción Refricaz",
    boton: "Solicitar ahora",
    enlace: "#contacto",
    usarOfertaMensual: false
};

const tarjetasOfertasBase = [
    {
        id: "card-descuento",
        icono: "fa-solid fa-percent",
        titulo: "Revisión con respuesta rápida",
        descripcion: "Agenda tu diagnóstico para refrigeradores, lavadoras, secadoras y cámaras de refrigeración.",
        visible: true,
        usarOfertaMensual: false
    },
    {
        id: "card-express",
        icono: "fa-solid fa-bolt",
        titulo: "Servicio Express",
        descripcion: "Atención inmediata para emergencias en tu hogar.",
        visible: true,
        usarOfertaMensual: false
    }
];

const historialServiciosBase = [
    {
        id: "hist-refrigerador",
        titulo: "Refrigerador con falla de enfriamiento",
        equipo: "Refrigerador",
        descripcion: "Diagnóstico, limpieza de sistema y verificación de temperatura para recuperar el rendimiento del equipo.",
        antes: "img/refrigerador.png",
        despues: "img/ingenieros.jpg",
        video: "",
        visible: true
    },
    {
        id: "hist-lavadora",
        titulo: "Lavadora con mantenimiento correctivo",
        equipo: "Lavadora",
        descripcion: "Revisión de componentes, ajuste de ciclo y prueba final de funcionamiento antes de entregar el servicio.",
        antes: "img/lavadora.jpg",
        despues: "img/tecnico.jpg",
        video: "",
        visible: true
    },
    {
        id: "hist-centro-lavado",
        titulo: "Centro de lavado puesto a punto",
        equipo: "Centro de lavado",
        descripcion: "Servicio integral para ciclos de lavado y secado, con pruebas de seguridad y operación estable.",
        antes: "img/centro-lavado.png",
        despues: "img/secadora.png",
        video: "",
        visible: true
    }
];

function obtenerOfertasConfiguradas() {
    const remotas = contenidoFirebaseSitio?.offers;
    if (Array.isArray(remotas) && remotas.length === 12) return remotas;
    if (window.refricazFirebase) return ofertasPorMes;

    const guardadas = leerJSONLocal(STORAGE_OFFERS_KEY, null);
    return Array.isArray(guardadas) && guardadas.length === 12 ? guardadas : ofertasPorMes;
}

function obtenerBannerOfertaConfig(fecha = new Date()) {
    const remota = contenidoFirebaseSitio?.offerBanner;
    if (remota && typeof remota === "object") {
        return { ...ofertaBannerBase, ...remota, usarOfertaMensual: false };
    }
    if (window.refricazFirebase) return { ...ofertaBannerBase, usarOfertaMensual: false };

    const guardada = leerJSONLocal(STORAGE_OFFER_BANNER_KEY, null);
    const config = guardada && typeof guardada === "object" ? { ...ofertaBannerBase, ...guardada } : ofertaBannerBase;
    return { ...config, usarOfertaMensual: false };
}

function obtenerTarjetasOfertaConfig(fecha = new Date()) {
    const remotas = contenidoFirebaseSitio?.offerCards;
    if (Array.isArray(remotas)) return remotas.map(card => ({ ...card, usarOfertaMensual: false }));
    if (window.refricazFirebase) return tarjetasOfertasBase.map(card => ({ ...card, usarOfertaMensual: false }));

    const guardadas = leerJSONLocal(STORAGE_OFFER_CARDS_KEY, null);
    const tarjetas = Array.isArray(guardadas) ? guardadas : tarjetasOfertasBase;
    return tarjetas.map(card => ({ ...card, usarOfertaMensual: false }));
}

function obtenerHistorialServicios() {
    const remoto = contenidoFirebaseSitio?.serviceHistory;
    if (Array.isArray(remoto)) return remoto.filter(item => item.visible !== false);
    if (window.refricazFirebase) return historialServiciosBase.filter(item => item.visible !== false);

    const guardado = leerJSONLocal(STORAGE_HISTORY_KEY, null);
    const historial = Array.isArray(guardado) ? guardado : historialServiciosBase;
    return historial.filter(item => item.visible !== false);
}

async function cargarContenidoFirebase() {
    if (!window.refricazFirebase?.obtenerContenidoSitio) return;

    try {
        const contenido = await window.refricazFirebase.obtenerContenidoSitio();
        contenidoFirebaseSitio = contenido || null;
    } catch (error) {
        console.info("[REFRICAZ] Contenido Firestore no disponible todavia.");
    }
}

// =========================================================================
// 2. SISTEMA DE GEOLOCALIZACIÓN Y FILTRO DINÁMICO DE WHATSAPP
// =========================================================================

// Esta función actualiza todos los enlaces rápidos de la web según el estado activo
function actualizarCanalesDeContactoDeLaWeb(region) {
    const regionFinal = resolverRegionServicio(region);
    const numeroActual = obtenerTelefonoPorRegion(regionFinal);
    const etiquetaRegion = regionFinal === REGION_RESPALDO ? "central" : regionFinal;
    regionActiva = regionFinal;
    chatData.municipio = regionFinal;
    
    const linkTel = document.getElementById('link-telefono-rapido');
    const textoTel = document.getElementById('texto-telefono-rapido');
    const linkWa = document.getElementById('link-whatsapp-rapido');
    const textoWa = document.getElementById('texto-whatsapp-rapido');

    if(linkTel) linkTel.href = `tel:${numeroActual}`;
    if(textoTel) textoTel.innerText = `Llamar a ${etiquetaRegion}`;
    if(linkWa) {
        linkWa.href = construirUrlWhatsApp(numeroActual);
        linkWa.rel = "noopener";
    }
    actualizarBotonWhatsAppOferta();
    actualizarBotonesWhatsAppServicios();
    if(textoWa) textoWa.innerText = `Chat de atención ${etiquetaRegion}`;
}

function obtenerMensajeWhatsAppOferta() {
    const tituloOferta = document.getElementById("seasonalOfferTitle")?.textContent?.trim() || "una oferta de servicio";
    return `Hola REFRICAZ, estoy viendo la oferta "${tituloOferta}" en la página web y quiero solicitar atención por WhatsApp.`;
}

function actualizarBotonWhatsAppOferta() {
    const linkOferta = document.getElementById("seasonalOfferWhatsApp");
    if (!linkOferta) return;

    const regionActual = resolverRegionServicio(regionActiva);
    const numeroActual = obtenerTelefonoPorRegion(regionActual);
    linkOferta.href = construirUrlWhatsApp(numeroActual, obtenerMensajeWhatsAppOferta());
    linkOferta.setAttribute("aria-label", `Solicitar oferta por WhatsApp ${regionActual}`);
}

function actualizarBotonesWhatsAppServicios() {
    const regionActual = resolverRegionServicio(regionActiva);
    const numeroActual = obtenerTelefonoPorRegion(regionActual);
    const mensajes = {
        "Lavadoras": "Hola, quiero agendar un servicio para mi lavadora.",
        "Refrigeradores": "Hola, quiero agendar un servicio para mi refrigerador.",
        "Secadoras": "Hola, quiero agendar un servicio para mi secadora.",
        "Centros de Lavado": "Hola, quiero agendar un servicio para mi centro de lavado.",
        "Microondas": "Hola, quiero agendar un servicio para mi microondas.",
        "Camaras de Refrigeracion": "Hola, quiero agendar un servicio para mi camara de refrigeracion."
    };

    document.querySelectorAll(".service-box").forEach(card => {
        const titulo = card.querySelector("h3")?.textContent?.trim() || "servicio de linea blanca";
        const tituloNormalizado = normalizarTexto(titulo);
        const servicio =
            tituloNormalizado.includes("camara") ? "Camaras de Refrigeracion" :
            tituloNormalizado.includes("centro") ? "Centros de Lavado" :
            tituloNormalizado.includes("micro") ? "Microondas" :
            tituloNormalizado.includes("secadora") ? "Secadoras" :
            tituloNormalizado.includes("refrigerador") ? "Refrigeradores" :
            tituloNormalizado.includes("lavadora") ? "Lavadoras" :
            card.querySelector(".service-whatsapp-link")?.dataset.serviceName || titulo;
        const mensaje = mensajes[servicio] || `Hola, quiero agendar un servicio para ${titulo}.`;
        const details = card.querySelector(".service-details");
        let link = card.querySelector(".service-whatsapp-link");

        if (!link && details) {
            link = document.createElement("a");
            link.className = "service-detail-link service-whatsapp-link";
            link.dataset.serviceName = servicio;
            link.target = "_blank";
            link.rel = "noopener";
            link.innerHTML = `<i class="fa-brands fa-whatsapp"></i> Agendar por WhatsApp`;
            details.appendChild(link);
        }

        if (link) {
            link.href = construirUrlWhatsApp(numeroActual, mensaje);
            link.setAttribute("aria-label", `Agendar por WhatsApp: ${titulo}`);
        }
    });
}

// CAPA AUTOMÁTICA: Detecta la ubicación por IP al abrir la página
function detectarRegionPorIP() {
    actualizarCanalesDeContactoDeLaWeb(REGION_RESPALDO);
    console.info("[REFRICAZ] Deteccion por IP desactivada para evitar APIs externas. Se usa la linea central.");
    return;

    fetch('https://ipapi.co/json/')
        .then(response => response.json())
        .then(data => {
            const estadoDetectado = normalizarTexto(data.region);
            let regionAsignada = REGION_RESPALDO;

            if (estadoDetectado.includes("ciudad de mexico") || estadoDetectado.includes("mexico city") || estadoDetectado.includes("cdmx")) {
                regionAsignada = "CDMX";
            } else if (estadoDetectado.includes("puebla")) {
                regionAsignada = "Puebla";
            } else if (estadoDetectado.includes("queretaro")) {
                regionAsignada = "Querétaro";
            } else if (estadoDetectado.includes("jalisco")) {
                regionAsignada = "Guadalajara";
            }

            actualizarCanalesDeContactoDeLaWeb(regionAsignada);
            console.log("Ubicación por IP detectada con éxito: " + regionAsignada);
        })
        .catch(error => {
            console.log("Fallo en API de IP. Se asigna número de Oficina como respaldo.");
            actualizarCanalesDeContactoDeLaWeb("Oficina");
        });
}

// CAPA DE RESPALDO Y BOTÓN GENERAL: Función para desviar al WhatsApp principal
function desviarConversacionAWhatsApp(motivoServicio = "") {
    const regionActual = resolverRegionServicio(chatData.municipio || regionActiva);
    const numeroActual = obtenerTelefonoPorRegion(regionActual);
    
    let mensajeBase = "Hola REFRICAZ, estaba interactuando con su asistente virtual en la página web y me interesa solicitar soporte técnico.";
    if (motivoServicio !== "") {
        mensajeBase = `Hola REFRICAZ, requiero un servicio de revisión técnica para mi equipo: ${motivoServicio}.`;
    }
    const urlWhatsApp = construirUrlWhatsApp(numeroActual, mensajeBase);
    registrarEvento("whatsapp_directo", { source: "chatbot_contacto_directo", region: regionActual });
    window.open(urlWhatsApp, '_blank');
}

// =========================================================================
// 3. LÓGICA CORE DEL CHATBOT INTERACTIVO (PASO A PASO)
// =========================================================================

function toggleChatbot() {
    const chatWindow = document.getElementById('chatbotContainer');
    const icon = document.getElementById('chatToggleIcon');
    chatWindow.classList.toggle('minimized');
    icon.className = chatWindow.classList.contains('minimized') ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down";
}

function limpiarBotonesOpciones() {
    document.querySelectorAll('.chat-options-grid').forEach(cont => cont.remove());
}

function mostrarOpcionesUbicacionInicial() {
    setTimeout(() => {
        appendMessage('bot', '¡Hola! Bienvenido al soporte técnico de <strong>REFRICAZ</strong>. ¿Cómo deseas proceder hoy con tu equipo de línea blanca?', [
            { texto: 'Agendar servicio', valor: 'Agendar' },
            { texto: 'Contactar ahora', valor: 'Contacto Directo' }
        ]);
    }, 400);
}

function appendMessage(sender, text, options = []) {
    limpiarBotonesOpciones(); 
    const chatBody = document.getElementById('chatBody');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${sender}`;
    const paragraph = document.createElement('p');
    if (sender === 'bot') {
        paragraph.innerHTML = text;
    } else {
        paragraph.textContent = text;
    }
    msgDiv.appendChild(paragraph);
    chatBody.appendChild(msgDiv);

    if (options.length > 0) {
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'chat-options-grid'; 
        
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'btn-chat-grid-option';
            btn.innerText = opt.texto;
            btn.onclick = function() { procesarRespuestaUsuario(opt.valor); };
            optionsDiv.appendChild(btn);
        });
        chatBody.appendChild(optionsDiv);
    }
    chatBody.scrollTop = chatBody.scrollHeight; 
}

function mostrarIndicadorEscritura() {
    limpiarBotonesOpciones();
    const chatBody = document.getElementById('chatBody');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'chatTypingIndicator';
    typingDiv.className = 'chat-msg bot typing';
    typingDiv.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
    chatBody.appendChild(typingDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
}

function ocultarIndicadorEscritura() {
    const indicator = document.getElementById('chatTypingIndicator');
    if (indicator) indicator.remove();
}

document.getElementById('chatInputForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const inputElement = document.getElementById('chatInputText');
    const userResponse = inputElement.value.trim();
    if (!userResponse) return;
    inputElement.value = ''; 
    procesarRespuestaUsuario(userResponse);
});

// MOTOR PRINCIPAL DEL CHAT
function procesarRespuestaUsuario(respuesta) {
    appendMessage('user', respuesta);
    mostrarIndicadorEscritura();

    setTimeout(() => {
        ocultarIndicadorEscritura();
        
        if (respuesta === 'Contacto Directo') {
            desviarConversacionAWhatsApp('');
            appendMessage('bot', 'Te he redirigido a nuestro canal de soporte inmediato en WhatsApp. ¡Estamos listos para atenderte!');
            return;
        }

        switch (currentStep) {
            case 1:
                currentStep = 2;
                appendMessage('bot', 'Perfecto. Para asignarte al técnico de zona ideal, ¿en qué ciudad o estado te encuentras?', [
                    { texto: 'CDMX', valor: 'CDMX' },
                    { texto: 'Puebla', valor: 'Puebla' },
                    { texto: 'Querétaro', valor: 'Querétaro' },
                    { texto: 'Guadalajara', valor: 'Guadalajara' },
                    { texto: 'Otra ubicación', valor: 'Oficina' }
                ]);
                break;
            case 2:
                // GUARDAMOS Y FILTRAMOS: Si el usuario selecciona manualmente, cambiamos toda la web
                actualizarCanalesDeContactoDeLaWeb(respuesta); 
                
                currentStep = 3;
                appendMessage('bot', `Excelente. Tu atención se canalizará por <strong>${escaparHTML(chatData.municipio)}</strong>.<br><br>¿Qué tipo de equipo requiere reparación o mantenimiento?`, [
                    { texto: 'Refrigerador', valor: 'Refrigerador' },
                    { texto: 'Lavadora', valor: 'Lavadora' },
                    { texto: 'Secadora', valor: 'Secadora' },
                    { texto: 'Microondas', valor: 'Microondas' },
                    { texto: 'Otro equipo', valor: 'Otro equipo' }
                ]);
                break;
            case 3:
                chatData.equipo = respuesta;
                currentStep = 4;
                appendMessage('bot', `Entendido, registramos el equipo: ${escaparHTML(chatData.equipo)}.<br><br>¿De qué marca es tu electrodoméstico?`, [
                    { texto: 'LG', valor: 'LG' },
                    { texto: 'Samsung', valor: 'Samsung' },
                    { texto: 'Whirlpool', valor: 'Whirlpool' },
                    { texto: 'Mabe', valor: 'Mabe' },
                    { texto: 'Otra marca', valor: 'Otra marca' }
                ]);
                break;
            case 4:
                chatData.marca = respuesta;
                currentStep = 5;
                appendMessage('bot', `Marca registrada: <strong>${escaparHTML(chatData.marca)}</strong>.<br><br>Por favor, escribe brevemente la falla que presenta tu equipo:`);
                document.getElementById('chatInputText').focus();
                break;
            case 5:
                chatData.falla = respuesta;
                currentStep = 6;
                appendMessage('bot', 'Por último, ¿cuál es tu nombre completo para registrar la cotización?');
                break;
            case 6:
                chatData.nombre = respuesta;
                currentStep = 7;
                document.getElementById('chatInputText').disabled = true;
                document.getElementById('chatSubmitBtn').disabled = true;

                appendMessage('bot', `¡Muchas gracias, ${escaparHTML(chatData.nombre)}! He generado tu orden de soporte de manera exitosa.`);
                appendMessage('bot', 'Haz clic en el siguiente botón para transferir tus datos de forma automática a nuestro WhatsApp corporativo regional:');
                
                // GENERACIÓN DEL BOTÓN FINAL CON NÚMERO FILTRADO O RESPALDO
                const regionFinal = resolverRegionServicio(chatData.municipio || regionActiva);
                const numeroDestinoFinal = obtenerTelefonoPorRegion(regionFinal);
                
                const mensajeWhatsApp = `Hola REFRICAZ, quiero cotizar un servicio técnico:\n\n- Nombre: ${chatData.nombre}\n- Ubicación: ${regionFinal}\n- Equipo: ${chatData.equipo}\n- Marca: ${chatData.marca}\n- Falla: ${chatData.falla}`;
                const urlCompleta = construirUrlWhatsApp(numeroDestinoFinal, mensajeWhatsApp);

                registrarLead("chatbot", {
                    nombre: chatData.nombre,
                    region: regionFinal,
                    equipo: chatData.equipo,
                    marca: chatData.marca,
                    falla: chatData.falla
                });
                registrarEvento("chatbot_completado", { source: "chatbot", region: regionFinal, equipo: chatData.equipo });

                const chatBody = document.getElementById('chatBody');
                const waLink = document.createElement('a');
                waLink.href = urlCompleta; waLink.target = "_blank"; waLink.className = "btn-chat-whatsapp";
                waLink.rel = "noopener";
                waLink.style.display = "block"; waLink.style.textAlign = "center"; waLink.style.background = "#25d366";
                waLink.style.color = "white"; waLink.style.padding = "12px"; waLink.style.borderRadius = "10px";
                waLink.style.marginTop = "10px"; waLink.style.textDecoration = "none"; waLink.style.fontWeight = "bold";
                waLink.innerHTML = `<i class="fa-brands fa-whatsapp"></i> Enviar Reporte a WhatsApp`;
                waLink.addEventListener("click", () => registrarEvento("whatsapp_directo", { source: "chatbot_reporte", region: regionFinal, equipo: chatData.equipo }));
                chatBody.appendChild(waLink);
                chatBody.scrollTop = chatBody.scrollHeight;
                break;
        }
    }, 900); 
}


// =========================================================================
// 4. ANIMACIONES, APIS, EVENTOS VISUALES Y MODALES
// =========================================================================

// Eventos de inicio de página
document.addEventListener("DOMContentLoaded", async function() {
    document.getElementById('chatbotContainer').classList.add('minimized');
    observarSesionFirebase();
    aplicarEstadoAdmin();
    registrarEvento("page_view", { source: "sitio" });
    detectarRegionPorIP(); // Dispara la detección de región automáticamente
    await cargarContenidoFirebase();
    aplicarOfertaDinamica();
    renderizarHistorialServicios();
    activarCarruselHistorial();
    renderMapaSedeSinApiKey();
    const comentariosFirebase = await cargarComentariosFirebase();
    if (!comentariosFirebase) cargarComentariosLocales();
    activarCuentaUsuario();
    mostrarOpcionesUbicacionInicial();
    activarObservadorDeScroll(); 
    activarNavegacionPorSeccion();
    activarTrackingDeContacto();
    activarFaqAcordeon();
    actualizarBotonesWhatsAppServicios();
    activarParallaxHero();
    activarServiciosInteractivos();
    resaltarDiaActual();
    registrarServiceWorker();
});

// Control de barra de navegación flotante
window.addEventListener('scroll', function() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

function activarParallaxHero() {
    const hero = document.querySelector(".hero");
    if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ticking = false;
    const actualizar = () => {
        const desplazamiento = Math.min(window.scrollY * 0.12, 90);
        hero.style.setProperty("--hero-parallax", `${desplazamiento}px`);
        ticking = false;
    };

    window.addEventListener("scroll", () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(actualizar);
    }, { passive: true });

    actualizar();
}

function activarServiciosInteractivos() {
    document.querySelectorAll(".service-box").forEach(card => {
        card.setAttribute("tabindex", "0");
        card.addEventListener("click", (event) => {
            if (event.target.closest("a")) return;
            if (window.matchMedia("(hover: none)").matches || window.innerWidth <= 900) {
                card.classList.toggle("is-expanded");
            }
        });
        card.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            if (event.target.closest("a")) return;
            event.preventDefault();
            card.classList.toggle("is-expanded");
        });
    });
}

// Motor de observación para animaciones CSS
function activarObservadorDeScroll() {
    const opcionesScroll = { threshold: 0.25, rootMargin: "0px 0px -30px 0px" };
    const observador = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('appear');
                if (entry.target.classList.contains('service-box')) entry.target.classList.add('reveal');
                if (entry.target.classList.contains('brand-item')) entry.target.classList.add('active-brand');
                if (entry.target.classList.contains('active-trigger')) entry.target.classList.add('reveal-active');
            } else {
                if (entry.target.classList.contains('service-box')) entry.target.classList.remove('reveal');
                if (entry.target.classList.contains('brand-item')) entry.target.classList.remove('active-brand');
                if (entry.target.classList.contains('active-trigger')) entry.target.classList.remove('reveal-active');
            }
        });
    }, opcionesScroll);

    document.querySelectorAll('.scroll-animate').forEach(el => observador.observe(el));
    document.querySelectorAll('.list-animate, .card-animate').forEach(el => observador.observe(el));
    document.querySelectorAll('.service-box').forEach(el => observador.observe(el));
    document.querySelectorAll('.brand-item').forEach(el => observador.observe(el));
    document.querySelectorAll('.active-trigger').forEach(el => observador.observe(el));
}

function activarNavegacionPorSeccion() {
    const enlaces = [...document.querySelectorAll('#navMenu a[href^="#"]')];
    const elementos = enlaces
        .map(link => ({ link, section: document.querySelector(link.getAttribute("href")) }))
        .filter(item => item.section);

    if (!elementos.length) return;

    const activarSeccionActual = () => {
        const puntoLectura = window.scrollY + Math.max(120, window.innerHeight * 0.32);
        let actual = elementos[0];

        elementos.forEach(item => {
            if (item.section.offsetTop <= puntoLectura) actual = item;
        });

        const id = actual.link.getAttribute("href");
        enlaces.forEach(link => {
            const activo = link.getAttribute("href") === id;
            link.classList.toggle("active-section", activo);
            link.classList.toggle("active", activo);
        });

        if (id !== seccionMenuActiva) {
            seccionMenuActiva = id;
            registrarEvento("section_view", { section: id.replace("#", "") });
        }
    };

    activarSeccionActual();
    window.addEventListener("scroll", activarSeccionActual, { passive: true });
    window.addEventListener("resize", activarSeccionActual);
}

function activarTrackingDeContacto() {
    document.getElementById("link-whatsapp-rapido")?.addEventListener("click", () => {
        registrarEvento("whatsapp_directo", { source: "boton_rapido", region: regionActiva });
    });
    document.getElementById("seasonalOfferWhatsApp")?.addEventListener("click", () => {
        registrarEvento("whatsapp_directo", { source: "oferta_temporada", region: regionActiva });
    });
    document.getElementById("link-telefono-rapido")?.addEventListener("click", () => {
        registrarEvento("llamada_directa", { source: "boton_rapido", region: regionActiva });
    });
    document.querySelectorAll(".hero-buttons button").forEach(button => {
        button.addEventListener("click", () => registrarEvento("modal_servicio", { source: "hero" }));
    });
}

function activarFaqAcordeon() {
    document.querySelectorAll(".faq-item").forEach(item => {
        item.addEventListener("toggle", () => {
            if (!item.open) return;

            document.querySelectorAll(".faq-item[open]").forEach(other => {
                if (other !== item) other.open = false;
            });
        });
    });
}

function activarCuentaUsuario() {
    document.getElementById("accountNavBtn")?.addEventListener("click", () => abrirModalCuenta(obtenerUsuarioActual() ? "login" : "login"));

    document.querySelectorAll(".account-tab").forEach(button => {
        button.addEventListener("click", () => cambiarTabCuenta(button.dataset.accountTab));
    });

    document.getElementById("registerForm")?.addEventListener("submit", async function(e) {
        e.preventDefault();
        try {
            await crearUsuarioDesdeSitio(
                document.getElementById("registerName").value,
                document.getElementById("registerEmail").value,
                document.getElementById("registerPassword").value
            );
            this.reset();
            aplicarEstadoAdmin();
            cerrarModalCuenta();
            alert("Cuenta creada correctamente. Ya puedes publicar comentarios con tu usuario.");
        } catch (error) {
            alert(error.message);
        }
    });

    document.getElementById("loginForm")?.addEventListener("submit", async function(e) {
        e.preventDefault();
        try {
            await iniciarSesion(
                document.getElementById("loginEmail").value,
                document.getElementById("loginPassword").value
            );
            this.reset();
            aplicarEstadoAdmin();
            cerrarModalCuenta();
        } catch (error) {
            alert(error.message);
        }
    });

    document.getElementById("logoutBtn")?.addEventListener("click", () => {
        cerrarSesion();
        cerrarModalCuenta();
    });
}

// Interacción de Reseñas / Comentarios
function toggleVisibilidadComentarios() {
    const wrapper = document.querySelector('.reviews-wrapper');
    const boton = document.getElementById('btnToggleReviews');
    wrapper.classList.toggle('expanded');
    boton.classList.toggle('active');
    if (wrapper.classList.contains('expanded')) {
        boton.innerHTML = `<i class="fa-solid fa-chevron-up"></i> Ocultar comentarios`;
    } else {
        boton.innerHTML = `<i class="fa-solid fa-chevron-down"></i> Ver más opiniones`;
        document.getElementById('testimonios').scrollIntoView({ behavior: 'smooth' });
    }
}

function aplicarOfertaDinamica(fecha = new Date()) {
    const oferta = obtenerBannerOfertaConfig(fecha);
    const imagen = document.getElementById("seasonalOfferImage");
    const eyebrow = document.getElementById("seasonalOfferEyebrow");
    const titulo = document.getElementById("seasonalOfferTitle");
    const descripcion = document.getElementById("seasonalOfferDescription");
    const accion = document.getElementById("seasonalOfferAction");

    if (imagen) {
        imagen.src = oferta.imagen;
        imagen.alt = oferta.alt;
    }
    if (eyebrow) eyebrow.textContent = oferta.etiqueta;
    if (titulo) titulo.textContent = oferta.titulo;
    if (descripcion) descripcion.textContent = oferta.descripcion;
    if (accion) {
        accion.href = oferta.enlace || "#contacto";
        accion.innerHTML = `<i class="fa-solid fa-calendar-check"></i> ${escaparHTML(oferta.boton || "Solicitar ahora")}`;
    }
    actualizarBotonWhatsAppOferta();
    renderizarTarjetasDeOfertas(fecha);
}

function renderizarTarjetasDeOfertas(fecha = new Date()) {
    const grid = document.getElementById("offersCardsGrid");
    if (!grid) return;

    const tarjetas = obtenerTarjetasOfertaConfig(fecha).filter(card => card.visible !== false);
    grid.innerHTML = "";

    tarjetas.forEach(card => {
        const tarjeta = document.createElement("div");
        tarjeta.className = "card card-animate";
        tarjeta.innerHTML = `
            <div class="card-icon"><i class="${escaparHTML(card.icono || "fa-solid fa-percent")}"></i></div>
            <h3>${escaparHTML(card.titulo)}</h3>
            <p>${escaparHTML(card.descripcion)}</p>
        `;
        grid.appendChild(tarjeta);
    });
}

let historialActual = 0;
let ultimoFocoHistorial = null;

function abrirImagenHistorial(src, alt, etiqueta) {
    const lightbox = document.getElementById("historyLightbox");
    const imagen = document.getElementById("historyLightboxImage");
    const caption = document.getElementById("historyLightboxCaption");
    const cerrar = document.getElementById("historyLightboxClose");
    if (!lightbox || !imagen) return;

    ultimoFocoHistorial = document.activeElement;
    imagen.src = src || "img/tecnico.jpg";
    imagen.alt = alt || "Imagen ampliada del servicio Refricaz";
    if (caption) caption.textContent = `${etiqueta || "Imagen"} del servicio`;
    lightbox.classList.add("active");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    cerrar?.focus();
    registrarEvento("historial_imagen_ampliada", { source: "historial", label: etiqueta || "" });
}

function cerrarImagenHistorial() {
    const lightbox = document.getElementById("historyLightbox");
    const imagen = document.getElementById("historyLightboxImage");
    if (!lightbox) return;

    lightbox.classList.remove("active");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    if (imagen) imagen.removeAttribute("src");
    if (ultimoFocoHistorial?.focus) ultimoFocoHistorial.focus();
}

function activarLightboxHistorial() {
    const lightbox = document.getElementById("historyLightbox");
    document.getElementById("historyLightboxClose")?.addEventListener("click", cerrarImagenHistorial);
    lightbox?.addEventListener("click", (event) => {
        if (event.target === lightbox) cerrarImagenHistorial();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && lightbox?.classList.contains("active")) {
            cerrarImagenHistorial();
        }
    });
}

function crearMediaHistorial(src, etiqueta, tipo = "image") {
    const contenedor = document.createElement(tipo === "video" ? "div" : "button");
    contenedor.className = "history-media";

    if (tipo !== "video") {
        contenedor.type = "button";
        contenedor.classList.add("history-media-button");
        contenedor.title = "Ver imagen ampliada";
        contenedor.setAttribute("aria-label", `Ampliar imagen ${etiqueta.toLowerCase()} del servicio`);
    }

    const label = document.createElement("span");
    label.className = etiqueta === "Después" ? "history-label after" : "history-label";
    label.textContent = etiqueta;
    contenedor.appendChild(label);

    if (tipo === "video") {
        const video = document.createElement("video");
        video.src = src;
        video.controls = true;
        video.preload = "metadata";
        contenedor.appendChild(video);
        return contenedor;
    }

    const imagen = document.createElement("img");
    imagen.src = src || "img/tecnico.jpg";
    imagen.alt = `${etiqueta} del servicio Refricaz`;
    imagen.loading = "lazy";
    contenedor.appendChild(imagen);

    const zoom = document.createElement("span");
    zoom.className = "history-zoom-cue";
    zoom.setAttribute("aria-hidden", "true");
    zoom.innerHTML = `<i class="fa-solid fa-expand"></i>`;
    contenedor.appendChild(zoom);
    contenedor.addEventListener("click", () => {
        const viewport = contenedor.closest(".history-viewport");
        if (viewport?.dataset.dragMoved === "true") return;
        abrirImagenHistorial(imagen.currentSrc || imagen.src, imagen.alt, etiqueta);
    });

    return contenedor;
}

function renderizarHistorialServicios() {
    const track = document.getElementById("serviceHistoryTrack");
    const dots = document.getElementById("serviceHistoryDots");
    if (!track || !dots) return;

    const items = obtenerHistorialServicios();
    track.innerHTML = "";
    dots.innerHTML = "";

    if (!items.length) {
        track.innerHTML = `<div class="history-empty">Aún no hay trabajos visibles en el historial.</div>`;
        return;
    }

    items.forEach((item, index) => {
        const slide = document.createElement("article");
        slide.className = "history-slide";

        const mediaGrid = document.createElement("div");
        mediaGrid.className = "history-media-grid";

        if (item.video) {
            mediaGrid.classList.add("single");
            mediaGrid.appendChild(crearMediaHistorial(item.video, "Video", "video"));
        } else {
            mediaGrid.append(
                crearMediaHistorial(item.antes, "Antes"),
                crearMediaHistorial(item.despues, "Después")
            );
        }

        const copy = document.createElement("div");
        copy.className = "history-copy";
        copy.innerHTML = `
            <span>${escaparHTML(item.equipo || "Servicio técnico")}</span>
            <h3>${escaparHTML(item.titulo || "Trabajo realizado")}</h3>
            <p>${escaparHTML(item.descripcion || "Servicio realizado por técnicos REFRICAZ.")}</p>
        `;

        slide.append(mediaGrid, copy);
        track.appendChild(slide);

        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = `history-dot${index === 0 ? " active" : ""}`;
        dot.setAttribute("aria-label", `Ver trabajo ${index + 1}`);
        dot.addEventListener("click", () => moverHistorial(index));
        dots.appendChild(dot);
    });

    historialActual = Math.min(historialActual, items.length - 1);
    moverHistorial(historialActual);
}

function moverHistorial(index) {
    const track = document.getElementById("serviceHistoryTrack");
    const dots = [...document.querySelectorAll(".history-dot")];
    if (!track) return;

    const total = track.children.length;
    if (!total) return;

    historialActual = (index + total) % total;
    track.style.transform = `translateX(-${historialActual * 100}%)`;
    dots.forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === historialActual));
}

function activarCarruselHistorial() {
    document.getElementById("historyPrev")?.addEventListener("click", () => moverHistorial(historialActual - 1));
    document.getElementById("historyNext")?.addEventListener("click", () => moverHistorial(historialActual + 1));
    activarArrastreHistorial();
    activarLightboxHistorial();
}

function activarArrastreHistorial() {
    const viewport = document.querySelector(".history-viewport");
    if (!viewport || viewport.dataset.dragReady === "true") return;

    viewport.dataset.dragReady = "true";
    let inicioX = 0;
    let inicioY = 0;
    let arrastrando = false;

    const finalizar = (clientX) => {
        if (!arrastrando) return;
        viewport.classList.remove("dragging");
        arrastrando = false;
        const distancia = clientX - inicioX;
        if (Math.abs(distancia) > 55) {
            moverHistorial(historialActual + (distancia < 0 ? 1 : -1));
        }
    };

    viewport.addEventListener("pointerdown", (event) => {
        if (event.target.closest("a, video")) return;
        inicioX = event.clientX;
        inicioY = event.clientY;
        arrastrando = true;
        viewport.dataset.dragMoved = "false";
        viewport.classList.add("dragging");
        viewport.setPointerCapture?.(event.pointerId);
    });

    viewport.addEventListener("pointermove", (event) => {
        if (!arrastrando) return;
        if (Math.abs(event.clientX - inicioX) > 10) {
            viewport.dataset.dragMoved = "true";
        }
        if (Math.abs(event.clientY - inicioY) > 45) {
            finalizar(event.clientX);
        }
    });

    viewport.addEventListener("pointerup", (event) => finalizar(event.clientX));
    viewport.addEventListener("pointercancel", (event) => finalizar(event.clientX));
    viewport.addEventListener("lostpointercapture", (event) => finalizar(event.clientX || inicioX));
}

function renderMapaSedeSinApiKey() {
    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;

    const direccion = "Periférico Boulevard Adolfo López Mateos 1977, Los Alpes, Álvaro Obregón, 01010 Ciudad de México, CDMX";
    const iframe = document.createElement("iframe");
    iframe.className = "map-embed";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.allowFullscreen = true;
    iframe.title = "Mapa de la sede principal REFRICAZ";
    iframe.src = `https://www.google.com/maps?q=${encodeURIComponent(direccion)}&output=embed`;

    mapContainer.innerHTML = "";
    mapContainer.appendChild(iframe);
}

function registrarServiceWorker() {
    if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;

    navigator.serviceWorker.register("service-worker.js")
        .catch(() => console.info("[REFRICAZ] Service Worker no disponible en este entorno."));
}

// Resaltar horario dinámico según el día
function resaltarDiaActual() {
    const numeroDia = new Date().getDay();
    const filaSemana = document.getElementById('row-semana');
    const filaSabado = document.getElementById('row-sabado');
    const filaDomingo = document.getElementById('row-domingo');
    
    if (numeroDia === 0) {
        if (filaDomingo) filaDomingo.classList.add('current-day-highlight');
    } else if (numeroDia === 6) {
        if (filaSabado) filaSabado.classList.add('current-day-highlight');
    } else {
        if (filaSemana) filaSemana.classList.add('current-day-highlight');
    }
}

// =========================================================================
// 5. MANEJO DE MODALES, POP-UPS Y FORMULARIOS DE CONTACTO
// =========================================================================

function abrirModal(tipoServicio) {
    const modal = document.getElementById('modalServicio');
    const titulo = document.getElementById('modalTitle');
    const inputOculto = document.getElementById('tipoServicioOculto');
    
    titulo.innerText = `Agendar Servicio de ${tipoServicio}`;
    
    // Guardamos qué botón presionó (Instalación o Reparación) para el correo
    if(inputOculto) inputOculto.value = tipoServicio; 
    
    // Lo guardamos en una variable global temporal para el botón de WhatsApp
    window.servicioSeleccionadoHero = tipoServicio; 
    
    modal.style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modalServicio').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('modalServicio');
    if (event.target === modal) modal.style.display = 'none';
    const modalCuenta = document.getElementById('modalCuenta');
    if (event.target === modalCuenta) modalCuenta.style.display = 'none';
}

// Envío asíncrono del Modal a Formspree
document.getElementById('appointmentForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const form = e.target;
    const btnSubmit = form.querySelector('.btn-submit');
    const textoOriginal = btnSubmit.innerHTML;
    
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ENVIANDO...';
    btnSubmit.disabled = true;

    try {
        registrarLead("modal", {
            ...formularioAObjeto(form),
            region: regionActiva,
            servicio: window.servicioSeleccionadoHero || "Servicio TÃ©cnico"
        });
        registrarEvento("formulario_enviado", { source: "modal_servicio", region: regionActiva });
        cerrarModal();
        abrirModalExito();
        form.reset();
        return;

        const response = await fetch(form.action, {
            method: form.method,
            body: new FormData(form),
            headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
            registrarLead("modal", {
                ...formularioAObjeto(form),
                region: regionActiva,
                servicio: window.servicioSeleccionadoHero || "Servicio Técnico"
            });
            registrarEvento("formulario_enviado", { source: "modal_servicio", region: regionActiva });
            cerrarModal();       // Quitamos el modal de captura
            abrirModalExito();   // Mostramos la palomita verde de éxito
            form.reset();
        } else {
            alert("Hubo un error al enviar tu solicitud. Inténtalo de nuevo.");
        }
    } catch (error) {
        alert("Error de red. Verifica tu conexión a internet.");
    } finally {
        btnSubmit.innerHTML = textoOriginal;
        btnSubmit.disabled = false;
    }
});

// NUEVO: Enrutamiento inteligente a WhatsApp desde el Modal
function enviarWhatsAppDesdeModal() {
    // 1. Leemos la región que el sistema ya detectó automáticamente por la IP
    const regionActual = resolverRegionServicio(chatData.municipio || regionActiva);
    const numeroDestino = obtenerTelefonoPorRegion(regionActual);
    
    // 2. Leemos si eligió "Instalación" o "Reparación"
    const tipo = window.servicioSeleccionadoHero || "Servicio Técnico";
    
    // 3. Armamos el mensaje profesional
    const mensajeWhatsApp = `Hola REFRICAZ, me encuentro en la región de ${regionActual} y prefiero atención rápida. Me interesa solicitar un servicio de *${tipo}* de línea blanca.`;
    
    const urlCompleta = construirUrlWhatsApp(numeroDestino, mensajeWhatsApp);
    registrarEvento("whatsapp_directo", { source: "modal_servicio", region: regionActual, servicio: tipo });
    
    cerrarModal(); // Cerramos la ventana limpia
    window.open(urlCompleta, '_blank'); // Redirigimos al WhatsApp correcto
}


// Control de modales de éxito visuales
function abrirModalExito() { document.getElementById('modalExito').style.display = 'flex'; }
function cerrarModalExito() { document.getElementById('modalExito').style.display = 'none'; }
function abrirModalComment() { document.getElementById('modalCommentSuccess').style.display = 'flex'; }
function cerrarModalComment() { document.getElementById('modalCommentSuccess').style.display = 'none'; }

// Formulario principal general conectado a Formspree
document.getElementById('mainContactForm').addEventListener('submit', async function(e) {
    e.preventDefault(); 
    const form = e.target;
    registrarLead("formulario", {
        ...formularioAObjeto(form),
        region: regionActiva
    });
    registrarEvento("formulario_enviado", { source: "formulario_contacto", region: regionActiva });
    abrirModalExito();
    form.reset();
    return;
    
    // Efecto visual mientras se envía el correo
    const btnSubmit = form.querySelector('.btn-submit-form');
    const textoOriginal = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ENVIANDO...';
    btnSubmit.disabled = true;

    try {
        // Envío de los datos a Formspree sin recargar la página
        const response = await fetch(form.action, {
            method: form.method,
            body: new FormData(form),
            headers: { 'Accept': 'application/json' }
        });
        
        // Si Formspree recibe el correo, mostramos tu modal y borramos el form
        if (response.ok) {
            registrarLead("formulario", {
                ...formularioAObjeto(form),
                region: regionActiva
            });
            registrarEvento("formulario_enviado", { source: "formulario_contacto", region: regionActiva });
            abrirModalExito();
            form.reset();
        } else {
            alert("Hubo un error en el servidor al enviar tu solicitud. Inténtalo de nuevo.");
        }
    } catch (error) {
        alert("Error de red. Verifica tu conexión a internet.");
    } finally {
        // Restauramos el botón a su estado original
        btnSubmit.innerHTML = textoOriginal;
        btnSubmit.disabled = false;
    }
});

function obtenerComentariosLocales() {
    return leerJSONLocal(STORAGE_COMMENTS_KEY, []);
}

function guardarComentarioLocal(comentario) {
    const comentarios = obtenerComentariosLocales();
    comentarios.unshift(comentario);
    guardarJSONLocal(STORAGE_COMMENTS_KEY, comentarios.slice(0, 300));
}

async function guardarComentarioFirebase(comentario) {
    if (!window.refricazFirebase?.guardarComentario) return false;

    try {
        await window.refricazFirebase.guardarComentario(comentario);
        return true;
    } catch (error) {
        console.info("[REFRICAZ] Firestore aun no acepta comentarios. Revisa reglas de seguridad.");
        return false;
    }
}

function crearTarjetaComentario(comentario) {
    if (comentario.hidden) return null;

    let estrellasHtml = '';
    for(let i = 0; i < comentario.estrellas; i++) estrellasHtml += '<i class="fa-solid fa-star"></i>';

    const nuevaTarjeta = document.createElement('div');
    nuevaTarjeta.className = 'review-card';
    nuevaTarjeta.dataset.commentId = comentario.id;
    nuevaTarjeta.style.animation = 'ventanaEntrada 0.5s ease-out';
    nuevaTarjeta.innerHTML = `
        <div class="review-stars">${estrellasHtml}</div>
        <p class="review-text">"${escaparHTML(comentario.texto)}"</p>
        <div class="review-author"><h4>${escaparHTML(comentario.usuario)}</h4><span>Cliente Verificado</span></div>
    `;
    return nuevaTarjeta;
}

function cargarComentariosLocales() {
    if (window.refricazFirebase?.obtenerComentariosPublicos) return;
    const grid = document.getElementById('reviewsGrid');
    if (!grid) return;

    obtenerComentariosLocales()
        .slice()
        .reverse()
        .forEach(comentario => {
            const tarjeta = crearTarjetaComentario(comentario);
            if (tarjeta) grid.insertBefore(tarjeta, grid.firstChild);
        });
}

async function cargarComentariosFirebase() {
    if (!window.refricazFirebase?.obtenerComentariosPublicos) return false;
    const grid = document.getElementById('reviewsGrid');
    if (!grid) return false;

    try {
        const comentarios = await window.refricazFirebase.obtenerComentariosPublicos();
        comentarios
            .filter(comentario => !document.querySelector(`[data-comment-id="${comentario.id}"]`))
            .slice()
            .reverse()
            .forEach(comentario => {
                const tarjeta = crearTarjetaComentario(comentario);
                if (tarjeta) grid.insertBefore(tarjeta, grid.firstChild);
            });
        return true;
    } catch (error) {
        console.info("[REFRICAZ] Comentarios Firestore no disponibles todavia.");
        return false;
    }
}

// Creación de nuevas reseñas
document.getElementById('commentForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const usuarioActual = obtenerUsuarioActual();
    if (!usuarioActual) {
        abrirModalCuenta("register", "Para publicar tu comentario primero crea una cuenta. Completa estos datos y después podrás enviar tu opinión.");
        return;
    }

    const usuario = usuarioActual.nombre;
    const estrellasNum = parseInt(document.getElementById('commentStars').value);
    const texto = document.getElementById('commentText').value;

    const comentario = {
        id: `comment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        userId: usuarioActual.id,
        usuario,
        email: usuarioActual.email,
        estrellas: estrellasNum,
        texto,
        hidden: false,
        createdAt: new Date().toISOString()
    };
    const guardadoFirebase = await guardarComentarioFirebase(comentario);
    if (!guardadoFirebase) {
        if (window.refricazFirebase?.guardarComentario) {
            alert("No se pudo guardar el comentario en la base de datos. Intenta otra vez.");
            return;
        }
        guardarComentarioLocal(comentario);
    }
    registrarEvento("comentario_enviado", { source: "encuesta", rating: estrellasNum });

    const nuevaTarjeta = crearTarjetaComentario(comentario);

    const grid = document.getElementById('reviewsGrid');
    if (nuevaTarjeta) grid.insertBefore(nuevaTarjeta, grid.firstChild);

    const wrapper = document.querySelector('.reviews-wrapper');
    const boton = document.getElementById('btnToggleReviews');
    
    if (!wrapper.classList.contains('expanded')) {
        wrapper.classList.add('expanded');
        boton.classList.add('active');
        boton.innerHTML = `<i class="fa-solid fa-chevron-up"></i> Ocultar comentarios`;
    }

    abrirModalComment();
    this.reset();
    aplicarEstadoAdmin();
});

// =========================================================================
// 6. CONTROL INTERACTIVO DEL MENÚ HAMBURGUESA (MÓVIL)
// =========================================================================
document.addEventListener("DOMContentLoaded", function() {
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (menuToggle && navMenu) {
        // Evento principal: Abre o cierra la cortina al pulsar la hamburguesa
        menuToggle.addEventListener('click', function(e) {
            e.stopPropagation(); // Evita conflictos con clics externos
            navMenu.classList.toggle('active');
            
            // Animación del icono: Cambia entre barras (☰) y equis (✕)
            const icon = menuToggle.querySelector('i');
            if (icon) {
                if (navMenu.classList.contains('active')) {
                    icon.className = "fa-solid fa-xmark";
                    menuToggle.style.transform = "rotate(90deg)";
                } else {
                    icon.className = "fa-solid fa-bars";
                    menuToggle.style.transform = "rotate(0deg)";
                }
            }
        });
        
        // Cierre inteligente: Si el usuario da clic en un enlace del menú, la cortina se cierra sola
        navMenu.querySelectorAll('a, button').forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                if (icon) {
                    icon.className = "fa-solid fa-bars";
                    menuToggle.style.transform = "rotate(0deg)";
                }
            });
        });
        
        // Cerrar si el usuario da un toque fuera del menú desplegable
        document.addEventListener('click', function(e) {
            if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
                navMenu.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                if (icon) {
                    icon.className = "fa-solid fa-bars";
                    menuToggle.style.transform = "rotate(0deg)";
                }
            }
        });
    }
});

document.addEventListener("DOMContentLoaded", function() {
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    if (!menuToggle || !navMenu) return;

    const icon = menuToggle.querySelector('i');
    const sincronizarMenu = () => {
        const abierto = navMenu.classList.contains('active');
        document.body.classList.toggle('menu-open', abierto);
        menuToggle.classList.toggle('is-open', abierto);
        menuToggle.setAttribute('aria-controls', 'navMenu');
        menuToggle.setAttribute('aria-expanded', String(abierto));
        menuToggle.style.transform = "";
        if (icon) icon.className = abierto ? "fa-solid fa-xmark" : "fa-solid fa-bars";
    };

    const sincronizarDespuesDelClick = () => requestAnimationFrame(sincronizarMenu);
    menuToggle.setAttribute('aria-controls', 'navMenu');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.addEventListener('click', sincronizarDespuesDelClick);
    navMenu.querySelectorAll('a, button').forEach(link => link.addEventListener('click', sincronizarDespuesDelClick));
    document.addEventListener('click', sincronizarDespuesDelClick);
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        navMenu.classList.remove('active');
        sincronizarMenu();
    });
});
