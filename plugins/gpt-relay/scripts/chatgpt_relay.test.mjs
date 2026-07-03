import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  __testing,
  getRelaySession,
  listRelaySessions,
} from "./chatgpt_relay.mjs";
import { createPlaywrightChromiumBrowser } from "./playwright_chromium_adapter.mjs";

test("runtime selection defaults to Chrome without creating persistent browser", async () => {
  let chromeFactoryCalled = 0;
  let browserFactoryCalled = 0;
  const chromeBrowser = { runtime: "chrome-extension" };

  const lease = await __testing.resolveBrowserLease(
    {
      chromeBrowserFactory: async () => {
        chromeFactoryCalled += 1;
        return chromeBrowser;
      },
      browserFactory: async () => {
        browserFactoryCalled += 1;
        throw new Error("Persistent browser should not be created for the default runtime.");
      },
    },
    {}
  );

  assert.equal(lease.runtime, "chrome");
  assert.equal(lease.browser, chromeBrowser);
  assert.equal(lease.helperOwned, false);
  assert.equal(chromeFactoryCalled, 1);
  assert.equal(browserFactoryCalled, 0);
});

test("runtime selection resolves options before environment defaults", () => {
  const config = __testing.resolveRelayRuntimeConfig(
    {
      runtime: "chrome",
      profile: "~/option-profile",
      statePath: "~/option-state.json",
      headless: true,
      browserArgs: ["--option-arg"],
    },
    {
      GPT_RELAY_RUNTIME: "cloak",
      GPT_RELAY_PROFILE: "~/env-profile",
      GPT_RELAY_STATE: "~/env-state.json",
      GPT_RELAY_HEADLESS: "false",
      GPT_RELAY_CHROMIUM_ARGS: "--env-arg",
    }
  );

  assert.equal(config.runtime, "chrome");
  assert.equal(config.profile, path.join(os.homedir(), "option-profile"));
  assert.equal(config.statePath, path.join(os.homedir(), "option-state.json"));
  assert.equal(config.headless, true);
  assert.deepEqual(config.browserArgs, ["--option-arg"]);

  const envConfig = __testing.resolveRelayRuntimeConfig(
    {},
    {
      GPT_RELAY_RUNTIME: "cloak",
      GPT_RELAY_PROFILE: "~/env-profile",
      GPT_RELAY_STATE: "~/env-state.json",
      GPT_RELAY_CHROMIUM_CHANNEL: "chrome",
      GPT_RELAY_CHROMIUM_EXECUTABLE: "/tmp/chromium",
      GPT_RELAY_HEADLESS: "0",
      GPT_RELAY_CHROMIUM_ARGS: "--disable-gpu --window-size=1280,900",
    }
  );

  assert.equal(envConfig.runtime, "cloak");
  assert.equal(envConfig.profile, path.join(os.homedir(), "env-profile"));
  assert.equal(envConfig.statePath, path.join(os.homedir(), "env-state.json"));
  assert.equal(envConfig.channel, "chrome");
  assert.equal(envConfig.executablePath, "/tmp/chromium");
  assert.equal(envConfig.headless, false);
  assert.deepEqual(envConfig.browserArgs, ["--disable-gpu", "--window-size=1280,900"]);
});

