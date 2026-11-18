# Architecture

How a request moves through the PBJ site, what renders where, and how the pieces connect.

## Routes

| URL | File | Renders | Who can see it |
| --- | --- | --- | --- |
| `/` | `src/app/page.jsx` → `src/HomePage.jsx` | Static HTML at build time; client takes over (3D, scroll, session) | Everyone |
| `/login` | `src/app/login/page.jsx` | Server, per request | Signed-out visitors (signed-in → `/register` or `/dashboard`) |
| `/register` | `src/app/register/page.jsx` → `src/RegisterPage.jsx` | Server, per request | Signed-in; form only for verified leaders without a team |
| `/dashboard` | `src/app/dashboard/page.jsx` | Server, per request | Signed-in leaders with a team |
| 404 | `src/app/not-found.jsx` | Static | Everyone |
| `/api/auth/*` | `src/app/api/auth/[...path]/route.js` | Proxy to Neon Auth | Browser auth client |
| `/api/me` | `src/app/api/me/route.js` | JSON, never cached | Browser (navbar, hero) |

## Layers

```
Browser
  ├─ HomePage / site.jsx (client)  ── useViewerStatus() ──► GET /api/me ──┐
  ├─ LoginPanel (client) ── authClient ──► /api/auth/* ──► Neon Auth      │
  └─ RegistrationForm (client) ── registerTeam() server action ──┐        │
                                                                  ▼        ▼
Next.js server (Node)                                    getViewer()  (src/lib/viewer.js)
  src/proxy.js runs first on /register, /dashboard        ├─ auth.getSession()  → Neon Auth
                                                          └─ sql`…`             → Neon Postgres (database pbj)
Neon
  ├─ neon_auth schema: user, session, account… (managed by Neon Auth; read-only for us)
  └─ public schema: users, teams, team_members, ledger_*, investments, shop_*, … (ours, db/migrations)
```

### Server-only modules

`src/lib/auth/server.js`, `src/lib/db.js` and `src/lib/viewer.js` import `'server-only'`. Importing them from a client component fails the build, which is intentional.

### Client modules

Files starting with `'use client'`: `src/HomePage.jsx`, `src/site.jsx`, `src/design-system/components.jsx`, `src/components/*`, `src/lib/auth/client.js`, `src/lib/useViewerStatus.js`. Server components may import them (that's how pages use the design system).

`src/RegisterPage.jsx` and every `src/app/**/page.jsx` are server components.

## Rendering decisions

- **The home page is static.** It never reads the session on the server, so it's served as plain HTML and stays fast. Visitor-specific bits (navbar label, hero CTA) are filled in by `useViewerStatus()` after load. They show the signed-out state first and then switch; that's deliberate.
- **Auth and data pages are dynamic** (`export const dynamic = 'force-dynamic'`), because they read cookies and the database.
- **The 3D stage** loads with `next/dynamic(..., { ssr: false })` inside `HomePage.jsx`. WebGL never runs on the server.
- **Theme.** `layout.jsx` injects a tiny script that sets `<html data-theme="light|dark">` from the OS setting before first paint. All colours come from tokens keyed on that attribute.

## Request lifecycles

### Visiting `/register` signed out
1. `src/proxy.js` (matcher `/register`, `/dashboard/:path*`) finds no session → redirects to `/login`.

### Google sign-in
1. `LoginPanel` → `authClient.signIn.social({ provider: 'google', callbackURL: '/register' })`.
2. Browser → Neon Auth → Google → Neon Auth → back to `/register?<verifier>`.
3. `src/proxy.js` sees the verifier, exchanges it for session cookies, redirects to clean `/register`.
4. `register/page.jsx` → `getViewer()` → upserts `users`, finds no team → renders the form.

### Email sign-up
1. `LoginPanel` → `authClient.signUp.email(...)` → Neon emails a 6-digit code.
2. `authClient.emailOtp.verifyEmail({ email, otp })` → verified and signed in → `window.location = '/register'`.

### Registering a team
1. `RegistrationForm` validates with `registrationSchema` (client).
2. Calls the `registerTeam` server action → `getViewer()` → re-validates → pre-checks duplicates → one `sql.transaction([...])` inserts `teams` + `team_members` → `redirect('/dashboard')`.
3. Database triggers check member count and uniqueness at commit.

### Navbar on any page
`SiteHeader` → `useViewerStatus()` → `authClient.useSession()` and, if signed in, `GET /api/me` once per page load → label Login / Register / Dashboard.

## Configuration

| Variable | Used by | Where to get it |
| --- | --- | --- |
| `DATABASE_URL` | `src/lib/db.js` | Neon MCP `get_connection_string` (pooled) or Neon Console |
| `NEON_AUTH_BASE_URL` | `src/lib/auth/server.js` | Neon MCP `get_neon_auth_config` → `base_url` |
| `NEON_AUTH_COOKIE_SECRET` | `src/lib/auth/server.js` | `openssl rand -base64 32` (≥ 32 chars) |

Local: `.env.local` (gitignored, owner-only permissions). Production (Vercel): set the same three. `next.config.mjs` only sets `reactStrictMode`.
