import Link from 'next/link';
import { sql } from '../../../lib/db.js';
import { formatDateTime } from '../../../lib/event.js';
import { assignVenue, autoAssignVenues, createVenue, endPitch, startPitch } from '../actions.js';

export const dynamic = 'force-dynamic';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default async function AdminVenues({ searchParams }) {
  const { msg } = await searchParams;
  const rooms = await sql`
    select r.id, r.name, p.started_at, pt.name as pitching, pt.id as pitching_id
    from rooms r
    left join pitches p on p.room_id = r.id and p.ended_at is null
    left join teams pt on pt.id = p.team_id
    order by r.name`;
  const teams = await sql`
    select id, name, room_id from teams where stage in ('paid', 'finalist', 'winner') order by name`;
  const unassigned = teams.filter((t) => !t.room_id);
  const anyPitching = rooms.some((r) => r.pitching);

  return (
    <>
      <div className="admin-top">
        <h1>Venues</h1>
        <p className="admin-sub">Assign paid teams to venues by hand or divide them automatically, then start each team’s pitch. While a team pitches, the other teams in its venue can invest in it.</p>
      </div>
      {msg ? <p className="admin-msg" role="status">{msg}</p> : null}

      {/* One toolbar: add a venue on the left, divide teams on the right. */}
      <section className="admin-panel admin-toolbar">
        <div className="admin-toolbar-group">
          <h2>Add a venue</h2>
          <form action={createVenue} className="admin-inline">
            <input name="name" placeholder="e.g. TP 401" aria-label="Venue name" required maxLength={40} />
            <button className="admin-btn admin-btn-primary" type="submit">Add venue</button>
          </form>
        </div>
        <div className="admin-toolbar-group">
          <h2>Divide teams equally</h2>
          <div className="admin-actions">
            <form action={autoAssignVenues}>
              <input type="hidden" name="mode" value="unassigned" />
              <button className="admin-btn admin-btn-primary" type="submit" disabled={!unassigned.length || !rooms.length} title="Keeps current venues and fills the emptiest first">Place unassigned teams</button>
            </form>
            <form action={autoAssignVenues}>
              <input type="hidden" name="mode" value="all" />
              <button className="admin-btn" type="submit" disabled={!teams.length || !rooms.length || anyPitching} title={anyPitching ? 'End every pitch first' : 'Moves every paid team at random into equal venues'}>Reshuffle all teams</button>
            </form>
          </div>
        </div>
        <dl className="admin-toolbar-stats">
          <div><dt>Venues</dt><dd>{rooms.length}</dd></div>
          <div><dt>Paid teams</dt><dd>{teams.length}</dd></div>
          <div><dt>Without a venue</dt><dd>{unassigned.length}</dd></div>
          <div><dt>Pitching now</dt><dd>{rooms.filter((r) => r.pitching).length}</dd></div>
        </dl>
      </section>

      {unassigned.length ? (
        <section className="admin-panel">
          <h2>Without a venue <span className="admin-count">{plural(unassigned.length, 'team')}</span></h2>
          <ul className="admin-team-grid">
            {unassigned.map((t) => (
              <li key={t.id}>
                <Link href={`/admin/teams/${t.id}`}>{t.name}</Link>
                <MoveForm team={t} rooms={rooms} label="Assign" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rooms.length === 0 ? (
        <section className="admin-panel"><p className="admin-sub">No venues yet. Add one above.</p></section>
      ) : (
        <div className="admin-venues">
          {rooms.map((r) => {
            const here = teams.filter((t) => t.room_id === r.id);
            return (
              <section key={r.id} className="admin-panel admin-venue">
                <header className="admin-venue-head">
                  <h2>{r.name}</h2>
                  <span className="admin-count">{plural(here.length, 'team')}</span>
                </header>

                <div className={r.pitching ? 'admin-stage is-live' : 'admin-stage'}>
                  <p className="admin-stage-label">{r.pitching ? 'Pitching now' : 'No one pitching'}</p>
                  {r.pitching ? (
                    <p className="admin-pitching">
                      <Link href={`/admin/teams/${r.pitching_id}`}>{r.pitching}</Link>
                      <span className="admin-sub"> since {formatDateTime(new Date(r.started_at))}</span>
                    </p>
                  ) : null}
                  <div className="admin-actions">
                    <form action={startPitch} className="admin-inline">
                      <input type="hidden" name="roomId" value={r.id} />
                      <select name="teamId" aria-label={`Team to pitch in ${r.name}`} required defaultValue="" disabled={!here.length}>
                        <option value="" disabled>{here.length ? 'Choose a team' : 'No teams here'}</option>
                        {here.filter((t) => t.id !== r.pitching_id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <button className="admin-btn admin-btn-primary" type="submit" disabled={!here.length}>{r.pitching ? 'Next pitch' : 'Start pitch'}</button>
                    </form>
                    {r.pitching ? (
                      <form action={endPitch}>
                        <input type="hidden" name="roomId" value={r.id} />
                        <button className="admin-btn" type="submit">End pitch</button>
                      </form>
                    ) : null}
                  </div>
                </div>

                <ul className="admin-team-list">
                  {here.map((t) => (
                    <li key={t.id}>
                      <Link href={`/admin/teams/${t.id}`}>{t.name}</Link>
                      <MoveForm team={t} rooms={rooms} label="Move" />
                    </li>
                  ))}
                  {here.length === 0 ? <li className="admin-sub">No teams yet. Assign teams above or use “Place unassigned teams”.</li> : null}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

// Pick a venue (or "No venue") for one team.
function MoveForm({ team, rooms, label }) {
  return (
    <form action={assignVenue} className="admin-inline">
      <input type="hidden" name="teamId" value={team.id} />
      <select name="roomId" aria-label={`Venue for ${team.name}`} defaultValue={team.room_id ?? ''}>
        <option value="">No venue</option>
        {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <button className="admin-btn" type="submit">{label}</button>
    </form>
  );
}
