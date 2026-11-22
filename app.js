// Puente Consulta: conversación cara a cara traducida (profesional en español ↔ paciente).
import { IDIOMAS, PROFESIONAL, TEXTOS_BASE, FRASES_POR_DEFECTO, buscarIdioma } from "./idiomas.js";
import { hayTraductor, esModoPrueba, disponibilidad, preparar, traducir } from "./traductor.js";
import { hayDictado, modoDictado, instalarDictado, dictar, vozPara, generoDe, leer, callar } from "./voz.js";
import { detectarIdioma } from "./detector.js";
import { vozPuente, estaDescargada, prepararVoz } from "./voces-puente.js";

/** "Edge", "Chrome" u otro, para los avisos. */
const NAVEGADOR = /\bEdg\//.test(navigator.userAgent) ? "Edge" : /\bChrome\//.test(navigator.userAgent) ? "Chrome" : "otro";

const $ = (sel) => document.querySelector(sel);
/** "Árabe (Marruecos)" → "árabe (Marruecos)", para usarlo dentro de una frase. */
const enMinuscula = (t) => t.charAt(0).toLowerCase() + t.slice(1);

// ---------- Ajustes guardados en este navegador ----------

const AJUSTES_POR_DEFECTO = {
  idioma: "ar-MA",
  leerPaciente: true,
  leerProfesional: true,
  vozProfesional: "hombre", // voz con la que se lee el español: "hombre" | "mujer"
  internetDictado: false,
  internetVoces: false,
  motorVoz: "puente", // "puente" (voces Piper en la página) | "navegador"
  avisoOculto: false,
  escala: 1, // tamaño de la letra de la conversación (0.8 – 1.6)
  frases: FRASES_POR_DEFECTO,
};

function cargarAjustes() {
  try {
    return { ...AJUSTES_POR_DEFECTO, ...JSON.parse(localStorage.getItem("puente-consulta") ?? "{}") };
  } catch {
    return { ...AJUSTES_POR_DEFECTO };
  }
}

const ajustes = cargarAjustes();

function guardarAjustes() {
  try {
    localStorage.setItem("puente-consulta", JSON.stringify(ajustes));
  } catch {
    /* sin almacenamiento (modo privado): se usan solo en esta pestaña */
  }
}

// ---------- Estado ----------

let paciente = buscarIdioma(ajustes.idioma);
let listo = false; // traductores de los dos sentidos preparados
let textosPaciente = { ...TEXTOS_BASE, ...paciente.textos };
let dictadoActivo = null; // { lado, parar }

// ---------- Arranque ----------

function iniciar() {
  if (!hayTraductor()) {
    $("#sin-soporte").hidden = false;
    return;
  }

  const select = $("#idioma");
  for (const idioma of IDIOMAS) {
    const opcion = new Option(`${idioma.nombre} · ${idioma.nativo}`, idioma.id);
    select.add(opcion);
  }
  select.value = paciente.id;
  select.addEventListener("change", () => cambiarIdioma(select.value));

  $("#aviso-uso").hidden = ajustes.avisoOculto;
  $("#aviso-uso .cerrar").addEventListener("click", () => {
    $("#aviso-uso").hidden = true;
    ajustes.avisoOculto = true;
    guardarAjustes();
  });

  $("#nueva").addEventListener("click", nuevaConversacion);
  $("#ver-frases").addEventListener("click", () => {
    $("#frases").hidden = !$("#frases").hidden;
  });

  for (const lado of ["paciente", "profesional"]) {
    const area = $(`#texto-${lado}`);
    area.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        enviar(lado);
      }
    });
    $(`.enviar[data-lado="${lado}"]`).addEventListener("click", () => enviar(lado));
    $(`.microfono[data-lado="${lado}"]`).addEventListener("click", () => alternarDictado(lado));
  }

  prepararAjustes();
  prepararTamano();
  prepararGenero();
  prepararPantallaGrande();
  pintarFrases();
  aplicarIdiomaPaciente();
  comprobarIdioma({ conClic: false });

  if (esModoPrueba()) mostrarEstado("Modo de prueba: la «traducción» es falsa (solo para revisar la página).");

  // Para que funcione sin conexión y se pueda instalar como app (Chrome/Edge: ⋮ › Instalar).
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Sin modo sin conexión:", e));
  }
}

