<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/hero.ru.png?v=1.2.16" alt="dsh-think-translate — Мысли ИИ — на вашем языке" width="100%" />
</p>

<p align="center">
  <b>Перевод слоя отображения для DeepSeek Harness.</b><br />
  Читайте рассуждения, следите за задачами и понимайте ответы. Оригиналы сохранены; переводы не входят в контекст модели.
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-mit.ru.svg?v=1.2.16" alt="Лицензия MIT" />
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-local.ru.svg?v=1.2.16" alt="Локальный Ollama" />
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-original.ru.svg?v=1.2.16" alt="Оригиналы сохранены" />
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> · <a href="README.md">English</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <b>Русский</b> · <a href="README.pt.md">Português</a>
</p>

<p align="center">
  <a href="#quick-start"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-quick-start.ru.svg?v=1.2.16" alt="Установка" height="24" /></a> &nbsp;·&nbsp; <a href="#demo"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-demo.ru.svg?v=1.2.16" alt="Демонстрации" height="24" /></a> &nbsp;·&nbsp; <a href="#features"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-features.ru.svg?v=1.2.16" alt="Возможности" height="24" /></a> &nbsp;·&nbsp; <a href="#comparison"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-comparison.ru.svg?v=1.2.16" alt="Сравнение" height="24" /></a> &nbsp;·&nbsp; <a href="#faq"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-faq.ru.svg?v=1.2.16" alt="Вопросы" height="24" /></a>
</p>

---

<a id="demo"></a>
## Наблюдайте, как рождаются мысли

<table>
<tr>
<td width="50%" align="center" valign="bottom">
<img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/demo/demo.gif?v=1.2.16" alt="Демо 1 · Рассуждения и ответы" width="100%" />
</td>
<td width="50%" align="center" valign="bottom">
<img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/demo/demo2.gif?v=1.2.16" alt="Демо 2 · Другие операции" width="100%" />
</td>
</tr>
<tr>
<td align="center" valign="top"><sub>Демо 1 · Рассуждения и ответы</sub></td>
<td align="center" valign="top"><sub>Демо 2 · Другие операции</sub></td>
</tr>
</table>

<a id="comparison"></a>
## Сравнение с официальным плагином перевода

<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/translation-comparison.ru.png?v=1.2.16" alt="Сравнение с официальным плагином перевода" width="100%" />
</p>

Включайте этот плагин или официальный переводчик рассуждений. Оба управляют интерфейсом рассуждений.

<a id="quick-start"></a>
## Одна команда для начала

```bash
dsh plugin --profile web add dsh-think-translate
```

После установки полностью перезапустите DSH Web. Откройте **Настройки → Перевод размышлений** и выберите язык и провайдеров.

<details>
<summary><b>Установка из GitHub, обновление и другие способы</b></summary>

Установить из GitHub:

```bash
dsh plugin --profile web add github:UncleK/dsh-think-translate
```

Обновить из npm:

```bash
dsh plugin --profile web add dsh-think-translate@latest
```

Полностью перезапускайте DSH после установки или обновления. При ручном размещении свяжите пакет с профилем и добавьте запись в `cordis.patch.yml`. Обычно рекомендуются команды выше.

</details>

<a id="features"></a>
## Понимать нужно не только рассуждения

<table>
<tr>
<td width="50%" valign="top">
<h3>Читайте рассуждения в реальном времени</h3>
<p>Предперевод всего, загрузка истории по мере надобности или перевод при раскрытии</p>
</td>
<td width="50%" valign="top">
<h3>Задачи и ответы вместе</h3>
<p>Рассуждения, карточки и список задач в поле ввода; ответы и причины отказа автопроверки — по выбору</p>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<h3>Понимайте причины решений проверки</h3>
<p>Если автопроверка отклоняет вызов инструмента, рядом с оригиналом появляется перевод причины. Обычные кнопки решения остаются доступны.</p>
</td>
<td width="50%" valign="top">
<h3>Сохраняйте оригиналы и код</h3>
<p>Оригинал сохранён; перевод не попадает в контекст модели. Компоненты Markdown; защита кода, путей и команд до перевода.</p>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<h3>Локальные модели по необходимости</h3>
<p>Вручную, при снятии флажка или после простоя; загрузка при следующем переводе</p>
</td>
<td width="50%" valign="top">
<h3>Провайдеры в вашем порядке</h3>
<p>Автопереход по включённым провайдерам; явно неверный язык вызывает следующий; повтор после паузы</p>
</td>
</tr>
</table>

### Подключите знакомых провайдеров

**Ollama · Google · Bing · OpenAI · Anthropic Messages API**

