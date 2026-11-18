# Registration and dashboard

Owner areas: **Registration** (`src/lib/registration.js`, `src/components/RegistrationForm.jsx`, `src/RegisterPage.jsx`, `src/app/register/*`) and **Dashboard & platform** (`src/app/dashboard/*`).

## Flow

`/login` → `/register` (form) → `registerTeam` → `/dashboard`. A leader who already has a team is redirected from `/register` and `/login` to `/dashboard`. Registration is only open inside the `registration` window of `event_schedule`.

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

Layout: a full-height sidebar fixed to the left edge of the screen (`.dash-side`, styles in `src/app/dashboard/dashboard.css`) with **Home**, **Shop**, **Leaderboard** and **Team Details**, plus the signed-in email and sign-out at the bottom. On phones (≤760px) it becomes a bottom tab bar. The page (header, content, footer) is offset by `--dash-side-w`. The selected item is navy (bright blue in dark mode), never red: red means an error.

The selected item comes from `?view=` (`home` default, `shop`, `leaderboard`, `team`); the server renders only that view, so it works without JS and the URL can be shared. Members are only queried for the team view.

- **Home**: team name, wallet balance (`team_balances`) directly below it, stage and venue badges, and a **What to do now** card (`HomeStage.jsx`).
- **Team Details, Shop, Leaderboard**: no team header and no card; the page starts with the view's own title (`.dash-view`). Shop and Leaderboard are placeholders ("Opens <event start>").

## Event flow: what a team sees

Two inputs decide it, plus the current time:
1. **`teams.stage`** (stored, per team): `pitch_video → in_review → shortlisted | not_shortlisted → paid → finalist | winner`, plus `withdrawn`, `disqualified`. "Registration" is implicit: signed in, no team.
2. **`event_schedule`** (stored, global): dated windows `registration`, `pitch_video`, `results` (start only), `payment`, `event`. Organisers edit them in `/admin/schedule`; never hard-code dates.

`effectiveStage(stage, schedule)` in `src/lib/stage.js` turns these into the view, without any bulk updates when a date passes:

| Effective stage | When | Home card |
| --- | --- | --- |
| `pitch_video` | stage `pitch_video`, video window open | Drive-link form (`PitchVideoForm` → `submitPitchVideo`). The link must be public: see below |
| `missed` | stage `pitch_video`, video window closed | "Submissions closed" |
| `in_review` | stage `in_review`, or shortlisted/not before `results.starts_at` | Saved link (editable while the window is open) + results date; a red warning if the link has stopped being public |
| `shortlisted` | after the results date | Team code (copy), "Pay ₹fee" → `event_settings.razorpay_page_url` inside the `payment` window; auto-refreshes every 10 s |
| `not_shortlisted` | after the results date | Thank-you message |
| `paid` | stage `paid`, before `event` | Venue (if assigned) + countdown to the event start |
| `live` | stage `paid`, during `event` | `InvestPanel`: who's pitching in the venue (polls `GET /api/pitch` every 5 s), budget, invest form (`investInPitch` → DB `invest()`) |
| `over` | stage `paid`, after `event` | "PBJ is over" |

**Public video links.** `checkDriveLink()` (`src/lib/drive.js`, server-only) asks Google Drive for the file as an anonymous visitor: 200 = public, a redirect to Google sign-in or 401/403 = private, 404 = missing. `submitPitchVideo` refuses private, missing and non-file links with instructions (`DRIVE_MESSAGES`); if Google doesn't answer clearly it saves the link and reminds the team to check sharing. The dashboard re-checks while the team is under review, the admin team page shows a live Public / Not public badge, and **Check video links** on `/admin/teams` checks every link under review. No API key is used; only the file id is sent to Google.

Copy lives in `src/app/dashboard/HomeStage.jsx` (`STAGE_BADGE` and one card per stage). `/register` and `registerTeam` refuse outside the `registration` window.

