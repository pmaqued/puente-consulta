// Traducción con el traductor integrado del navegador (Translator API de Chrome 138+ / Edge 148+).
// Todo ocurre en el propio ordenador: el texto no sale del equipo.
//
// Modo de prueba: si la dirección lleva ?prueba, se usa un traductor falso (pone el idioma delante
// del texto). Sirve para probar la página en navegadores sin la API.

const MODO_PRUEBA = new URLSearchParams(location.search).has("prueba");
// ?prueba=descarga: además simula que hay que descargar el idioma (para ver la tarjeta de preparación).
const SIMULAR_DESCARGA = new URLSearchParams(location.search).get("prueba") === "descarga";

const cache = new Map(); // "es>ar" -> traductor ya creado

export function hayTraductor() {
  return MODO_PRUEBA || "Translator" in self;
}

export function esModoPrueba() {
  return MODO_PRUEBA;
}

/**
 * "available" | "downloadable" | "downloading" | "unavailable" | "sin-respuesta".
 * "sin-respuesta": el navegador tiene la API pero no contesta (se ha visto en navegadores que la
 * traen a medias). Se espera como mucho 10 s para no dejar la página colgada sin avisar.
 */
export async function disponibilidad(origen, destino) {
  if (MODO_PRUEBA) return SIMULAR_DESCARGA && !cache.has(`${origen}>${destino}`) ? "downloadable" : "available";
  const limite = new Promise((resolver) => setTimeout(() => resolver("sin-respuesta"), 10_000));
  try {
    return await Promise.race([
      self.Translator.availability({ sourceLanguage: origen, targetLanguage: destino }),
      limite,
    ]);
  } catch {
    return "unavailable";
  }
}

/**
 * Prepara (y si hace falta descarga) el traductor de un sentido.
 * La primera descarga necesita que venga de un clic del usuario.
 * `alProgresar(0..1)` informa de la descarga.
 */
export async function preparar(origen, destino, alProgresar = () => {}) {
  const clave = `${origen}>${destino}`;
  if (cache.has(clave)) return cache.get(clave);

  let traductor;
  if (MODO_PRUEBA) {
    if (SIMULAR_DESCARGA) {
      for (let p = 0; p <= 1; p += 0.1) {
        alProgresar(p);
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    traductor = { translate: async (texto) => `[${destino}] ${texto}` };
  } else {
    traductor = await self.Translator.create({
      sourceLanguage: origen,
      targetLanguage: destino,
      monitor(m) {
        m.addEventListener("downloadprogress", (e) => alProgresar(e.loaded));
      },
    });
  }
  cache.set(clave, traductor);
  return traductor;
}

export async function traducir(texto, origen, destino) {
  if (origen === destino) return texto;
  const traductor = await preparar(origen, destino);
  return traductor.translate(texto);
}
