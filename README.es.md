<div align="center">

# 🐋 dsh-think-translate

**Idiomas:** [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![npm version](https://img.shields.io/npm/v/dsh-think-translate?color=4D6BFE&label=npm)](https://www.npmjs.com/package/dsh-think-translate)
[![license](https://img.shields.io/npm/l/dsh-think-translate?color=4D6BFE)](LICENSE)
[![dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

<img src="demo/demo.gif?v=2" width="46%" alt="dsh-think-translate demo" style="border:1px solid #4D6BFE;border-radius:8px;margin:4px" />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="demo/demo2.gif?v=2" width="41%" alt="dsh-think-translate demo 2" style="border:1px solid #4D6BFE;border-radius:8px;margin:4px" />

</div>

---

Traducción en la capa de visualización para la interfaz web de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): la **cadena de pensamiento (fila Think), las tarjetas de tareas y el texto de respuesta** se muestran en el idioma de destino elegido, mientras los originales permanecen intactos en la transcripción y el texto traducido **nunca entra en el contexto del modelo**.

## ✨ Características

Los modelos de la familia DeepSeek suelen razonar en chino — o en el idioma en que les da por pensar. dsh-think-translate muestra la fila Think, las tarjetas de tareas y la respuesta en *tu* idioma mientras miras, como subtítulos del pensamiento del modelo.

- **Motivos de rechazo de Auto review** — conserva el original y añade la traducción de forma asíncrona en la tarjeta de aprobación, con un interruptor independiente.
- **🕵️ Lee cualquier cadena de pensamiento** — razonamiento, cadena de pensamiento, tarjetas de tareas y respuestas traducidos en tiempo real, por lotes
- **8 idiomas de destino** — 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Русский
- **Interfaz en un solo idioma** — panel de ajustes, filas de pensamiento y tarjetas de tareas siguen el idioma de destino (sin mezclar zh/en); la elección persiste
- **Ollama local** — reutiliza la instalación y los modelos al traducir o probar. Reordenar o volver a abrir los ajustes no carga el modelo. Los componentes que falten requieren el botón de preparación.
- **1.2.15: memoria y compatibilidad** — libera el modelo seleccionado manualmente o al desactivar el proveedor, después de terminar las traducciones activas. La siguiente traducción lo recarga. La liberación por inactividad usa 5 minutos por defecto, con 1/5/10/30/60 minutos o desactivada; los cambios se aplican desde el próximo uso sin modificar ajustes globales. Adapta las imágenes, el plegado de Turn y la selección del original en DSH 0.2.2-alpha.2. No actives simultáneamente la traducción oficial del razonamiento.
- **🧠 Coste de contexto cero** — capa de visualización pura: el modelo sigue viendo el texto original y el texto traducido nunca consume la ventana de contexto
- **Respaldo Google / Bing** — cambio automático si el modelo local no está disponible (google usa un túnel CONNECT de Node con el proxy del sistema)
- **Artefactos de código omitidos** — rutas, comandos, URL, regex y líneas de código puro nunca se traducen
- **Traducción por lotes de frases** — las cadenas largas se traducen en lotes pequeños para mantener la calidad en modelos locales pequeños
- **🧩 Fragmentación por párrafos y frases** — las cadenas largas se dividen por líneas en blanco (se conserva la estructura de párrafos) y luego por frases, para que un modelo local pequeño mantenga la calidad
- **Salida en streaming** — las traducciones aparecen lote a lote mientras piensa; expande la fila Think para comparar con el original
- **🎚️ Momento de traducción ajustable** — pre-traducir todo / carga diferida de cadenas antiguas (por defecto) / solo al expandir
- **🔗 Cadena de proveedores dinámica** — el orden de la lista es el orden de uso: arrastra para reordenar y activa o desactiva cada fila. Integrados google gtx / bing / Ollama local más cualquier endpoint personalizado
- **🔌 Proveedores personalizados (OpenAI y Anthropic)** — añade desde el panel cualquier endpoint compatible con OpenAI (`/v1/chat/completions`) o la **Anthropic Messages API** (Claude): tipo, preajuste, URL base, clave de API y modelo
- **🪄 Hereda los proveedores configurados en DSH** — detecta filas DSH de solo lectura desde `profiles/<profile>/cordis.patch.yml` / anterior `settings.yaml` (`llm-pi-ai.providers`) y un botón reescanea y las añade todas a la cadena; la clave se resuelve en cada petición desde `.credentials.yaml` y nunca se guarda en la config del plugin. La ruta por defecto del propio harness también cuenta: si `default-model` / `agent-default-model` apunta a `deepseek-official`, la API oficial de DeepSeek aparece como una fila DSH más
- **⏱️ Resistente** — los fallos se guardan en memoria durante 30 segundos para evitar reintentos continuos y después se reintentan automáticamente; cada proveedor tiene su botón de prueba

## 📦 Instalación

```bash
# Opción 1: npm (recomendado)
dsh plugin --profile web add dsh-think-translate
# luego reinicia web

# Opción 2: GitHub
dsh plugin --profile web add github:UncleK/dsh-think-translate

# Opción 3: manual (junction + patch)
#  1. enlaza el paquete en el node_modules del perfil
New-Item -ItemType Junction -Path "$HOME\.dsh\profiles\node_modules\dsh-think-translate" `
  -Target "<ruta del repositorio>"
#  2. añade a "$HOME\.dsh\profiles\web\cordis.patch.yml":
# - insert:
#     - id: dsh-think-translate
#       name: dsh-think-translate
#  3. reinicia web
```

## 🧯 Después de actualizar DSH

Los plugins de cliente de terceros se cargan a través del grafo de módulos de cliente de DSH, y ese grafo se compone **una sola vez por proceso**: una composición fallida permanece en memoria hasta reiniciar. Por eso, justo después de actualizar suelen aparecer estas tres cosas.

- **Arrancar desde un checkout del código falla** con `client bundles not found; run \`pnpm run build\` before launch` —— los paquetes de cliente nuevos vienen sin compilar: ejecuta `pnpm run build` en el checkout del harness y vuelve a iniciar `dsh web`.
- **La interfaz del plugin desaparece** (la fila Think sin traducción, sin la sección *Traducción de cadena de pensamiento* en Ajustes) —— **reinicia `dsh web`**; a veces no basta con recargar la página.
- **La lista de modelos locales está vacía** —— el servicio `ollama` no está sirviendo ese directorio de modelos: revisa `ollama list` (o `GET /api/tags`) y el `OLLAMA_MODELS` que usa realmente el servicio en ejecución. Si los modelos están en otra unidad, un enlace de directorio (junction) puede apuntar el directorio predeterminado del servicio hacia ellos.

No hay nada que configurar en el plugin: no declara dependencia de orden con los paquetes internos de DSH (solo se enlaza al servicio `slots` y, opcionalmente, a `@deepseek-ai/dsh-client-ui-primitives`), así que funciona tanto en DSH antiguo (≤ 0.1.1-rc) como en la línea actual (≥ 0.1.2-alpha.1, incluida 0.1.5-rc.1).

Para DSH **0.2.0-rc.2**, usa **dsh-think-translate 1.2.5 o posterior**. La versión 1.2.5 corrige el conflicto de registro del slot `todo_write` y declara el rango peer 0.2. Ejecuta `dsh plugin --profile web add dsh-think-translate@latest` y reinicia DSH; no hace falta una excepción de versión.

**1.2.6** corrige la duplicación del razonamiento y las respuestas en DSH 0.2: el renderizador y su texto original de respaldo respetan los grupos reasoning/response.

**1.2.7 preparación local:** Ollama habilitado en primera posición, o su botón de prueba, detecta la instalación existente y arranca/carga el modelo. La instalación y descarga requieren el botón de preparación y muestran progreso por etapas. La instalación automática del software admite Windows; otros sistemas enlazan la guía oficial. El proveedor en uso sigue la prioridad de los proveedores habilitados y verificados.

**1.2.8 transporte y recuperación:** las traducciones HTTP/HTTPS normales usan la red nativa de Node en lugar de iniciar curl por cada lote de texto. Los proxies SOCKS y el instalador de Ollama conservan la compatibilidad con curl. Los fallos permanecen en memoria durante 30 segundos y después se reintentan automáticamente las traducciones del razonamiento y las respuestas. Los tiempos de espera permiten cargar modelos locales y probar proveedores alternativos.

**1.2.14:** se aclaran el idioma de destino y los límites del texto original. Las traducciones claramente en otro idioma se rechazan y se prueba el siguiente proveedor habilitado. No se guardan como éxitos; se elimina la caché anterior y se conservan las preferencias, el código, los términos citados y los textos breves ambiguos. Reinicia por completo DSH Web o Desktop tras actualizar. [#14](https://github.com/UncleK/dsh-think-translate/issues/14).

**1.2.13:** las tarjetas de rechazo de Auto review conservan el original y añaden la traducción de forma asíncrona, con un interruptor independiente activado por defecto. Se descartan los resultados antiguos al desactivar la función, cambiar el idioma o retirar la tarjeta. Los motivos no ingleses también se traducen al inglés. Gracias a [llg1634](https://github.com/llg1634) por el informe, el parche inicial y las pruebas en [#13](https://github.com/UncleK/dsh-think-translate/issues/13). Reinicia por completo DSH Web o Desktop tras actualizar.

**1.2.12:** se respetan los proveedores habilitados; el navegador ya no consulta Google directamente si falla el Host. El código delimitado, con sangría o en línea se excluye de las solicitudes y se conserva exactamente, incluso durante streaming incompleto. Se elimina la caché de traducciones anterior y se conservan las preferencias. Tras actualizar, reinicia por completo DSH Web o Desktop; recargar la página puede seguir usando recursos antiguos del cliente.

**1.2.11 correcciones de Bing:** se mantiene el proveedor gratuito. Las solicitudes de traducción usan el origen final de la página de sesión para evitar que la redirección `www.bing.com` → `cn.bing.com` en China continental elimine el cuerpo POST. SOCKS/curl comparte las cabeceras de navegador del transporte nativo para corregir HTTP 401; las respuestas vacías o no JSON muestran errores claros.

**1.2.10 compatibilidad con perfiles DSH:** el descubrimiento sigue el perfil Desktop/Web activo y lee `profiles/<profile>/cordis.patch.yml` (`id` + `config`), después los parches del directorio DSH y las superposiciones de inicio. Se mantiene el formato anterior `settings.yaml`. El modelo predeterminado usa `default-model`; las credenciales siguen en `.credentials.yaml` del directorio DSH y solo en memoria. El diagnóstico muestra el archivo leído.

**1.2.9 correcciones de idioma:** las pistas de vocabulario japonés solo se aplican al japonés; OpenAI/Anthropic reciben el nombre completo del idioma. Bing usa `auto-detect` y `zh-Hans`/`zh-Hant`. La detección del chino excluye rutas, código y JSON: omite la prosa ya simplificada, solicita conversión al detectar caracteres tradicionales frecuentes y traduce la prosa japonesa/coreana. Se elimina una vez la caché de traducciones anterior, conservando los ajustes.

## 🚀 Uso

1. Abre **Ajustes → Traducción de cadena de pensamiento**
2. Elige el **idioma de destino** (p. ej. Español) — el panel, las filas y las tarjetas cambian a ese idioma
3. Gestiona la **cadena de proveedores** (arrastra para ordenar, marca para activar):
   - Integrados: **google gtx / bing** (gratis, mediante el proxy del sistema) y **Ollama local**; se reutilizan el software y los modelos existentes. Los componentes que falten requieren el botón de preparación, con progreso (7b/14b o un modelo personalizado)
   - **Proveedores DSH**: los endpoints ya configurados en `profiles/<profile>/cordis.patch.yml` / anterior `settings.yaml` aparecen solos (solo lectura; márcalos para añadirlos a la cadena). El botón **Importar desde la config de DSH**, justo debajo de la lista, vuelve a escanear y los añade todos de una vez: ni baseURL ni clave que reescribir, porque la clave se resuelve desde las credenciales de DSH
   - La clave se escribe a mano o llega como **`apiKeyEnv`** desde un preajuste o una fila DSH: esa fila muestra la insignia `env:NAME`, y la clave se resuelve en cada petición sin escribirse nunca en `config.json`. El formulario de edición no tiene campo de variable de entorno (el valor se conserva intacto), pero vaciar un campo lo elimina de verdad (se envía como borrado explícito)
   - Si desmarcas uno, se omite. Los detalles están en [README.md](README.md)
4. Envía un mensaje y expande la fila Think para ver la traducción

## ⚙️ Cómo funciona

```
navegador → POST /_xlate/translate (mismo origen, sin CORS)
  → cadena de proveedores en el host (fail-open, reordenable):
      chain: [provider1, provider2, ...]   ← orden arrastrando en Ajustes
        google / bing / compatible con OpenAI / Anthropic
      cadena fallback (opcional, desactivada por defecto, se activa en el config)
  → texto original si fallan todos los proveedores habilitados
```

- La **configuración de proveedores** vive en `config.json` (generado en tiempo de ejecución, ignorado por git): `chain` (ids ordenados), `fallback` (enabled + chain, solo en el archivo), `providers` (por proveedor `type`/`enabled`/`baseURL`/`apiKey`/`apiKeyEnv`/`model`). Las configuraciones antiguas con `priority` se migran solas; un proveedor que declara `apiKeyEnv` resuelve la clave desde esa variable en cada petición (el `apiKey` literal queda como respaldo) y ninguna clave resuelta se escribe de vuelta en `config.json`; un `null` en un parche borra ese campo, que es como la interfaz vacía uno
- El **descubrimiento DSH** lee `profiles/<profile>/cordis.patch.yml` / anterior `settings.yaml` (`llm-pi-ai.providers`) y `.credentials.yaml` (`refs`) del harness al cargar; los proveedores detectados se marcan con `source: "dsh"`, las claves resueltas se quedan en memoria (nunca en `config.json`) y la ruta `/_xlate/dsh-scan` los relee cuando hace falta
- **Mitad host** (`lib/index.js`): adaptadores de proveedor, caché LRU (600), `/_xlate/models`, `/_xlate/model/pull` + `pull-status` (configura automáticamente al terminar)
- **Mitad cliente** (`lib/client.js`): UI en 8 idiomas, traducción por lotes, filas Think en streaming, persistencia en localStorage
- Capa de visualización pura: los originales permanecen en la transcripción y el contexto del modelo

## 🛠 Desarrollo

- Sin paso de compilación: `lib/client.js` es el bundle del navegador (fuente = artefacto); `lib/index.js` es el ESM del host
- Cambios en el cliente se aplican al refrescar; cambios en el host requieren reiniciar web
- Las cadenas de 8 idiomas viven en el diccionario `UI_TEXT` de `lib/client.js`

## 📄 Licencia

MIT
