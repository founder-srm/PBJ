import 'server-only';
import { redirect } from 'next/navigation';
import { sql } from './db.js';
import { getViewer } from './viewer.js';

const STAFF = ['organiser', 'admin'];

// The signed-in viewer if they're an organiser or admin, else null. Roles live in users.role.
export async function getOrganiser() {
  const viewer = await getViewer();
  if (!viewer) return null;
  const [u] = await sql`select role from users where id = ${viewer.id}`;
  return u && STAFF.includes(u.role) ? { ...viewer, role: u.role } : null;
}

// For admin pages: signed out → /login, not staff → /dashboard.
export async function requireOrganiser() {
  const org = await getOrganiser();
  if (!org) redirect((await getViewer()) ? '/dashboard' : '/login');
  return org;
}