// ---------- Tamaño de la letra ----------

function prepararTamano() {
  const aplicar = () => document.documentElement.style.setProperty("--escala", ajustes.escala);
  const cambiar = (paso) => {
    ajustes.escala = Math.min(1.6, Math.max(0.8, Math.round((ajustes.escala + paso) * 10) / 10));
    aplicar();
    guardarAjustes();
  };
  $("#letra-menos").addEventListener("click", () => cambiar(-0.1));
  $("#letra-mas").addEventListener("click", () => cambiar(0.1));
  aplicar();
}

// ---------- Voz del español (hombre / mujer) ----------

function prepararGenero() {
  const pintar = () => {
    $("#voz-hombre").classList.toggle("activo", ajustes.vozProfesional === "hombre");
    $("#voz-mujer").classList.toggle("activo", ajustes.vozProfesional === "mujer");
  };
  for (const g of ["hombre", "mujer"]) {
    $(`#voz-${g}`).addEventListener("click", () => {
      ajustes.vozProfesional = g;
      guardarAjustes();
      pintar();
      prepararVocesPuente();
    });
  }
  pintar();
}

/** Género de la voz con la que se lee un idioma. */
function generoPara(idioma) {
  return idioma === PROFESIONAL ? ajustes.vozProfesional : (idioma.genero ?? null);
}

// ---------- Pantalla grande ----------

function prepararPantallaGrande() {
  const capa = $("#grande");
  capa.addEventListener("click", cerrarGrande);
  $("#imprimir").addEventListener("click", (e) => {
    e.stopPropagation(); // que el clic no cierre la pantalla grande
    $("#grande-fecha").textContent = `Puente Consulta · ${new Date().toLocaleString("es-ES", {
      dateStyle: "long", timeStyle: "short" })}`;
    window.print();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !capa.hidden) cerrarGrande();
  });
}

function abrirGrande(traduccion, original, destino, origen) {
  const t = $("#grande-traduccion");
  t.textContent = traduccion;
  t.lang = destino.traduccion;
  t.dir = destino.dir;
  const o = $("#grande-original");
  o.textContent = original;
  o.lang = origen.traduccion;
  o.dir = origen.dir;
  $("#grande").hidden = false;
  $("#grande").focus();
}

function cerrarGrande() {
  $("#grande").hidden = true;
}

// ---------- Detección de idioma ----------

/** Si el paciente escribe en otro idioma de la lista, se ofrece cambiar. */
async function comprobarIdiomaEscrito(texto) {
  const detectado = await detectarIdioma(texto);
  if (!detectado) return;
  const base = (c) => c.split("-")[0];
  if (base(detectado) === base(paciente.traduccion) || base(detectado) === "es") return;
  const sugerido = IDIOMAS.find((i) => base(i.traduccion) === base(detectado));
  if (!sugerido) return;
  mostrarEstado(`Parece que el paciente escribe en ${enMinuscula(sugerido.nombre)}.`, {
    boton: [`Cambiar a ${sugerido.nombre}`, () => {
      $("#idioma").value = sugerido.id;
      cambiarIdioma(sugerido.id);
    }],
  });
}

// ---------- Idioma del paciente ----------

function cambiarIdioma(id) {
  paciente = buscarIdioma(id);
  ajustes.idioma = id;
  guardarAjustes();
  detenerDictado();
  aplicarIdiomaPaciente();
  comprobarIdioma({ conClic: true }); // el cambio de la lista cuenta como clic: puede descargar
}

/** Pone los textos del lado del paciente en su idioma y su dirección de escritura. */
function aplicarIdiomaPaciente() {
  textosPaciente = { ...TEXTOS_BASE, ...paciente.textos, ...textosTraducidosGuardados(paciente.id) };
  const panel = $("#panel-paciente");
  panel.lang = paciente.traduccion;
  panel.dir = paciente.dir;
  $("#nombre-paciente").textContent = paciente.nativo;
  $("#hablar-paciente").textContent = textosPaciente.hablar;
  $("#texto-paciente").placeholder = textosPaciente.escribir;
  $("#enviar-paciente").textContent = textosPaciente.enviar;
  const bienvenida = $("#bienvenida-paciente");
  bienvenida.textContent = textosPaciente.bienvenida;
  bienvenida.lang = paciente.traduccion;
  bienvenida.dir = paciente.dir;
  actualizarMicrofonos();
}

