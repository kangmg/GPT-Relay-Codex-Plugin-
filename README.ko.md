# GPT Relay Codex Plugin

[Main README](./README.md) | [English details](./README.en.md)

GPT Relay는 Codex가 로그인된 Chrome 세션을 통해 ChatGPT에 프롬프트를 보내고, 완료된 답변을 다시 Codex로 가져오게 해주는 플러그인입니다.

## 설치

저장소를 clone한 뒤, 로컬 checkout을 Codex plugin marketplace로 추가합니다.

```bash
git clone https://github.com/kangmg/GPT-Relay-Codex-Plugin-.git
codex plugin marketplace add ./GPT-Relay-Codex-Plugin-
codex plugin add gpt-relay@gpt-relay
```

그 다음 새 Codex thread를 시작하세요.

로컬 개발 checkout을 쓰는 경우에는 절대 경로를 넘기면 됩니다.

```bash
codex plugin marketplace add /absolute/path/to/GPT-Relay-Codex-Plugin-
codex plugin add gpt-relay@gpt-relay
```

기존 thread는 이전 캐시를 계속 쓸 수 있으므로, 재설치 후에는 새 thread를 여는 것이 좋습니다.

## HPC / Headless Chromium

HPC나 SSH 전용 환경에서는 clone한 checkout에서 Playwright Chromium으로 릴레이를 실행할 수 있습니다. 이 모드는 Codex Chrome extension을 쓰지 않지만, ChatGPT에 로그인된 persistent browser profile은 필요합니다.

repository root에서 package dependency를 설치한 뒤, Playwright가 사용할 Chromium browser와 Linux system dependency를 설치합니다.

```bash
npm install
npx playwright install --with-deps chromium
```

ChatGPT를 열지 않고 server 설정을 점검합니다.

```bash
npm run headless:doctor -- --json --no-launch
```

같은 doctor를 direct CLI로 실행할 수도 있습니다.

```bash
node plugins/gpt-relay/scripts/headless_chromium_relay.mjs --doctor --json --no-launch
```

VNC, NoMachine, X11 같은 GUI 세션에서 한 번 ChatGPT 로그인을 준비합니다.

```bash
node plugins/gpt-relay/scripts/headless_chromium_relay.mjs \
  --login \
  --profile ~/.cache/gpt-relay/chromium-profile
```

첫 ChatGPT 로그인, CAPTCHA, 계정 확인, 권한 prompt는 우회하거나 자동화하지 않습니다. VNC, NoMachine, X11, local desktop 같은 GUI-capable session에서 직접 완료해야 합니다. 기본 persistent profile은 `~/.cache/gpt-relay/chromium-profile`이고, 기본 session state file은 `~/.cache/gpt-relay/sessions.json`입니다.

로그인이 끝난 뒤에는 같은 persistent profile을 SSH, CLI, batch job에서 재사용합니다. 같은 profile을 동시에 여러 relay process에서 함께 쓰지 마세요.

```bash
node plugins/gpt-relay/scripts/headless_chromium_relay.mjs \
  --profile ~/.cache/gpt-relay/chromium-profile \
  --model 5.5 \
  --mode pro \
  --prompt "너 무슨 모델이냐?"
```

Runtime과 path는 `GPT_RELAY_RUNTIME=chrome|playwright`, `GPT_RELAY_PROFILE`, `GPT_RELAY_STATE`, `GPT_RELAY_CHROMIUM_CHANNEL`, `GPT_RELAY_CHROMIUM_EXECUTABLE`, `GPT_RELAY_HEADLESS`, `GPT_RELAY_CHROMIUM_ARGS`로 설정할 수 있습니다. Plugin/skill local use에서는 Chrome-extension mode가 기본이고, Playwright headless는 server/CLI와 명시적 helper runtime selection에서 사용할 수 있습니다.

CLI option에는 `--doctor`, `--json`, `--no-launch`, `--profile`, `--state-path`, `--channel`, `--executable-path`, 반복 가능한 `--browser-arg`, `--login`이 있습니다. 기본값으로 `--no-sandbox`를 권장하지 않습니다. 위험한 explicit browser arg는 operator 책임이며 doctor mode가 경고합니다.

## 요구 사항

- 플러그인을 지원하는 Codex
- 설치 및 활성화된 공식 Codex Chrome extension
- Chrome에서 로그인된 ChatGPT 세션
- 요청하려는 모델 또는 도구에 접근 가능한 ChatGPT 계정

로컬 파일이나 이미지를 업로드하려면 Chrome extension details에서 Codex Chrome extension의 **Allow access to file URLs**를 켜야 합니다.

## 업데이트

로컬 checkout에서 업데이트를 받은 뒤 플러그인을 다시 설치합니다.

```bash
git pull
codex plugin add gpt-relay@gpt-relay
```

그 다음 새 Codex thread를 시작하세요.

## 참고

- GPT Relay는 보이는 ChatGPT 웹 UI를 조작합니다.
- 플러그인은 화면에 보이는 ChatGPT 모델, 모드, effort 선택만 보고합니다.
- 로그인, CAPTCHA, 권한 팝업, 계정에서 사용할 수 없는 기능이 나오면 중단합니다.
