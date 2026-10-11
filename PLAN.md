# PLAN — expense-dashboard

A React + TypeScript frontend for my Expense-Tracker-API. Status: **plan only, nothing built yet.**

## 1. What I found (real, from this machine)

**Environment**

| Item                     | Value                                     |
| ------------------------ | ----------------------------------------- |
| Node / npm / git         | 22.16.0 / 10.9.2 / 2.49.0 (Windows 11)    |
| Git identity             | Omkar210404 (global config)               |
| Browsers for screenshots | Edge and Chrome are installed             |
| `gh` CLI                 | not installed (I will not push; you push) |

Latest package versions on npm today: Vite 8.3, React 19.3, React Router 7.18, TanStack Query 5.104, Recharts 3.10, Vitest 5.0, MSW 3.0, ESLint 10.12, TypeScript 7.0.
`typescript-eslint` 8.71 supports TypeScript `<6.1` only, so **TypeScript is pinned to 6.0.3**, not 7.

**Backend contract** (read from `expense-tracker-api/app`, not edited)

| Area       | Endpoints                                                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth       | `POST /auth/register` (JSON, 201, returns the user, **no token**), `POST /auth/login` (**form-encoded**, email goes in `username`), `GET /auth/me` |
| Categories | `GET/POST /categories`, `GET/PATCH/DELETE /categories/{id}`                                                                                        |
| Expenses   | `GET/POST /expenses`, `GET /expenses/export` (CSV), `GET/PATCH/DELETE /expenses/{id}`                                                              |
| Budgets    | `GET/POST /budgets`, `GET /budgets/status?month=`, `GET/PATCH/DELETE /budgets/{id}`                                                                |
| Summary    | `GET /summary/monthly`, `GET /summary/categories`, `GET /summary/trends?months=`                                                                   |
| Health     | `GET /health`                                                                                                                                      |

Facts that shape the frontend:

- **Money is a string** with two decimals (`"249.50"`). One currency, no currency field.
- **Errors** always look like `{"error": {"code", "message", "details"?: [{"field": "body.amount", "message"}]}}`.
- **Token**: HS256 JWT with `sub`, `iat`, `exp`; login also returns `expires_in` (default 1800 s). **No refresh token, no logout endpoint, no cookies.**
- **CORS is off by default.** Real-API mode needs `CORS_ORIGINS=http://localhost:5173` in the backend's `.env`. `Content-Disposition` is not exposed, so the CSV filename is set by the client.
- **Expense list**: `page` (≥1), `page_size` (1–100, default 20), `sort` = `date | amount | created_at`, `order` = `asc | desc`. Filters: `date_from`, `date_to`, `category_id`, `min_amount`, `max_amount`, `payment_method`, `q`. **`q` searches the note only.** The export takes the same filters.
- **Validation rules to mirror in forms**: amount `> 0`, `≤ 9,999,999.99`, at most 2 decimals; date from 2000-01-01 to tomorrow (server uses UTC); note ≤ 500 chars; category name 1–50; password ≥ 8 chars and ≤ 72 bytes; payment method is one of `cash, card, upi, bank_transfer, wallet, other`.
- **Budgets** are per category per month and do not carry over. A second `POST` for the same pair is a 409, so the UI must `PATCH` when a budget exists.
- **`/budgets/status`** already returns `spent`, `remaining`, `percent_used`, `over_budget`, the `unbudgeted` list and `total_spent`. The dashboard uses these and does not recompute them.

## 2. Pages and routes

| Route                 | Page                                           | Data                                                                                                                |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `/login`, `/register` | Auth (public; redirects to `/` when logged in) | `POST /auth/login`, `POST /auth/register` then login                                                                |
| `/`                   | Dashboard                                      | `budgets/status` (this month), `summary/trends?months=6`, `summary/categories` (this month), `expenses?page_size=5` |
| `/expenses`           | Expenses                                       | `expenses` with filters, `categories`, export                                                                       |
| `/budgets`            | Budgets                                        | `categories`, `budgets?month=`, `budgets/status?month=`                                                             |
| `*`                   | Not found                                      | none                                                                                                                |

