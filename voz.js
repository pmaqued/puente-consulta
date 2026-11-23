// Dictado (voz → texto) y lectura en voz alta (texto → voz).
//
// Privacidad: en Chrome y Edge el dictado normalmente ENVÍA EL AUDIO a los servidores de Google o
// Microsoft. Algunos navegadores ya permiten hacerlo en el propio equipo (`processLocally`), pero no
// en todos los idiomas. Por eso:
//   - Si el dictado puede hacerse en el equipo, se usa siempre así.
//   - Si no, se usa por internet solo si está permitido en Ajustes y el paciente ha dado permiso (app.js).
// Lo mismo con las voces: las que no son del sistema (`localService: false`) envían el texto fuera.

const Reconocimiento = self.SpeechRecognition || self.webkitSpeechRecognition;

export function hayDictado() {
  return Boolean(Reconocimiento);
}

/**
 * Cómo se puede dictar en un idioma:
 * "local" (en el equipo) | "descargable" (en el equipo tras descargar) | "internet" | "no".
 */
export async function modoDictado(idiomaVoz) {
  if (!Reconocimiento) return "no";
  if (typeof Reconocimiento.available === "function") {
    try {
      const estado = await Reconocimiento.available({ langs: [idiomaVoz], processLocally: true });
      if (estado === "available") return "local";
      if (estado === "downloadable" || estado === "downloading") return "descargable";
    } catch {
      /* el navegador no sabe responder: se trata como solo internet */
    }
  }
  return "internet";
}

/** Descarga el dictado en el equipo para un idioma (necesita un clic del usuario). */
export async function instalarDictado(idiomaVoz) {
  if (typeof Reconocimiento?.install !== "function") return false;
  try {
    return await Reconocimiento.install({ langs: [idiomaVoz], processLocally: true });
  } catch {
    return false;
  }
}

/**
 * Empieza a dictar. Devuelve una función para parar.
 * - alTexto(textoProvisional): mientras se habla.
 * - alTerminar(textoFinal): cuando se para (puede ser "").
 * - alError(mensaje)
 */
export function dictar(idiomaVoz, { local, alTexto, alTerminar, alError }) {
  const rec = new Reconocimiento();
  rec.lang = idiomaVoz;
  rec.interimResults = true;
  rec.continuous = true; // sigue escuchando hasta que se pulse otra vez o haya silencio largo
  if (local && "processLocally" in rec) rec.processLocally = true;

  let finalTexto = "";
  let provisional = "";
  rec.onresult = (e) => {
    provisional = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalTexto += r[0].transcript + " ";
      else provisional += r[0].transcript;
    }
    alTexto((finalTexto + provisional).trim());
  };
  rec.onerror = (e) => {
    const mensajes = {
      "not-allowed": "El navegador no tiene permiso para usar el micrófono.",
      "audio-capture": "No se encuentra ningún micrófono.",
      network: "Sin conexión con el servicio de dictado.",
      "language-not-supported": "El dictado no está disponible en este idioma.",
      "no-speech": "",
      aborted: "",
    };
    const m = mensajes[e.error] ?? `Error de dictado (${e.error}).`;
    if (m) alError(m);
  };
  rec.onend = () => alTerminar((finalTexto + provisional).trim());
  rec.start();
  return () => rec.stop();
}

// ---- Lectura en voz alta ----
//
// Dos «motores»:
//   - "puente": voces Piper dentro de la página (voces-puente.js). Iguales en Chrome y Edge y en cualquier PC.
//   - "navegador": las voces que tenga el navegador (sistema, Google, o las «Natural» de Edge).
// Si la voz de Puente falla o no hay para ese idioma, se usa la del navegador.

import { vozPuente, decir, parar as pararPuente, sonando as sonandoPuente } from "./voces-puente.js";

let voces = [];
function cargarVoces() {
  voces = self.speechSynthesis?.getVoices() ?? [];
}
if (self.speechSynthesis) {
  cargarVoces();
  speechSynthesis.addEventListener?.("voiceschanged", cargarVoces);
}

// Los navegadores no dicen si una voz es de hombre o de mujer: se deduce por el nombre.
// Nombres de voces de macOS, Windows, Edge (voces «Natural») y Google.
const MUJERES = new Set(`monica paulina marisol angelica isabela soledad francisca helena laura elvira sabina
  dalia abril irene elena lucia ximena triana estrella vera laia beatriz candela camila valentina salome sofia
  paloma maria carmen renata esperanza lia
  laila layla mariam maryam hoda zariyah salma amina fatima noura iman sana reem mouna amany aysha rana sanaa
  hala yasmin
  tingting lili meijia sinji shanshan yushu huihui yaoyao hanhan tracy xiaoxiao xiaoyi xiaohan xiaomo xiaoxuan
  xiaorui xiaoshuang xiaomeng xiaochen xiaoqiu xiaoyan xiaozhen hsiaochen hsiaoyu hiugaai hiumaan yating
  google`.split(/\s+/));
const HOMBRES = new Set(`jorge juan diego carlos pablo raul alvaro arnau dario elias nil saul teo gerardo
  enrique alonso tomas jaime jose marcelo ricardo cristian lorenzo mateo emilio federico gonzalo andres
  majed maged tarik naayf hamed shakir hamdan jamal bassel omar taim rami fahed moaz ali ismael laith hamid
  fares khalid ahmed mohammed
  kangkang zhiwei yunxi yunyang yunjian yunhao yunfeng yunze yunye yunzhe wanlung yunjhe limu han`.split(/\s+/));
