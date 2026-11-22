// Idiomas de Puente Consulta.
// - traduccion: código para el traductor integrado del navegador (Translator API).
// - voz: código para el dictado y la lectura en voz alta (cambia el acento, no la traducción).
// - dir: "rtl" para los idiomas que se escriben de derecha a izquierda.
// - genero: voz con la que se lee en voz alta ("hombre" | "mujer"); sin él, la de mejor calidad.
//   La del español la elige el profesional arriba.
// - textos: frases de la interfaz para el lado del paciente. Si no están, se traducen solas
//   con el propio traductor la primera vez.

export const PROFESIONAL = {
  id: "es",
  nombre: "Español",
  traduccion: "es",
  voz: "es-ES",
  dir: "ltr",
};

export const IDIOMAS = [
  {
    id: "ar-MA", nombre: "Árabe (Marruecos)", nativo: "العربية (المغرب)", traduccion: "ar", voz: "ar-MA", dir: "rtl", genero: "hombre",
    textos: { hablar: "اضغط وتكلم", escuchando: "أنا أستمع…", escribir: "اكتب هنا…", enviar: "إرسال", tu: "أنت",
      bienvenida: "هذه الشاشة تترجم تلقائيا. تكلم ببطء وبجمل قصيرة." },
  },
  {
    id: "ar", nombre: "Árabe (estándar)", nativo: "العربية", traduccion: "ar", voz: "ar-SA", dir: "rtl", genero: "hombre",
    textos: { hablar: "اضغط وتكلم", escuchando: "أنا أستمع…", escribir: "اكتب هنا…", enviar: "إرسال", tu: "أنت",
      bienvenida: "هذه الشاشة تترجم تلقائيا. تكلم ببطء وبجمل قصيرة." },
  },
  {
    id: "zh", nombre: "Chino (simplificado)", nativo: "中文（简体）", traduccion: "zh", voz: "zh-CN", dir: "ltr", genero: "mujer",
    textos: { hablar: "按下说话", escuchando: "正在听…", escribir: "在这里输入…", enviar: "发送", tu: "您",
      bienvenida: "这个屏幕会自动翻译。请慢慢说，用短句。" },
  },
  {
    id: "zh-Hant", nombre: "Chino (tradicional)", nativo: "中文（繁體）", traduccion: "zh-Hant", voz: "zh-TW", dir: "ltr", genero: "mujer",
    textos: { hablar: "按下說話", escuchando: "正在聽…", escribir: "在這裡輸入…", enviar: "傳送", tu: "您",
      bienvenida: "這個螢幕會自動翻譯。請慢慢說，用短句。" },
  },
  { id: "en", nombre: "Inglés", nativo: "English", traduccion: "en", voz: "en-GB", dir: "ltr",
    textos: { hablar: "Press and speak", escuchando: "Listening…", escribir: "Type here…", enviar: "Send", tu: "You",
      bienvenida: "This screen translates automatically. Please speak slowly, in short sentences." } },
  { id: "fr", nombre: "Francés", nativo: "Français", traduccion: "fr", voz: "fr-FR", dir: "ltr",
    textos: { hablar: "Appuyez et parlez", escuchando: "J’écoute…", escribir: "Écrivez ici…", enviar: "Envoyer", tu: "Vous",
      bienvenida: "Cet écran traduit automatiquement. Parlez lentement, avec des phrases courtes." } },
  { id: "ro", nombre: "Rumano", nativo: "Română", traduccion: "ro", voz: "ro-RO", dir: "ltr" },
  { id: "uk", nombre: "Ucraniano", nativo: "Українська", traduccion: "uk", voz: "uk-UA", dir: "ltr" },
  { id: "ru", nombre: "Ruso", nativo: "Русский", traduccion: "ru", voz: "ru-RU", dir: "ltr" },
  { id: "pt", nombre: "Portugués", nativo: "Português", traduccion: "pt", voz: "pt-PT", dir: "ltr" },
  { id: "bn", nombre: "Bengalí", nativo: "বাংলা", traduccion: "bn", voz: "bn-BD", dir: "ltr" },
  { id: "hi", nombre: "Hindi", nativo: "हिन्दी", traduccion: "hi", voz: "hi-IN", dir: "ltr" },
];

