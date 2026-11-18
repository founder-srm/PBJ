'use server';

import { redirect } from 'next/navigation';
import { sql } from '../../lib/db.js';
import { getViewer } from '../../lib/viewer.js';
import { getSchedule } from '../../lib/event.js';
import { windowState } from '../../lib/stage.js';
import { fieldErrors, registrationSchema } from '../../lib/registration.js';

function slugFor(name) {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'team';
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

// Registers the signed-in leader's team. Returns { errors } or { formError } on failure; redirects to /dashboard on success.
export async function registerTeam(input) {
  const viewer = await getViewer();
  if (!viewer) return { formError: 'Your session ended. Sign in again to register.' };
  if (!viewer.verified) return { formError: 'Sign in with a verified personal email to register.' };
  if (viewer.teamId) redirect('/dashboard');
  if (viewer.role !== 'student') return { formError: 'Judge and organiser accounts can’t register a team.' };
  if (windowState((await getSchedule()).registration) !== 'open') return { formError: 'Registration isn’t open right now.' };

  // Never trust the browser's check: validate again with the same schema.
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const d = parsed.data;

  // Friendly errors for the common conflicts; the database's unique constraints still have the final say.
  const ras = d.members.map((m) => m.raNumber);
  const emails = d.members.map((m) => m.collegeEmail);
  const [nameTaken] = await sql`select 1 as x from teams where lower(btrim(name)) = lower(btrim(${d.teamName}))`;
  const taken = await sql`select ra_number, college_email from team_members where ra_number = any(${ras}) or college_email = any(${emails})`;
  const errors = {};
  if (nameTaken) errors.teamName = 'Another team already has this name.';
  d.members.forEach((m, i) => {
    if (taken.some((t) => t.ra_number === m.raNumber)) errors[`members.${i}.raNumber`] = 'This RA number is already on a registered team.';
    if (taken.some((t) => t.college_email === m.collegeEmail)) errors[`members.${i}.collegeEmail`] = 'This email is already on a registered team.';
  });
  if (Object.keys(errors).length) return { errors };

  const teamId = crypto.randomUUID();
  try {
    await sql.transaction([
      sql`insert into teams (id, name, slug, size, created_by) values (${teamId}, ${d.teamName}, ${slugFor(d.teamName)}, ${d.teamSize}, ${viewer.id})`,
      ...d.members.map((m, i) => sql`
        insert into team_members (team_id, position, name, ra_number, college_email, phone, faculty_advisor, faculty_email, user_id)
        values (${teamId}, ${i + 1}, ${m.name}, ${m.raNumber}, ${m.collegeEmail}, ${m.phone ?? null}, ${m.facultyAdvisor ?? null}, ${m.facultyEmail ?? null}, ${i === 0 ? viewer.id : null})`),
    ]);
  } catch (err) {
    if (err?.code === '23505') {
      if (err.constraint === 'teams_name_unique') return { errors: { teamName: 'Another team already has this name.' } };
      return { formError: 'Someone on this team is already registered with another team. Check the RA numbers and emails.' };
    }
    console.error('registerTeam failed', err);
    return { formError: 'Something went wrong saving your team. Try again in a moment.' };
  }

  redirect('/dashboard');
}
