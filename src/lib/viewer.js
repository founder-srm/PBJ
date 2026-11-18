import 'server-only';
import { cache } from 'react';
import { auth } from './auth/server.js';
import { sql } from './db.js';
import { COLLEGE_DOMAIN } from './registration.js';

// Leaders log in with a personal email (SRM accounts can't sign in to third-party sites).
// "Verified" = the address is confirmed (by Google, or by the emailed code) and it isn't an SRM address.
export const isCollegeEmail = (email) => typeof email === 'string' && email.toLowerCase().endsWith('@' + COLLEGE_DOMAIN);
export const isVerifiedLeader = (user) => Boolean(user?.emailVerified) && !isCollegeEmail(user.email);

// The signed-in user for this request, with their app row and team (if any). Cached per request.
// Where a signed-in person belongs: judges → /judge, organisers/admins → /admin, leaders → /dashboard or /register.
export function homeFor(viewer) {
  if (!viewer) return '/login';
  if (viewer.teamId) return '/dashboard';
  if (viewer.role === 'judge') return '/judge';
  if (viewer.role === 'organiser' || viewer.role === 'admin') return '/admin';
  return '/register';
}

export const getViewer = cache(async () => {
  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user) return null;

  const email = user.email.toLowerCase();
  // Make sure the app's users row exists (users.id is the Neon Auth user id).
  const [row] = await sql`
    insert into users (id, email, name, avatar_url, last_seen_at)
    values (${user.id}, ${email}, ${user.name || email}, ${user.image ?? null}, now())
    on conflict (id) do update set email = excluded.email, name = excluded.name, avatar_url = excluded.avatar_url, last_seen_at = now()
    returning role`;

  // A team belongs to the leader's login account (team_members.user_id on position 1).
  const [membership] = await sql`select team_id from team_members where user_id = ${user.id} limit 1`;

  return {
    id: user.id,
    name: user.name || '',
    email,
    image: user.image ?? null,
    emailVerified: Boolean(user.emailVerified),
    collegeLogin: isCollegeEmail(email),
    verified: isVerifiedLeader(user),
    teamId: membership?.team_id ?? null,
    role: row?.role ?? 'student', // users.role: student | organiser | judge | admin (set by hand in the DB or /admin/judges)
  };
});
