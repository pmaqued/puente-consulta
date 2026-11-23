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
  "Hola, buenos días. Pase y siéntese, por favor.": "Indicaciones",
  "¿Me deja su tarjeta sanitaria, por favor?": "Datos",
  "¿Cuál es su fecha de nacimiento?": "Datos",
  "¿Me da un número de teléfono?": "Datos",
  "Le voy a explorar. ¿Le parece bien?": "Indicaciones",
  "Túmbese en la camilla, por favor.": "Indicaciones",
  "Tiene que volver otro día. Le doy una cita nueva.": "Citas",
  "Le doy cita para el día que le escribo en este papel.": "Citas",
  "¿Puede venir alguien que hable español para ayudarle?": "Indicaciones",
  "No le he entendido. ¿Puede repetirlo más despacio?": "Indicaciones",
};
export const TEMAS = ["Citas", "Datos", "Indicaciones", "Mías"];
export const temaDe = (frase) => TEMAS_FRASES[frase] ?? "Mías";

// Frases rápidas del profesional (se pueden añadir y quitar desde la página; se guardan en el navegador).
export const FRASES_POR_DEFECTO = [
  "Hola, buenos días. Pase y siéntese, por favor.",
  "¿Me deja su tarjeta sanitaria, por favor?",
  "¿Cuál es su fecha de nacimiento?",
  "¿Me da un número de teléfono?",
  "Le voy a explorar. ¿Le parece bien?",
  "Túmbese en la camilla, por favor.",
  "Tiene que volver otro día. Le doy una cita nueva.",
  "Le doy cita para el día que le escribo en este papel.",
  "¿Puede venir alguien que hable español para ayudarle?",
  "No le he entendido. ¿Puede repetirlo más despacio?",
];

export function buscarIdioma(id) {
  return IDIOMAS.find((i) => i.id === id) ?? IDIOMAS[0];
}

// Permiso del paciente para el dictado por internet (como cuando el médico usa el traductor del móvil:
// se le pregunta y, si acepta, se anota en la historia). Escrito a mano en los idiomas principales;
// en los demás se traduce en el momento con el traductor del equipo. {S} = Google o Microsoft.
export const PERMISO_ES = {
  texto: "Para entender lo que se dice, este ordenador envía las voces a {S}, que las convierte en texto. " +
    "No diga su nombre ni datos personales. ¿Está de acuerdo? Si no, puede escribir o tocar las respuestas.",
  si: "Sí, estoy de acuerdo",
  no: "No",
};
export const PERMISO = {
  ar: {
    texto: "لفهم ما يُقال، يرسل هذا الحاسوب الأصوات إلى {S} لتحويلها إلى نص. لا تذكر اسمك ولا أي معلومات شخصية. " +
      "هل توافق؟ إذا لم توافق، يمكنك الكتابة أو الضغط على الأجوبة.",
    si: "نعم، أوافق",
    no: "لا",
  },
  zh: {
    texto: "为了听懂对话，这台电脑会把说话的声音发送给 {S}，转换成文字。请不要说您的姓名或个人信息。您同意吗？" +
      "如果不同意，您可以打字或点击下面的回答。",
    si: "同意",
    no: "不同意",
  },
  "zh-Hant": {
    texto: "為了聽懂對話，這台電腦會把說話的聲音傳送給 {S}，轉換成文字。請不要說您的姓名或個人資料。您同意嗎？" +
      "如果不同意，您可以打字或點選下面的回答。",
    si: "同意",
    no: "不同意",
  },
  en: {
    texto: "To understand what is said, this computer sends the voices to {S}, which turns them into text. " +
      "Please do not say your name or any personal details. Do you agree? If not, you can type or tap the answers.",
    si: "Yes, I agree",
    no: "No",
  },
  fr: {
    texto: "Pour comprendre ce qui est dit, cet ordinateur envoie les voix à {S}, qui les transforme en texte. " +
      "Ne dites pas votre nom ni de données personnelles. Êtes-vous d’accord ? Sinon, vous pouvez écrire ou toucher les réponses.",
    si: "Oui, d’accord",
    no: "Non",
  },
};
