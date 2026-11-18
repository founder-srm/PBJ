'use server';

// Organiser actions. Each one re-checks the role, then redirects back to its page with ?msg=… so the result shows.
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sql } from '../../lib/db.js';
import { getOrganiser } from '../../lib/admin.js';
import { divideEvenly } from '../../lib/venues.js';
import { checkDriveLink } from '../../lib/drive.js';

async function staff() {
  const org = await getOrganiser();
  if (!org) redirect('/login');
  return org;
}
const back = (path, msg) => redirect(`${path}${path.includes('?') ? '&' : '?'}msg=${encodeURIComponent(msg)}`);
const str = (fd, k) => String(fd.get(k) ?? '').trim();
const uuid = z.uuid();
const dbMessage = (err) => String(err?.message ?? 'Something went wrong.').replace(/^[a-z_]+: /, '');

// Return path from the form, limited to admin pages.
const from = (fd, fallback) => {
  const p = str(fd, 'from');
  return p.startsWith('/admin/') ? p : fallback;
};

/* ---------- Teams ---------- */

const REVIEW_TO = { shortlisted: 'Shortlisted', not_shortlisted: 'Not shortlisted', in_review: 'Moved back to review' };

export async function setReview(fd) {
  await staff();
  const teamId = str(fd, 'teamId'), to = str(fd, 'to');
  const path = from(fd, '/admin/teams');
  if (!uuid.safeParse(teamId).success || !REVIEW_TO[to]) back(path, 'Invalid request.');
  const rows = await sql`
    update teams set stage = ${to}::team_stage, reviewed_at = case when ${to} = 'in_review' then null else now() end
    where id = ${teamId} and stage in ('in_review', 'shortlisted', 'not_shortlisted') and pitch_submitted_at is not null
    returning name`;
  back(path, rows.length ? `${rows[0].name}: ${REVIEW_TO[to]}.` : 'That team can’t be reviewed (no video, or it has already paid).');
}

export async function withdrawTeam(fd) {
  await staff();
  const teamId = str(fd, 'teamId');
  const path = from(fd, '/admin/teams');
  if (!uuid.safeParse(teamId).success) back(path, 'Invalid request.');
  const rows = await sql`update teams set stage = 'withdrawn' where id = ${teamId} and stage not in ('withdrawn', 'disqualified') returning name`;
  back(path, rows.length ? `${rows[0].name} withdrawn.` : 'Nothing changed.');
}

// Mark a shortlisted team paid by hand (e.g. paid outside Razorpay). Grants Peanuts once.
export async function markPaid(fd) {
  const org = await staff();
  const teamId = str(fd, 'teamId'), ref = str(fd, 'ref');
  const path = from(fd, '/admin/teams');
  if (!uuid.safeParse(teamId).success) back(path, 'Invalid request.');
  if (ref.length < 3) back(path, 'Enter a payment reference (e.g. the Razorpay payment id).');
  let result;
  try {
    [result] = await sql`select confirm_team_payment(${teamId}, ${'manual:' + ref}, ${org.id}) as r`;
  } catch (err) {
    back(path, err?.code === '23505' ? 'That payment reference is already used by another team.' : dbMessage(err));
  }
  back(path, result.r === 'already_paid' ? 'That team had already paid.' : 'Marked paid. Peanuts granted.');
}

/* ---------- Payments ---------- */

export async function assignPayment(fd) {
  const org = await staff();
  const paymentId = str(fd, 'paymentId'), teamId = str(fd, 'teamId');
  if (!uuid.safeParse(paymentId).success || !uuid.safeParse(teamId).success) back('/admin/payments', 'Pick a team.');
  const [p] = await sql`select razorpay_payment_id, state from payments where id = ${paymentId}`;
  if (!p || p.state === 'matched') back('/admin/payments', 'That payment is already matched.');
  let result;
  try {
    [, [result]] = await sql.transaction([
      sql`update payments set state = 'matched', team_id = ${teamId}, resolved_by = ${org.id}, resolved_at = now() where id = ${paymentId}`,
      sql`select confirm_team_payment(${teamId}, ${p.razorpay_payment_id}, ${org.id}) as r`,
    ]);
  } catch (err) {
    back('/admin/payments', err?.code === '23505' ? 'That payment is already linked to a team.' : dbMessage(err));
  }
  back('/admin/payments', result?.r === 'already_paid' ? 'Linked, but that team had already paid: refund this payment in Razorpay.' : 'Payment matched. Peanuts granted.');
}

