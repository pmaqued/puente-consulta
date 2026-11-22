// Puente Consulta: conversación cara a cara traducida (profesional en español ↔ paciente).
import { IDIOMAS, PROFESIONAL, TEXTOS_BASE, FRASES_POR_DEFECTO, buscarIdioma, RESPUESTAS, RESPUESTAS_ES, TEMAS, temaDe }
  from "./idiomas.js";
import { hayTraductor, esModoPrueba, disponibilidad, preparar, traducir } from "./traductor.js";
import { hayDictado, modoDictado, instalarDictado, dictar, vozPara, generoDe, leer, callar, estaSonando } from "./voz.js";
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
  imprimirCita: false, // al imprimir, añadir el recuadro Día / Hora / Consulta
  altoContraste: false, // fondo negro y letra blanca/amarilla, para quien ve poco
  verAtajos: true, // enseñar las teclas F1 / F2 junto a los micrófonos
  guiaVista: false, // la guía de la primera vez ya se ha visto
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

  // Aviso de uso: se pliega a una línea (no desaparece); al pulsarlo plegado, se vuelve a abrir.
  const aviso = $("#aviso-uso");
  aviso.classList.toggle("plegado", ajustes.avisoOculto);
  aviso.querySelector(".cerrar").addEventListener("click", (e) => {
    e.stopPropagation();
    aviso.classList.add("plegado");
    ajustes.avisoOculto = true;
    guardarAjustes();
  });
  aviso.addEventListener("click", () => {
    if (!aviso.classList.contains("plegado")) return;
    aviso.classList.remove("plegado");
    ajustes.avisoOculto = false;
    guardarAjustes();
  });

  pintarVacia();

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
  prepararSelectorIdioma();
  prepararVista();
  prepararImpresionConversacion();
  prepararAtajos();
  prepararGuia();
  // La pastilla de estado: si hay un aviso, al pulsarla se vuelve a ver.
  $("#estado-chip").addEventListener("click", () => {
    if ($("#estado-chip").dataset.tipo !== "ok" && $("#estado").childElementCount) $("#estado").hidden = false;
  });
  pintarFrases();
  aplicarIdiomaPaciente();
  comprobarIdioma({ conClic: false });

  if (esModoPrueba()) mostrarEstado("Modo de prueba: la «traducción» es falsa (solo para revisar la página).", { listo: true });

  // Para que funcione sin conexión y se pueda instalar como app (Chrome/Edge: ⋮ › Instalar).
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Sin modo sin conexión:", e));
  }
}

// ---------- Tamaño de la letra ----------

function prepararTamano() {
  const aplicar = () => {
    document.documentElement.style.setProperty("--escala", ajustes.escala);
    $("#letra-valor").textContent = `${Math.round(ajustes.escala * 100)} %`;
  };
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

let mensajeGrande = null; // { traduccion, destino } del mensaje que se ve en grande

function prepararPantallaGrande() {
  const capa = $("#grande");
  capa.addEventListener("click", cerrarGrande);
  $("#grande-cerrar").addEventListener("click", cerrarGrande);
  $("#grande-leer").addEventListener("click", (e) => {
    e.stopPropagation(); // que el clic no cierre la pantalla grande
    if (mensajeGrande) leerYAvisar(mensajeGrande.traduccion, mensajeGrande.destino);
  });
  // Los clics en los botones de abajo no cierran la pantalla grande (salvo «Cerrar»).
  $(".grande-acciones").addEventListener("click", (e) => e.stopPropagation());
  const conCita = $("#imprimir-cita");
  conCita.checked = ajustes.imprimirCita;
  conCita.addEventListener("change", () => {
    ajustes.imprimirCita = conCita.checked;
    guardarAjustes();
  });
  $("#imprimir").addEventListener("click", (e) => {
    e.stopPropagation(); // que el clic no cierre la pantalla grande
    capa.classList.toggle("con-cita", ajustes.imprimirCita);
    $("#impreso-fecha").textContent = new Date().toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" });
    $("#grande-fecha").textContent = `Puente Consulta · ${new Date().toLocaleString("es-ES", {
      dateStyle: "long", timeStyle: "short" })}`;
    window.print();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !capa.hidden) cerrarGrande();
  });
}

