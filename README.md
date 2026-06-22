# GPT Relay Codex Plugin

GPT Relay lets Codex send a prompt to ChatGPT through your logged-in Chrome session, wait for the answer, and return the result to Codex.

It is useful when you want Codex to use visible ChatGPT web features such as GPT 5.5 Pro, Pro Extended, Deep Research, image generation, web search, or file uploads.

This is a community plugin, not an official OpenAI or ChatGPT product.

## Install

Add this repository as a Codex plugin marketplace:

```bash
codex plugin marketplace add kangmg/GPT-Relay-Codex-Plugin-
```

Then open Codex **Plugins** -> **Manage**, install **GPT Relay**, and start a new Codex thread.

If you already added an older marketplace source, remove it first:

```bash
codex plugin marketplace remove gpt-relay
codex plugin marketplace add kangmg/GPT-Relay-Codex-Plugin-
```

Check the registered marketplace:

```bash
codex plugin marketplace list
```

## Local Development Install

From a local checkout, add the folder itself as the marketplace:

```bash
codex plugin marketplace remove gpt-relay
codex plugin marketplace add /absolute/path/to/GPT-Relay-Codex-Plugin-
```

Reinstall or update **GPT Relay** from the Codex Plugins UI, then start a new thread. Existing threads may keep using the previously cached plugin.

## Chrome Setup

GPT Relay controls the visible ChatGPT web UI through Chrome. You need:

- Codex with plugin support.
- The official Codex Chrome extension installed and enabled.
- A logged-in ChatGPT session in Chrome.
- ChatGPT account access to the model or tool you request.

Install the Codex Chrome extension:

[Codex on Chrome Web Store](https://chromewebstore.google.com/detail/codex/hehggadaopoacecdllhhajmbjkdcmajg)

For local file or image uploads, enable **Allow access to file URLs** for the Codex Chrome extension in Chrome extension details.

## Usage Examples

```text
Use GPT 5.5 Pro Extended to analyze this question: ...
```

```text
Run Deep Research on this topic: ...
```

```text
Switch to GPT 5.4 Thinking Light and analyze this image.
```

## Update

For a GitHub marketplace install:

```bash
codex plugin marketplace upgrade gpt-relay
```

Then update or reinstall **GPT Relay** in the Codex Plugins UI and start a new thread.

## Notes

- GPT Relay operates the visible ChatGPT web UI, so ChatGPT UI changes may require plugin updates.
- The plugin reports the visible model, mode, and effort selected in ChatGPT. It does not claim hidden backend model state.
- It stops on login prompts, CAPTCHA, permission dialogs, or unavailable account features.
