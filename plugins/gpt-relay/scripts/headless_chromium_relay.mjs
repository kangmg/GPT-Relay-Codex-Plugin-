#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createPlaywrightChromiumBrowser, defaultUserDataDir, expandPath } from "./playwright_chromium_adapter.mjs";
import { runExtendedProRelay } from "./chatgpt_relay.mjs";

const CHATGPT_URL = "https://chatgpt.com/";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(helpText());
    return;
  }

  const profile = expandPath(args.profile ?? args.userDataDir ?? process.env.GPT_RELAY_PROFILE ?? defaultUserDataDir());
  const statePath = expandPath(args.statePath ?? process.env.GPT_RELAY_STATE ?? path.join(os.homedir(), ".cache", "gpt-relay", "sessions.json"));
  const headless = args.headed ? false : args.headless !== false;
  const browser = await createPlaywrightChromiumBrowser({
    userDataDir: profile,
    headless,
    channel: args.channel,
    executablePath: args.executablePath,
    closeOnFinalize: true,
  });

  globalThis.__gpt55RelayStatePath = statePath;

  try {
    if (args.login) {
      await runLoginFlow(browser, args);
      return;
    }

    const prompt = await resolvePrompt(args);
    if (!prompt.trim()) {
      throw new Error("Prompt is required. Pass --prompt, --prompt-file, positional text, or stdin.");
    }

    const result = await runExtendedProRelay({
      browser,
      prompt,
      model: args.model,
      mode: args.mode,
      effort: args.effort,
      feature: args.feature,
      projectName: args.project,
      appName: args.app,
      attachments: args.attachments.map((entry) => ({ path: expandPath(entry) })),
      keepTab: false,
      statePath,
      timeoutMs: args.timeoutMs ?? 6 * 60 * 60 * 1000,
      waitChunkMs: args.waitChunkMs ?? 90000,
      uploadTimeoutMs: args.uploadTimeoutMs ?? 30000,
      returnPending: args.returnPending ?? false,
    });

    if (args.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(`${result.finalDeliveryText ?? result.finalResponseText ?? result.assistantText ?? ""}\n`);
    }
  } finally {
    await browser.close();
  }
}

async function runLoginFlow(browser, args) {
  const tab = await browser.tabs.new();
  await tab.goto(CHATGPT_URL);
  process.stderr.write([
    "Open the Chromium window, log in to ChatGPT, and wait until the composer appears.",
    `Profile: ${args.profile ?? defaultUserDataDir()}`,
    "",
  ].join("\n"));

  const timeoutMs = args.loginTimeoutMs ?? 10 * 60 * 1000;
  const composer = tab.playwright.getByRole("textbox", { name: "Chat with ChatGPT" });
  await composer.waitFor({ state: "visible", timeoutMs });
  process.stdout.write("ChatGPT login profile is ready.\n");
}

async function resolvePrompt(args) {
  if (args.promptFile) {
    return readFile(expandPath(args.promptFile), "utf8");
  }
  if (args.prompt) {
    return args.prompt;
  }
  if (args.positionals.length > 0) {
    return args.positionals.join(" ");
  }
  if (!process.stdin.isTTY) {
    return await readStdin();
  }
  return "";
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseArgs(argv) {
  const args = {
    attachments: [],
    positionals: [],
    headless: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      args.positionals.push(token);
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const key = camelCase(rawKey);
    const takesValue = !new Set([
      "help",
      "headed",
      "headless",
      "login",
      "json",
      "returnPending",
    ]).has(key);
    const value = inlineValue ?? (takesValue ? argv[++index] : true);

    switch (key) {
      case "help":
        args.help = true;
        break;
      case "headed":
        args.headed = true;
        args.headless = false;
        break;
      case "headless":
        args.headless = value === true ? true : !/^(false|0|no)$/i.test(String(value));
        break;
      case "login":
        args.login = true;
        args.headed = true;
        args.headless = false;
        break;
      case "attachment":
      case "file":
        args.attachments.push(value);
        break;
      case "timeoutMs":
      case "waitChunkMs":
      case "uploadTimeoutMs":
      case "loginTimeoutMs":
        args[key] = Number(value);
        break;
      case "json":
      case "returnPending":
        args[key] = true;
        break;
      default:
        args[key] = value;
        break;
    }
  }

  return args;
}

function camelCase(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function helpText() {
  return `Usage:
  node plugins/gpt-relay/scripts/headless_chromium_relay.mjs --login --profile ~/.cache/gpt-relay/chromium-profile
  node plugins/gpt-relay/scripts/headless_chromium_relay.mjs --profile ~/.cache/gpt-relay/chromium-profile --model 5.5 --mode pro --prompt "너 무슨 모델이냐?"

Options:
  --login                 Open headed Chromium and wait for ChatGPT login.
  --profile PATH          Persistent Chromium profile directory.
  --state-path PATH       Session metadata path. Defaults to ~/.cache/gpt-relay/sessions.json.
  --headed                Run with a visible browser window.
  --headless=false        Same as --headed.
  --model VALUE           Visible ChatGPT model, for example 5.5.
  --mode VALUE            Visible mode: instant, thinking, or pro.
  --effort VALUE          Reasoning effort, for example standard or extended.
  --feature VALUE         ChatGPT tool feature: deep-research, create-image, web-search.
  --attachment PATH       Attach a local file. May be repeated.
  --prompt TEXT           Prompt text.
  --prompt-file PATH      Read prompt text from a file.
  --json                  Print the full relay result JSON.
`;
}

main().catch((error) => {
  process.stderr.write(`${error?.code ? `${error.code}: ` : ""}${error?.message ?? error}\n`);
  process.exitCode = 1;
});