function abrirGrande(traduccion, original, destino, origen, hora = "") {
  mensajeGrande = { traduccion, destino };
  const etiqueta = $("#grande-etiqueta");
  etiqueta.textContent = destino === PROFESIONAL ? "Para usted · Español" : `Para el paciente · ${destino.nativo}`;
  etiqueta.classList.toggle("paciente", destino !== PROFESIONAL);
  $("#grande-hora").textContent = hora;
  $("#grande-leer").hidden = !hayVoz(destino);
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
  pintarRespuestas();
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
  ocultarPreparacion();
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
  if (a !== "available" || b !== "available") abrirPreparacion();
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
    pasoPreparacion("traductor", { estado: "va", detalle: `${i + 1} de 2`, progreso: i / 2 });
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
        if (paciente.id === id) {
          mostrarEstado(paso, { progreso: p });
          pasoPreparacion("traductor", { estado: "va", detalle: `${i + 1} de 2`, progreso: (i + p) / 2 });
        }
      });
    } catch (e) {
      clearInterval(vigilante);
      if (paciente.id !== id) return;
      console.error(e);
      pasoPreparacion("traductor", { estado: e?.name === "NotAllowedError" ? "espera" : "error", detalle: "" });
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
  pasoPreparacion("traductor", { estado: "listo", detalle: "listo" });
  if (!ajustes.guiaVista) setTimeout(iniciarGuia, 700);
  mostrarEstado(esModoPrueba() ? "Modo de prueba: la «traducción» es falsa." : `Listo: ${paciente.nombre} ⇄ Español, en este ordenador.`,
    { listo: true });
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
  if (!listo) return;
  if (ajustes.motorVoz !== "puente" || esModoPrueba()) {
    terminarPreparacion();
    return;
  }
  const id = paciente.id;
  const voces = vocesPuenteNecesarias();
  const pendientes = [];
  for (const v of voces) if (!(await estaDescargada(v))) pendientes.push(v);
  if (paciente.id !== id) return;
  if (!pendientes.length) {
    terminarPreparacion();
  } else if ($("#preparacion").hidden) {
    abrirPreparacion();
    pasoPreparacion("traductor", { estado: "listo", detalle: "listo" });
  }
  for (const v of voces) if (!pendientes.includes(v)) pasoPreparacion(claveVoz(v), { estado: "listo", detalle: "lista" });
  const trabajo = (async () => {
    for (const [i, v] of voces.entries()) {
      const nueva = pendientes.includes(v);
      try {
        await prepararVoz(v, (p) => {
          if (nueva && paciente.id === id) {
            mostrarEstado(`Descargando voces (${pendientes.indexOf(v) + 1}/${pendientes.length}, ${v.mb} MB, solo esta vez)…`,
              { progreso: p });
            pasoPreparacion(claveVoz(v), { estado: "va", detalle: `${Math.round(p * v.mb)} de ${v.mb} MB`, progreso: p });
          }
        });
      } catch (e) {
        console.warn(e);
        pasoPreparacion(claveVoz(v), { estado: "error", detalle: "no se pudo" });
        if (paciente.id === id) {
          mostrarEstado(`No se pudo descargar la voz ${v.nombre}: se usarán las del navegador.`, {
            error: true, boton: ["Reintentar", prepararVocesPuente],
          });
        }
        return;
      }
      if (paciente.id === id) pasoPreparacion(claveVoz(v), { estado: "listo", detalle: "lista" });
      if (i === voces.length - 1 && pendientes.length && paciente.id === id) {
        mostrarEstado(`Listo: ${paciente.nombre} ⇄ Español, con voces de Puente, en este ordenador.`, { listo: true });
        terminarPreparacion();
      }
    }
  })();
  preparandoVoces = trabajo;
  await trabajo;
}

// ---------- Tarjeta de preparación (la primera vez con un idioma) ----------
// Muestra en el centro qué se está descargando: traductor y voces, cada uno con su avance.
// Es solo una vista: la descarga la siguen haciendo descargar() y prepararVocesPuente().

const claveVoz = (v) => `${v.id}#${v.hablante ?? 0}`;

function vocesPuenteNecesarias() {
  return [vozPuente(PROFESIONAL.voz, generoPara(PROFESIONAL)), vozPuente(paciente.voz, generoPara(paciente))]
    .filter(Boolean);
}

function abrirPreparacion() {
  const tarjeta = $("#preparacion");
  $("#prep-titulo").textContent = `Preparando ${enMinuscula(paciente.nombre)}`;
  const lista = $("#prep-lista");
  lista.replaceChildren();
  const anadir = (clave, texto, detalle) => {
    const li = document.createElement("li");
    li.dataset.clave = clave;
    li.dataset.estado = "espera";
    li.innerHTML = `<span class="prep-marca"><svg aria-hidden="true"><use href="#i-ok"/></svg></span>
      <span class="prep-texto"></span><small class="prep-detalle"></small><span class="prep-barra"><i></i></span>`;
    li.querySelector(".prep-texto").textContent = texto;
    li.querySelector(".prep-detalle").textContent = detalle;
    lista.append(li);
  };
  anadir("traductor", `Traductor ${enMinuscula(paciente.nombre)} ⇄ español`, "en espera");
  if (ajustes.motorVoz === "puente" && !esModoPrueba()) {
    for (const [idioma, v] of [[PROFESIONAL, vozPuente(PROFESIONAL.voz, generoPara(PROFESIONAL))],
      [paciente, vozPuente(paciente.voz, generoPara(paciente))]]) {
      if (!v) continue;
      const genero = generoPara(idioma);
      anadir(claveVoz(v), `Voz en ${enMinuscula(idioma.nombre)}${genero ? ` (${genero})` : ""}`, `${v.mb} MB · en espera`);
    }
  }
  tarjeta.classList.remove("terminada");
  tarjeta.hidden = false;
  $("#prep-aviso").hidden = true;
  $("#prep-acciones").replaceChildren();
}

