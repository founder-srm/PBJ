# PBJ

PBJ, short for **Pitch, Build and Jump**, is an event by Founders Club: a one-of-a-kind startupathon at SRM. This repo is its website and event platform: the landing page, team-leader login, team registration and the team dashboard.

On the landing page, a 3D sandwich tells the story on scroll: it starts whole, comes apart, and each layer takes the stage for its letter — the spread for **P**itch, the bread for **B**uild, the jelly for **J**ump — before it snaps back together and jumps.

## Docs

Working on the code (human or agent)? Start with [`AGENTS.md`](AGENTS.md), then the page for your area in [`docs/`](docs): architecture, auth, database, design system, landing, registration & dashboard, roadmap, testing.

## Run it

Built with Next.js 16 (App Router) and React 19. Requires Node 20.9 or newer.

```bash
npm install
npm run dev      # local dev server on http://localhost:3000
npm run build    # production build in .next/
npm run start    # serve the production build
```

Both pages (`/` and `/register`) are pre-rendered as static HTML. Deploy to Vercel as a Next.js project with no extra settings. The previous Vite version is archived at `_archive/vite-version-2026-11-18.tgz`.

## Backend: Neon + Neon Auth

- **Database:** Neon project **PBJ** (`winter-darkness-88202045`, Founders Club org, Singapore), branch `main`, database `pbj`. Schema changes live in `db/migrations/` and are applied in order; never edit an applied file, add a new one.
- **Auth:** Neon Auth (managed Better Auth) with **Google** and **email + password**. Email sign-ups must enter a 6-digit code sent to their inbox before they can sign in. Sign-in data lives in the `neon_auth` schema; `users.id` is the Neon Auth user id.
- **Who logs in:** only the **team leader**, with a **personal email**. SRM accounts can't sign in to third-party sites, so `@srmist.edu.in` logins are refused; every member's SRM email is collected on the registration form instead.
- **Env:** copy `.env.example` to `.env.local` and fill in `DATABASE_URL`, `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET`. Set the same three in Vercel for production.
- **Flow:** `/login` (Google, or email + password) → `/register`, where `src/proxy.js` finishes a Google sign-in. Only verified personal-email accounts see the form; the signed-in user is the team leader. After registering, the leader lands on `/dashboard`.

## Where things live

| Path | What |
| --- | --- |
| `src/content.js` | Event facts: dates, fee, schedule, FAQ. Edit copy here first. |
| `src/app/` | Routes: `layout.jsx` (fonts, theme, global CSS, metadata), `page.jsx` (`/`), `register/page.jsx` (`/register`) and `not-found.jsx` (the 404 page). Add new platform pages here. |
| `src/HomePage.jsx` | Home page structure and the story chapters' text (a client component). |
| `src/RegisterPage.jsx` | The registration page. Every Register button links here (`REGISTER_HREF`). |
| `src/site.jsx` | Header (Login, or Register + log-out door, from the session) and footer shared by every page. |
| `src/lib/auth/` | Neon Auth server instance (`server.js`) and browser client (`client.js`). |
| `src/lib/viewer.js` | `getViewer()`: the signed-in user, whether they're a verified SRM account, and their team. |
| `src/app/register/actions.js` | `registerTeam` server action: re-validates with Zod and writes the team in one transaction. |
| `src/app/dashboard/page.jsx` | The team dashboard (wallet, members; invest, shop and leaderboard placeholders). |
| `db/migrations/` | SQL schema: ledger, teams, shop, investments, evaluations, verified users, leaderboard view. |
| `src/lib/registration.js` | Zod schema for team registration, shared by the form and (later) the API. |
| `src/components/RegistrationForm.jsx` | The registration form: team details plus one card per member. |
| `src/scene/Stage.jsx` | The 3D stage: camera, lights, and the keyframes (`K`) that place each layer per chapter. |
| `src/scene/sandwich.js` | The sandwich itself, generated in code: square loaf slices with crumb and crust textures, and the peanut butter and jelly as lumpy, squeezed-out meshes. Tune colours, thickness and how far the fillings ooze here. |
| `src/design-system/tokens.json` | Copied from the PBJ Design System. `tokens.css` is generated from it on every `dev`/`build`; never edit `tokens.css`. |
| `src/design-system/components.jsx` + `components.css` | PBJ Design System components (Button, NavBar, FAQ, DayTimeline, RegistrationForm…). Marked `'use client'`, so server pages can use them. |
| `public/brand/` | Founders Club and DEI logos. |

## How the scroll story works

- `.story` is six screens tall. Inside it, `.stage` is `position: sticky`, so the 3D canvas stays put while the chapter panels scroll over it.
- Scroll progress through `.story` (0–1) maps to chapter 0–5. Each layer eases toward that chapter's keyframe every frame, so scrolling feels smooth both ways.
- Change a chapter's pose by editing its row in `K` in `Stage.jsx`: `[position, rotation, scale]` per layer.
- The 3D stage loads with `next/dynamic` and `ssr: false`: it only ever renders in the browser.
- With **reduce motion** turned on, the sandwich stays whole and still. Without WebGL, the page still works with no 3D.
- **Below 1024px wide (phones, portrait tablets) there is no scroll story.** The whole sandwich turns slowly in its own box under the hero copy (`HeroSandwich` in `src/HomePage.jsx`, `compact` mode in `Stage.jsx`), and the chapters stack as plain cards. It stops rendering when scrolled off-screen. The breakpoint is `NARROW` in `HomePage.jsx` and the matching `@media (max-width: 1023px)` block in `styles.css`; change both together.
- Phones and low-core devices get a lighter scene (smaller textures, no glass refraction on the jelly).

## Before launch

- **Password reset isn't built yet.** Neon Auth's reset needs emailed links, which need a custom email provider (e.g. Resend or SES) set in Neon Auth. Add one before launch, then add a "Forgot password?" flow.
- **Use your own Google OAuth client before launch.** Neon's shared Google app works for development, but production should use Founders Club's own client (Google Cloud Console), added to Neon Auth, with the live domain added as a trusted domain.
- **Validation rules live in `src/lib/registration.js`** (Zod): team name, team size 2–4, and per member a name, an RA number (`RA` + 13 digits), and a college email ending `@srmist.edu.in`. Phone (Indian mobile: 10 digits starting 6–9; `+91`, spaces and dashes are stripped), faculty advisor and the faculty advisor’s email (also `@srmist.edu.in`) are optional. RA numbers and college emails can't repeat within a team.
- **Dates are tentative** (15–17 February 2027). Update `src/content.js` once confirmed.
- Fonts (Rubik, DM Sans) load from Google Fonts.
