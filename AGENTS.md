# PROJECT KNOWLEDGE BASE

**Generated:** 2026-06-24
**Commit:** 7c1dc2f
**Branch:** main

## OVERVIEW
Community Codex plugin that relays prompts to ChatGPT through either the Codex Chrome extension runtime or the Playwright Chromium headless CLI. The core is a single ESM plugin package under `plugins/gpt-relay`.

## STRUCTURE
```text
.
├── README.md / README.en.md / README.ko.md  # synchronized user docs
├── media/                                   # README/plugin screenshots and demo media
├── .agents/plugins/marketplace.json         # local marketplace entry
└── plugins/gpt-relay/
    ├── .codex-plugin/plugin.json            # plugin manifest
    ├── README.md                            # plugin-local docs
    ├── skills/gpt-relay/SKILL.md            # Codex operational contract
    ├── scripts/chatgpt_relay.mjs            # main relay implementation
    ├── scripts/headless_chromium_relay.mjs  # Playwright Chromium CLI
    ├── scripts/playwright_chromium_adapter.mjs
    ├── scripts/chatgpt_relay.test.mjs       # node:test suite
    ├── native/macos-copy-image-to-clipboard.m
    └── docs/                                # selector, QA, and Deep Research notes
```

## WHERE TO LOOK
| Task | Location | Notes |
| --- | --- | --- |
| Relay behavior/API | `plugins/gpt-relay/scripts/chatgpt_relay.mjs` | Exports `runExtendedProRelay`, `startExtendedProRelay`, `continueExtendedProRelay`, `pollRelaySession`, `listRelaySessions`, `getRelaySession`. Large hotspot; keep edits narrow. |
| Headless server CLI | `plugins/gpt-relay/scripts/headless_chromium_relay.mjs` | CLI wrapper around Playwright Chromium and `runExtendedProRelay`. |
| Browser facade | `plugins/gpt-relay/scripts/playwright_chromium_adapter.mjs` | Implements the browser/tab shape consumed by `chatgpt_relay.mjs`. |
| Codex skill behavior | `plugins/gpt-relay/skills/gpt-relay/SKILL.md` | Runtime expectations and final-output contract that Codex follows. |
| Plugin metadata | `plugins/gpt-relay/.codex-plugin/plugin.json` | Marketplace-facing description, capabilities, prompts, logo paths. |
| ChatGPT UI selectors | `plugins/gpt-relay/docs/chatgpt-ui-observations.md` | Visible UI contract; update when selectors or model menus change. |
| QA/runtime history | `plugins/gpt-relay/docs/qa-2026-06-08.md` | Known smoke results, blockers, and final check commands. |
| Deep Research behavior | `plugins/gpt-relay/docs/deep-research-optimization-2026-06-08.md` | Report-card/viewer/export state machine evidence. |

## CODE MAP
| Symbol | Type | Location | Role |
| --- | --- | --- | --- |
| `runExtendedProRelay` | export function | `plugins/gpt-relay/scripts/chatgpt_relay.mjs` | Main one-shot relay entry. |
| `startExtendedProRelay` | export function | `plugins/gpt-relay/scripts/chatgpt_relay.mjs` | Starts a resumable pending relay. |
| `continueExtendedProRelay` | export function | `plugins/gpt-relay/scripts/chatgpt_relay.mjs` | Continues a stored session. |
| `pollRelaySession` | export function | `plugins/gpt-relay/scripts/chatgpt_relay.mjs` | Polls stored pending/long-running sessions. |
| `createPlaywrightChromiumBrowser` | export function | `plugins/gpt-relay/scripts/playwright_chromium_adapter.mjs` | Creates the Playwright browser facade. |
| `main` | CLI boundary | `plugins/gpt-relay/scripts/headless_chromium_relay.mjs` | Parses CLI args, creates browser, runs relay. |

## CONVENTIONS
- Keep `README.md`, `README.en.md`, `README.ko.md`, and `plugins/gpt-relay/README.md` synchronized for install, headless, login/profile, and update instructions.
- Keep `plugins/gpt-relay/skills/gpt-relay/SKILL.md` synchronized with any runtime, session, polling, final-output, or safety contract change.
- Preserve `finalDeliveryText` behavior: complete relay results must be returned verbatim by Codex when the helper sets the final-delivery flags.
- Treat visible ChatGPT UI labels/roles as the automation contract; do not rely on hidden app state.
- Use `node --test plugins/gpt-relay/scripts/chatgpt_relay.test.mjs` for the main unit suite.
- Use `node --check` on edited `.mjs` files because there is no TypeScript compiler setup in this repo.

## ANTI-PATTERNS (THIS PROJECT)
- Do not remove or silently break the Chrome extension runtime while adding headless support.
- Do not inspect cookies, local storage, passwords, browser profiles, or session stores.
- Do not bypass ChatGPT login, CAPTCHA, payment, permission, or account prompts.
- Do not use the lower-left account/profile control as a model selector.
- Do not silently fall back to another model/mode/effort when ChatGPT hides a requested combination.
- Do not use plain `innerText` as the final answer source if structured Markdown extraction is available.
- Do not wrap complete relay output in a code block or summarize it when `finalDeliveryText` is required verbatim.
- Do not treat `pending` as the default result; it is opt-in only.
- Do not rely on `Copy contents` alone for Deep Research export; Markdown export is the reliable path documented here.
- Do not add broad rewrites to `chatgpt_relay.mjs`; it is the main hotspot and should be changed with tight tests.

## COMMANDS
```bash
node --check plugins/gpt-relay/scripts/chatgpt_relay.mjs
node --check plugins/gpt-relay/scripts/headless_chromium_relay.mjs
node --check plugins/gpt-relay/scripts/playwright_chromium_adapter.mjs
node --test plugins/gpt-relay/scripts/chatgpt_relay.test.mjs
node plugins/gpt-relay/scripts/headless_chromium_relay.mjs --help
```

## NOTES
- TypeScript LSP is not installed in this environment; use source reads, `rg`, and Node checks unless the user explicitly authorizes LSP installation.
- `chatgpt_relay.mjs` is over 4,900 lines. Prefer extracting small helpers only when it reduces real complexity; avoid unrelated cleanup.
- Headless server work should use Playwright Chromium with a separate persistent automation profile. Do not point automation at the user's normal Chrome profile.
- First-time ChatGPT login still needs a GUI-capable session such as VNC, NoMachine, or X11; headless mode reuses the prepared profile.