function pasoPreparacion(clave, { estado, detalle, progreso = null }) {
  const li = $(`#prep-lista li[data-clave="${CSS.escape(clave)}"]`);
  if (!li) return;
  li.dataset.estado = estado;
  if (detalle !== undefined) li.querySelector(".prep-detalle").textContent = detalle;
  li.querySelector(".prep-barra i").style.width = `${Math.round((progreso ?? (estado === "listo" ? 1 : 0)) * 100)}%`;
}

/** Los avisos y botones de la franja de estado (Descargar, Reintentar…) también salen en la tarjeta. */
function reflejarEnPreparacion(texto, { error, boton }) {
  if ($("#preparacion").hidden) return;
  const aviso = $("#prep-aviso");
  aviso.hidden = !error;
  aviso.textContent = error ? texto : "";
  const acciones = $("#prep-acciones");
  acciones.replaceChildren();
  if (boton) {
    const b = document.createElement("button");
    b.className = "boton";
    b.textContent = boton[0];
    b.addEventListener("click", boton[1]);
    acciones.append(b);
  }
}

function terminarPreparacion() {
  const tarjeta = $("#preparacion");
  if (tarjeta.hidden) return;
  $("#prep-titulo").textContent = "Todo listo";
  $("#prep-acciones").replaceChildren();
  tarjeta.classList.add("terminada");
  setTimeout(() => { if (tarjeta.classList.contains("terminada")) ocultarPreparacion(); }, 1800);
}

function ocultarPreparacion() {
  const tarjeta = $("#preparacion");
  tarjeta.hidden = true;
  tarjeta.classList.remove("terminada");
}

// ---------- Estado de la barra ----------

let temporizadorAviso = null;

/** Al ocultar un aviso, si la página está lista, la pastilla vuelve a «Listo». */
function ocultarAviso() {
  $("#estado").hidden = true;
  if (listo) {
    const chip = $("#estado-chip");
    chip.dataset.tipo = "ok";
    chip.textContent = esModoPrueba() ? "Modo de prueba" : "Listo · en este equipo";
  }
}

/**
 * Estado de la página. Si todo va bien ({ listo: true }), solo se ve una pastilla discreta en la barra.
 * Lo demás sale como aviso flotante bajo la barra: se va solo, salvo errores, descargas o avisos con botón.
 */
function mostrarEstado(texto, { error = false, progreso = null, boton = null, listo = false } = {}) {
  reflejarEnPreparacion(texto, { error, boton });

  const chip = $("#estado-chip");
  chip.hidden = false;
  chip.title = texto;
  chip.dataset.tipo = listo ? "ok" : error ? "error" : "va";
  chip.textContent = listo ? (esModoPrueba() ? "Modo de prueba" : "Listo · en este equipo")
    : error ? "Hay un aviso" : progreso !== null ? "Descargando…" : "Un momento…";

  const estado = $("#estado");
  clearTimeout(temporizadorAviso);
  estado.replaceChildren();
  estado.classList.toggle("es-error", error);
  if (listo) {
    estado.hidden = true;
    return;
  }
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
  const cerrar = document.createElement("button");
  cerrar.className = "cerrar-aviso";
  cerrar.title = "Ocultar el aviso";
  cerrar.setAttribute("aria-label", "Ocultar el aviso");
  cerrar.innerHTML = `<svg aria-hidden="true"><use href="#i-cerrar"/></svg>`;
  cerrar.addEventListener("click", ocultarAviso);
  estado.append(cerrar);
  // Si la tarjeta de preparación está a la vista, ya cuenta lo mismo: no se repite arriba.
  estado.hidden = !$("#preparacion").hidden;
  if (!error && progreso === null && !boton) {
    temporizadorAviso = setTimeout(ocultarAviso, 7000);
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
    if (debeLeer) leerYAvisar(traduccion, destino, burbuja);
  } catch (e) {
    console.error(e);
    burbuja.querySelector(".pendiente").outerHTML = `<p class="error">No se pudo traducir.</p>`;
  }
}

