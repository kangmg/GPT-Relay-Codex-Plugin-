# GPT Relay

Local Codex plugin prototype for relaying prompts to ChatGPT through the user's Chrome session or, for server use, through Playwright Chromium with a prepared persistent profile.

By default this keeps the user's current visible ChatGPT Intelligence selection. Callers can request visible ChatGPT Intelligence combinations such as `5.5 Pro extended`, `5.5 Thinking light`, or `5.4 Instant`.

## Current Scope

- Opens ChatGPT in Chrome.
- Selects the requested visible ChatGPT Intelligence model/mode/effort only when explicitly requested; otherwise keeps the current ChatGPT selection.
- Sends a prompt.
- Keeps the ChatGPT tab open by default.
- Stores session URLs, summaries, keywords, and status for later search/continuation.
- Saves the conversation as `pending` immediately after ChatGPT creates a `/c/...` URL, before waiting for the final answer.
- Attaches local files through ChatGPT's visible upload controls first.
- Waits for image attachments to remain stable for 5 seconds before sending, reducing premature sends while images are still uploading.
- Uses clipboard image paste only as a last fallback after upload paths fail.
- Can embed text-like files into the prompt when an attachment is passed with `inline: true`.
- Can continue or poll stored sessions.
- Can request ChatGPT tools: Deep research, Create image, Web search, and Projects.
- Can prefix a prompt with a GPT App mention such as Canva.
- Waits for the assistant response to finish by default.
- Treats generated images as a valid completion signal for Create image tasks.
- Saves generated image artifacts locally and returns Markdown-ready image links.
- Detects completed Deep Research report cards even when there is no standard assistant text.
- Opens the Deep Research report viewer, exports Markdown, validates it, and saves it as an artifact.
- Returns the complete delivery to Codex.
- Provides `finalDeliveryText`, which preserves the full ChatGPT assistant response as display-ready Markdown when possible, including headings, lists, tables, links, inline formatting, generated image Markdown, artifact paths, and the ChatGPT conversation URL on the final line. `finalResponseText` remains available as a compatibility field.

## Limits

- Requires the Chrome plugin and a logged-in ChatGPT session.
- HPC/headless use is available through `scripts/headless_chromium_relay.mjs` with Playwright Chromium and a persistent ChatGPT profile.
- Chrome-extension mode remains the default for plugin and skill local use; Playwright headless is available for server/CLI use and explicit helper runtime selection.
- Stops on login, CAPTCHA, permission, or account prompts.
- First-time login/profile preparation needs a GUI-capable session such as VNC, NoMachine, X11, or a local desktop; the helper does not bypass or automate login, CAPTCHA, payment, permission, or account prompts.
- Do not use the same persistent profile concurrently in simultaneous relay processes.
- Reports the visible ChatGPT Intelligence selection requested or observed; it does not claim hidden backend state.
- Pro mode is the paid ChatGPT Pro Intelligence mode and only supports Standard or Extended effort.
- If Pro is requested but unavailable in the visible account, reports the available models/modes/efforts instead of falling back to another model.
- Default relay calls wait up to six hours for ChatGPT to finish, in short persisted chunks, and should not be replaced by a Codex fallback answer.
- Polling a stored session defaults to 30 minutes for long Pro replies.
- If the outer Codex tool call times out first, search or poll the stored session instead of resending the prompt.
- Not every model exposes every mode or effort; if ChatGPT hides a requested combination, the helper reports `INTELLIGENCE_COMBINATION_UNAVAILABLE` rather than silently changing the request.
- `status: "pending"` is opt-in only with `returnPending: true`; use it only when the user explicitly wants background polling.
- File upload requires Codex Chrome upload permission and Chrome extension file URL access.
- Image uploads send the original file; the helper does not compress images.
- Clipboard paste remains only as a fallback for small images when upload is unavailable.
- Large images do not automatically fall back to native clipboard paste because that can destabilize the Chrome bridge; they return upload permission remediation instead.
- The helper refuses to send the prompt if ChatGPT does not show a confirmed uploaded or pasted attachment before send.
- Chrome-extension mode defaults to `~/.codex/gpt-relay/sessions.json`; Playwright headless mode defaults to `~/.cache/gpt-relay/sessions.json`.
- Set `statePath` or `GPT_RELAY_STATE` to share one explicit session store across runtimes.
- If the Chrome-extension runtime cannot write its default store, it falls back to `nodeRepl.tmpDir`, returns `session.stateWarning`, and later session searches also check that fallback store.
- May need selector updates if ChatGPT changes its UI.
- May need Markdown extraction updates if ChatGPT changes its rendered assistant-message DOM.

## Session Helpers

```js
const {
  runExtendedProRelay,
  startExtendedProRelay,
  continueExtendedProRelay,
  listRelaySessions,
  pollRelaySession,
} = await import("/absolute/path/to/plugin/scripts/chatgpt_relay.mjs");
```

Start a session:

