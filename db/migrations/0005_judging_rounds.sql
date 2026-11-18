-- Judging rounds (e.g. Day 2 for everyone, Day 3 for finalists). Each round has its own window, its own
-- judge-to-venue assignments and its own results; criteria are shared by all rounds.
-- Replaces the single 'judging' step in event_schedule: its dates become the first round.
-- Statements are separated by blank lines; function bodies contain none.

create type round_scope as enum ('all', 'finalists');

create table judging_rounds (
  id uuid primary key default uuidv7(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  scope round_scope not null default 'all',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create unique index judging_rounds_name_unique on judging_rounds (lower(btrim(name)));

insert into judging_rounds (name, scope, starts_at, ends_at, position)
select 'Round 1', 'all', starts_at, coalesce(ends_at, starts_at + interval '1 day'), 1 from event_schedule where key = 'judging';

-- Judge assignments become per round.
alter table judge_venues add column round_id uuid references judging_rounds (id) on delete cascade;

update judge_venues set round_id = (select id from judging_rounds order by position limit 1);

alter table judge_venues alter column round_id set not null;

alter table judge_venues drop constraint judge_venues_pkey;

alter table judge_venues add primary key (round_id, judge_id, room_id);

create index judge_venues_judge_idx on judge_venues (judge_id);

-- Evaluations belong to a round: one per (round, team, judge).
drop view leaderboard;

drop view team_judging;

drop view evaluation_totals;

drop view criterion_averages;

alter table evaluations add column round_id uuid references judging_rounds (id);

update evaluations set round_id = (select id from judging_rounds order by position limit 1);

alter table evaluations alter column round_id set not null;

alter table evaluations drop constraint evaluations_team_id_judge_id_key;

alter table evaluations add constraint evaluations_round_team_judge_key unique (round_id, team_id, judge_id);

create index evaluations_team_idx on evaluations (team_id);

delete from event_schedule where key = 'judging';

alter table event_schedule drop constraint event_schedule_key_check;

alter table event_schedule add constraint event_schedule_key_check check (key in ('registration', 'pitch_video', 'results', 'payment', 'event'));

drop function save_evaluation(uuid, uuid, jsonb, text);

-- Save one judge's scores for one team in one round (insert or replace). Same rules as before, plus:
-- the round's window is open, the judge is assigned to the team's venue for this round, and a 'finalists'
-- round only accepts finalist/winner teams.
create function save_evaluation(p_judge uuid, p_round uuid, p_team uuid, p_scores jsonb, p_notes text) returns numeric language plpgsql as $$
declare
  v_role user_role;
  v_round judging_rounds%rowtype;
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
  select * into v_round from judging_rounds where id = p_round;
  if not found then
    raise exception 'no_round: that round does not exist' using errcode = 'check_violation';
  end if;
  if now() < v_round.starts_at or now() >= v_round.ends_at then
    raise exception 'judging_closed: % is not open', v_round.name using errcode = 'check_violation';
  end if;
  select room_id, stage into v_room, v_stage from teams where id = p_team;
  if not found or v_stage not in ('paid', 'finalist', 'winner') then
    raise exception 'not_playing: team % is not competing', p_team using errcode = 'check_violation';
  end if;
  if v_round.scope = 'finalists' and v_stage not in ('finalist', 'winner') then
    raise exception 'not_in_round: % is for finalists only', v_round.name using errcode = 'check_violation';
  end if;
  if v_room is null or not exists (select 1 from judge_venues where round_id = p_round and judge_id = p_judge and room_id = v_room) then
    raise exception 'wrong_venue: you are not judging this team''s venue in this round' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_scores) is distinct from 'object' then
    raise exception 'bad_score: scores must be an object' using errcode = 'check_violation';
  end if;
  if exists (select 1 from jsonb_object_keys(p_scores) k where not exists (select 1 from judging_criteria jc where jc.id::text = k and jc.active)) then
    raise exception 'unknown_criterion: a score is for a criterion that does not exist' using errcode = 'check_violation';
  end if;
  insert into evaluations (round_id, team_id, judge_id, score, notes, room_id, updated_at)
    values (p_round, p_team, p_judge, 0, nullif(btrim(p_notes), ''), v_room, now())
    on conflict (round_id, team_id, judge_id) do update set notes = excluded.notes, room_id = excluded.room_id, updated_at = now()
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

create view evaluation_totals as
select e.id as evaluation_id, e.round_id, e.team_id, e.judge_id, e.room_id, e.updated_at,
  round(sum(s.score / c.max_score * c.weight) / sum(c.weight) * 100, 2) as total,
  count(*) = (select count(*) from judging_criteria where active) as complete
from evaluations e
join evaluation_scores s on s.evaluation_id = e.id
join judging_criteria c on c.id = s.criterion_id and c.active
group by e.id;

-- A team's result in one round: average of that round's judges' totals.
create view team_judging as
select round_id, team_id, count(*)::int as judges, round(avg(total), 2) as avg_score, bool_and(complete) as complete
from evaluation_totals
group by round_id, team_id;

create view criterion_averages as
select e.round_id, e.team_id, s.criterion_id, round(avg(s.score), 2) as avg_score, count(*)::int as judges
from evaluations e join evaluation_scores s on s.evaluation_id = e.id
group by e.round_id, e.team_id, s.criterion_id;

-- The leaderboard shows each team's score from the latest round it was judged in.
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
latest_judging as (
  select distinct on (tj.team_id) tj.team_id, tj.avg_score, tj.judges
  from team_judging tj
  join judging_rounds jr on jr.id = tj.round_id
  order by tj.team_id, jr.starts_at desc, jr.position desc
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
left join latest_judging j on j.team_id = t.id
left join verified v on v.team_id = t.id
left join returning_users ru on ru.team_id = t.id
where t.stage in ('paid', 'finalist', 'winner');
