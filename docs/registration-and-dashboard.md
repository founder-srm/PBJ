# Registration and dashboard

Owner areas: **Registration** (`src/lib/registration.js`, `src/components/RegistrationForm.jsx`, `src/RegisterPage.jsx`, `src/app/register/*`) and **Dashboard & platform** (`src/app/dashboard/*`).

## Flow

`/login` → `/register` (form) → `registerTeam` → `/dashboard`. A leader who already has a team is redirected from `/register` and `/login` to `/dashboard`.

`src/app/register/page.jsx` (server, dynamic):
1. `getViewer()`; signed out → `/login`; has a team → `/dashboard`.
2. Renders `RegisterPage` with the viewer. Verified leaders get the form; others get "Use a personal email" (signed in with an SRM address) or "Verify your email", plus a sign-out button.

## Fields and rules

One schema, `registrationSchema` in `src/lib/registration.js`, used by the form and re-run by the server action. The database CHECK constraints in `team_members` enforce the same formats.

| Field | Required | Rule |
| --- | --- | --- |
| Team name | yes | 2–40 chars; unique ignoring case/spaces (DB) |
| Team size | yes | 2–4 (`MIN_TEAM`, `MAX_TEAM`) |
| Per member: name | yes | 2–80 chars; letters, spaces, `.` `'` `-` |
| Per member: RA number | yes | `RA` + 13 digits, upper-cased (`RA2211003010123`); unique within the team and across teams |
| Per member: college email | yes | ends `@srmist.edu.in`, lower-cased; unique within and across teams |
| Per member: phone | no | Indian mobile, 10 digits starting 6–9; `+91`, `0`, spaces, dashes stripped |
| Per member: faculty advisor | no | name rules |
| Per member: faculty advisor's email | no | ends `@srmist.edu.in`; may repeat (shared advisor) |
| Rules accepted | yes | checkbox |

Member 1 is the **team leader** = the signed-in user (logged in with a personal email). Their name is prefilled; their SRM email is typed in like everyone's.

Error keys are dotted paths (`teamName`, `members.2.phone`) and map to field ids `reg-teamName`, `reg-members-2-phone`. The duplicate RA/email check uses `superRefine(..., { when })` so it shows even while other fields are invalid.

### Changing a rule

Change `registration.js` **and** add a migration updating the matching CHECK constraint (see `docs/database.md`), or the server will accept something the DB rejects (or vice versa). Then update the table above.

## `registerTeam` (`src/app/register/actions.js`)

Server action. Order of checks:
1. `getViewer()`: must be signed in, `verified`, and not already on a team.
2. `registrationSchema.safeParse(input)` → `{ errors }`.
3. Pre-check conflicts (team name, RA numbers, college emails already registered) → field-level `{ errors }`.
4. One `sql.transaction`: insert `teams` (id from `crypto.randomUUID()`, slug = name + 6 random chars, `created_by` = leader) and every `team_members` row (leader gets `user_id`).
5. Unique-violation race → friendly `{ errors }`/`{ formError }`; anything else is logged and returns a generic `{ formError }`.
6. `redirect('/dashboard')` (outside the try/catch).

## The form (`src/components/RegistrationForm.jsx`)

- Holds four member slots; only the first `teamSize` are submitted, so text survives shrinking and re-growing the size.
- First submit validates everything and focuses the first error; after that it re-validates on every change.
- Calls `registerTeam` inside `useTransition`; shows server `errors` under fields and `formError` under the button.

## Dashboard (`src/app/dashboard/page.jsx`)

Server, dynamic. Signed out → `/login`; no team → `/register`.

Layout: a full-height sidebar fixed to the left edge of the screen (`.dash-side`, styles in `src/app/dashboard/dashboard.css`) with **Home**, **Team Details**, **Shop** and **Leaderboard**, plus the signed-in email and sign-out at the bottom. On phones (≤760px) it becomes a bottom tab bar. The page (header, content, footer) is offset by `--dash-side-w`. The selected item is navy (bright blue in dark mode), never red: red means an error.

The selected item comes from `?view=` (`home` default, `team`, `shop`, `leaderboard`); the server renders only that view, so it works without JS and the URL can be shared. Members are only queried for the team view.

- **Home**: team name, wallet balance (`team_balances`) directly below it (with the fee note while `registered`), status and room badges, and a **What to do now** card.
- **Team Details, Shop, Leaderboard**: no team header and no card; the page starts with the view's own title (`.dash-view`). Shop and Leaderboard are placeholders ("Opens 15 Feb").

**What to do now** comes from `NEXT_STEP` in `src/app/dashboard/next-step.js`, keyed by `teams.status` (`title`, `body`, optional `steps` and `action`). For `registered` it asks for a 1-minute pitch video on Google Drive; the button uses `VIDEO_SUBMIT_URL` and shows "link will appear here soon" while it's empty. Edit the copy there.

Adding a dashboard section: add an entry to `VIEWS` in the page and a matching `view === '…'` block (wrapped in `.dash-view`, no card); query in the page (server) via `sql`, prefer the views (`team_balances`, `leaderboard`), render with `.pbj-reg.dash-card`. A larger feature gets its own route (see `docs/roadmap.md`).