export async function ignorePayment(fd) {
  const org = await staff();
  const paymentId = str(fd, 'paymentId'), note = str(fd, 'note').slice(0, 200);
  if (!uuid.safeParse(paymentId).success) back('/admin/payments', 'Invalid request.');
  await sql`update payments set state = 'ignored', note = coalesce(nullif(${note}, ''), note), resolved_by = ${org.id}, resolved_at = now() where id = ${paymentId} and state = 'unmatched'`;
  back('/admin/payments', 'Payment marked as ignored.');
}

/* ---------- Schedule & settings ---------- */

// <input type="datetime-local"> values are IST wall-clock times.
const istInput = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const fromIST = (v) => new Date(`${v}:00+05:30`);

export async function saveSchedule(fd) {
  await staff();
  const key = str(fd, 'key'), starts = str(fd, 'startsAt'), ends = str(fd, 'endsAt');
  if (!istInput.safeParse(starts).success || (ends && !istInput.safeParse(ends).success)) back('/admin/schedule', 'Enter valid dates.');
  const startsAt = fromIST(starts), endsAt = ends ? fromIST(ends) : null;
  if (endsAt && endsAt <= startsAt) back('/admin/schedule', 'The end must be after the start.');
  const rows = await sql`update event_schedule set starts_at = ${startsAt}, ends_at = ${endsAt}, updated_at = now() where key = ${key} returning label`;
  back('/admin/schedule', rows.length ? `${rows[0].label} dates saved.` : 'Unknown step.');
}

const settingsSchema = z.object({
  feeRupees: z.coerce.number().int().positive(),
  feeGrant: z.coerce.number().int().positive(),
  budgetMin: z.coerce.number().int().min(0),
  budgetMax: z.coerce.number().int().positive(),
  razorpayPageUrl: z.union([z.literal(''), z.url().startsWith('https://')]),
}).refine((s) => s.budgetMax >= s.budgetMin, 'The budget maximum must be at least the minimum.');

export async function saveSettings(fd) {
  await staff();
  const r = settingsSchema.safeParse(Object.fromEntries(['feeRupees', 'feeGrant', 'budgetMin', 'budgetMax', 'razorpayPageUrl'].map((k) => [k, str(fd, k)])));
  if (!r.success) back('/admin/schedule', r.error.issues[0].message);
  const s = r.data;
  await sql`
    update event_settings set fee_paise = ${s.feeRupees * 100}, fee_grant = ${s.feeGrant}, invest_budget_min = ${s.budgetMin},
      invest_budget_max = ${s.budgetMax}, razorpay_page_url = ${s.razorpayPageUrl || null}, updated_at = now()`;
  back('/admin/schedule', 'Settings saved.');
}

/* ---------- Venues & pitches ---------- */

export async function createVenue(fd) {
  await staff();
  const name = str(fd, 'name');
  if (name.length < 1 || name.length > 40) back('/admin/venues', 'Venue names are 1–40 characters.');
  try {
    await sql`insert into rooms (name) values (${name})`;
  } catch (err) {
    back('/admin/venues', err?.code === '23505' ? 'A venue with that name already exists.' : dbMessage(err));
  }
  back('/admin/venues', `Venue ${name} added.`);
}

export async function assignVenue(fd) {
  await staff();
  const teamId = str(fd, 'teamId'), roomId = str(fd, 'roomId');
  const path = from(fd, '/admin/venues');
  if (!uuid.safeParse(teamId).success || (roomId && !uuid.safeParse(roomId).success)) back(path, 'Invalid request.');
  const [open] = await sql`select 1 as x from pitches where team_id = ${teamId} and ended_at is null`;
  if (open) back(path, 'End that team’s pitch before moving it.');
  const rows = await sql`update teams set room_id = ${roomId || null} where id = ${teamId} returning name`;
  back(path, rows.length ? `${rows[0].name} ${roomId ? 'assigned' : 'unassigned'}.` : 'Team not found.');
}

