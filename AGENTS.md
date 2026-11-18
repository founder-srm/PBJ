<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PBJ: guide for coding agents

PBJ (Pitch, Build and Jump) is Founders Club's three-day startupathon at SRM. This repo is its website and, increasingly, its event platform: a 3D scroll-story landing page, team-leader login, team registration, and a team dashboard that will grow into the wallet (Peanuts), investing, shop and leaderboard.

Read this file first, then only the `docs/` file for the area you're changing. Several agents may be working at the same time; the rules in **Working in parallel** are what keep you from overwriting each other.

## Stack at a glance

| Layer | What | Version |
| --- | --- | --- |
| Framework | Next.js App Router (Turbopack), JavaScript (no TypeScript) | next 16.4.6 |
| UI | React, plain CSS with design tokens (no Tailwind, no CSS modules) | react 19.3.1 |
| 3D | three + @react-three/fiber, browser-only | three 0.169.0, fiber 9.8.2 |
| Validation | Zod 4, one schema shared by client and server | zod 4.6.7 |
| Database | Neon Postgres 18, project **PBJ** (`winter-darkness-88202045`), branch `main`, database `pbj` | @neondatabase/serverless 1.2.0 |
| Auth | Neon Auth (managed Better Auth): Google + email/password with OTP verification | @neon/auth 0.8.2 |

Node 20.9+. Package versions are pinned exactly; don't add `^` ranges.

## Commands

```bash
npm install
npm run dev      # tokens + next dev on :3000 (the owner often has this running; use another port for your own server)
npm run build    # tokens + next build: the minimum check before you say you're done
npm run start    # serve the build (e.g. npx next start -p 4790)
npm run tokens   # regenerate src/design-system/tokens.css from tokens.json
```

There is no test runner, linter or TypeScript. "Verified" means `npm run build` passes **and** you checked the behaviour (see `docs/testing.md`).

## Map of the code

```
src/
  app/                        Routes (App Router). Each folder = one URL.
    layout.jsx                <html>, global CSS imports, fonts, theme script, default metadata
    page.jsx                  /            → renders src/HomePage.jsx
    login/page.jsx            /login       (server; redirects signed-in users)
    register/page.jsx         /register    (server; gate) + actions.js (registerTeam server action)
    dashboard/page.jsx        /dashboard   (server; team home)
    admin/*                   /admin/{teams,payments,venues,judging,judges,schedule} (organisers only)
    judge/*                   /judge, /judge/[teamId] (judges score teams in their venues)
    api/pitch/route.js        live investing state for the dashboard
    api/razorpay/webhook/     Razorpay payment.captured → confirm_team_payment()
    not-found.jsx             404 page
    api/auth/[...path]/       Neon Auth proxy (do not edit)
    api/me/route.js           { signedIn, registered } for client components
  HomePage.jsx                Landing page body: scroll story + schedule + FAQ (client)
  RegisterPage.jsx            /register body (server component)
  site.jsx                    SiteHeader, SiteFooter, TeamCta, route constants (client)
  content.js                  Event facts: dates, fee, schedule, FAQ copy
  components/                 App-specific components (LoginPanel, RegistrationForm, SignOutButton)
  design-system/              PBJ Design System port: tokens + components (shared by everything)
  scene/                      3D sandwich (Stage.jsx, sandwich.js)
  lib/
    auth/server.js            createNeonAuth instance (server-only)
    auth/client.js            authClient for the browser
    db.js                     `sql` tagged template (Neon HTTP driver, server-only)
    viewer.js                 getViewer(): who is signed in, verified?, which team
    useViewerStatus.js        client hook: signed in? registered?
    event.js                  getSchedule(), getSettings(), IST date formatting (server-only)
    stage.js                  effectiveStage(), windowState()
    live.js                   getLiveState(): venue, current pitch, invest budget (server-only)
    admin.js                  requireOrganiser() (server-only)
    judge.js                  requireJudge(), getCriteria(), getRounds(), pickRound() (server-only)
    venues.js                 divideEvenly(): split teams across venues
    pitch.js                  Zod schema for the pitch-video link
    registration.js           Zod schema + field rules for team registration
  proxy.js                    Next 16 "proxy" (middleware): protects /register, /dashboard, /admin, /judge; finishes Google sign-in
  styles.css                  Page-level styles for every route (shared hotspot, see below)
db/migrations/                Ordered SQL migrations, already applied to Neon
scripts/build-tokens.mjs      tokens.json → tokens.css
public/brand/                 Founders Club and DEI logos
_archive/                     Old Vite version (ignored; don't touch)
```

