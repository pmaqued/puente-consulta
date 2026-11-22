// «Voces de Puente»: voces Piper que funcionan dentro del propio navegador (Chrome o Edge, cualquier PC),
// sin instalar nada y sin enviar el texto fuera. Cada voz se descarga una vez (60–80 MB, desde Hugging Face)
// y se queda guardada en el navegador. Medido en un Mac: ~0,5 s para generar una frase corta.
//
// Para cambiar una voz: aquí. `hablante` es para las voces con varios (sharvard: 0 hombre, 1 mujer).

import { TtsSession, stored } from "./vendor/piper/piper-tts-web.js";

const VOCES = {
  es: {
    hombre: { id: "es_ES-sharvard-medium", hablante: 0, nombre: "Sharvard (hombre, España)", mb: 76 },
    mujer: { id: "es_ES-sharvard-medium", hablante: 1, nombre: "Sharvard (mujer, España)", mb: 76 },
  },
  ar: { hombre: { id: "ar_JO-kareem-medium", nombre: "Kareem (hombre, árabe de Jordania)", mb: 63 } },
  zh: { mujer: { id: "zh_CN-huayan-medium", nombre: "Huayan (mujer, mandarín)", mb: 63 } },
  en: {
    hombre: { id: "en_GB-alan-medium", nombre: "Alan (hombre, inglés británico)", mb: 63 },
    mujer: { id: "en_GB-alba-medium", nombre: "Alba (mujer, inglés británico)", mb: 63 },
  },
  fr: {
    hombre: { id: "fr_FR-tom-medium", nombre: "Tom (hombre, francés)", mb: 63 },
    mujer: { id: "fr_FR-siwis-medium", nombre: "Siwis (mujer, francés)", mb: 63 },
  },
  ro: { hombre: { id: "ro_RO-mihai-medium", nombre: "Mihai (hombre, rumano)", mb: 63 } },
  ru: {
    hombre: { id: "ru_RU-dmitri-medium", nombre: "Dmitri (hombre, ruso)", mb: 63 },
    mujer: { id: "ru_RU-irina-medium", nombre: "Irina (mujer, ruso)", mb: 63 },
  },
  pt: { hombre: { id: "pt_PT-tugão-medium", nombre: "Tugão (hombre, portugués)", mb: 63 } },
};

/** Voz de Puente para un idioma ("ar-MA", "es-ES"…) y género, o null si no hay para ese idioma. */
export function vozPuente(idiomaVoz, genero) {
  const porGenero = VOCES[idiomaVoz.split("-")[0].toLowerCase()];
  if (!porGenero) return null;
  return porGenero[genero] ?? Object.values(porGenero)[0];
}

/** ¿Está ya guardada en este navegador? */
export async function estaDescargada(voz) {
  try {
    return (await stored()).includes(voz.id);
  } catch {
    return false;
  }
}

const sesiones = new Map(); // "id#hablante" -> TtsSession lista

/** Descarga (si hace falta) y prepara una voz. `alProgresar(0..1)`. */
export async function prepararVoz(voz, alProgresar = () => {}) {
  const clave = `${voz.id}#${voz.hablante ?? 0}`;
  if (sesiones.has(clave)) return sesiones.get(clave);
  const promesa = (async () => {
    const sesion = new TtsSession({
      voiceId: voz.id,
      progress: (p) => { if (p.total) alProgresar(p.loaded / p.total); },
    });
    sesion.speakerId = voz.hablante ?? 0;
    await sesion.waitReady;
    return sesion;
  })();
  sesiones.set(clave, promesa);
  try {
    return await promesa;
  } catch (e) {
    sesiones.delete(clave); // que se pueda reintentar
    throw e;
  }
}

let audio = null;
let turno = 0; // cada petición nueva (o callar) invalida las anteriores que aún se están preparando

/**
 * Dice un texto con una voz de Puente. Resuelve cuando empieza a sonar.
 * Si mientras se prepara llega otra petición o se manda callar, esta ya no suena (antes se quedaban en
 * cola y sonaban todas seguidas, como en bucle).
 * Lanza error si no se puede (la página entonces usa las voces del navegador).
 */
export async function decir(texto, voz) {
  const mio = ++turno;
  quitarAudio();
  const sesion = await prepararVoz(voz);
  const wav = await sesion.predict(texto);
  if (mio !== turno) return;
  quitarAudio();
  audio = new Audio(URL.createObjectURL(wav));
  const actual = audio;
  actual.addEventListener("ended", () => URL.revokeObjectURL(actual.src), { once: true });
  await actual.play();
}

function quitarAudio() {
  if (audio) {
    audio.pause();
    URL.revokeObjectURL(audio.src);
    audio = null;
  }
}

/** ¿Está sonando ahora una voz de Puente? */
export function sonando() {
  return Boolean(audio && !audio.paused && !audio.ended);
}

export function parar() {
  turno++;
  quitarAudio();
}
