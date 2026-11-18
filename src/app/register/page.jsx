import { redirect } from 'next/navigation';
import RegisterPage from '../../RegisterPage.jsx';
import { getViewer } from '../../lib/viewer.js';

export const metadata = {
  title: 'Register · PBJ',
  description: 'Register your team for PBJ, Founders Club’s three-day startupathon at SRM. Teams of 2–4, ₹200 per team. 15–17 February 2027.',
};
export const dynamic = 'force-dynamic';

export default async function Page() {
  // src/proxy.js already sends signed-out visitors to /login; this is the server-side backstop.
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  if (viewer.teamId) redirect('/dashboard');
  return <RegisterPage viewer={viewer} />;
}