function crearBurbuja(lado, texto, origen) {
  $("#vacia")?.remove();
  $("#elegir-idioma").hidden = true;
  if (!$("#preparacion").hidden) $("#conversacion").prepend($("#preparacion"));
  const art = document.createElement("article");
  art.className = `mensaje ${lado}`;
  const hora = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  const quien = document.createElement("div");
  quien.className = "quien";
  quien.textContent = `${lado === "paciente" ? "Paciente" : "Profesional"} · ${hora}`;
  art.dataset.hora = hora;
  // Mientras se lee en voz alta este mensaje: ondas y botón Parar.
  const lectura = document.createElement("span");
  lectura.className = "lectura";
  lectura.innerHTML = `<span class="ondas" aria-hidden="true"><i></i><i></i><i></i></span> leyendo en voz alta `;
  const parar = document.createElement("button");
  parar.className = "boton-parar";
  parar.innerHTML = `<svg aria-hidden="true"><use href="#i-parar"/></svg>Parar`;
  parar.addEventListener("click", () => { callar(); quitarLectura(); });
  lectura.append(parar);
  quien.append(lectura);

  const pendiente = document.createElement("p");
  pendiente.className = "pendiente";
  pendiente.textContent = "Traduciendo…";

  const original = document.createElement("p");
  original.className = "original";
  resaltarDatos(original, texto);
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
  resaltarDatos(p, traduccion);
  p.lang = destino.traduccion;
  p.dir = destino.dir;
  p.title = "Ver en grande";
  const verGrande = () => abrirGrande(traduccion, original, destino, origen, art.dataset.hora);
  ultimoVerGrande = verGrande;
  const haciaEspanol = destino === PROFESIONAL;
  mensajes.push({
    art, hora: art.dataset.hora, lado: art.classList.contains("paciente") ? "paciente" : "profesional",
    espanol: haciaEspanol ? traduccion : original, otro: haciaEspanol ? original : traduccion,
  });
  $("#imprimir-conversacion").disabled = false;
  p.addEventListener("click", verGrande);
  art.querySelector(".pendiente").replaceWith(p);

  const acciones = document.createElement("div");
  acciones.className = "acciones-mensaje";
  acciones.append(botonMensaje("i-grande", "Mostrar en grande", "Para que lo lea de lejos", verGrande));
  if (hayVoz(destino)) {
    acciones.append(botonMensaje("i-altavoz", "Repetir", "Leer otra vez en voz alta",
      () => leerYAvisar(traduccion, destino, art)));
  }
  art.append(acciones);
  art.scrollIntoView({ behavior: "smooth", block: "end" });
}

/**
 * Escribe el texto marcando números, fechas y horas (10:00, 25/11/2026, 612 345 678…): es lo que más importa
 * en el mostrador y lo que más se equivoca al traducir. Así se comprueba de un vistazo en los dos idiomas.
 */
const DATOS = /[0-9٠-٩۰-۹]+(?:[.,:/\-][0-9٠-٩۰-۹]+)*(?: [0-9٠-٩۰-۹]{2,3}(?![0-9٠-٩۰-۹]))*/g;
function resaltarDatos(el, texto) {
  el.replaceChildren();
  let desde = 0;
  for (const m of texto.matchAll(DATOS)) {
    if (m.index > desde) el.append(texto.slice(desde, m.index));
    const marca = document.createElement("span");
    marca.className = "dato";
    marca.textContent = m[0];
    el.append(marca);
    desde = m.index + m[0].length;
  }
  if (desde < texto.length) el.append(texto.slice(desde));
}

/** ¿Hay alguna voz (de Puente o del navegador) para leer este idioma? */
function hayVoz(idioma) {
  return Boolean((ajustes.motorVoz === "puente" && vozPuente(idioma.voz, generoPara(idioma)))
    || vozPara(idioma.voz, ajustes.internetVoces, generoPara(idioma)));
}

/** Botón pequeño con icono y texto, para debajo de cada mensaje. */
function botonMensaje(icono, texto, titulo, alPulsar) {
  const b = document.createElement("button");
  b.className = "boton-mensaje";
  b.title = titulo;
  b.innerHTML = `<svg aria-hidden="true"><use href="#${icono}"/></svg>`;
  b.append(texto);
  b.addEventListener("click", alPulsar);
  return b;
}

let mensajes = []; // los de esta conversación, para imprimirlos: { art, hora, lado, espanol, otro }
let ultimoVerGrande = null; // F4: ver en grande el último mensaje
let turnoLectura = 0;

/** Lee en voz alta y, si es de un mensaje, lo marca mientras suena (con botón Parar). */
async function leerYAvisar(texto, idioma, art = null) {
  const mio = ++turnoLectura;
  quitarLectura();
  art?.classList.add("leyendo");
  const problema = await leer(texto, idioma.voz, ajustes.internetVoces, generoPara(idioma), ajustes.motorVoz);
  if (problema) {
    if (mio === turnoLectura) quitarLectura();
    mostrarEstado(`${problema} Prueba la voz en ⚙︎ Ajustes.`, { error: true });
    return;
  }
  // Cuando deja de sonar (o se lee otra cosa), se quita la marca.
  const vigilar = () => {
    if (mio !== turnoLectura) return;
    if (estaSonando()) setTimeout(vigilar, 250);
    else quitarLectura();
  };
  setTimeout(vigilar, 250);
}

function quitarLectura() {
  for (const m of document.querySelectorAll(".mensaje.leyendo")) m.classList.remove("leyendo");
}

function nuevaConversacion() {
  detenerDictado();
  callar();
  quitarLectura();
  mensajes = [];
  ultimoVerGrande = null;
  $("#imprimir-conversacion").disabled = true;
  pintarVacia();
  mostrarSelectorIdioma();
  $("#texto-paciente").value = "";
  $("#texto-profesional").value = "";
  aplicarIdiomaPaciente();
}

