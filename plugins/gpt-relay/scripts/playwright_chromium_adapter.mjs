import os from "node:os";
import path from "node:path";
import process from "node:process";

const DEFAULT_VIEWPORT = { width: 1280, height: 900 };
const CHATGPT_ORIGIN = "https://chatgpt.com";

export async function createPlaywrightChromiumBrowser(options = {}) {
  const {
    userDataDir = defaultUserDataDir(),
    headless = true,
    channel,
    executablePath,
    viewport = DEFAULT_VIEWPORT,
    acceptDownloads = true,
    args = [],
    closeOnFinalize = true,
    playwright: providedPlaywright,
  } = options;

  const playwright = providedPlaywright ?? await importPlaywright();
  const context = await playwright.chromium.launchPersistentContext(
    expandPath(userDataDir),
    {
      headless,
      channel,
      executablePath,
      viewport,
      acceptDownloads,
      chromiumSandbox: true,
      args: [
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-default-browser-check",
        ...args,
      ],
    }
  );

  await context.grantPermissions(
    ["clipboard-read", "clipboard-write"],
    { origin: CHATGPT_ORIGIN }
  ).catch(() => undefined);

  const tabs = new Map();
  let nextTabId = 1;

  const browser = {
    runtime: "playwright-chromium",
    context,
    async close() {
      await context.close().catch(() => undefined);
    },
    tabs: {
      async new() {
        const page = await context.newPage();
        const tab = createPlaywrightTab(page, {
          id: `playwright-${nextTabId++}`,
          context,
        });
        tabs.set(tab.id, tab);
        return tab;
      },
      async list() {
        return [...tabs.values()].map((tab) => ({
          id: tab.id,
          url: tab.urlSync?.() ?? "",
        }));
      },
      async finalize(options = {}) {
        if (closeOnFinalize) {
          await context.close().catch(() => undefined);
          return;
        }

        const keepIds = new Set(
          (options.keep ?? [])
            .map((entry) => entry?.tab?.id ?? entry?.tab)
            .filter(Boolean)
        );
        for (const tab of tabs.values()) {
          if (!keepIds.has(tab.id)) {
            await tab.close().catch(() => undefined);
          }
        }
      },
    },
    user: {
      async openTabs() {
        return [...tabs.values()].map((tab) => ({
          id: tab.id,
          title: tab._lastTitle ?? "",
          url: tab.urlSync?.() ?? "",
        }));
      },
      async claimTab(openTab) {
        const id = typeof openTab === "string" ? openTab : openTab?.id;
        const tab = tabs.get(id);
        if (!tab) {
          throw new Error(`No Playwright tab is registered for id '${id}'.`);
        }
        return tab;
      },
    },
  };

  return browser;
}

export function defaultUserDataDir() {
  return path.join(os.homedir(), ".cache", "gpt-relay", "chromium-profile");
}

export function expandPath(value) {
  const input = String(value ?? "");
  if (input === "~") {
    return os.homedir();
  }
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }
  return path.resolve(input);
}

export function playwrightMissingError(cause) {
  const wrapped = new Error(
    "Playwright is not installed. Run `npm install` and `npx playwright install --with-deps chromium` in the checkout before using the headless Chromium relay."
  );
  wrapped.code = "PLAYWRIGHT_MISSING";
  wrapped.cause = cause;
  return wrapped;
}

async function importPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw playwrightMissingError(error);
  }
}

function createPlaywrightTab(page, { id, context }) {
  const clipboardState = {
    text: "",
    items: [],
  };

  const playwright = createPlaywrightPageFacade(page, clipboardState);
  const tab = {
    id,
    playwright,
    clipboard: createClipboardFacade(page, context, clipboardState),
    cua: createCuaFacade(page, clipboardState),
    dom_cua: createDomCuaFacade(page),
    async goto(url) {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    },
    async url() {
      return page.url();
    },
    urlSync() {
      return page.url();
    },
    async title() {
      const title = await page.title();
      tab._lastTitle = title;
      return title;
    },
    async close() {
      await page.close().catch(() => undefined);
    },
    async reload() {
      await page.reload({ waitUntil: "domcontentloaded" });
    },
    async back() {
      await page.goBack({ waitUntil: "domcontentloaded" });
    },
    async forward() {
      await page.goForward({ waitUntil: "domcontentloaded" });
    },
    async screenshot(options = {}) {
      return page.screenshot(mapTimeoutOptions(options));
    },
  };
  return tab;
}