function textosTraducidosGuardados(id) {
  try {
    return JSON.parse(localStorage.getItem(`puente-consulta-textos-${id}`) ?? "{}");
  } catch {
    return {};
  }
}

/** Si el idioma no trae los textos de la interfaz, se traducen una vez y se guardan. */
async function traducirTextosInterfaz() {
  if (paciente.textos || Object.keys(textosTraducidosGuardados(paciente.id)).length) return;
  const id = paciente.id;
  const traducidos = {};
  for (const [clave, texto] of Object.entries(TEXTOS_BASE)) {
    try {
      traducidos[clave] = await traducir(texto, PROFESIONAL.traduccion, paciente.traduccion);
    } catch {
      return;
    }
  }
  try {
    localStorage.setItem(`puente-consulta-textos-${id}`, JSON.stringify(traducidos));
  } catch { /* nada */ }
  if (paciente.id === id) aplicarIdiomaPaciente();
}

/**
 * Comprueba si los dos sentidos (español → paciente y paciente → español) están listos.
 * Si falta descargar algo y no viene de un clic, muestra un botón para descargarlo.
 */
async function comprobarIdioma({ conClic }) {
  listo = false;
  actualizarBotones();
  const id = paciente.id;
  mostrarEstado("Comprobando el idioma…");
  const ida = [PROFESIONAL.traduccion, paciente.traduccion];
  const vuelta = [paciente.traduccion, PROFESIONAL.traduccion];
  const [a, b] = await Promise.all([disponibilidad(...ida), disponibilidad(...vuelta)]);
  if (paciente.id !== id) return;

  if (a === "sin-respuesta" || b === "sin-respuesta") {
    mostrarEstado("El traductor del navegador no responde. Actualiza Chrome o Edge y recarga la página.", {
      error: true, boton: ["Reintentar", () => comprobarIdioma({ conClic: true })],
    });
    return;
  }
  if (a === "unavailable" || b === "unavailable") {
    mostrarEstado(`El traductor de este navegador no admite ${enMinuscula(paciente.nombre)}.`, { error: true });
    return;
  }
  if ((a !== "available" || b !== "available") && !conClic) {
    mostrarEstado(`Hay que descargar ${enMinuscula(paciente.nombre)} (solo la primera vez).`, {
      boton: ["Descargar", () => descargar(id)],
    });
    return;
  }
  await descargar(id);
}

/**
 * Descarga (si hace falta) y prepara los dos sentidos, uno detrás de otro.
 * Chrome descarga los mismos paquetes para ida y vuelta, así que el segundo suele ser inmediato.
 * Si el segundo necesita descargar algo y ya ha caducado el clic del usuario, Chrome lo rechaza
 * (NotAllowedError): entonces se pide otro clic con un botón.
 */