test("session lookup uses the CloakBrowser default state path for headless runtime", async (t) => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "gpt55-relay-home-"));
  const statePath = path.join(homeDir, ".cache", "gpt-relay", "sessions.json");
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify({
    version: 1,
    sessions: [
      {
        relaySessionId: "headless-1",
        conversationId: "abc123",
        conversationUrl: "https://chatgpt.com/c/abc123",
        title: "Headless session",
        status: "pending",
        mode: "Extended Pro",
        updatedAt: "2026-06-24T00:00:00.000Z",
        createdAt: "2026-06-24T00:00:00.000Z",
      },
    ],
  }));

  const previousRuntime = process.env.GPT_RELAY_RUNTIME;
  const previousState = process.env.GPT_RELAY_STATE;
  const previousNodeRepl = globalThis.nodeRepl;
  const previousRelayStatePath = globalThis.__gpt55RelayStatePath;
  t.mock.method(os, "homedir", () => homeDir);
  process.env.GPT_RELAY_RUNTIME = "cloak";
  delete process.env.GPT_RELAY_STATE;
  globalThis.nodeRepl = {
    ...(previousNodeRepl ?? {}),
    homeDir,
    tmpDir: path.join(homeDir, "tmp"),
  };
  delete globalThis.__gpt55RelayStatePath;

  try {
    const sessions = await listRelaySessions({});
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].relaySessionId, "headless-1");

    const session = await getRelaySession({ sessionId: "headless-1" });
    assert.equal(session?.conversationUrl, "https://chatgpt.com/c/abc123");
  } finally {
    if (previousRuntime === undefined) {
      delete process.env.GPT_RELAY_RUNTIME;
    } else {
      process.env.GPT_RELAY_RUNTIME = previousRuntime;
    }
    if (previousState === undefined) {
      delete process.env.GPT_RELAY_STATE;
    } else {
      process.env.GPT_RELAY_STATE = previousState;
    }
    if (previousNodeRepl === undefined) {
      delete globalThis.nodeRepl;
    } else {
      globalThis.nodeRepl = previousNodeRepl;
    }
    if (previousRelayStatePath === undefined) {
      delete globalThis.__gpt55RelayStatePath;
    } else {
      globalThis.__gpt55RelayStatePath = previousRelayStatePath;
    }
  }
});

test("runtime selection creates CloakBrowser with explicit stealth options", async () => {
  const cloakBrowser = { runtime: "cloakbrowser" };
  let capturedOptions;

  const lease = await __testing.resolveBrowserLease(
    {
      runtime: "cloak",
      profile: "~/cloak-profile",
      statePath: "~/cloak-state.json",
      cloakLicenseKey: "cb_test",
      cloakBrowserVersion: "148.0.7778.215.3",
      cloakHumanize: true,
      browserArgs: ["--fingerprint=relay-test"],
      browserFactory: async (factoryOptions) => {
        capturedOptions = factoryOptions;
        return cloakBrowser;
      },
    },
    {}
  );

  assert.equal(lease.runtime, "cloak");
  assert.equal(lease.browser, cloakBrowser);
  assert.equal(lease.helperOwned, true);
  assert.equal(lease.statePath, path.join(os.homedir(), "cloak-state.json"));
  assert.deepEqual(capturedOptions, {
    runtime: "cloak",
    userDataDir: path.join(os.homedir(), "cloak-profile"),
    headless: true,
    args: ["--fingerprint=relay-test"],
    closeOnFinalize: true,
    cloakLicenseKey: "cb_test",
    cloakBrowserVersion: "148.0.7778.215.3",
    cloakHumanize: true,
  });
});

test("missing CloakBrowser runtime reports server install remediation", async () => {
  let chromeFactoryCalled = 0;

  await assert.rejects(
    () => __testing.resolveBrowserLease(
      {
        runtime: "cloak",
        chromeBrowserFactory: async () => {
          chromeFactoryCalled += 1;
          return { runtime: "chrome-extension" };
        },
        browserFactory: async () => {
          const error = new Error("Cannot find package 'cloakbrowser'");
          error.code = "ERR_MODULE_NOT_FOUND";
          throw error;
        },
      },
      {}
    ),
    (error) => {
      assert.equal(error.code, "CLOAKBROWSER_MISSING");
      assert.match(error.message, /npm install/);
      return true;
    }
  );

  assert.equal(chromeFactoryCalled, 0);
});

test("CloakBrowser adapter launches a persistent context with sandbox and profile", async () => {
  let launchOptions;
  const context = {
    async grantPermissions() {},
    async close() {},
    async newPage() {
      throw new Error("not used");
    },
  };
  await createPlaywrightChromiumBrowser({
    runtime: "cloak",
    userDataDir: "~/cloak-sandbox-profile",
    headless: false,
    args: ["--fingerprint=relay-test"],
    cloakLicenseKey: "cb_test",
    cloakBrowserVersion: "148.0.7778.215.3",
    cloakHumanize: true,
    cloakbrowser: {
      async launchPersistentContext(options) {
        launchOptions = options;
        return context;
      },
    },
  });

  assert.equal(launchOptions.userDataDir, path.join(os.homedir(), "cloak-sandbox-profile"));
  assert.equal(launchOptions.headless, false);
  assert.deepEqual(launchOptions.args, [
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--fingerprint=relay-test",
  ]);
  assert.equal(launchOptions.licenseKey, "cb_test");
  assert.equal(launchOptions.browserVersion, "148.0.7778.215.3");
  assert.equal(launchOptions.humanize, true);
  assert.equal(launchOptions.launchOptions.chromiumSandbox, true);
});

