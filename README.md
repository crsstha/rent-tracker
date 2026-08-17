# Rent Register

An installable, offline-first PWA for tracking tenants, rent due dates, utility bills and payment
history across one or more houses. All data lives in the phone's own storage — no account, no
server, no network calls.

## Running it

```bash
npm install
npm run dev        # dev server (service worker disabled)
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ — use this to test install and offline behaviour
npm test           # 60 assertions over status, arrears, payments, billing, persistence
npm run lint       # eslint (typescript, react-hooks, import order)
npm run format     # prettier, including tailwind class sorting
npm run typecheck  # tsc, no emit
```

Copy `.env.example` to `.env.local` if you want to change the storage backend. Nothing in it is
required — with no `.env` at all the app runs on local IndexedDB, which is the only backend
implemented today.

The service worker is deliberately off in `dev` (`devOptions.enabled: false`) so you never debug
against a stale cache. Test PWA behaviour against `npm run preview`.

## Deploying

CI runs on every PR and push to `main` (`.github/workflows/ci.yml`: lint, format check, typecheck,
test, build). `.github/workflows/deploy.yml` then builds and ships to **Cloudflare Pages** via
`wrangler-action`, using two repository secrets:

| Secret                  | Where to find it                                      |
| ----------------------- | ----------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare dashboard → API tokens → _Edit Pages_      |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → account home |

Pull requests deploy to their own branch preview; `main` publishes production. `public/_redirects`
gives the SPA its `index.html` fallback and `public/_headers` sets the cache policy.

`netlify.toml` and `vercel.json` are also still included. Whichever host you use, the important
parts are:

- serve over **HTTPS** (required for service workers and install)
- SPA fallback to `index.html`
- `sw.js`, `index.html` and `manifest.webmanifest` served with `max-age=0, must-revalidate`, so a
  new deployment is actually noticed; `/assets/*` is content-hashed and cached immutably

## How it's built

| Layer    | Choice                                                                   |
| -------- | ------------------------------------------------------------------------ |
| Build    | Vite 8 + `vite-plugin-pwa` (Workbox)                                     |
| Routing  | react-router, one lazy-loaded module per route                           |
| UI       | React 19 + TypeScript, Tailwind CSS v4, shadcn/ui (Radix) + lucide icons |
| Storage  | Dexie (IndexedDB) behind a `DataAdapter` interface, live-queried         |
| UI state | Zustand (overlays, appearance and entry preferences — never data)        |
| PDF      | `window.print()` against a dedicated print stylesheet                    |

Layout and naming follow the reference client (`togglecorp/ercs-client`): an `app/` root, one
folder per view under `app/views/`, one folder per component under `app/components/`, and routing
config under `app/Root/`.

```
app/
  App.tsx                  route config → react-router objects, all lazy
  index.tsx                entry
  index.css                tailwind + design tokens (@theme inline)
  Root/
    index.tsx              provider shell — theme controller, toaster, Suspense
    config/routes.ts       every route in one place, each behind a dynamic import
    hooks/useRouting.tsx   type-checked navigation by route key
  views/
    RootLayout/            chrome shared by every route (the global sheets)
    Houses/ House/ Tenant/ one module per route
    Settings/ Settings/Appearance/
    NotFound/ PageError/
  components/
    ui/                    shadcn primitives (button, sheet, dialog, select, …)
    FormSheet/             the app's standard sheet: safe areas + sticky footer
    PaymentSheet/          record an instalment against a month
    BillSheet/ BackfillSheet/ Invoice/ TenantForm/ HouseForm/ …
  lib/
    db/                    the data layer (see below)
    actions.ts             every mutation (houses, tenants, payments, bills)
    reminders.ts           opt-in local notifications, checked on app open
    theme/                 palette metadata + the <html> theme controller
  utils/
    dates.ts               month keys, labels, ordinals and date formatting
    status.ts              derived payment state, outstanding months, arrears
    billing.ts             bill maths and line items
    payments.ts            instalments, balances and allocation
    format.ts              money, bytes, plurals
  store/                   zustand: overlays, appearance, entry preferences
  hooks/                   live data subscriptions, keyboard inset, theme effect
tests/                     vitest suites (logic + persistence against fake-indexeddb)
```