/** Pantalla de bienvenida: saludo, cómo se usa y unas frases para empezar. */
function pintarVacia() {
  const conversacion = $("#conversacion");
  // La tarjeta de preparación y el selector de idioma viven dentro de la conversación.
  const tarjeta = $("#preparacion");
  const selector = $("#elegir-idioma");
  conversacion.replaceChildren($("#plantilla-vacia").content.cloneNode(true), selector, tarjeta);
  pintarFrasesInicio();
}

function pintarFrasesInicio() {
  const cont = $("#frases-inicio");
  if (!cont) return;
  cont.replaceChildren();
  for (const frase of ajustes.frases.slice(0, 3)) {
    const b = document.createElement("button");
    b.textContent = frase;
    b.addEventListener("click", () => enviar("profesional", frase));
    cont.append(b);
  }
}

// ---------- Respuestas rápidas del paciente ----------
// Sí · No · No entiendo · Repita, ya escritas en su idioma: salen al instante, sin traductor.

function pintarRespuestas() {
  const cont = $("#respuestas");
  cont.replaceChildren();
  const lista = RESPUESTAS[paciente.traduccion];
  cont.hidden = !lista;
  if (!lista) return;
  lista.forEach((texto, i) => {
    const b = document.createElement("button");
    b.className = `respuesta r${i}`;
    b.title = RESPUESTAS_ES[i];
    const t = document.createElement("span");
    t.className = "respuesta-texto";
    t.textContent = texto;
    const es = document.createElement("small");
    es.textContent = RESPUESTAS_ES[i];
    es.lang = "es";
    es.dir = "ltr";
    b.append(t, es);
    b.addEventListener("click", () => responderRapido(texto, RESPUESTAS_ES[i]));
    cont.append(b);
  });
}

function responderRapido(texto, enEspanol) {
  detenerDictado();
  const burbuja = crearBurbuja("paciente", texto, paciente);
  completarBurbuja(burbuja, enEspanol, PROFESIONAL, texto, paciente);
  if (ajustes.leerProfesional) leerYAvisar(enEspanol, PROFESIONAL, burbuja);
}

// ---------- Elegir idioma (al empezar una conversación nueva) ----------
// El paciente señala su idioma, escrito en su propio alfabeto.

const IDIOMAS_A_LA_VISTA = 8;

function prepararSelectorIdioma() {
  $("#mas-idiomas").addEventListener("click", () => {
    $("#elegir-idioma").classList.add("todos");
  });
  $("#seguir-idioma").addEventListener("click", () => { $("#elegir-idioma").hidden = true; });
}

function mostrarSelectorIdioma() {
  const rejilla = $("#rejilla-idiomas");
  rejilla.replaceChildren();
  const orden = [paciente, ...IDIOMAS.filter((i) => i !== paciente)];
  orden.forEach((idioma, n) => {
    const b = document.createElement("button");
    b.className = `tarjeta-idioma${idioma === paciente ? " actual" : ""}${n >= IDIOMAS_A_LA_VISTA ? " extra" : ""}`;
    const nativo = document.createElement("b");
    nativo.textContent = idioma.nativo;
    nativo.lang = idioma.traduccion;
    nativo.dir = idioma.dir;
    const nombre = document.createElement("span");
    nombre.textContent = idioma.nombre;
    b.append(nativo, nombre);
    b.addEventListener("click", () => {
      $("#elegir-idioma").hidden = true;
      if (idioma !== paciente) {
        $("#idioma").value = idioma.id;
        cambiarIdioma(idioma.id);
      }
    });
    rejilla.append(b);
  });
  $("#elegir-idioma").classList.remove("todos");
  $("#mas-idiomas").hidden = orden.length <= IDIOMAS_A_LA_VISTA;
  $("#seguir-idioma").textContent = `Seguir con ${enMinuscula(paciente.nombre)}`;
  $("#elegir-idioma").hidden = false;
}

// ---------- Menú «Aa»: alto contraste y atajos visibles ----------

function prepararVista() {
  const aplicar = () => {
    document.documentElement.classList.toggle("contraste", ajustes.altoContraste);
    document.documentElement.classList.toggle("con-atajos", ajustes.verAtajos);
  };
  for (const [sel, clave] of [["#alto-contraste", "altoContraste"], ["#ver-atajos", "verAtajos"]]) {
    const c = $(sel);
    c.checked = ajustes[clave];
    c.addEventListener("change", () => {
      ajustes[clave] = c.checked;
      guardarAjustes();
      aplicar();
    });
  }
  aplicar();
}

// ---------- Atajos de teclado ----------
// F1: habla el paciente · F2: habla el profesional · F4: el último mensaje en grande · Esc: parar.

function prepararAtajos() {
  document.addEventListener("keydown", (e) => {
    if (guiaActiva || $("#ajustes").open || $("#dialogo-imprimir").open) return;
    if (e.key === "F1" || e.key === "F2") {
      e.preventDefault(); // F1 abre la ayuda del navegador
      if (!$("#grande").hidden) return;
      const lado = e.key === "F1" ? "paciente" : "profesional";
      if (!$(`.microfono[data-lado="${lado}"]`).disabled) alternarDictado(lado);
    } else if (e.key === "F4") {
      e.preventDefault();
      if ($("#grande").hidden) ultimoVerGrande?.();
    } else if (e.key === "Escape" && $("#grande").hidden) {
      callar();
      quitarLectura();
      detenerDictado();
    }
  });
}

