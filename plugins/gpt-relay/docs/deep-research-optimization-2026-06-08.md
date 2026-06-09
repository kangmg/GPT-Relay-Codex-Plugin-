# GPT Relay Deep Research Retrieval Optimization Report

日期：2026-06-08

目標插件：`gpt-relay`

目標：讓插件能可靠判斷 ChatGPT Deep Research 是否已完成，並在完成後自動打開完整報告 viewer，使用右上角匯出選單下載 Markdown 報告，最後把報告保存為可由 Codex 讀取的 artifact。

## 結論

這次事故不是 Deep Research 未完成，而是插件只用普通聊天訊息 DOM 判斷結果。Deep Research 完成後，全文主要存在於 ChatGPT 的 report card / report viewer / export surface，不一定存在於標準的 `[data-message-author-role="assistant"]` assistant text 中。

可重複成功路徑是：

1. 從 Chrome 現有分頁找回原本的 ChatGPT conversation tab。
2. 接管原分頁，而不是只新開同一個 `/c/...` URL。
3. 在 conversation 頁判斷 `Research completed in ... · ... citations · ... searches` 是否出現。
4. 如只見小報告卡片，點擊報告卡片或 expand/open 動作打開完整 report viewer。
5. 在 report viewer 右上角按 `Export`。
6. 優先選 `Export to Markdown`，不要依賴 `Copy contents` 作為唯一方式。
7. 下載完成後用檔案大小、標題、章節、完成 metadata 驗證報告完整性。
8. 把 Markdown 移入或複製到插件 artifact 目錄，更新 session 狀態為 `complete`。

## 本次實證

Session:

- `relaySessionId`: `6a269150-b9f0-83e8-a1af-cc093206331d`
- `conversationUrl`: `https://chatgpt.com/c/6a269150-b9f0-83e8-a1af-cc093206331d`
- `feature`: `deep-research`
- ChatGPT tab title: `香港 2026 AI 研究`
- Report title: `2026 香港人工智能發展及部署研究報告`

畫面上可見完成訊號：

- `Research completed in 33m · 48 citations · 583 searches`
- 報告卡片標題：`2026 香港人工智能發展及部署研究報告`
- 完整 viewer 內有標題、`執行摘要`、`發展格局` 等章節
- 右上角匯出選單有：
  - `Copy contents`
  - `Export to Markdown`
  - `Export to Word`
  - `Export to PDF`

實際自動化結果：

- `pollRelaySession(...)` 仍回傳 `pending`，因為 helper 未識別 Deep Research report viewer。
- `Copy contents` 按鈕可被點擊，但 `tab.clipboard.readText()` 和 `pbpaste` 均讀到 0 bytes，所以不能作為唯一成功路徑。
- `Export to Markdown` 成功產生 `/Users/mattchan/Downloads/deep-research-report.md`。
- 該 Markdown 檔案驗證結果：
  - `197` 行
  - `40415` bytes
  - 第一行是 `# 2026 香港人工智能發展及部署研究報告`
  - 包含 `## 執行摘要`、`## 發展格局`、`## 部署現況`、`## 監管與治理`、`## 基礎設施與人才`、`## 機會與風險`、`## 行動建議`、`## 結論與資料限制`

## 失敗原因

現有 `chatgpt_relay.mjs` 的主要流程如下：

- `pollRelaySession` 只根據 stored session 新開一個 tab，並 `goto(session.conversationUrl)`。
- `waitForAssistantResponse` 只等待標準 assistant text 或 image artifact。
- `readChatState` 主要收集：
  - `[data-message-author-role]` messages
  - generated image artifacts
  - `Copy response` / `More actions` 等普通 response actions
- `isResponseCompleteSnapshot` 沒有 Deep Research 專用完成條件。

Deep Research 的 UI 形態不同：

- 完成訊號是一行研究 metadata，不是普通 assistant text。
- 報告先以 card preview 顯示。
- 完整內容在 report viewer 中。
- 匯出功能在 viewer 右上角 `Export` menu 中。
- 重新打開同一個 `/c/...` URL 不一定恢復到原本完整 viewer 狀態。
- `domSnapshot()` 可能不能完整反映 report viewer；`dom_cua.get_visible_dom()` 和 screenshot 更可靠。

所以插件不應把「沒有普通 assistant text」解讀成「Deep Research 未完成」。

## 目標狀態機