### Routing

`app/Root/config/routes.ts` is the single source of truth; `App.tsx` maps it onto react-router and
`useRouting()` turns route keys into type-checked navigation, so a renamed path changes in one
place. Every route is `lazy`, so each view is its own chunk:

| Path                                 | View                  |
| ------------------------------------ | --------------------- |
| `/`                                  | Houses                |
| `/houses/:houseId`                   | House                 |
| `/houses/:houseId/tenants/:tenantId` | Tenant                |
| `/settings`                          | Settings              |
| `/settings/appearance`               | Settings → Appearance |

### Storage, and the Firebase seam

Features never touch Dexie. They call the repositories exported from `app/lib/db`, which implement
a `DataAdapter<T>` (`get`, `list`, `create`, `update`, `delete`, `subscribe`, `putMany`, `clear`).
`app/lib/db/dexie/` is the live implementation; `app/lib/db/firebase/` is a typed scaffold of the
same contract that throws if called. `VITE_DATA_BACKEND` (`dexie` | `firebase` | `hybrid`) picks
between them and currently always resolves to Dexie. See **FIREBASE_INTEGRATION.md** for the
finish-it checklist and the intended local-first sync strategy.

### Theming

Five palettes — Terracotta (default), Catppuccin, Gruvbox, Monokai, Solarized — each defined as a
block of CSS custom properties in shadcn's token naming (`app/styles/themes.css`), so every
component picks a palette up without knowing it exists. **Settings → Appearance** stores three
independent values: the mode (Auto / Light / Dark) and one palette _per mode_, so you can run
Gruvbox by day and Catppuccin by night. A small inline script in `index.html` stamps the saved
theme before first paint, which is what keeps a cold start from flashing the wrong colours.

### Data model

`House` and `Tenant` are the only two stores. A tenant owns its `history` array inline, since
history is only ever read alongside its tenant.

Each `HistoryEntry` is one billing month: what was charged (`totalAmount`) and the instalments
collected against it (`payments[]`). `amountPaid`, `amountDue` and `paymentStatus`
(`unpaid` / `partially_paid` / `paid`) are always recomputed from `payments` and never authored, so
a month cannot claim to be settled while its instalments say otherwise.

### Derived status, never stored

Payment state is recomputed on every render from the tenancy start, `dueDay` and `history`, so it
cannot drift:

| Months still owing    | Current month                | State                           |
| --------------------- | ---------------------------- | ------------------------------- |
| 2 or more             | —                            | **Arrears** — `3 months due`    |
| 1, part paid          | —                            | **Part paid** — `Rs 7,000 left` |
| 1 (the current month) | nothing paid                 | **Overdue** — `11d overdue`     |
| 1 (an older month)    | settled                      | **Overdue** — `Jul 2026 unpaid` |
| 0                     | part paid, not yet due       | **Part paid** — `Rs 7,000 left` |
| 0                     | settled                      | **Paid**                        |
| 0                     | unpaid, 3 days out or less   | **Due soon**                    |
| 0                     | unpaid, more than 3 days out | **Upcoming**                    |

`lastPaidMonth` is derived too: every mutation recalculates it from the most recent month settled
**in full** — a part payment never sets it. That is what makes backfilling and deleting entries self-correcting — remove the newest
payment and the tenant silently falls back to the one before it.

### Arrears

A tenant is only ever _paid this month_ or _not_; the useful question is how far behind they are.
`outstandingMonths()` walks back from the current month to the tenancy start (`startMonth`, falling
back to the creation month or the oldest logged payment) and returns every month whose due date has
passed and whose charge isn't fully covered — each with the amount **actually** outstanding, so a
month that was half paid owes its balance rather than the whole rent again. The walk is capped at
24 months so an old record can't invent a five-figure debt.

The third row of the table above is the case a plain `lastPaidMonth` check misses entirely: a tenant
who pays this month but skipped June still owes June, and now says so.

