import { sql } from '../../../lib/db.js';
import { toISTInput } from '../../../lib/event.js';
import { getCriteria, getRounds, pickRound, SCOPE_LABEL } from '../../../lib/judge.js';
import {
  addCriterion, addJudge, addRound, copyAssignments, deleteRound, removeJudge, saveCriterion, saveRound, setJudgeVenue,
} from '../actions.js';
import RoundTabs from '../RoundTabs.jsx';

export const dynamic = 'force-dynamic';

// Judging setup: rounds (when, which teams), judges and their venues per round, and the shared criteria.
export default async function AdminJudges({ searchParams }) {
  const { msg, round: requested } = await searchParams;
  const rounds = await getRounds();
  const round = pickRound(rounds, requested);
  const [judges, links, rooms, criteria, scored] = await Promise.all([
    sql`select u.id, u.name, u.email from users u where u.role = 'judge' order by u.name`,
    round ? sql`select jv.judge_id, r.id, r.name from judge_venues jv join rooms r on r.id = jv.room_id where jv.round_id = ${round.id} order by r.name` : [],
    sql`select id, name from rooms order by name`,
    getCriteria({ all: true }),
    sql`select round_id, judge_id, count(*)::int as n from evaluations group by round_id, judge_id`,
  ]);
  const active = criteria.filter((c) => c.active);
  const weights = active.reduce((a, c) => a + c.weight, 0);
  const roundScores = (id) => scored.filter((s) => s.round_id === id).reduce((a, s) => a + s.n, 0);
  const judgeScores = (judgeId) => (round ? scored.find((s) => s.round_id === round.id && s.judge_id === judgeId)?.n ?? 0 : 0);
  const perVenue = rooms.map((r) => ({ name: r.name, n: links.filter((l) => l.id === r.id).length }));
  const others = rounds.filter((r) => r.id !== round?.id);

  return (
    <>
      <div className="admin-top">
        <h1>Judging setup</h1>
        <p className="admin-sub">Create a round for each judging session, choose which teams it covers, then assign judges to venues for that round. Judges sign in at /login with their own email.</p>
      </div>
      {msg ? <p className="admin-msg" role="status">{msg}</p> : null}

      <section className="admin-panel">
        <h2>Rounds</h2>
        <p className="admin-sub">Each round has its own dates, judges and results. Scores can only be saved while a round is open. All times IST.</p>
        <div className="admin-table-wrap">
          <table className="admin-table admin-criteria">
            <thead><tr><th>Name</th><th>Teams</th><th>Opens</th><th>Closes</th><th>Scores</th><th /></tr></thead>
            <tbody>
              {rounds.map((r) => (
                <tr key={r.id}>
                  <RoundCells r={r} scores={roundScores(r.id)} />
                </tr>
              ))}
              <tr><RoundCells /></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <h2>Judges {round ? <span className="admin-count">for {round.name}</span> : null}</h2>
        {rounds.length > 1 ? <RoundTabs rounds={rounds} current={round} base="/admin/judges" /> : null}
        <div className="admin-actions admin-split">
          <form action={addJudge} className="admin-inline">
            <input type="email" name="email" placeholder="judge@example.com" aria-label="Judge’s sign-in email" required size={28} />
            <button className="admin-btn admin-btn-primary" type="submit">Add judge</button>
          </form>
          {round && others.length ? (
            <form action={copyAssignments} className="admin-inline">
              <input type="hidden" name="roundId" value={round.id} />
              <select name="fromRound" aria-label="Round to copy from" required defaultValue="">
                <option value="" disabled>Copy venues from…</option>
                {others.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button className="admin-btn" type="submit">Copy</button>
            </form>
          ) : null}
        </div>
        <p className="admin-sub">Judges must sign in once before you add them. Venues below apply to {round ? <strong>{round.name}</strong> : 'the selected round'} only.</p>
        {!round ? <p className="admin-msg">Create a round above before assigning venues.</p> : null}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Judge</th><th>Venues {round ? `in ${round.name}` : ''}</th><th>Scored</th><th>Actions</th></tr></thead>
            <tbody>
              {judges.map((j) => {
                const mine = links.filter((l) => l.judge_id === j.id);
                const free = rooms.filter((r) => !mine.some((m) => m.id === r.id));
                return (
                  <tr key={j.id}>
                    <td><strong>{j.name}</strong><br /><a href={`mailto:${j.email}`}>{j.email}</a></td>
                    <td>
                      {round ? (
                        <div className="admin-actions">
                          {mine.map((m) => (
                            <form key={m.id} action={setJudgeVenue} className="admin-chip">
                              <input type="hidden" name="judgeId" value={j.id} />
                              <input type="hidden" name="roomId" value={m.id} />
                              <input type="hidden" name="roundId" value={round.id} />
                              <input type="hidden" name="op" value="remove" />
                              {m.name}
                              <button type="submit" aria-label={`Remove ${m.name} from ${j.name}`} title="Remove">×</button>
                            </form>
                          ))}
                          {free.length ? (
                            <form action={setJudgeVenue} className="admin-inline">
                              <input type="hidden" name="judgeId" value={j.id} />
                              <input type="hidden" name="roundId" value={round.id} />
                              <select name="roomId" aria-label={`Add a venue for ${j.name}`} required defaultValue="">
                                <option value="" disabled>Add venue</option>
                                {free.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                              </select>
                              <button className="admin-btn" type="submit">Add</button>
                            </form>
                          ) : null}
                          {!mine.length && !free.length ? <span className="admin-sub">Add venues first.</span> : null}
                        </div>
                      ) : '—'}
                    </td>
                    <td>{judgeScores(j.id)}</td>
                    <td>
                      <form action={removeJudge}>
                        <input type="hidden" name="judgeId" value={j.id} />
                        <button className="admin-btn" type="submit">Remove judge</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {judges.length === 0 ? <tr><td colSpan={4}>No judges yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {round && rooms.length ? <p className="admin-sub">Judges per venue in {round.name}: {perVenue.map((v) => `${v.name}: ${v.n}`).join(' · ')}</p> : null}
      </section>

      <section className="admin-panel">
        <h2>Criteria <span className="admin-count">used in every round</span></h2>
        <p className="admin-sub">
          A judge’s total = each score as a share of its maximum, weighted, out of 100. A team’s result in a round = the average of that round’s judges’ totals.
          {active.length ? ` Current weights: ${active.map((c) => `${c.name} ${Math.round((c.weight / weights) * 100)}%`).join(', ')}.` : ''}
          {' '}Turn a criterion off instead of deleting it; changing weights updates every total straight away.
        </p>
        <div className="admin-table-wrap">
          <table className="admin-table admin-criteria">
            <thead><tr><th>Order</th><th>Name</th><th>What judges look for</th><th>Max</th><th>Weight</th><th>On</th><th /></tr></thead>
            <tbody>
              {criteria.map((c) => <tr key={c.id}><CriterionCells c={c} /></tr>)}
              <tr><CriterionCells /></tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// One editable round row. Without `r` it's the "create a round" row. Inputs join the row's form via form=.
function RoundCells({ r, scores = 0 }) {
  const formId = r ? `round-${r.id}` : 'round-new';
  return (
    <>
      <td>
        <form id={formId} action={r ? saveRound : addRound}>{r ? <input type="hidden" name="id" value={r.id} /> : null}</form>
        <input form={formId} name="name" defaultValue={r?.name ?? ''} placeholder={r ? '' : 'e.g. Day 3 finals'} aria-label="Round name" required maxLength={60} />
      </td>
      <td>
        <select form={formId} name="scope" defaultValue={r?.scope ?? 'all'} aria-label="Teams in this round">
          {Object.entries(SCOPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </td>
      <td><input form={formId} type="datetime-local" name="startsAt" defaultValue={toISTInput(r?.startsAt)} aria-label="Opens" required /></td>
      <td><input form={formId} type="datetime-local" name="endsAt" defaultValue={toISTInput(r?.endsAt)} aria-label="Closes" required /></td>
      <td>{r ? scores : ''}</td>
      <td>
        <div className="admin-actions">
          <button form={formId} className={r ? 'admin-btn' : 'admin-btn admin-btn-primary'} type="submit">{r ? 'Save' : 'Create round'}</button>
          {r && !scores ? (
            <form action={deleteRound}>
              <input type="hidden" name="id" value={r.id} />
              <button className="admin-btn" type="submit">Delete</button>
            </form>
          ) : null}
        </div>
      </td>
    </>
  );
}

// One editable criterion row. Without `c` it's the "add a criterion" row.
function CriterionCells({ c }) {
  const formId = c ? `crit-${c.id}` : 'crit-new';
  return (
    <>
      <td>
        <form id={formId} action={c ? saveCriterion : addCriterion}>{c ? <input type="hidden" name="id" value={c.id} /> : null}</form>
        <input form={formId} type="number" name="position" min="0" step="1" defaultValue={c?.position ?? 9} aria-label="Order" className="admin-num" />
      </td>
      <td><input form={formId} name="name" defaultValue={c?.name ?? ''} placeholder={c ? '' : 'New criterion'} aria-label="Name" required maxLength={60} /></td>
      <td><input form={formId} name="description" defaultValue={c?.description ?? ''} aria-label="Description" maxLength={300} size={30} /></td>
      <td><input form={formId} type="number" name="maxScore" min="1" max="100" step="1" defaultValue={c?.max_score ?? 10} aria-label="Maximum score" className="admin-num" /></td>
      <td><input form={formId} type="number" name="weight" min="0.1" step="0.1" defaultValue={c?.weight ?? 1} aria-label="Weight" className="admin-num" /></td>
      <td>{c ? <input form={formId} type="checkbox" name="active" defaultChecked={c.active} aria-label="Active" /> : null}</td>
      <td><button form={formId} className={c ? 'admin-btn' : 'admin-btn admin-btn-primary'} type="submit">{c ? 'Save' : 'Add'}</button></td>
    </>
  );
}
