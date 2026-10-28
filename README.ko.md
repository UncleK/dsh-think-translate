<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/hero.ko.png?v=1.2.16" alt="dsh-think-translate — AI의 생각을 당신의 언어로" width="100%" />
</p>

<p align="center">
  <b>DeepSeek Harness를 위한 표시 계층 번역.</b><br />
  사고를 읽고, 작업을 따라가고, 답변을 이해하세요. 원문은 보존되며 번역문은 모델 컨텍스트에 들어가지 않습니다.
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-mit.ko.svg?v=1.2.16" alt="MIT License" />
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-local.ko.svg?v=1.2.16" alt="로컬 Ollama" />
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-original.ko.svg?v=1.2.16" alt="원문 보존" />
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> · <a href="README.md">English</a> · <a href="README.ja.md">日本語</a> · <b>한국어</b> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.pt.md">Português</a>
</p>

<p align="center">
  <a href="#quick-start"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-quick-start.ko.svg?v=1.2.16" alt="빠른 설치" height="24" /></a> &nbsp;·&nbsp; <a href="#demo"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-demo.ko.svg?v=1.2.16" alt="실제 데모" height="24" /></a> &nbsp;·&nbsp; <a href="#features"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-features.ko.svg?v=1.2.16" alt="핵심 기능" height="24" /></a> &nbsp;·&nbsp; <a href="#comparison"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-comparison.ko.svg?v=1.2.16" alt="공식 비교" height="24" /></a> &nbsp;·&nbsp; <a href="#faq"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-faq.ko.svg?v=1.2.16" alt="자주 묻는 질문" height="24" /></a>
</p>

---

<a id="demo"></a>
## 생각이 펼쳐지는 순간

<table>
<tr>
<td width="50%" align="center" valign="bottom">
<img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/demo/demo.gif?v=1.2.16" alt="데모 1 · 사고 과정과 답변 번역" width="100%" />
</td>
<td width="50%" align="center" valign="bottom">
<img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/demo/demo2.gif?v=1.2.16" alt="데모 2 · 더 많은 실제 조작" width="100%" />
</td>
</tr>
<tr>
<td align="center" valign="top"><sub>데모 1 · 사고 과정과 답변 번역</sub></td>
<td align="center" valign="top"><sub>데모 2 · 더 많은 실제 조작</sub></td>
</tr>
</table>

<a id="comparison"></a>
## 공식 번역 플러그인과 비교

<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/translation-comparison.ko.png?v=1.2.16" alt="공식 번역 플러그인과 비교" width="100%" />
</p>

이 플러그인과 공식 사고 번역 중 하나만 활성화하세요. 둘 다 사고 화면을 담당합니다.

<a id="quick-start"></a>
## 명령 하나로 시작

```bash
dsh plugin --profile web add dsh-think-translate
```

설치 후 DSH Web을 완전히 다시 시작하세요. **설정 → 사고 체인 번역**에서 대상 언어와 제공자를 선택합니다.

<details>
<summary><b>GitHub 설치, 업데이트 및 기타 방법</b></summary>

GitHub에서 설치:

```bash
dsh plugin --profile web add github:UncleK/dsh-think-translate
```

npm 버전 업데이트:

```bash
dsh plugin --profile web add dsh-think-translate@latest
```

설치나 업데이트 후 DSH를 완전히 다시 시작하세요. 수동 배포는 패키지를 profile에 연결하고 `cordis.patch.yml`에 등록합니다. 일반적으로 위 명령을 권장합니다.

</details>

<a id="features"></a>
## 이해해야 할 것은 사고 과정만이 아닙니다

<table>
<tr>
<td width="50%" valign="top">
<h3>사고를 실시간으로 읽기</h3>
<p>전체 사전 번역, 이전 기록 지연 로딩, 펼칠 때만 번역</p>
</td>
<td width="50%" valign="top">
<h3>작업과 답변 함께 보기</h3>
<p>사고 과정, 작업 카드, 입력 영역 작업 목록. 답변 본문과 자동 검토 거부 사유는 선택 번역</p>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<h3>검토 사유 이해하기</h3>
<p>자동 검토가 도구 호출을 거부하면 원문 옆에 사유 번역을 표시합니다. 기존 결정 버튼은 계속 사용할 수 있습니다.</p>
</td>
<td width="50%" valign="top">
<h3>원문과 코드 보존</h3>
<p>원문 보존. 번역문은 모델 컨텍스트에 들어가지 않음. Markdown 구성 요소 재사용. 번역 전에 코드, 경로, 명령 보호.</p>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<h3>필요할 때 로컬 모델 로드</h3>
<p>수동 해제, 체크 해제 시 해제, 유휴 후 자동 해제. 다음 번역 시 다시 로드</p>
</td>
<td width="50%" valign="top">
<h3>원하는 순서로 제공자 사용</h3>
<p>활성화된 순서로 자동 대체. 명백히 잘못된 언어이면 다음 제공자 시도. 대기 후 재시도</p>
</td>
</tr>
</table>

### 이미 사용하는 제공자 연결

**Ollama · Google · Bing · OpenAI · Anthropic Messages API**

DSH에 설정된 제공자를 검색하므로 엔드포인트와 키를 다시 입력할 필요가 없습니다. 각 행을 개별 테스트하고 목록 순서대로 시도합니다.

