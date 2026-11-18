import Link from 'next/link';
import { sql } from '../../lib/db.js';
import { formatDateTime } from '../../lib/event.js';
import { getCriteria, getRounds, pickRound, requireJudge, ROUND_STAGES, SCOPE_LABEL } from '../../lib/judge.js';
import RoundTabs from '../admin/RoundTabs.jsx';

export const dynamic = 'force-dynamic';

// The judge's venues in the chosen round and the teams in them, with the judge's own total for each.
// Judges see only their own scores; organisers see averages in /admin/judging.
export default async function JudgeHome({ searchParams }) {
  const judge = await requireJudge();
  const { round: requested } = await searchParams;
  const [criteria, allRounds] = await Promise.all([getCriteria(), getRounds()]);
  // Only rounds this judge has a venue in.
  const mine = await sql`select distinct round_id from judge_venues where judge_id = ${judge.id}`;
  const rounds = allRounds.filter((r) => mine.some((m) => m.round_id === r.id));
  const round = pickRound(rounds, requested);

  const venues = round ? await sql`
    select r.id, r.name, pt.name as pitching, pt.id as pitching_id
    from judge_venues jv
    join rooms r on r.id = jv.room_id
    left join pitches p on p.room_id = r.id and p.ended_at is null
    left join teams pt on pt.id = p.team_id
    where jv.judge_id = ${judge.id} and jv.round_id = ${round.id}
    order by r.name` : [];
  const teams = venues.length ? await sql`
    select t.id, t.name, t.room_id, et.total, et.complete
    from teams t
    left join evaluation_totals et on et.team_id = t.id and et.judge_id = ${judge.id} and et.round_id = ${round.id}
    where t.room_id = any(${venues.map((v) => v.id)}) and t.stage::text = any(${ROUND_STAGES[round.scope]})
    order by t.name` : [];

  if (!round) {
    return (
      <>
        <div className="admin-top"><h1>Your teams</h1></div>
        <section className="admin-panel"><h2>No round yet</h2><p className="admin-sub">An organiser hasn’t assigned you to a venue in any judging round. Check back soon.</p></section>
      </>
    );
  }

  const windowNote = round.state === 'open' ? `Open until ${formatDateTime(round.endsAt)}.`
    : round.state === 'upcoming' ? `Opens on ${formatDateTime(round.startsAt)}. You can look around until then.`
    : 'This round has closed. Your scores are saved.';

  return (
    <>
      <div className="admin-top">
        <h1>Your teams</h1>
        {rounds.length > 1 ? <RoundTabs rounds={rounds} current={round} base="/judge" /> : null}
        <p className="admin-sub"><strong>{round.name}</strong> · {SCOPE_LABEL[round.scope]} · {windowNote} Each team is scored on {criteria.length} criteria; your total is out of 100.</p>
      </div>
      {venues.map((v) => {
        const here = teams.filter((t) => t.room_id === v.id);
        const done = here.filter((t) => t.complete).length;
        return (
          <section key={v.id} className="admin-panel">
            <h2>{v.name} <span className="admin-count">{done} of {here.length} scored</span></h2>
            {v.pitching && here.some((t) => t.id === v.pitching_id) ? <p className="judge-now">Pitching now: <Link href={`/judge/${v.pitching_id}?round=${round.id}`}>{v.pitching}</Link></p> : null}
            <ul className="judge-teams">
              {here.map((t) => (
                <li key={t.id}>
                  <Link href={`/judge/${t.id}?round=${round.id}`} className="judge-team">
                    <span className="judge-team-name">{t.name}</span>
                    <span className={t.total == null ? 'judge-score is-empty' : t.complete ? 'judge-score' : 'judge-score is-partial'}>
                      {t.total == null ? 'Not scored' : `${Number(t.total)} / 100${t.complete ? '' : ' · incomplete'}`}
                    </span>
                  </Link>
                </li>
              ))}
              {here.length === 0 ? <li className="admin-sub">No teams to judge in this venue for this round.</li> : null}
            </ul>
          </section>
        );
      })}
    </>
  );
}
