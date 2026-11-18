import 'server-only';
import { cache } from 'react';
import { sql } from './db.js';

// The event's dated steps (event_schedule) and settings (event_settings), read from the database so
// organisers can change them in /admin/schedule. Cached per request.

// { registration, pitch_video, results, payment, event } → { label, startsAt: Date, endsAt: Date | null }
export const getSchedule = cache(async () => {
  const rows = await sql`select key, label, starts_at, ends_at from event_schedule`;
  return Object.fromEntries(rows.map((r) => [r.key, {
    label: r.label,
    startsAt: new Date(r.starts_at),
    endsAt: r.ends_at ? new Date(r.ends_at) : null,
  }]));
});

export const getSettings = cache(async () => {
  const [s] = await sql`select fee_paise, fee_grant, invest_budget_min, invest_budget_max, razorpay_page_url from event_settings`;
  return {
    feePaise: Number(s.fee_paise),
    feeRupees: Number(s.fee_paise) / 100,
    feeGrant: Number(s.fee_grant),
    budgetMin: Number(s.invest_budget_min),
    budgetMax: Number(s.invest_budget_max),
    razorpayPageUrl: s.razorpay_page_url,
  };
});

// Dates are shown in IST and formatted on the server, so the browser never re-renders them differently.
const IST = 'Asia/Kolkata';
export function formatDate(d) {
  return d ? new Intl.DateTimeFormat('en-IN', { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric' }).format(d) : '';
}
export function formatDateTime(d) {
  return d ? new Intl.DateTimeFormat('en-IN', { timeZone: IST, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(d) : '';
}

// IST wall-clock value for <input type="datetime-local"> (organiser forms).
export function toISTInput(d) {
  if (!d) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