async function descargar(id) {
  const sentidos = [
    [PROFESIONAL.traduccion, paciente.traduccion, `Español → ${paciente.nombre}`],
    [paciente.traduccion, PROFESIONAL.traduccion, `${paciente.nombre} → Español`],
  ];
  for (const [i, [origen, destino, etiqueta]] of sentidos.entries()) {
    const paso = `Descargando (${i + 1}/2, ${etiqueta})…`;
    let ultimoAvance = Date.now();
    mostrarEstado(paso, { progreso: 0 });
    // Si en un rato no llega ningún avance, se avisa (pero se sigue esperando).
    const vigilante = setInterval(() => {
      if (paciente.id !== id) return clearInterval(vigilante);
      if (Date.now() - ultimoAvance > 60_000) {
        mostrarEstado(`${paso} Va lento o se ha parado. Revisa la conexión o recarga la página.`, {
          error: true, boton: ["Reintentar", () => { clearInterval(vigilante); descargar(id); }],
        });
      }
    }, 5_000);
    try {
      await preparar(origen, destino, (p) => {
        ultimoAvance = Date.now();
        if (paciente.id === id) mostrarEstado(paso, { progreso: p });
      });
    } catch (e) {
      clearInterval(vigilante);
      if (paciente.id !== id) return;
      console.error(e);
      if (e?.name === "NotAllowedError") {
        mostrarEstado(`Falta descargar ${etiqueta}. Pulsa para continuar.`, {
          boton: ["Continuar descarga", () => descargar(id)],
        });
      } else {
        mostrarEstado(`No se pudo preparar ${etiqueta}: ${e?.message || e}`, {
          error: true, boton: ["Reintentar", () => descargar(id)],
        });
      }
      return;
    }
    clearInterval(vigilante);
    if (paciente.id !== id) return;
  }
  listo = true;
  mostrarEstado(esModoPrueba() ? "Modo de prueba: la «traducción» es falsa." : `Listo: ${paciente.nombre} ⇄ Español, en este ordenador.`);
  actualizarBotones();
  traducirTextosInterfaz();
  prepararVocesPuente();
}

/**
 * Con «Voces de Puente», descarga en segundo plano las voces que se van a usar (español con el género
 * elegido y el idioma del paciente), para que al leer no haya que esperar. No bloquea nada: si falla,
 * se usan las voces del navegador.
 */
let preparandoVoces = null;
async function prepararVocesPuente() {
  if (ajustes.motorVoz !== "puente" || esModoPrueba() || !listo) return;
  const id = paciente.id;
  const voces = [vozPuente(PROFESIONAL.voz, generoPara(PROFESIONAL)), vozPuente(paciente.voz, generoPara(paciente))]
    .filter(Boolean);
  const pendientes = [];
  for (const v of voces) if (!(await estaDescargada(v))) pendientes.push(v);
  const trabajo = (async () => {
    for (const [i, v] of voces.entries()) {
      const nueva = pendientes.includes(v);
      try {
        await prepararVoz(v, (p) => {
          if (nueva && paciente.id === id) {
            mostrarEstado(`Descargando voces (${pendientes.indexOf(v) + 1}/${pendientes.length}, ${v.mb} MB, solo esta vez)…`,
              { progreso: p });
          }
        });
      } catch (e) {
        console.warn(e);
        if (paciente.id === id) {
          mostrarEstado(`No se pudo descargar la voz ${v.nombre}: se usarán las del navegador.`, {
            error: true, boton: ["Reintentar", prepararVocesPuente],
          });
        }
        return;
      }
      if (i === voces.length - 1 && pendientes.length && paciente.id === id) {
        mostrarEstado(`Listo: ${paciente.nombre} ⇄ Español, con voces de Puente, en este ordenador.`);
      }
    }
  })();
  preparandoVoces = trabajo;
  await trabajo;
}

// ---------- Estado de la barra ----------

function mostrarEstado(texto, { error = false, progreso = null, boton = null } = {}) {
  const estado = $("#estado");
  estado.replaceChildren();
  const span = document.createElement("span");
  span.textContent = texto;
  if (error) span.className = "error";
  estado.append(span);
  if (progreso !== null) {
    const barra = document.createElement("progress");
    barra.max = 1;
    barra.value = progreso;
    estado.append(barra);
  }
  if (boton) {
    const b = document.createElement("button");
    b.className = "boton";
    b.textContent = boton[0];
    b.addEventListener("click", boton[1]);
    estado.append(b);
  }
}

function actualizarBotones() {
  for (const b of document.querySelectorAll(".enviar")) b.disabled = !listo;
  actualizarMicrofonos();
}

// ---------- Mensajes ----------