```js
const result = await runExtendedProRelay({
  prompt: "整理一下高達歷代的歷史",
  keepTab: true,
  waitChunkMs: 90000,
  timeoutMs: 6 * 60 * 60 * 1000
});
nodeRepl.write(result.finalDeliveryText ?? result.finalResponseText);
```

Start a session with an explicit Intelligence selection:

```js
const result = await runExtendedProRelay({
  prompt: "請只回覆 OK。",
  model: "5.5",
  mode: "thinking",
  effort: "light",
  keepTab: true,
  timeoutMs: 30 * 60 * 1000
});
nodeRepl.write(result.finalDeliveryText ?? result.finalResponseText);
```

Continue by keyword:

```js
const result = await continueExtendedProRelay({
  query: "高達",
  prompt: "請接著整理模型系列。"
});
nodeRepl.write(result.finalDeliveryText ?? result.finalResponseText);
```

Poll a long-running answer:

```js
const result = await pollRelaySession({
  query: "高達",
  timeoutMs: 30 * 60 * 1000
});
nodeRepl.write(result.finalDeliveryText ?? result.finalResponseText);
```

If the result is still `pending`, call `pollRelaySession` again later with the same query or session id.

Attach an original image or document through ChatGPT upload controls:

```js
await runExtendedProRelay({
  prompt: "請分析這張圖片。",
  attachments: [{ path: "/absolute/path/image.png" }],
  keepTab: true,
  waitChunkMs: 90000,
  timeoutMs: 6 * 60 * 60 * 1000,
  returnPending: false
});
```

Start a long job and return a resumable `pending` result after the first short wait:

```js
await startExtendedProRelay({
  prompt: "請用 Deep research 整理這個大型題目。",
  feature: "deep-research",
  keepTab: true
});
```

Poll a completed Deep Research job and retrieve the report artifact:

```js
const result = await pollRelaySession({
  query: "香港 2026 AI 研究",
  timeoutMs: 90000
});
nodeRepl.write(JSON.stringify({
  status: result.status,
  deepResearch: result.deepResearch,
  reportPath: result.artifacts?.find((artifact) => artifact.kind === "deep-research-report")?.localPath
}, null, 2));
```

Generate an image and return local artifact paths:

```js
const result = await runExtendedProRelay({
  feature: "create-image",
  prompt: "Create image: a cat",
  keepTab: true,
  timeoutMs: 6 * 60 * 60 * 1000
});
nodeRepl.write(JSON.stringify({
  status: result.status,
  artifacts: result.artifacts,
  imageMarkdown: result.imageMarkdown
}, null, 2));
```

When `imageMarkdown` is present, paste those Markdown lines into the Codex reply so the generated image renders in the current conversation.

## HPC / Headless Chromium CLI

Install package dependencies from the repository root, then install the Chromium browser and Linux system dependencies Playwright needs:

```bash
npm install
npx playwright install --with-deps chromium
```

Run the server doctor without launching Chromium:

```bash
npm run headless:doctor -- --json --no-launch
```

The direct CLI is:

```bash
node plugins/gpt-relay/scripts/headless_chromium_relay.mjs
```

Doctor JSON is intended for server setup checks and automation logs. It reports configuration readiness such as runtime, persistent profile path, profile readability/writability, session state path, Playwright importability, optional browser-launch status, warnings, and remediation. `--doctor --json --no-launch` does not send a prompt or open ChatGPT.

Defaults:

- Persistent profile: `~/.cache/gpt-relay/chromium-profile`
- Session state: `~/.cache/gpt-relay/sessions.json`

Prepare a persistent ChatGPT profile once in a GUI session:

```bash
node plugins/gpt-relay/scripts/headless_chromium_relay.mjs \
  --login \
  --profile ~/.cache/gpt-relay/chromium-profile
```

First-time ChatGPT login, CAPTCHA, account, and permission prompts are not bypassed or automated. Complete them in a GUI-capable session such as VNC, NoMachine, X11, or a local desktop.

Run later from SSH or a batch job with the same persistent profile. Do not use the same profile concurrently in simultaneous relay processes.

```bash
node plugins/gpt-relay/scripts/headless_chromium_relay.mjs \
  --profile ~/.cache/gpt-relay/chromium-profile \
  --model 5.5 \
  --mode pro \
  --prompt "너 무슨 모델이냐?"
```

Runtime/config environment variables:

- `GPT_RELAY_RUNTIME=chrome|playwright`
- `GPT_RELAY_PROFILE`
- `GPT_RELAY_STATE`
- `GPT_RELAY_CHROMIUM_CHANNEL`
- `GPT_RELAY_CHROMIUM_EXECUTABLE`
- `GPT_RELAY_HEADLESS`
- `GPT_RELAY_CHROMIUM_ARGS`

CLI options include `--doctor`, `--json`, `--no-launch`, `--profile`, `--state-path`, `--channel`, `--executable-path`, repeated `--browser-arg`, and `--login`. The relay does not recommend `--no-sandbox` by default; risky explicit browser arguments are operator-owned, and doctor mode warns about them.
