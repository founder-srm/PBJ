'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sql } from '../../lib/db.js';
import { getJudge } from '../../lib/judge.js';

// save_evaluation() in the database raises check_violation messages starting with one of these codes.
const ERRORS = {
  not_judge: 'Only judges can score teams.',
  not_playing: 'That team isn’t competing.',
  wrong_venue: 'You’re not judging this team’s venue in this round.',
  judging_closed: 'This round isn’t open right now.',
  no_round: 'That round no longer exists. Reload the page.',
  not_in_round: 'This round is for finalists only.',
  missing_score: 'Score every criterion before saving.',
  bad_score: 'A score is outside the allowed range.',
  unknown_criterion: 'The criteria changed. Reload the page and try again.',
};

const schema = z.object({
  roundId: z.uuid(),
  teamId: z.uuid(),
  scores: z.record(z.uuid(), z.number().min(0).max(100)),
  notes: z.string().max(2000).optional().default(''),
});

// Save the signed-in judge's scores for one team in one round. Returns { ok, total } or { error }.
export async function saveScores(input) {
  const judge = await getJudge();
  if (!judge) return { error: 'Your session ended. Sign in again.' };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: 'Enter a number for every criterion.' };
  const { roundId, teamId, scores, notes } = parsed.data;
  try {
    const [row] = await sql`select save_evaluation(${judge.id}, ${roundId}, ${teamId}, ${JSON.stringify(scores)}::jsonb, ${notes}) as total`;
    revalidatePath('/judge');
    return { ok: true, total: Number(row.total) };
  } catch (err) {
    if (err?.code === '23514') {
      const code = String(err.message).split(':')[0];
      if (code === 'bad_score' || code === 'missing_score') return { error: String(err.message).replace(/^[a-z_]+: /, '').replace(/^score /, 'Score ') + '.' };
      if (ERRORS[code]) return { error: ERRORS[code] };
    }
    console.error('saveScores failed', err);
    return { error: 'Something went wrong. Try again in a moment.' };
  }
}
