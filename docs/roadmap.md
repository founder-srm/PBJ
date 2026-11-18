# Roadmap: what isn't built yet

Each item is sized to be picked up by one agent. The schema for most of them already exists (`docs/database.md`); the work is mostly pages, server actions and admin tools. Before starting, check whether a route folder for it already exists: another agent may own it.

Suggested route layout so features don't collide: one folder per feature under `src/app/`, each with its own `page.jsx`, `actions.js` and CSS file. Protect each in `src/proxy.js` `matcher` (one line; that file is shared, so keep the edit minimal).

| Feature | Route(s) | Tables / views | Notes |
| --- | --- | --- | --- |
| **Fee payment → Peanuts** | `/admin/payments` (organisers) | `teams.fee_paid_at`, `payment_ref`, `status`; ledger `fee_grant` | Mark paid → in one transaction: set `fee_paid_at`/`status = 'paid'` and post house −100000 / team +100000 with `idempotency_key = 'fee:<team id>'`. Needs `users.role` checks. |
| **Rooms** | `/admin/rooms` | `rooms`, `teams.room_id` | Assign teams to pitch rooms; dashboard already shows the room. |
| **Invest** | `/invest` | `investment_windows`, `investments`, `share_prices`, ledger `investment` | Rule from the brief: each team invests 20,000–40,000 Peanuts in other teams in its room. No self-investment (DB enforces). |
| **Shop** | `/shop` | `shop_items`, `purchases`, ledger `purchase` | Mentor slots, design help, user testing, FC promotion. Enforce `stock` and `per_team_limit` in the action (lock with `select … for update` on the item inside the transaction). |
| **Leaderboard / projector** | `/leaderboard`, `/projector` | view `leaderboard` | Poll every few seconds; ~130 teams. The projector page should be public and read-only. |
| **Team links & verified users** | `/t/[slug]` | `referral_signups`, `product_visits`, view `verified_users` | A student signs in with their **college** account through a team's link, counts once, and is redirected to the team's `product_url`. Participants don't count (view handles it). This is the one place SRM accounts sign in, so check whether SRM Google accounts can use Neon's OAuth before building. |
| **Product submission** | dashboard section | `teams.product_url`, `submitted_at` | Both set together (DB check). Deadline 08:00 Day 2. |
| **Judging** | `/judge` | `evaluations`, `users.role = 'judge'` | One score per (team, judge), 0–100, `criteria` jsonb. |
| **Password reset** | `/forgot-password`, `/reset-password` | Neon Auth | Needs a custom email provider in Neon Auth first (see `docs/auth.md`). |
| **Production launch** | | | Own Google OAuth client, trusted domain, `allow_localhost` off, Vercel env vars, confirm dates in `src/content.js`, turn off Neon auto-suspend during the event days. |
