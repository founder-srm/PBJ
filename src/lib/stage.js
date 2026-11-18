// What a team sees is decided by its stored stage (teams.stage) plus the schedule and the current time.
// Nothing is bulk-updated when a date passes; this function works it out on every request.
// Pure (no DB), so it can be used anywhere.

export const STAGES = ['pitch_video', 'in_review', 'shortlisted', 'not_shortlisted', 'paid', 'finalist', 'winner', 'withdrawn', 'disqualified'];
export const PLAYING = ['paid', 'finalist', 'winner'];

// 'upcoming' | 'open' | 'closed' for one schedule entry.
export function windowState(w, now = new Date()) {
  if (!w) return 'closed';
  if (now < w.startsAt) return 'upcoming';
  if (w.endsAt && now >= w.endsAt) return 'closed';
  return 'open';
}

// The view the team's dashboard should show:
//   pitch_video | missed | in_review | shortlisted | not_shortlisted | paid | live | over | finalist | winner | withdrawn | disqualified
export function effectiveStage(stage, schedule, now = new Date()) {
  const resultsOut = Boolean(schedule.results) && now >= schedule.results.startsAt;
  switch (stage) {
    case 'pitch_video':
      return windowState(schedule.pitch_video, now) === 'closed' ? 'missed' : 'pitch_video';
    case 'shortlisted':
    case 'not_shortlisted':
      return resultsOut ? stage : 'in_review';
    case 'paid': {
      const ev = windowState(schedule.event, now);
      return ev === 'open' ? 'live' : ev === 'closed' ? 'over' : 'paid';
    }
    default:
      return stage;
  }
}
