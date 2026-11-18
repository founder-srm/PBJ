import Link from 'next/link';
import { sql } from '../../../lib/db.js';
import { formatDateTime } from '../../../lib/event.js';
import { STAGES } from '../../../lib/stage.js';
import { PeanutAmount } from '../../../design-system/components.jsx';
import { checkVideoLinks, markPaid, setReview, withdrawTeam } from '../actions.js';
import { STAGE_LABEL as LABEL } from '../labels.js';

export const dynamic = 'force-dynamic';


export default async function AdminTeams({ searchParams }) {
  const { stage: want, msg } = await searchParams;
  const stage = STAGES.includes(want) ? want : null;
  const here = stage ? `/admin/teams?stage=${stage}` : '/admin/teams';

  const counts = await sql`select stage, count(*)::int as n from teams group by stage`;
  const count = Object.fromEntries(counts.map((c) => [c.stage, c.n]));
  const total = counts.reduce((a, c) => a + c.n, 0);
  const teams = await sql`
    select t.id, t.name, t.team_code, t.stage, t.size, t.pitch_video_url, t.pitch_submitted_at, t.payment_ref, r.name as room, b.balance,
      m.name as leader, m.phone
    from teams t
    left join rooms r on r.id = t.room_id
    join team_balances b on b.team_id = t.id
    left join team_members m on m.team_id = t.id and m.position = 1
    where ${stage}::team_stage is null or t.stage = ${stage}::team_stage
    order by t.pitch_submitted_at nulls last, t.created_at`;

  return (
    <>
      <div className="admin-top">
        <h1>Teams</h1>
        <p className="admin-sub">Review pitch videos and shortlist. Click a team for its contacts, Peanuts and investments. Teams only see the result from the results date (Schedule).</p>
      </div>
      {msg ? <p className="admin-msg" role="status">{msg}</p> : null}
      <section className="admin-panel">
        <div className="admin-actions admin-split">
          <p className="admin-sub">Video links are checked with Google Drive when teams submit. Teams can change sharing later, so check again before judging.</p>
          <form action={checkVideoLinks}>
            <input type="hidden" name="from" value={here} />
            <button className="admin-btn" type="submit">Check video links</button>
          </form>
        </div>
        <nav className="admin-filters" aria-label="Filter by stage">
          <Link href="/admin/teams" aria-current={!stage ? 'page' : undefined}>All ({total})</Link>
          {STAGES.map((s) => (
            <Link key={s} href={`/admin/teams?stage=${s}`} aria-current={stage === s ? 'page' : undefined}>{LABEL[s]} ({count[s] ?? 0})</Link>
          ))}
        </nav>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Team</th><th>Code</th><th>Stage</th><th>Video</th><th>Venue</th><th>Peanuts</th><th>Actions</th></tr></thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id}>
                  <td><Link href={`/admin/teams/${t.id}`}><strong>{t.name}</strong></Link><br />{t.leader}{t.phone ? ` · ${t.phone}` : ''} · {t.size} members</td>
                  <td><code>{t.team_code}</code></td>
                  <td>{LABEL[t.stage]}{t.payment_ref ? <><br /><small>{t.payment_ref}</small></> : null}</td>
                  <td>{t.pitch_video_url ? <><a href={t.pitch_video_url} target="_blank" rel="noopener noreferrer">Watch</a><br /><small>{formatDateTime(new Date(t.pitch_submitted_at))}</small></> : '—'}</td>
                  <td>{t.room ?? '—'}</td>
                  <td><PeanutAmount value={Number(t.balance)} size="sm" /></td>
                  <td>
                    <div className="admin-actions">
                      {['in_review', 'shortlisted', 'not_shortlisted'].includes(t.stage) && t.pitch_submitted_at ? (
                        <>
                          {t.stage !== 'shortlisted' ? <ActionButton action={setReview} teamId={t.id} from={here} extra={{ to: 'shortlisted' }} primary>Shortlist</ActionButton> : null}
                          {t.stage !== 'not_shortlisted' ? <ActionButton action={setReview} teamId={t.id} from={here} extra={{ to: 'not_shortlisted' }}>Not shortlisted</ActionButton> : null}
                          {t.stage !== 'in_review' ? <ActionButton action={setReview} teamId={t.id} from={here} extra={{ to: 'in_review' }}>Undo</ActionButton> : null}
                        </>
                      ) : null}
                      {t.stage === 'shortlisted' ? (
                        <form action={markPaid} className="admin-inline">
                          <input type="hidden" name="teamId" value={t.id} />
                          <input type="hidden" name="from" value={here} />
                          <input name="ref" placeholder="Payment ref" aria-label={`Payment reference for ${t.name}`} size={12} required />
                          <button className="admin-btn" type="submit">Mark paid</button>
                        </form>
                      ) : null}
                      {!['withdrawn', 'disqualified'].includes(t.stage) ? <ActionButton action={withdrawTeam} teamId={t.id} from={here}>Withdraw</ActionButton> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {teams.length === 0 ? <tr><td colSpan={7}>No teams here.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ActionButton({ action, teamId, from, extra = {}, primary, children }) {
  return (
    <form action={action}>
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="from" value={from} />
      {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className={primary ? 'admin-btn admin-btn-primary' : 'admin-btn'} type="submit">{children}</button>
    </form>
  );
}
