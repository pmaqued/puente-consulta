// Detección del idioma de un texto con el detector integrado del navegador (LanguageDetector API,
// Chrome 138+). Funciona en el propio ordenador. Si el navegador no lo tiene, simplemente no se usa.

let detector = null;
let intentado = false;

async function obtener() {
  if (intentado) return detector;
  intentado = true;
  if (!("LanguageDetector" in self)) return null;
  try {
    const limite = new Promise((r) => setTimeout(() => r(null), 8000));
    detector = await Promise.race([self.LanguageDetector.create(), limite]);
  } catch {
    detector = null;
  }
  return detector;
}

/**
 * Idioma más probable del texto ("fr", "ar"…) o null si no está claro.
 * Solo se fía con textos de cierta longitud y mucha seguridad.
 */
export async function detectarIdioma(texto) {
  if (texto.length < 12) return null;
  const d = await obtener();
  if (!d) return null;
  try {
    const [primero] = await d.detect(texto);
    if (!primero || primero.confidence < 0.75 || primero.detectedLanguage === "und") return null;
    return primero.detectedLanguage;
  } catch {
    return null;
  }
}
