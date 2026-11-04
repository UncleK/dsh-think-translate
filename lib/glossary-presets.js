// Curated English technical terms, not an automatic word-by-word dictionary.
// Increment the version whenever a source or translation changes (cache contract).
export const BUILTIN_GLOSSARY_VERSION = 'technical-v1'
const languages = ['zh-CN', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt']
const rows = [
  ['AI agent', 'AI 智能体', 'AI エージェント', 'AI 에이전트', 'agente de IA', 'agent IA', 'KI-Agent', 'ИИ-агент', 'agente de IA'],
  ['agent', '智能体', 'エージェント', '에이전트', 'agente', 'agent', 'Agent', 'агент', 'agente'],
  ['reasoning', '推理', '推論', '추론', 'razonamiento', 'raisonnement', 'Schlussfolgern', 'рассуждение', 'raciocínio'],
  ['large language model', '大语言模型', '大規模言語モデル', '대규모 언어 모델', 'modelo de lenguaje de gran tamaño', 'grand modèle de langage', 'großes Sprachmodell', 'большая языковая модель', 'modelo de linguagem de grande porte'],
  ['context window', '上下文窗口', 'コンテキストウィンドウ', '컨텍스트 창', 'ventana de contexto', 'fenêtre de contexte', 'Kontextfenster', 'контекстное окно', 'janela de contexto'],
  ['chain of thought', '思维链', '思考の連鎖', '사고 과정', 'cadena de pensamiento', 'chaîne de pensée', 'Gedankenkette', 'цепочка рассуждений', 'cadeia de pensamento'],
  ['prompt injection', '提示注入', 'プロンプトインジェクション', '프롬프트 주입', 'inyección de instrucciones', 'injection de prompt', 'Prompt-Injection', 'инъекция промпта', 'injeção de prompt'],
  ['function calling', '函数调用', '関数呼び出し', '함수 호출', 'llamada a funciones', 'appel de fonctions', 'Funktionsaufruf', 'вызов функций', 'chamada de funções'],
  ['tool calling', '工具调用', 'ツール呼び出し', '도구 호출', 'llamada a herramientas', 'appel d’outils', 'Werkzeugaufruf', 'вызов инструментов', 'chamada de ferramentas'],
  ['fine-tuning', '微调', 'ファインチューニング', '미세 조정', 'ajuste fino', 'ajustement fin', 'Feinabstimmung', 'дообучение', 'ajuste fino'],
  ['retrieval-augmented generation', '检索增强生成', '検索拡張生成', '검색 증강 생성', 'generación aumentada por recuperación', 'génération augmentée par récupération', 'abrufgestützte Generierung', 'генерация с дополнением поиском', 'geração aumentada por recuperação'],
  ['embedding', '嵌入向量', '埋め込み', '임베딩', 'representación vectorial', 'plongement vectoriel', 'Einbettung', 'векторное представление', 'representação vetorial'],
  ['inference', '推理', '推論', '추론', 'inferencia', 'inférence', 'Inferenz', 'инференс', 'inferência'],
  ['provider', '提供方', 'プロバイダー', '제공자', 'proveedor', 'fournisseur', 'Anbieter', 'провайдер', 'provedor'],
  ['rate limit', '速率限制', 'レート制限', '요청 속도 제한', 'límite de solicitudes', 'limite de requêtes', 'Ratenbegrenzung', 'ограничение частоты запросов', 'limite de requisições'],
  ['API key', 'API 密钥', 'API キー', 'API 키', 'clave de API', 'clé API', 'API-Schlüssel', 'ключ API', 'chave de API'],
  ['access token', '访问令牌', 'アクセストークン', '액세스 토큰', 'token de acceso', 'jeton d’accès', 'Zugriffstoken', 'токен доступа', 'token de acesso'],
  ['environment variable', '环境变量', '環境変数', '환경 변수', 'variable de entorno', 'variable d’environnement', 'Umgebungsvariable', 'переменная окружения', 'variável de ambiente'],
  ['working directory', '工作目录', '作業ディレクトリ', '작업 디렉터리', 'directorio de trabajo', 'répertoire de travail', 'Arbeitsverzeichnis', 'рабочий каталог', 'diretório de trabalho'],
  ['command line', '命令行', 'コマンドライン', '명령줄', 'línea de comandos', 'ligne de commande', 'Befehlszeile', 'командная строка', 'linha de comando'],
  ['pull request', '拉取请求', 'プルリクエスト', '풀 리퀘스트', 'solicitud de incorporación', 'demande de fusion', 'Pull Request', 'запрос на слияние', 'solicitação de pull'],
  ['merge conflict', '合并冲突', 'マージ競合', '병합 충돌', 'conflicto de fusión', 'conflit de fusion', 'Zusammenführungskonflikt', 'конфликт слияния', 'conflito de mesclagem'],
  ['version control', '版本控制', 'バージョン管理', '버전 관리', 'control de versiones', 'gestion de versions', 'Versionskontrolle', 'контроль версий', 'controle de versão'],
  ['source code', '源代码', 'ソースコード', '소스 코드', 'código fuente', 'code source', 'Quellcode', 'исходный код', 'código-fonte'],
  ['dependency injection', '依赖注入', '依存性注入', '의존성 주입', 'inyección de dependencias', 'injection de dépendances', 'Abhängigkeitsinjektion', 'внедрение зависимостей', 'injeção de dependências'],
  ['unit test', '单元测试', '単体テスト', '단위 테스트', 'prueba unitaria', 'test unitaire', 'Modultest', 'модульный тест', 'teste unitário'],
  ['integration test', '集成测试', '結合テスト', '통합 테스트', 'prueba de integración', 'test d’intégration', 'Integrationstest', 'интеграционный тест', 'teste de integração'],
  ['regression test', '回归测试', '回帰テスト', '회귀 테스트', 'prueba de regresión', 'test de régression', 'Regressionstest', 'регрессионный тест', 'teste de regressão'],
  ['stack trace', '堆栈跟踪', 'スタックトレース', '스택 추적', 'traza de pila', 'trace de pile', 'Stapelrückverfolgung', 'трассировка стека', 'rastreamento de pilha'],
  ['middleware', '中间件', 'ミドルウェア', '미들웨어', 'middleware', 'intergiciel', 'Middleware', 'промежуточное ПО', 'middleware'],
  ['callback', '回调', 'コールバック', '콜백', 'función de retorno', 'fonction de rappel', 'Rückruffunktion', 'обратный вызов', 'função de retorno'],
  ['deadlock', '死锁', 'デッドロック', '교착 상태', 'interbloqueo', 'interblocage', 'Verklemmung', 'взаимная блокировка', 'impasse'],
  ['race condition', '竞态条件', '競合状態', '경쟁 상태', 'condición de carrera', 'condition de concurrence', 'Wettlaufsituation', 'состояние гонки', 'condição de corrida'],
  ['memory leak', '内存泄漏', 'メモリリーク', '메모리 누수', 'fuga de memoria', 'fuite de mémoire', 'Speicherleck', 'утечка памяти', 'vazamento de memória'],
  ['garbage collection', '垃圾回收', 'ガベージコレクション', '가비지 컬렉션', 'recolección de basura', 'ramasse-miettes', 'Speicherbereinigung', 'сборка мусора', 'coleta de lixo'],
  ['cache invalidation', '缓存失效', 'キャッシュの無効化', '캐시 무효화', 'invalidación de caché', 'invalidation du cache', 'Cache-Invalidierung', 'инвалидация кэша', 'invalidação de cache'],
  ['load balancing', '负载均衡', '負荷分散', '부하 분산', 'equilibrio de carga', 'répartition de charge', 'Lastverteilung', 'балансировка нагрузки', 'balanceamento de carga'],
  ['reverse proxy', '反向代理', 'リバースプロキシ', '리버스 프록시', 'proxy inverso', 'proxy inverse', 'Reverse Proxy', 'обратный прокси', 'proxy reverso'],
  ['webhook', 'Webhook', 'Webhook', '웹훅', 'webhook', 'webhook', 'Webhook', 'вебхук', 'webhook'],
  ['streaming response', '流式响应', 'ストリーミング応答', '스트리밍 응답', 'respuesta en flujo', 'réponse en continu', 'Streaming-Antwort', 'потоковый ответ', 'resposta em fluxo'],
  ['batch processing', '批处理', 'バッチ処理', '일괄 처리', 'procesamiento por lotes', 'traitement par lots', 'Stapelverarbeitung', 'пакетная обработка', 'processamento em lote'],
  ['fallback', '失败回退', 'フォールバック', '폴백', 'alternativa de respaldo', 'solution de repli', 'Ausweichlösung', 'резервный вариант', 'alternativa de contingência'],
]
const preserved = ['DeepSeek', 'Ollama', 'OpenAI', 'Anthropic', 'GitHub', 'Git', 'Node.js', 'JavaScript', 'TypeScript', 'Python', 'React', 'JSON', 'Markdown', 'SDK', 'API', 'CLI', 'LLM', 'RAG']
const entries = Object.fromEntries(['en', ...languages].map(language => [language, Object.freeze([
  ...rows.map(row => Object.freeze({ source: row[0], target: language === 'en' ? row[0] : row[languages.indexOf(language) + 1] })),
  ...preserved.map(source => Object.freeze({ source, target: source })),
])]))
export const BUILTIN_GLOSSARY = Object.freeze({ version: BUILTIN_GLOSSARY_VERSION, entries: Object.freeze(entries) })