## Docs index

| If you're working on… | Read |
| --- | --- |
| How requests flow, rendering modes, where code runs | `docs/architecture.md` |
| Login, sessions, who counts as verified, protecting a route | `docs/auth.md` |
| Tables, the Peanuts ledger, migrations, querying | `docs/database.md` |
| Colours, components, CSS conventions, dark mode | `docs/design-system.md` |
| The landing page, scroll story, 3D sandwich, event copy | `docs/landing.md` |
| Registration form, validation rules, dashboard | `docs/registration-and-dashboard.md` |
| Building the shop, investing, leaderboard, payments next | `docs/roadmap.md` |
| How to verify a change (build, headless Chrome, DB tests) | `docs/testing.md` |

## Working in parallel

### Areas and the files they own

Pick the area your task belongs to and stay inside its files. If you must touch a file owned by another area, keep the edit minimal and mention it in your final report.

| Area | Owns | Typical tasks |
| --- | --- | --- |
| **Landing** | `src/HomePage.jsx`, `src/scene/*`, `src/content.js`, landing sections of `src/styles.css` | Copy, schedule, FAQ, 3D poses, hero |
| **Auth** | `src/lib/auth/*`, `src/proxy.js`, `src/components/LoginPanel.jsx`, `src/components/SignOutButton.jsx`, `src/app/login/*`, `src/app/api/auth/*`, `src/lib/viewer.js` | Login methods, password reset, route protection |
| **Registration** | `src/lib/registration.js`, `src/components/RegistrationForm.jsx`, `src/RegisterPage.jsx`, `src/app/register/*` | Fields, validation rules, registration logic |
| **Dashboard & platform** | `src/app/dashboard/*`, new feature routes (one folder each: `src/app/shop/`, `src/app/invest/`…, see `docs/roadmap.md`), `src/app/api/*` except auth and me | Wallet, invest, shop, leaderboard pages |
| **Database** | `db/migrations/*`, `src/lib/db.js` | Schema changes, views, seed data |
| **Design system** | `src/design-system/*`, `scripts/build-tokens.mjs` | Tokens, shared components |
| **Shell** | `src/app/layout.jsx`, `src/site.jsx`, `src/app/not-found.jsx`, `src/lib/useViewerStatus.js`, `src/app/api/me/*` | Navbar, footer, global metadata |

### Shared files: handle with care