// Divide paid teams across venues as evenly as possible.
//   mode 'unassigned': keep current assignments, place teams without a venue into the emptiest venues first.
//   mode 'all': reshuffle every paid team (random order) into equal venues. Refused while any pitch is open.
export async function autoAssignVenues(fd) {
  await staff();
  const mode = str(fd, 'mode') === 'all' ? 'all' : 'unassigned';
  const rooms = await sql`
    select r.id, r.name, count(t.id)::int as n
    from rooms r left join teams t on t.room_id = r.id and t.stage in ('paid', 'finalist', 'winner')
    group by r.id order by r.name`;
  if (!rooms.length) back('/admin/venues', 'Add a venue first.');
  if (mode === 'all') {
    const [open] = await sql`select 1 as x from pitches where ended_at is null limit 1`;
    if (open) back('/admin/venues', 'End every pitch before reshuffling all teams.');
  }
  const teams = mode === 'all'
    ? await sql`select id from teams where stage in ('paid', 'finalist', 'winner') order by random()`
    : await sql`select id from teams where stage in ('paid', 'finalist', 'winner') and room_id is null order by created_at`;
  if (!teams.length) back('/admin/venues', mode === 'all' ? 'There are no paid teams yet.' : 'Every paid team already has a venue.');

  // Each team goes to the venue with the fewest teams, so sizes differ by at most one where the starting sizes allow it.
  const { assignments, sizes: load } = divideEvenly(rooms.map((r) => ({ ...r, n: mode === 'all' ? 0 : r.n })), teams.map((t) => t.id));
  const ids = assignments.map((a) => a.teamId), roomIds = assignments.map((a) => a.roomId);
  await sql`
    update teams t set room_id = v.room_id
    from unnest(${ids}::uuid[], ${roomIds}::uuid[]) as v(team_id, room_id)
    where t.id = v.team_id`;
  back('/admin/venues', `Placed ${ids.length} team${ids.length === 1 ? '' : 's'}: ${load.map((r) => `${r.name} ${r.n}`).join(', ')}.`);
}

// Ends whatever is pitching in the room and starts the chosen team's pitch.
export async function startPitch(fd) {
  const org = await staff();
  const roomId = str(fd, 'roomId'), teamId = str(fd, 'teamId');
  if (!uuid.safeParse(roomId).success || !uuid.safeParse(teamId).success) back('/admin/venues', 'Pick a team.');
  const [team] = await sql`select name, room_id, stage from teams where id = ${teamId}`;
  if (!team || team.room_id !== roomId) back('/admin/venues', 'That team isn’t in this venue.');
  if (!['paid', 'finalist', 'winner'].includes(team.stage)) back('/admin/venues', 'Only paid teams can pitch.');
  try {
    await sql.transaction([
      sql`update pitches set ended_at = now() where (room_id = ${roomId} or team_id = ${teamId}) and ended_at is null`,
      sql`insert into pitches (room_id, team_id, started_by) values (${roomId}, ${teamId}, ${org.id})`,
    ]);
  } catch (err) {
    back('/admin/venues', dbMessage(err));
  }
  back('/admin/venues', `${team.name} is now pitching.`);
}

export async function endPitch(fd) {
  await staff();
  const roomId = str(fd, 'roomId');
  if (!uuid.safeParse(roomId).success) back('/admin/venues', 'Invalid request.');
  await sql`update pitches set ended_at = now() where room_id = ${roomId} and ended_at is null`;
  back('/admin/venues', 'Pitch ended.');
}

/* ---------- Judges & criteria ---------- */

// Make someone a judge by the email they sign in with. They must have signed in once (so a users row exists).
export async function addJudge(fd) {
  await staff();
  const email = str(fd, 'email').toLowerCase();
  if (!z.email().safeParse(email).success) back('/admin/judges', 'Enter the email the judge signs in with.');
  const [u] = await sql`
    select u.id, u.role, exists (select 1 from team_members m where m.user_id = u.id) as on_team
    from users u where u.email = ${email}`;
  if (!u) back('/admin/judges', `${email} hasn’t signed in yet. Ask them to sign in once at /login, then add them again.`);
  if (u.on_team) back('/admin/judges', `${email} leads a team, so they can’t judge.`);
  if (u.role === 'organiser' || u.role === 'admin') back('/admin/judges', `${email} is an ${u.role}; their role wasn’t changed.`);
  await sql`update users set role = 'judge' where id = ${u.id}`;
  back('/admin/judges', `${email} is now a judge. Assign them a venue below.`);
}

export async function removeJudge(fd) {
  await staff();
  const judgeId = str(fd, 'judgeId');
  if (!uuid.safeParse(judgeId).success) back('/admin/judges', 'Invalid request.');
  await sql.transaction([
    sql`delete from judge_venues where judge_id = ${judgeId}`,
    sql`update users set role = 'student' where id = ${judgeId} and role = 'judge'`,
  ]);
  back('/admin/judges', 'Judge removed. Their saved scores are kept.');
}

