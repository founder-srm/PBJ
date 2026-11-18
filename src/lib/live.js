import 'server-only';
import { sql } from './db.js';
import { getSchedule, getSettings } from './event.js';
import { PLAYING, windowState } from './stage.js';

// Everything the live investing panel needs for one team: its venue, who is pitching there now,
// its budget, and whether it may invest in the pitching team (with the reason if not).
// The database function invest() re-checks every rule; this is only for showing the right state.
export async function getLiveState(teamId) {
  const [schedule, settings] = await Promise.all([getSchedule(), getSettings()]);
  const [team] = await sql`
    select t.stage, t.room_id, r.name as room, b.balance,
      (select coalesce(sum(amount), 0) from investments where investor_team_id = t.id) as used
    from teams t
    left join rooms r on r.id = t.room_id
    join team_balances b on b.team_id = t.id
    where t.id = ${teamId}`;
  if (!team) return null;

  const [pitch] = team.room_id ? await sql`
    select p.id, p.team_id, p.started_at, t.name as team_name,
      exists (select 1 from investments i where i.investor_team_id = p.team_id and i.investee_team_id = ${teamId}) as holds_us,
      (select coalesce(sum(amount), 0) from investments i where i.investor_team_id = ${teamId} and i.investee_team_id = p.team_id) as ours
    from pitches p join teams t on t.id = p.team_id
    where p.room_id = ${team.room_id} and p.ended_at is null` : [];

  const used = Number(team.used);
  const remaining = Math.max(0, settings.budgetMax - used);
  const balance = Number(team.balance);
  let reason = null;
  if (!PLAYING.includes(team.stage)) reason = 'Only teams that have paid can invest.';
  else if (windowState(schedule.event) !== 'open') reason = 'Investing is open only during PBJ.';
  else if (!team.room_id) reason = 'You haven’t been given a venue yet.';
  else if (!pitch) reason = 'No one is pitching in your venue right now.';
  else if (pitch.team_id === teamId) reason = 'You’re pitching. Other teams in your venue can invest in you now.';
  else if (pitch.holds_us) reason = `${pitch.team_name} has invested in your team, so you can’t invest in them.`;
  else if (remaining <= 0) reason = 'You’ve used your whole investing budget.';
  else if (balance <= 0) reason = 'You don’t have any Peanuts left.';

  return {
    venue: team.room,
    pitch: pitch ? { id: pitch.id, teamName: pitch.team_name, startedAt: new Date(pitch.started_at).toISOString(), isUs: pitch.team_id === teamId, ours: Number(pitch.ours) } : null,
    budget: { used, min: settings.budgetMin, max: settings.budgetMax, remaining: Math.min(remaining, balance) },
    canInvest: reason === null,
    reason,
  };
}
