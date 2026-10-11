# DESIGN — Expense Ledger

The rules every screen follows. Written before the screens; if a screen needs something that is not here, this file changes first.

## 1. Idea

A paper ledger, not an admin template. Pages are ruled, not boxed. Numbers are the loudest thing on the page and are set in a serif. One accent colour. Nothing glows, floats or casts a shadow.

Dark ("ink") is the default theme. Light ("paper") is the variant. Both are designed; neither is an automatic inversion of the other.

## 2. Colour

All colours are CSS custom properties in `src/styles/tokens.css`. Components never use a raw hex value.

| Token           | Ink (dark, default) | Paper (light) | Used for                                           |
| --------------- | ------------------- | ------------- | -------------------------------------------------- |
| `--bg`          | `#141210`           | `#F5F0E6`     | page ground                                        |
| `--surface`     | `#1B1815`           | `#FBF8F2`     | panels, dialogs, inputs                            |
| `--surface-2`   | `#24201C`           | `#ECE5D8`     | hover rows, meter tracks, skeletons                |
| `--rule`        | `#322D27`           | `#DBD2C2`     | hairline rules between sections and rows           |
| `--rule-strong` | `#7A7165`           | `#8A8070`     | input borders, context bars in charts              |
| `--ink`         | `#F0EADF`           | `#1C1915`     | text, heavy rules                                  |
| `--ink-2`       | `#BFB6A6`           | `#4A443B`     | secondary text                                     |
| `--ink-3`       | `#948B7C`           | `#686155`     | labels, captions, axis text                        |
| `--accent`      | `#7CC79C`           | `#1E5A41`     | the one accent: primary actions, links, data marks |
| `--on-accent`   | `#0E1A13`           | `#F5F0E6`     | text on an accent fill                             |
| `--warn`        | `#E0B25A`           | `#8A5A00`     | status only: close to a budget                     |
| `--danger`      | `#EC8A70`           | `#A8391F`     | status only: over budget, errors, delete           |

Contrast against `--bg` (WCAG ratio, computed, not estimated):

|                                       | Ink  | Paper |
| ------------------------------------- | ---- | ----- |
| `--ink`                               | 15.6 | 15.4  |
| `--ink-2`                             | 9.3  | 8.5   |
| `--ink-3`                             | 5.6  | 5.4   |
| `--accent`                            | 9.4  | 7.1   |
| `--warn`                              | 9.5  | 5.2   |
| `--danger`                            | 7.5  | 5.7   |
| `--rule-strong` (borders, 3.0 needed) | 3.9  | 3.4   |
| `--on-accent` on `--accent`           | 8.9  | 7.1   |

Rules:

- **One accent.** Green means "act here" or "this is the data". It is never decoration.
- **Warn and danger are status, not palette.** They appear only with a word or a sign beside them ("Over by ₹420", "▲ 12.4%"), never as colour alone.
- **No gradients, no shadows, no translucent glass.**

## 3. Type

| Role                | Face          | Size / line                       | Weight | Notes                                          |
| ------------------- | ------------- | --------------------------------- | ------ | ---------------------------------------------- |
| Hero number         | Fraunces      | `clamp(2.75rem, 7vw, 4.5rem)` / 1 | 400    | one per page                                   |
| Page title (h1)     | Fraunces      | 2rem / 1.15                       | 500    |                                                |
| Section title (h2)  | Fraunces      | 1.25rem / 1.25                    | 500    |                                                |
| Figure (stat value) | Fraunces      | 1.75rem / 1.1                     | 400    |                                                |
| Body, controls      | IBM Plex Sans | 0.9375rem / 1.5                   | 400    |                                                |
| Small               | IBM Plex Sans | 0.8125rem / 1.45                  | 400    |                                                |
| Label               | IBM Plex Sans | 0.6875rem / 1.3                   | 500    | uppercase, `letter-spacing: 0.09em`, `--ink-3` |

- Serif for headings and for large numbers. Sans for everything you read or press.
- **Every money value uses `font-variant-numeric: tabular-nums lining-nums`**, through the `<Money>` component. This also keeps the hero number from jittering while it counts up.
- Fonts are self-hosted from `@fontsource` packages. The app makes no request to a font CDN.
- Fallback stacks: `Georgia, 'Times New Roman', serif` and `system-ui, 'Segoe UI', sans-serif`.