// Assign (or remove) a judge to a venue for one round.
export async function setJudgeVenue(fd) {
  await staff();
  const judgeId = str(fd, 'judgeId'), roomId = str(fd, 'roomId'), roundId = str(fd, 'roundId'), op = str(fd, 'op');
  const path = `/admin/judges?round=${roundId}`;
  if (![judgeId, roomId, roundId].every((v) => uuid.safeParse(v).success)) back(path, 'Pick a venue.');
  if (op === 'remove') await sql`delete from judge_venues where round_id = ${roundId} and judge_id = ${judgeId} and room_id = ${roomId}`;
  else await sql`insert into judge_venues (round_id, judge_id, room_id) values (${roundId}, ${judgeId}, ${roomId}) on conflict do nothing`;
  back(path, op === 'remove' ? 'Venue removed from judge for this round.' : 'Venue assigned for this round.');
}

// Copy every judge-to-venue assignment from one round into another (keeps what the target already has).
export async function copyAssignments(fd) {
  await staff();
  const from = str(fd, 'fromRound'), to = str(fd, 'roundId');
  const path = `/admin/judges?round=${to}`;
  if (!uuid.safeParse(from).success || !uuid.safeParse(to).success || from === to) back(path, 'Pick another round to copy from.');
  const rows = await sql`
    insert into judge_venues (round_id, judge_id, room_id)
    select ${to}, judge_id, room_id from judge_venues where round_id = ${from}
    on conflict do nothing returning judge_id`;
  back(path, rows.length ? `Copied ${rows.length} assignment${rows.length === 1 ? '' : 's'}.` : 'Nothing new to copy.');
}

/* ---------- Judging rounds ---------- */

const roundSchema = z.object({
  name: z.string().trim().min(2, 'Round names are 2–60 characters.').max(60, 'Round names are 2–60 characters.'),
  scope: z.enum(['all', 'finalists']),
  startsAt: istInput,
  endsAt: istInput,
});
const readRound = (fd) => {
  const r = roundSchema.safeParse({ name: str(fd, 'name'), scope: str(fd, 'scope') || 'all', startsAt: str(fd, 'startsAt'), endsAt: str(fd, 'endsAt') });
  if (!r.success) return { error: r.error.issues[0].path[0] === 'startsAt' || r.error.issues[0].path[0] === 'endsAt' ? 'Enter both dates.' : r.error.issues[0].message };
  const startsAt = fromIST(r.data.startsAt), endsAt = fromIST(r.data.endsAt);
  if (endsAt <= startsAt) return { error: 'The round must end after it starts.' };
  return { ...r.data, startsAt, endsAt };
};

export async function addRound(fd) {
  await staff();
  const r = readRound(fd);
  if (r.error) back('/admin/judges', r.error);
  let row;
  try {
    [row] = await sql`
      insert into judging_rounds (name, scope, starts_at, ends_at, position)
      values (${r.name}, ${r.scope}, ${r.startsAt}, ${r.endsAt}, (select coalesce(max(position), 0) + 1 from judging_rounds))
      returning id`;
  } catch (err) {
    back('/admin/judges', err?.code === '23505' ? 'A round with that name already exists.' : dbMessage(err));
  }
  back(`/admin/judges?round=${row.id}`, `${r.name} created. Assign judges to venues for it below.`);
}

export async function saveRound(fd) {
  await staff();
  const id = str(fd, 'id');
  if (!uuid.safeParse(id).success) back('/admin/judges', 'Invalid request.');
  const r = readRound(fd);
  if (r.error) back(`/admin/judges?round=${id}`, r.error);
  try {
    await sql`update judging_rounds set name = ${r.name}, scope = ${r.scope}, starts_at = ${r.startsAt}, ends_at = ${r.endsAt} where id = ${id}`;
  } catch (err) {
    back(`/admin/judges?round=${id}`, err?.code === '23505' ? 'A round with that name already exists.' : dbMessage(err));
  }
  back(`/admin/judges?round=${id}`, `${r.name} saved.`);
}