These are imported almost everywhere. Change them additively (add, don't rename or remove), and never reformat them.

- `src/design-system/components.jsx` and `components.css`: add a new component or a new optional prop; never change an existing prop's meaning. Every page uses these.
- `src/design-system/tokens.json`: add tokens; don't rename. `tokens.css` is generated; never edit it by hand.
- `src/styles.css`: one file, sectioned by comments (`/* Story */`, `/* Simple pages */`, `/* Login */`, `/* Dashboard */`…). Only edit your area's section. **New areas must not add to it**: create a CSS file next to your route (e.g. `src/app/shop/shop.css`) and import it from that `page.jsx`.
- `src/lib/registration.js`: the database CHECK constraints mirror these rules (see `docs/database.md`). Change both together or neither.
- `src/site.jsx`: the navbar and footer appear on every page; coordinate label or link changes.
- `db/migrations/`: never edit a file that has been applied. Add the next number (`0003_…sql`). Two agents writing migrations at once must not reuse a number: check the folder right before you create yours.
- `package.json` / `package-lock.json`: adding a dependency changes the lockfile for everyone. Pin an exact version and say so in your report.

### Contracts between areas

Code in one area relies on these. Don't change their shape without updating every caller (search for the name).

- `getViewer()` (`src/lib/viewer.js`, server-only) → `null` or `{ id, name, email, image, emailVerified, collegeLogin, verified, teamId, role }`. Cached per request. Also upserts the `users` row. `homeFor(viewer)` → where they belong (`/dashboard`, `/register`, `/judge`, `/admin`).
- `useViewerStatus()` (client) → `{ pending, signedIn, registered, home }`, backed by `GET /api/me` → `{ signedIn, registered, home }`.
- `registrationSchema` / `fieldErrors()` (`src/lib/registration.js`): used by the form (client) and `registerTeam` (server). Error keys are dotted paths like `members.1.raNumber`.
- `registerTeam(input)` server action → `{ errors }` | `{ formError }` | redirects to `/dashboard`.
- Route constants `REGISTER_HREF`, `LOGIN_HREF`, `DASHBOARD_HREF` in `src/site.jsx`.
- Database views `team_balances`, `verified_users`, `leaderboard`: platform pages read these instead of re-deriving numbers.
- `getSchedule()` / `getSettings()` (`src/lib/event.js`, server-only): event dates and settings from `event_schedule` / `event_settings`. Never hard-code a stage date.
- `effectiveStage(stage, schedule)` (`src/lib/stage.js`): what a team sees; see `docs/registration-and-dashboard.md`.
- DB functions `confirm_team_payment()` and `invest()`: the only way to mark a team paid or invest (see `docs/database.md`).
- `requireOrganiser()` / `getOrganiser()` (`src/lib/admin.js`): guard for `/admin/*` pages and actions.
- `requireJudge()` / `getJudge()` / `getCriteria()` / `getRounds()` / `pickRound()` (`src/lib/judge.js`), DB function `save_evaluation(judge, round, team, scores, notes)` and per-round views `evaluation_totals`, `team_judging`, `criterion_averages`: judging (see `docs/database.md`).

## Rules that apply everywhere

- **Server vs client.** Anything that touches `sql`, `auth`, or env secrets imports `'server-only'` and must never be imported by a `'use client'` file. Client code talks to the server through server actions or `src/app/api/*`.
- **Validate on the server.** Client checks are for UX. Every write re-validates with the shared Zod schema, and the database constraints are the final word.
- **Money is the ledger.** Never store or update a balance. Move Peanuts only by inserting a balanced `ledger_transactions` + `ledger_postings` pair in one transaction (see `docs/database.md`). The database rejects anything else.
- **Pages that read the session or DB** export `dynamic = 'force-dynamic'`. The home page stays static; it learns the visitor's state in the browser.
- **Styling.** Use tokens (`var(--jelly)`, `var(--space-6)`…) and design-system classes; no hard-coded colours except brand marks (e.g. the Google button). Every page must work at 390px wide with no horizontal scroll, and in light and dark themes.
- **Copy.** Plain, direct sentences. Dates and the fee come from `src/content.js` (`EVENT`); don't hard-code them.
- **Secrets.** `.env.local` holds the database password and cookie secret. Never print, log, commit or paste its values. `.env.example` is the template.
- **Neon.** Use the Neon MCP tools for schema work. Never run destructive SQL (DROP, DELETE, TRUNCATE, data-changing UPDATE) on `main` without the owner's explicit OK. Test risky SQL inside a `DO` block that ends with `raise exception` so it rolls back (recipe in `docs/testing.md`).
- **Don't** edit `_archive/`, `tokens.css`, `node_modules/`, or the Next-managed block at the top of this file.

## Gotchas we've already hit

- **Next 16 renamed middleware to `proxy`.** It lives at `src/proxy.js` because the app uses `src/`.
- **Google sign-in finishes in the proxy.** Google returns the user to `/register?…verifier…`, and `auth.middleware()` swaps that for session cookies. The callback URL must be a route in the proxy `matcher`, and must **not** be `/login` (the middleware skips its own login page).
- **`@neon/auth`'s client sometimes throws** (`AuthApiError`) instead of returning `{ error }`. Wrap calls the way `LoginPanel.jsx` does (`call(() => authClient…)`).
- **Hydration.** Anything time- or browser-dependent (dates, `matchMedia`, `window`) must start with a neutral value and update in `useEffect`; the countdown shows `--` until mounted for this reason.
- **Constraint names.** Postgres auto-names column checks `table_column_check`; a trigger or constraint with the same name fails. Name triggers explicitly (`…_member_count_check`).
- **Zod object refinements** don't run while any field is invalid; pass `{ when }` to `superRefine` if a cross-field check must always run (see the duplicate-member check).
- **Port 3000** is usually the owner's dev server. Start your own on another port and only kill processes you started.
- **Headless Chrome** won't make a window narrower than ~500px; use device-metrics emulation for phone widths (see `docs/testing.md`).

## Finishing a task

1. `npm run build` passes.
2. You checked the behaviour in a browser (screenshot or scripted) at desktop and 390px, signed out and, where relevant, signed in.
3. If you changed a contract, schema or shared file, the matching `docs/` page is updated in the same change.
4. Your report lists every file you touched outside your area.
