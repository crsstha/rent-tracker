# Rent Register

An installable, offline-first PWA for tracking tenants, rent due dates, utility bills and payment
history across one or more houses. All data lives in the phone's own storage — no account, no
server, no network calls.

## Running it

```bash
npm install
npm run dev      # dev server (service worker disabled)
npm run build    # typecheck + production build into dist/
npm run preview  # serve dist/ — use this to test install and offline behaviour
npm test         # 41 assertions over status, arrears, billing and persistence
```

The service worker is deliberately off in `dev` (`devOptions.enabled: false`) so you never debug
against a stale cache. Test PWA behaviour against `npm run preview`.

## Deploying

`netlify.toml` and `vercel.json` are both included. Either way the important parts are:

- serve over **HTTPS** (required for service workers and install)
- SPA fallback to `index.html`
- `sw.js`, `index.html` and `manifest.webmanifest` served with `max-age=0, must-revalidate`, so a
  new deployment is actually noticed; `/assets/*` is content-hashed and cached immutably

## How it's built

| Layer | Choice |
|---|---|
| Build | Vite 8 + `vite-plugin-pwa` (Workbox) |
| UI | React 19 + TypeScript, Tailwind CSS v4 |
| Storage | Dexie (IndexedDB), live-queried via `dexie-react-hooks` |
| UI state | Zustand (view + overlays only — never data) |
| PDF | `window.print()` against a dedicated print stylesheet |

```
src/
  lib/
    dates.ts      month keys, labels, ordinals and date formatting
    status.ts     derived payment state, unpaid months and arrears
    billing.ts    bill maths, line items, money formatting
    db.ts         Dexie schema, persistence request, backup export/parse/import
    actions.ts    every mutation (houses, tenants, payments, bills)
    reminders.ts  opt-in local notifications, checked on app open
  hooks/useData.ts  live queries, summary rollups, urgency ordering
  components/       views, sheets, invoice, install and update prompts
tests/              vitest suites (logic + persistence against fake-indexeddb)
```

### Data model

`House` and `Tenant` are the only two stores. A tenant owns its `history` array inline, since
history is only ever read alongside its tenant.

### Derived status, never stored

Payment state is recomputed on every render from the tenancy start, `dueDay` and `history`, so it
cannot drift:

| Unpaid past-due months | Current month paid | State |
|---|---|---|
| 2 or more | — | **Arrears** — `3 months due` |
| 1 (the current month) | no | **Overdue** — `11d overdue` |
| 1 (an older month) | yes | **Overdue** — `Jul 2026 unpaid` |
| 0 | yes | **Paid** |
| 0 | no, 3 days out or less | **Due soon** |
| 0 | no, more than 3 days out | **Upcoming** |

`lastPaidMonth` is derived too: every mutation recalculates it from the most recent month in
`history`. That is what makes backfilling and deleting entries self-correcting — remove the newest
payment and the tenant silently falls back to the one before it.

### Arrears

A tenant is only ever *paid this month* or *not*; the useful question is how far behind they are.
`unpaidMonths()` walks back from the current month to the tenancy start (`startMonth`, falling back
to the creation month or the oldest logged payment) and returns every month whose due date has
passed with nothing logged against it. The walk is capped at 24 months so an old record can't
invent a five-figure debt.

The third row of the table above is the case a plain `lastPaidMonth` check misses entirely: a tenant
who pays this month but skipped June still owes June, and now says so.

Arrears can be cleared in one tap (**Settle all**), month by month via *Log past months*, or rolled
into the next bill.

### Billing

Rent always applies; water, electricity and garbage are opt-in per bill. Electricity is either a
meter reading (`(current − previous) × rate`, floored at zero so a replaced or rolled-over meter
never credits the tenant) or a flat amount. Generating a bill marks that month paid, stores the
itemised breakdown in history, and carries the reading and rate forward so next month pre-fills.

A bill can also absorb outstanding months as a **Previous dues** line. Money is then booked against
the month it belongs to — the billing month gets the utilities subtotal, each absorbed month gets
its own rent entry — so the sum of what's written always equals the invoice total. The billing month
can never appear as arrears on its own bill; `generateBill` enforces that regardless of caller, so
it cannot be charged as both rent and debt.

## Backup

Data lives only on the device, so **Settings → Export backup** writes a single JSON file of
everything. Import offers *replace* (restore onto a fresh install) or *merge* (add only records not
already present). Imported files are validated before they go near the database — a file that isn't
a Rent Register backup, or one from a newer app version, is rejected with a readable message.

An uninstall, or clearing site data, wipes everything. That is expected behaviour, not a bug.

## PWA acceptance criteria

| Criterion | Status |
|---|---|
| Manifest with name, icons (incl. maskable), standalone, theme/background colour | ✅ generated and verified at `/manifest.webmanifest` |
| Registered service worker, app shell precached | ✅ 17 entries precached, SW active on first load |
| Installable on Android (Chrome) / iOS (Safari) | ✅ `beforeinstallprompt` button on Chrome; Share → Add to Home Screen hint on iOS |
| Standalone launch with correct icon and theme colour | ✅ `display: standalone`, `theme_color #7A1F2E` |
| Airplane mode: loads, shows data, accepts new data that survives a restart | ✅ verified with the origin server killed — app loaded from cache, wrote and re-read data |
| Export produces valid JSON; import restores everything | ✅ round-trip covered by `tests/persistence.test.ts` |
| New deployment prompts to refresh rather than silently going stale | ✅ `registerType: 'prompt'` + hourly update check + in-app prompt |
| Uninstall does not restore data without a backup | ✅ expected, documented above |

Lighthouse's installability audit needs an HTTPS origin, so run it against the deployed URL rather
than `localhost` preview.

## Known limits (v1, by design)

- Single user, single device — no sync, no login, no tenant portal.
- Reminders are checked when you open the app (once a day), not pushed in the background: periodic
  background sync is unavailable on iOS and unreliable elsewhere.
- NPR (Rs) only.
- Arrears are valued at the tenant's **current** rent — historical rent changes aren't tracked, so
  raising the rent re-prices older unpaid months.
- Partial payments aren't modelled: a month is paid or it isn't.
- Due days are limited to 1–28 so every month has the day.
- Google Fonts are cached stale-while-revalidate; on a cold offline first run the app falls back to
  system serif/sans, which is a cosmetic difference only.
