# Database

Owner area: **Database** (`db/migrations/*`, `src/lib/db.js`). Everyone reads from it; only this area changes the schema.

## Where it lives

- Neon project **PBJ**, id `winter-darkness-88202045`, org **Founders Club**, region AWS Singapore, Postgres 18.
- Branch `main` (`br-muddy-wind-az4mtktp`), database **`pbj`**, owner role `pbj_owner`.
- Two schemas: `neon_auth` (managed by Neon Auth: `user`, `session`, `account`, `verification`…; read only, never alter) and `public` (ours).

## Applied migrations

| File | What |
| --- | --- |
| `db/migrations/0001_init.sql` | Enums, all tables, triggers, views |
| `db/migrations/0002_neon_auth_users.sql` | `users.id` → FK to `neon_auth.user(id)`; drops `google_sub`; adds `teams.created_by` |
| `db/migrations/0005_judging_rounds.sql` | `judging_rounds` (+ enum `round_scope`); `judge_venues` and `evaluations` get `round_id`; the `judging` schedule step becomes the first round and is removed; `save_evaluation(judge, round, team, …)`; judging views per round; `leaderboard` uses each team's latest judged round |
| `db/migrations/0004_judging.sql` | `judging_criteria`, `judge_venues`, `evaluation_scores`, `evaluations.room_id`/`updated_at`; `judging` schedule step; `save_evaluation()`; views `evaluation_totals`, `team_judging`, `criterion_averages`; `leaderboard` scores from `team_judging` |
| `db/migrations/0003_event_flow.sql` | `teams.stage` (replaces `status`), `team_code`, pitch-video columns; `event_schedule`, `event_settings`, `pitches`, `payments`; functions `confirm_team_payment()`, `invest()`; `leaderboard` uses `stage` |

### Adding a migration

