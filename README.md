# GPT Relay Codex Plugin

[한국어](./README.ko.md) | [English details](./README.en.md)

GPT Relay lets Codex send a prompt to ChatGPT through your logged-in Chrome session, wait for the answer, and return the result to Codex.

It is useful when you want Codex to use visible ChatGPT web features such as GPT 5.5 Pro, Pro Extended, Deep Research, image generation, web search, or file uploads.

This is a community plugin, not an official OpenAI or ChatGPT product.

## Install

Clone the repository, then add the local checkout as a Codex plugin marketplace:

```bash
git clone https://github.com/kangmg/GPT-Relay-Codex-Plugin-.git
codex plugin marketplace add ./GPT-Relay-Codex-Plugin-
codex plugin add gpt-relay@gpt-relay
```

Then start a new Codex thread.

Check the registered marketplace:

```bash
codex plugin marketplace list
```

## Local Development

For a local development checkout, pass the absolute path instead of `./GPT-Relay-Codex-Plugin-`. Existing threads may keep using the previously cached plugin, so start a new thread after reinstalling.

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

After pulling updates into the local checkout:

```bash
git pull
codex plugin add gpt-relay@gpt-relay
```

Then start a new Codex thread.

## Notes

- GPT Relay operates the visible ChatGPT web UI, so ChatGPT UI changes may require plugin updates.
- The plugin reports the visible model, mode, and effort selected in ChatGPT. It does not claim hidden backend model state.
- It stops on login prompts, CAPTCHA, permission dialogs, or unavailable account features.
