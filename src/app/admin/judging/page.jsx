import Link from 'next/link';
import { sql } from '../../../lib/db.js';
import { formatDateTime } from '../../../lib/event.js';
import { getCriteria, getRounds, pickRound, ROUND_STAGES, SCOPE_LABEL } from '../../../lib/judge.js';
import RoundTabs from '../RoundTabs.jsx';

export const dynamic = 'force-dynamic';

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }));

// Results for one round (?round=), by venue: each team's average per criterion and overall, ranked.
// Rounds are ranked separately: e.g. use Day 2 to pick finalists, Day 3 to pick winners.
export default async function AdminJudging({ searchParams }) {
  const { round: requested } = await searchParams;
  const rounds = await getRounds();
  const round = pickRound(rounds, requested);
  if (!round) {
    return (
      <>
        <div className="admin-top"><h1>Judging results</h1></div>
        <section className="admin-panel"><p className="admin-sub">No judging rounds yet. Create one in <Link href="/admin/judges">Judging setup</Link>.</p></section>
      </>
    );
  }

  const [criteria, rooms, teams, perCriterion] = await Promise.all([
    getCriteria(),
    sql`
      select r.id, r.name, coalesce(string_agg(u.name, ', ' order by u.name), '') as judges, count(u.id)::int as judge_count
      from rooms r left join judge_venues jv on jv.room_id = r.id and jv.round_id = ${round.id} left join users u on u.id = jv.judge_id
      group by r.id order by r.name`,
    sql`
      select t.id, t.name, t.room_id, j.avg_score, coalesce(j.judges, 0) as judges, coalesce(j.complete, false) as complete
      from teams t left join team_judging j on j.team_id = t.id and j.round_id = ${round.id}
      where t.stage::text = any(${ROUND_STAGES[round.scope]}) and t.room_id is not null`,
    sql`select team_id, criterion_id, avg_score from criterion_averages where round_id = ${round.id}`,
  ]);
  const avg = (teamId, critId) => perCriterion.find((p) => p.team_id === teamId && p.criterion_id === critId)?.avg_score;
  const shown = rooms.filter((r) => r.judge_count || teams.some((t) => t.room_id === r.id));

  return (
    <>
      <div className="admin-top">
        <h1>Judging results</h1>
        <RoundTabs rounds={rounds} current={round} base="/admin/judging" />
        <p className="admin-sub"><strong>{round.name}</strong> · {SCOPE_LABEL[round.scope]} · {formatDateTime(round.startsAt)} → {formatDateTime(round.endsAt)}. Score = average of this round’s judges’ totals (out of 100). Click a team for each judge’s marks and notes.</p>
      </div>
      {shown.length === 0 ? <section className="admin-panel"><p className="admin-sub">No venues have judges or teams in this round yet.</p></section> : null}
      {shown.map((r) => {
        const here = teams
          .filter((t) => t.room_id === r.id)
          .sort((a, b) => (a.avg_score == null) - (b.avg_score == null) || Number(b.avg_score) - Number(a.avg_score) || a.name.localeCompare(b.name));
        let rank = 0;
        return (
          <section key={r.id} className="admin-panel">
            <h2>{r.name} <span className="admin-count">{here.length} teams · {r.judge_count} judges{r.judges ? `: ${r.judges}` : ''}</span></h2>
            {here.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Team</th>
                      {criteria.map((c) => <th key={c.id} title={c.description ?? ''}>{c.name} <small>/{c.max_score}</small></th>)}
                      <th>Score /100</th><th>Judged by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {here.map((t) => (
                      <tr key={t.id}>
                        <td>{t.avg_score == null ? '—' : ++rank}</td>
                        <td><Link href={`/admin/teams/${t.id}`}><strong>{t.name}</strong></Link></td>
                        {criteria.map((c) => <td key={c.id}>{fmt(avg(t.id, c.id))}</td>)}
                        <td><strong>{fmt(t.avg_score)}</strong>{t.judges && !t.complete ? <><br /><small>incomplete</small></> : null}</td>
                        <td>{t.judges} of {r.judge_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="admin-sub">No {round.scope === 'finalists' ? 'finalists' : 'competing teams'} in this venue.</p>}
          </section>
        );
      })}
    </>
  );
}