## 4. Space and layout

- Scale (px): **4, 8, 12, 16, 24, 32, 48, 64**. Tokens `--s-1` to `--s-8`. Nothing in between.
- Page: max width 1180px, side gutter 24px (16px under 640px).
- Corner radius: **2px** on controls. **0** on sections. 4px on the data end of a bar only.
- Rules: 1px `--rule` between rows and cells. A 2px `--ink` rule opens a page's main block, like the head of a ledger page.
- Breakpoints: **640px** (phone) and **960px** (tablet). Layouts must work at 360px wide.

## 5. Components

**Sections, not cards.** A section is a label, a title and content under a rule. It has no background, border box, radius or shadow.

**Bento grid (dashboard).** A 12-column grid whose gaps are 1px and show the rule colour, so cells are divided by hairlines. Cells have 24px padding. Under 960px it becomes 6 columns, under 640px one column.

**Buttons.** Three kinds, 40px tall (44px on touch screens):

- _Primary_: accent fill, `--on-accent` text. At most one per view.
- _Secondary_: 1px `--rule-strong` border, `--ink` text.
- _Quiet_: text only, underlined on hover. Destructive actions are quiet or secondary in `--danger`, never a filled red button.

**Fields.** Label above the control, always visible (no placeholder-as-label). 1px `--rule-strong` border on `--surface`. An error message sits under the field in `--danger`, starts with what to do, and is tied to the control with `aria-describedby`.

**Tables.** No zebra stripes, no vertical lines. Row rules only. Amounts are right-aligned. Under 640px a table becomes a list of ruled rows; it never scrolls sideways.

**Dialog.** A side panel on the right (full-width sheet on phones) using the native `<dialog>`, so focus trap, Esc and the backdrop come from the browser.

**Meter (budget progress).** 6px tall. The fill carries the state: accent under 85%, warn from 85%, danger over 100%. The track is `--surface-2`. The fill never exceeds the track; "over" is said in words beside it.

**States.** Every data region shows exactly one of:

- _Loading_: grey skeleton rules in the shape of the content. No spinners.
- _Empty_: one sentence saying what is missing and one action that fixes it.
- _Error_: the API's own message, plus "Try again".
- _Data._ While a refetch runs, the old data stays on screen at reduced opacity. No skeleton flash.

**Demo badge.** When demo mode is on, a "Demo data" badge is always visible in the masthead and on the login screen. It uses `--warn` with a border, not the accent, so it cannot be mistaken for a control.

## 6. Charts

- **Form before colour.** Monthly trend: columns (each month is a separate total, and the current month is unfinished, so a line would draw a false drop). Category breakdown: ranked horizontal bars, not a pie.
- **One hue.** Bars are the accent. In the trend chart only the current month is accent; earlier months are `--rule-strong`, so the eye lands on "this month so far". There is no categorical palette, so there is nothing to tell apart by colour.
- Bars at most 24px thick, 4px rounded data end, square at the baseline, one zero baseline, one axis.
- Grid and axes: solid 1px `--rule`, never dashed. Axis text is `--ink-3`, compact numbers.
- Labels are sparing: the value on the current month and on each category bar. Text is never in the data colour.
- **Hover and keyboard focus** show a tooltip with the value first and the name second.
- **Every chart has a table view** (a "Table" switch on the section). Nothing is readable only by hovering.

## 7. Motion

Two effects, both on first load only:

- the hero number counts up (700ms, ease-out);
- meter fills and chart bars grow from zero (600ms, ease-out).

Hover and focus changes are 120ms. Under `prefers-reduced-motion: reduce` all of it is off and final values show at once.

## 8. Accessibility

- Every control is reachable and usable by keyboard. A skip link jumps to the main content.
- Focus is a 2px `--accent` outline with a 2px offset, on every focusable element.
- Touch targets are at least 44px on coarse pointers.
- Colour is never the only signal (see section 2).
- Status changes (saved, deleted, session expired) are announced in a live region.
- One `h1` per page, headings in order, landmarks for header, nav and main.
