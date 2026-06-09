import { mkdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDir, "..");
const helperSource = path.join(
  pluginRoot,
  "native",
  "macos-copy-image-to-clipboard.m"
);

const [imagePath, mimeType = "image/png"] = process.argv.slice(2);

if (!imagePath) {
  console.error("usage: node macos_copy_image_to_clipboard.mjs <image-path> [mime-type]");
  process.exit(2);
}

const helperPath = await ensureHelper();
await execFileAsync(helperPath, [imagePath, mimeType], { timeout: 30000 });

async function ensureHelper() {
  const helperDir = path.join(
    "/private",
    "tmp",
    "gpt-relay",
    "native"
  );
  const helperPath = path.join(helperDir, "macos-copy-image-to-clipboard");
  await mkdir(helperDir, { recursive: true });

  await execFileAsync(
    "/usr/bin/clang",
    ["-framework", "AppKit", helperSource, "-o", helperPath],
    { timeout: 30000 }
  );

  return helperPath;
}