Обнаруживайте провайдеров DSH без повторного ввода адресов и ключей. Каждую строку можно проверить отдельно; порядок списка определяет попытки.

```text
Первый выбор → следующий включённый провайдер → … → оригинал, если все не сработали
```

<details>
<summary><b>Свои API, ключи и восстановление</b></summary>

- Поддерживаются совместимый с OpenAI `/v1/chat/completions` и нативный Anthropic Messages API.
- Обнаружение читает текущий профиль DSH и переопределения. Повторите поиск и добавьте провайдеров в цепочку.
- `apiKeyEnv` разрешается при запросе; полученные ключи не записываются в конфигурацию плагина.
- После сбоя действует пауза 30 секунд в памяти host. Затем новые запросы могут повторить попытку. Явно неверный язык вызывает следующего провайдера.
- Текст, распознанный как целевой язык, пропускается; тест провайдера всегда отправляет настоящий запрос.

</details>

### Локальные модели перевода: загрузка и освобождение по необходимости

| Ваше действие | Поведение плагина |
|---|---|
| Перевести или проверить | Запуск службы и загрузка выбранной модели по необходимости |
| Освободить память модели | Дождаться текущих переводов, затем выгрузить; сохранить файлы, переключатели и порядок |
| Снять флажок локального провайдера | Отключить его и выгрузить выбранную модель |
| Снова включить или открыть настройки | Без предварительной загрузки; загрузка при следующем переводе |
| Настроить освобождение после простоя | По умолчанию 5 минут; 1 / 5 / 10 / 30 / 60 минут или выкл. |

Время применяется со следующего использования. Ollama отслеживает выбранную модель без изменения глобальных переменных среды. Недостающие программы или модели устанавливаются и скачиваются только после нажатия подготовки, с показом прогресса.

<a id="languages"></a>
### Ваш язык всегда с вами

中文 · English · 日本語 · 한국어 · Español · Français · Deutsch · Русский · Português

Девять языков перевода, настроек и задач, включая португальский. Выбор сохраняется после обновления страницы.

<a id="faq"></a>
## Частые вопросы

<details>
<summary><b>После установки или обновления нет пункта перевода</b></summary>

Полностью перезапустите `dsh web`. Граф модулей собирается при старте; обновления страницы может быть недостаточно. Внизу настроек указана версия установленного пакета.

</details>

<details>
<summary><b>Список локальных моделей пуст</b></summary>

Проверьте `ollama list` или `/api/tags`, каталог моделей и `OLLAMA_MODELS` службы. Повторно скачивать имеющиеся файлы не нужно.

</details>

<details>
<summary><b>Client bundles not found после обновления DSH</b></summary>

Выполните `pnpm run build` в репозитории DeepSeek Harness и перезапустите DSH Web.

</details>

<details>
<summary><b>Сбой перевода влияет на разговор?</b></summary>

Если все включённые провайдеры не сработали, остаётся оригинал. Проверьте отдельные провайдеры и последнюю ошибку в настройках. После паузы новые запросы могут повторить попытку.

</details>

<details>
<summary><b>Изменения и совместимость</b></summary>

**1.2.16** добавляет португальский для перевода и интерфейса, обновляет все девять README и сравнительных изображений, объявляет три изображения для маркета.

**1.2.15** добавляет управление памятью локальных моделей и адаптацию изображений, группового сворачивания и выбора оригинала к DSH `0.2.2-alpha.2`.

**1.2.13** переводит причины отказа автопроверки. Спасибо [llg1634](https://github.com/llg1634) за сообщение, первый патч и тесты.

Предыдущие версии: [GitHub Releases](https://github.com/UncleK/dsh-think-translate/releases).

</details>

<details>
<summary><b>Разработка и устройство</b></summary>

- `lib/index.js`: маршруты host, провайдеры, конфигурация, кеш и локальные модели.
- `lib/client.js`: настройки, перевод отображения, потоковые пакеты и кеш браузера.
- `lib/config.json`: конфигурация времени выполнения, исключена из Git и npm.
- Дополнительная сборка не требуется. После изменения host перезапустите DSH.
- Проверка: `npm test`. Обнаружение и ключи: [заметки по сопровождению](https://github.com/UncleK/dsh-think-translate/blob/main/docs/maintenance-notes.md).

</details>

---

<p align="center">
  <b>dsh-think-translate</b><br />
  <a href="https://github.com/UncleK/dsh-think-translate/issues">Сообщить о проблеме</a> &nbsp;·&nbsp; <a href="https://github.com/UncleK/dsh-think-translate/releases">Версии</a> &nbsp;·&nbsp; <a href="https://github.com/UncleK/dsh-think-translate/blob/main/LICENSE">Лицензия MIT</a>
</p>
