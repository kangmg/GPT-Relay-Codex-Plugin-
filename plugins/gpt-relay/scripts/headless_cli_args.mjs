const BOOLEAN_TRUE_RE = /^(1|true|yes|on)$/i;
const BOOLEAN_FALSE_RE = /^(0|false|no|off)$/i;
const VALUE_OPTIONS = new Set([
  "app",
  "attachment",
  "browserArg",
  "channel",
  "cloakBrowserVersion",
  "cloakLicenseKey",
  "effort",
  "executablePath",
  "feature",
  "file",
  "loginTimeoutMs",
  "mode",
  "model",
  "profile",
  "project",
  "prompt",
  "promptFile",
  "statePath",
  "timeoutMs",
  "uploadTimeoutMs",
  "userDataDir",
  "waitChunkMs",
]);
const BOOLEAN_OPTIONS = new Set([
  "doctor",
  "headed",
  "help",
  "json",
  "cloakHumanize",
  "login",
  "noLaunch",
  "returnPending",
]);
const NUMBER_OPTIONS = new Set([
  "loginTimeoutMs",
  "timeoutMs",
  "uploadTimeoutMs",
  "waitChunkMs",
]);

export class CliError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export function parseArgs(argv) {
  const args = {
    attachments: [],
    browserArgs: [],
    positionals: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      args.positionals.push(...argv.slice(index + 1));
      break;
    }
    if (!token.startsWith("--")) {
      args.positionals.push(token);
      continue;
    }

    const { rawKey, inlineValue } = splitOptionToken(token);
    const key = camelCase(rawKey);
    if (!rawKey) {
      throw new CliError(`Malformed option '${token}'.`, "MALFORMED_ARGS");
    }

    switch (key) {
      case "help":
      case "doctor":
      case "json":
      case "cloakHumanize":
      case "noLaunch":
      case "returnPending":
        rejectInlineValue(rawKey, inlineValue);
        args[key] = true;
        break;
      case "headed":
        rejectInlineValue(rawKey, inlineValue);
        args.headed = true;
        args.headless = false;
        break;
      case "login":
        rejectInlineValue(rawKey, inlineValue);
        args.login = true;
        args.headed = true;
        args.headless = false;
        break;
      case "headless": {
        const nextValue = inlineValue ?? (
          argv[index + 1] && !argv[index + 1].startsWith("--")
            ? argv[++index]
            : true
        );
        args.headless = parseBoolean(nextValue, "--headless");
        if (args.headless === false) {
          args.headed = true;
        }
        break;
      }
      case "browserArg": {
        const { value, nextIndex } = readOptionValue({
          argv,
          index,
          inlineValue,
          rawKey,
          allowDashValue: true,
        });
        args.browserArgs.push(value);
        index = nextIndex;
        break;
      }
      case "attachment":
      case "file": {
        const { value, nextIndex } = readOptionValue({ argv, index, inlineValue, rawKey });
        args.attachments.push(value);
        index = nextIndex;
        break;
      }
      default: {
        if (!VALUE_OPTIONS.has(key) && !BOOLEAN_OPTIONS.has(key) && key !== "headless") {
          throw new CliError(`Unknown option --${rawKey}.`, "MALFORMED_ARGS");
        }
        const { value, nextIndex } = readOptionValue({ argv, index, inlineValue, rawKey });
        args[key] = NUMBER_OPTIONS.has(key) ? parseNumberValue(rawKey, value) : value;
        index = nextIndex;
        break;
      }
    }
  }

  return args;
}

export function parseOptionalBoolean(value, defaultValue, label) {
  if (value === undefined || value === "") {
    return defaultValue;
  }
  return parseBoolean(value, label);
}

function splitOptionToken(token) {
  const body = token.slice(2);
  const equalsIndex = body.indexOf("=");
  if (equalsIndex === -1) {
    return { rawKey: body, inlineValue: undefined };
  }
  return {
    rawKey: body.slice(0, equalsIndex),
    inlineValue: body.slice(equalsIndex + 1),
  };
}

function readOptionValue({ argv, index, inlineValue, rawKey, allowDashValue = false }) {
  if (inlineValue !== undefined) {
    if (inlineValue === "") {
      throw new CliError(`Missing value for --${rawKey}.`, "MALFORMED_ARGS");
    }
    return { value: inlineValue, nextIndex: index };
  }

  const value = argv[index + 1];
  if (value === undefined || (!allowDashValue && value.startsWith("--"))) {
    throw new CliError(`Missing value for --${rawKey}.`, "MALFORMED_ARGS");
  }
  return { value, nextIndex: index + 1 };
}

function rejectInlineValue(rawKey, inlineValue) {
  if (inlineValue !== undefined) {
    throw new CliError(`Option --${rawKey} does not take a value.`, "MALFORMED_ARGS");
  }
}

function parseNumberValue(rawKey, value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new CliError(`Invalid value for --${rawKey}: expected a non-negative number.`, "MALFORMED_ARGS");
  }
  return numericValue;
}

function parseBoolean(value, label) {
  if (value === true || value === false) {
    return value;
  }
  if (BOOLEAN_TRUE_RE.test(String(value))) {
    return true;
  }
  if (BOOLEAN_FALSE_RE.test(String(value))) {
    return false;
  }
  throw new CliError(`Invalid boolean for ${label}: ${value}.`, "MALFORMED_ARGS");
}

function camelCase(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
