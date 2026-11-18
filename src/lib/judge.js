import 'server-only';
import { redirect } from 'next/navigation';
import { sql } from './db.js';
import { getViewer, homeFor } from './viewer.js';

// Judges (users.role = 'judge', or 'admin') score the teams in the venues they're assigned to (judge_venues).

export async function getJudge() {
  const viewer = await getViewer();
  return viewer && (viewer.role === 'judge' || viewer.role === 'admin') ? viewer : null;
}

// For /judge pages: signed out → /login, not a judge → wherever they belong.
export async function requireJudge() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  if (viewer.role !== 'judge' && viewer.role !== 'admin') redirect(homeFor(viewer));
  return viewer;
}

// Active criteria in display order.
export async function getCriteria({ all = false } = {}) {
  const rows = all
    ? await sql`select id, name, description, max_score, weight, position, active from judging_criteria order by active desc, position, name`
    : await sql`select id, name, description, max_score, weight, position, active from judging_criteria where active order by position, name`;
  return rows.map((c) => ({ ...c, max_score: Number(c.max_score), weight: Number(c.weight) }));
}

// Judging rounds (judging_rounds), in order. Each: { id, name, scope: 'all'|'finalists', startsAt, endsAt, position, state }.
export async function getRounds() {
  const rows = await sql`select id, name, scope, starts_at, ends_at, position from judging_rounds order by starts_at, position, name`;
  const now = new Date();
  return rows.map((r) => {
    const startsAt = new Date(r.starts_at), endsAt = new Date(r.ends_at);
    return { id: r.id, name: r.name, scope: r.scope, startsAt, endsAt, position: Number(r.position), state: now < startsAt ? 'upcoming' : now >= endsAt ? 'closed' : 'open' };
  });
}

// The round to show: the requested one if it exists, else the open one, else the next upcoming, else the last.
export function pickRound(rounds, requestedId) {
  return rounds.find((r) => r.id === requestedId)
    ?? rounds.find((r) => r.state === 'open')
    ?? rounds.find((r) => r.state === 'upcoming')
    ?? rounds[rounds.length - 1]
    ?? null;
}

// Stages a round's scope lets in.
export const ROUND_STAGES = { all: ['paid', 'finalist', 'winner'], finalists: ['finalist', 'winner'] };
export const SCOPE_LABEL = { all: 'All teams', finalists: 'Finalists only' };
