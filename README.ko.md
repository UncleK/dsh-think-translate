<div align="center">

# 🐋 dsh-think-translate

**언어:** [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![npm version](https://img.shields.io/npm/v/dsh-think-translate?color=4D6BFE&label=npm)](https://www.npmjs.com/package/dsh-think-translate)
[![license](https://img.shields.io/npm/l/dsh-think-translate?color=4D6BFE)](LICENSE)
[![dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

<img src="demo/demo.gif" width="46%" alt="dsh-think-translate demo" style="border:1px solid #4D6BFE;border-radius:8px;margin:4px" />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="demo/demo2.gif" width="41%" alt="dsh-think-translate demo 2" style="border:1px solid #4D6BFE;border-radius:8px;margin:4px" />

</div>

---

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI용 **표시 계층 번역** 플러그인: **사고 체인(Think 행), 작업 카드, 답변 본문**을 선택한 대상 언어로 표시합니다. 원문은 대화 기록에 완전히 보존되며, 번역문은 **모델 컨텍스트에 전혀 들어가지 않습니다**.

## ✨ 기능

DeepSeek 계열 모델은 중국어로, 또는 우연히 생각에 쓰는 언어로 추론하는 경우가 많습니다. dsh-think-translate는 모델의 사고에 자막을 다는 것처럼 Think 행·작업 카드·답변을 *여러분의* 언어로 실시간 표시합니다.

- **🕵️ 어떤 사고 체인도 읽기** — 추론, 사고 체인, 작업 카드, 답변을 실시간으로 번역해 배치 단위로 스트리밍
- **8개 대상 언어** — 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Русский
- **단일 언어 UI** — 설정 패널, 사고 행, 작업 카드가 모두 대상 언어를 따름(중·영 혼용 없음), 선택 영구 저장
- **로컬 모델 우선** — 로컬 Ollama 모델(qwen 등) 우선: 프라이빗·오프라인·무료. 첫 선택 시 **자동 다운로드**(실시간 진행률 표시), 완료 후 자동 설정·활성화
- **🧠 컨텍스트 비용 0** — 순수 표시 계층: 모델은 여전히 원문을 보고, 번역문은 컨텍스트 창을 전혀 소비하지 않음
- **Google / Bing 폴백** — 로컬 모델 사용 불가 시 자동 전환(google은 Node CONNECT 터널로 시스템 프록시 경유, 안티봇 우회)
- **코드류 자동 스킵** — 파일 경로, 명령어, URL, 정규식, 순수 코드 줄은 번역하지 않음
- **문장 배치 번역** — 긴 사고 체인을 짧은 문장 배치로 순차 번역하여 로컬 소형 모델도 품질 유지
- **🧩 문단·문장 인식 분할** — 긴 사고 체인을 빈 줄로 분할(문단 구조 유지)하고 다시 문장 단위로 배치 처리해 로컬 소형 모델도 품질 유지
- **스트리밍 출력** — 사고 중 번역이 배치 단위로 표시, Think 행을 펼쳐 원문과 비교
- **🎚️ 번역 시점 조절** — 모두 사전 번역 / 이전 체인 지연 로딩（기본）/ 펼친 체인만 번역
- **🔗 동적 제공자 체인** — 목록 순서가 곧 실행 순서. 끌어서 정렬하고 행마다 켜고 끄기. 내장 google gtx / bing / 로컬 Ollama에 더해 임의의 사용자 지정 엔드포인트
- **🔌 사용자 지정 제공자(OpenAI / Anthropic)** — 설정 패널에서 OpenAI 호환 엔드포인트(`/v1/chat/completions`)나 **Anthropic Messages API**(Claude)를 추가: 유형, 프리셋, 베이스 URL, API 키, 모델
- **🪄 DSH 설정의 제공자 상속** — `settings.yaml`(`llm-pi-ai.providers`)에서 읽기 전용 DSH 행을 자동 발견하고, 버튼 한 번으로 다시 검사해 모두 체인에 추가. 키는 요청 시 `.credentials.yaml`에서 해석되며 플러그인 설정에 저장되지 않음
- **⏱️ 실패에 강함** — host 3회 백오프 재시도 + 브라우저 직접 폴백, 행별 테스트 버튼, 실패 결과는 캐시하지 않음

## 📦 설치

```bash
# 방법 1: npm (권장)
dsh plugin --profile web add dsh-think-translate
# 그 후 web 재시작

# 방법 2: GitHub
dsh plugin --profile web add github:UncleK/dsh-think-translate

# 방법 3: 수동 (junction + patch)
#  1. 패키지를 profile의 node_modules에 링크
New-Item -ItemType Junction -Path "$HOME\.dsh\profiles\node_modules\dsh-think-translate" `
  -Target "<저장소 경로>"
#  2. "$HOME\.dsh\profiles\web\cordis.patch.yml"에 추가:
# - insert:
#     - id: dsh-think-translate
#       name: dsh-think-translate
#  3. web 재시작
```

## 🧯 DSH 업그레이드 후

서드파티 클라이언트 플러그인은 DSH의 클라이언트 모듈 그래프를 통해 로드되며, 이 그래프는 **프로세스 시작 시 한 번만** 구성됩니다. 실패한 구성은 재시작 전까지 메모리에 남습니다. 그래서 업그레이드 직후에는 보통 다음 세 가지가 발생합니다.

- **소스에서 시작하면 실패**: `client bundles not found; run \`pnpm run build\` before launch` —— 새 클라이언트 패키지가 아직 빌드되지 않은 상태입니다. harness 체크아웃에서 `pnpm run build`를 실행한 뒤 `dsh web`을 다시 시작하세요.
- **플러그인 UI가 사라짐** (Think 행에 번역이 없고, 설정에 "사고 체인 번역"이 없음) —— **`dsh web`을 한 번 재시작**하세요. 페이지를 새로고침하는 것만으로는 부족할 때가 있습니다.
- **로컬 모델 목록이 비어 있음** —— `ollama` 서비스가 해당 모델 디렉터리를 보고 있지 않습니다: `ollama list`(또는 `GET /api/tags`)와 실행 중인 서비스가 실제로 사용하는 `OLLAMA_MODELS`를 확인하세요. 모델 파일이 다른 드라이브에 있다면 디렉터리 정션으로 기본 디렉터리를 그쪽으로 연결할 수 있습니다.

플러그인 쪽에서 설정할 것은 없습니다. DSH 내부 패키지의 로드 순서에 의존하지 않고(`slots` 서비스만 사용하며 `@deepseek-ai/dsh-client-ui-primitives`는 선택 사항), 구버전(≤ 0.1.1-rc)과 현재 라인(≥ 0.1.2-alpha.1, 0.1.5-rc.1 포함) 모두에서 동작합니다.

## 🚀 사용법

1. **설정 → 사고 체인 번역** 열기
2. **대상 언어** 선택(예: 한국어) — 설정 패널, 사고 행, 작업 카드가 모두 전환
3. **제공자 체인** 관리(드래그로 순서 변경, 체크로 사용):
   - 내장: **google gtx / bing**(무료, 즉시 사용, 시스템 프록시)과 **로컬 모델(Ollama)**(처음 선택 시 7b/14b 또는 사용자 지정 다운로드)
   - **DSH 제공자**: `settings.yaml`에 설정된 엔드포인트가 자동 표시(읽기 전용, 체크하면 체인에 추가). 목록 아래의 **DSH 설정에서 가져오기**는 다시 검사해 한 번에 모두 추가합니다(baseURL과 키를 다시 입력할 필요가 없고, 키는 DSH 자체 자격 증명에서 해석됩니다)
   - 키는 직접 입력하거나 프리셋·DSH 행이 가진 **`apiKeyEnv`** 로 지정할 수 있습니다. 그런 행에는 `env:NAME` 배지가 붙고 키는 요청 시 해석되며 `config.json`에 저장되지 않습니다. 편집 폼에는 환경 변수 입력란이 없지만(값은 그대로 유지) 필드를 비우면 실제로 삭제됩니다(명시적 삭제로 전송)
   - 체크를 해제하면 해당 제공자는 건너뜁니다. 자세한 내용은 [README.md](README.md)
4. 메시지를 보내고 Think 행을 펼쳐 번역 확인

## ⚙️ 작동 원리

```
브라우저 → POST /_xlate/translate(동일 출처, CORS 없음)
  → host 제공자 체인(fail-open, 순서 변경 가능):
      chain: [provider1, provider2, ...]   ← 설정에서 드래그로 정렬
        google / bing / OpenAI 호환 / Anthropic 중 선택
      fallback 체인(선택, 기본 비활성, 설정에서 활성화)
  → 브라우저 직접 연결 폴백
```

- **제공자 설정**은 `config.json`(런타임 생성, gitignore 대상)에 있습니다: `chain`(순서 있는 id), `fallback`(enabled + chain, 설정 파일 전용), `providers`(각 항목의 `type`/`enabled`/`baseURL`/`apiKey`/`apiKeyEnv`/`model`). 예전 `priority` 형식은 자동 마이그레이션됩니다. `apiKeyEnv`를 선언한 제공자는 요청 시 해당 환경 변수에서 키를 해석하며(리터럴 `apiKey`는 폴백), 해석된 키를 `config.json`에 다시 쓰지 않습니다. 패치의 `null`은 해당 필드 삭제를 뜻하며 UI가 그렇게 비웁니다
- **DSH 자동 발견**은 로드 시 harness의 `settings.yaml`(`llm-pi-ai.providers`)과 `.credentials.yaml`(`refs`)을 읽습니다. 발견된 제공자는 `source: "dsh"`로 표시되고 해석된 키는 메모리에만 남으며(`config.json`에 기록되지 않음), `/_xlate/dsh-scan`으로 필요할 때 다시 읽습니다
- **host 측**(`lib/index.js`): 제공자 어댑터, LRU 캐시(600), `/_xlate/models` 모델 목록, `/_xlate/model/pull` + `pull-status` 모델 다운로드 관리(완료 시 자동 설정)
- **client 측**(`lib/client.js`): 8개 언어 UI, 문장 배치 번역, 스트리밍 Think 행, localStorage 영구 저장
- 순수 표시 계층: 원문은 대화 기록과 모델 컨텍스트에 완전 보존

## 🛠 개발

- 빌드 불필요: `lib/client.js`는 브라우저 번들(소스=결과물), `lib/index.js`는 host ESM
- client 변경은 페이지 새로고침으로 반영, host 변경은 web 재시작 필요
- 8개 언어 문구는 `lib/client.js`의 `UI_TEXT` 사전에 있음

## 📄 License

MIT
