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
| `teams` | Registered teams | `name` unique case/space-insensitively; `slug` unique (for team links); `size` 2–4; `status` enum; `fee_paid_at` required once status leaves `registered`/`withdrawn`; `product_url` + `submitted_at` set together; `created_by` = leader |
| `team_members` | One row per member | `position` 1 = leader; `ra_number` `^RA\d{13}$` unique; `college_email` `@srmist.edu.in` unique; `phone` `^[6-9]\d{9}$`; `faculty_email` `@srmist.edu.in`; `user_id` (leader only) unique |
| `ledger_transactions` | One row per money movement | `kind` enum; `idempotency_key` unique; append-only |
| `ledger_postings` | Lines of a transaction | `team_id` NULL = **house account** (issuer of Peanuts); `amount` ≠ 0; append-only |
| `investment_windows` | Timed investing rounds | `closes_at > opens_at` |
| `investments` | Team → team investment | Linked 1:1 to a ledger transaction; no self-investment; `shares` generated = amount / share_price |
| `share_prices` | Price per team per window | PK (team, window) |
| `shop_items` | Things to buy with Peanuts | `stock` NULL = unlimited; `per_team_limit` optional |
| `purchases` | A team's purchase | Linked 1:1 to a ledger transaction; `fulfilled_at` set iff status = fulfilled |
| `evaluations` | Judges' scores | 0–100, one per (team, judge), `criteria` jsonb object |
| `referral_signups` | A student brought in by a team's link | PK `user_id`: a student counts once, for the first team |
| `product_visits` | Daily visits per student per team | PK (team, user, IST date): powers "returning users" |

## Views

| View | Columns | Use it for |
| --- | --- | --- |
| `team_balances` | `team_id, balance` | A team's Peanuts (sum of its postings) |
| `verified_users` | `team_id, user_id, created_at` | Referral sign-ups that count: `@srmist.edu.in` and not a PBJ participant |
| `leaderboard` | `team_id, name, slug, status, room_id, balance, raised, investors, share_price, avg_score, judges, verified_users, returning_users` | Projector board and dashboard rankings (excludes withdrawn/disqualified) |

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

## Team integrity triggers

`team_members_member_count_check` and `teams_member_count_check` (deferred) ensure a team has exactly `size` members in positions 1..size at commit. Insert the team and all its members in **one** transaction.

## Querying from the app

- Import `sql` from `src/lib/db.js` (server-only). It's the Neon HTTP driver: `` await sql`select … where id = ${id}` `` returns an array of rows. Values are always parameterised; never build SQL strings.
- Multi-statement atomic writes: `sql.transaction([sql`…`, sql`…`])` (non-interactive; generate ids in JS with `crypto.randomUUID()` so later statements can reference them).
- Arrays: `where ra_number = any(${array})` works.
- `bigint` and `numeric` come back as strings; wrap with `Number()` for display (Peanut amounts fit safely).

## Ad-hoc inspection

Neon MCP: `get_database_tables`, `describe_table_schema`, `run_sql` (read-only queries are fine). Pass `project_id: winter-darkness-88202045`, `database_name: pbj`.