// ---------- Imprimir la conversación (eligiendo los mensajes) ----------

function prepararImpresionConversacion() {
  const dialogo = $("#dialogo-imprimir");
  $("#imprimir-conversacion").disabled = true;
  $("#imprimir-conversacion").addEventListener("click", () => {
    pintarListaImprimir();
    dialogo.showModal();
  });
  const marcar = (valor) => {
    for (const c of dialogo.querySelectorAll("#lista-imprimir input")) c.checked = valor;
    contarImprimir();
  };
  $("#marcar-todos").addEventListener("click", () => marcar(true));
  $("#marcar-ninguno").addEventListener("click", () => marcar(false));
  $("#lista-imprimir").addEventListener("change", contarImprimir);
  $("#hacer-imprimir").addEventListener("click", () => {
    const elegidos = [...dialogo.querySelectorAll("#lista-imprimir input")]
      .filter((c) => c.checked).map((c) => mensajes[Number(c.value)]);
    if (!elegidos.length) return;
    pintarHojaConversacion(elegidos);
    dialogo.close();
    document.body.classList.add("imprimiendo-conversacion");
    window.print();
  });
  window.addEventListener("afterprint", () => document.body.classList.remove("imprimiendo-conversacion"));
}

function pintarListaImprimir() {
  const lista = $("#lista-imprimir");
  lista.replaceChildren();
  mensajes.forEach((m, i) => {
    const li = document.createElement("li");
    li.className = m.lado;
    const label = document.createElement("label");
    const c = document.createElement("input");
    c.type = "checkbox";
    c.value = String(i);
    c.checked = true;
    const quien = document.createElement("span");
    quien.className = "imp-quien";
    quien.textContent = `${m.hora} · ${m.lado === "paciente" ? "Paciente" : "Profesional"}`;
    const textos = document.createElement("span");
    textos.className = "imp-textos";
    const es = document.createElement("b");
    es.textContent = m.espanol;
    const otro = document.createElement("span");
    otro.textContent = m.otro;
    otro.lang = paciente.traduccion;
    otro.dir = paciente.dir;
    textos.append(es, otro);
    label.append(c, quien, textos);
    li.append(label);
    lista.append(li);
  });
  contarImprimir();
}

function contarImprimir() {
  const todas = [...document.querySelectorAll("#lista-imprimir input")];
  const n = todas.filter((c) => c.checked).length;
  $("#imprimir-cuenta").textContent = `${n} de ${todas.length} mensajes`;
  $("#hacer-imprimir").disabled = n === 0;
}

function pintarHojaConversacion(elegidos) {
  const hoja = $("#hoja-conversacion");
  hoja.replaceChildren();
  const cab = document.createElement("div");
  cab.className = "impreso-cabecera";
  cab.innerHTML = `<img src="icono-512.png" alt="" width="40" height="40">
    <span><b>Centro de salud</b><br>Resumen de la conversación</span><span class="impreso-fecha"></span>`;
  cab.querySelector(".impreso-fecha").textContent =
    new Date().toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" });
  const tabla = document.createElement("table");
  const thead = tabla.createTHead().insertRow();
  for (const [texto, lang, dir] of [["Hora", "es", "ltr"], ["Español", "es", "ltr"], [paciente.nativo, paciente.traduccion, paciente.dir]]) {
    const th = document.createElement("th");
    th.textContent = texto;
    th.lang = lang;
    th.dir = dir;
    thead.append(th);
  }
  const cuerpo = tabla.createTBody();
  for (const m of elegidos) {
    const fila = cuerpo.insertRow();
    fila.insertCell().textContent = `${m.hora} · ${m.lado === "paciente" ? "Pac." : "Prof."}`;
    resaltarDatos(fila.insertCell(), m.espanol);
    const otro = fila.insertCell();
    resaltarDatos(otro, m.otro);
    otro.lang = paciente.traduccion;
    otro.dir = paciente.dir;
  }
  const pie = document.createElement("p");
  pie.className = "impreso-pie";
  pie.textContent = "Traducido automáticamente con Puente Consulta. Ante cualquier duda, pregunte en el mostrador.";
  hoja.append(cab, tabla, pie);
}

// ---------- Guía de la primera vez ----------

let guiaActiva = false;
const PASOS_GUIA = [
  { sel: ".idioma-paciente", titulo: "1 · El idioma del paciente",
    texto: "Elíjalo aquí. Al empezar una conversación nueva, el paciente también puede señalarlo él mismo." },
  { sel: "#panel-profesional .microfono", titulo: "2 · Pulse y hable",
    texto: "Pulse, hable, y al terminar se traduce y se lee en voz alta. El paciente tiene el suyo a la izquierda, y botones de Sí / No." },
  { sel: ".pasos li:nth-child(3)", otro: "#conversacion", titulo: "3 · Enséñeselo",
    texto: "Cada mensaje tiene «Mostrar en grande» para que lo lea de lejos, y se puede imprimir. Atajos: F1 paciente, F2 usted, F4 en grande." },
];

