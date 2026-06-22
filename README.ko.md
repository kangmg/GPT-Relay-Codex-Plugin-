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
