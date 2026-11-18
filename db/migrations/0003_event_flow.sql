-- Event flow: per-team stage, a DB-editable schedule and settings, payments from Razorpay,
-- venue pitches and guarded investing.
--
-- What a team sees = its stage (stored here) + the schedule (dates, editable) + now. See docs/database.md.
-- Statements are separated by blank lines; function bodies contain none.

create type team_stage as enum ('pitch_video', 'in_review', 'shortlisted', 'not_shortlisted', 'paid', 'finalist', 'winner', 'withdrawn', 'disqualified');

-- Short code a team types into the Razorpay Payment Page so the webhook can match the payment.
-- 31-letter alphabet without 0/O/1/I/L; 5 characters is ~28M codes.
create function gen_team_code() returns text language sql volatile as $$
  select 'PBJ-' || string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 5)
$$;

alter table teams
  add column stage team_stage not null default 'pitch_video',
  add column team_code text not null default gen_team_code(),
  add column pitch_video_url text check (pitch_video_url ~ '^https://drive\.google\.com/\S+$'),
  add column pitch_submitted_at timestamptz,
  add column reviewed_at timestamptz,
  add constraint teams_team_code_key unique (team_code),
  add constraint teams_pitch_video_complete check ((pitch_video_url is null) = (pitch_submitted_at is null));

update teams set stage = case status when 'registered' then 'pitch_video'::team_stage else status::text::team_stage end;

alter table teams drop constraint teams_paid_before_playing;

alter table teams add constraint teams_paid_has_fee check (stage not in ('paid', 'finalist', 'winner') or fee_paid_at is not null);

create index teams_stage_idx on teams (stage);

drop view leaderboard;

alter table teams drop column status;

drop type team_status;