```text
첫 번째 제공자 → 다음 활성 제공자 → … → 모두 실패하면 원문 유지
```

<details>
<summary><b>사용자 지정 엔드포인트, 인증 및 복구</b></summary>

- OpenAI 호환 `/v1/chat/completions`와 기본 Anthropic Messages API를 지원합니다.
- 현재 DSH profile 및 덮어쓰기 설정에서 제공자를 검색하고 번역 체인에 추가할 수 있습니다.
- `apiKeyEnv`는 요청 시 해석하며 해석한 키를 플러그인 설정에 다시 쓰지 않습니다.
- 실패는 Host 메모리에서 30초간 대기 후 다음 번역 요청에서 재시도합니다. 명백한 언어 오류는 다음 제공자로 넘어갑니다.
- 이미 대상 언어로 인식되는 본문은 건너뜁니다. 제공자 테스트는 실제 요청을 보냅니다.

</details>

### 로컬 번역 모델: 필요할 때 로드하고 해제

| 사용자 조작 | 플러그인 동작 |
|---|---|
| 번역 또는 테스트 | 필요할 때 서비스를 시작하고 선택한 모델 로드 |
| 모델 메모리 해제 | 진행 중인 번역 후 해제. 파일, 스위치, 순서 유지 |
| 로컬 제공자 체크 해제 | 비활성화하고 선택한 모델 해제 |
| 다시 활성화하거나 설정 열기 | 미리 로드하지 않고 다음 실제 번역 시 로드 |
| 유휴 해제 설정 | 기본 5분. 1 / 5 / 10 / 30 / 60분 또는 끄기 |

시간은 다음 사용부터 적용됩니다. Ollama가 선택한 모델의 유휴 시간을 관리하며 전역 환경 변수는 바꾸지 않습니다. 소프트웨어나 모델이 없으면 준비 버튼을 눌러야 설치·다운로드하며 진행률을 표시합니다.

<a id="languages"></a>
### 언어 설정도 함께

中文 · English · 日本語 · 한국어 · Español · Français · Deutsch · Русский · Português

번역 대상, 설정 화면, 작업 문구를 포르투갈어 포함 9개 언어로 제공합니다. 새로고침 후에도 선택이 유지됩니다.

<a id="faq"></a>
## 자주 묻는 질문

<details>
<summary><b>설치·업데이트 후 번역 설정이 보이지 않음</b></summary>

`dsh web`을 완전히 다시 시작하세요. 클라이언트 모듈 구성은 프로세스 시작 시 만들어져 새로고침만으로는 부족할 수 있습니다. 설정 하단에 설치된 패키지 버전이 표시됩니다.

</details>

<details>
<summary><b>로컬 모델 목록이 비어 있음</b></summary>

`ollama list` 또는 `/api/tags`, 실제 모델 경로 및 서비스의 `OLLAMA_MODELS`를 확인하세요. 기존 파일은 다시 다운로드하지 않아도 됩니다.

</details>

<details>
<summary><b>DSH 업데이트 후 client bundles not found 오류</b></summary>

DeepSeek Harness 저장소에서 `pnpm run build`를 실행한 뒤 DSH Web을 다시 시작하세요.

</details>

<details>
<summary><b>번역 실패가 대화에 영향을 주나요?</b></summary>

모든 활성 제공자가 실패해도 원문을 유지합니다. 설정에서 개별 제공자를 테스트하고 최근 오류를 확인하세요. 대기 시간이 지나면 다음 번역 요청이 재시도할 수 있습니다.

</details>

<details>
<summary><b>최근 변경 및 호환성</b></summary>

**1.2.16**: 포르투갈어 번역 대상과 UI 추가. 9개 언어 README와 비교 이미지 갱신, 마켓 이미지 3장 선언.

**1.2.15**: 로컬 모델 메모리 관리 추가. DSH `0.2.2-alpha.2`의 이미지 표시, 사고 묶음 접기, 원문 선택에 대응.

**1.2.13**: 자동 검토 거부 사유 번역 추가. 제보, 초기 패치, 테스트를 제공한 [llg1634](https://github.com/llg1634)에게 감사드립니다.

이전 버전: [GitHub Releases](https://github.com/UncleK/dsh-think-translate/releases).

</details>

<details>
<summary><b>개발 및 동작 원리</b></summary>

- `lib/index.js`: Host 라우트, 제공자, 설정, 메모리 캐시와 로컬 모델 관리.
- `lib/client.js`: 설정, 표시 계층 번역, 스트리밍 분할 및 브라우저 캐시.
- `lib/config.json`: 실행 설정. Git 및 npm에서 제외합니다.
- 추가 빌드 없이 소스가 결과물입니다. Host 수정 후 DSH를 다시 시작합니다.
- 검사: `npm test`. 검색 및 인증 처리는 [유지보수 노트](https://github.com/UncleK/dsh-think-translate/blob/main/docs/maintenance-notes.md)를 참고하세요.

</details>

---

<p align="center">
  <b>dsh-think-translate</b><br />
  <a href="https://github.com/UncleK/dsh-think-translate/issues">문제 제보</a> &nbsp;·&nbsp; <a href="https://github.com/UncleK/dsh-think-translate/releases">릴리스</a> &nbsp;·&nbsp; <a href="https://github.com/UncleK/dsh-think-translate/blob/main/LICENSE">MIT License</a>
</p>