建議為 `feature: "deep-research"` 加一個專用狀態機：

```text
submitted
  -> running
  -> completed_card
  -> viewer_open
  -> export_menu_open
  -> markdown_downloaded
  -> validated_complete
```

錯誤或降級狀態：

```text
running_timeout
completed_but_card_not_openable
viewer_open_but_export_missing
copy_contents_empty
markdown_download_not_observed
downloaded_file_failed_validation
partial_report_only
```

## 完成判斷規則

### Running

只要頁面仍有以下訊號，保持 `pending`：

- `Researching`
- `Searching`
- `Reading`
- `Analyzing`
- `Deep research`
- stop / busy controls
- assistant busy marker

### Completed Card

若 `main` 或可視 DOM 出現以下 pattern，可判定 Deep Research 已完成，但尚未必取得全文：

```js
/Research completed in\s+.+?\s+·\s+\d+\s+citations\s+·\s+\d+\s+searches/i
```

應解析：

```js
{
  status: "complete",
  durationText: "33m",
  citationCount: 48,
  searchCount: 583
}
```

同時應收集：

- report card title
- preview text
- visible buttons / actions
- whether an open / expand action exists
- whether an export/download action exists

### Viewer Open

若可視 DOM 或 screenshot 中出現以下組合，可判定完整 viewer 已打開：

- report title as H1 / heading
- `Export` button 或下載圖示
- `Sources and activity` button
- `Table of contents`
- 至少一個章節標題，例如 `執行摘要`

Viewer 開啟不等於已取得全文。仍需匯出或完整抽取。

## 可重複操作流程

### Step 1: 優先找回原 Chrome 分頁

不要一開始就新開 stored conversation URL。先找現有 Chrome 分頁：

```js
const openTabs = await browser.user.openTabs();
const target = openTabs.find((tab) =>
  tab.url?.includes("/c/6a269150-b9f0-83e8-a1af-cc093206331d") ||
  tab.title?.includes("香港 2026 AI 研究")
);
const tab = await browser.user.claimTab(target);
```

原因：

- 原分頁可能已經停在完成 report viewer。
- 新開同一個 `/c/...` 可能只看到 prompt 或 conversation shell。
- Deep Research 結果 UI 可能依賴原 tab 的 hydrated state。

若找不到原分頁，才 fallback：

```js
const tab = await browser.tabs.new();
await tab.goto(session.conversationUrl);
```

### Step 2: 用可視 DOM / screenshot 確認畫面狀態

先取：

```js
const visibleDom = await tab.dom_cua.get_visible_dom();
```

必要時再取 screenshot：

```js
const png = await tab.screenshot({ fullPage: false });
```

不要只依賴 `domSnapshot()`。本次經驗中，`domSnapshot()` 對 report viewer 的文字訊號不夠完整，但 `dom_cua.get_visible_dom()` 能看到：

```html
<button aria-label="Export" />
<button>Copy contents</button>
<button>Export to Markdown</button>
<button>Export to Word</button>
<button>Export to PDF</button>
```

### Step 3: 若仍在小報告卡片，點擊打開 viewer

在 conversation 頁尋找：

- 完成 metadata：`Research completed in ...`
- report title
- report card container
- open / expand icon
- download / export icon

點擊策略：

1. 優先點 report card container 或 title。
2. 若有明確 `Open` / `Expand` / fullscreen button，點該 button。
3. 點擊後等待 viewer title、`Export`、`Sources and activity`、`Table of contents` 任一組合出現。

示意：

```js
await clickDeepResearchReportCard(tab, {
  title: session.deepResearch.title,
});
await waitForDeepResearchViewer(tab, {
  title: session.deepResearch.title,
  timeoutMs: 10000,
});
```

### Step 4: 打開右上角 Export menu

在 viewer 中尋找 `Export` button：

```js
const visible = await tab.dom_cua.get_visible_dom();
// 找到類似 <button node_id=70 aria-label="Export" type="button" />
await tab.dom_cua.click({ node_id: exportNodeId });
```

等待選單出現：

```text
Copy contents
Export to Markdown
Export to Word
Export to PDF
```

### Step 5: 優先使用 Export to Markdown

本次 `Copy contents` 的實測結果是剪貼簿為空，所以建議順序如下：

1. `Export to Markdown`
2. 若 Markdown 失敗，再試 `Copy contents`
3. 若 Copy 成功但內容不足，仍視為 partial
4. Word / PDF 作為最後 artifact fallback

