# ChatGPT UI Observations

These observations are used by GPT Relay selectors. They are intentionally small and tied to visible UI, not hidden app state.

## Composer

- The main input is exposed as textbox `Chat with ChatGPT`.
- The send control is exposed as button `Send prompt`.
- The visible Extended Pro mode is exposed as button `Extended Pro`.
- When Extended Pro is not already selected, the mode menu can expose button `Thinking` or `Instant`, then menu item radio `Pro • Extended`.

## Assistant Output

- Assistant messages are rooted at `[data-message-author-role="assistant"]`.
- Plain `innerText` loses ChatGPT's rendered structure for lists, headings, tables, and inline formatting.
- Relay output should convert the visible assistant DOM to display-ready Markdown and return that directly in `finalDeliveryText`; do not wrap the entire answer in a code block.

## Intelligence Configure

Observed 2026-06-09 in a live smoke run:

- The bottom composer mode pill can display values like `Extended Pro`, `5.3 Instant`, or `5.5 Thinking Light`.
- The lower-left account/profile control is exposed as `data-testid="accounts-profile-button"` with aria `Open profile menu`; intelligence selectors must never use it as a model control.
- The active composer model pill sits on the same row as textbox `Chat with ChatGPT`, to the right of the textbox. In the live 2026-06-09 run it displayed `Extended Pro`.
- Opening `Configure...` shows an `Intelligence` popover.
- The model selector is exposed as `role="combobox"` with visible text such as `5.5` or `5.3`, not as a normal button.
- The model dropdown exposes `role="option"` rows: `5.5`, `5.4`, `5.3`, `5.2`, `4.5`, `o3`.
- The mode choices are exposed as `role="radio"` rows with text like `Instant For everyday chats`, `Thinking For complex questions`, and `Pro Research-grade intelligence`.
- The effort selector is exposed as `role="combobox"` with visible text such as `Extended`.
- `5.5` and `5.4` expose `Instant`, `Thinking`, and `Pro`; `Thinking` exposes `Light`, `Standard`, `Extended`, and `Heavy`; `Pro` exposes `Standard` and `Extended`.
- `5.3` exposed only `Instant` in the matrix run; `4.5` and `o3` exposed their own single model rows without separate effort options.
- `5.5 Thinking Light` was selected and sent successfully in live smoke conversation `https://chatgpt.com/c/6a26ff03-52cc-83e8-bd50-4815121e7826`, returning `OK mode smoke`.
- After selecting `5.3`, the visible UI only exposed `Instant 5.3 For everyday chats` in that run; `Thinking` and `Pro` were not visible for that model. Treat hidden combinations as unavailable instead of silently choosing another mode.

## Composer Menu

The composer plus button is exposed as button `Add files and more`.

Observed menu labels:

- `Add photos & files`
- `Recent files`
- `Create image`
- `Deep research`
- `Web search`
- `More`
- `Projects`

The Projects submenu displays project names such as:

- `Image Gen`
- `travel app`
- `GEO`
- `Development Requires`
- `Important Chat`
- `Saved content`

## Apps

ChatGPT Apps are available on `/apps` and can also be invoked from the composer with `@AppName` style mentions.

Observed app names include:

- `Adobe Photoshop`
- `Airtable`
- `Apple Music`
- `Booking.com`
- `Canva`
- `Figma`
- `Lovable`
- `Replit`
- `Tripadvisor`

The relay tries to type `@AppName`, select a single matching suggestion when visible, then paste/type the prompt. If no suggestion appears, it leaves the explicit `@AppName` mention in the prompt.