// Voces «de broma» de macOS (Eddy, Reed, Rocko, Grandpa…): solo si no hay otra cosa.
const NOVEDAD = new Set(`eddy flo grandma grandpa reed rocko sandy shelley albert bahh bells boing bubbles
  cellos jester organ superstar trinoids whisper wobble zarvox fred junior kathy ralph`.split(/\s+/));

function palabras(nombre) {
  return nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

/** "hombre", "mujer" o null si no se sabe. */
export function generoDe(voz) {
  const p = palabras(voz.name);
  if (p.some((w) => HOMBRES.has(w))) return "hombre";
  if (p.some((w) => MUJERES.has(w))) return "mujer";
  return null;
}

function calidad(voz) {
  const p = palabras(voz.name);
  let puntos = 0;
  if (p.some((w) => NOVEDAD.has(w))) puntos -= 300; // peor que una voz buena del otro género
  if (p.some((w) => ["natural", "neural", "premium"].includes(w))) puntos += 50;
  if (p.some((w) => ["mejorada", "enhanced"].includes(w))) puntos += 40;
  if (p.includes("google")) puntos += 30;
  if (voz.localService) puntos += 5;
  return puntos;
}

const normalizarLang = (l) => l.replace("_", "-").toLowerCase();

/**
 * Mejor voz para un idioma, o null. `permitirInternet` admite voces en la nube.
 * `genero` ("hombre" | "mujer" | null): se prefiere una voz de ese género si la hay.
 */
export function vozPara(idiomaVoz, permitirInternet, genero = null) {
  const base = idiomaVoz.split("-")[0].toLowerCase();
  const candidatas = voces
    .filter((v) => normalizarLang(v.lang).split("-")[0] === base)
    .filter((v) => permitirInternet || v.localService);
  let mejor = null;
  let mejorPuntos = -Infinity;
  for (const v of candidatas) {
    let puntos = calidad(v);
    const g = generoDe(v);
    if (genero) puntos += g === genero ? 200 : g === null ? 0 : -200;
    // Misma región: importa poco en español, pero en chino distingue mandarín de China / Taiwán / Hong Kong.
    if (normalizarLang(v.lang) === idiomaVoz.toLowerCase()) puntos += base === "zh" ? 60 : 10;
    if (puntos > mejorPuntos) { mejor = v; mejorPuntos = puntos; }
  }
  return mejor;
}

/**
 * Limpia el texto para leerlo: quita caracteres invisibles de dirección (los añaden a veces los
 * traductores en árabe) y las vocales cortas del árabe (harakat), que algunas voces leen mal.
 */
function limpiar(texto) {
  return texto
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/\s+([،,.!?؟])/g, "$1")
    .trim();
}

let hablando = null;

/** Intenta decir un texto. Resuelve "ok" si empieza a sonar, o un texto con el motivo si no. */
function intentar(texto, voz, lang) {
  return new Promise((resolver) => {
    const u = new SpeechSynthesisUtterance(texto);
    if (voz) u.voice = voz;
    u.lang = lang;
    u.rate = 0.9; // un poco más despacio de lo normal
    hablando = u; // Chrome pierde el audio si la frase se libera de memoria antes de acabar
    let terminado = false;
    const acabar = (r) => { if (!terminado) { terminado = true; resolver(r); } };
    u.onstart = () => acabar("ok");
    u.onerror = (e) => acabar(e.error || "error");
    // Chrome a veces no dice nada ni avisa: si en 2,5 s no ha empezado, se da por fallido.
    setTimeout(() => acabar("no empezó"), 2500);
    speechSynthesis.speak(u);
  });
}

/**
 * Lee un texto en voz alta. Devuelve null si ha sonado, o un mensaje con el problema.
 * Se corta lo anterior y se espera un momento (Chrome se "traga" a veces lo que se pide justo después
 * de cancelar). Si con la voz elegida no suena, se prueba dejando que el navegador elija por el idioma.
 */
export async function leer(texto, idiomaVoz, permitirInternet, genero = null, motor = "navegador") {
  texto = limpiar(texto);
  let fallo = null;
  if (motor === "puente") {
    const puente = vozPuente(idiomaVoz, genero);
    if (puente) {
      try {
        callar();
        await decir(texto, puente);
        return null;
      } catch (e) {
        console.warn("Voz de Puente:", e);
        fallo = `La voz de Puente no ha funcionado (${e?.message || e}).`;
      }
    }
  }
  const voz = vozPara(idiomaVoz, permitirInternet, genero);
  if (!voz && fallo) return `${fallo} Y el navegador no tiene voz para este idioma.`;
  if (!voz) return "No hay ninguna voz para este idioma en el ordenador.";
  speechSynthesis.cancel();
  await new Promise((r) => setTimeout(r, 80));
  const primero = await intentar(texto, voz, voz.lang.replace("_", "-"));
  if (primero === "ok") return null;
  speechSynthesis.cancel();
  await new Promise((r) => setTimeout(r, 80));
  const segundo = await intentar(texto, null, idiomaVoz);
  if (segundo === "ok") return null;
  speechSynthesis.cancel();
  return `No se pudo leer en voz alta con la voz «${voz.name}» (${primero}).`;
}

/** ¿Se está leyendo algo en voz alta ahora mismo (voz de Puente o del navegador)? */
export function estaSonando() {
  return Boolean(self.speechSynthesis?.speaking) || sonandoPuente();
}

export function callar() {
  self.speechSynthesis?.cancel();
  pararPuente();
}