原因：

- Markdown 最適合 Codex 讀取、diff、引用、切分和保存。
- Copy contents 依賴 clipboard permission / implementation，容易成功點擊但實際空白。
- PDF 可保存但需要後續 PDF text extraction，流程較重。

### Step 6: 下載偵測

理想流程：

```js
const before = await listRecentDownloads();
await clickExportToMarkdown(tab);
const download = await tab.playwright.waitForEvent("download", { timeoutMs: 10000 });
```

但本次實測中，`waitForEvent("download")` timeout，檔案仍成功出現在 Downloads。因此需要 fallback：

```js
const after = await listRecentDownloads();
const candidate = newestFileCreatedAfter(before, {
  extensions: [".md", ".markdown"],
  filenameHints: ["deep-research-report", reportTitle],
  maxAgeMs: 60000,
});
```

掃描 Downloads 時必須保守：

- 只看 click 前後時間窗內的新檔。
- 只接受 `.md` / `.markdown`，或 fallback `.docx` / `.pdf`。
- 檔案名需符合 ChatGPT 匯出常見命名或 report title。
- 不要掃描或讀取不相關舊檔。

### Step 7: 完整性驗證

Markdown 下載後不要立刻判斷成功。先驗證：

```js
{
  bytes: fileBytes >= 5000,
  startsWithTitle: text.startsWith(`# ${reportTitle}`) || text.includes(reportTitle),
  hasHeadings: countMarkdownHeadings(text) >= 3,
  hasExpectedSections: [
    "執行摘要",
    "發展格局"
  ].some((section) => text.includes(section)),
  hasCitationMarkers: /cite|turn\d+(search|view)\d+|來源|參考/i.test(text),
  notOnlyUrl: text.trim() !== session.conversationUrl
}
```

本次成功檔案的驗證 baseline：

```text
lines: 197
bytes: 40415
title: # 2026 香港人工智能發展及部署研究報告
sections: 8 major sections
```

建議最低門檻：

- bytes >= 5000
- title match
- at least 3 markdown headings
- includes at least one known section heading from visible viewer/card
- not empty clipboard/download

若不通過，回傳：

```js
{
  status: "pending",
  diagnosticCode: "DEEP_RESEARCH_REPORT_EXPORT_INCOMPLETE",
  deepResearch: {
    completed: true,
    exported: true,
    validated: false
  }
}
```

不要誤報 `complete`。

## 建議修改位置

### 1. `pollRelaySession`

現狀：每次新開 tab 到 stored URL。

建議：

- 先 `browser.user.openTabs()`。
- 按 conversation id、URL、title、session feature 找原分頁。
- 能 claim 原分頁就優先使用。
- 找不到才新開 stored URL。

Pseudo API:

```js
async function openOrClaimStoredSessionTab(browser, session) {
  const conversationId = getConversationId(session.conversationUrl);
  const tabs = await browser.user.openTabs().catch(() => []);
  const candidate = tabs.find((tab) =>
    tab.url?.includes(`/c/${conversationId}`) ||
    (session.title && tab.title?.includes(session.title))
  );

  if (candidate) {
    return {
      tab: await browser.user.claimTab(candidate),
      source: "claimed-user-tab",
    };
  }

  const tab = await browser.tabs.new();
  await tab.goto(session.conversationUrl);
  await waitForLoad(tab);
  return { tab, source: "new-url-tab" };
}
```

### 2. `readChatState`

加入 Deep Research 專用讀取：

```js
{
  deepResearch: {
    present: true,
    running: false,
    completed: true,
    completionText: "Research completed in 33m · 48 citations · 583 searches",
    durationText: "33m",
    citationCount: 48,
    searchCount: 583,
    reportTitle: "2026 香港人工智能發展及部署研究報告",
    viewerOpen: true,
    exportAvailable: true,
    copyContentsAvailable: true,
    markdownExportAvailable: true,
    previewText: "...",
  }
}
```

讀取來源：

- `main.innerText`
- visible button labels
- report card text near completion marker
- viewer title / H1
- `dom_cua.get_visible_dom()` fallback for accessible buttons

注意：`readChatState` 目前是 read-only `evaluate`。若需要 `dom_cua`，可以在 `waitForAssistantResponse` 外層補一個 `readDeepResearchVisibleState(tab)`，避免把所有事情塞入 page evaluate。

### 3. `isResponseCompleteSnapshot`

加入 feature-specific guard：

```js
const deepResearchComplete = Boolean(
  snapshot.allowDeepResearchReport &&
  snapshot.deepResearch?.completed &&
  snapshot.deepResearch?.reportTitle &&
  !snapshot.deepResearch?.running &&
  !snapshot.isAnswering &&
  snapshot.deepResearchStableForMs >= RESPONSE_STABLE_MS
);

