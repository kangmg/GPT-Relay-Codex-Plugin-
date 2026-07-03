import os from "node:os";
import path from "node:path";
import { CliError, parseOptionalBoolean } from "./headless_cli_args.mjs";
import { defaultCloakUserDataDir, expandPath } from "./playwright_chromium_adapter.mjs";

export const CLOAKBROWSER_REMEDIATION = "Run `npm install` in the checkout. CloakBrowser downloads its Chromium binary on first launch.";

const DEFAULT_STATE_PATH = path.join(os.homedir(), ".cache", "gpt-relay", "sessions.json");

export function resolveHeadlessConfig(args = {}, env = process.env) {
  const runtime = normalizeRuntime(args.runtime ?? env.GPT_RELAY_RUNTIME ?? "cloak");
  const defaultProfilePath = defaultCloakUserDataDir();
  const profilePath = expandPath(args.profile ?? args.userDataDir ?? env.GPT_RELAY_PROFILE ?? defaultProfilePath);
  const statePath = expandPath(args.statePath ?? env.GPT_RELAY_STATE ?? DEFAULT_STATE_PATH);
  const headless = args.login || args.headed
    ? false
    : args.headless ?? parseOptionalBoolean(env.GPT_RELAY_HEADLESS, true, "GPT_RELAY_HEADLESS");
  const channel = args.channel ?? env.GPT_RELAY_CHROMIUM_CHANNEL;
  const executablePath = args.executablePath ?? env.GPT_RELAY_CHROMIUM_EXECUTABLE;
  const browserArgs = args.browserArgs?.length > 0
    ? [...args.browserArgs]
    : splitBrowserArgs(env.GPT_RELAY_CHROMIUM_ARGS);
  const warnings = riskyBrowserArgWarnings(browserArgs);
  const cloakLicenseKey = args.cloakLicenseKey ?? env.GPT_RELAY_CLOAK_LICENSE_KEY ?? env.CLOAKBROWSER_LICENSE_KEY;
  const cloakBrowserVersion = args.cloakBrowserVersion ?? env.GPT_RELAY_CLOAK_BROWSER_VERSION ?? env.CLOAKBROWSER_VERSION;
  const cloakHumanize = Boolean(args.cloakHumanize) || parseOptionalBoolean(env.GPT_RELAY_CLOAK_HUMANIZE, false, "GPT_RELAY_CLOAK_HUMANIZE");
  if (runtime === "chrome") {
    warnings.push("This CLI launches the CloakBrowser persistent Chromium runtime only; use GPT_RELAY_RUNTIME=cloak for relay runs.");
  }
  if (runtime === "cloak" && channel) {
    warnings.push("GPT_RELAY_CHROMIUM_CHANNEL is ignored by the CloakBrowser runtime.");
  }

  return {
    runtime,
    profilePath,
    statePath,
    headless,
    login: Boolean(args.login),
    channel,
    executablePath,
    browserArgs,
    cloakLicenseKey,
    cloakBrowserVersion,
    cloakHumanize,
    warnings,
  };
}

export function helpText() {
  return `Usage:
  node plugins/gpt-relay/scripts/headless_chromium_relay.mjs --login --profile ~/.cache/gpt-relay/cloak-profile
  node plugins/gpt-relay/scripts/headless_chromium_relay.mjs --profile ~/.cache/gpt-relay/cloak-profile --model 5.5 --mode pro --prompt "너 무슨 모델이냐?"
  node plugins/gpt-relay/scripts/headless_chromium_relay.mjs --doctor --json --no-launch

Options:
  --login                 Open headed Chromium and wait for ChatGPT login.
  --doctor                Check browser runtime/profile readiness without sending a prompt or opening ChatGPT.
  --no-launch             In doctor mode, skip launching Chromium.
  --profile PATH          Persistent Chromium profile directory.
  --state-path PATH       Session metadata path. Defaults to ~/.cache/gpt-relay/sessions.json.
  --channel VALUE         Chromium channel setting. Ignored by CloakBrowser.
  --executable-path PATH  Chromium executable path.
  --browser-arg VALUE     Extra Chromium launch argument. May be repeated.
  --cloak-license-key KEY CloakBrowser Pro license key. Also reads CLOAKBROWSER_LICENSE_KEY.
  --cloak-browser-version VERSION
                          Pin a CloakBrowser Chromium version. Also reads CLOAKBROWSER_VERSION.
  --cloak-humanize        Enable CloakBrowser humanized mouse/keyboard/scroll behavior.
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

Environment:
  GPT_RELAY_RUNTIME=cloak
  GPT_RELAY_PROFILE=~/.cache/gpt-relay/cloak-profile
  GPT_RELAY_STATE=~/.cache/gpt-relay/sessions.json
  GPT_RELAY_CLOAK_LICENSE_KEY=cb_xxxxxxxx
  GPT_RELAY_CLOAK_BROWSER_VERSION=148.0.7778.215.3
  GPT_RELAY_CLOAK_HUMANIZE=false
  GPT_RELAY_CHROMIUM_CHANNEL=chrome
  GPT_RELAY_CHROMIUM_EXECUTABLE=/path/to/chromium
  GPT_RELAY_HEADLESS=false
  GPT_RELAY_CHROMIUM_ARGS="--disable-gpu --window-size=1280,900"
`;
}

function normalizeRuntime(value) {
  const runtime = String(value).trim().toLowerCase();
  if (
    runtime === "cloak" ||
    runtime === "cloakbrowser" ||
    runtime === "cloak-browser" ||
    runtime === "stealth" ||
    runtime === "chromium" ||
    runtime === "headless"
  ) {
    return "cloak";
  }
  if (runtime === "chrome" || runtime === "chrome-extension") {
    return "chrome";
  }
  throw new CliError(`Invalid runtime '${value}'. Expected cloak or chrome.`, "MALFORMED_ARGS");
}

function splitBrowserArgs(value) {
  if (!value) {
    return [];
  }
  return String(value).trim().split(/\s+/).filter(Boolean);
}

function riskyBrowserArgWarnings(browserArgs) {
  const warnings = [];
  for (const browserArg of browserArgs) {
    const argName = String(browserArg).split("=")[0];
    if (argName === "--no-sandbox") {
      warnings.push("Risky browser arg explicitly set: --no-sandbox reduces Chromium sandboxing.");
    }
    if (argName === "--disable-web-security") {
      warnings.push("Risky browser arg explicitly set: --disable-web-security disables same-origin protections.");
    }
  }
  return warnings;
}
