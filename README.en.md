# GPT Relay Codex Plugin

[Main README](./README.md) | [中文说明](./README.zh-Hant.md)

GPT Relay lets Codex delegate prompts to ChatGPT through your logged-in Chrome session and return the completed answer to Codex.

## Install

```bash
codex plugin marketplace add kangmg/GPT-Relay-Codex-Plugin-
```

Then install **GPT Relay** from Codex **Plugins** -> **Manage** and start a new thread.

For local development:

```bash
codex plugin marketplace add /absolute/path/to/GPT-Relay-Codex-Plugin-
```

Reinstall or update the plugin in the Codex UI after changing marketplace sources.

If you are replacing an older marketplace source, remove that source before adding the new one.

## Requirements

- Codex with plugin support.
- Official Codex Chrome extension installed and enabled.
- Logged-in ChatGPT session in Chrome.
- ChatGPT account access to the requested model or tool.

For local file uploads, enable **Allow access to file URLs** for the Codex Chrome extension.

## Update

```bash
codex plugin marketplace upgrade gpt-relay
```

Then update or reinstall **GPT Relay** in the Codex Plugins UI and start a new thread.

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