/** `dictado`: viene de «Pulse y hable»; entonces la traducción se lee siempre en voz alta. */
async function enviar(lado, textoDado, dictado = false) {
  const area = $(`#texto-${lado}`);
  const texto = (textoDado ?? area.value).trim();
  if (!texto || !listo) return;
  area.value = "";

  const deProfesional = lado === "profesional";
  const origen = deProfesional ? PROFESIONAL : paciente;
  const destino = deProfesional ? paciente : PROFESIONAL;

  const burbuja = crearBurbuja(lado, texto, origen);
  if (!deProfesional) comprobarIdiomaEscrito(texto);
  try {
    const traduccion = await traducir(texto, origen.traduccion, destino.traduccion);
    completarBurbuja(burbuja, traduccion, destino, texto, origen);
    const debeLeer = dictado || (deProfesional ? ajustes.leerPaciente : ajustes.leerProfesional);
    if (debeLeer) leerYAvisar(traduccion, destino);
  } catch (e) {
    console.error(e);
    burbuja.querySelector(".pendiente").outerHTML = `<p class="error">No se pudo traducir.</p>`;
  }
}

function crearBurbuja(lado, texto, origen) {
  $("#vacia")?.remove();
  const art = document.createElement("article");
  art.className = `mensaje ${lado}`;
  const hora = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  const quien = document.createElement("div");
  quien.className = "quien";
  quien.textContent = `${lado === "paciente" ? "Paciente" : "Profesional"} · ${hora}`;

  const pendiente = document.createElement("p");
  pendiente.className = "pendiente";
  pendiente.textContent = "Traduciendo…";

  const original = document.createElement("p");
  original.className = "original";
  original.textContent = texto;
  original.lang = origen.traduccion;
  original.dir = origen.dir;

  art.append(quien, pendiente, original);
  $("#conversacion").append(art);
  art.scrollIntoView({ behavior: "smooth", block: "end" });
  return art;
}

function completarBurbuja(art, traduccion, destino, original, origen) {
  const p = document.createElement("p");
  p.className = "traduccion";
  p.textContent = traduccion;
  p.lang = destino.traduccion;
  p.dir = destino.dir;
  p.title = "Ver en grande";
  p.addEventListener("click", () => abrirGrande(traduccion, original, destino, origen));
  art.querySelector(".pendiente").replaceWith(p);

  const grande = document.createElement("button");
  grande.className = "grande-boton";
  grande.title = "Ver en grande (para leerlo de lejos)";
  grande.textContent = "⛶";
  grande.addEventListener("click", () => abrirGrande(traduccion, original, destino, origen));
  art.querySelector(".quien").append(grande);

  const hayVoz = (ajustes.motorVoz === "puente" && vozPuente(destino.voz, generoPara(destino)))
    || vozPara(destino.voz, ajustes.internetVoces, generoPara(destino));
  if (hayVoz) {
    const b = document.createElement("button");
    b.className = "leer";
    b.title = "Leer en voz alta";
    b.textContent = "🔊";
    b.addEventListener("click", () => leerYAvisar(traduccion, destino));
    art.querySelector(".quien").append(b);
  }
  art.scrollIntoView({ behavior: "smooth", block: "end" });
}

async function leerYAvisar(texto, idioma) {
  const problema = await leer(texto, idioma.voz, ajustes.internetVoces, generoPara(idioma), ajustes.motorVoz);
  if (problema) mostrarEstado(`${problema} Prueba la voz en ⚙︎ Ajustes.`, { error: true });
}

function nuevaConversacion() {
  detenerDictado();
  callar();
  const conversacion = $("#conversacion");
  conversacion.replaceChildren();
  const vacia = document.createElement("div");
  vacia.id = "vacia";
  vacia.className = "vacia";
  vacia.innerHTML = `<p id="bienvenida-paciente" class="bienvenida-paciente"></p>
    <p class="bienvenida-profesional">Esta pantalla traduce automáticamente. Hable despacio y con frases cortas.</p>`;
  conversacion.append(vacia);
  $("#texto-paciente").value = "";
  $("#texto-profesional").value = "";
  aplicarIdiomaPaciente();
}

// ---------- Dictado ----------

const modos = new Map(); // idioma de voz -> modo ("local", "descargable", "internet", "no")

async function modoPara(idiomaVoz) {
  if (!modos.has(idiomaVoz)) modos.set(idiomaVoz, await modoDictado(idiomaVoz));
  return modos.get(idiomaVoz);
}

function actualizarMicrofonos() {
  for (const boton of document.querySelectorAll(".microfono")) {
    boton.disabled = !hayDictado() || !listo;
    boton.title = hayDictado() ? "" : "Este navegador no tiene dictado por voz.";
  }
}