## 3. Component tree

```
main.tsx                      starts MSW first when VITE_DEMO=true, then renders
└─ App                        QueryClientProvider, AuthProvider, ThemeProvider, Router
   ├─ AuthLayout              /login, /register
   │  └─ LoginForm / RegisterForm
   └─ ProtectedRoute
      └─ AppLayout            Masthead (nav, DemoBadge, ThemeToggle, user menu), <Outlet/>
         ├─ DashboardPage     BentoGrid
         │  ├─ MonthTotal         serif hero number, count-up, change vs last month
         │  ├─ BudgetOverview     total budget used
         │  ├─ TrendChart         Recharts, 6 months
         │  ├─ CategoryBreakdown  Recharts, ranked horizontal bars
         │  ├─ BudgetProgressList one ProgressBar per category + unbudgeted rows
         │  └─ RecentExpenses     latest 5
         ├─ ExpensesPage
         │  ├─ ExpenseFilters     date range, category, amount range, search
         │  ├─ ExportButton
         │  ├─ ExpenseTable       table on desktop, stacked ruled rows on phone
         │  ├─ Pagination
         │  └─ ExpensePanel       <dialog> side panel: ExpenseForm, delete confirm
         └─ BudgetsPage
            ├─ MonthPicker
            └─ BudgetRow          amount input + ProgressBar per category

shared ui/: Button, Field, Select, Dialog, ProgressBar, Money, Rule, Section,
            LoadingState, EmptyState, ErrorState, Toast
```

Every data region renders exactly one of: `LoadingState` (skeleton rules), `EmptyState` (with a next action), `ErrorState` (the API message plus Retry), or the data.

## 4. State and data flow

- **Server state: TanStack Query.** One query-key factory. Mutations invalidate `expenses`, `budgets` and `summary` together, because one new expense changes all three.
- **Filter state: the URL.** `useExpenseFilters` reads and writes search params, so filters survive a reload and the back button. Changing a filter resets the page to 1. Search is debounced 300 ms. A reversed date or amount range shows an inline error and sends no request.
- **Auth state: React context** over a small token store (section 5).
- **Theme: `data-theme` on `<html>`**, saved in `localStorage` (not sensitive).
- **Money**: amounts stay strings end to end. Any arithmetic converts to integer minor units first, never floats. Formatting goes through one `<Money>` component.

```
component → feature hook (useQuery/useMutation) → api/endpoints.ts → api/client.ts → fetch
                                                                         │
                             normal mode: VITE_API_URL ──────────────────┤
                             demo mode: MSW service worker answers ──────┘
```

**API client (one place, `src/api/`)**

- `types.ts`: hand-written types, one per backend schema, each with a comment naming the Python file it mirrors.
- `client.ts`: `request<T>()` adds the base URL and bearer token, builds query strings (drops empty values), parses the error envelope into `ApiError { status, code, message, details }`, handles 204, and reports a 401 to the auth layer.
- `endpoints.ts`: one typed function per endpoint.

## 5. Auth approach

- **Register** → backend returns no token → the app logs in with the same credentials straight away.
- **Storage: `sessionStorage`**, behind a `tokenStore` module so changing it is one line.
  - _Memory only_ is the strictest, but this API has no refresh token, so every page reload would mean logging in again.
  - _`localStorage`_ persists after the tab closes and is shared across tabs, for a token that is only valid 30 minutes anyway.
  - _`sessionStorage`_ survives a reload and dies with the tab. It is still readable by injected script, same as `localStorage`. The README will say this plainly, and say that the real fix (httpOnly cookie + refresh token) needs backend changes.
