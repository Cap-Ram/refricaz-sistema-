import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
    getDownloadURL,
    getStorage,
    ref,
    uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyD7GGpr5i7tiUMkclkDWvZN2eLmse84Dwg",
    authDomain: "refricaz-df11e.firebaseapp.com",
    projectId: "refricaz-df11e",
    storageBucket: "refricaz-df11e.firebasestorage.app",
    messagingSenderId: "272960827488",
    appId: "1:272960827488:web:63c631ee308c0c4e7d9305",
    measurementId: "G-GG1H0MFF0E"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

const BOOTSTRAP_ADMIN_EMAILS = ["ali.ramses.perez.martinez@gmail.com"];

function limpiarObjeto(valor) {
    return Object.fromEntries(
        Object.entries(valor || {}).filter(([, item]) => item !== undefined && item !== null)
    );
}

async function guardarDocumento(coleccion, datos) {
    const docRef = await addDoc(collection(db, coleccion), {
        ...limpiarObjeto(datos),
        syncedAt: serverTimestamp()
    });
    return docRef.id;
}

function normalizarEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function esAdminBootstrap(email) {
    return BOOTSTRAP_ADMIN_EMAILS.includes(normalizarEmail(email));
}

function nombreArchivoSeguro(nombre) {
    return String(nombre || "archivo")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 90);
}

function perfilDesdeUsuario(firebaseUser, perfil = {}) {
    return {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        nombre: perfil.nombre || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Usuario",
        email: normalizarEmail(perfil.email || firebaseUser.email),
        role: perfil.role || "user",
        createdAt: perfil.createdAt || new Date().toISOString()
    };
}

async function obtenerPerfil(uid = auth.currentUser?.uid) {
    if (!uid) return null;
    const snapshot = await getDoc(doc(db, "users", uid));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, uid: snapshot.id, ...snapshot.data() };
}

async function crearPerfilUsuario(firebaseUser, datos = {}) {
    const perfil = {
        uid: firebaseUser.uid,
        nombre: datos.nombre || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Usuario",
        email: normalizarEmail(datos.email || firebaseUser.email),
        role: datos.role || "user",
        createdAt: datos.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, "users", firebaseUser.uid), limpiarObjeto(perfil), { merge: true });
    return { id: firebaseUser.uid, ...perfil };
}

async function crearUsuarioSitio(nombre, email, password) {
    const credential = await createUserWithEmailAndPassword(auth, normalizarEmail(email), password);
    await updateProfile(credential.user, { displayName: nombre });
    return crearPerfilUsuario(credential.user, { nombre, email, role: "user" });
}

async function iniciarSesionSitio(email, password) {
    const credential = await signInWithEmailAndPassword(auth, normalizarEmail(email), password);
    let perfil = await obtenerPerfil(credential.user.uid);
    if (!perfil) {
        perfil = await crearPerfilUsuario(credential.user, { role: "user" });
    }
    return perfilDesdeUsuario(credential.user, perfil);
}

async function iniciarSesionAdmin(email, password, nombre = "Administrador") {
    const correo = normalizarEmail(email);
    let credential;

    try {
        credential = await signInWithEmailAndPassword(auth, correo, password);
    } catch (error) {
        if (!esAdminBootstrap(correo)) throw error;
        credential = await createUserWithEmailAndPassword(auth, correo, password);
        await updateProfile(credential.user, { displayName: nombre });
    }

    let perfil = await obtenerPerfil(credential.user.uid);
    if (!perfil && esAdminBootstrap(correo)) {
        perfil = await crearPerfilUsuario(credential.user, { nombre, email: correo, role: "admin" });
    }

    if (perfil?.role !== "admin" && esAdminBootstrap(correo)) {
        await actualizarUsuario(credential.user.uid, { role: "admin" });
        perfil = { ...perfil, role: "admin", updatedAt: new Date().toISOString() };
    }

    if (perfil?.role !== "admin") {
        await signOut(auth);
        throw new Error("Tu usuario existe, pero no tiene acceso de administrador.");
    }

    return perfilDesdeUsuario(credential.user, perfil);
}

function cerrarSesionFirebase() {
    return signOut(auth);
}

async function guardarLead(lead) {
    return guardarDocumento("leads", lead);
}

async function guardarComentario(comentario) {
    return guardarDocumento("comments", comentario);
}

async function obtenerComentariosPublicos(maximo = 40) {
    const consulta = query(
        collection(db, "comments"),
        where("hidden", "==", false),
        limit(maximo)
    );
    const snapshot = await getDocs(consulta);
    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

async function obtenerContenidoSitio() {
    const snapshot = await getDoc(doc(db, "siteConfig", "main"));
    return snapshot.exists() ? snapshot.data() : null;
}

async function guardarContenidoSitio(cambios) {
    await setDoc(doc(db, "siteConfig", "main"), {
        ...limpiarObjeto(cambios),
        updatedAt: serverTimestamp()
    }, { merge: true });
}

async function subirArchivoSitio(file, carpeta = "general") {
    if (!auth.currentUser) {
        throw new Error("Inicia sesion como administrador para subir archivos.");
    }
    if (!file) {
        throw new Error("Selecciona un archivo valido.");
    }

    const ruta = `site/${carpeta}/${Date.now()}-${nombreArchivoSeguro(file.name)}`;
    const storageRef = ref(storage, ruta);
    const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type || "application/octet-stream",
        customMetadata: {
            uploadedBy: auth.currentUser.uid
        }
    });
    return getDownloadURL(snapshot.ref);
}

async function obtenerColeccion(coleccion, maximo = 200) {
    const consulta = query(
        collection(db, coleccion),
        orderBy("createdAt", "desc"),
        limit(maximo)
    );
    const snapshot = await getDocs(consulta);
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

async function obtenerDatosAdmin() {
    const [leads, comments, users, siteContent] = await Promise.all([
        obtenerColeccion("leads", 300),
        obtenerColeccion("comments", 300),
        obtenerColeccion("users", 300),
        obtenerContenidoSitio()
    ]);
    return { leads, comments, users, siteContent };
}

async function actualizarUsuario(uid, cambios) {
    await updateDoc(doc(db, "users", uid), {
        ...limpiarObjeto(cambios),
        updatedAt: new Date().toISOString()
    });
}

async function actualizarComentario(id, cambios) {
    await updateDoc(doc(db, "comments", id), {
        ...limpiarObjeto(cambios),
        updatedAt: new Date().toISOString()
    });
}

async function eliminarComentario(id) {
    await deleteDoc(doc(db, "comments", id));
}

function observarSesion(callback) {
    return onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
            callback(null);
            return;
        }

        try {
            const perfil = await obtenerPerfil(firebaseUser.uid);
            callback(perfil ? perfilDesdeUsuario(firebaseUser, perfil) : perfilDesdeUsuario(firebaseUser));
        } catch (error) {
            callback(perfilDesdeUsuario(firebaseUser));
        }
    });
}

window.refricazFirebase = {
    app,
    auth,
    db,
    storage,
    esAdminBootstrap,
    crearUsuarioSitio,
    iniciarSesionSitio,
    iniciarSesionAdmin,
    cerrarSesionFirebase,
    observarSesion,
    obtenerPerfil,
    guardarLead,
    guardarComentario,
    obtenerComentariosPublicos,
    obtenerContenidoSitio,
    guardarContenidoSitio,
    subirArchivoSitio,
    obtenerDatosAdmin,
    actualizarUsuario,
    actualizarComentario,
    eliminarComentario
};
