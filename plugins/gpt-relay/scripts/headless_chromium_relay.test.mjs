import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scriptPath = path.resolve("plugins/gpt-relay/scripts/headless_chromium_relay.mjs");
const scriptUrl = new URL("./headless_chromium_relay.mjs", import.meta.url).href;

function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: path.resolve("."),
    encoding: "utf8",
    input: options.input ?? "",
    env: {
      ...process.env,
      ...options.env,
    },
    timeout: options.timeout ?? 10000,
  });
}

function parseJsonOutput(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("import does not run the CLI", () => {
  const result = runNode([
    "--input-type=module",
    "-e",
    `const module = await import(${JSON.stringify(scriptUrl)}); console.log(typeof module.parseArgs);`,
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "function\n");
  assert.equal(result.stderr, "");
});

test("--help exits 0", () => {
  const result = runNode([scriptPath, "--help"]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /--doctor/);
});

test("--doctor --json --no-launch prints contract JSON", async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), "gpt-relay-profile-"));
  const statePath = path.join(profile, "sessions.json");
  const result = runNode([
    scriptPath,
    "--profile",
    profile,
    "--state-path",
    statePath,
    "--doctor",
    "--json",
    "--no-launch",
  ]);
  const report = parseJsonOutput(result);

  assert.deepEqual(Object.keys(report).sort(), [
    "browserLaunch",
    "ok",
    "playwrightImport",
    "profileExists",
    "profilePath",
    "profileReadable",
    "profileWritable",
    "remediation",
    "runtime",
    "statePath",
    "warnings",
  ]);
  assert.equal(report.runtime, "playwright");
  assert.equal(report.profilePath, profile);
  assert.equal(report.profileExists, true);
  assert.equal(report.profileReadable, true);
  assert.equal(report.profileWritable, true);
  assert.equal(report.statePath, statePath);
  assert.equal(report.browserLaunch.skipped, true);
  assert.equal(Array.isArray(report.warnings), true);
  assert.equal(Array.isArray(report.remediation), true);
});

test("repeated --browser-arg values preserve ordering", () => {
  const result = runNode([
    "--input-type=module",
    "-e",
    [
      `const { parseArgs } = await import(${JSON.stringify(scriptUrl)});`,
      "const args = parseArgs(['--browser-arg', '--one', '--browser-arg=--two', '--browser-arg', '--three']);",
      "console.log(JSON.stringify(args.browserArgs));",
    ].join(" "),
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ["--one", "--two", "--three"]);
});

test("CLI args override environment config", () => {
  const result = runNode([
    "--input-type=module",
    "-e",
    [
      `const { parseArgs, resolveHeadlessConfig } = await import(${JSON.stringify(scriptUrl)});`,
      "const args = parseArgs(['--profile', '~/cli-profile', '--state-path', '~/cli-state.json', '--channel', 'chrome', '--executable-path', '/tmp/cli-chromium', '--headless=false', '--browser-arg', '--cli-arg']);",
      "const config = resolveHeadlessConfig(args, { GPT_RELAY_PROFILE: '~/env-profile', GPT_RELAY_STATE: '~/env-state.json', GPT_RELAY_CHROMIUM_CHANNEL: 'msedge', GPT_RELAY_CHROMIUM_EXECUTABLE: '/tmp/env-chromium', GPT_RELAY_HEADLESS: 'true', GPT_RELAY_CHROMIUM_ARGS: '--env-arg' });",
      "console.log(JSON.stringify(config));",
    ].join(" "),
  ]);

  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);
  assert.equal(config.profilePath, path.join(os.homedir(), "cli-profile"));
  assert.equal(config.statePath, path.join(os.homedir(), "cli-state.json"));
  assert.equal(config.channel, "chrome");
  assert.equal(config.executablePath, "/tmp/cli-chromium");
  assert.equal(config.headless, false);
  assert.deepEqual(config.browserArgs, ["--cli-arg"]);
});