Arrears can be cleared in one tap (**Settle all**), month by month via _Log past months_, or rolled
into the next bill.

### Billing

Rent always applies; water, electricity and garbage are opt-in per bill. Electricity is either a
meter reading (`(current − previous) × rate`, floored at zero so a replaced or rolled-over meter
never credits the tenant) or a flat amount. Generating a bill marks that month paid, stores the
itemised breakdown in history, and carries the reading and rate forward so next month pre-fills.

A bill can also absorb outstanding months as a **Previous dues** line, each at its own remaining
balance. Money is booked against the month it belongs to — the billing month gets the utilities
subtotal, each absorbed month gets its own entry — so the sum of what's written always equals what
was collected. The billing month can never appear as arrears on its own bill; `generateBill`
enforces that regardless of caller, so it cannot be charged as both rent and debt.

**Collect payment now** on the bill decides how much of it is settled on the spot. Hand over less
than the total and the shortfall is applied oldest month first, leaving the remainder outstanding
rather than pretending the bill was paid.

## Partial payments

A month is a charge with instalments against it, not a boolean. **Record payment** takes an amount
up to whatever is still due — enforced in the form _and_ re-checked inside the write transaction,
so a stale screen can't overpay a month that was just settled elsewhere — along with a method
(cash, bank, wallet, cheque, other), an optional reference and a note.

The tenant page shows the running balance, a progress bar per part-paid month, and the full
instalment list; **Part paid** badges surface the same state in tenant and house lists. A month
flips to _paid_ the moment its instalments cover the charge, and back to _part paid_ if one is
removed. Because the derived fields are recomputed rather than stored, that reversal is exact.

## Backup

Data lives only on the device, so **Settings → Export backup** writes a single JSON file of
everything. Import offers _replace_ (restore onto a fresh install) or _merge_ (add only records not
already present). Imported files are validated before they go near the database — a file that isn't
a Rent Register backup, or one from a newer app version, is rejected with a readable message.

An uninstall, or clearing site data, wipes everything. That is expected behaviour, not a bug.

## PWA acceptance criteria

| Criterion                                                                       | Status                                                                                    |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Manifest with name, icons (incl. maskable), standalone, theme/background colour | ✅ generated and verified at `/manifest.webmanifest`                                      |
| Registered service worker, app shell precached                                  | ✅ 17 entries precached, SW active on first load                                          |
| Installable on Android (Chrome) / iOS (Safari)                                  | ✅ `beforeinstallprompt` button on Chrome; Share → Add to Home Screen hint on iOS         |
| Standalone launch with correct icon and theme colour                            | ✅ `display: standalone`, `theme_color #7A1F2E`                                           |
| Airplane mode: loads, shows data, accepts new data that survives a restart      | ✅ verified with the origin server killed — app loaded from cache, wrote and re-read data |
| Export produces valid JSON; import restores everything                          | ✅ round-trip covered by `tests/persistence.test.ts`                                      |
| New deployment prompts to refresh rather than silently going stale              | ✅ `registerType: 'prompt'` + hourly update check + in-app prompt                         |
| Uninstall does not restore data without a backup                                | ✅ expected, documented above                                                             |

Lighthouse's installability audit needs an HTTPS origin, so run it against the deployed URL rather
than `localhost` preview.

## Known limits (v1, by design)

- Single user, single device — no sync, no login, no tenant portal. The data layer is ready for a
  Firestore backend (see FIREBASE_INTEGRATION.md) but nothing is wired to it yet.
- Reminders are checked when you open the app (once a day), not pushed in the background: periodic
  background sync is unavailable on iOS and unreliable elsewhere.
- NPR (Rs) only.
- Arrears are valued at the tenant's **current** rent — historical rent changes aren't tracked, so
  raising the rent re-prices older unpaid months.
- Due days are limited to 1–28 so every month has the day.
- Google Fonts are cached stale-while-revalidate; on a cold offline first run the app falls back to
  system serif/sans, which is a cosmetic difference only.