test("runtime selection finalizer closes helper-owned browsers but not caller-owned browsers", async () => {
  let helperFinalized = 0;
  let helperClosed = 0;
  let helperCloseOnlyClosed = 0;
  let callerFinalized = 0;
  let callerClosed = 0;
  let callerCloseOnlyClosed = 0;

  await __testing.finalizeBrowserLease(
    {
      helperOwned: true,
      browser: {
        tabs: {
          async finalize() {
            helperFinalized += 1;
          },
        },
        async close() {
          helperClosed += 1;
        },
      },
    },
    null,
    false
  );

  await __testing.finalizeBrowserLease(
    {
      helperOwned: true,
      browser: {
        async close() {
          helperCloseOnlyClosed += 1;
        },
      },
    },
    null,
    false
  );

  await __testing.finalizeBrowserLease(
    {
      helperOwned: false,
      browser: {
        tabs: {
          async finalize() {
            callerFinalized += 1;
          },
        },
        async close() {
          callerClosed += 1;
        },
      },
    },
    null,
    false
  );

  await __testing.finalizeBrowserLease(
    {
      helperOwned: false,
      browser: {
        async close() {
          callerCloseOnlyClosed += 1;
        },
      },
    },
    null,
    false
  );

  assert.equal(helperFinalized, 1);
  assert.equal(helperClosed, 0);
  assert.equal(helperCloseOnlyClosed, 1);
  assert.equal(callerFinalized, 1);
  assert.equal(callerClosed, 0);
  assert.equal(callerCloseOnlyClosed, 0);
});

test("prepareAttachment uses upload metadata for images by default", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gpt55-relay-test-"));
  const imagePath = path.join(dir, "sample.png");
  await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const prepared = await __testing.prepareAttachment(
    { path: imagePath },
    { maxImageClipboardBytes: Number.POSITIVE_INFINITY }
  );

  assert.equal(prepared.kind, "image");
  assert.equal(prepared.summary.strategy, "upload");
  assert.equal(prepared.allowClipboardFallback, true);
});

test("prepareAttachment uploads text files unless inline is explicitly requested", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gpt55-relay-test-"));
  const textPath = path.join(dir, "notes.txt");
  await writeFile(textPath, "hello");

  const uploaded = await __testing.prepareAttachment(
    { path: textPath },
    { maxImageClipboardBytes: Number.POSITIVE_INFINITY }
  );
  assert.equal(uploaded.kind, "file");
  assert.equal(uploaded.summary.kind, "text-file");
  assert.equal(uploaded.summary.strategy, "upload");

  const inline = await __testing.prepareAttachment(
    { path: textPath, inline: true },
    { maxImageClipboardBytes: Number.POSITIVE_INFINITY }
  );
  assert.equal(inline.kind, "text");
  assert.equal(inline.summary.strategy, "prompt-inline");
});

test("upload failures include actionable permission remediation", () => {
  const error = __testing.uploadFailedError(
    {
      path: "/tmp/sample.png",
      name: "sample.png",
      summary: { bytes: 4 },
    },
    ['direct-file-input-set: input[type=file].setInputFiles failed. {"code":-32000,"message":"Not allowed"}']
  );

  assert.equal(error.code, "ATTACHMENT_UPLOAD_PERMISSION_REQUIRED");
  assert.match(error.message, /Codex Settings > Computer Use > Chrome/);
  assert.equal(error.remediation.length, 2);
});

test("response completion requires stable non-transient text and a completion signal", () => {
  assert.equal(__testing.isResponseCompleteSnapshot({
    latestText: "Thinking",
    textStableForMs: 60000,
    isAnswering: false,
    responseActionsAvailable: true,
  }), false);

  assert.equal(__testing.isResponseCompleteSnapshot({
    latestText: "Final answer",
    textStableForMs: 6000,
    isAnswering: false,
    responseActionsAvailable: false,
  }), false);

  assert.equal(__testing.isResponseCompleteSnapshot({
    latestText: "Final answer",
    textStableForMs: 6000,
    isAnswering: false,
    responseActionsAvailable: true,
  }), true);
});