- **Automatic logout** from three triggers, all ending in the same `logout("expired")`:
  1. a timer set from the login's `expires_in`, counted on this device's clock so a clock that differs from the server's does not shift it;
  2. a check when the tab regains focus, since browsers throttle timers in background tabs;
  3. any 401 on an authenticated request.
     Logout clears the token and the query cache and goes to `/login` with a "Your session expired" notice.
- **Protected routes**: `ProtectedRoute` redirects to `/login` and remembers where the user was going.

## 6. Demo mode

- **MSW**, not a custom adapter. Reason: the real client code (headers, error parsing, 401 handling) runs unchanged in demo mode, and the same handlers serve the tests.
- `npm run dev:demo` uses a committed `.env.demo` containing only `VITE_DEMO=true`. MSW and the fixtures are loaded with a dynamic import, so they are not in the normal-mode bundle.
- Data: fictional expenses generated from a fixed seed, dated relative to today so "this month" is never empty. Kept in memory; a reload resets it.
- The handlers re-implement the backend's rules (filters, pagination, budget status, trends, validation errors, 409s) in TypeScript, with tests.
- **Visible "Demo data" badge** in the masthead and on the login screen, which also offers a one-click demo sign-in.
- Normal mode with no `VITE_API_URL` shows a clear configuration error instead of failing silently.

## 7. Design summary (full rules go in DESIGN.md, written before any screen)

- **Look**: a paper ledger. Warm off-white ground, deep ink text, hairline rules, generous whitespace. No shadows, no rounded card boxes.
- **Accent**: one deep ledger green. A muted brick red is used only as the over-budget status colour, never as decoration.
- **Type**: Newsreader (serif; Fraunces was planned but has no tabular figures, see DESIGN.md) for headings and large numbers, IBM Plex Sans for the UI, self-hosted through `@fontsource` so there are no network font requests. Tabular lining numerals on every money value.
- **Layout**: ruled sections instead of cards. The dashboard is a 12-column bento grid whose cells are divided by 1 px rules; it collapses to one column on phones.
- **Motion**: number count-up and bar fill on load only. Both are off under `prefers-reduced-motion`.
- **Themes**: dark is the default (decided at plan review): a warm near-black "ink" ground with paper-coloured text, not a grey-blue admin look. Light "paper" is the designed variant, switched by a toggle.
- **Styling: CSS Modules + CSS custom properties**, not Tailwind. The design is a small set of tokens and a few bespoke components; tokens as custom properties make the dark theme a token swap, CSS Modules ship with Vite, and there is no pull toward a default utility-class look.
- **Charts**: Recharts, coloured from the same tokens, each with a text summary and a hidden data table for screen readers. Category breakdown is ranked horizontal bars, not a pie.
- **Accessibility**: native `<dialog>` for the panel (focus trap and Esc built in), visible focus rings, labelled fields, errors tied to fields with `aria-describedby`, status messages in a live region.

## 8. File layout

```
expense-dashboard/
├─ .github/workflows/ci.yml        lint, type-check, test, build on every push
├─ docs/screenshots/               real captures, light and dark
├─ public/mockServiceWorker.js     generated by MSW
├─ scripts/screenshots.mjs         playwright-core driving installed Edge
├─ src/
│  ├─ api/          client.ts, endpoints.ts, types.ts, errors.ts
│  ├─ auth/         AuthProvider.tsx, tokenStore.ts, ProtectedRoute.tsx, useSessionExpiry.ts
│  ├─ demo/         browser.ts, handlers.ts, db.ts, seed.ts
│  ├─ features/
│  │  ├─ dashboard/ DashboardPage + bento cells
│  │  ├─ expenses/  ExpensesPage, filters, table, form, panel, queries.ts
│  │  └─ budgets/   BudgetsPage, BudgetRow, queries.ts, progress.ts
│  ├─ lib/          money.ts, dates.ts, months.ts, useCountUp.ts, useDebounce.ts
│  ├─ styles/       tokens.css, base.css
│  ├─ ui/           shared components, one CSS module each
│  ├─ test/         setup.ts, server.ts, render.tsx
│  ├─ App.tsx, main.tsx, env.ts
├─ .env.example, .env.demo, .gitignore, .prettierrc, eslint.config.js
├─ DESIGN.md, PLAN.md, README.md, LICENSE
├─ index.html, package.json, tsconfig*.json, vite.config.ts
```