function createPlaywrightPageFacade(page, clipboardState) {
  return {
    keyboard: page.keyboard,
    mouse: page.mouse,
    async evaluate(pageFunction, arg, options = {}) {
      const run = page.evaluate(pageFunction, arg);
      return withTimeout(run, options.timeoutMs, "page.evaluate");
    },
    async waitForLoadState(options = {}) {
      await page.waitForLoadState(options.state ?? "load", mapTimeoutOptions(options));
    },
    async waitForTimeout(timeoutMs) {
      await page.waitForTimeout(timeoutMs);
    },
    async waitForURL(url, options = {}) {
      await page.waitForURL(url, mapTimeoutOptions(options));
    },
    async waitForEvent(event, options = {}) {
      return page.waitForEvent(event, mapTimeoutOptions(options));
    },
    async screenshot(options = {}) {
      return page.screenshot(mapTimeoutOptions(options));
    },
    getByRole(role, options = {}) {
      return wrapLocator(page.getByRole(role, options), page, clipboardState);
    },
    getByText(text, options = {}) {
      return wrapLocator(page.getByText(text, options), page, clipboardState);
    },
    getByTestId(testId) {
      return wrapLocator(page.getByTestId(testId), page, clipboardState);
    },
    getByLabel(text, options = {}) {
      return wrapLocator(page.getByLabel(text, options), page, clipboardState);
    },
    getByPlaceholder(text, options = {}) {
      return wrapLocator(page.getByPlaceholder(text, options), page, clipboardState);
    },
    locator(selector, options = {}) {
      return wrapLocator(page.locator(selector, unwrapLocatorOptions(options)), page, clipboardState);
    },
    frameLocator(selector) {
      const frame = page.frameLocator(selector);
      return createFrameLocatorFacade(frame, page, clipboardState);
    },
  };
}

function createFrameLocatorFacade(frame, page, clipboardState) {
  return {
    frameLocator(selector) {
      return createFrameLocatorFacade(frame.frameLocator(selector), page, clipboardState);
    },
    getByRole(role, options = {}) {
      return wrapLocator(frame.getByRole(role, options), page, clipboardState);
    },
    getByText(text, options = {}) {
      return wrapLocator(frame.getByText(text, options), page, clipboardState);
    },
    getByTestId(testId) {
      return wrapLocator(frame.getByTestId(testId), page, clipboardState);
    },
    getByLabel(text, options = {}) {
      return wrapLocator(frame.getByLabel(text, options), page, clipboardState);
    },
    getByPlaceholder(text, options = {}) {
      return wrapLocator(frame.getByPlaceholder(text, options), page, clipboardState);
    },
    locator(selector, options = {}) {
      return wrapLocator(frame.locator(selector, unwrapLocatorOptions(options)), page, clipboardState);
    },
  };
}