test("create-image completion can be artifact-only", () => {
  assert.equal(__testing.isResponseCompleteSnapshot({
    latestText: "",
    textStableForMs: 60000,
    artifactCount: 1,
    artifactStableForMs: 6000,
    allowArtifactOnly: true,
    isAnswering: false,
    responseActionsAvailable: false,
  }), true);

  assert.equal(__testing.isResponseCompleteSnapshot({
    latestText: "",
    textStableForMs: 60000,
    artifactCount: 1,
    artifactStableForMs: 6000,
    allowArtifactOnly: false,
    isAnswering: false,
    responseActionsAvailable: false,
  }), false);
});

test("deep research completed card is parsed without assistant text", () => {
  const state = __testing.parseDeepResearchState({
    title: "香港 2026 AI 研究",
    text: [
      "Research completed in 33m · 48 citations · 583 searches",
      "2026 香港人工智能發展及部署研究報告",
      "這是一段報告預覽。",
    ].join("\n"),
  });

  assert.equal(state.present, true);
  assert.equal(state.running, false);
  assert.equal(state.completed, true);
  assert.equal(state.durationText, "33m");
  assert.equal(state.citationCount, 48);
  assert.equal(state.searchCount, 583);
  assert.equal(state.reportTitle, "2026 香港人工智能發展及部署研究報告");
});

test("deep research viewer and markdown export controls are detected", () => {
  const state = __testing.parseDeepResearchState({
    text: [
      "2026 香港人工智能發展及部署研究報告",
      "Sources and activity",
      "Table of contents",
      "## 執行摘要",
      "## 發展格局",
      "Export",
      "Copy contents",
      "Export to Markdown",
    ].join("\n"),
    buttonLabels: ["Export", "Copy contents", "Export to Markdown"],
  });

  assert.equal(state.viewerOpen, true);
  assert.equal(state.completed, true);
  assert.equal(state.exportAvailable, true);
  assert.equal(state.copyContentsAvailable, true);
  assert.equal(state.markdownExportAvailable, true);
});

test("deep research open viewer is complete even without completion banner", () => {
  const state = __testing.parseDeepResearchState({
    title: "香港 2026 AI 研究",
    text: [
      "2026 香港人工智能發展及部署研究報告",
      "執行摘要",
      "報告內容",
      "發展格局",
      "報告內容",
      "Sources and activity",
      "Table of contents",
      "Export",
    ].join("\n"),
    buttonLabels: ["Export", "Sources and activity"],
  });

  assert.equal(state.present, true);
  assert.equal(state.viewerOpen, true);
  assert.equal(state.completed, true);
  assert.equal(state.running, false);
  assert.equal(state.reportTitle, "2026 香港人工智能發展及部署研究報告");
});

