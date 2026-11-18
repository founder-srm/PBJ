-- Judging: criteria (editable), judges assigned to venues, per-criterion scores, and live averages.
-- A judge (users.role = 'judge') scores the teams in the venues they're assigned to, during the 'judging' window.
-- Each judge's total = weighted share of the maximum, 0-100. A team's score = average of its judges' totals.
-- Statements are separated by blank lines; function bodies contain none.

alter table event_schedule drop constraint event_schedule_key_check;

alter table event_schedule add constraint event_schedule_key_check check (key in ('registration', 'pitch_video', 'results', 'payment', 'event', 'judging'));

insert into event_schedule (key, label, starts_at, ends_at) values ('judging', 'Judging', '2027-02-15 09:00+05:30', '2027-02-17 18:00+05:30');

create table judging_criteria (
  id uuid primary key default uuidv7(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  description text check (char_length(description) <= 300),
  max_score smallint not null default 10 check (max_score between 1 and 100),
  weight numeric(5, 2) not null default 1 check (weight > 0),
  position smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index judging_criteria_name_unique on judging_criteria (lower(btrim(name)));

insert into judging_criteria (name, description, max_score, position) values
  ('Problem & idea', 'Is the problem real and the idea a strong answer to it?', 10, 1),
  ('Product & execution', 'How well does what they built work, and how much got done?', 10, 2),
  ('Traction', 'Verified users, returning users and real demand.', 10, 3),
  ('Pitch', 'Clarity, story and how well they handled questions.', 10, 4);

create table judge_venues (
  judge_id uuid not null references users (id) on delete cascade,
  room_id uuid not null references rooms (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (judge_id, room_id)
);

create index judge_venues_room_idx on judge_venues (room_id);

alter table evaluations
  add column room_id uuid references rooms (id),
  add column updated_at timestamptz not null default now();

create table evaluation_scores (
  evaluation_id uuid not null references evaluations (id) on delete cascade,
  criterion_id uuid not null references judging_criteria (id),
  score numeric(5, 2) not null check (score >= 0),
  primary key (evaluation_id, criterion_id)
);

create index evaluation_scores_criterion_idx on evaluation_scores (criterion_id);

-- Save one judge's scores for one team (insert or replace). p_scores = {"<criterion id>": score, ...} for every
-- active criterion. Returns the judge's total (0-100). Errors start with a code the app maps to a message.
create function save_evaluation(p_judge uuid, p_team uuid, p_scores jsonb, p_notes text) returns numeric language plpgsql as $$
declare
  v_role user_role;
  v_room uuid;
  v_stage team_stage;
  v_eval uuid;
  v_total numeric;
  c record;
  v_raw jsonb;
  v_score numeric;
begin
  select role into v_role from users where id = p_judge;
  if v_role is null or v_role not in ('judge', 'admin') then
    raise exception 'not_judge: user % is not a judge', p_judge using errcode = 'check_violation';
  end if;
  select room_id, stage into v_room, v_stage from teams where id = p_team;
  if not found or v_stage not in ('paid', 'finalist', 'winner') then
    raise exception 'not_playing: team % is not competing', p_team using errcode = 'check_violation';
  end if;
  if v_room is null or not exists (select 1 from judge_venues where judge_id = p_judge and room_id = v_room) then
    raise exception 'wrong_venue: you are not judging this team''s venue' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from event_schedule where key = 'judging' and starts_at <= now() and (ends_at is null or ends_at > now())) then
    raise exception 'judging_closed: judging is not open' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_scores) is distinct from 'object' then
    raise exception 'bad_score: scores must be an object' using errcode = 'check_violation';
  end if;
  if exists (select 1 from jsonb_object_keys(p_scores) k where not exists (select 1 from judging_criteria jc where jc.id::text = k and jc.active)) then
    raise exception 'unknown_criterion: a score is for a criterion that does not exist' using errcode = 'check_violation';
  end if;
  insert into evaluations (team_id, judge_id, score, notes, room_id, updated_at)
    values (p_team, p_judge, 0, nullif(btrim(p_notes), ''), v_room, now())
    on conflict (team_id, judge_id) do update set notes = excluded.notes, room_id = excluded.room_id, updated_at = now()
    returning id into v_eval;
  delete from evaluation_scores where evaluation_id = v_eval;
  for c in select id, name, max_score from judging_criteria where active order by position loop
    v_raw := p_scores -> c.id::text;
    if v_raw is null or jsonb_typeof(v_raw) <> 'number' then
      raise exception 'missing_score: score %', c.name using errcode = 'check_violation';
    end if;
    v_score := v_raw::text::numeric;
    if v_score < 0 or v_score > c.max_score then
      raise exception 'bad_score: % must be between 0 and %', c.name, c.max_score using errcode = 'check_violation';
    end if;
    insert into evaluation_scores (evaluation_id, criterion_id, score) values (v_eval, c.id, v_score);
  end loop;
  select round(sum(s.score / c2.max_score * c2.weight) / sum(c2.weight) * 100, 2) into v_total
    from evaluation_scores s join judging_criteria c2 on c2.id = s.criterion_id where s.evaluation_id = v_eval;
  update evaluations set score = v_total where id = v_eval;
  return v_total;
end
$$;

-- Each judge's total, recomputed from the scores and the current criteria (so weight changes apply everywhere).
-- complete = the judge has scored every active criterion.
create view evaluation_totals as
select e.id as evaluation_id, e.team_id, e.judge_id, e.room_id, e.updated_at,
  round(sum(s.score / c.max_score * c.weight) / sum(c.weight) * 100, 2) as total,
  count(*) = (select count(*) from judging_criteria where active) as complete
from evaluations e
join evaluation_scores s on s.evaluation_id = e.id
join judging_criteria c on c.id = s.criterion_id and c.active
group by e.id;

-- A team's judging result: average of its judges' totals.
create view team_judging as
select team_id, count(*)::int as judges, round(avg(total), 2) as avg_score, bool_and(complete) as complete
from evaluation_totals
group by team_id;

-- Average per criterion per team (for the results table).
create view criterion_averages as
select e.team_id, s.criterion_id, round(avg(s.score), 2) as avg_score, count(*)::int as judges
from evaluations e join evaluation_scores s on s.evaluation_id = e.id
group by e.team_id, s.criterion_id;

drop view leaderboard;

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
  j.avg_score,
  coalesce(j.judges, 0) as judges,
  coalesce(v.verified_users, 0) as verified_users,
  coalesce(ru.returning_users, 0) as returning_users
from teams t
join team_balances b on b.team_id = t.id
left join raised r on r.team_id = t.id
left join latest_price lp on lp.team_id = t.id
left join team_judging j on j.team_id = t.id
left join verified v on v.team_id = t.id
left join returning_users ru on ru.team_id = t.id
where t.stage in ('paid', 'finalist', 'winner');