async function alternarDictado(lado) {
  if (dictadoActivo?.lado === lado) {
    detenerDictado();
    return;
  }
  detenerDictado();
  callar();

  const idioma = lado === "paciente" ? paciente : PROFESIONAL;
  let modo = await modoPara(idioma.voz);
  if (modo === "descargable") {
    mostrarEstado("Descargando el dictado para este idioma…");
    if (await instalarDictado(idioma.voz)) {
      modo = "local";
      modos.set(idioma.voz, "local");
    } else {
      modo = "internet";
    }
  }
  if (modo === "no") return;
  if (modo === "internet" && !ajustes.internetDictado) {
    mostrarEstado(`El dictado en ${enMinuscula(idioma.nombre)} solo funciona por internet (envía el audio fuera). ` +
      "Puedes escribir, o permitirlo en Ajustes.", { error: true, boton: ["Ajustes", abrirAjustes] });
    return;
  }

  const area = $(`#texto-${lado}`);
  const boton = $(`.microfono[data-lado="${lado}"]`);
  const etiqueta = boton.querySelector(".texto-boton");
  const textoOriginal = etiqueta.textContent;
  boton.classList.add("escuchando");
  etiqueta.textContent = lado === "paciente" ? textosPaciente.escuchando : "Escuchando…";

  const terminar = () => {
    boton.classList.remove("escuchando");
    etiqueta.textContent = lado === "paciente" ? textosPaciente.hablar : textoOriginal;
    if (dictadoActivo?.lado === lado) dictadoActivo = null;
  };

  try {
    const parar = dictar(idioma.voz, {
      local: modo === "local",
      alTexto: (t) => { area.value = t; },
      alTerminar: (t) => {
        terminar();
        if (t) enviar(lado, t, true); // al acabar de hablar (o al pulsar otra vez), se traduce y se lee solo
      },
      alError: (m) => mostrarEstado(m, { error: true }),
    });
    dictadoActivo = { lado, parar };
  } catch (e) {
    console.error(e);
    terminar();
    mostrarEstado("No se pudo empezar a dictar.", { error: true });
  }
}

function detenerDictado() {
  dictadoActivo?.parar();
  dictadoActivo = null;
}

// ---------- Frases rápidas ----------

function pintarFrases() {
  const cont = $("#frases");
  cont.replaceChildren();
  for (const frase of ajustes.frases) {
    const b = document.createElement("button");
    b.textContent = frase;
    b.addEventListener("click", () => enviar("profesional", frase));
    cont.append(b);
  }

  const lista = $("#lista-frases");
  lista.replaceChildren();
  ajustes.frases.forEach((frase, i) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = frase;
    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.textContent = "✕";
    quitar.title = "Quitar";
    quitar.addEventListener("click", () => {
      ajustes.frases.splice(i, 1);
      guardarAjustes();
      pintarFrases();
    });
    li.append(span, quitar);
    lista.append(li);
  });
}

// ---------- Ajustes ----------

function prepararAjustes() {
  $("#abrir-ajustes").addEventListener("click", abrirAjustes);
  const casillas = {
    "#leer-paciente": "leerPaciente",
    "#leer-profesional": "leerProfesional",
    "#internet-dictado": "internetDictado",
    "#internet-voces": "internetVoces",
  };
  for (const [sel, clave] of Object.entries(casillas)) {
    const c = $(sel);
    c.checked = ajustes[clave];
    c.addEventListener("change", () => {
      ajustes[clave] = c.checked;
      guardarAjustes();
    });
  }
  for (const radio of document.querySelectorAll('input[name="motor-voz"]')) {
    radio.checked = radio.value === ajustes.motorVoz;
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      ajustes.motorVoz = radio.value;
      guardarAjustes();
      callar();
      prepararVocesPuente();
      abrirAjustes(); // repinta el diagnóstico con el motor nuevo
    });
  }
  const nueva = $("#nueva-frase");
  const anadir = () => {
    const t = nueva.value.trim();
    if (!t) return;
    ajustes.frases = [...ajustes.frases, t];
    nueva.value = "";
    guardarAjustes();
    pintarFrases();
  };
  $("#anadir-frase").addEventListener("click", anadir);
  nueva.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); anadir(); }
  });
  $("#restaurar-frases").addEventListener("click", () => {
    ajustes.frases = [...FRASES_POR_DEFECTO];
    guardarAjustes();
    pintarFrases();
  });
}

