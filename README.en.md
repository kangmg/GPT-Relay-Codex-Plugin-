# GPT Relay Codex Plugin

[Main README](./README.md) | [한국어](./README.ko.md)

GPT Relay lets Codex delegate prompts to ChatGPT through your logged-in Chrome session and return the completed answer to Codex.

## Install

```bash
git clone https://github.com/kangmg/GPT-Relay-Codex-Plugin-.git
codex plugin marketplace add ./GPT-Relay-Codex-Plugin-
codex plugin add gpt-relay@gpt-relay
```

Then start a new Codex thread.

For a local development checkout, pass the absolute path instead:

```bash
codex plugin marketplace add /absolute/path/to/GPT-Relay-Codex-Plugin-
codex plugin add gpt-relay@gpt-relay
```

Existing threads may keep using the previously cached plugin, so start a new thread after reinstalling.

## HPC / Headless Chromium

For HPC or SSH-only use, run the relay from the cloned checkout with CloakBrowser Chromium by default. This mode does not use the Codex Chrome extension, but it still needs a persistent ChatGPT browser profile.

Install package dependencies from the repository root. CloakBrowser downloads its Chromium binary on first launch:

```bash
npm install
```

Check the server configuration without opening ChatGPT:

```bash
npm run headless:doctor -- --json --no-launch
```

The equivalent direct CLI is:

```bash
node plugins/gpt-relay/scripts/headless_chromium_relay.mjs --doctor --json --no-launch
```

Prepare the ChatGPT profile once in a GUI session such as VNC, NoMachine, or X11:

```bash
node plugins/gpt-relay/scripts/headless_chromium_relay.mjs \
  --login \
  --profile ~/.cache/gpt-relay/cloak-profile
```

First-time ChatGPT login, CAPTCHA, account, and permission prompts are not bypassed or automated. Complete them in a GUI-capable session such as VNC, NoMachine, X11, or a local desktop. The default persistent profile is `~/.cache/gpt-relay/cloak-profile`, and the default session state file is `~/.cache/gpt-relay/sessions.json`.

After login succeeds, reuse the same persistent profile from SSH, CLI, or a batch job. Do not use the same profile concurrently in simultaneous relay processes.

```bash
node plugins/gpt-relay/scripts/headless_chromium_relay.mjs \
  --profile ~/.cache/gpt-relay/cloak-profile \
  --model 5.5 \
  --mode pro \
  --prompt "너 무슨 모델이냐?"
```

Runtime selection and paths can be configured with `GPT_RELAY_RUNTIME=chrome|cloak`, `GPT_RELAY_PROFILE`, `GPT_RELAY_STATE`, `GPT_RELAY_CLOAK_LICENSE_KEY`, `GPT_RELAY_CLOAK_BROWSER_VERSION`, `GPT_RELAY_CLOAK_HUMANIZE`, `GPT_RELAY_CHROMIUM_EXECUTABLE`, `GPT_RELAY_HEADLESS`, and `GPT_RELAY_CHROMIUM_ARGS`. Chrome-extension mode remains the default for plugin and skill use; CloakBrowser Chromium is the only headless server/CLI runtime.

CLI options include `--doctor`, `--json`, `--no-launch`, `--profile`, `--state-path`, `--channel`, `--executable-path`, repeated `--browser-arg`, `--cloak-license-key`, `--cloak-browser-version`, `--cloak-humanize`, and `--login`. The relay does not solve or bypass CAPTCHA or human verification; those prompts still stop the relay and must be completed by the user. The relay does not recommend `--no-sandbox` by default; risky explicit browser arguments are operator-owned, and doctor mode warns about them.

## Requirements

- Codex with plugin support.
- Official Codex Chrome extension installed and enabled.
- Logged-in ChatGPT session in Chrome.
- ChatGPT account access to the requested model or tool.

For local file uploads, enable **Allow access to file URLs** for the Codex Chrome extension.

## Update

```bash
git pull
codex plugin add gpt-relay@gpt-relay
```

Then start a new Codex thread.

## Repository Layout

```text
.agents/plugins/marketplace.json
plugins/gpt-relay/
  .codex-plugin/plugin.json
  skills/gpt-relay/SKILL.md
  scripts/chatgpt_relay.mjs
```

## Notes

- GPT Relay operates the visible ChatGPT web UI.
- It reports visible ChatGPT model, mode, and effort selections only.
- Login prompts, CAPTCHA, permission dialogs, or unavailable account features stop the relay.