1. Check `db/migrations/` for the highest number **right before** you create yours (another agent may have just added one). Name it `NNNN_short_name.sql`.
2. Write it so statements are separated by blank lines and function bodies contain no blank lines (that's how it gets split for `run_sql_transaction`).
3. Prefer a test first: run it on a Neon branch (`create_branch` → apply → test → delete with the owner's OK), or inside a rolled-back `DO` block.
4. Apply to `main` with Neon MCP `run_sql_transaction` (all statements in one call, so it's all-or-nothing).
5. Update this doc's tables if you added or changed tables/views.

Never edit an applied migration. Never run destructive statements on `main` without the owner's explicit OK.

## Tables

| Table | Purpose | Notes |
| --- | --- | --- |
| `users` | One row per signed-in person | `id` = Neon Auth user id. Upserted by `getViewer()`. `role` enum: student, organiser, judge, admin. |
| `rooms` | Pitch rooms | `teams.room_id` |
| `teams` | Registered teams | `name` unique case/space-insensitively; `slug` unique (for team links); `size` 2–4; `stage` enum `team_stage` (see `docs/registration-and-dashboard.md`); `team_code` unique (`PBJ-XXXXX`, default `gen_team_code()`, typed on the Razorpay page); `pitch_video_url` (Google Drive) + `pitch_submitted_at` set together; `fee_paid_at` required for `paid`/`finalist`/`winner`; `product_url` + `submitted_at` set together; `created_by` = leader |
| `team_members` | One row per member | `position` 1 = leader; `ra_number` `^RA\d{13}$` unique; `college_email` `@srmist.edu.in` unique; `phone` `^[6-9]\d{9}$`; `faculty_email` `@srmist.edu.in`; `user_id` (leader only) unique |
| `ledger_transactions` | One row per money movement | `kind` enum; `idempotency_key` unique; append-only |
| `ledger_postings` | Lines of a transaction | `team_id` NULL = **house account** (issuer of Peanuts); `amount` ≠ 0; append-only |
| `event_schedule` | Dated steps: `registration`, `pitch_video`, `results`, `payment`, `event` (judging dates live in `judging_rounds`) | Edited in `/admin/schedule`; read via `getSchedule()` (`src/lib/event.js`) |
| `event_settings` | One row: `fee_paise`, `fee_grant`, `invest_budget_min/max`, `razorpay_page_url` | Read via `getSettings()` |
| `pitches` | A team pitching in a venue | One open pitch (`ended_at` null) per room and per team |
| `payments` | Every captured Razorpay payment | `razorpay_payment_id` unique; `state` matched/unmatched/ignored; `team_id` set iff matched |
| `investment_windows` | Timed investing rounds (unused since 0003; investing is per pitch) | `closes_at > opens_at` |
| `investments` | Team → team investment | Linked 1:1 to a ledger transaction; no self-investment; `pitch_id`; `share_price` is 1 until a pricing model exists; `shares` generated = amount / share_price |
| `share_prices` | Price per team per window | PK (team, window) |
| `shop_items` | Things to buy with Peanuts | `stock` NULL = unlimited; `per_team_limit` optional |
| `purchases` | A team's purchase | Linked 1:1 to a ledger transaction; `fulfilled_at` set iff status = fulfilled |
| `judging_rounds` | Judging sessions (e.g. Day 2, Day 3 finals) | `name` unique; `scope` `all` or `finalists`; `starts_at` < `ends_at`; deletable only while it has no evaluations |
| `evaluations` | One judge's evaluation of one team in one round | Unique (round, team, judge); `score` = that judge's total 0–100 (written by `save_evaluation()`); `notes`; `room_id` at scoring time. `criteria` jsonb is unused since 0004 |
| `evaluation_scores` | Score per criterion | PK (evaluation, criterion); `score` 0..criterion max (checked by `save_evaluation()`) |
| `judging_criteria` | What teams are scored on | `name` unique; `max_score` 1–100; `weight` > 0; `position`; `active` (turn off, don't delete) |
| `judge_venues` | Which venues each judge scores, per round | PK (round, judge, room); a venue can have many judges |
| `referral_signups` | A student brought in by a team's link | PK `user_id`: a student counts once, for the first team |
| `product_visits` | Daily visits per student per team | PK (team, user, IST date): powers "returning users" |

## Views

| View | Columns | Use it for |
| --- | --- | --- |
| `team_balances` | `team_id, balance` | A team's Peanuts (sum of its postings) |
| `verified_users` | `team_id, user_id, created_at` | Referral sign-ups that count: `@srmist.edu.in` and not a PBJ participant |
| `evaluation_totals` | `evaluation_id, round_id, team_id, judge_id, room_id, updated_at, total, complete` | Each judge's total, recomputed from scores × current weights; `complete` = every active criterion scored |
| `team_judging` | `round_id, team_id, judges, avg_score, complete` | A team's score in a round = average of that round's judges' totals |
| `criterion_averages` | `round_id, team_id, criterion_id, avg_score, judges` | Per-criterion averages for results tables |
| `leaderboard` | `team_id, name, slug, stage, room_id, balance, raised, investors, share_price, avg_score, judges, verified_users, returning_users` | Projector board and dashboard rankings (paid/finalist/winner teams only) |

## The Peanuts ledger: rules enforced by the database

1. **Balanced:** every transaction's postings sum to zero (deferred constraint trigger `ledger_postings_check`, checked at commit).
2. **No overdraft:** a team's balance can never go below zero (same trigger). The house account (NULL team) may go negative; it issues Peanuts.
3. **No races:** inserting a negative posting for a team locks that team row first (`ledger_postings_lock_team`), so concurrent spends queue.
4. **Append-only:** UPDATE/DELETE/TRUNCATE on `ledger_transactions` and `ledger_postings` raise an error. Fix mistakes with a reversing transaction (kind `refund` or `adjustment`).
5. **Idempotent:** pass a stable `idempotency_key` (e.g. `purchase:<request id>`) so a retried request can't charge twice.

### Writing a movement (server action / route)

```js
import { sql } from '../lib/db.js';

const txId = crypto.randomUUID();
await sql.transaction([
  sql`insert into ledger_transactions (id, kind, idempotency_key, created_by) values (${txId}, 'purchase', ${key}, ${viewer.id})`,
  sql`insert into ledger_postings (transaction_id, team_id, amount) values (${txId}, ${teamId}, ${-total}), (${txId}, null, ${total})`,
  sql`insert into purchases (transaction_id, team_id, item_id, quantity, unit_price) values (${txId}, ${teamId}, ${itemId}, ${qty}, ${price})`,
]);
```

Common movements:

| Kind | Postings |
| --- | --- |
| `fee_grant` (team paid ₹200) | house −100000, team +100000 |
| `purchase` | team −total, house +total |
| `investment` | investor −amount, investee +amount (+ `investments` row) |
| `investor_return` | house −x, investor +x |
| `refund` / `adjustment` | the reverse of the original |

Errors to expect: SQLSTATE `23514` (check_violation: unbalanced or overdraft, from the trigger) and `23505` (unique: replayed idempotency key, duplicate RA/email/team name). Map them to friendly messages like `registerTeam` does.

## Guarded writes (database functions)

The Neon HTTP driver's transactions can't branch, so writes with rules live in plpgsql. Errors are SQLSTATE `23514` with a message that starts with a code (`not_shortlisted:`, `over_budget:`…); map the code to a friendly message (see `src/app/dashboard/actions.js`).

| Function | Does | Errors |
| --- | --- | --- |
| `confirm_team_payment(team, payment_ref, actor)` | Locks the team; shortlisted → `paid` + `fee_paid_at` + `payment_ref`, and posts `fee_grant` (`idempotency_key = 'fee:<team>'`). Returns `paid`, or `already_paid` (no-op) | `no_team`, `not_shortlisted` |
| `save_evaluation(judge, round, team, scores jsonb, notes)` | Judge (role judge/admin) assigned to the team's venue **for that round**, while the round is open, and the team is in the round's scope: upserts the evaluation and replaces its per-criterion scores. `scores` = `{"<criterion id>": number}` for every active criterion. Returns the total | `not_judge`, `no_round`, `not_playing`, `not_in_round`, `wrong_venue`, `judging_closed`, `missing_score`, `bad_score`, `unknown_criterion` |
| `invest(investor, pitch, amount, actor, key)` | Locks the investor, checks every investing rule, posts `investment` + an `investments` row. Replaying `key` returns the first transaction id | `bad_amount`, `not_playing`, `event_closed`, `not_pitching`, `self`, `wrong_venue`, `reverse_holding`, `over_budget`, plus the ledger's negative-balance error |

Ledger rows are permanent, so test these on a Neon branch, not `main`.

## Team integrity triggers

`team_members_member_count_check` and `teams_member_count_check` (deferred) ensure a team has exactly `size` members in positions 1..size at commit. Insert the team and all its members in **one** transaction.

## Querying from the app

- Import `sql` from `src/lib/db.js` (server-only). It's the Neon HTTP driver: `` await sql`select … where id = ${id}` `` returns an array of rows. Values are always parameterised; never build SQL strings.
- Multi-statement atomic writes: `sql.transaction([sql`…`, sql`…`])` (non-interactive; generate ids in JS with `crypto.randomUUID()` so later statements can reference them).
- Arrays: `where ra_number = any(${array})` works.
- `bigint` and `numeric` come back as strings; wrap with `Number()` for display (Peanut amounts fit safely).

## Ad-hoc inspection

Neon MCP: `get_database_tables`, `describe_table_schema`, `run_sql` (read-only queries are fine). Pass `project_id: winter-darkness-88202045`, `database_name: pbj`.