return textComplete || artifactComplete || deepResearchComplete;
```

呼叫時：

```js
allowDeepResearchReport: isDeepResearchFeature(feature)
```

### 4. `waitForAssistantResponse`

除了追蹤 `lastAssistantText` 和 image artifacts，也追蹤 Deep Research signature：

```js
const deepResearchSignature = [
  state.deepResearch?.completionText,
  state.deepResearch?.reportTitle,
  state.deepResearch?.viewerOpen,
  state.deepResearch?.markdownExportAvailable,
].join("|");
```

若 signature 穩定並 completed，即進入 extraction，而不是直接回傳空 `assistantText`。

### 5. 新增 `extractDeepResearchReport`

建議 signature：

```js
async function extractDeepResearchReport(tab, state, context) {
  await ensureDeepResearchViewerOpen(tab, state.deepResearch);
  const exportResult = await exportDeepResearchMarkdown(tab, state.deepResearch, context);
  const validation = await validateDeepResearchMarkdown(exportResult.localPath, state.deepResearch);

  if (!validation.ok) {
    throw codedError("DEEP_RESEARCH_REPORT_VALIDATION_FAILED", validation.reason, {
      exportResult,
      validation,
    });
  }

  return {
    text: validation.text,
    artifact: {
      kind: "deep-research-report",
      title: state.deepResearch.reportTitle,
      localPath: exportResult.localPath,
      mimeType: "text/markdown",
      bytes: validation.bytes,
      lineCount: validation.lineCount,
      citationCount: state.deepResearch.citationCount,
      searchCount: state.deepResearch.searchCount,
      durationText: state.deepResearch.durationText,
      capture: "chatgpt-export-markdown",
    },
  };
}
```

### 6. `persistArtifacts`

現時主要處理 image artifacts。需要支援 text/markdown artifact：

```js
{
  kind: "deep-research-report",
  localPath: ".../artifacts/<session-id>/deep-research-report.md",
  mimeType: "text/markdown",
  bytes: 40415
}
```

如果下載先落在 `~/Downloads`，應把它複製或移到 session artifact dir：

```text
~/.codex/gpt-relay/artifacts/<session-id>/deep-research-report.md
```

或使用插件目前 `statePath` 相鄰 artifact 目錄。

### 7. Response Shape

Deep Research 完成時建議回傳：

```js
{
  ok: true,
  status: "complete",
  mode: "Extended Pro",
  assistantText: reportMarkdown,
  reportMarkdown,
  conversationUrl,
  title,
  deepResearch: {
    reportTitle,
    durationText,
    citationCount,
    searchCount,
    capture: "chatgpt-export-markdown"
  },
  artifacts: [
    {
      kind: "deep-research-report",
      localPath,
      mimeType: "text/markdown",
      bytes
    }
  ],
  messages
}
```

若報告太長，可以允許 `assistantText` 為摘要或空，但必須提供 artifact：

```js
{
  status: "complete",
  assistantText: "",
  reportMarkdown: "",
  artifacts: [reportArtifact],
  assistantTextTruncated: true
}
```

但對 Codex 使用體驗而言，最好同時保存 artifact 並返回 `reportMarkdown`。

## Copy Contents 的定位

`Copy contents` 不應是首選成功路徑。

本次實測：

```text
clicked Copy contents
tab.clipboard.readText(): ""
pbpaste: 0 bytes
```

建議：

1. 可作 fallback。
2. 點擊後必須立即驗證 clipboard bytes 和 title。
3. clipboard 空白或只含 URL 時，立即改用 `Export to Markdown`。
4. 不要因為按鈕點擊成功就標記 complete。

## 下載與安全邊界

若要掃描 Downloads，需要遵守：

- 只在插件剛剛點擊 `Export to Markdown` 後掃描。
- 只看很短時間窗，例如 60 秒。
- 只看 `.md` / `.markdown` / `.docx` / `.pdf`。
- 優先 filename 與 `deep-research-report` 或 report title 匹配。
- 找到候選後先驗證 title 和章節。
- 不要讀取 Downloads 中不相關文件。

若用戶環境允許，最好讓 Chrome download event 提供檔案路徑，避免掃描 Downloads。

## 測試計劃

### Unit Fixtures

建立 fixture HTML / state object：

1. 普通 assistant text complete
   - 預期：原邏輯仍 complete。

2. Deep Research running
   - 含 `Deep research`、`Searching`、`Reading`
   - 無 `Research completed`
   - 預期：`pending`

3. Deep Research completed card
   - 含 `Research completed in 33m · 48 citations · 583 searches`
   - 含 report title
   - 無標準 assistant text
   - 預期：`deepResearch.completed === true`

4. Report viewer open
   - 含 H1、`Export`、`Sources and activity`、`Table of contents`
   - 預期：`viewerOpen === true`

5. Export menu open
   - 含 `Copy contents`、`Export to Markdown`、`Export to Word`、`Export to PDF`
   - 預期：`markdownExportAvailable === true`

6. Copy contents empty
   - clipboard empty
   - 預期：fallback to Markdown export

7. Markdown validation pass
   - title match
   - bytes > 5000
   - >= 3 headings
   - 預期：artifact persisted, session complete

8. Markdown validation fail
   - 只有 URL 或空白
   - 預期：`DEEP_RESEARCH_REPORT_VALIDATION_FAILED`

### Live QA

使用短 Deep Research prompt：

```js
await startExtendedProRelay({
  feature: "deep-research",
  prompt: "請用 Deep Research 研究一個小題目，完成後輸出一份簡短報告。",
  keepTab: true,
  returnPending: true
});
```

完成後：

```js
await pollRelaySession({
  query: "<session id or title>",
  timeoutMs: 90000
});
```

驗證：

- 能 claim 原 Chrome tab。
- 能識別 `Research completed...`。
- 能打開 report viewer。
- 能打開 `Export` menu。
- 優先下載 Markdown。
- 若 download event timeout，仍能在安全時間窗內找到新 `.md`。
- artifact 保存到 relay artifact dir。
- session 狀態由 `pending` 更新為 `complete`。
- 再次 poll 不會重新提交 prompt。

## 驗收準則

P0:

- 已完成的 Deep Research 不可因為沒有普通 assistant text 而長期保持 `pending`。
- 可從原 Chrome tab 回收已完成 report。
- 可打開完整 report viewer。
- 可使用 `Export to Markdown` 取得完整 Markdown。
- 可保存 Markdown artifact 並回傳 artifact path。

P1:

- 可解析 duration、citation count、search count。
- 可驗證 Markdown 完整性。
- `Copy contents` 空白時自動 fallback。
- 可在 download event 不可靠時用短時間窗 Downloads fallback。

P2:

- Word/PDF fallback。
- 虛擬化 viewer 滾動抽取 fallback。
- 若所有自動路徑失敗，回傳清楚 diagnostic，而不是回傳假 complete。

## 建議錯誤碼

```text
DEEP_RESEARCH_RUNNING
DEEP_RESEARCH_COMPLETED_CARD_FOUND
DEEP_RESEARCH_VIEWER_OPEN_FAILED
DEEP_RESEARCH_EXPORT_MENU_MISSING
DEEP_RESEARCH_COPY_CONTENTS_EMPTY
DEEP_RESEARCH_MARKDOWN_DOWNLOAD_TIMEOUT
DEEP_RESEARCH_MARKDOWN_NOT_FOUND
DEEP_RESEARCH_REPORT_VALIDATION_FAILED
DEEP_RESEARCH_REPORT_PARTIAL_ONLY
```

## 最小實作順序

1. `pollRelaySession`: 優先 claim existing Chrome tab。
2. `readChatState`: 加 `deepResearch` 完成訊號。
3. `waitForAssistantResponse`: 加 `allowDeepResearchReport` completion guard。
4. `extractDeepResearchReport`: viewer open + export menu + Markdown download。
5. `validateDeepResearchMarkdown`: 檔案完整性檢查。
6. `persistArtifacts`: 保存 markdown artifact。
7. tests + live QA。

這個順序能先修復「明明完成但插件看不到」的核心問題，再逐步補強 artifact 保存和 fallback。
