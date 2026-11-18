import { createHmac, timingSafeEqual } from 'node:crypto';
import { sql } from '../../../../lib/db.js';
import { getSettings } from '../../../../lib/event.js';

export const dynamic = 'force-dynamic';

// Razorpay → us, for `payment.captured`. Public URL: the signature is the authentication.
// Teams pay on a Razorpay Payment Page that has a required "Team code" field; that value arrives in payment.notes.
// A matching, correct-amount payment for a shortlisted team marks it paid and grants Peanuts (confirm_team_payment).
// Anything else is stored as 'unmatched' for an organiser to sort out in /admin/payments.

function validSignature(body, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('hex'));
  const got = Buffer.from(String(signature));
  return expected.length === got.length && timingSafeEqual(expected, got);
}

// "pbj 7k3qx", "PBJ-7K3QX", "7K3QX" → "PBJ-7K3QX"
function normaliseCode(raw) {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = s.match(/^(?:PBJ)?([A-Z0-9]{5})$/);
  return m ? `PBJ-${m[1]}` : null;
}

// The custom field's key is derived from its label (e.g. "team_code"), so look for it loosely.
function findCode(notes) {
  if (!notes || typeof notes !== 'object') return { raw: null, code: null };
  const entries = Object.entries(notes);
  const named = entries.find(([k]) => /team.?code/i.test(k));
  if (named) return { raw: String(named[1]), code: normaliseCode(named[1]) };
  for (const [, v] of entries) {
    const code = normaliseCode(v);
    if (code && /PBJ/i.test(String(v))) return { raw: String(v), code };
  }
  return { raw: null, code: null };
}

export async function POST(request) {
  const body = await request.text();
  if (!validSignature(body, request.headers.get('x-razorpay-signature'))) {
    return Response.json({ error: 'bad signature' }, { status: 400 });
  }
  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 });
  }
  const p = event?.payload?.payment?.entity;
  if (event?.event !== 'payment.captured' || !p?.id) return Response.json({ ok: true, ignored: event?.event ?? null });

  // Replays of a payment we've already handled are a no-op.
  const [seen] = await sql`select state from payments where razorpay_payment_id = ${p.id}`;
  if (seen) return Response.json({ ok: true, state: seen.state, replay: true });

  const settings = await getSettings();
  const { raw, code } = findCode(p.notes);
  const [team] = code ? await sql`select id, payment_ref from teams where team_code = ${code}` : [];

  let state = 'unmatched';
  let note = null;
  let teamId = null;
  if (!code) note = 'No team code on the payment.';
  else if (!team) note = `No team has the code ${code}.`;
  else if (p.amount !== settings.feePaise || p.currency !== 'INR') note = `Amount ₹${p.amount / 100} doesn’t match the ₹${settings.feeRupees} fee.`;
  else {
    try {
      const [{ r }] = await sql`select confirm_team_payment(${team.id}, ${p.id}, null) as r`;
      if (r === 'already_paid' && team.payment_ref !== p.id) note = 'This team had already paid: refund this payment.';
      else { state = 'matched'; teamId = team.id; }
    } catch (err) {
      const m = String(err?.message ?? '');
      note = m.startsWith('not_shortlisted') ? `That team isn’t shortlisted (${m.split(' is ').pop()}): refund or match by hand.` : 'Could not confirm the payment.';
      if (err?.code !== '23514') console.error('razorpay webhook: confirm failed', p.id, err);
    }
  }

  await sql`
    insert into payments (razorpay_payment_id, amount_paise, team_code_entered, payer_email, payer_phone, team_id, state, note, payload)
    values (${p.id}, ${p.amount}, ${raw}, ${p.email ?? null}, ${p.contact ?? null}, ${teamId}, ${state}, ${note}, ${JSON.stringify(p)})
    on conflict (razorpay_payment_id) do nothing`;

  return Response.json({ ok: true, state });
}
