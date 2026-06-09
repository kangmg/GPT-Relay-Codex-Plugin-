# GPT Relay Codex Plugin

[Main README](./README.md) | [中文说明](./README.zh-Hant.md)

GPT Relay lets Codex delegate a task to ChatGPT through your existing Chrome session. It can request visible ChatGPT Intelligence combinations, wait for the final answer, and return the full result to Codex.

## Why This Exists

Codex is excellent for coding work, local files, and automation. ChatGPT may have account-specific UI features such as Pro mode, Deep Research, image generation, and visible model/mode/effort controls. GPT Relay bridges those workflows by letting Codex operate ChatGPT in Chrome when you explicitly ask it to.

## Installation

From the Codex UI:

| Field | Value |
| --- | --- |
| Source | `Toolsai/GPT-Relay-Codex-Plugin-` |
| Git ref | `main` |
| Sparse paths | Leave blank for normal install. Optional: `.agents/plugins` and `plugins/gpt-relay`. |

Or add the marketplace from the CLI:

```bash
codex plugin marketplace add Toolsai/GPT-Relay-Codex-Plugin-
```

Then install **GPT Relay** from the Codex Plugins UI and open a new Codex thread.

The Add marketplace dialog installs this repository as a custom Codex marketplace source. It is not the same thing as publishing to an official built-in OpenAI marketplace.

## Chrome Setup

GPT Relay controls ChatGPT through your existing Chrome session, so you need the official Codex Chrome extension installed and enabled.

### Install The Codex Chrome Extension

Install the official Codex extension from the Chrome Web Store:

[Codex on Chrome Web Store](https://chromewebstore.google.com/detail/codex/hehggadaopoacecdllhhajmbjkdcmajg)

![Codex Chrome extension on Chrome Web Store](./media/chrome-web-store-codex-extension.png)

### Enable File Uploads

If you want GPT Relay to upload local files or images to ChatGPT, enable file URL access for the Codex Chrome extension:

1. Open Chrome **Manage Extensions**.
2. Open **Details** for the Codex extension.
3. Turn on **Allow access to file URLs**.

![Allow access to file URLs for Codex Chrome extension](./media/chrome-extension-file-urls.png)

## Repository Layout

```text
.agents/plugins/marketplace.json
plugins/gpt-relay/
  .codex-plugin/plugin.json
  skills/gpt-relay/SKILL.md
  scripts/chatgpt_relay.mjs
  assets/logo.png
media/
  plugin-install-screen.png
  gpt-relay-demo.gif
  chrome-web-store-codex-extension.png
  chrome-extension-file-urls.png
```

## Capabilities

- Visible ChatGPT Intelligence selection.
- Default behavior that preserves your current ChatGPT selection unless you request a change.
- Pro effort handling: Standard and Extended.
- Thinking effort handling: Light, Standard, Extended, and Heavy when visible.
- Clear unavailable-option errors instead of silent fallback.
- Prompt relay, file upload, image generation, web search, and Deep Research requests.
- Full delivery back to Codex with Markdown formatting, images, artifacts, and conversation URLs.
- Stored session metadata for continuation and polling.

## Limitations

- Requires the official Codex Chrome extension and an active ChatGPT login.
- Local file uploads require **Allow access to file URLs** to be enabled for the Codex Chrome extension.
- Availability depends on your ChatGPT account.
- The plugin operates the visible ChatGPT web UI, so ChatGPT UI changes may require plugin updates.
- Long-running tasks may need polling from Codex.

## Developer

Created by Prompt Case.
