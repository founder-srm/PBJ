import { redirect } from 'next/navigation';
import { JellyDrip } from '../../design-system/components.jsx';
import LoginPanel from '../../components/LoginPanel.jsx';
import { EVENT } from '../../content.js';
import { SiteFooter, SiteHeader } from '../../site.jsx';
import { getViewer } from '../../lib/viewer.js';

export const metadata = { title: 'Login · PBJ' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const viewer = await getViewer();
  if (viewer) redirect(viewer.teamId ? '/dashboard' : '/register');

  return (
    <div className="page page-plain">
      <JellyDrip className="page-drip" />
      <SiteHeader />
      <main className="plain-main">
        <div className="plain-inner signin-page">
          <div className="signin-intro">
            <div className="band-head">
              <p className="eyebrow">Login · {EVENT.dates}</p>
              <h1 className="display-l">Sign in to PBJ</h1>
              <p className="plain-lead">Team leaders sign in with a <strong>personal email</strong>. SRM college accounts can’t sign in to third-party sites, so you’ll add everyone’s SRM email on the registration form instead.</p>
            </div>
            <ol className="signin-steps">
              <li><b>Sign in</b><span>Leader only, with a personal email or Google.</span></li>
              <li><b>Register the team</b><span>Names, RA numbers and SRM emails for all {'2–4'} members.</span></li>
              <li><b>Open your dashboard</b><span>Peanuts, the shop and the leaderboard live there.</span></li>
            </ol>
          </div>
          <LoginPanel />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