async function abrirAjustes() {
  const lista = $("#diagnostico");
  lista.replaceChildren();
  const linea = (t) => {
    const li = document.createElement("li");
    li.textContent = t;
    lista.append(li);
    return li;
  };
  linea(esModoPrueba() ? "Traductor: MODO DE PRUEBA (traducción falsa). Quita «?prueba» de la dirección."
    : hayTraductor() ? "Traductor integrado: sí (traduce en este ordenador)." : "Traductor integrado: no.");
  if (!hayDictado()) {
    linea("Dictado por voz: no disponible en este navegador.");
  } else {
    for (const idioma of [PROFESIONAL, paciente]) {
      const modo = await modoPara(idioma.voz);
      const texto = { local: "en este ordenador", descargable: "en este ordenador (tras descargarlo)",
        internet: "solo por internet", no: "no disponible" }[modo];
      linea(`Dictado en ${enMinuscula(idioma.nombre)}: ${texto}.`);
    }
  }
  linea(`Navegador: ${NAVEGADOR}.${NAVEGADOR === "Edge" ? " Puedes usar sus voces «Natural» eligiendo «Voces del navegador» y permitiendo las voces de internet." : ""}`);
  for (const idioma of [PROFESIONAL, paciente]) {
    const genero = generoPara(idioma);
    const puente = vozPuente(idioma.voz, genero);
    const elegida = vozPara(idioma.voz, ajustes.internetVoces, genero);
    const nube = vozPara(idioma.voz, true, genero);
    let texto = `Voz en ${enMinuscula(idioma.nombre)}${genero ? ` (de ${genero})` : ""}: `;
    if (ajustes.motorVoz === "puente" && puente) {
      texto += `de Puente, ${puente.nombre}`;
      texto += (await estaDescargada(puente)) ? " (descargada)." : ` (se descarga al usarla, ${puente.mb} MB).`;
      if (elegida) texto += ` Si falla: ${elegida.name}.`;
    } else {
      if (ajustes.motorVoz === "puente") texto += "no hay voz de Puente para este idioma; ";
      if (elegida) {
        texto += `${elegida.name}${elegida.localService ? "" : " (de internet)"}.`;
        const g = generoDe(elegida);
        if (genero && g !== genero) texto += ` No hay voz de ${genero} instalada${g ? `: se usa una de ${g}` : ""}.`;
      } else {
        texto += nube ? `solo hay de internet (${nube.name}); permítelas arriba para usarla.` : "no hay ninguna instalada.";
      }
    }
    const li = linea(texto);
    if ((ajustes.motorVoz === "puente" && puente) || elegida) {
      const probar = document.createElement("button");
      probar.type = "button";
      probar.className = "enlace";
      probar.textContent = "Probar voz";
      const muestra = idioma === PROFESIONAL ? "Hola, esto es una prueba de voz."
        : (paciente.textos?.bienvenida ?? "Hola");
      probar.addEventListener("click", async () => {
        if (probar.disabled) return;
        probar.disabled = true; // una pulsación cada vez: si no, se encolan y suenan varias seguidas
        try {
          if (ajustes.motorVoz === "puente" && puente && !(await estaDescargada(puente))) {
            probar.textContent = "Descargando la voz…";
            await prepararVoz(puente, (p) => {
              probar.textContent = `Descargando la voz… ${Math.round(p * 100)} %`;
            }).catch(() => {}); // si falla, leer() lo dice y usa la del navegador
          }
          probar.textContent = "Preparando…";
          const problema = await leer(muestra, idioma.voz, ajustes.internetVoces, genero, ajustes.motorVoz);
          probar.textContent = problema ? `✘ ${problema}` : "✔ Ha sonado (¿lo has oído?)";
        } finally {
          probar.disabled = false;
        }
      });
      li.append(" ", probar);
    }
  }
  if (!$("#ajustes").open) $("#ajustes").showModal();
}

iniciar();