test("visible DOM node ids are parsed as strings for dom_cua", () => {
  assert.equal(
    __testing.findVisibleDomNodeId('<button node_id=84 type="button">Export to Markdown</button>', /Export to Markdown/i),
    "84"
  );
  assert.equal(
    __testing.findVisibleDomNodeId('<button node_id="70" aria-label="Export" />', /aria-label=["']Export["']/i),
    "70"
  );
  assert.equal(
    __testing.findVisibleDomNodeId('<button aria-label="Export" />', /Export/i),
    null
  );
});

test("deep research report card is parsed from visible DOM markup", () => {
  const state = __testing.parseDeepResearchState({
    text: [
      '<a node_id=1 href="#main">Skip to content</a>',
      '<button node_id=73 aria-label="Export" type="button" />',
      '<button node_id=74 aria-label="Expand" type="button" />',
      '<div node_id=75 role="button">2026 香港人工智能發展及部署研究報告 執行摘要 截至 2026 年 6 月，香港的 AI 發展已由政策鋪路走到公共算力。</div>',
    ].join("\n"),
  });

  assert.equal(state.present, true);
  assert.equal(state.completed, true);
  assert.equal(state.reportTitle, "2026 香港人工智能發展及部署研究報告");
  assert.equal(state.exportAvailable, true);
});

test("deep research merge prefers real report title over conversation title", () => {
  const merged = __testing.mergeDeepResearchStates(
    {
      present: true,
      reportTitle: "香港 2026 AI 研究",
      exportAvailable: true,
    },
    {
      present: true,
      completed: true,
      reportTitle: "2026 香港人工智能發展及部署研究報告",
    }
  );

  assert.equal(merged.reportTitle, "2026 香港人工智能發展及部署研究報告");
  assert.equal(merged.completed, true);
});

test("deep research completion can be report-only", () => {
  assert.equal(__testing.isResponseCompleteSnapshot({
    latestText: "",
    textStableForMs: 60000,
    artifactCount: 0,
    artifactStableForMs: 60000,
    allowArtifactOnly: false,
    allowDeepResearchReport: true,
    deepResearch: {
      completed: true,
      running: false,
      reportTitle: "2026 香港人工智能發展及部署研究報告",
    },
    deepResearchStableForMs: 6000,
    isAnswering: false,
    responseActionsAvailable: false,
  }), true);
});

test("deep research markdown validation checks title and headings", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gpt55-relay-test-"));
  const reportPath = path.join(dir, "deep-research-report.md");
  const report = [
    "# 2026 香港人工智能發展及部署研究報告",
    "",
    "## 執行摘要",
    "內容".repeat(60),
    "",
    "## 發展格局",
    "內容".repeat(60),
    "",
    "## 行動建議",
    "內容".repeat(60),
  ].join("\n");
  await writeFile(reportPath, report);

  const validation = await __testing.validateDeepResearchMarkdown(
    reportPath,
    { reportTitle: "2026 香港人工智能發展及部署研究報告" },
    { minBytes: 100 }
  );
  assert.equal(validation.ok, true);
  assert.equal(validation.headingCount, 4);
  assert.equal(validation.reportTitle, "2026 香港人工智能發展及部署研究報告");

  const conversationTitleValidation = await __testing.validateDeepResearchMarkdown(
    reportPath,
    { reportTitle: "香港 2026 AI 研究" },
    { minBytes: 100 }
  );
  assert.equal(conversationTitleValidation.ok, true);
  assert.equal(conversationTitleValidation.reportTitle, "2026 香港人工智能發展及部署研究報告");

  const badPath = path.join(dir, "bad.md");
  await writeFile(badPath, "https://chatgpt.com/c/abc");
  const badValidation = await __testing.validateDeepResearchMarkdown(
    badPath,
    { reportTitle: "2026 香港人工智能發展及部署研究報告" },
    { minBytes: 1 }
  );
  assert.equal(badValidation.ok, false);
});

test("image artifacts are signed and data URLs are decodable", () => {
  const artifacts = [
    { kind: "image", src: "data:image/png;base64,QUJD", width: 512, height: 512 },
    { kind: "link", href: "https://example.com/file" },
  ];

  assert.equal(__testing.generatedImageArtifacts(artifacts).length, 1);
  assert.equal(
    __testing.imageArtifactSignature(artifacts),
    "data:image/png;base64,QUJD|512x512"
  );
  assert.deepEqual(__testing.parseDataUrl("data:image/png;base64,QUJD"), {
    mimeType: "image/png",
    base64: "QUJD",
  });
  assert.deepEqual(__testing.markdownForArtifacts([
    { kind: "image", src: "data:image/png;base64,QUJD", localPath: "/tmp/image-01.png" },
  ]), [
    "![generated image 1](/tmp/image-01.png)",
  ]);
});

test("final response text preserves assistant text and appends conversation URL", () => {
  assert.equal(
    __testing.formatFinalResponseText({
      assistantText: "完整回覆第一行\n\n完整回覆最後一行\n",
      conversationUrl: "https://chatgpt.com/c/example",
    }),
    "完整回覆第一行\n\n完整回覆最後一行\n\nConversation URL: https://chatgpt.com/c/example"
  );

  assert.equal(
    __testing.formatFinalResponseText({
      assistantText: "",
      conversationUrl: "https://chatgpt.com/c/example",
    }),
    "Conversation URL: https://chatgpt.com/c/example"
  );
});

test("complete relay results require verbatim finalDeliveryText delivery", () => {
  const response = __testing.verbatimFinalResponse({
    status: "complete",
    assistantText: "完整回覆第一行\n\n- 逐字保留項目\n- 不可摘要\n",
    conversationUrl: "https://chatgpt.com/c/verbatim",
  });

  assert.equal(response.mustReturnVerbatim, true);
  assert.equal(response.mustReturnFinalDelivery, true);
  assert.equal(response.verbatimField, "finalDeliveryText");
  assert.equal(response.finalDeliveryField, "finalDeliveryText");
  assert.equal(
    response.finalResponseText,
    "完整回覆第一行\n\n- 逐字保留項目\n- 不可摘要\n\nConversation URL: https://chatgpt.com/c/verbatim"
  );
  assert.equal(response.finalDeliveryText, response.finalResponseText);
  assert.match(response.finalOutputContract.instruction, /Return finalDeliveryText exactly/);
});

test("final delivery includes generated image markdown when text is empty", () => {
  const response = __testing.verbatimFinalResponse({
    status: "complete",
    assistantText: "",
    conversationUrl: "https://chatgpt.com/c/image",
    artifacts: [
      { kind: "image", src: "data:image/png;base64,QUJD", localPath: "/tmp/image-01.png" },
    ],
  });

  assert.equal(response.mustReturnVerbatim, true);
  assert.equal(response.verbatimField, "finalDeliveryText");
  assert.equal(
    response.finalDeliveryText,
    "![generated image 1](/tmp/image-01.png)\n\nConversation URL: https://chatgpt.com/c/image"
  );
});

test("final delivery includes report or file artifacts with the conversation URL", () => {
  const response = __testing.verbatimFinalResponse({
    status: "complete",
    assistantText: "# 完整研究報告\n\n這是完整內容。",
    conversationUrl: "https://chatgpt.com/c/research",
    artifacts: [
      {
        kind: "deep-research-report",
        title: "完整研究報告",
        localPath: "/tmp/deep-research-report.md",
        mimeType: "text/markdown",
      },
      {
        kind: "file",
        name: "result.csv",
        localPath: "/tmp/result.csv",
        mimeType: "text/csv",
      },
    ],
  });

  assert.equal(
    response.finalDeliveryText,
    "# 完整研究報告\n\n這是完整內容。\n\nArtifacts:\n- 完整研究報告: /tmp/deep-research-report.md\n- result.csv: /tmp/result.csv\n\nConversation URL: https://chatgpt.com/c/research"
  );
});

test("final delivery preserves markdown formatting directly", () => {
  const markdown = [
    "## 格式測試",
    "",
    "- 第一點",
    "- **第二點**",
    "",
    "| 欄位 | 值 |",
    "| --- | --- |",
    "| 模型 | 5.5 Pro Extended |",
  ].join("\n");

  const response = __testing.verbatimFinalResponse({
    status: "complete",
    assistantText: markdown,
    conversationUrl: "https://chatgpt.com/c/markdown",
  });

  assert.equal(
    response.finalDeliveryText,
    `${markdown}\n\nConversation URL: https://chatgpt.com/c/markdown`
  );
  assert.equal(response.finalDeliveryText.includes("```"), false);
});

test("final delivery falls back to report markdown when assistant text is blank", () => {
  assert.equal(
    __testing.formatFinalDeliveryText({
      assistantText: "   ",
      reportMarkdown: "# Deep Research Report\n\nFull exported report.",
      conversationUrl: "https://chatgpt.com/c/report",
    }),
    "# Deep Research Report\n\nFull exported report.\n\nConversation URL: https://chatgpt.com/c/report"
  );
});

test("pending relay results do not force verbatim delivery", () => {
  const response = __testing.verbatimFinalResponse({
    status: "pending",
    assistantText: "",
    conversationUrl: "https://chatgpt.com/c/pending",
  });

  assert.equal(response.mustReturnVerbatim, false);
  assert.equal(response.mustReturnFinalDelivery, false);
  assert.equal(response.verbatimField, "finalDeliveryText");
  assert.equal(response.finalResponseText, "Conversation URL: https://chatgpt.com/c/pending");
  assert.equal(response.finalDeliveryText, "Conversation URL: https://chatgpt.com/c/pending");
});

test("attachment upload busy signals are detected before image send", () => {
  assert.equal(
    __testing.isAttachmentUploadBusySignal({
      composerText: "Uploading sample.png",
    }),
    true
  );
  assert.equal(
    __testing.isAttachmentUploadBusySignal({
      composerText: "正在上傳 sample.png",
    }),
    true
  );
  assert.equal(
    __testing.isAttachmentUploadBusySignal({
      composerText: "sample.png attached",
    }),
    false
  );
  assert.equal(
    __testing.isAttachmentUploadBusySignal({
      composerText: "請分析這張圖片，並整理重點。",
    }),
    false
  );
});

test("attachment signal signature changes when upload busy state changes", () => {
  const settled = __testing.attachmentSignalSignature({
    fileNames: ["sample.png"],
    imageCount: 1,
    removeButtonCount: 1,
    attachmentButtonCount: 1,
    composerText: "sample.png attached",
  });
  const busy = __testing.attachmentSignalSignature({
    fileNames: ["sample.png"],
    imageCount: 1,
    removeButtonCount: 1,
    attachmentButtonCount: 1,
    composerText: "Uploading sample.png",
  });

  assert.notEqual(settled, busy);
});

test("intelligence request defaults to the current ChatGPT selection", () => {
  const request = __testing.resolveIntelligenceRequest({
    prompt: "請整理高達歷代的歷史",
  });

  assert.deepEqual(request, {
    model: null,
    mode: null,
    effort: null,
    explicit: false,
    source: "current",
  });
  assert.equal(__testing.formatIntelligenceLabel(request), "Current ChatGPT selection");
});

test("intelligence request parses model, mode, and effort from prompt", () => {
  const request = __testing.resolveIntelligenceRequest({
    prompt: "GPT Relay 請幫我轉用 GPT 5.3 Thinking light 然後回答。",
  });

  assert.equal(request.model, "5.3");
  assert.equal(request.mode, "thinking");
  assert.equal(request.effort, "light");
  assert.equal(request.explicit, true);
  assert.equal(__testing.formatIntelligenceLabel(request), "5.3 Thinking Light");
});

test("visible intelligence parser handles current ChatGPT Pro menu labels", () => {
  const parsed = __testing.parseVisibleIntelligenceLabel("GPT-5.5 Pro Extended");

  assert.equal(parsed.model, "5.5");
  assert.equal(parsed.mode, "pro");
  assert.equal(parsed.effort, "extended");
  assert.equal(__testing.formatIntelligenceLabel(parsed), "5.5 Pro Extended");
});

test("explicit model request can be satisfied by current visible menu selection", () => {
  const request = __testing.resolveIntelligenceRequest({
    prompt: "請用 GPT 5.5 Pro 回答",
  });
  const current = __testing.parseVisibleIntelligenceLabel("GPT-5.5 Pro Extended");

  assert.equal(__testing.intelligenceSelectionSatisfiesRequest(current, request), true);
});

test("relay plugin name alone does not request a model change", () => {
  const request = __testing.resolveIntelligenceRequest({
    prompt: "GPT Relay create image with a cat",
  });

  assert.equal(request.explicit, false);
  assert.equal(request.model, null);
  assert.equal(request.mode, null);
  assert.equal(request.effort, null);

  const legacyRequest = __testing.resolveIntelligenceRequest({
    prompt: "GPT Relay create image with a cat",
  });

  assert.equal(legacyRequest.explicit, false);
  assert.equal(legacyRequest.model, null);
  assert.equal(legacyRequest.mode, null);
  assert.equal(legacyRequest.effort, null);
});

test("pro mode accepts only standard or extended effort", () => {
  assert.throws(
    () => __testing.resolveIntelligenceRequest({
      prompt: "請用 GPT 5.5 Pro heavy 回答",
    }),
    /Pro mode only supports Standard and Extended effort/
  );

  const request = __testing.resolveIntelligenceRequest({
    prompt: "請用 GPT 5.5 Pro standard 回答",
  });

  assert.equal(request.model, "5.5");
  assert.equal(request.mode, "pro");
  assert.equal(request.effort, "standard");
});

test("intelligence request supports options overriding prompt", () => {
  const request = __testing.resolveIntelligenceRequest({
    prompt: "用 GPT 5.3 Thinking light",
    model: "5.4",
    mode: "pro",
    effort: "extended",
  });

  assert.equal(request.model, "5.4");
  assert.equal(request.mode, "pro");
  assert.equal(request.effort, "extended");
  assert.equal(request.source, "options");
});
