import { sql } from '../../../lib/db.js';
import { formatDateTime } from '../../../lib/event.js';
import { assignPayment, ignorePayment } from '../actions.js';

export const dynamic = 'force-dynamic';

const STATE = { unmatched: 'Needs a team', matched: 'Matched', ignored: 'Ignored' };

export default async function AdminPayments({ searchParams }) {
  const { msg } = await searchParams;
  const payments = await sql`
    select p.id, p.razorpay_payment_id, p.amount_paise, p.team_code_entered, p.payer_email, p.payer_phone, p.state, p.note, p.received_at,
      t.name as team
    from payments p left join teams t on t.id = p.team_id
    order by (p.state = 'unmatched') desc, p.received_at desc
    limit 500`;
  const shortlisted = await sql`select id, name, team_code from teams where stage = 'shortlisted' order by name`;
  const unmatched = payments.filter((p) => p.state === 'unmatched').length;

  return (
    <>
      <div className="admin-top">
        <h1>Payments</h1>
        <p className="admin-sub">Every captured Razorpay payment. {unmatched ? `${unmatched} need a team.` : 'Nothing needs attention.'} Payments match automatically when the team code is right.</p>
      </div>
      {msg ? <p className="admin-msg" role="status">{msg}</p> : null}
      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Received</th><th>Payment</th><th>Payer</th><th>Code entered</th><th>State</th><th>Action</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDateTime(new Date(p.received_at))}</td>
                  <td><code>{p.razorpay_payment_id}</code><br />₹{(p.amount_paise / 100).toLocaleString('en-IN')}</td>
                  <td>{p.payer_email ?? '—'}{p.payer_phone ? <><br />{p.payer_phone}</> : null}</td>
                  <td>{p.team_code_entered ?? '—'}</td>
                  <td>{STATE[p.state]}{p.team ? <><br /><strong>{p.team}</strong></> : null}{p.note ? <><br /><small>{p.note}</small></> : null}</td>
                  <td>
                    {p.state === 'unmatched' ? (
                      <div className="admin-actions">
                        <form action={assignPayment} className="admin-inline">
                          <input type="hidden" name="paymentId" value={p.id} />
                          <select name="teamId" aria-label="Team" required defaultValue="">
                            <option value="" disabled>Pick a shortlisted team</option>
                            {shortlisted.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.team_code})</option>)}
                          </select>
                          <button className="admin-btn admin-btn-primary" type="submit">Match</button>
                        </form>
                        <form action={ignorePayment} className="admin-inline">
                          <input type="hidden" name="paymentId" value={p.id} />
                          <input name="note" placeholder="Why (e.g. refunded)" aria-label="Reason" size={14} />
                          <button className="admin-btn" type="submit">Ignore</button>
                        </form>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))}
              {payments.length === 0 ? <tr><td colSpan={6}>No payments yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
