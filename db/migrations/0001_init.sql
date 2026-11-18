-- PBJ platform schema, v1 (Postgres 18: uses uuidv7()).
-- Applied to Neon project "PBJ" (winter-darkness-88202045), branch main, database pbj.
--
-- Peanuts are whole numbers (bigint). The ledger is append-only and double-entry:
--   * every ledger transaction's postings sum to zero,
--   * a posting with team_id NULL belongs to the PBJ house account (the issuer of Peanuts),
--   * a team's balance is the sum of its postings and can never go below zero.
-- Mistakes are fixed with a reversing transaction, never by editing rows.
-- Statements are separated by blank lines; function bodies contain none.

create type user_role as enum ('student', 'organiser', 'judge', 'admin');

create type team_status as enum ('registered', 'paid', 'finalist', 'winner', 'withdrawn', 'disqualified');

create type ledger_kind as enum ('fee_grant', 'investment', 'purchase', 'investor_return', 'refund', 'adjustment');

create type shop_category as enum ('mentor', 'design', 'testing', 'promotion', 'other');

create type purchase_status as enum ('pending', 'fulfilled', 'cancelled');

-- Everyone who signs in with Google: participants, the students teams bring in, judges and organisers.
create table users (
  id uuid primary key default uuidv7(),
  google_sub text not null unique,
  email text not null unique check (email = lower(btrim(email))),
  name text not null,
  avatar_url text,
  role user_role not null default 'student',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table rooms (
  id uuid primary key default uuidv7(),
  name text not null unique check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

create table teams (
  id uuid primary key default uuidv7(),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,48}$'),
  size smallint not null check (size between 2 and 4),
  status team_status not null default 'registered',
  room_id uuid references rooms (id) on delete set null,
  fee_paid_at timestamptz,
  payment_ref text unique,
  product_url text check (product_url ~ '^https?://'),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint teams_paid_before_playing check (status in ('registered', 'withdrawn') or fee_paid_at is not null),
  constraint teams_submission_complete check ((product_url is null) = (submitted_at is null))
);

create unique index teams_name_unique on teams (lower(btrim(name)));

create index teams_room_id_idx on teams (room_id);

-- Registration details, one row per member. position 1 is the team leader.
-- Same rules as src/lib/registration.js; user_id links the row once that student signs in.
create table team_members (
  id uuid primary key default uuidv7(),
  team_id uuid not null references teams (id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  ra_number text not null unique check (ra_number ~ '^RA[0-9]{13}$'),
  college_email text not null unique check (college_email ~ '^[a-z0-9._%+-]+@srmist\.edu\.in$'),
  phone text check (phone ~ '^[6-9][0-9]{9}$'),
  faculty_advisor text check (char_length(btrim(faculty_advisor)) between 2 and 80),
  faculty_email text check (faculty_email ~ '^[a-z0-9._%+-]+@srmist\.edu\.in$'),
  user_id uuid unique references users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (team_id, position)
);

create table ledger_transactions (
  id uuid primary key default uuidv7(),
  kind ledger_kind not null,
  idempotency_key text unique,
  memo text,
  created_by uuid references users (id),
  created_at timestamptz not null default now()
);

create index ledger_transactions_created_by_idx on ledger_transactions (created_by);

create table ledger_postings (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references ledger_transactions (id),
  team_id uuid references teams (id),
  amount bigint not null check (amount <> 0),
  created_at timestamptz not null default now()
);

create index ledger_postings_transaction_id_idx on ledger_postings (transaction_id);

create index ledger_postings_team_id_idx on ledger_postings (team_id) include (amount);

create table investment_windows (
  id uuid primary key default uuidv7(),
  label text not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  check (closes_at > opens_at)
);

create table investments (
  id uuid primary key default uuidv7(),
  transaction_id uuid not null unique references ledger_transactions (id),
  window_id uuid references investment_windows (id),
  investor_team_id uuid not null references teams (id),
  investee_team_id uuid not null references teams (id),
  amount bigint not null check (amount > 0),
  share_price numeric(14, 4) not null check (share_price > 0),
  shares numeric(20, 6) generated always as (amount / share_price) stored,
  created_at timestamptz not null default now(),
  check (investor_team_id <> investee_team_id)
);

create index investments_investor_idx on investments (investor_team_id);

create index investments_investee_idx on investments (investee_team_id);

create index investments_window_idx on investments (window_id);

-- One price per team per window, recomputed after each window closes (shown live on the projector).
create table share_prices (
  team_id uuid not null references teams (id),
  window_id uuid not null references investment_windows (id),
  price numeric(14, 4) not null check (price > 0),
  computed_at timestamptz not null default now(),
  primary key (team_id, window_id)
);

create index share_prices_window_idx on share_prices (window_id);

create table shop_items (
  id uuid primary key default uuidv7(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,48}$'),
  name text not null,
  description text,
  category shop_category not null,
  price bigint not null check (price > 0),
  stock integer check (stock >= 0),
  per_team_limit integer check (per_team_limit > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on column shop_items.stock is 'NULL means unlimited.';

create table purchases (
  id uuid primary key default uuidv7(),
  transaction_id uuid not null unique references ledger_transactions (id),
  team_id uuid not null references teams (id),
  item_id uuid not null references shop_items (id),
  quantity integer not null default 1 check (quantity > 0),
  unit_price bigint not null check (unit_price > 0),
  status purchase_status not null default 'pending',
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  check ((status = 'fulfilled') = (fulfilled_at is not null))
);

create index purchases_team_idx on purchases (team_id);

create index purchases_item_idx on purchases (item_id);

create table evaluations (
  id uuid primary key default uuidv7(),
  team_id uuid not null references teams (id),
  judge_id uuid not null references users (id),
  score numeric(5, 2) not null check (score between 0 and 100),
  criteria jsonb not null default '{}' check (jsonb_typeof(criteria) = 'object'),
  notes text,
  created_at timestamptz not null default now(),
  unique (team_id, judge_id)
);

create index evaluations_judge_idx on evaluations (judge_id);

-- A student counts once, for the first team whose link brought them in.
create table referral_signups (
  user_id uuid primary key references users (id),
  team_id uuid not null references teams (id),
  created_at timestamptz not null default now()
);

create index referral_signups_team_idx on referral_signups (team_id);

-- One row per student per team per day (IST), for returning users.
create table product_visits (
  team_id uuid not null references teams (id),
  user_id uuid not null references users (id),
  visit_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  primary key (team_id, user_id, visit_date)
);

create index product_visits_user_idx on product_visits (user_id);

-- Spending from a team takes a lock on that team first, so concurrent spends queue up instead of overdrawing.
create function ledger_lock_team() returns trigger language plpgsql as $$
begin
  if new.team_id is not null and new.amount < 0 then
    perform 1 from teams where id = new.team_id for update;
  end if;
  return new;
end
$$;

create trigger ledger_postings_lock_team before insert on ledger_postings
  for each row execute function ledger_lock_team();

-- Checked at commit: the transaction balances and no team ends up below zero.
create function ledger_check_posting() returns trigger language plpgsql as $$
declare
  total bigint;
  bal bigint;
begin
  select sum(amount) into total from ledger_postings where transaction_id = new.transaction_id;
  if total <> 0 then
    raise exception 'ledger transaction % does not balance (off by %)', new.transaction_id, total
      using errcode = 'check_violation';
  end if;
  if new.team_id is not null then
    select sum(amount) into bal from ledger_postings where team_id = new.team_id;
    if bal < 0 then
      raise exception 'team % would have a negative balance (%)', new.team_id, bal
        using errcode = 'check_violation';
    end if;
  end if;
  return null;
end
$$;

create constraint trigger ledger_postings_check after insert on ledger_postings
  deferrable initially deferred
  for each row execute function ledger_check_posting();

create function ledger_append_only() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only: post a reversing transaction instead', tg_table_name
    using errcode = 'restrict_violation';
end
$$;

create trigger ledger_postings_append_only before update or delete on ledger_postings
  for each row execute function ledger_append_only();

create trigger ledger_postings_no_truncate before truncate on ledger_postings
  for each statement execute function ledger_append_only();

create trigger ledger_transactions_append_only before update or delete on ledger_transactions
  for each row execute function ledger_append_only();

create trigger ledger_transactions_no_truncate before truncate on ledger_transactions
  for each statement execute function ledger_append_only();

-- Checked at commit: a team has exactly `size` members, in positions 1..size.
create function team_members_match_size() returns trigger language plpgsql as $$
declare
  tid uuid;
  team_size smallint;
  n int;
  top smallint;
begin
  if tg_table_name = 'teams' then
    tid := new.id;
  elsif tg_op = 'DELETE' then
    tid := old.team_id;
  else
    tid := new.team_id;
  end if;
  select size into team_size from teams where id = tid;
  if team_size is null then
    return null;
  end if;
  select count(*), max(position) into n, top from team_members where team_id = tid;
  if n <> team_size or top <> team_size then
    raise exception 'team % has % members (positions up to %) but its size is %', tid, n, coalesce(top, 0), team_size
      using errcode = 'check_violation';
  end if;
  return null;
end
$$;

create constraint trigger team_members_member_count_check after insert or update or delete on team_members
  deferrable initially deferred
  for each row execute function team_members_match_size();

create constraint trigger teams_member_count_check after insert or update of size on teams
  deferrable initially deferred
  for each row execute function team_members_match_size();

create view team_balances as
select t.id as team_id, coalesce(sum(p.amount), 0)::bigint as balance
from teams t
left join ledger_postings p on p.team_id = t.id
group by t.id;

-- Students who count toward a team: a college account, and not a PBJ participant themselves.
create view verified_users as
select r.team_id, r.user_id, r.created_at
from referral_signups r
join users u on u.id = r.user_id
where u.email like '%@srmist.edu.in'
  and not exists (
    select 1 from team_members m where m.user_id = u.id or m.college_email = u.email
  );

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
  t.status,
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
where t.status not in ('withdrawn', 'disqualified');