function wrapLocator(locator, page, clipboardState) {
  return {
    _locator: locator,
    async count() {
      return locator.count();
    },
    async all() {
      return (await locator.all()).map((entry) => wrapLocator(entry, page, clipboardState));
    },
    async allTextContents() {
      return locator.allTextContents();
    },
    async innerText(options = {}) {
      return locator.innerText(mapTimeoutOptions(options));
    },
    async textContent(options = {}) {
      return locator.textContent(mapTimeoutOptions(options));
    },
    async getAttribute(name, options = {}) {
      return locator.getAttribute(name, mapTimeoutOptions(options));
    },
    async isVisible(options = {}) {
      return locator.isVisible(mapTimeoutOptions(options));
    },
    async isEnabled(options = {}) {
      return locator.isEnabled(mapTimeoutOptions(options));
    },
    async waitFor(options = {}) {
      return locator.waitFor(mapTimeoutOptions(options));
    },
    async click(options = {}) {
      return locator.click(mapTimeoutOptions(options));
    },
    async dblclick(options = {}) {
      return locator.dblclick(mapTimeoutOptions(options));
    },
    async fill(value, options = {}) {
      return locator.fill(value, mapTimeoutOptions(options));
    },
    async type(value, options = {}) {
      return locator.type(value, mapTimeoutOptions(options));
    },
    async press(value, options = {}) {
      if (isPasteShortcut(value) && clipboardState.text) {
        await locator.click(mapTimeoutOptions(options)).catch(() => undefined);
        await page.keyboard.insertText(clipboardState.text);
        return;
      }
      return locator.press(normalizeKeyCombo(value), mapTimeoutOptions(options));
    },
    async check(options = {}) {
      return locator.check(mapTimeoutOptions(options));
    },
    async uncheck(options = {}) {
      return locator.uncheck(mapTimeoutOptions(options));
    },
    async setChecked(checked, options = {}) {
      return locator.setChecked(checked, mapTimeoutOptions(options));
    },
    async selectOption(value, options = {}) {
      return locator.selectOption(value, mapTimeoutOptions(options));
    },
    async setInputFiles(files, options = {}) {
      return locator.setInputFiles(files, mapTimeoutOptions(options));
    },
    async screenshot(options = {}) {
      return locator.screenshot(mapTimeoutOptions(options));
    },
    filter(options = {}) {
      return wrapLocator(locator.filter(unwrapLocatorOptions(options)), page, clipboardState);
    },
    locator(selector, options = {}) {
      return wrapLocator(locator.locator(selector, unwrapLocatorOptions(options)), page, clipboardState);
    },
    getByRole(role, options = {}) {
      return wrapLocator(locator.getByRole(role, options), page, clipboardState);
    },
    getByText(text, options = {}) {
      return wrapLocator(locator.getByText(text, options), page, clipboardState);
    },
    getByTestId(testId) {
      return wrapLocator(locator.getByTestId(testId), page, clipboardState);
    },
    getByLabel(text, options = {}) {
      return wrapLocator(locator.getByLabel(text, options), page, clipboardState);
    },
    getByPlaceholder(text, options = {}) {
      return wrapLocator(locator.getByPlaceholder(text, options), page, clipboardState);
    },
    first() {
      return wrapLocator(locator.first(), page, clipboardState);
    },
    last() {
      return wrapLocator(locator.last(), page, clipboardState);
    },
    nth(index) {
      return wrapLocator(locator.nth(index), page, clipboardState);
    },
    or(other) {
      return wrapLocator(locator.or(unwrapLocator(other)), page, clipboardState);
    },
    and(other) {
      return wrapLocator(locator.and(unwrapLocator(other)), page, clipboardState);
    },
  };
}

function createClipboardFacade(page, context, clipboardState) {
  return {
    async writeText(text) {
      clipboardState.text = String(text ?? "");
      clipboardState.items = [];
      await context.grantPermissions(
        ["clipboard-read", "clipboard-write"],
        { origin: CHATGPT_ORIGIN }
      ).catch(() => undefined);
      await page.evaluate(async (value) => {
        if (!navigator.clipboard?.writeText) {
          throw new Error("navigator.clipboard.writeText is unavailable.");
        }
        await navigator.clipboard.writeText(value);
      }, clipboardState.text).catch(() => undefined);
    },
    async write(items = []) {
      clipboardState.text = "";
      clipboardState.items = items;
      await context.grantPermissions(
        ["clipboard-read", "clipboard-write"],
        { origin: CHATGPT_ORIGIN }
      ).catch(() => undefined);
      await page.evaluate(async (clipboardItems) => {
        if (!navigator.clipboard?.write || typeof ClipboardItem !== "function") {
          throw new Error("navigator.clipboard.write is unavailable.");
        }
        const browserItems = [];
        for (const item of clipboardItems) {
          const entries = {};
          for (const entry of item.entries ?? []) {
            const binary = atob(entry.base64 || "");
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) {
              bytes[index] = binary.charCodeAt(index);
            }
            entries[entry.mimeType] = new Blob([bytes], { type: entry.mimeType });
          }
          browserItems.push(new ClipboardItem(entries));
        }
        await navigator.clipboard.write(browserItems);
      }, items).catch(() => undefined);
    },
    async readText() {
      return page.evaluate(async () => navigator.clipboard?.readText?.() ?? "")
        .catch(() => clipboardState.text);
    },
    async read() {
      return clipboardState.items;
    },
  };
}

