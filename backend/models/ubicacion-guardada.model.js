function crearErrorValidacion(mensaje) {
  const error = new Error(mensaje);
  error.statusCode = 400;
  return error;
}

function obtenerTextoRequerido(valor, campo) {
  const texto = String(valor || "").trim();

  if (!texto) {
    throw crearErrorValidacion(
      `El campo ${campo} es obligatorio.`
    );
  }

  return texto;
}

function obtenerNumero(valor, campo, minimo, maximo) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    throw crearErrorValidacion(
      `El campo ${campo} debe ser un número válido.`
    );
  }

  if (numero < minimo || numero > maximo) {
    throw crearErrorValidacion(
      `El campo ${campo} se encuentra fuera del rango permitido.`
    );
  }

  return numero;
}

function construirUbicacion(datos, usuarioId) {
  const notas = String(datos.notas || "").trim();

  if (notas.length > 250) {
    throw crearErrorValidacion(
      "Las notas no pueden superar los 250 caracteres."
    );
  }

  const recursoVisual = String(
    datos.recurso_visual || ""
  ).trim();

  if (
    recursoVisual &&
    !recursoVisual.startsWith("https://")
  ) {
    throw crearErrorValidacion(
      "El recurso visual debe ser una dirección HTTPS válida."
    );
  }

  return {
    usuario_id: obtenerTextoRequerido(
      usuarioId,
      "usuario_id"
    ),
    external_id: obtenerTextoRequerido(
      datos.external_id || datos.id,
      "external_id"
    ),
    nombre: obtenerTextoRequerido(
      datos.nombre,
      "nombre"
    ),
    categoria: obtenerTextoRequerido(
      datos.categoria,
      "categoria"
    ),
    estado: obtenerTextoRequerido(
      datos.estado,
      "estado"
    ),
    municipio: obtenerTextoRequerido(
      datos.municipio,
      "municipio"
    ),
    codigo_postal: datos.codigo_postal
      ? String(datos.codigo_postal).trim()
      : null,
    latitud: obtenerNumero(
      datos.latitud,
      "latitud",
      -90,
      90
    ),
    longitud: obtenerNumero(
      datos.longitud,
      "longitud",
      -180,
      180
    ),
    recurso_visual: recursoVisual || null,
    fuente: "OpenStreetMap",
    notas
  };
}

function construirActualizacion(datos) {
  if (!Object.prototype.hasOwnProperty.call(datos, "notas")) {
    throw crearErrorValidacion(
      "Debe proporcionar el campo notas para actualizar."
    );
  }

  const notas = String(datos.notas || "").trim();

  if (notas.length > 250) {
    throw crearErrorValidacion(
      "Las notas no pueden superar los 250 caracteres."
    );
  }

  return { notas };
}

module.exports = {
  construirUbicacion,
  construirActualizacion
};