function prepararGuia() {
  let paso = 0;
  const pintar = () => {
    const p = PASOS_GUIA[paso];
    const destino = $(p.sel) ?? $(p.otro);
    const r = destino.getBoundingClientRect();
    const foco = $("#guia .guia-foco");
    Object.assign(foco.style, { left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
    $("#guia-titulo").textContent = p.titulo;
    $("#guia-texto").textContent = p.texto;
    $("#guia-paso").textContent = `${paso + 1} de ${PASOS_GUIA.length}`;
    $("#guia-siguiente").textContent = paso === PASOS_GUIA.length - 1 ? "Entendido" : "Siguiente";
    const globo = $("#guia .guia-globo");
    const ancho = 320;
    const izquierda = Math.min(Math.max(16, r.left + r.width / 2 - ancho / 2), innerWidth - ancho - 16);
    const abajo = r.bottom + 200 < innerHeight;
    globo.classList.toggle("arriba", !abajo);
    Object.assign(globo.style, { left: `${izquierda}px`, width: `${ancho}px`,
      top: abajo ? `${r.bottom + 16}px` : "auto", bottom: abajo ? "auto" : `${innerHeight - r.top + 16}px` });
    globo.style.setProperty("--flecha", `${Math.min(Math.max(20, r.left + r.width / 2 - izquierda), ancho - 20)}px`);
  };
  const terminar = () => {
    $("#guia").hidden = true;
    guiaActiva = false;
    ajustes.guiaVista = true;
    guardarAjustes();
  };
  $("#guia-saltar").addEventListener("click", terminar);
  $("#guia-siguiente").addEventListener("click", () => {
    if (paso === PASOS_GUIA.length - 1) return terminar();
    paso += 1;
    pintar();
  });
  document.addEventListener("keydown", (e) => { if (guiaActiva && e.key === "Escape") terminar(); });
  window.addEventListener("resize", () => { if (guiaActiva) pintar(); });
  $("#repetir-guia").addEventListener("click", () => {
    $("#ajustes").close();
    iniciarGuia();
  });
  iniciarGuia = () => {
    if (guiaActiva || !$("#sin-soporte").hidden) return;
    paso = 0;
    guiaActiva = true;
    $("#guia").hidden = false;
    pintar();
  };
}
let iniciarGuia = () => {};

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

let temaActivo = "Todas";

/** Frases rápidas del profesional, por temas (Citas · Datos · Indicaciones · Mías). */
function pintarFrases() {
  const cont = $("#frases");
  cont.replaceChildren();
  const hayMias = ajustes.frases.some((f) => temaDe(f) === "Mías");
  const temas = ["Todas", ...TEMAS.filter((t) => t !== "Mías" || hayMias)];
  if (!temas.includes(temaActivo)) temaActivo = "Todas";
  const barra = document.createElement("div");
  barra.className = "temas";
  for (const tema of temas) {
    const t = document.createElement("button");
    t.textContent = tema;
    t.className = tema === temaActivo ? "activo" : "";
    t.addEventListener("click", () => { temaActivo = tema; pintarFrases(); });
    barra.append(t);
  }
  const chips = document.createElement("div");
  chips.className = "lista-chips";
  for (const frase of ajustes.frases) {
    if (temaActivo !== "Todas" && temaDe(frase) !== temaActivo) continue;
    const b = document.createElement("button");
    b.textContent = frase;
    b.addEventListener("click", () => enviar("profesional", frase));
    chips.append(b);
  }
  cont.append(barra, chips);
  pintarFrasesInicio();

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

function elegirPestana(nombre) {
  for (const t of document.querySelectorAll("#ajustes .pestana")) {
    t.setAttribute("aria-selected", String(t.dataset.pestana === nombre));
  }
  for (const h of document.querySelectorAll("#ajustes .hoja-pestana")) h.hidden = h.dataset.hoja !== nombre;
}

let informe = []; // líneas del semáforo, para «Copiar informe»

/** Texto para mandar a informática si algo no funciona en un equipo. */
async function copiarInforme() {
  const texto = [
    "Puente Consulta · informe del equipo",
    new Date().toLocaleString("es-ES"),
    `${location.origin}${location.pathname}`,
    "",
    ...informe,
    "",
    `Navegador completo: ${navigator.userAgent}`,
  ].join("\n");
  const boton = $("#copiar-informe");
  try {
    await navigator.clipboard.writeText(texto);
    boton.textContent = "✔ Copiado: pégalo en un correo o en Teams";
  } catch {
    boton.textContent = "No se pudo copiar";
  }
  setTimeout(() => { boton.textContent = "Copiar informe"; }, 4000);
}

function prepararAjustes() {
  $("#abrir-ajustes").addEventListener("click", () => abrirAjustes());
  $("#copiar-informe").addEventListener("click", copiarInforme);
  for (const t of document.querySelectorAll("#ajustes .pestana")) {
    t.addEventListener("click", () => elegirPestana(t.dataset.pestana));
  }
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

async function abrirAjustes(pestana = "voz") {
  if (!$("#ajustes").open) elegirPestana(typeof pestana === "string" ? pestana : "voz");
  const lista = $("#diagnostico");
  lista.replaceChildren();
  informe = [];
  /** Una fila del semáforo: estado "ok" (verde), "med" (ámbar, funciona con límites) o "mal" (rojo). */
  const fila = (estado, titulo, detalle) => {
    const li = document.createElement("li");
    li.className = `semaforo-${estado}`;
    const punto = document.createElement("span");
    punto.className = "punto";
    const texto = document.createElement("span");
    texto.className = "semaforo-texto";
    const b = document.createElement("b");
    b.textContent = titulo;
    const d = document.createElement("span");
    d.textContent = detalle;
    texto.append(b, d);
    li.append(punto, texto);
    lista.append(li);
    informe.push(`${{ ok: "✔", med: "⚠", mal: "✘" }[estado]} ${titulo}: ${detalle}`);
    return li;
  };

  const version = navigator.userAgent.match(NAVEGADOR === "Edge" ? /\bEdg\/(\d+)/ : /\bChrome\/(\d+)/)?.[1];
  const minima = NAVEGADOR === "Edge" ? 148 : 138;
  fila(version && Number(version) >= minima ? "ok" : "mal", "Navegador",
    `${NAVEGADOR === "otro" ? "no es Chrome ni Edge" : `${NAVEGADOR} ${version ?? "?"}`}` +
    (version && Number(version) < minima ? ` (hace falta la ${minima} o posterior: actualízalo)` : ""));

  if (esModoPrueba()) fila("med", "Traductor", "modo de prueba (traducción falsa): quita «?prueba» de la dirección");
  else if (!hayTraductor()) fila("mal", "Traductor", "este navegador no lo tiene");
  else if (listo) fila("ok", "Traductor", `${enMinuscula(paciente.nombre)} ⇄ español, en este equipo`);
  else fila("med", "Traductor", `falta descargar ${enMinuscula(paciente.nombre)} (botón Descargar)`);

  let micro = "prompt";
  try {
    micro = (await navigator.permissions.query({ name: "microphone" })).state;
  } catch { micro = "?"; }
  fila({ granted: "ok", prompt: "med", denied: "mal" }[micro] ?? "med", "Micrófono", {
    granted: "permitido",
    prompt: "lo pedirá la primera vez que se pulse el micrófono",
    denied: "bloqueado: pulsa el candado de la barra de direcciones › Micrófono › Permitir, y recarga",
  }[micro] ?? "no se puede comprobar en este navegador");

  if (!hayDictado()) {
    fila("mal", "Dictado", "este navegador no tiene dictado por voz: se puede escribir");
  } else {
    for (const idioma of [PROFESIONAL, paciente]) {
      const modo = await modoPara(idioma.voz);
      const [estado, texto] = {
        local: ["ok", "en este equipo"],
        descargable: ["ok", "en este equipo (se descarga al usarlo)"],
        internet: ajustes.internetDictado ? ["med", "por internet (permitido): el audio sale del equipo"]
          : ["med", "solo por internet, y está desactivado: se puede escribir"],
        no: ["mal", "no disponible: se puede escribir"],
      }[modo];
      fila(estado, `Dictado en ${enMinuscula(idioma.nombre)}`, texto);
    }
  }

  for (const idioma of [PROFESIONAL, paciente]) {
    const genero = generoPara(idioma);
    const puente = vozPuente(idioma.voz, genero);
    const elegida = vozPara(idioma.voz, ajustes.internetVoces, genero);
    const nube = vozPara(idioma.voz, true, genero);
    const titulo = `Voz en ${enMinuscula(idioma.nombre)}${genero ? ` (${genero})` : ""}`;
    let li;
    if (ajustes.motorVoz === "puente" && puente) {
      const descargada = await estaDescargada(puente);
      li = fila(descargada ? "ok" : "med", titulo, `de Puente, ${puente.nombre}` +
        (descargada ? ", descargada" : `, se descarga al usarla (${puente.mb} MB)`) + (elegida ? `. Si falla: ${elegida.name}` : ""));
    } else if (elegida) {
      const g = generoDe(elegida);
      li = fila(elegida.localService ? "ok" : "med", titulo, `${elegida.name}${elegida.localService ? "" : " (de internet)"}` +
        (genero && g !== genero ? `; no hay voz de ${genero}${g ? `, se usa una de ${g}` : ""}` : ""));
    } else {
      li = fila("mal", titulo, nube ? `solo hay de internet (${nube.name}): permítelas en la pestaña Voz`
        : "no hay ninguna instalada");
    }
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
      li.append(probar);
    }
  }
  if (!$("#ajustes").open) $("#ajustes").showModal();
}

iniciar();
