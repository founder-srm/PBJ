import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '../../../lib/db.js';
import { getCriteria, getRounds, pickRound, requireJudge, ROUND_STAGES } from '../../../lib/judge.js';
import ScoreForm from '../ScoreForm.jsx';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Score one team in one round (?round=). Only teams in the judge's venues for that round, and in the round's scope.
export default async function JudgeTeam({ params, searchParams }) {
  const judge = await requireJudge();
  const { teamId } = await params;
  const { round: requested } = await searchParams;
  if (!UUID.test(teamId)) notFound();

  const mine = await sql`select distinct round_id from judge_venues where judge_id = ${judge.id}`;
  const round = pickRound((await getRounds()).filter((r) => mine.some((m) => m.round_id === r.id)), requested);
  if (!round) notFound();

  const [team] = await sql`
    select t.id, t.name, t.product_url, r.name as room,
      exists (select 1 from pitches p where p.team_id = t.id and p.ended_at is null) as pitching
    from teams t
    join rooms r on r.id = t.room_id
    join judge_venues jv on jv.room_id = t.room_id and jv.judge_id = ${judge.id} and jv.round_id = ${round.id}
    where t.id = ${teamId} and t.stage::text = any(${ROUND_STAGES[round.scope]})`;
  if (!team) notFound();

  const [criteria, members, saved] = await Promise.all([
    getCriteria(),
    sql`select name from team_members where team_id = ${teamId} order by position`,
    sql`
      select e.notes, s.criterion_id, s.score
      from evaluations e left join evaluation_scores s on s.evaluation_id = e.id
      where e.team_id = ${teamId} and e.judge_id = ${judge.id} and e.round_id = ${round.id}`,
  ]);
  const scores = Object.fromEntries(saved.filter((m) => m.criterion_id).map((m) => [m.criterion_id, Number(m.score)]));
  const open = round.state === 'open';

  return (
    <>
      <div className="admin-top">
        <p className="admin-sub"><Link href={`/judge?round=${round.id}`}>← Your teams</Link></p>
        <h1>{team.name}</h1>
        <p className="admin-sub">
          <strong>{round.name}</strong> · {team.room}{team.pitching ? ' · pitching now' : ''} · {members.map((m) => m.name).join(', ')}
          {team.product_url ? <> · <a href={team.product_url} target="_blank" rel="noopener noreferrer">Product</a></> : null}
        </p>
      </div>
      <section className="admin-panel">
        <h2>Your scores</h2>
        {open ? null : <p className="admin-msg" role="status">{round.state === 'upcoming' ? `${round.name} hasn’t opened yet` : `${round.name} has closed`}, so scores can’t be saved.</p>}
        <ScoreForm
          key={round.id}
          roundId={round.id}
          teamId={team.id}
          criteria={criteria.map((c) => ({ id: c.id, name: c.name, description: c.description, max: c.max_score, weight: c.weight }))}
          saved={scores}
          notes={saved[0]?.notes ?? ''}
          disabled={!open}
        />
      </section>
    </>
  );
}
