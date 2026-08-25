# 🐋 dsh-think-translate

**Idiomas:** [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

---

Traducción en la capa de visualización para la interfaz web de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): la **cadena de pensamiento (fila Think), las tarjetas de tareas y el texto de respuesta** se muestran en el idioma de destino elegido, mientras los originales permanecen intactos en la transcripción.

[![npm version](https://img.shields.io/npm/v/dsh-think-translate?color=4D6BFE&label=npm)](https://www.npmjs.com/package/dsh-think-translate)
[![license](https://img.shields.io/npm/l/dsh-think-translate?color=4D6BFE)](LICENSE)
[![dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

## ✨ Características

- **8 idiomas de destino** — 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Русский
- **Interfaz en un solo idioma** — panel de ajustes, filas de pensamiento y tarjetas de tareas siguen el idioma de destino (sin mezclar zh/en); la elección persiste
- **Modelo local primero** — usa tu modelo local de Ollama (qwen, etc.): privado, sin conexión, gratis. La primera selección **activa la descarga automática** con barra de progreso; el modelo se configura y habilita al terminar
- **Respaldo Google / Bing** — cambio automático si el modelo local no está disponible (google usa un túnel CONNECT de Node con el proxy del sistema)
- **Artefactos de código omitidos** — rutas, comandos, URL, regex y líneas de código puro nunca se traducen
- **Traducción por lotes de frases** — las cadenas largas se traducen en lotes pequeños para mantener la calidad en modelos locales pequeños
- **Salida en streaming** — las traducciones aparecen lote a lote mientras piensa; expande la fila Think para comparar con el original
- **Resistente** — reintentos con backoff (3×), respaldo directo del navegador, los fallos nunca se cachean

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

## 🚀 Uso

1. Abre **Ajustes → Traducción de cadena de pensamiento**
2. Elige el **idioma de destino** (p. ej. Español) — el panel, las filas y las tarjetas cambian a ese idioma
3. Elige el **proveedor preferido**:
   - **Modelo local (Ollama)** — al elegirlo por primera vez aparece el botón de descarga (qwen2.5:7b / 14b o personalizado); se habilita solo al terminar. El botón "+" junto al selector descarga más modelos
   - **google gtx / bing** — funciona directamente (proxy del sistema / VPN automáticos)
4. Envía un mensaje y expande la fila Think para ver la traducción

## ⚙️ Cómo funciona

```
navegador → POST /_xlate/translate (mismo origen, sin CORS)
  → cadena de proveedores host (fail-open):
      compatible con OpenAI (Ollama local, Node fetch al loopback)
      → google gtx (Node https + túnel CONNECT por el proxy del sistema)
      → bing (curl form)
  → respaldo directo del navegador
```

- **Mitad host** (`lib/index.js`): adaptadores de proveedor, caché LRU (600), `/_xlate/models`, `/_xlate/model/pull` + `pull-status` (configura automáticamente al terminar)
- **Mitad cliente** (`lib/client.js`): UI en 8 idiomas, traducción por lotes, filas Think en streaming, persistencia en localStorage
- Capa de visualización pura: los originales permanecen en la transcripción y el contexto del modelo

## 🛠 Desarrollo

- Sin paso de compilación: `lib/client.js` es el bundle del navegador (fuente = artefacto); `lib/index.js` es el ESM del host
- Cambios en el cliente se aplican al refrescar; cambios en el host requieren reiniciar web
- Las cadenas de 8 idiomas viven en el diccionario `UI_TEXT` de `lib/client.js`

## 📄 Licencia

MIT