test("--login implies headed mode", () => {
  const result = runNode([
    "--input-type=module",
    "-e",
    [
      `const { parseArgs, resolveHeadlessConfig } = await import(${JSON.stringify(scriptUrl)});`,
      "const config = resolveHeadlessConfig(parseArgs(['--login']), {});",
      "console.log(JSON.stringify({ login: config.login, headless: config.headless }));",
    ].join(" "),
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { login: true, headless: false });
});

test("login flow passes custom timeout to Playwright waitFor", async () => {
  const { __testing } = await import(scriptUrl);
  let receivedWaitForOptions;
  const browser = {
    tabs: {
      async new() {
        return {
          async goto(url) {
            assert.equal(url, "https://chatgpt.com/");
          },
          playwright: {
            getByRole(role, options) {
              assert.equal(role, "textbox");
              assert.deepEqual(options, { name: "Chat with ChatGPT" });
              return {
                async waitFor(waitForOptions) {
                  receivedWaitForOptions = waitForOptions;
                },
              };
            },
          },
        };
      },
    },
  };
  const output = [];

  await __testing.runLoginFlow(
    browser,
    { loginTimeoutMs: 1234 },
    { profilePath: "/tmp/profile" },
    { write: (text) => output.push(text) },
    { write: (text) => output.push(text) }
  );

  assert.deepEqual(receivedWaitForOptions, { state: "visible", timeout: 1234 });
  assert.match(output.join(""), /ChatGPT login profile is ready/);
});

test("missing prompt fails outside doctor help and login", async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), "gpt-relay-profile-"));
  const result = runNode([scriptPath, "--profile", profile], { input: "" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Prompt is required/);
});

test("risky browser args are surfaced in doctor warnings", async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), "gpt-relay-profile-"));
  const result = runNode([
    scriptPath,
    "--profile",
    profile,
    "--doctor",
    "--json",
    "--no-launch",
    "--browser-arg",
    "--no-sandbox",
    "--browser-arg=--disable-web-security",
  ]);
  const report = parseJsonOutput(result);

  assert.equal(report.ok, true);
  assert.match(report.warnings.join("\n"), /--no-sandbox/);
  assert.match(report.warnings.join("\n"), /--disable-web-security/);
});

test("risky browser arg variants are surfaced in doctor warnings", async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), "gpt-relay-profile-"));
  const result = runNode([
    scriptPath,
    "--profile",
    profile,
    "--doctor",
    "--json",
    "--no-launch",
    "--browser-arg=--no-sandbox=true",
    "--browser-arg=--disable-web-security=1",
  ]);
  const report = parseJsonOutput(result);

  assert.match(report.warnings.join("\n"), /--no-sandbox/);
  assert.match(report.warnings.join("\n"), /--disable-web-security/);
});

test("doctor redacts sensitive launch error details", async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), "gpt-relay-profile-"));
  const result = runNode([
    "--input-type=module",
    "-e",
    [
      `const { main } = await import(${JSON.stringify(scriptUrl)});`,
      "let stdout = '';",
      "const exitCode = await main({",
      `  argv: ['--profile', ${JSON.stringify(profile)}, '--doctor', '--json', '--browser-arg=--proxy-server=http://user:DUMMY_SECRET_TOKEN@example.invalid', '--browser-arg=--api-key=LEAKME_REVIEW_API_KEY'],`,
      "  stdout: { write: (text) => { stdout += text; } },",
      "  stderr: { write: () => undefined },",
      "  importPlaywright: async () => ({}),",
      "  createBrowser: async () => { throw new Error('Launch failed for --proxy-server=http://user:DUMMY_SECRET_TOKEN@example.invalid --api-key=LEAKME_REVIEW_API_KEY'); },",
      "});",
      "console.log(JSON.stringify({ exitCode, report: JSON.parse(stdout) }));",
    ].join(" "),
  ]);

  assert.equal(result.status, 0, result.stderr);
  const { exitCode, report } = JSON.parse(result.stdout);
  assert.equal(exitCode, 0);
  assert.equal(report.browserLaunch.ok, false);
  assert.doesNotMatch(JSON.stringify(report), /DUMMY_SECRET_TOKEN/);
  assert.doesNotMatch(JSON.stringify(report), /LEAKME_REVIEW_API_KEY/);
  assert.match(report.browserLaunch.error, /\[redacted\]/);
});

test("direct CLI error formatter redacts sensitive launch args", async () => {
  const { formatCliError } = await import(scriptUrl);
  const error = new Error(
    "Launch failed for --proxy-server=http://user:DUMMY_SECRET_TOKEN@example.invalid --password=DUMMY_SECRET_TOKEN --api-key=LEAKME_REVIEW_API_KEY"
  );
  error.code = "BROWSER_LAUNCH_FAILED";

  const output = formatCliError(error);

  assert.match(output, /^BROWSER_LAUNCH_FAILED: /);
  assert.doesNotMatch(output, /DUMMY_SECRET_TOKEN/);
  assert.doesNotMatch(output, /LEAKME_REVIEW_API_KEY/);
  assert.match(output, /\[redacted\]/);
});

test("malformed args exit nonzero", () => {
  const result = runNode([scriptPath, "--prompt"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing value/);
});