-- One row per step of the event. Organisers edit these dates; the app never hard-codes them.
-- 'results' only uses starts_at (when shortlist results become visible).
create table event_schedule (
  key text primary key check (key in ('registration', 'pitch_video', 'results', 'payment', 'event')),
  label text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

insert into event_schedule (key, label, starts_at, ends_at) values
  ('registration', 'Registration', '2026-11-01 00:00+05:30', '2027-01-10 23:59+05:30'),
  ('pitch_video', 'Pitch video', '2026-11-01 00:00+05:30', '2027-01-15 23:59+05:30'),
  ('results', 'Shortlist results', '2027-01-22 18:00+05:30', null),
  ('payment', 'Entry fee', '2027-01-22 18:00+05:30', '2027-02-05 23:59+05:30'),
  ('event', 'PBJ', '2027-02-15 09:00+05:30', '2027-02-17 18:00+05:30');

-- Exactly one row of settings.
create table event_settings (
  id boolean primary key default true check (id),
  fee_paise integer not null default 20000 check (fee_paise > 0),
  fee_grant bigint not null default 100000 check (fee_grant > 0),
  invest_budget_min bigint not null default 20000 check (invest_budget_min >= 0),
  invest_budget_max bigint not null default 40000 check (invest_budget_max > 0),
  razorpay_page_url text check (razorpay_page_url ~ '^https://'),
  updated_at timestamptz not null default now(),
  check (invest_budget_max >= invest_budget_min)
);

insert into event_settings default values;

-- A team pitching in a venue (rooms). One open pitch per room and per team.
create table pitches (
  id uuid primary key default uuidv7(),
  room_id uuid not null references rooms (id),
  team_id uuid not null references teams (id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  started_by uuid references users (id),
  check (ended_at is null or ended_at >= started_at)
);

create unique index pitches_one_open_per_room on pitches (room_id) where ended_at is null;

create unique index pitches_one_open_per_team on pitches (team_id) where ended_at is null;

create index pitches_team_idx on pitches (team_id);

alter table investments add column pitch_id uuid references pitches (id);

create index investments_pitch_idx on investments (pitch_id);

-- Every captured payment Razorpay tells us about, matched to a team or left for an organiser.
create table payments (
  id uuid primary key default uuidv7(),
  razorpay_payment_id text not null unique,
  amount_paise integer not null,
  team_code_entered text,
  payer_email text,
  payer_phone text,
  team_id uuid references teams (id),
  state text not null check (state in ('matched', 'unmatched', 'ignored')),
  note text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  resolved_by uuid references users (id),
  resolved_at timestamptz,
  check ((state = 'matched') = (team_id is not null))
);

create index payments_state_idx on payments (state);

-- Mark a shortlisted team paid and grant its Peanuts, once. Safe to call twice: the second call returns 'already_paid'.
create function confirm_team_payment(p_team uuid, p_payment_ref text, p_actor uuid) returns text language plpgsql as $$
declare
  v_stage team_stage;
  v_grant bigint;
  v_tx uuid;
begin
  select stage into v_stage from teams where id = p_team for update;
  if not found then
    raise exception 'no_team: team % does not exist', p_team using errcode = 'check_violation';
  end if;
  if v_stage in ('paid', 'finalist', 'winner') then
    return 'already_paid';
  end if;
  if v_stage <> 'shortlisted' then
    raise exception 'not_shortlisted: team % is %', p_team, v_stage using errcode = 'check_violation';
  end if;
  select fee_grant into v_grant from event_settings;
  update teams set stage = 'paid', fee_paid_at = now(), payment_ref = p_payment_ref where id = p_team;
  v_tx := uuidv7();
  insert into ledger_transactions (id, kind, idempotency_key, memo, created_by)
    values (v_tx, 'fee_grant', 'fee:' || p_team, 'Entry fee ' || coalesce(p_payment_ref, ''), p_actor);
  insert into ledger_postings (transaction_id, team_id, amount) values (v_tx, null, -v_grant), (v_tx, p_team, v_grant);
  return 'paid';
end
$$;

-- A team invests in whoever is pitching in its venue. Every rule is checked here, under a lock on the investor,
-- so two quick clicks can't both pass the budget check. Errors start with a code the app maps to a message.
-- Returns the ledger transaction id; replaying the same p_key returns the original id without investing again.
create function invest(p_investor uuid, p_pitch uuid, p_amount bigint, p_actor uuid, p_key text) returns uuid language plpgsql as $$
declare
  v_pitch pitches%rowtype;
  v_stage team_stage;
  v_room uuid;
  v_max bigint;
  v_used bigint;
  v_tx uuid;
begin
  if p_key is not null then
    select id into v_tx from ledger_transactions where idempotency_key = p_key;
    if found then
      return v_tx;
    end if;
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'bad_amount: amount must be positive' using errcode = 'check_violation';
  end if;
  select stage, room_id into v_stage, v_room from teams where id = p_investor for update;
  if not found or v_stage not in ('paid', 'finalist', 'winner') then
    raise exception 'not_playing: team % cannot invest', p_investor using errcode = 'check_violation';
  end if;
  if not exists (select 1 from event_schedule where key = 'event' and starts_at <= now() and (ends_at is null or ends_at > now())) then
    raise exception 'event_closed: investing is only open during the event' using errcode = 'check_violation';
  end if;
  select * into v_pitch from pitches where id = p_pitch;
  if not found or v_pitch.ended_at is not null then
    raise exception 'not_pitching: that pitch has ended' using errcode = 'check_violation';
  end if;
  if v_pitch.team_id = p_investor then
    raise exception 'self: a team cannot invest in itself' using errcode = 'check_violation';
  end if;
  if v_room is distinct from v_pitch.room_id then
    raise exception 'wrong_venue: team % is not in this venue', p_investor using errcode = 'check_violation';
  end if;
  if exists (select 1 from investments where investor_team_id = v_pitch.team_id and investee_team_id = p_investor) then
    raise exception 'reverse_holding: the pitching team has invested in you' using errcode = 'check_violation';
  end if;
  select invest_budget_max into v_max from event_settings;
  select coalesce(sum(amount), 0) into v_used from investments where investor_team_id = p_investor;
  if v_used + p_amount > v_max then
    raise exception 'over_budget: % of % already invested', v_used, v_max using errcode = 'check_violation';
  end if;
  v_tx := uuidv7();
  insert into ledger_transactions (id, kind, idempotency_key, created_by) values (v_tx, 'investment', p_key, p_actor);
  insert into ledger_postings (transaction_id, team_id, amount) values (v_tx, p_investor, -p_amount), (v_tx, v_pitch.team_id, p_amount);
  insert into investments (transaction_id, window_id, investor_team_id, investee_team_id, amount, share_price, pitch_id)
    values (v_tx, null, p_investor, v_pitch.team_id, p_amount, 1, p_pitch);
  return v_tx;
end
$$;

create view leaderboard as
with raised as (
  select investee_team_id as team_id, sum(amount)::bigint as raised, count(distinct investor_team_id) as investors
  from investments group by investee_team_id
),
latest_price as (
  select distinct on (sp.team_id) sp.team_id, sp.price
  from share_prices sp
  join investment_windows w on w.id = sp.window_id
  order by sp.team_id, w.closes_at desc
),
scores as (
  select team_id, round(avg(score), 2) as avg_score, count(*) as judges
  from evaluations group by team_id
),
verified as (
  select team_id, count(*) as verified_users from verified_users group by team_id
),
returning_users as (
  select v.team_id, count(*) as returning_users
  from (
    select pv.team_id, pv.user_id
    from product_visits pv
    join verified_users vu on vu.team_id = pv.team_id and vu.user_id = pv.user_id
    group by pv.team_id, pv.user_id
    having count(*) > 1
  ) v
  group by v.team_id
)
select
  t.id as team_id,
  t.name,
  t.slug,
  t.stage,
  t.room_id,
  b.balance,
  coalesce(r.raised, 0) as raised,
  coalesce(r.investors, 0) as investors,
  lp.price as share_price,
  s.avg_score,
  coalesce(s.judges, 0) as judges,
  coalesce(v.verified_users, 0) as verified_users,
  coalesce(ru.returning_users, 0) as returning_users
from teams t
join team_balances b on b.team_id = t.id
left join raised r on r.team_id = t.id
left join latest_price lp on lp.team_id = t.id
left join scores s on s.team_id = t.id
left join verified v on v.team_id = t.id
left join returning_users ru on ru.team_id = t.id
where t.stage in ('paid', 'finalist', 'winner');
