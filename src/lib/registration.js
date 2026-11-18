// Team registration rules, shared by the form (client) and, later, the API route (server).
// Run the same schema on the server before writing to the database: never trust the client's check alone.
import { z } from 'zod';

export const COLLEGE_DOMAIN = 'srmist.edu.in';
export const MIN_TEAM = 2;
export const MAX_TEAM = 4;

// Treat a blank optional field as "not given" rather than as an invalid value.
const optional = (schema) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

const personName = (what) =>
  z.string().trim()
    .min(2, `Enter the ${what}’s full name.`)
    .max(80, 'Keep the name under 80 characters.')
    .regex(/^[\p{L} .'-]+$/u, 'Use letters, spaces, dots, hyphens or apostrophes only.');

// SRM register numbers: RA followed by 13 digits, e.g. RA2211003010123.
export const raNumber = z.string().trim().toUpperCase()
  .regex(/^RA\d{13}$/, 'Use the RA number: RA followed by 13 digits, e.g. RA2211003010123.');

export const collegeEmail = z.string().trim().toLowerCase()
  .regex(/^[a-z0-9._%+-]+@srmist\.edu\.in$/, `Use an email ending in @${COLLEGE_DOMAIN}.`);

// Indian mobile numbers: 10 digits starting with 6, 7, 8 or 9. Spaces, dashes and a +91 / 0 prefix are accepted and stripped.
export const indianPhone = z.string()
  .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+91|0091|91(?=\d{10}$)|0(?=\d{10}$))/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.'));

export const memberSchema = z.object({
  name: personName('member'),
  raNumber,
  collegeEmail,
  facultyAdvisor: optional(personName('faculty advisor')),
  phone: optional(indianPhone),
  // Several members can share an advisor, so this one may repeat across the team.
  facultyEmail: optional(collegeEmail),
});

export const registrationSchema = z
  .object({
    teamName: z.string().trim().min(2, 'Give your team a name.').max(40, 'Keep the team name under 40 characters.'),
    teamSize: z.coerce.number().int().min(MIN_TEAM, `Teams have ${MIN_TEAM}–${MAX_TEAM} members.`).max(MAX_TEAM, `Teams have ${MIN_TEAM}–${MAX_TEAM} members.`),
    // members[0] is the team leader.
    members: z.array(memberSchema).min(MIN_TEAM).max(MAX_TEAM),
    agree: z.literal(true, { error: 'Accept the rules to register.' }),
  })
  .superRefine((d, ctx) => {
    if (d.members.length !== d.teamSize) {
      ctx.addIssue({ code: 'custom', path: ['teamSize'], message: `Add details for all ${d.teamSize} members.` });
    }
    // One person can only be on one team, so RA numbers and college emails must not repeat within a team.
    for (const key of ['raNumber', 'collegeEmail']) {
      const seen = new Map();
      d.members.forEach((m, i) => {
        const val = typeof m?.[key] === 'string' ? m[key].trim().toLowerCase() : '';
        if (!val) return;
        if (seen.has(val)) {
          ctx.addIssue({ code: 'custom', path: ['members', i, key], message: `Same as member ${seen.get(val) + 1}. Each member needs their own.` });
        } else seen.set(val, i);
      });
    }
  }, {
    // Run these team-level checks even while other fields are invalid, so duplicates show up straight away.
    when: (payload) => Array.isArray(payload.value?.members),
  });

// Flattens Zod issues to { 'members.1.phone': 'message' }, keeping the first message per field.
export function fieldErrors(error) {
  const out = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
