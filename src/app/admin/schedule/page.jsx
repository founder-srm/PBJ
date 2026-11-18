import Link from 'next/link';
import { sql } from '../../../lib/db.js';
import { formatDateTime, getSettings, toISTInput } from '../../../lib/event.js';
import { windowState } from '../../../lib/stage.js';
import { saveSchedule, saveSettings } from '../actions.js';

export const dynamic = 'force-dynamic';

const ORDER = ['registration', 'pitch_video', 'results', 'payment', 'event'];
const HELP = {
  registration: 'Teams can register between these times.',
  pitch_video: 'Teams can submit and change their video link until it closes.',
  results: 'Shortlist results become visible to teams from this time.',
  payment: 'Shortlisted teams see the payment link in this window.',
  event: 'Investing is open only while the event runs. The countdown counts to the start.',
};
const STATE = { open: 'Open now', upcoming: 'Upcoming', closed: 'Closed' };

export default async function AdminSchedule({ searchParams }) {
  const { msg } = await searchParams;
  const rows = await sql`select key, label, starts_at, ends_at from event_schedule`;
  const steps = ORDER.map((k) => rows.find((r) => r.key === k)).filter(Boolean);
  const s = await getSettings();

  return (
    <>
      <div className="admin-top">
        <h1>Schedule</h1>
        <p className="admin-sub">All times are IST. Changes apply to every team straight away. Judging rounds have their own dates in <Link href="/admin/judges">Judging setup</Link>.</p>
      </div>
      {msg ? <p className="admin-msg" role="status">{msg}</p> : null}

      <section className="admin-panel">
        <h2>Dates</h2>
        <ol className="admin-steps">
          {steps.map((r, i) => {
            const w = { startsAt: new Date(r.starts_at), endsAt: r.ends_at ? new Date(r.ends_at) : null };
            const state = r.key === 'results' ? (new Date() >= w.startsAt ? 'open' : 'upcoming') : windowState(w);
            return (
              <li key={r.key} className="admin-step">
                <div className="admin-step-info">
                  <span className="admin-step-num" aria-hidden="true">{i + 1}</span>
                  <div>
                    <p className="admin-step-title">{r.label} <span className={`admin-state is-${state}`}>{r.key === 'results' && state === 'open' ? 'Visible' : STATE[state]}</span></p>
                    <p className="admin-sub">{HELP[r.key]}</p>
                    <p className="admin-step-when">{formatDateTime(w.startsAt)}{w.endsAt ? ` → ${formatDateTime(w.endsAt)}` : ''}</p>
                  </div>
                </div>
                <form action={saveSchedule} className="admin-step-form">
                  <input type="hidden" name="key" value={r.key} />
                  <label className="admin-field">{r.key === 'results' ? 'Visible from' : 'Opens'}
                    <input type="datetime-local" name="startsAt" defaultValue={toISTInput(r.starts_at)} required />
                  </label>
                  {r.key !== 'results' ? (
                    <label className="admin-field">Closes
                      <input type="datetime-local" name="endsAt" defaultValue={toISTInput(r.ends_at)} />
                    </label>
                  ) : null}
                  <button className="admin-btn admin-btn-primary" type="submit">Save</button>
                </form>
              </li>
            );
          })}
        </ol>
      </section>

      <form action={saveSettings} className="admin-panel">
        <h2>Settings</h2>
        <div className="admin-fields">
          <label className="admin-field">Entry fee (₹)<input type="number" name="feeRupees" min="1" step="1" defaultValue={s.feeRupees} required /></label>
          <label className="admin-field">Peanuts granted on payment<input type="number" name="feeGrant" min="1" step="1" defaultValue={s.feeGrant} required /></label>
          <label className="admin-field">Investing target (minimum)<input type="number" name="budgetMin" min="0" step="1" defaultValue={s.budgetMin} required /></label>
          <label className="admin-field">Investing budget (maximum)<input type="number" name="budgetMax" min="1" step="1" defaultValue={s.budgetMax} required /></label>
          <label className="admin-field admin-field-wide">Razorpay Payment Page URL<input type="url" name="razorpayPageUrl" placeholder="https://rzp.io/…" defaultValue={s.razorpayPageUrl ?? ''} /></label>
        </div>
        <p className="admin-sub">The Payment Page needs a required field labelled “Team code”, and its amount must match the fee here, or payments won’t match automatically.</p>
        <div><button className="admin-btn admin-btn-primary" type="submit">Save settings</button></div>
      </form>
    </>
  );
}
