import { constants as fsConstants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { CLOAKBROWSER_REMEDIATION } from "./headless_cli_config.mjs";

export async function runDoctor(config, options) {
  const profile = await inspectProfile(config.profilePath);
  const warnings = [...config.warnings];
  if (profile.profileExists && !profile.profileIsDirectory) {
    warnings.push("Profile path exists but is not a directory.");
  }

  const browserImport = await checkBrowserImport(config, options);
  const browserLaunch = await checkBrowserLaunch(config, {
    noLaunch: options.noLaunch,
    createBrowser: options.createBrowser,
    browserImportOk: browserImport.ok,
  });
  const remediation = doctorRemediation({ profile, browserImport, browserLaunch });
  const ok = Boolean(
    config.runtime === "cloak" &&
    profile.profileExists &&
    profile.profileIsDirectory &&
    profile.profileReadable &&
    profile.profileWritable &&
    browserImport.ok &&
    (browserLaunch.skipped || browserLaunch.ok)
  );

  return {
    ok,
    runtime: config.runtime,
    profilePath: config.profilePath,
    profileExists: profile.profileExists,
    profileReadable: profile.profileReadable,
    profileWritable: profile.profileWritable,
    statePath: config.statePath,
    browserImport,
    browserLaunch,
    warnings,
    remediation,
  };
}

export function writeDoctorReport(report, { json, stdout }) {
  if (json) {
    stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  stdout.write([
    `ok: ${report.ok}`,
    `runtime: ${report.runtime}`,
    `profile: ${report.profilePath}`,
    `profile exists/readable/writable: ${report.profileExists}/${report.profileReadable}/${report.profileWritable}`,
    `state: ${report.statePath}`,
    `browser import: ${report.browserImport.name} ${report.browserImport.ok}`,
    `browser launch: ${report.browserLaunch.skipped ? "skipped" : report.browserLaunch.ok}`,
    ...report.warnings.map((warning) => `warning: ${warning}`),
    ...report.remediation.map((entry) => `remediation: ${entry}`),
    "",
  ].join("\n"));
}

export async function defaultImportCloakBrowser() {
  return import("cloakbrowser");
}

async function inspectProfile(profilePath) {
  const profile = {
    profileExists: false,
    profileIsDirectory: false,
    profileReadable: false,
    profileWritable: false,
  };

  try {
    const info = await stat(profilePath);
    profile.profileExists = true;
    profile.profileIsDirectory = info.isDirectory();
  } catch (error) {
    if (error?.code !== "ENOENT") {
      profile.error = error.message;
    }
    return profile;
  }

  try {
    await access(profilePath, fsConstants.R_OK);
    profile.profileReadable = true;
  } catch {
    profile.profileReadable = false;
  }

  try {
    await access(profilePath, fsConstants.W_OK);
    profile.profileWritable = true;
  } catch {
    profile.profileWritable = false;
  }

  return profile;
}

async function checkBrowserImport(config, options) {
  const name = "cloakbrowser";
  const importBrowser = options.importCloakBrowser;
  try {
    await importBrowser();
    return { name, ok: true };
  } catch (error) {
    return compactObject({
      name,
      ok: false,
      code: error?.code,
      error: error?.message ?? String(error),
    });
  }
}

async function checkBrowserLaunch(config, options) {
  if (options.noLaunch) {
    return { ok: null, skipped: true };
  }
  if (!options.browserImportOk) {
    return { ok: false, skipped: true, error: `Skipped because ${config.runtime} browser runtime could not be imported.` };
  }
  if (config.runtime !== "cloak") {
    return { ok: false, skipped: true, error: "Skipped because this CLI only launches the CloakBrowser persistent Chromium runtime." };
  }

  let browser;
  try {
    browser = await options.createBrowser({
      userDataDir: config.profilePath,
      runtime: config.runtime,
      headless: config.headless,
      channel: config.channel,
      executablePath: config.executablePath,
      args: config.browserArgs,
      cloakLicenseKey: config.cloakLicenseKey,
      cloakBrowserVersion: config.cloakBrowserVersion,
      cloakHumanize: config.cloakHumanize,
      closeOnFinalize: true,
    });
    return { ok: true, skipped: false };
  } catch (error) {
    return compactObject({
      ok: false,
      skipped: false,
      code: error?.code,
      error: redactSensitiveError(error?.message ?? String(error)),
    });
  } finally {
    await browser?.close?.().catch(() => undefined);
  }
}

function doctorRemediation({ profile, browserImport, browserLaunch }) {
  const remediation = [];
  if (!profile.profileExists) {
    remediation.push("Create the persistent Chromium profile directory, then run --login from a GUI-capable session.");
  } else if (!profile.profileIsDirectory) {
    remediation.push("Set --profile to a directory path, not a file.");
  } else {
    if (!profile.profileReadable) {
      remediation.push("Grant read permission on the persistent Chromium profile directory.");
    }
    if (!profile.profileWritable) {
      remediation.push("Grant write permission on the persistent Chromium profile directory.");
    }
  }
  if (!browserImport.ok || browserLaunch.ok === false) {
    remediation.push(CLOAKBROWSER_REMEDIATION);
  }
  remediation.push("Do not use the same persistent profile from simultaneous relay processes.");
  return [...new Set(remediation)];
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

export function redactSensitiveError(value) {
  const sensitiveNamePattern = "secret|token|password|passphrase|passwd|pwd|api[-_]?key|apikey|credential|credentials|client[-_]?secret|access[-_]?key";
  return String(value)
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@/gi, (match) => {
      const protocol = match.slice(0, match.indexOf("//") + 2);
      return `${protocol}[redacted]@`;
    })
    .replace(
      new RegExp(`((?:^|[\\s"'\\\`])--?[^\\s="'\\\`]*(?:${sensitiveNamePattern})[^\\s="'\\\`]*(?:=|\\s+))[^\\s"'\\\`]+`, "gi"),
      (_match, prefix) => `${prefix}[redacted]`
    )
    .replace(
      new RegExp(`\\b[^\\s="'\\\`]*(?:${sensitiveNamePattern})[^\\s="'\\\`]*`, "gi"),
      "[redacted]"
    );
}