// Textos de la interfaz del paciente en español: se traducen solos si el idioma no los trae.
export const TEXTOS_BASE = {
  hablar: "Pulse y hable",
  escuchando: "Escuchando…",
  escribir: "Escriba aquí…",
  enviar: "Enviar",
  tu: "Usted",
  bienvenida: "Esta pantalla traduce automáticamente. Hable despacio y con frases cortas.",
};

// Respuestas rápidas del paciente (botones grandes en su lado): ya escritas en cada idioma, para que
// funcionen al instante sin pasar por el traductor. Mismo orden que RESPUESTAS_ES.
export const RESPUESTAS_ES = ["Sí", "No", "No entiendo", "¿Puede repetirlo?"];
export const RESPUESTAS = {
  ar: ["نعم", "لا", "لم أفهم", "أعد من فضلك"],
  zh: ["是", "不是", "我听不懂", "请再说一遍"],
  "zh-Hant": ["是", "不是", "我聽不懂", "請再說一遍"],
  en: ["Yes", "No", "I don’t understand", "Please repeat"],
  fr: ["Oui", "Non", "Je ne comprends pas", "Répétez, s’il vous plaît"],
  ro: ["Da", "Nu", "Nu înțeleg", "Repetați, vă rog"],
  uk: ["Так", "Ні", "Я не розумію", "Повторіть, будь ласка"],
  ru: ["Да", "Нет", "Я не понимаю", "Повторите, пожалуйста"],
  pt: ["Sim", "Não", "Não percebo", "Repita, por favor"],
  bn: ["হ্যাঁ", "না", "আমি বুঝতে পারছি না", "আবার বলুন"],
  hi: ["हाँ", "नहीं", "मुझे समझ नहीं आया", "कृपया दोहराइए"],
};

// Temas de las frases rápidas de fábrica. Las que añada el profesional van a «Mías».
export const TEMAS_FRASES = {
  "Hola, buenos días. ¿En qué le puedo ayudar?": "Indicaciones",
  "¿Tiene cita?": "Citas",
  "¿Me deja su tarjeta sanitaria, por favor?": "Datos",
  "¿Cuál es su nombre completo?": "Datos",
  "¿Cuál es su fecha de nacimiento?": "Datos",
  "¿Me da un número de teléfono?": "Datos",
  "Espere en la sala, por favor. Le llamarán por su nombre.": "Indicaciones",
  "Le doy cita para el día que le escribo en este papel.": "Citas",
  "Tiene que venir otro día. Le doy una cita nueva.": "Citas",
  "¿Puede venir alguien que hable español para ayudarle?": "Indicaciones",
  "No le he entendido. ¿Puede repetirlo más despacio?": "Indicaciones",
};
export const TEMAS = ["Citas", "Datos", "Indicaciones", "Mías"];
export const temaDe = (frase) => TEMAS_FRASES[frase] ?? "Mías";

// Frases rápidas del profesional (se pueden añadir y quitar desde la página; se guardan en el navegador).
export const FRASES_POR_DEFECTO = [
  "Hola, buenos días. ¿En qué le puedo ayudar?",
  "¿Tiene cita?",
  "¿Me deja su tarjeta sanitaria, por favor?",
  "¿Cuál es su nombre completo?",
  "¿Cuál es su fecha de nacimiento?",
  "¿Me da un número de teléfono?",
  "Espere en la sala, por favor. Le llamarán por su nombre.",
  "Le doy cita para el día que le escribo en este papel.",
  "Tiene que venir otro día. Le doy una cita nueva.",
  "¿Puede venir alguien que hable español para ayudarle?",
  "No le he entendido. ¿Puede repetirlo más despacio?",
];

export function buscarIdioma(id) {
  return IDIOMAS.find((i) => i.id === id) ?? IDIOMAS[0];
}
