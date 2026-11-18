import { redirect } from 'next/navigation';
import RegisterPage from '../../RegisterPage.jsx';
import { formatDateTime, getSchedule } from '../../lib/event.js';
import { windowState } from '../../lib/stage.js';
import { getViewer, homeFor } from '../../lib/viewer.js';

export const metadata = {
  title: 'Register · PBJ',
  description: 'Register your team for PBJ, Founders Club’s three-day startupathon at SRM. Teams of 2–4, ₹200 per team. 15–17 February 2027.',
};
export const dynamic = 'force-dynamic';

export default async function Page() {
  // src/proxy.js already sends signed-out visitors to /login; this is the server-side backstop.
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  if (viewer.teamId || viewer.role !== 'student') redirect(homeFor(viewer));

  // Registration dates come from event_schedule ('registration').
  const w = (await getSchedule()).registration;
  const state = windowState(w);
  const closed = state === 'open' ? null
    : state === 'upcoming' ? `Registration opens on ${formatDateTime(w.startsAt)}.`
    : `Registration closed on ${formatDateTime(w?.endsAt)}.`;
  return <RegisterPage viewer={viewer} closed={closed} />;
}
