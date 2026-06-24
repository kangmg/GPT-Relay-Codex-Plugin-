#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { runExtendedProRelay } from "./chatgpt_relay.mjs";
import { CliError, parseArgs } from "./headless_cli_args.mjs";
import { helpText, resolveHeadlessConfig } from "./headless_cli_config.mjs";
import {
  defaultImportPlaywright,
  redactSensitiveError,
  runDoctor,
  writeDoctorReport,
} from "./headless_doctor.mjs";
import { createPlaywrightChromiumBrowser, expandPath } from "./playwright_chromium_adapter.mjs";

export { parseArgs } from "./headless_cli_args.mjs";
export { helpText, resolveHeadlessConfig } from "./headless_cli_config.mjs";

const CHATGPT_URL = "https://chatgpt.com/";

export async function main(options = {}) {
  const {
    argv = process.argv.slice(2),
    env = process.env,
    stdin = process.stdin,
    stdout = process.stdout,
    stderr = process.stderr,
    createBrowser = createPlaywrightChromiumBrowser,
    relay = runExtendedProRelay,
    importPlaywright = defaultImportPlaywright,
  } = options;

  const args = parseArgs(argv);
  if (args.help) {
    stdout.write(helpText());
    return 0;
  }

  const config = resolveHeadlessConfig(args, env);
  globalThis.__gpt55RelayStatePath = config.statePath;

  if (args.doctor) {
    const report = await runDoctor(config, {
      noLaunch: args.noLaunch,
      createBrowser,
      importPlaywright,
    });
    writeDoctorReport(report, { json: args.json, stdout });
    return 0;
  }

  if (config.runtime !== "playwright") {
    throw new CliError(
      `headless_chromium_relay.mjs requires runtime 'playwright', received '${config.runtime}'.`,
      "INVALID_RUNTIME"
    );
  }

  let prompt = "";
  if (!args.login) {
    prompt = await resolvePrompt(args, stdin);
    if (!prompt.trim()) {
      throw new CliError("Prompt is required. Pass --prompt, --prompt-file, positional text, or stdin.", "PROMPT_REQUIRED");
    }
  }

  const browser = await createBrowser({
    userDataDir: config.profilePath,
    headless: config.headless,
    channel: config.channel,
    executablePath: config.executablePath,
    args: config.browserArgs,
    closeOnFinalize: true,
  });

  try {
    if (args.login) {
      await runLoginFlow(browser, args, config, stderr, stdout);
      return 0;
    }

    const result = await relay({
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
      statePath: config.statePath,
      timeoutMs: args.timeoutMs ?? 6 * 60 * 60 * 1000,
      waitChunkMs: args.waitChunkMs ?? 90000,
      uploadTimeoutMs: args.uploadTimeoutMs ?? 30000,
      returnPending: args.returnPending ?? false,
    });

    if (args.json) {
      stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      stdout.write(`${result.finalDeliveryText ?? result.finalResponseText ?? result.assistantText ?? ""}\n`);
    }
    return 0;
  } finally {
    await browser.close();
  }
}

async function runLoginFlow(browser, args, config, stderr, stdout) {
  const tab = await browser.tabs.new();
  await tab.goto(CHATGPT_URL);
  stderr.write([
    "Open the Chromium window, log in to ChatGPT, and wait until the composer appears.",
    `Profile: ${config.profilePath}`,
    "",
  ].join("\n"));

  const timeoutMs = args.loginTimeoutMs ?? 10 * 60 * 1000;
  const composer = tab.playwright.getByRole("textbox", { name: "Chat with ChatGPT" });
  await composer.waitFor({ state: "visible", timeout: timeoutMs });
  stdout.write("ChatGPT login profile is ready.\n");
}

async function resolvePrompt(args, stdin = process.stdin) {
  if (args.promptFile) {
    return readFile(expandPath(args.promptFile), "utf8");
  }
  if (args.prompt) {
    return args.prompt;
  }
  if (args.positionals.length > 0) {
    return args.positionals.join(" ");
  }
  if (!stdin.isTTY) {
    return await readStdin(stdin);
  }
  return "";
}

async function readStdin(stdin) {
  const chunks = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isDirectRun() {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

export function formatCliError(error) {
  const message = redactSensitiveError(error?.message ?? error);
  return `${error?.code ? `${error.code}: ` : ""}${message}\n`;
}

export const __testing = {
  runLoginFlow,
};

if (isDirectRun()) {
  main().catch((error) => {
    process.stderr.write(formatCliError(error));
    process.exitCode = 1;
  });
}
