# GPT Relay Codex 插件

[Main README](./README.md) | [English details](./README.en.md)

GPT Relay 讓 Codex 透過你已登入的 Chrome session 把 prompt 交給 ChatGPT，等待完成後再把結果帶回 Codex。

## 安裝

```bash
codex plugin marketplace add kangmg/GPT-Relay-Codex-Plugin-
```

然後到 Codex **Plugins** -> **Manage** 安裝 **GPT Relay**，並開啟新的 Codex thread。

本機開發版本可以直接加入本機資料夾：

```bash
codex plugin marketplace add /absolute/path/to/GPT-Relay-Codex-Plugin-
```

切換來源後，請在 Codex Plugins UI 重新安裝或更新插件，並開新 thread。

如果你是在替換舊的 marketplace 來源，請先移除舊來源再加入新的來源。

## 使用前需要

- Codex 支援插件功能。
- 已安裝並啟用官方 Codex Chrome extension。
- Chrome 已登入 ChatGPT。
- ChatGPT 帳號本身有你要求的模型或工具權限。

如果要上傳本機檔案或圖片，請在 Chrome extension details 裡替 Codex Chrome extension 開啟 **Allow access to file URLs**。

## 更新

```bash
codex plugin marketplace upgrade gpt-relay
```

然後在 Codex Plugins UI 更新或重新安裝 **GPT Relay**，並開新 thread。

## 注意事項

- GPT Relay 操作的是可見的 ChatGPT 網頁 UI。
- 插件只回報畫面上可見的模型、模式與強度，不聲稱知道隱藏後端狀態。
- 遇到登入、CAPTCHA、權限彈窗或帳號沒有相關功能時會停止。
