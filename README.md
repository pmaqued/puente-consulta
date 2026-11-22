# Puente Consulta

Página web para **conversaciones cara a cara** traducidas, pensada para las consultas de medicina y enfermería del
centro de salud (pacientes que hablan sobre todo árabe o chino). Sin instalar nada y sin coste.

> **Aviso:** es una ayuda para la comunicación en consulta (preguntas sencillas, indicaciones, citas), no
> para diagnósticos, tratamientos ni consentimientos: para eso, intérprete (Dualia, el servicio telefónico del
> SERMAS). La traducción automática puede equivocarse.

## Cómo funciona

- Arriba eliges el **idioma del paciente**. Abajo hay dos paneles: el del **paciente** (con los textos en su
  idioma y de derecha a izquierda si es árabe) y el del **profesional** (español).
- Cada uno **escribe** o pulsa **«Pulse y hable»** y habla. Al terminar de hablar (o al volver a pulsar) se
  traduce solo. No es simultáneo: se traduce frase a frase.
- En la conversación, cada mensaje muestra la **traducción en grande** (para quien lo lee) y el original en
  pequeño. 🔊 lo lee en voz alta. Lo que se dicta se lee solo en voz alta al traducirlo.
- **Voces:** el español, de hombre o de mujer (se elige arriba); el árabe, de hombre; el chino, de mujer.
  En *Ajustes* se elige con qué voces se lee:
  - **Voces de Puente** (por defecto): voces [Piper](https://github.com/rhasspy/piper) que funcionan dentro
    de la página, **iguales en Chrome y en Edge y en cualquier ordenador**, sin instalar nada y sin enviar
    nada fuera. Cada voz se descarga una vez (60–80 MB) al preparar el idioma y queda guardada.
  - **Voces del navegador**: las del sistema o, en **Edge**, sus voces «Natural» (muy buenas, pero de
    internet: el texto va a Microsoft; hay que permitir las voces de internet).
  Si una voz de Puente falla, se usa la del navegador.
- **⛶ Ver en grande** (o clic en la traducción): el mensaje ocupa toda la pantalla para leerlo de lejos;
  clic o `esc` para cerrar. Desde ahí, **🖨 Imprimir** saca el mensaje en papel (traducción en grande, original
  y fecha), por ejemplo para darle al paciente su cita. **A− / A+** cambian el tamaño de la letra de la conversación.
- Si el paciente **escribe en otro idioma** de la lista, avisa arriba y ofrece cambiar (detector integrado
  del navegador, en el propio ordenador).
- **Funciona sin conexión** una vez abierta y con los idiomas descargados, y se puede **instalar como app**
  (Chrome/Edge: menú ⋮ › *Instalar Puente Consulta*): se abre en su propia ventana, con su icono.
- **Frases rápidas** para el profesional (saludo, tarjeta sanitaria, «Túmbese en la camilla», nueva cita…). Se editan en Ajustes.
- **Nueva conversación** lo borra todo. La conversación **no se guarda en ningún sitio**: solo vive en la
  pestaña. Los ajustes y las frases sí se guardan en el navegador.

## Privacidad (datos de salud)

| Pieza | Dónde se procesa |
|---|---|
| Traducción | **En el propio ordenador** (traductor integrado de Chrome/Edge). No sale nada. |
| Dictado por voz | En el ordenador si el navegador lo permite para ese idioma. Si no, **envía el audio a Google (Chrome) o Microsoft (Edge)**: por eso viene **desactivado** y hay que permitirlo en Ajustes. |
| Lectura en voz alta | **Voces de Puente:** en el propio ordenador (la primera vez se descargan los archivos de la voz desde Hugging Face y jsDelivr, sin enviar ningún dato). **Voces del navegador:** las del sistema, en el ordenador; las «de internet» (como las «Natural» de Edge) envían el texto fuera y solo se usan si se permiten en Ajustes. |

En *Ajustes › Este navegador* se ve qué hay disponible en cada idioma.

Para presentarla en el centro: [`docs/consulta-para-el-centro.md`](../../docs/consulta-para-el-centro.md).

## Requisitos

- **Google Chrome 138+** o **Microsoft Edge 148+**, en ordenador (Windows, Mac o Linux). No funciona en
  móviles, Firefox ni Safari: la página lo avisa.
- La página tiene que abrirse desde **https** o desde **localhost** (el traductor integrado no funciona
  abriendo el archivo con doble clic).
- La primera vez, cada idioma se **descarga** (botón *Descargar* arriba). Después funciona sin conexión.
- Micrófono, si se quiere dictar.

## Probarla en el Mac

```bash
scripts/consulta.sh            # la abre en http://localhost:8642 con Chrome (por defecto)
scripts/consulta.sh --chrome   # lo mismo, diciéndolo explícitamente
scripts/consulta.sh --edge     # la misma página, en Microsoft Edge (hay que tenerlo instalado)
scripts/consulta.sh --prueba   # modo de prueba: traducción falsa, para revisar la página en cualquier navegador
# …/?prueba=descarga           # además simula la primera descarga (para ver la tarjeta de preparación)
```

## Usarla en los ordenadores del centro

Hace falta publicarla en una dirección **https**. Lo previsto (gratis) es **GitHub Pages**. Como el
repositorio del proyecto es privado (y Pages solo es gratis en los públicos), se publica **solo esta carpeta**
en un repositorio público aparte, `pmaqued/puente-consulta`:

```bash
scripts/publicar-consulta.sh   # pide confirmación; se puede repetir para subir una versión nueva
```

Quedaría en `https://pmaqued.github.io/puente-consulta/`. La página no contiene ni guarda datos de nadie.
Antes de usarla con pacientes, conviene consultarlo con el centro (informática / protección de datos).

## Archivos

```
index.html     estructura de la página
estilos.css    diseño (modo claro y oscuro, árabe de derecha a izquierda)
app.js         lógica: idiomas, conversación, dictado, ajustes
idiomas.js     lista de idiomas, textos del paciente y frases rápidas de fábrica
traductor.js   traductor integrado del navegador (y modo de prueba)
detector.js    detector de idioma integrado del navegador
sw.js          guarda los archivos de la página para usarla sin conexión
manifest.webmanifest  datos para instalarla como app
voz.js         dictado y lectura en voz alta, con las reglas de privacidad
voces-puente.js  «Voces de Puente» (Piper): qué voz se usa en cada idioma y género
vendor/piper/  copia de la librería piper-tts-web (MIT), con un cambio para elegir hablante
icono.png, icono-512.png  icono (el mismo de Puente)
```

Para añadir un idioma: una línea en `idiomas.js`. Si no trae los textos del paciente, se traducen solos.

## Créditos de las voces de Puente

Motor: [piper-tts-web](https://github.com/Mintplex-Labs/piper-tts-web) (MIT) y [Piper](https://github.com/rhasspy/piper).
Voces: *sharvard* (español; datos con licencia CC BY 3.0, Universidad de Edimburgo), *kareem* (árabe) y
*huayan* (chino); sus fichas (MODEL_CARD) en Hugging Face no indican licencia clara para las dos últimas: para
uso propio no hay problema, pero conviene revisarlo antes de distribuir la herramienta.
