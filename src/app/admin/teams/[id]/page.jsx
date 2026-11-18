import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PeanutAmount } from '../../../../design-system/components.jsx';
import { sql } from '../../../../lib/db.js';
import { formatDateTime, getSettings } from '../../../../lib/event.js';
import { assignVenue, markPaid, setReview, withdrawTeam } from '../../actions.js';
import { STAGE_LABEL } from '../../labels.js';
import { checkDriveLink } from '../../../../lib/drive.js';
import { getCriteria } from '../../../../lib/judge.js';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const when = (d) => (d ? formatDateTime(new Date(d)) : '—');

// One team, everything an organiser needs: contacts, members, Peanuts, investments both ways, payments.
export default async function AdminTeam({ params, searchParams }) {
  const { id } = await params;
  const { msg } = await searchParams;
  if (!UUID.test(id)) notFound();

  const [team] = await sql`
    select t.*, r.name as room, b.balance, u.email as login_email, u.name as login_name
    from teams t
    left join rooms r on r.id = t.room_id
    join team_balances b on b.team_id = t.id
    left join team_members lm on lm.team_id = t.id and lm.position = 1
    left join users u on u.id = lm.user_id
    where t.id = ${id}`;
  if (!team) notFound();

  const [members, made, received, payments, rooms, settings, pitching] = await Promise.all([
    sql`select position, name, ra_number, college_email, phone, faculty_advisor, faculty_email from team_members where team_id = ${id} order by position`,
    sql`
      select i.investee_team_id as team_id, t.name, sum(i.amount)::bigint as total, count(*)::int as times, max(i.created_at) as last_at
      from investments i join teams t on t.id = i.investee_team_id
      where i.investor_team_id = ${id} group by i.investee_team_id, t.name order by total desc`,
    sql`
      select i.investor_team_id as team_id, t.name, sum(i.amount)::bigint as total, count(*)::int as times, max(i.created_at) as last_at
      from investments i join teams t on t.id = i.investor_team_id
      where i.investee_team_id = ${id} group by i.investor_team_id, t.name order by total desc`,
    sql`select razorpay_payment_id, amount_paise, state, note, received_at from payments where team_id = ${id} order by received_at`,
    sql`select id, name from rooms order by name`,
    getSettings(),
    sql`select r.name from pitches p join rooms r on r.id = p.room_id where p.team_id = ${id} and p.ended_at is null`,
  ]);
  const [criteria, judging, marks] = await Promise.all([
    getCriteria(),
    sql`
      select e.id, e.round_id, jr.name as round, u.name as judge, et.total, et.complete, e.notes, e.updated_at
      from evaluations e join users u on u.id = e.judge_id join judging_rounds jr on jr.id = e.round_id
      left join evaluation_totals et on et.evaluation_id = e.id
      where e.team_id = ${id} order by jr.starts_at, jr.position, u.name`,
    sql`select s.evaluation_id, s.criterion_id, s.score from evaluation_scores s join evaluations e on e.id = s.evaluation_id where e.team_id = ${id}`,
  ]);
  const mark = (evalId, critId) => marks.find((m) => m.evaluation_id === evalId && m.criterion_id === critId)?.score;
  // Average per round (rounds are ranked separately).
  const roundAvgs = [...new Map(judging.map((j) => [j.round_id, j.round])).entries()].map(([roundId, name]) => {
    const t = judging.filter((j) => j.round_id === roundId && j.total != null);
    return { name, n: t.length, avg: t.length ? Math.round((t.reduce((a, j) => a + Number(j.total), 0) / t.length) * 100) / 100 : null };
  });
  const leader = members.find((m) => m.position === 1);
  // Checked live with Google Drive each time this page loads.
  const videoAccess = team.pitch_video_url ? await checkDriveLink(team.pitch_video_url) : null;
  const invested = made.reduce((a, r) => a + Number(r.total), 0);
  const raised = received.reduce((a, r) => a + Number(r.total), 0);
  const here = `/admin/teams/${id}`;

  return (
    <>
      <div className="admin-top">
        <p className="admin-sub"><Link href="/admin/teams">← All teams</Link></p>
        <h1>{team.name}</h1>
        <p className="admin-sub">
          {STAGE_LABEL[team.stage]} · code <code>{team.team_code}</code> · {team.room ? `venue ${team.room}` : 'no venue'}
          {pitching.length ? ` · pitching now in ${pitching[0].name}` : ''} · registered {when(team.created_at)}
        </p>
      </div>
      {msg ? <p className="admin-msg" role="status">{msg}</p> : null}

      <div className="admin-stats">
        <div className="admin-panel"><p className="admin-sub">Peanuts now</p><PeanutAmount value={Number(team.balance)} size="md" /></div>
        <div className="admin-panel"><p className="admin-sub">Invested in others</p><PeanutAmount value={invested} size="md" /><p className="admin-sub">of {settings.budgetMax.toLocaleString('en-US')} budget · {made.length} teams</p></div>
        <div className="admin-panel"><p className="admin-sub">Raised from others</p><PeanutAmount value={raised} size="md" /><p className="admin-sub">from {received.length} teams</p></div>
      </div>

      <div className="admin-grid admin-grid-wide">
        <section className="admin-panel">
          <h2>Leader</h2>
          <dl className="admin-dl">
            <dt>Name</dt><dd>{leader?.name ?? '—'}</dd>
            <dt>Phone</dt><dd>{leader?.phone ? <a href={`tel:+91${leader.phone}`}>{leader.phone}</a> : '—'}</dd>
            <dt>Login email</dt><dd>{team.login_email ? <a href={`mailto:${team.login_email}`}>{team.login_email}</a> : '—'}</dd>
            <dt>College email</dt><dd>{leader ? <a href={`mailto:${leader.college_email}`}>{leader.college_email}</a> : '—'}</dd>
            <dt>RA number</dt><dd>{leader?.ra_number ?? '—'}</dd>
          </dl>
        </section>

        <section className="admin-panel">
          <h2>Status</h2>
          <dl className="admin-dl">
            <dt>Pitch video</dt><dd>{team.pitch_video_url ? <><a href={team.pitch_video_url} target="_blank" rel="noopener noreferrer">Watch</a> · {when(team.pitch_submitted_at)} <VideoAccess access={videoAccess} /></> : 'Not submitted'}</dd>
            <dt>Reviewed</dt><dd>{when(team.reviewed_at)}</dd>
            <dt>Paid</dt><dd>{team.fee_paid_at ? `${when(team.fee_paid_at)} · ${team.payment_ref}` : 'No'}</dd>
          </dl>
          <div className="admin-actions">
            {['in_review', 'shortlisted', 'not_shortlisted'].includes(team.stage) && team.pitch_submitted_at ? (
              <>
                {team.stage !== 'shortlisted' ? <Act action={setReview} teamId={id} from={here} extra={{ to: 'shortlisted' }} primary>Shortlist</Act> : null}
                {team.stage !== 'not_shortlisted' ? <Act action={setReview} teamId={id} from={here} extra={{ to: 'not_shortlisted' }}>Not shortlisted</Act> : null}
                {team.stage !== 'in_review' ? <Act action={setReview} teamId={id} from={here} extra={{ to: 'in_review' }}>Undo</Act> : null}
              </>
            ) : null}
            {team.stage === 'shortlisted' ? (
              <form action={markPaid} className="admin-inline">
                <input type="hidden" name="teamId" value={id} />
                <input type="hidden" name="from" value={here} />
                <input name="ref" placeholder="Payment ref" aria-label="Payment reference" size={12} required />
                <button className="admin-btn" type="submit">Mark paid</button>
              </form>
            ) : null}
            {['paid', 'finalist', 'winner'].includes(team.stage) ? (
              <form action={assignVenue} className="admin-inline">
                <input type="hidden" name="teamId" value={id} />
                <input type="hidden" name="from" value={here} />
                <select name="roomId" aria-label="Venue" defaultValue={team.room_id ?? ''}>
                  <option value="">No venue</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <button className="admin-btn" type="submit">Set venue</button>
              </form>
            ) : null}
            {!['withdrawn', 'disqualified'].includes(team.stage) ? <Act action={withdrawTeam} teamId={id} from={here}>Withdraw</Act> : null}
          </div>
        </section>
      </div>

      <section className="admin-panel">
        <h2>Members ({members.length})</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>#</th><th>Name</th><th>RA number</th><th>College email</th><th>Phone</th><th>Faculty advisor</th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.position}>
                  <td>{m.position}{m.position === 1 ? ' (leader)' : ''}</td>
                  <td>{m.name}</td>
                  <td>{m.ra_number}</td>
                  <td><a href={`mailto:${m.college_email}`}>{m.college_email}</a></td>
                  <td>{m.phone ? <a href={`tel:+91${m.phone}`}>{m.phone}</a> : '—'}</td>
                  <td>{m.faculty_advisor ?? '—'}{m.faculty_email ? <><br /><small>{m.faculty_email}</small></> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="admin-grid admin-grid-wide">
        <InvestTable title="Invested in" rows={made} total={invested} empty="This team hasn’t invested yet." />
        <InvestTable title="Investors" rows={received} total={raised} empty="No team has invested in this team yet." />
      </div>

      <section className="admin-panel">
        <h2>Judging {roundAvgs.map((r) => <span key={r.name} className="admin-count">{r.name}: {r.avg ?? '—'} / 100 ({r.n} judge{r.n === 1 ? '' : 's'})</span>)}</h2>
        {judging.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Round</th><th>Judge</th>{criteria.map((c) => <th key={c.id}>{c.name} <small>/{c.max_score}</small></th>)}<th>Total</th><th>Notes</th></tr></thead>
              <tbody>
                {judging.map((j) => (
                  <tr key={j.id}>
                    <td>{j.round}</td>
                    <td><strong>{j.judge}</strong><br /><small>{when(j.updated_at)}</small></td>
                    {criteria.map((c) => <td key={c.id}>{mark(j.id, c.id) == null ? '—' : Number(mark(j.id, c.id))}</td>)}
                    <td><strong>{j.total == null ? '—' : Number(j.total)}</strong>{j.total != null && !j.complete ? <><br /><small>incomplete</small></> : null}</td>
                    <td>{j.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="admin-sub">No judge has scored this team yet.</p>}
      </section>

      {payments.length ? (
        <section className="admin-panel">
          <h2>Payments</h2>
          <ul className="admin-list">
            {payments.map((p) => (
              <li key={p.razorpay_payment_id}><code>{p.razorpay_payment_id}</code> · ₹{p.amount_paise / 100} · {p.state} · {when(p.received_at)}{p.note ? ` · ${p.note}` : ''}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function InvestTable({ title, rows, total, empty }) {
  return (
    <section className="admin-panel">
      <h2>{title}</h2>
      {rows.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Team</th><th>Peanuts</th><th>Times</th><th>Last</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.team_id}>
                  <td><Link href={`/admin/teams/${r.team_id}`}>{r.name}</Link></td>
                  <td><PeanutAmount value={Number(r.total)} size="sm" /></td>
                  <td>{r.times}</td>
                  <td>{formatDateTime(new Date(r.last_at))}</td>
                </tr>
              ))}
              <tr><td><strong>Total</strong></td><td><PeanutAmount value={total} size="sm" /></td><td colSpan={2} /></tr>
            </tbody>
          </table>
        </div>
      ) : <p className="admin-sub">{empty}</p>}
    </section>
  );
}

function Act({ action, teamId, from, extra = {}, primary, children }) {
  return (
    <form action={action}>
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="from" value={from} />
      {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className={primary ? 'admin-btn admin-btn-primary' : 'admin-btn'} type="submit">{children}</button>
    </form>
  );
}

const ACCESS = {
  public: ['is-open', 'Public'],
  private: ['is-bad', 'Not public'],
  missing: ['is-bad', 'Not found'],
  invalid: ['is-bad', 'Not a file link'],
  unknown: ['is-upcoming', 'Couldn’t check'],
};
function VideoAccess({ access }) {
  const [cls, label] = ACCESS[access] ?? ACCESS.unknown;
  return <span className={`admin-state ${cls}`} title="Checked with Google Drive just now">{label}</span>;
}