function createCuaFacade(page, clipboardState) {
  return {
    async click({ x, y, button = 1 }) {
      await page.mouse.click(x, y, { button: mouseButtonName(button) });
    },
    async double_click({ x, y }) {
      await page.mouse.dblclick(x, y);
    },
    async keypress({ keys = [] }) {
      const combo = normalizeKeyCombo(keys.join("+"));
      if (isPasteShortcut(combo) && clipboardState.text) {
        await page.keyboard.insertText(clipboardState.text);
        return;
      }
      await page.keyboard.press(combo);
    },
    async type({ text }) {
      await page.keyboard.type(text);
    },
    async scroll({ scrollX = 0, scrollY = 0, x, y }) {
      if (Number.isFinite(x) && Number.isFinite(y)) {
        await page.mouse.move(x, y);
      }
      await page.mouse.wheel(scrollX, scrollY);
    },
    async move({ x, y }) {
      await page.mouse.move(x, y);
    },
  };
}

function createDomCuaFacade(page) {
  const selector = [
    "button",
    "a",
    "[role='button']",
    "[role='menuitem']",
    "[role='menuitemradio']",
    "[role='option']",
    "[aria-label]",
  ].join(",");

  return {
    async get_visible_dom() {
      return page.evaluate((candidateSelector) => {
        const normalize = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
        const isVisible = (element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            rect.width > 0 &&
            rect.height > 0
          );
        };
        return [...document.querySelectorAll(candidateSelector)]
          .filter(isVisible)
          .slice(0, 500)
          .map((element, index) => {
            const tag = element.tagName.toLowerCase();
            const role = element.getAttribute("role");
            const aria = normalize(element.getAttribute("aria-label"));
            const text = normalize(element.innerText || element.textContent);
            const attrs = [
              `node_id=${index}`,
              role ? `role="${role}"` : "",
              aria ? `aria-label="${aria.replace(/"/g, "&quot;")}"` : "",
            ].filter(Boolean).join(" ");
            const body = text ? `${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}` : "";
            return `<${tag} ${attrs}>${body}</${tag}>`;
          })
          .join("\n");
      }, selector);
    },
    async click({ node_id }) {
      await page.evaluate(({ candidateSelector, nodeId }) => {
        const isVisible = (element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            rect.width > 0 &&
            rect.height > 0
          );
        };
        const candidates = [...document.querySelectorAll(candidateSelector)].filter(isVisible);
        const target = candidates[Number(nodeId)];
        if (!target) {
          throw new Error(`Visible DOM node ${nodeId} was not found.`);
        }
        target.click();
      }, { candidateSelector: selector, nodeId: node_id });
    },
  };
}

function unwrapLocator(locator) {
  return locator?._locator ?? locator;
}

function unwrapLocatorOptions(options = {}) {
  const mapped = { ...options };
  delete mapped.timeoutMs;
  if (mapped.has) {
    mapped.has = unwrapLocator(mapped.has);
  }
  if (mapped.hasNot) {
    mapped.hasNot = unwrapLocator(mapped.hasNot);
  }
  return mapped;
}

function mapTimeoutOptions(options = {}) {
  if (!options || typeof options !== "object") {
    return options;
  }
  const mapped = { ...options };
  if (mapped.timeoutMs !== undefined && mapped.timeout === undefined) {
    mapped.timeout = mapped.timeoutMs;
  }
  delete mapped.timeoutMs;
  return mapped;
}

function normalizeKeyCombo(value) {
  return String(value ?? "")
    .split("+")
    .map((key) => {
      const trimmed = key.trim();
      if (/^ControlOrMeta$/i.test(trimmed)) {
        return process.platform === "darwin" ? "Meta" : "Control";
      }
      if (/^(Esc|ESC)$/i.test(trimmed)) {
        return "Escape";
      }
      return trimmed;
    })
    .filter(Boolean)
    .join("+");
}

function isPasteShortcut(value) {
  return /^(?:Control|Meta|ControlOrMeta)\+V$/i.test(normalizeKeyCombo(value));
}

function mouseButtonName(button) {
  if (button === 2) return "middle";
  if (button === 3) return "right";
  return "left";
}

async function withTimeout(promise, timeoutMs, label) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
