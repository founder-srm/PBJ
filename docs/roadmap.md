# Roadmap: what isn't built yet

Each item is sized to be picked up by one agent. The schema for most of them already exists (`docs/database.md`); the work is mostly pages, server actions and admin tools. Before starting, check whether a route folder for it already exists: another agent may own it.

Suggested route layout so features don't collide: one folder per feature under `src/app/`, each with its own `page.jsx`, `actions.js` and CSS file. Protect each in `src/proxy.js` `matcher` (one line; that file is shared, so keep the edit minimal).

| Feature | Route(s) | Tables / views | Notes |
| --- | --- | --- | --- |
| **Fee payment → Peanuts** | done: `/api/razorpay/webhook`, `/admin/payments` | `payments`, `confirm_team_payment()` | Before launch: create the Razorpay Payment Page (required “Team code” field), the webhook and `RAZORPAY_WEBHOOK_SECRET`; make one test-mode payment to confirm the notes key. |
| **Rooms / venues** | done: `/admin/venues` | `rooms`, `teams.room_id`, `pitches` | |
| **Invest** | done: dashboard live view, `/api/pitch` | `pitches`, `investments`, `invest()` | Share-price model still undecided (`share_price` = 1). Investor returns not built. |
| **Shop** | `/shop` | `shop_items`, `purchases`, ledger `purchase` | Mentor slots, design help, user testing, FC promotion. Enforce `stock` and `per_team_limit` in the action (lock with `select … for update` on the item inside the transaction). |
| **Leaderboard / projector** | `/leaderboard`, `/projector` | view `leaderboard` | Poll every few seconds; ~130 teams. The projector page should be public and read-only. |
| **Team links & verified users** | `/t/[slug]` | `referral_signups`, `product_visits`, view `verified_users` | A student signs in with their **college** account through a team's link, counts once, and is redirected to the team's `product_url`. Participants don't count (view handles it). This is the one place SRM accounts sign in, so check whether SRM Google accounts can use Neon's OAuth before building. |
| **Product submission** | dashboard section | `teams.product_url`, `submitted_at` | Both set together (DB check). Deadline 08:00 Day 2. |
| **Judging** | done: `/judge`, `/admin/judging`, `/admin/judges` | `judging_criteria`, `judge_venues`, `evaluation_scores`, `save_evaluation()`, `team_judging` | |
| **Password reset** | `/forgot-password`, `/reset-password` | Neon Auth | Needs a custom email provider in Neon Auth first (see `docs/auth.md`). |
| **Production launch** | | | Own Google OAuth client, trusted domain, `allow_localhost` off, Vercel env vars (incl. `RAZORPAY_WEBHOOK_SECRET`), set real dates in `/admin/schedule` and `src/content.js` (the landing page still reads `content.js`), give organisers `users.role = 'organiser'`, turn off Neon auto-suspend during the event days. |