## 9. Tests (Vitest + React Testing Library, MSW in Node)

| Area            | What is checked                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| API client      | error envelope → `ApiError`; form-encoded login; empty params dropped; 204; 401 reported                                              |
| Auth flow       | login success and wrong password; register then auto-login; protected route redirect; logout at `exp` (fake timers); logout on 401    |
| Filters         | URL round trip; page resets on change; debounce; reversed ranges blocked                                                              |
| Expense form    | each validation rule; server `details` shown on the right field                                                                       |
| Expenses page   | loading, empty, error with Retry, rows, pagination                                                                                    |
| Budgets         | create vs update decision; 409 handling; progress clamp and over-budget state                                                         |
| Money           | string ↔ minor units with no float drift; formatting                                                                                  |
| Demo data layer | budget status and trends follow the backend rules (unbudgeted list, one-decimal percent, null change when the previous month is zero) |
| CSV export      | sends the current filters; triggers a download                                                                                        |

I will report the real pass counts from the run, nothing else.

## 10. Build order (one or more commits per step)

1. Scaffold: Vite, strict TS, ESLint, Prettier, Vitest, CI workflow, LICENSE, `.gitignore`, `.env.example`
2. `DESIGN.md`, tokens, fonts, base styles, shared `ui/` components
3. API types, client, endpoints, with tests
4. Demo data layer (MSW handlers, seed), with tests
5. Auth: store, provider, expiry, pages, protected routes, with tests
6. App shell: masthead, theme toggle, demo badge
7. Expenses page: filters, table, pagination, panel, export, with tests
8. Budgets page, with tests
9. Dashboard: bento grid, charts, motion
10. Responsive and keyboard pass in a real browser
11. Real-API smoke test (see question 4)
12. Screenshots, README, Definition of Done check, final report

## 11. Risks

| Risk                                                                                                                   | Handling                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Several tools just had major releases (Vite 8, Vitest 5, MSW 3, ESLint 10, Recharts 3) and may differ from what I know | Read each package's installed docs and types before using it; pin exact versions; drop back one major if something does not fit |
| jsdom has no `dialog.showModal()`                                                                                      | Small shim in the test setup                                                                                                    |
| Recharts renders at zero size in jsdom                                                                                 | Test the data shaping and the hidden table, not the SVG                                                                         |
| Fraunces or Plex may lack tabular figures or the currency glyph                                                        | Happened: Fraunces has none. Measured six serifs in the browser and switched to Newsreader                                      |
| Demo handlers drift from the real backend                                                                              | Tests on the handlers, plus the real-API smoke test                                                                             |
| The client's local month can differ from the server's UTC month for a few hours at month end                           | Documented in the README limitations                                                                                            |
| Screenshots need a browser                                                                                             | `playwright-core` with the installed Edge, no browser download                                                                  |
| Scope is large                                                                                                         | Follow "working > clean > polished > extra"; anything cut is listed in the README, not hidden                                   |

## 12. Decisions (plan approved with the suggested defaults)

1. **Currency display**: `VITE_CURRENCY`, default `INR`. Display only; the API has no currency.
2. **Token storage**: `sessionStorage`, as argued in section 5.
3. **Category management**: not in v1; listed under future ideas in the README.
4. **Real-API check**: run the backend as-is (its own venv, database in a temp folder, nothing written to its repo) to verify real-API mode.
5. **Repo name for the CI badge**: `Omkar210404/expense-dashboard`.
6. **Theme**: dark by default, light as the variant.