// Only rounds with no scores can be deleted (their assignments go with them).
export async function deleteRound(fd) {
  await staff();
  const id = str(fd, 'id');
  if (!uuid.safeParse(id).success) back('/admin/judges', 'Invalid request.');
  const [used] = await sql`select count(*)::int as n from evaluations where round_id = ${id}`;
  if (used.n) back(`/admin/judges?round=${id}`, `Judges have already scored ${used.n} team${used.n === 1 ? '' : 's'} in this round, so it can’t be deleted. Change its dates instead.`);
  const rows = await sql`delete from judging_rounds where id = ${id} returning name`;
  back('/admin/judges', rows.length ? `${rows[0].name} deleted.` : 'Round not found.');
}

const criterionSchema = z.object({
  name: z.string().trim().min(2, 'Criterion names are 2–60 characters.').max(60, 'Criterion names are 2–60 characters.'),
  description: z.string().trim().max(300),
  maxScore: z.coerce.number().int().min(1, 'The maximum is 1–100.').max(100, 'The maximum is 1–100.'),
  weight: z.coerce.number().positive('Weight must be above 0.').max(100),
  position: z.coerce.number().int().min(0).max(999),
});
const readCriterion = (fd) => criterionSchema.safeParse({
  name: str(fd, 'name'), description: str(fd, 'description'), maxScore: str(fd, 'maxScore'), weight: str(fd, 'weight') || '1', position: str(fd, 'position') || '0',
});

export async function addCriterion(fd) {
  await staff();
  const r = readCriterion(fd);
  if (!r.success) back('/admin/judges', r.error.issues[0].message);
  const c = r.data;
  try {
    await sql`insert into judging_criteria (name, description, max_score, weight, position) values (${c.name}, ${c.description || null}, ${c.maxScore}, ${c.weight}, ${c.position})`;
  } catch (err) {
    back('/admin/judges', err?.code === '23505' ? 'A criterion with that name already exists.' : dbMessage(err));
  }
  back('/admin/judges', `Added ${c.name}. Scores saved before now don’t include it, so those totals show as incomplete until judges re-save.`);
}

export async function saveCriterion(fd) {
  await staff();
  const id = str(fd, 'id');
  const r = readCriterion(fd);
  if (!uuid.safeParse(id).success) back('/admin/judges', 'Invalid request.');
  if (!r.success) back('/admin/judges', r.error.issues[0].message);
  const c = r.data;
  const active = fd.get('active') === 'on';
  // Lowering the maximum below a score already given would push totals over 100.
  const [top] = await sql`select max(score) as m from evaluation_scores where criterion_id = ${id}`;
  if (top?.m != null && Number(top.m) > c.maxScore) back('/admin/judges', `A judge has already given ${Number(top.m)} on this criterion, so the maximum can’t go below that.`);
  try {
    await sql`update judging_criteria set name = ${c.name}, description = ${c.description || null}, max_score = ${c.maxScore}, weight = ${c.weight}, position = ${c.position}, active = ${active} where id = ${id}`;
  } catch (err) {
    back('/admin/judges', err?.code === '23505' ? 'A criterion with that name already exists.' : dbMessage(err));
  }
  back('/admin/judges', `${c.name} saved.`);
}

/* ---------- Pitch video links ---------- */

// Check every submitted pitch-video link that's still being reviewed, and report the ones judges can't open.
export async function checkVideoLinks(fd) {
  await staff();
  const path = from(fd, '/admin/teams');
  const teams = await sql`
    select name, pitch_video_url from teams
    where pitch_video_url is not null and stage in ('in_review', 'shortlisted', 'not_shortlisted')
    order by name`;
  if (!teams.length) back(path, 'No submitted videos to check.');
  const results = [];
  for (let i = 0; i < teams.length; i += 8) { // 8 at a time, to be gentle with Google
    const batch = teams.slice(i, i + 8);
    results.push(...await Promise.all(batch.map(async (t) => ({ name: t.name, access: await checkDriveLink(t.pitch_video_url) }))));
  }
  const bad = results.filter((r) => r.access === 'private' || r.access === 'missing');
  const unsure = results.filter((r) => r.access === 'unknown' || r.access === 'invalid');
  const parts = [`Checked ${results.length} video link${results.length === 1 ? '' : 's'}.`];
  parts.push(bad.length ? `Not viewable: ${bad.map((r) => `${r.name} (${r.access === 'private' ? 'private' : 'not found'})`).join(', ')}. Their dashboards show them how to fix it.` : 'All are public.');
  if (unsure.length) parts.push(`Couldn’t check: ${unsure.map((r) => r.name).join(', ')}.`);
  back(path, parts.join(' '));
}