### Investing rules (enforced by `invest()` in the database)
Only during the `event` window; the investor is paid and in the **same venue** as the team currently pitching there; not itself; not a team that the pitching team has invested in (no reverse holding); total invested ≤ `event_settings.invest_budget_max` (`invest_budget_min` is the target shown to teams); any number of investments; never below zero Peanuts. `src/lib/live.js` (`getLiveState`) mirrors these checks only to show the right message.

### Payments
Razorpay **Payment Page** with a required field labelled **Team code**, plus a webhook (`payment.captured`) to `/api/razorpay/webhook` signed with `RAZORPAY_WEBHOOK_SECRET`. The webhook stores every payment in `payments`; a correct-amount payment whose code matches a **shortlisted** team runs `confirm_team_payment()` (stage → `paid`, 100,000 Peanuts, once). Anything else is `unmatched` with a note, for an organiser in `/admin/payments`. Before launch: make one test-mode payment and check that the code arrives in `payment.notes` (the webhook looks for a key like `team_code`, else any note value containing `PBJ`).

## Admin (`src/app/admin/*`)
Organisers and admins only (`users.role`; set it in the DB). The layout calls `requireOrganiser()` (`src/lib/admin.js`) and every server action in `admin/actions.js` re-checks.
- **Teams**: filter by stage, watch videos, Shortlist / Not shortlisted / Undo, Mark paid by hand (with a reference), Withdraw. Shows each team's Peanuts.
- **Team detail** (`/admin/teams/[id]`, click a team anywhere in admin): leader phone, login and college email, all members, current Peanuts, teams it invested in and its investors (totals per team), judging marks per round and judge, payments, and the same actions plus Set venue.
- **Payments**: match an unmatched payment to a shortlisted team, or ignore it (e.g. refunded).
- **Venues**: add venues (`rooms`); move any paid team to a venue by hand; **Place unassigned teams** (fills the emptiest venues first, keeps existing assignments) or **Reshuffle all teams** (random, equal sizes; refused while a pitch is open). Both use `divideEvenly()` in `src/lib/venues.js`. Start/Next/End pitch (one open pitch per venue).
- **Judging results**: pick a round; per venue, each team's average per criterion and overall (average of that round's judges' totals), ranked, with how many of the venue's judges in that round scored it.
- **Judging setup**: rounds (create, edit name/scope/dates, delete while unscored); judges by email (not team leaders), with venues assigned per round and "Copy venues from…" another round; remove a judge (their scores stay). Criteria shared by all rounds: name, description, max, weight, order, on/off. The max can't drop below a score already given.
- **Schedule**: edit the event dates (IST) and `event_settings` (fee, Peanuts granted, budget min/max, Payment Page URL). Judging dates are per round, in Judging setup.

## Judging (`src/app/judge/*`)
Judging happens in **rounds** (`judging_rounds`, created in `/admin/judges`): each has a name, dates, and a scope (all competing teams, or finalists only). Each round has its own judge-to-venue assignments (`judge_venues.round_id`) and its own results; criteria are shared. Judges (`users.role = 'judge'`) sign in at `/login` and land on `/judge` (`homeFor()`), which shows the open round (or the next one; tabs switch rounds): the teams in their venues for that round, with their own total for each. They score a team at `/judge/<team id>?round=<round id>`: one number per active criterion (0..max, halves allowed) plus private notes, saved by `saveScores` → `save_evaluation()`, only while the round is open. Judges never see other judges' scores. A judge's total is each score as a share of its max, weighted, ×100; a team's score in a round is the average across that round's judges (`team_judging`). Rounds are ranked separately; `leaderboard.avg_score` shows the latest round a team was judged in.

Adding a dashboard section: add an entry to `VIEWS` in the page and a matching `view === '…'` block (wrapped in `.dash-view`, no card); query in the page (server) via `sql`, prefer the views (`team_balances`, `leaderboard`), render with `.pbj-reg.dash-card`. A larger feature gets its own route (see `docs/roadmap.md`).
