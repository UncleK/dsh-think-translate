# 🐋 dsh-think-translate

**언어:** [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

---

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI용 **표시 계층 번역** 플러그인: **사고 체인(Think 행), 작업 카드, 답변 본문**을 선택한 대상 언어로 표시합니다. 원문은 대화 기록에 완전히 보존되며, 번역문은 **모델 컨텍스트에 전혀 들어가지 않습니다**.

[![npm version](https://img.shields.io/npm/v/dsh-think-translate?color=4D6BFE&label=npm)](https://www.npmjs.com/package/dsh-think-translate)
[![license](https://img.shields.io/npm/l/dsh-think-translate?color=4D6BFE)](LICENSE)
[![dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

## ✨ 기능

DeepSeek 계열 모델은 중국어로, 또는 우연히 생각에 쓰는 언어로 추론하는 경우가 많습니다. dsh-think-translate는 모델의 사고에 자막을 다는 것처럼 Think 행·작업 카드·답변을 *여러분의* 언어로 실시간 표시합니다.

- **8개 대상 언어** — 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Русский
- **단일 언어 UI** — 설정 패널, 사고 행, 작업 카드가 모두 대상 언어를 따름(중·영 혼용 없음), 선택 영구 저장
- **로컬 모델 우선** — 로컬 Ollama 모델(qwen 등) 우선: 프라이빗·오프라인·무료. 첫 선택 시 **자동 다운로드**(실시간 진행률 표시), 완료 후 자동 설정·활성화
- **🧠 컨텍스트 비용 0** — 순수 표시 계층: 모델은 여전히 원문을 보고, 번역문은 컨텍스트 창을 전혀 소비하지 않음
- **Google / Bing 폴백** — 로컬 모델 사용 불가 시 자동 전환(google은 Node CONNECT 터널로 시스템 프록시 경유, 안티봇 우회)
- **코드류 자동 스킵** — 파일 경로, 명령어, URL, 정규식, 순수 코드 줄은 번역하지 않음
- **문장 배치 번역** — 긴 사고 체인을 짧은 문장 배치로 순차 번역하여 로컬 소형 모델도 품질 유지
- **🧩 문단·문장 인식 분할** — 긴 사고 체인을 빈 줄로 분할(문단 구조 유지)하고 다시 문장 단위로 배치 처리해 로컬 소형 모델도 품질 유지
- **스트리밍 출력** — 사고 중 번역이 배치 단위로 표시, Think 행을 펼쳐 원문과 비교
- **내구성** — host 요청 백오프 3회 재시도, 브라우저 직접 폴백, 실패 결과는 캐시하지 않음
- **🎚️ 번역 시점 조절** — 모두 사전 번역 / 이전 체인 지연 로딩（기본）/ 펼친 체인만 번역

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

## 🚀 사용법

1. **설정 → 사고 체인 번역** 열기
2. **대상 언어** 선택(예: 한국어) — 설정 패널, 사고 행, 작업 카드가 모두 전환
3. **기본 제공자** 선택:
   - **로컬 모델(Ollama)** — 첫 선택 시 다운로드 버튼 표시(qwen2.5:7b / 14b 또는 커스텀), 완료 후 자동 활성화. 모델 선택 옆 "+"로 언제든 추가 다운로드
   - **google gtx / bing** — 바로 사용 가능(시스템 프록시/VPN 자동 이용)
4. 메시지를 보내고 Think 행을 펼쳐 번역 확인

## 🎬 데모

<!-- TODO: 애니메이션 데모(영어 사고 체인 → 스트리밍 한국어/중국어 번역, 원문 보존)를 docs/demo.gif로 추가 -->

## ⚙️ 작동 원리

```
브라우저 → POST /_xlate/translate(동일 출처, CORS 없음)
  → host 제공자 체인(fail-open):
      openai 호환(로컬 Ollama, Node fetch로 루프백 직결)
      → google gtx(Node https + CONNECT 터널로 시스템 프록시 경유)
      → bing(curl form)
  → 실패 시 브라우저 직접 폴백
```

- **host 측**(`lib/index.js`): 제공자 어댑터, LRU 캐시(600), `/_xlate/models` 모델 목록, `/_xlate/model/pull` + `pull-status` 모델 다운로드 관리(완료 시 자동 설정)
- **client 측**(`lib/client.js`): 8개 언어 UI, 문장 배치 번역, 스트리밍 Think 행, localStorage 영구 저장
- 순수 표시 계층: 원문은 대화 기록과 모델 컨텍스트에 완전 보존

## 🛠 개발

- 빌드 불필요: `lib/client.js`는 브라우저 번들(소스=결과물), `lib/index.js`는 host ESM
- client 변경은 페이지 새로고침으로 반영, host 변경은 web 재시작 필요
- 8개 언어 문구는 `lib/client.js`의 `UI_TEXT` 사전에 있음

## 📄 License

MIT
