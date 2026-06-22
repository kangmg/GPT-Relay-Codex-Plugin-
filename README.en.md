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

For HPC or SSH-only use, run the relay from the cloned checkout with Playwright Chromium. This mode does not use the Codex Chrome extension, but it still needs a persistent ChatGPT browser profile.

Install Playwright in the checkout:

```bash
npm install playwright
npx playwright install chromium
```

Prepare the ChatGPT profile once in a GUI session such as VNC, NoMachine, or X11:

```bash
node plugins/gpt-relay/scripts/headless_chromium_relay.mjs \
  --login \
  --profile ~/.cache/gpt-relay/chromium-profile
```

After login succeeds, reuse the same profile from CLI or a batch job:

```bash
node plugins/gpt-relay/scripts/headless_chromium_relay.mjs \
  --profile ~/.cache/gpt-relay/chromium-profile \
  --model 5.5 \
  --mode pro \
  --prompt "너 무슨 모델이냐?"
```

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
