window.__ModuleLoader__.load({
	id: "dsh-think-translate",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var react = require("react");
		var React = react.default !== undefined ? react.default : react;
		// Official Markdown renderer (loaded via the client module graph, declared
		// in dsh.client.external). Using it keeps official formatting — code-block
		// copy, syntax highlighting, tables, footnotes, file mentions — while this
		// plugin only supplies translated text. Falls back to the local Markdownish
		// if the dependency is unavailable.
		var primitives = null;
		try { primitives = require("@deepseek-ai/dsh-client-ui-primitives"); } catch (e) { primitives = null; }
		var MarkdownText = primitives && primitives.MarkdownText ? primitives.MarkdownText : null;
		var createElement = function (type, props) {
			var children = [];
			for (var i = 2; i < arguments.length; i++) children.push(arguments[i]);
			return React.createElement.apply(React, [type, props].concat(children));
		};
		var Fragment = React.Fragment;
		var useState = React.useState;
		var useEffect = React.useEffect;
		var Component = React.Component;

		// ------------------------------------------------------------------
		// stylesheet (data-plugin-css pattern, same as shipped client bundles)
		// ------------------------------------------------------------------
		var CSS_TEXT = [
			".xl-think{margin:2px 0}",
			".xl-think-row{display:flex;align-items:baseline;gap:6px;width:100%;background:none;border:0;padding:2px 0;cursor:pointer;font:inherit;color:inherit;text-align:left}",
			".xl-chev{font-size:9px;opacity:.55;transition:transform .12s}",
			".xl-chev[data-open]{transform:rotate(90deg)}",
			".xl-think-title{font-size:12px;font-weight:600;opacity:.75;white-space:nowrap}",
			".xl-sep{flex:0 0 14px;height:1px;background:currentColor;opacity:.18;align-self:center}",
			".xl-think-summary{font-size:12px;opacity:.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:64ch}",
			".xl-think-body{margin:4px 0 6px 14px;padding:6px 10px;border-left:2px solid rgba(127,127,127,.35);font-size:12.5px;line-height:1.6;opacity:.85;white-space:pre-wrap;word-break:break-word}",
			".xl-trans{padding:4px 0}",
			".xl-orig{margin-top:4px;opacity:.75}",
			".xl-orig summary{cursor:pointer;font-size:11px;opacity:.6}",
			".xl-orig-text{margin-top:2px;opacity:.8}",
			".xl-warn{font-size:10px;color:#c0392b;opacity:.8}",
			".xl-md{font-size:14px;line-height:1.65}",
			".xl-md .xl-p{margin:6px 0;white-space:pre-wrap;word-break:break-word}",
			".xl-md .xl-h{margin:10px 0 4px;font-weight:600}",
			".xl-md .xl-pre{background:rgba(127,127,127,.12);border-radius:6px;padding:8px 10px;overflow:auto;font-size:12.5px}",
			".xl-md .xl-code{background:rgba(127,127,127,.15);border-radius:4px;padding:0 4px;font-size:.92em}",
			".xl-md .xl-bq{border-left:3px solid rgba(127,127,127,.35);margin:6px 0;padding:2px 10px;opacity:.85}",
			".xl-md .xl-ul,.xl-md .xl-ol{margin:6px 0;padding-left:22px}",
			".xl-md .xl-link{color:#4c9aff;text-decoration:none}",
			".xl-trans-after{margin:2px 0 8px;padding:4px 10px;border-left:2px solid rgba(76,154,255,.45);font-size:13.5px;opacity:.9}",
			".xl-todo{margin:2px 0}",
			".xl-row{display:flex;align-items:center;gap:8px;width:100%;background:none;border:0;padding:3px 0;cursor:pointer;font:inherit;color:inherit;text-align:left}",
			".xl-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:rgba(127,127,127,.5)}",
			".xl-dot-ok{background:#3fa45b}",
			".xl-title{font-size:12.5px;font-weight:600;opacity:.8;white-space:nowrap}",
			".xl-summary{font-size:12.5px;opacity:.65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".xl-suffix{font-size:11px;opacity:.6}",
			".xl-items{margin:4px 0 6px 16px;display:flex;flex-direction:column;gap:3px}",
			".xl-item{display:flex;gap:8px;font-size:12.5px;line-height:1.5;align-items:baseline}",
			".xl-glyph{flex:0 0 auto;opacity:.7}",
			".xl-item-text{opacity:.85;word-break:break-word}",
			".xl-panel{display:flex;flex-direction:column;gap:10px;font-size:13px}",
			".xl-panel label{display:flex;gap:10px;align-items:center;min-height:28px}",
			".xl-panel label > span:first-child{flex:0 0 112px;font-size:12.5px;opacity:.85}",
			".xl-panel input[type=checkbox]{accent-color:var(--dsw-alias-brand-primary,#4c9aff);width:14px;height:14px;cursor:pointer}",
			".xl-note{font-size:11.5px;opacity:.6;line-height:1.5}",
			".xl-err{font-size:12px;color:var(--dsw-alias-state-error-primary,#c0392b);opacity:.9}",
			".xl-inspect{margin-left:auto;border:0;background:none;color:inherit;opacity:.45;cursor:pointer;font-size:11px}",
			".xl-kv{display:flex;gap:8px;font-size:12px}",
			".xl-kv b{opacity:.55;font-weight:500;flex:0 0 auto}",
			".xl-sel{font-size:12.5px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.35));border-radius:6px;padding:4px 8px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));color:var(--dsw-alias-label-primary,inherit);cursor:pointer;outline:none;transition:border-color .12s}",
			".xl-sel:hover{border-color:var(--dsw-alias-border-l2,rgba(127,127,127,.6))}",
			".xl-sel:focus{box-shadow:0 0 0 2px rgba(76,154,255,.28)}",
			".xl-sel option{background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base,#fff));color:var(--dsw-alias-label-primary,#000)}",
			".xl-btn{border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.45));background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,inherit);font-size:11.5px;border-radius:6px;padding:4px 12px;cursor:pointer;transition:background .12s,border-color .12s}",
			".xl-btn:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12));border-color:var(--dsw-alias-border-l2,rgba(127,127,127,.7))}",
			".xl-hr{border:0;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));margin:2px 0}",
			".xl-cfg{width:100%;box-sizing:border-box;font-family:monospace;font-size:11px;line-height:1.5;padding:8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.35));background:var(--dsw-alias-bg-base,rgba(127,127,127,.08));color:var(--dsw-alias-label-primary,inherit);outline:none}",
			".xl-cfg:focus{border-color:var(--dsw-alias-border-l2,rgba(127,127,127,.6));box-shadow:0 0 0 2px rgba(76,154,255,.2)}",
			".xl-progress{height:6px;border-radius:3px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.15));overflow:hidden;margin:4px 0}",
			".xl-progress-bar{height:100%;background:var(--dsw-alias-brand-primary,#4c9aff);border-radius:3px;transition:width .4s}",
			".xl-table-wrap{overflow-x:auto;margin:6px 0}",
			".xl-table{border-collapse:collapse;min-width:100%;font-size:13px;line-height:1.5}",
			".xl-table th,.xl-table td{border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.35));padding:6px 10px;text-align:left;vertical-align:top}",
			".xl-table th{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));font-weight:600}",
			".xl-table code{font-family:var(--dsw-font-mono,monospace);font-size:12px}"
		].join("\n");
		if (typeof document !== "undefined" && document.querySelector('style[data-plugin-css="dsh-think-translate/styles.css"]') === null) {
			var tag = document.createElement("style");
			tag.dataset.plugin = "dsh-think-translate";
			tag.dataset.pluginCss = "dsh-think-translate/styles.css";
			tag.textContent = CSS_TEXT;
			document.head.appendChild(tag);
		}

		// ------------------------------------------------------------------
		// settings store (persisted to localStorage; refreshes keep the choice)
		// ------------------------------------------------------------------
		function loadPref(k, d) {
			try {
				var v = localStorage.getItem("dsh-think-translate:" + k);
				return v === null ? d : v;
			} catch (e) { return d; }
		}
		function savePref(k, v) {
			try { localStorage.setItem("dsh-think-translate:" + k, String(v)); } catch (e) {}
		}
		var store = {
			lang: loadPref("lang", "zh-CN"), think: loadPref("think", "true") !== "false",
			todo: loadPref("todo", "true") !== "false", ans: loadPref("ans", "false") === "true",
			listeners: new Set(),
			set: function (patch) {
				var changed = false;
				for (var k in patch) { if (store[k] !== patch[k]) { store[k] = patch[k]; changed = true; } }
				if (changed) {
					for (var k2 in patch) savePref(k2, store[k2]);
					store.listeners.forEach(function (f) { f(); });
				}
			},
			subscribe: function (f) { store.listeners.add(f); return function () { store.listeners.delete(f); }; }
		};
		function useStore() {
			var pair = useState(0);
			useEffect(function () {
				return store.subscribe(function () { pair[1](function (n) { return n + 1; }); });
			}, []);
			return store;
		}
		var LANGS = [["zh-CN", "中文"], ["en", "English"], ["ja", "日本語"], ["ko", "한국어"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"], ["ru", "Русский"]];
		// Settings UI strings, keyed by target language (follows store.lang).
		var UI_TEXT = {
			"zh-CN": {
				targetLang: "目标语言", think: "翻译思考链（Think 行）", todo: "翻译任务卡片条目", ans: "翻译回答正文（追加译文）",
				sectionTitle: "思考链翻译", thinking: "思考中", thinkTitle: "思考", original: "原文", transFail: "翻译失败·原文",
				tasks: "任务", taskList: "任务清单", doneFmt: "{d} 已完成 · {t} 项", stopped: "已停止",
				noLocalModel: "本地模型未安装", downloadModel: "下载模型", downloading: "下载中", verifying: "校验中", pullDone: "已安装并启用", pullError: "下载失败",
				installPrompt: "首次使用本地模型：选择后自动下载并启用（需 Ollama 正在运行）。", recommended: "推荐", otherModel: "其他模型", startDownload: "开始下载",
				provider: "首选提供方", model: "模型", loadingModels: "加载模型…", noModels: "无可用模型",
				testConn: "测试连接", testing: "测试中…", connOk: "连通", connFail: "链路失败（将回退浏览器直连）",
				clearCache: "清空缓存", status: "成功/失败", providerOf: "提供方", cacheEntries: "缓存条目", lastError: "最近错误",
				providerUnavailable: "翻译服务未加载：插件的 host 半边未生效（常见于刚改过配置或更新后）。请重启 Web 再试——重启后翻译与设置将恢复正常。",
				providerDesc: "Google / Bing / 本地模型（自动选择）",
				labels: { google: "google gtx（免费）", bing: "bing（免费）", openai: "本地部署模型（Ollama）" },
				copy: "复制", copied: "已复制",
				note: "界面翻译：思考链、任务卡片、回答正文会显示为你选的语言，原文保留在会话记录中可随时对照。优先使用本地模型，其次 Google/Bing；文件路径、代码等自动跳过。",
			},
			"en": {
				targetLang: "Target language", think: "Translate thinking chain", todo: "Translate task card items", ans: "Translate answer text (append translation)",
				sectionTitle: "Think Translation", thinking: "Thinking", thinkTitle: "Think", original: "Original", transFail: "untranslated",
				tasks: "Tasks", taskList: "Tasks", doneFmt: "{d}/{t} done", stopped: "stopped",
				noLocalModel: "No local model installed", downloadModel: "Download model", downloading: "Downloading", verifying: "Verifying", pullDone: "Installed and enabled", pullError: "Download failed",
				installPrompt: "First time with a local model: picking one downloads and enables it automatically (Ollama must be running).", recommended: "Recommended", otherModel: "Other model", startDownload: "Start download",
				provider: "Preferred provider", model: "Model", loadingModels: "Loading models…", noModels: "No models available",
				testConn: "Test connection", testing: "Testing…", connOk: "Connected", connFail: "Chain failed (will fall back)",
				clearCache: "Clear cache", status: "ok / fail", providerOf: "provider", cacheEntries: "cache entries", lastError: "last error",
				providerUnavailable: "Translation service not loaded: the plugin host half is inactive (common after config changes or updates). Restart the web app to restore translation and settings.",
				providerDesc: "Google / Bing / local model (auto)",
				labels: { google: "google gtx (free)", bing: "bing (free)", openai: "Local model (Ollama)" },
				copy: "Copy", copied: "Copied",
				note: "UI translation: the thinking chain, task cards and answer text display in your chosen language; originals stay in the transcript for comparison. Local model first, then Google/Bing; file paths and code are skipped.",
			},
			"ja": {
				targetLang: "対象言語", think: "思考チェーンを翻訳（Think 行）", todo: "タスクカード項目を翻訳", ans: "回答本文を翻訳（訳文を追加）",
				sectionTitle: "思考チェーン翻訳", thinking: "思考中", thinkTitle: "思考", original: "原文", transFail: "翻訳失敗・原文",
				tasks: "タスク", taskList: "タスク一覧", doneFmt: "{d} 完了 · 全{t}件", stopped: "停止済み",
				noLocalModel: "ローカルモデル未インストール", downloadModel: "モデルをダウンロード", downloading: "ダウンロード中", verifying: "検証中", pullDone: "インストール済み・有効", pullError: "ダウンロード失敗",
				installPrompt: "初めてのローカルモデル：選択すると自動ダウンロードして有効化します（Ollama の起動が必要）。", recommended: "おすすめ", otherModel: "他のモデル", startDownload: "ダウンロード開始",
				provider: "優先プロバイダー", model: "モデル", loadingModels: "モデル読込中…", noModels: "利用可能なモデルなし",
				testConn: "接続テスト", testing: "テスト中…", connOk: "接続OK", connFail: "リンク失敗（フォールバック）",
				clearCache: "キャッシュをクリア", status: "成功/失敗", providerOf: "提供元", cacheEntries: "キャッシュ件数", lastError: "最近のエラー",
				providerUnavailable: "翻訳サービスが読み込まれていません：プラグインのホスト側が無効です（設定変更やアップデート後に発生しがち）。Web を再起動すると翻訳と設定が復旧します。",
				providerDesc: "Google / Bing / ローカルモデル（自動）",
				labels: { google: "google gtx（無料）", bing: "bing（無料）", openai: "ローカルモデル（Ollama）" },
				note: "UI 翻訳：思考チェーン・タスクカード・回答本文が選んだ言語で表示されます。原文は会話履歴に残り、いつでも比較できます。優先はローカルモデル、次に Google/Bing。ファイルパスやコードは自動的にスキップされます。",
			},
			"ko": {
				targetLang: "대상 언어", think: "사고 체인 번역（Think 행）", todo: "작업 카드 항목 번역", ans: "답변 본문 번역（번역 추가）",
				sectionTitle: "사고 체인 번역", thinking: "생각 중", thinkTitle: "생각", original: "원문", transFail: "번역 실패·원문",
				tasks: "작업", taskList: "작업 목록", doneFmt: "{d}/{t} 완료", stopped: "중지됨",
				noLocalModel: "로컬 모델 미설치", downloadModel: "모델 다운로드", downloading: "다운로드 중", verifying: "검증 중", pullDone: "설치 완료·활성화", pullError: "다운로드 실패",
				installPrompt: "첫 로컬 모델: 선택하면 자동 다운로드 후 활성화됩니다(Ollama 실행 필요).", recommended: "권장", otherModel: "기타 모델", startDownload: "다운로드 시작",
				provider: "기본 제공자", model: "모델", loadingModels: "모델 로딩 중…", noModels: "사용 가능한 모델 없음",
				testConn: "연결 테스트", testing: "테스트 중…", connOk: "연결됨", connFail: "체인 실패（폴백）",
				clearCache: "캐시 지우기", status: "성공/실패", providerOf: "제공자", cacheEntries: "캐시 항목", lastError: "최근 오류",
				providerUnavailable: "번역 서비스가 로드되지 않았습니다: 플러그인 호스트 측이 비활성 상태입니다(설정 변경이나 업데이트 후 흔함). 웹을 재시작하면 번역과 설정이 복구됩니다.",
				providerDesc: "Google / Bing / 로컬 모델（자동）",
				labels: { google: "google gtx（무료）", bing: "bing（무료）", openai: "로컬 모델（Ollama）" },
				note: "UI 번역: 사고 체인, 작업 카드, 답변 본문이 선택한 언어로 표시됩니다. 원문은 대화 기록에 남아 언제든 비교할 수 있습니다. 우선 로컬 모델, 다음 Google/Bing. 파일 경로와 코드는 자동으로 건너뜁니다.",
			},
			"es": {
				targetLang: "Idioma de destino", think: "Traducir cadena de pensamiento", todo: "Traducir elementos de tarjeta de tareas", ans: "Traducir texto de respuesta",
				sectionTitle: "Traducción de cadena de pensamiento", thinking: "Pensando…", thinkTitle: "Pensar", original: "Original", transFail: "Error de traducción",
				tasks: "Tareas", taskList: "Lista de tareas", doneFmt: "{d}/{t} completado", stopped: "detenido",
				noLocalModel: "Sin modelo local instalado", downloadModel: "Descargar modelo", downloading: "Descargando", verifying: "Verificando", pullDone: "Instalado y activado", pullError: "Error de descarga",
				installPrompt: "Primer uso: al elegir se descarga y activa automáticamente (Ollama debe estar en ejecución).", recommended: "Recomendado", otherModel: "Otro modelo", startDownload: "Iniciar descarga",
				provider: "Proveedor preferido", model: "Modelo", loadingModels: "Cargando modelos…", noModels: "Sin modelos disponibles",
				testConn: "Probar conexión", testing: "Probando…", connOk: "Conectado", connFail: "Fallo de cadena (usará respaldo)",
				clearCache: "Limpiar caché", status: "éxito / fallo", providerOf: "proveedor", cacheEntries: "entradas de caché", lastError: "último error",
				providerUnavailable: "Servicio de traducción no cargado: la mitad host del plugin está inactiva (común tras cambios de configuración o actualizaciones). Reinicie la web para restaurar la traducción y los ajustes.",
				providerDesc: "Google / Bing / modelo local (automático)",
				labels: { google: "google gtx (gratis)", bing: "bing (gratis)", openai: "Modelo local (Ollama)" },
				note: "Traducción de la interfaz: la cadena de pensamiento, las tarjetas de tareas y el texto de respuesta se muestran en el idioma elegido; el original permanece en el historial. Modelo local primero, luego Google/Bing; rutas y código se omiten.",
			},
			"fr": {
				targetLang: "Langue cible", think: "Traduire la chaîne de réflexion", todo: "Traduire les éléments de carte de tâches", ans: "Traduire le texte de réponse",
				sectionTitle: "Traduction de chaîne de réflexion", thinking: "Réflexion…", thinkTitle: "Réflexion", original: "Original", transFail: "Échec de traduction",
				tasks: "Tâches", taskList: "Liste des tâches", doneFmt: "{d}/{t} terminé", stopped: "arrêté",
				noLocalModel: "Aucun modèle local installé", downloadModel: "Télécharger le modèle", downloading: "Téléchargement…", verifying: "Vérification…", pullDone: "Installé et activé", pullError: "Échec du téléchargement",
				installPrompt: "Première utilisation : le choix télécharge et active automatiquement (Ollama doit tourner).", recommended: "Recommandé", otherModel: "Autre modèle", startDownload: "Démarrer le téléchargement",
				provider: "Fournisseur préféré", model: "Modèle", loadingModels: "Chargement des modèles…", noModels: "Aucun modèle disponible",
				testConn: "Tester la connexion", testing: "Test en cours…", connOk: "Connecté", connFail: "Échec de chaîne (repli)",
				clearCache: "Vider le cache", status: "ok / échec", providerOf: "fournisseur", cacheEntries: "entrées de cache", lastError: "dernière erreur",
				providerUnavailable: "Service de traduction non chargé : la partie hôte du plugin est inactive (fréquent après des changements de config ou des mises à jour). Redémarrez la web pour restaurer la traduction et les réglages.",
				providerDesc: "Google / Bing / modèle local (auto)",
				labels: { google: "google gtx (gratuit)", bing: "bing (gratuit)", openai: "Modèle local (Ollama)" },
				note: "Traduction de l'interface : la chaîne de réflexion, les cartes de tâches et le texte de réponse s'affichent dans la langue choisie ; l'original reste dans l'historique. Modèle local d'abord, puis Google/Bing ; chemins et code ignorés.",
			},
			"de": {
				targetLang: "Zielsprache", think: "Gedankenkette übersetzen", todo: "Aufgabenkartenelemente übersetzen", ans: "Antworttext übersetzen",
				sectionTitle: "Übersetzung der Gedankenkette", thinking: "Denkt…", thinkTitle: "Denken", original: "Original", transFail: "Übersetzung fehlgeschlagen",
				tasks: "Aufgaben", taskList: "Aufgabenliste", doneFmt: "{d}/{t} erledigt", stopped: "gestoppt",
				noLocalModel: "Kein lokales Modell installiert", downloadModel: "Modell herunterladen", downloading: "Lade herunter…", verifying: "Prüfe…", pullDone: "Installiert und aktiviert", pullError: "Download fehlgeschlagen",
				installPrompt: "Erstnutzung: Auswahl lädt automatisch herunter und aktiviert (Ollama muss laufen).", recommended: "Empfohlen", otherModel: "Anderes Modell", startDownload: "Download starten",
				provider: "Bevorzugter Anbieter", model: "Modell", loadingModels: "Modelle laden…", noModels: "Keine Modelle verfügbar",
				testConn: "Verbindung testen", testing: "Teste…", connOk: "Verbunden", connFail: "Kette fehlgeschlagen (Fallback)",
				clearCache: "Cache leeren", status: "ok / fehlgeschlagen", providerOf: "Anbieter", cacheEntries: "Cache-Einträge", lastError: "letzter Fehler",
				providerUnavailable: "Übersetzungsdienst nicht geladen: Die Host-Seite des Plugins ist inaktiv (häufig nach Konfigurationsänderungen oder Updates). Starten Sie die Web-App neu, um Übersetzung und Einstellungen wiederherzustellen.",
				providerDesc: "Google / Bing / lokales Modell (automatisch)",
				labels: { google: "google gtx (kostenlos)", bing: "bing (kostenlos)", openai: "Lokales Modell (Ollama)" },
				note: "UI-Übersetzung: Gedankenkette, Aufgabenkarten und Antworttext erscheinen in der gewählten Sprache; das Original bleibt im Verlauf. Erst lokales Modell, dann Google/Bing; Pfade und Code werden übersprungen.",
			},
			"ru": {
				targetLang: "Целевой язык", think: "Переводить цепочку размышлений", todo: "Переводить элементы карточек задач", ans: "Переводить текст ответа",
				sectionTitle: "Перевод цепочки размышлений", thinking: "Размышление…", thinkTitle: "Размышление", original: "Оригинал", transFail: "Ошибка перевода",
				tasks: "Задачи", taskList: "Список задач", doneFmt: "{d}/{t} выполнено", stopped: "остановлено",
				noLocalModel: "Локальная модель не установлена", downloadModel: "Скачать модель", downloading: "Загрузка…", verifying: "Проверка…", pullDone: "Установлено и включено", pullError: "Ошибка загрузки",
				installPrompt: "Первое использование: выбор автоматически скачает и включит (Ollama должен работать).", recommended: "Рекомендуется", otherModel: "Другая модель", startDownload: "Начать загрузку",
				provider: "Предпочтительный провайдер", model: "Модель", loadingModels: "Загрузка моделей…", noModels: "Нет доступных моделей",
				testConn: "Проверить соединение", testing: "Проверка…", connOk: "Подключено", connFail: "Сбой цепочки (запасной вариант)",
				clearCache: "Очистить кэш", status: "ок / сбой", providerOf: "провайдер", cacheEntries: "записи кэша", lastError: "последняя ошибка",
				providerUnavailable: "Сервис перевода не загружен: host-часть плагина неактивна (часто после изменения конфигурации или обновления). Перезапустите web, чтобы восстановить перевод и настройки.",
				providerDesc: "Google / Bing / локальная модель (авто)",
				labels: { google: "google gtx (бесплатно)", bing: "bing (бесплатно)", openai: "Локальная модель (Ollama)" },
				note: "Перевод интерфейса: цепочка размышлений, карточки задач и текст ответа отображаются на выбранном языке; оригинал остаётся в истории. Сначала локальная модель, затем Google/Bing; пути и код пропускаются.",
			},
		};

		// ------------------------------------------------------------------
		// translation pipeline (browser-side Google gtx; browser applies the
		// system proxy automatically; endpoint returns CORS *)
		// ------------------------------------------------------------------
		var mem = new Map();
		// Translation cache persisted to localStorage so switching sessions or
		// refreshing a page reuses prior results instead of re-translating every
		// historical message (which wedged the UI when the local model was slow,
		// 2026-08-26). In-memory map is the fast path; localStorage is the
		// durable cross-session floor.
		var MEM_KEY = "dsh-xlate-cache:";
		function cacheMemGet(key) {
			var v = mem.get(key);
			if (v !== undefined) return v;
			try {
				var lv = localStorage.getItem(MEM_KEY + key);
				if (lv !== null) {
					var parsed = JSON.parse(lv);
					if (parsed && parsed.ok) { mem.set(key, parsed); return parsed; }
				}
			} catch (e) {}
			return undefined;
		}
		function cacheMemSet(key, entry) {
			mem.set(key, entry);
			if (mem.size > 800) mem.delete(mem.keys().next().value);
			try { localStorage.setItem(MEM_KEY + key, JSON.stringify(entry)); } catch (e) {}
		}
		var pend = new Map();
		var stats = { ok: 0, fail: 0, lastError: null, lastProvider: null, lastModel: null };
		// Diagnostic ledger surfaced in the settings panel (2026-08-24): bundle
		// version, apply execution, per-slot registration outcome, current lang.
		var diag = { version: "v3-priority-1", applied: false, lang: "?", slots: {}, lastLangChange: 0 };

		function fnv(s) {
			var h = 0x811c9dc5;
			for (var i = 0; i < s.length; i++) {
				h ^= s.charCodeAt(i);
				h = Math.imul(h, 0x01000193) >>> 0;
			}
			return h.toString(36) + "." + s.length.toString(36);
		}

		function isCjk(code) {
			return (code >= 0x3400 && code <= 0x4dbf) || (code >= 0x4e00 && code <= 0x9fff)
				|| (code >= 0xf900 && code <= 0xfaff) || (code >= 0x20000 && code <= 0x2ffff)
				|| (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef)
				|| (code >= 0x3040 && code <= 0x30ff) || (code >= 0x31f0 && code <= 0x31ff);
		}
		function isLatin(code) { return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a); }
		function cjkRatio(text) {
			var c = 0, l = 0;
			for (var i = 0; i < text.length; i++) {
				var code = text.codePointAt(i);
				if (code === undefined) continue;
				if (isCjk(code)) c++;
				else if (isLatin(code)) l++;
				else if (code > 0xffff) i++;
			}
			var total = c + l;
			return total === 0 ? 0 : c / total;
		}
		function isCodeOnlyLine(line) {
			return /^(?:[$>#]\s*)?(?:(?:npm|pnpm|yarn|bun|npx|node|git|cd|curl|pwsh|reg)\b|(?:const|let|var|import|export|function|class|return|if|for|while|async|await)\b|[\[{(]|['"]?[\w.-]+['"]?\s*(?:[:=]|=>)|[\w$.]+\s*\(|(?:[~./][\w@~./-]*|[\w.-]+\/[\w@~./-]+)(?::\d+)?$)/.test(line);
		}
		function hasProse(text) {
			var outside = text
				.replace(/```[\s\S]*?```/g, " ")
				.replace(/`[^`\n]*`/g, " ")
				.replace(/https?:\/\/\S+/g, " ");
			var lines = outside.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
			if (lines.length === 0) return false;
			var hasLetters = false;
			for (var i = 0; i < outside.length; i++) {
				var code = outside.codePointAt(i);
				if (code === undefined) continue;
				if (isLatin(code) || (code >= 0x3400 && code <= 0x9fff)) { hasLetters = true; break; }
				if (code > 0xffff) i++;
			}
			if (!hasLetters) return false;
			for (var j = 0; j < lines.length; j++) if (!isCodeOnlyLine(lines[j])) return true;
			return false;
		}
		function needsTranslate(text, target) {
			if (!text || !text.trim()) return false;
			if (!hasProse(text)) return false;
			if (target.indexOf("zh") === 0 && cjkRatio(text) >= 0.3) return false;
			return true;
		}
		function chunkText(text) {
			if (text.length <= 1200) return [text];
			var sentences = text.match(/[\s\S]*?[.。！？!?;\n]|[\s\S]+$/g) || [text];
			var chunks = [], cur = "";
			for (var i = 0; i < sentences.length; i++) {
				var sn = sentences[i];
				if (cur && cur.length + sn.length > 1200) { chunks.push(cur); cur = ""; }
				if (sn.length > 1200) {
					for (var k = 0; k < sn.length; k += 1100) chunks.push(sn.slice(k, k + 1100));
					cur = "";
				} else {
					cur += sn;
				}
			}
			if (cur.trim()) chunks.push(cur);
			return chunks.length ? chunks : [text];
		}

		async function gtxChunk(text, target) {
			var url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl="
				+ encodeURIComponent(target) + "&dt=t&q=" + encodeURIComponent(text);
			// Bounded wait: when direct google is unreachable this must fail fast
			// instead of hanging on the browser's own timeout (2026-08-22: direct
			// gtx blocked in this network stalled every fallback for ~8s+).
			var res = await fetchWithTimeout(url, null, 6000);
			if (!res.ok) throw new Error("gtx HTTP " + res.status);
			var arr = await res.json();
			var segs = arr && arr[0];
			if (!Array.isArray(segs)) throw new Error("gtx unexpected shape");
			var out = "";
			for (var i = 0; i < segs.length; i++) {
				if (Array.isArray(segs[i]) && typeof segs[i][0] === "string") out += segs[i][0];
			}
			if (!out.trim()) throw new Error("gtx empty translation");
			return out;
		}

		function sleepMs(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

		function fetchWithTimeout(url, opts, ms) {
			var ctrl = typeof AbortController === "function" ? new AbortController() : null;
			var o = opts ? Object.assign({}, opts) : {};
			var timer = null;
			if (ctrl) {
				o.signal = ctrl.signal;
				timer = setTimeout(function () { ctrl.abort(); }, ms);
			}
			return fetch(url, o).then(
				function (res) { if (timer !== null) clearTimeout(timer); return res; },
				function (err) { if (timer !== null) clearTimeout(timer); throw err; }
			);
		}

		async function hostAttempt(text, target) {
			var res = await fetchWithTimeout("/_xlate/translate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: text, target: target })
			}, 30000);
			if (!res.ok) throw new Error("route HTTP " + res.status);
			var j = await res.json();
			if (!(j && j.ok)) throw new Error("route ok=false");
			return j;
		}

		function requestTranslate(text, target) {
			var key = target + "|" + fnv(text);
			var hit = cacheMemGet(key);
			if (hit !== undefined) return Promise.resolve(hit);
			var busy = pend.get(key);
			if (busy !== undefined) return busy;
			var p = (async function () {
				try {
					if (!needsTranslate(text, target)) {
						var skipped = { ok: true, text: text, skipped: true };
						memSet(key, skipped);
						return skipped;
					}
					// Host chain with bounded retries: a single transient google/proxy
					// blip must not flip the row into its permanent failed state
					// (2026-08-22: one blip used to kill translation for the whole block).
					var r = null, lastErr = null;
					var backoff = [0, 400, 1500];
					for (var i = 0; i < backoff.length; i++) {
						if (backoff[i] > 0) await sleepMs(backoff[i]);
						try { r = await hostAttempt(text, target); break; }
						catch (e) { r = null; lastErr = e; }
					}
					if (!(r && r.ok)) {
						try {
							var chunks = chunkText(text);
							var outs = [];
							for (var k = 0; k < chunks.length; k++) outs.push(await gtxChunk(chunks[k], target));
							r = { ok: true, text: outs.join(""), provider: "google-direct" };
						} catch (e2) { r = null; if (e2 && e2.message) lastErr = e2; }
					}
					if (r && r.ok) {
						stats.ok++; stats.lastError = null; stats.lastProvider = r.provider; stats.lastModel = r.model || null;
						memSet(key, r);
						return r;
					}
					throw (lastErr || new Error("translate unavailable"));
				} catch (e) {
					stats.fail++;
					stats.lastError = e instanceof Error ? e.message : String(e);
					return { ok: false, text: text, skipped: false };
				}
			})();
			pend.set(key, p);
			p.then(function () { pend.delete(key); }, function () { pend.delete(key); });
			return p;
		}
		function memSet(key, entry) {
			cacheMemSet(key, entry);
		}

		function useXlate(text, enabled) {
			var s = useStore();
			var active = !!(enabled && text && text.trim());
			var key = active ? s.lang + "|" + fnv(text) : null;
			var pair = useState(function () { return key !== null ? cacheMemGet(key) : undefined; });
			var entry = pair[0];
			var setEntry = pair[1];
			useEffect(function () {
				if (!active || key === null) { setEntry(undefined); return undefined; }
				var alive = true;
				var hit = cacheMemGet(key);
				if (hit !== undefined) { setEntry(hit); return undefined; }
				requestTranslate(text, s.lang).then(function (r) {
					if (!alive) return;
					setEntry(r);
					if (!(r && r.ok)) {
						// One delayed retry for answer text: failures are not cached, so
						// this re-issues a real request after the backoff window.
						setTimeout(function () {
							if (!alive) return;
							requestTranslate(text, s.lang).then(function (r2) { if (alive) setEntry(r2); });
						}, 3000);
					}
				});
				return function () { alive = false; };
			}, [key, active]);
			return entry;
		}

		// ------------------------------------------------------------------
		// components
		// ------------------------------------------------------------------
		class XBoundary extends Component {
			constructor(p) { super(p); this.state = { err: null }; }
			static getDerivedStateFromError(e) { return { err: e }; }
			render() {
				if (this.state.err) {
					return createElement("div", { className: "xl-err" }, "[xlate] " + String(this.state.err && this.state.err.message ? this.state.err.message : this.state.err));
				}
				return this.props.children;
			}
		}

		function firstLine(t) { var i = t.indexOf("\n"); return i === -1 ? t : t.slice(0, i); }
		function latestLine(t) { var v = t.trimEnd(); var i = v.lastIndexOf("\n"); return i === -1 ? v : v.slice(i + 1); }

		function splitSentences(text) {
			var re = /[^。！？!?;\n]*[。！？!?;\n]+|[^。！？!?;\n]+/g;
			var out = [], m;
			while ((m = re.exec(text)) !== null) {
				if (m[0].length === 0) { re.lastIndex++; continue; }
				out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
			}
			return out;
		}
		var XL_STREAM_MARGIN = 120;
		var XL_STREAM_MIN_BATCH = 24;
		function ThinkRow(props) {
			var text = props.text;
			var running = props.running;
			var s = useStore();
			var pairOpen = useState(false);
			var open = pairOpen[0], setOpen = pairOpen[1];
			var enabled = s.think;
			var lang = s.lang;
			var refPair = useState(function () { return { current: { segIdx: 0, transText: "", done: false, failed: false, busy: false } }; });
			var tRef = refPair[0];
			var tickPair = useState(0);
			var tick = tickPair[0], bump = tickPair[1];
			function mutate(fn) {
				tRef.current = fn(tRef.current);
				bump(function (n) { return n + 1; });
			}
			useEffect(function () {
				tRef.current = { segIdx: 0, transText: "", done: false, failed: false, busy: false, failCount: 0, retryAt: 0 };
				bump(function (n) { return n + 1; });
			}, [lang, enabled]);
			// Latest text/running via ref so the self-driven loop below never
			// re-runs on streaming text changes. The old per-effect approach
			// depended on [text, running, tick]: every mutate bumped tick, the
			// cleanup set alive=false, and the re-run saw busy=true and bailed
			// — the in-flight result was dropped and transLen stayed 0 forever
			// (2026-08-24 root cause: chain works, thinking rows never fill).
			var stateRef = useState(function () { return { current: {} }; })[0];
			stateRef.current = { text: text, running: running };
			useEffect(function () {
				if (!enabled) return undefined;
				var alive = true;
				(async function () {
					while (alive) {
						var cur = tRef.current;
						if (cur.failed || cur.done) return;
						if (cur.busy) { await sleepMs(150); continue; }
						if (cur.retryAt && Date.now() < cur.retryAt) { await sleepMs(300); continue; }
						var latest = stateRef.current.text;
						if (!latest || !latest.trim()) return;
						var isRunning = stateRef.current.running;
						var segs = splitSentences(latest);
						if (cur.segIdx >= segs.length) {
							mutate(function (p) { return Object.assign({}, p, { done: true }); });
							return;
						}
						// Streaming: only translate sentences before the live
						// tail margin. Settled: translate everything, in small
						// batches (local 7B models degrade on long blobs).
						var batch = "", count = 0, nextIdx = cur.segIdx;
						for (var i = cur.segIdx; i < segs.length; i++) {
							if (isRunning && segs[i].end > latest.length - XL_STREAM_MARGIN) break;
							batch += segs[i].text;
							nextIdx = i + 1;
							count++;
							if (batch.length >= 180) break;
						}
						if (count === 0 || (isRunning && batch.trim().length < XL_STREAM_MIN_BATCH)) {
							await sleepMs(200);
							continue;
						}
						mutate(function (p) { return Object.assign({}, p, { busy: true }); });
						var r = null;
						try { r = await requestTranslate(batch, lang); }
						catch (e) { r = null; }
						if (!alive) return;
						mutate(function (p) {
							var next = Object.assign({}, p, { busy: false });
							if (r && r.ok) {
								if (!r.skipped) next.transText = p.transText + r.text;
								next.segIdx = Math.max(p.segIdx, nextIdx);
							} else {
								var fc = (p.failCount || 0) + 1;
								if (fc >= 3) {
									next.failed = true;
								} else {
									next.failCount = fc;
									next.retryAt = Date.now() + 2500;
									setTimeout(function () {
										mutate(function (q) { return Object.assign({}, q, { retryAt: 0 }); });
									}, 2600);
								}
							}
							return next;
						});
					}
				})();
				return function () { alive = false; };
			}, [lang, enabled]);
			var t = tRef.current;
			var tt = UI_TEXT[s.lang] || UI_TEXT.en;
			var hasTr = !!(enabled && t.transText && !t.failed);
			var shown = hasTr ? t.transText : text;
			var summary = running ? latestLine(text) : firstLine(shown);
			return createElement("div", { className: "xl-think", "data-state": running ? "running" : "ok" },
				createElement("button", {
					className: "xl-think-row", type: "button",
					onClick: function () { setOpen(function (v) { return !v; }); }
				},
					createElement("span", { className: "xl-chev", "data-open": open || undefined }, "▶"),
					createElement("span", { className: "xl-think-title" }, running ? tt.thinking : tt.thinkTitle),
					createElement("span", { className: "xl-sep", "aria-hidden": true }),
					createElement("span", { className: "xl-think-summary" }, summary),
					t.failed ? createElement("span", { className: "xl-warn" }, tt.transFail) : null
				),
				open ? createElement("div", { className: "xl-think-body" },
					hasTr ? createElement("div", { className: "xl-trans" }, t.transText) : null,
					running || !hasTr
						? createElement("div", { className: "xl-orig-text" }, text)
						: createElement("details", { className: "xl-orig" },
							createElement("summary", null, tt.original),
							createElement("div", { className: "xl-orig-text" }, text)))
					: null);
		}

		function inlineNodes(s, kBase) {
			var out = [];
			var re = /(`[^`\n]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]\n]+\]\([^)\s]+\))/g;
			var last = 0, m, k = 0;
			while ((m = re.exec(s)) !== null) {
				if (m.index > last) out.push(s.slice(last, m.index));
				var tok = m[0];
				k++;
				var key = kBase + "i" + k;
				if (tok.charAt(0) === "`") out.push(createElement("code", { key: key, className: "xl-code" }, tok.slice(1, -1)));
				else if (tok.indexOf("**") === 0) out.push(createElement("strong", { key: key }, tok.slice(2, -2)));
				else if (tok.charAt(0) === "*") out.push(createElement("em", { key: key }, tok.slice(1, -1)));
				else {
					var cut = tok.indexOf("](");
					out.push(createElement("a", { key: key, className: "xl-link", href: tok.slice(cut + 2, -1), target: "_blank", rel: "noreferrer" }, tok.slice(1, cut)));
				}
				last = m.index + tok.length;
			}
			if (last < s.length) out.push(s.slice(last));
			return out;
		}
		function tableCells(line) {
			var s = line.trim();
			if (s.charAt(0) === "|") s = s.slice(1);
			if (s.charAt(s.length - 1) === "|") s = s.slice(0, -1);
			return s.split("|").map(function (c) { return c.trim(); });
		}
		function isDelimRow(line) {
			var s = line.trim();
			if (s.charAt(0) === "|") s = s.slice(1);
			if (s.charAt(s.length - 1) === "|") s = s.slice(0, -1);
			var parts = s.split("|");
			if (!parts.length) return false;
			for (var p = 0; p < parts.length; p++) { if (!/^[\s:-]*$/.test(parts[p])) return false; }
			return /-/.test(s);
		}
		function Markdownish(props) {
			var lines = props.text.split("\n");
			var blocks = [];
			var i = 0, pk = 0;
			function nk() { pk++; return "b" + pk; }
			while (i < lines.length) {
				var line = lines[i];
				if (line.trim() === "") { i++; continue; }
				if (/^\s*```/.test(line)) {
					var buf = [];
					i++;
					while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
					i++;
					blocks.push(createElement("pre", { key: nk(), className: "xl-pre" }, createElement("code", null, buf.join("\n"))));
					continue;
				}
				var h = line.match(/^(#{1,4})\s+(.*)$/);
				if (h) {
					blocks.push(createElement("div", { key: nk(), className: "xl-h" }, inlineNodes(h[2], nk())));
					i++;
					continue;
				}
				if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) { blocks.push(createElement("hr", { key: nk() })); i++; continue; }
				if (/^\s*>\s?/.test(line)) {
					var bq = [];
					while (i < lines.length && /^\s*>\s?/.test(lines[i])) { bq.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
					blocks.push(createElement("blockquote", { key: nk(), className: "xl-bq" }, inlineNodes(bq.join(" "), nk())));
					continue;
				}
				if (/^\s*[-*+]\s+/.test(line)) {
					var ulItems = [];
					while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { ulItems.push(lines[i].replace(/^\s*[-*+]\s+/, "")); i++; }
					blocks.push(createElement("ul", { key: nk(), className: "xl-ul" }, ulItems.map(function (it, n) {
						return createElement("li", { key: n }, inlineNodes(it, nk() + "l" + n));
					})));
					continue;
				}
				if (/^\s*\d+[.)]\s+/.test(line)) {
					var olItems = [];
					while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { olItems.push(lines[i].replace(/^\s*\d+[.)]\s+/, "")); i++; }
					blocks.push(createElement("ol", { key: nk(), className: "xl-ol" }, olItems.map(function (it, n) {
						return createElement("li", { key: n }, inlineNodes(it, nk() + "l" + n));
					})));
					continue;
				}
				if (/^\s*\|/.test(line) && i + 1 < lines.length && isDelimRow(lines[i + 1])) {
					var headCells = tableCells(line);
					i += 2;
					var bodyRows = [];
					while (i < lines.length && /^\s*\|/.test(lines[i])) { bodyRows.push(tableCells(lines[i])); i++; }
					var thead = createElement("thead", null, createElement("tr", null, headCells.map(function (c, n) {
						return createElement("th", { key: n }, inlineNodes(c, nk() + "h" + n));
					})));
					var tbody = bodyRows.map(function (r, n) {
						return createElement("tr", { key: n }, r.map(function (c, j) {
							return createElement("td", { key: j }, inlineNodes(c, nk() + "d" + n + "j" + j));
						}));
					});
					blocks.push(createElement("div", { key: nk(), className: "xl-table-wrap" },
						createElement("table", { className: "xl-table" }, thead, createElement("tbody", null, tbody))));
					continue;
				}
				var para = [line];
				i++;
				while (i < lines.length && lines[i].trim() !== "" && !/^\s*(?:```|#{1,4}\s|>|[-*+]\s|\d+[.)]\s)/.test(lines[i])) { para.push(lines[i]); i++; }
				blocks.push(createElement("p", { key: nk(), className: "xl-p" }, inlineNodes(para.join("\n"), nk())));
			}
			return createElement("div", { className: "xl-md" }, blocks);
		}
		function TextBlock(props) {
			var s = useStore();
			var tt = UI_TEXT[s.lang] || UI_TEXT.en;
			var tr = useXlate(props.text, s.ans && !props.streaming);
			var hasTr = !!(tr && tr.ok && !tr.skipped && tr.text !== props.text);
			// Official MarkdownText when available: keeps the full official
			// formatting (code copy, highlighting, tables...). Translated text
			// replaces the body when answer translation is on; original stays in
			// a collapsible details block.
			var codeLabels = MarkdownText ? { copyLabel: tt.copy, copiedLabel: tt.copied } : undefined;
			var MDT = MarkdownText || Markdownish;
			var body = hasTr ? tr.text : props.text;
			return createElement("div", null,
				createElement(MDT, MarkdownText
					? { text: body, streaming: props.streaming, codeLabels: codeLabels }
					: { text: body, streaming: props.streaming }),
				hasTr ? createElement("details", { className: "xl-orig" },
					createElement("summary", null, tt.original),
					createElement("div", null, createElement(MDT, MarkdownText
						? { text: props.text, codeLabels: codeLabels }
						: { text: props.text }))) : null);
		}

		function AssistantView(props) {
			var node = props.node;
			var data = node.data;
			var useTurnData = props.useTurnData;
			var tt = UI_TEXT[useStore().lang] || UI_TEXT.en;
			var tail = useTurnData("turn-tail");
			var loc = node.location || {};
			var turn = (loc.kind === "turn" || loc.kind === "step") ? loc.turn : undefined;
			var owner = undefined;
			if (turn && turn.status === "closed" && data.finalNode !== undefined && tail && tail.closing && tail.closing.finalNode && tail.closing.finalNode.seq === data.finalNode.seq) {
				owner = { turn: turn, seq: data.finalNode.seq, openFile: props.openFile };
			}
			var mentions = owner !== undefined && props.fileMentions ? props.fileMentions(owner) : undefined;
			var streaming = data.status === "running";
			var interrupted = data.status === "interrupted";
			var blocks = data.blocks || [];
			var hasVisible = streaming || interrupted === true || blocks.some(function (b) { return b.kind !== "tool-call"; });
			if (!hasVisible) return null;
			var rendered = [];
			var last = blocks.length - 1;
			for (var i = 0; i < blocks.length; i++) {
				var block = blocks[i];
				if (!block) continue;
				if (block.kind === "text") {
					rendered.push(createElement(TextBlock, { key: "t" + i, text: block.text, streaming: streaming }));
				} else if (block.kind === "reasoning") {
					rendered.push(createElement(ThinkRow, { key: "r" + i, text: block.text, running: streaming && i === last }));
				} else if (block.kind === "image") {
					var start = i;
					var group = [block];
					while (i + 1 < blocks.length && blocks[i + 1] && blocks[i + 1].kind === "image") { group.push(blocks[i + 1]); i++; }
					rendered.push(createElement(Fragment, { key: "g" + start },
						props.renderMessageImages({ images: group.map(function (b) { return { attachment: b.attachment }; }), align: "start" })));
				} else if (block.kind === "tool-call") {
					// grouped into tool rows by the chat view
				} else {
					rendered.push(createElement("pre", { key: "u" + i, className: "xl-pre" }, JSON.stringify(block, null, 2)));
				}
			}
			return createElement("div", null, rendered,
				interrupted ? createElement("span", { className: "xl-warn" }, (props.t && props.t("message.stopped")) || tt.stopped) : null);
		}

		function planSummaryOf(todos) {
			var done = 0, active = null, extra = 0;
			for (var i = 0; i < todos.length; i++) {
				var td = todos[i];
				if (td.status === "completed") done++;
				else if (td.status === "in_progress") {
					if (active === null && typeof td.content === "string") active = td.content;
					else extra++;
				}
			}
			return { done: done, total: todos.length, active: active, extra: extra };
		}
		function TodoItemLine(props) {
			var s = useStore();
			var content = typeof props.item.content === "string" ? props.item.content : "";
			var tr = useXlate(content, s.todo);
			var hasTr = !!(tr && tr.ok && !tr.skipped && tr.text !== content);
			var glyph = props.item.status === "completed" ? "✓" : props.item.status === "in_progress" ? "◐" : "○";
			return createElement("div", { className: "xl-item" },
				createElement("span", { className: "xl-glyph" }, glyph),
				createElement("span", {
					className: "xl-item-text",
					title: hasTr ? content : undefined
				}, hasTr ? tr.text : content));
		}
		function XTodoRow(props) {
			var s = useStore();
			var tt = UI_TEXT[s.lang] || UI_TEXT.en;
			var pair = useState(false);
			var open = pair[0], setOpen = pair[1];
			var block = props.block;
			var argsRaw = (("kind" in block) && block.call && typeof block.call.argsRaw === "string" ? block.call.argsRaw : (typeof block.argsRaw === "string" ? block.argsRaw : "")) || "";
			var todos = null;
			try {
				var parsed = JSON.parse(argsRaw);
				var allOk = Array.isArray(parsed && parsed.todos);
				if (allOk) {
					todos = parsed.todos;
					for (var i = 0; i < todos.length; i++) {
						if (!todos[i] || typeof todos[i] !== "object") { todos = null; break; }
					}
				}
			} catch (e) { todos = null; }
			var summary = todos !== null ? planSummaryOf(todos) : null;
			var tr = useXlate(summary && summary.active !== null ? summary.active : null, s.todo);
			var hasTr = !!(tr && tr.ok && !tr.skipped && summary && summary.active !== null && tr.text !== summary.active);
			var head = summary
				? tt.doneFmt.replace("{d}", String(summary.done)).replace("{t}", String(summary.total))
				: tt.taskList;
			var summaryText = summary && summary.active !== null
				? head + " · " + (hasTr ? tr.text : summary.active)
				: head;
			return createElement("div", { className: "xl-todo" },
				createElement("button", {
					className: "xl-row", type: "button",
					onClick: function () { setOpen(function (v) { return !v; }); }
				},
					createElement("span", { className: "xl-dot" + (summary && summary.done === summary.total ? " xl-dot-ok" : "") }),
					createElement("span", { className: "xl-title" }, tt.tasks),
					createElement("span", { className: "xl-sep", "aria-hidden": true }),
					createElement("span", { className: "xl-summary" }, summaryText),
					summary && summary.extra > 0 ? createElement("span", { className: "xl-suffix" }, "+" + summary.extra) : null,
					typeof props.inspect === "function"
						? createElement("button", {
							className: "xl-inspect", type: "button",
							onClick: function (e) { e.stopPropagation(); props.inspect(); }
						}, "⤢")
						: null
				),
				open && todos !== null
					? createElement("div", { className: "xl-items" }, todos.map(function (it, n) {
						return createElement(TodoItemLine, { key: n, item: it });
					}))
					: null);
		}

		function StatusBlock() {
			var s = useStore();
			var t = UI_TEXT[s.lang] || UI_TEXT.en;
			return createElement("div", null,
				createElement("div", { className: "xl-kv" }, createElement("b", null, t.status), createElement("span", null, stats.ok + " / " + stats.fail)),
				createElement("div", { className: "xl-kv" }, createElement("b", null, t.providerOf), createElement("span", null, stats.lastProvider ? ((t.labels[stats.lastProvider] || stats.lastProvider) + (stats.lastModel ? " · " + stats.lastModel : "")) : t.providerDesc)),
				createElement("div", { className: "xl-kv" }, createElement("b", null, t.cacheEntries), createElement("span", null, String(mem.size))),
				stats.lastError ? createElement("div", { className: "xl-err" }, t.lastError + ": " + stats.lastError) : null,
				createElement("button", {
					className: "xl-btn", type: "button",
					onClick: function () {
						mem.clear();
						try {
							var keys = [];
							for (var i = 0; i < localStorage.length; i++) {
								var k = localStorage.key(i);
								if (k && k.indexOf(MEM_KEY) === 0) keys.push(k);
							}
							for (var j = 0; j < keys.length; j++) localStorage.removeItem(keys[j]);
						} catch (e) {}
					}
				}, t.clearCache));
		}

		function ProviderSection() {
			var s = useStore();
			var t = UI_TEXT[s.lang] || UI_TEXT.en;
			var pair = useState(null);
			var cfg = pair[0], setCfg = pair[1];
			var msgPair = useState("");
			var msg = msgPair[0], setMsg = msgPair[1];
			var modelsPair = useState(null);
			var models = modelsPair[0], setModels = modelsPair[1];
			useEffect(function () {
				var alive = true;
				var tries = 0;
				function attempt() {
					if (!alive) return;
					fetch("/_xlate/config").then(function (r) {
						if (!r.ok) throw new Error("HTTP " + r.status);
						return r.json();
					}).then(function (c) { if (alive) setCfg(c); })
						.catch(function () {
							if (!alive) return;
							tries++;
							if (tries < 15) { setTimeout(attempt, 1500); }
							else { setCfg(null); }
						});
				}
				attempt();
				return function () { alive = false; };
			}, []);
			useEffect(function () {
				var alive = true;
				fetch("/_xlate/models").then(function (r) { return r.json(); })
					.then(function (j) { if (alive) setModels(j && Array.isArray(j.models) ? j.models : []); })
					.catch(function () { if (alive) setModels([]); });
				return function () { alive = false; };
			}, []);
			// Local-model download flow: pull state + custom-model input + polling.
			var pullPair = useState(null);
			var pull = pullPair[0], setPull = pullPair[1];
			var customPair = useState("");
			var customModel = customPair[0], setCustomModel = customPair[1];
			var showPullPair = useState(false);
			var showPull = showPullPair[0], setShowPull = showPullPair[1];
			// On mount, resume an in-flight download so re-entering settings
			// shows the live progress without pressing "+" again (2026-08-25).
			useEffect(function () {
				var alive = true;
				fetch("/_xlate/model/pull-status").then(function (r) { return r.json(); })
					.then(function (j) {
						if (!alive || !j || !Array.isArray(j.jobs)) return;
						var active = null;
						for (var i = 0; i < j.jobs.length; i++) {
							if (!j.jobs[i].done && !j.jobs[i].error) { active = j.jobs[i]; break; }
						}
						if (active) setPull({ model: active.model, status: active.status, percent: active.percent, done: active.done, error: active.error });
					})
					.catch(function () {});
				return function () { alive = false; };
			}, []);
			useEffect(function () {
				if (!pull || pull.done || pull.error) return undefined;
				var alive = true;
				var timer = setInterval(function () {
					fetch("/_xlate/model/pull-status").then(function (r) { return r.json(); })
						.then(function (j) {
							if (!alive) return;
							var job = null;
							if (j && Array.isArray(j.jobs)) {
								for (var i = 0; i < j.jobs.length; i++) {
									if (j.jobs[i].model === pull.model) { job = j.jobs[i]; break; }
								}
							}
							if (!job) return;
							setPull({ model: job.model, status: job.status, percent: job.percent, done: job.done, error: job.error });
							if (job.done || job.error) {
								fetch("/_xlate/models").then(function (r) { return r.json(); })
									.then(function (mj) { if (alive && mj) setModels(mj.models || []); }).catch(function () {});
								fetch("/_xlate/config").then(function (r) { return r.json(); })
									.then(function (c) { if (alive) setCfg(c); }).catch(function () {});
							}
						})
						.catch(function () {});
				}, 1000);
				return function () { alive = false; clearInterval(timer); };
			}, [pull ? pull.model + (pull.done ? "|1" : "|0") + (pull.error ? "|1" : "|0") : ""]);
			if (cfg === null) {
				return createElement("div", { className: "xl-note" }, t.providerUnavailable);
			}
			var startPull = function (m) {
				if (!m || !m.trim()) return;
				var name = m.trim();
				setPull({ model: name, status: "starting", percent: 0, done: false, error: null });
				fetch("/_xlate/model/pull", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: name }) })
					.catch(function () { setPull({ model: name, status: "error", percent: 0, done: false, error: "network" }); });
			};
			var testConn = function () {
				setMsg(t.testing);
				fetch("/_xlate/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Hello world, this is a connection test. [" + Date.now().toString(36) + "]", target: store.lang }) })
					.then(function (r) { return r.json(); })
					.then(function (j) {
						setMsg(j && j.ok ? t.connOk + " ✓ (" + (t.labels[j.provider] || j.provider) + (j.model ? ": " + j.model : "") + ")" : t.connFail + ": " + (j.error || "unknown"));
					})
					.catch(function (e) { setMsg(t.connFail + ": " + (e && e.message ? e.message : e)); });
			};
			var priorities = ["google", "bing", "openai"];
			var pickModel = function (e) {
				var m = e.target.value;
				setCfg(Object.assign({}, cfg, { providers: Object.assign({}, cfg.providers, { openai: Object.assign({}, cfg.providers.openai, { model: m }) }) }));
				fetch("/_xlate/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providers: { openai: { model: m } } }) })
					.then(function (r) { return r.json(); })
					.then(function (c) { setCfg(c); })
					.catch(function () {});
			};
			var openaiCfg = cfg.providers && cfg.providers.openai ? cfg.providers.openai : {};
			var downloadButtons = function () {
				return createElement("div", null,
					createElement("div", { style: { display: "flex", gap: "6px", marginTop: "4px", flexWrap: "wrap", alignItems: "center" } },
						createElement("button", { className: "xl-btn", type: "button", onClick: function () { startPull("qwen2.5:7b"); } }, t.downloadModel + " qwen2.5:7b (" + t.recommended + ")"),
						createElement("button", { className: "xl-btn", type: "button", onClick: function () { startPull("qwen2.5:14b"); } }, t.downloadModel + " qwen2.5:14b")),
					createElement("div", { style: { display: "flex", gap: "6px", marginTop: "6px", alignItems: "center" } },
						createElement("input", {
							type: "text", className: "xl-cfg", style: { flex: "1", padding: "4px 6px", fontSize: "11.5px" },
							placeholder: t.otherModel + " (qwen3:8b)", value: customModel,
							onChange: function (e) { setCustomModel(e.target.value); }
						}),
						createElement("button", { className: "xl-btn", type: "button", onClick: function () { startPull(customModel); } }, t.startDownload)));
			};
			var modelArea = null;
			if (cfg.priority === "openai") {
				if (models === null) {
					modelArea = createElement("div", { className: "xl-note" }, t.loadingModels);
				} else {
					// Model picker (when models exist) + a "+" toggle for
					// downloading more models anytime — previously the download
					// entry only appeared with zero models, so 14b was
					// unreachable once 7b was installed (2026-08-25).
					var picker = null;
					if (models.length > 0) {
						picker = createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center" } },
							createElement("label", { style: { flex: "1 1 auto" } },
								createElement("span", null, t.model),
								createElement("select", {
									className: "xl-sel", value: openaiCfg.model || (models[0] || ""),
									onChange: pickModel
								}, models.map(function (m) {
									return createElement("option", { key: m, value: m }, m);
								}))),
							createElement("button", {
								className: "xl-btn", type: "button",
								onClick: function () { setShowPull(function (v) { return !v; }); }
							}, "＋"));
					}
					var pullArea = null;
					if (pull && !pull.done && !pull.error) {
						var stText = t.downloading;
						// Ollama reports layer downloads as status "pulling
						// sha256:...", not "downloading" — show the percentage
						// whenever bytes are moving (2026-08-25).
						if (pull.status === "verifying sha256 digest" || pull.status === "writing manifest") stText = t.verifying;
						else if (pull.percent > 0) stText = t.downloading + " " + pull.percent + "%";
						pullArea = createElement("div", null,
							createElement("div", { className: "xl-note" }, pull.model + " · " + stText),
							createElement("div", { className: "xl-progress" },
								createElement("div", { className: "xl-progress-bar", style: { width: (pull.percent || 0) + "%" } })));
					} else if (pull && pull.done) {
						pullArea = createElement("div", { className: "xl-note" }, t.pullDone + " ✓ " + pull.model);
					} else if (pull && pull.error) {
						pullArea = createElement("div", null,
							createElement("div", { className: "xl-err" }, t.pullError + ": " + pull.error),
							downloadButtons());
					} else if (models.length === 0) {
						pullArea = createElement("div", { className: "xl-note" },
							createElement("div", null, t.noLocalModel + " · " + t.installPrompt),
							downloadButtons());
					} else if (showPull) {
						pullArea = downloadButtons();
					}
					modelArea = createElement("div", null, picker, pullArea);
				}
			}
			return createElement("div", null,
				createElement("label", null,
					createElement("span", null, t.provider),
					createElement("select", {
						className: "xl-sel", value: cfg.priority || "google",
						onChange: function (e) {
							var p = e.target.value;
							var next = Object.assign({}, cfg, { priority: p });
							setCfg(next);
							// Selecting the local model must also enable the openai
							// provider — priority and enabled are independent fields,
							// and a disabled provider is silently skipped by the chain
							// (falls back to google), which confused users (2026-08-25).
							var patch = { priority: p };
							if (p === "openai" && cfg.providers && cfg.providers.openai && !cfg.providers.openai.enabled) {
								patch.providers = { openai: { enabled: true } };
							}
							fetch("/_xlate/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
								.then(function (r) { return r.json(); })
								.then(function (c) { setCfg(c); })
								.catch(function () {});
						}
					}, priorities.map(function (p) {
						return createElement("option", { key: p, value: p }, (t.labels[p] || p));
					}))),
				modelArea,
				createElement("div", { style: { display: "flex", gap: "8px", marginTop: "4px" } },
					createElement("button", { className: "xl-btn", type: "button", onClick: testConn }, t.testConn)),
				msg ? createElement("div", { className: "xl-note" }, msg) : null);
		}

		function SettingsPanel() {
			var s = useStore();
			var t = UI_TEXT[s.lang] || UI_TEXT.en;
			return createElement("div", { className: "xl-panel" },
				createElement("label", null,
					createElement("span", null, t.targetLang),
					createElement("select", {
						className: "xl-sel", value: s.lang,
						onChange: function (e) { store.set({ lang: e.target.value }); }
					}, LANGS.map(function (l) {
						return createElement("option", { key: l[0], value: l[0] }, l[1]);
					}))),
				createElement("label", null,
					createElement("input", { type: "checkbox", checked: s.think, onChange: function (e) { store.set({ think: e.target.checked }); } }),
					createElement("span", null, t.think)),
				createElement("label", null,
					createElement("input", { type: "checkbox", checked: s.todo, onChange: function (e) { store.set({ todo: e.target.checked }); } }),
					createElement("span", null, t.todo)),
				createElement("label", null,
					createElement("input", { type: "checkbox", checked: s.ans, onChange: function (e) { store.set({ ans: e.target.checked }); } }),
					createElement("span", null, t.ans)),
				createElement("hr", { className: "xl-hr" }),
				createElement(ProviderSection, null),
				createElement("hr", { className: "xl-hr" }),
				createElement(StatusBlock, null),
				createElement("hr", { className: "xl-hr" }),
				createElement("div", { className: "xl-note" }, t.note));
		}

		// ------------------------------------------------------------------
		// plugin export
		// ------------------------------------------------------------------
		var inject = ["slots"];
		/**
		 * Register the display-layer translators into the conversation view.
		 * @param ctx - client cordis context.
		 */
		function apply(ctx) {
			diag.applied = true;
			diag.lang = store.lang;
			var recordSlot = function (name, fn) {
				try {
					var d = fn();
					diag.slots[name] = "ok";
					return d;
				} catch (e) {
					diag.slots[name] = "ERR: " + (e && e.message ? e.message : e);
					throw e;
				}
			};
			recordSlot("conversation", function () {
				return ctx.slots.inject("conversation.chat.node", function () {
					try {
						var d = ctx.slots.register(
							// priority -1: the official ui-conversation AssistantNodeView
							// registers the same key at priority 0, and keyed slots throw on
							// same-key + same-priority duplicates (lowest priority renders).
							// Without this the official renderer wins and the thinking chain
							// shows untranslated (2026-08-24).
							{ name: "conversation.chat.node", key: "assistant-step", locale: "conversation", priority: -1 },
							function (props) {
								return createElement(XBoundary, null, createElement(AssistantView, props));
							});
						diag.slots.conversation = "registered";
						return d;
					} catch (e) {
						diag.slots.conversation = "REG-ERR: " + (e && e.message ? e.message : e);
						throw e;
					}
				});
			});
			recordSlot("todo", function () {
				return ctx.slots.inject("tool.call.toolview", function () {
					return ctx.slots.register(
						{ name: "tool.call.toolview", key: "todo_write", locale: "conversation" },
						function (props) {
							return createElement(XBoundary, null, createElement(XTodoRow, props));
						});
				});
			});
			// Settings section: the label is registrant-localized — the shell
			// renders whatever label string the registration carried. Must go
			// through slots.inject (declaration-aware: register() directly
			// throws while the slot is not yet declared, which killed apply —
			// 2026-08-24). To refresh the label on language change we dispose
			// the injection and re-inject with the new language's title.
			var sectionInject = null;
			var lastSectionLang = null;
			var reRegisterSection = function () {
				if (store.lang === lastSectionLang) return;
				lastSectionLang = store.lang;
				if (sectionInject) { sectionInject(); sectionInject = null; }
				var st = UI_TEXT[store.lang] || UI_TEXT.en;
				sectionInject = ctx.slots.inject("settings.section", function () {
					return ctx.slots.register({ name: "settings.section", id: "dsh-think-translate", order: 50, label: st.sectionTitle }, SettingsPanel);
				});
			};
			recordSlot("settings", reRegisterSection);
			store.subscribe(reRegisterSection);
		}

		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});
