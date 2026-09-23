const db = require("../config/firebase.config");

const {
  FieldValue
} = require("firebase-admin/firestore");

const {
  construirUbicacion,
  construirActualizacion
} = require("../models/ubicacion-guardada.model");

const NOMBRE_COLECCION = "ubicaciones_guardadas";

function crearError(mensaje, statusCode) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
}

function validarIdentificador(valor, nombreCampo) {
  const texto = String(valor || "").trim();

  if (!texto) {
    throw crearError(
      `El campo ${nombreCampo} es obligatorio.`,
      400
    );
  }

  if (texto.includes("/")) {
    throw crearError(
      `El campo ${nombreCampo} contiene caracteres no permitidos.`,
      400
    );
  }

  return texto;
}

function crearIdDocumento(usuarioId, externalId) {
  return Buffer.from(
    `${usuarioId}|${externalId}`
  ).toString("base64url");
}

function convertirFecha(fecha) {
  if (fecha && typeof fecha.toDate === "function") {
    return fecha.toDate().toISOString();
  }

  return fecha || null;
}

function serializarDocumento(documento) {
  const datos = documento.data();

  return {
    id: documento.id,
    ...datos,
    fecha_creacion: convertirFecha(datos.fecha_creacion),
    fecha_actualizacion: convertirFecha(
      datos.fecha_actualizacion
    )
  };
}

async function obtenerDocumentoPropio(id, usuarioId) {
  const idLimpio = validarIdentificador(id, "id");
  const usuarioLimpio = validarIdentificador(
    usuarioId,
    "usuario_id"
  );

  const referencia = db
    .collection(NOMBRE_COLECCION)
    .doc(idLimpio);

  const documento = await referencia.get();

  if (
    !documento.exists ||
    documento.data().usuario_id !== usuarioLimpio
  ) {
    throw crearError(
      "La ubicación guardada no existe.",
      404
    );
  }

  return documento;
}

async function guardarUbicacion(datos, usuarioId) {
  const ubicacion = construirUbicacion(
    datos,
    usuarioId
  );

  const idDocumento = crearIdDocumento(
    ubicacion.usuario_id,
    ubicacion.external_id
  );

  const referencia = db
    .collection(NOMBRE_COLECCION)
    .doc(idDocumento);

  const existente = await referencia.get();

  if (existente.exists) {
    throw crearError(
      "Esta ubicación ya se encuentra guardada.",
      409
    );
  }

  await referencia.create({
    ...ubicacion,
    fecha_creacion: FieldValue.serverTimestamp(),
    fecha_actualizacion: FieldValue.serverTimestamp()
  });

  const documentoCreado = await referencia.get();

  return serializarDocumento(documentoCreado);
}

async function listarUbicaciones(usuarioId) {
  const usuarioLimpio = validarIdentificador(
    usuarioId,
    "usuario_id"
  );

  const resultado = await db
    .collection(NOMBRE_COLECCION)
    .where("usuario_id", "==", usuarioLimpio)
    .get();

  const ubicaciones = resultado.docs.map(
    serializarDocumento
  );

  ubicaciones.sort((a, b) =>
    String(b.fecha_creacion).localeCompare(
      String(a.fecha_creacion)
    )
  );

  return ubicaciones;
}

async function obtenerUbicacion(id, usuarioId) {
  const documento = await obtenerDocumentoPropio(
    id,
    usuarioId
  );

  return serializarDocumento(documento);
}

async function actualizarUbicacion(
  id,
  datos,
  usuarioId
) {
  const documento = await obtenerDocumentoPropio(
    id,
    usuarioId
  );

  const cambios = construirActualizacion(datos);

  await documento.ref.update({
    ...cambios,
    fecha_actualizacion: FieldValue.serverTimestamp()
  });

  const documentoActualizado =
    await documento.ref.get();

  return serializarDocumento(documentoActualizado);
}

async function eliminarUbicacion(id, usuarioId) {
  const documento = await obtenerDocumentoPropio(
    id,
    usuarioId
  );

  await documento.ref.delete();

  return {
    id: documento.id,
    eliminado: true
  };
}

module.exports = {
  guardarUbicacion,
  listarUbicaciones,
  obtenerUbicacion,
  actualizarUbicacion,
  eliminarUbicacion
};