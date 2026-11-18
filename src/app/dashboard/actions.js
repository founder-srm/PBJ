'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sql } from '../../lib/db.js';
import { checkDriveLink, DRIVE_MESSAGES } from '../../lib/drive.js';
import { getSchedule } from '../../lib/event.js';
import { pitchVideoSchema } from '../../lib/pitch.js';
import { windowState } from '../../lib/stage.js';
import { getViewer } from '../../lib/viewer.js';

// Save (or change) the team's pitch-video link while submissions are open. Moves the team to 'in_review'.
// Returns { ok } or { error }.
export async function submitPitchVideo(input) {
  const viewer = await getViewer();
  if (!viewer?.teamId) return { error: 'Your session ended. Sign in again.' };
  const parsed = pitchVideoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const schedule = await getSchedule();
  if (windowState(schedule.pitch_video) !== 'open') return { error: 'Video submissions are closed.' };

  // Judges can't watch a private video, so refuse links Google says aren't public.
  // If Google doesn't answer clearly, accept the link but remind the team to check its sharing.
  const access = await checkDriveLink(parsed.data.url);
  if (access !== 'public' && access !== 'unknown') return { error: DRIVE_MESSAGES[access] };

  const rows = await sql`
    update teams set pitch_video_url = ${parsed.data.url}, pitch_submitted_at = now(), stage = 'in_review'
    where id = ${viewer.teamId} and stage in ('pitch_video', 'in_review')
    returning id`;
  if (!rows.length) return { error: 'Your video can’t be changed any more.' };
  revalidatePath('/dashboard');
  return access === 'unknown' ? { ok: true, warning: DRIVE_MESSAGES.unknown } : { ok: true };
}

// invest() in the database raises check_violation messages that start with one of these codes.
const INVEST_ERRORS = {
  bad_amount: 'Enter a whole number of Peanuts above zero.',
  not_playing: 'Only teams that have paid can invest.',
  event_closed: 'Investing is open only during PBJ.',
  not_pitching: 'That pitch has ended.',
  self: 'You can’t invest in your own team.',
  wrong_venue: 'You can only invest in teams pitching in your venue.',
  reverse_holding: 'This team has invested in you, so you can’t invest in them.',
  over_budget: 'That’s more than your remaining investing budget.',
};

const investSchema = z.object({
  pitchId: z.uuid(),
  amount: z.coerce.number().int('Enter a whole number of Peanuts.').positive('Enter a whole number of Peanuts above zero.').max(10_000_000),
  key: z.uuid(), // one per click, so a retried request can't invest twice
});

// Invest in the team pitching in your venue. Returns { ok } or { error }.
export async function investInPitch(input) {
  const viewer = await getViewer();
  if (!viewer?.teamId) return { error: 'Your session ended. Sign in again.' };
  const parsed = investSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { pitchId, amount, key } = parsed.data;
  try {
    await sql`select invest(${viewer.teamId}, ${pitchId}, ${amount}, ${viewer.id}, ${`invest:${viewer.teamId}:${key}`})`;
  } catch (err) {
    if (err?.code === '23514') {
      const code = String(err.message).split(':')[0];
      if (INVEST_ERRORS[code]) return { error: INVEST_ERRORS[code] };
      if (/negative balance/.test(err.message)) return { error: 'You don’t have enough Peanuts for that.' };
    }
    console.error('investInPitch failed', err);
    return { error: 'Something went wrong. Try again in a moment.' };
  }
  revalidatePath('/dashboard');
  return { ok: true };
}
