import { Badge, JellyDrip } from './design-system/components.jsx';
import RegistrationForm from './components/RegistrationForm.jsx';
import SignOutButton from './components/SignOutButton.jsx';
import { EVENT } from './content.js';
import { COLLEGE_DOMAIN } from './lib/registration.js';
import { SiteFooter, SiteHeader } from './site.jsx';

// `viewer` is the signed-in user (see src/lib/viewer.js). Only verified SRM accounts get the form.
export default function RegisterPage({ viewer }) {
  return (
    <div className="page page-plain">
      <JellyDrip className="page-drip" />
      <SiteHeader />
      <main className="plain-main">
        <div className="plain-inner">
          <div className="band-head">
            <p className="eyebrow">PBJ · {EVENT.dates}</p>
            <h1 className="display-l">Register your team</h1>
            <p className="plain-lead">Three days to pitch, build and win real users. Register once for the whole team with each member’s RA number and college email. You’re the team leader: you’ll add everyone’s SRM email here, and the team’s dashboard opens with the personal email you logged in with.</p>
            <div className="meta">
              <Badge tone="cloud">Teams of 2–4</Badge>
              <Badge tone="cloud">₹{EVENT.fee} per team</Badge>
              <Badge tone="cloud">SRM college email</Badge>
            </div>
          </div>
          {viewer.verified ? (
            <RegistrationForm fee={EVENT.fee} leader={{ name: viewer.name, email: viewer.email }} />
          ) : (
            <div className="pbj pbj-reg">
              <div className="pbj-reg-head">
                <h3>{viewer.collegeLogin ? 'Use a personal email' : 'Verify your email'}</h3>
                <p>
                  You’re signed in as <strong>{viewer.email}</strong>.{' '}
                  {viewer.collegeLogin
                    ? `Team leaders log in with a personal email, not an @${COLLEGE_DOMAIN} account. Sign out, then sign in with Google or a personal email.`
                    : 'Confirm this address with the code we emailed you, then come back to register.'}
                </p>
              </div>
              <div className="wide"><SignOutButton next="/login" /></div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
