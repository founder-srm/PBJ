'use client';

// Header and footer shared by every page. Links are absolute so they work from any route.
import { useEffect, useState } from 'react';
import { Button, Footer, NavBar } from './design-system/components.jsx';
import { authClient } from './lib/auth/client.js';
import { useViewerStatus } from './lib/useViewerStatus.js';

export const REGISTER_HREF = '/register';
export const LOGIN_HREF = '/login';
export const DASHBOARD_HREF = '/dashboard';

const NAV = [
  { label: 'The idea', href: '/#idea' },
  { label: 'Schedule', href: '/#schedule' },
  { label: 'FAQ', href: '/#faq' },
];

function LogoutButton() {
  async function logout() {
    await authClient.signOut();
    window.location.href = '/';
  }
  return (
    <button type="button" className="pbj-nav-icon" onClick={logout} title="Log out">
      {/* An open door with an arrow leaving it */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
        <path d="M14 4 7 6v14l7-2" />
        <path d="M3 12h7" />
        <path d="m6 9-3 3 3 3" />
      </svg>
      <span className="pbj-nav-icon-label">Log out</span>
    </button>
  );
}

// Light/dark switch. The pre-paint script in layout.jsx applies the saved choice; this flips <html data-theme>
// and saves it. Starts neutral (moon) until mounted to avoid a hydration mismatch.
function ThemeToggle() {
  const [theme, setTheme] = useState(null);
  useEffect(() => {
    const html = document.documentElement;
    const read = () => setTheme(html.dataset.theme === 'dark' ? 'dark' : 'light');
    read();
    const watch = new MutationObserver(read); // the OS can still change it while no choice is saved
    watch.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return () => watch.disconnect();
  }, []);
  function toggle() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('pbj-theme', next); } catch {}
  }
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button type="button" className="pbj-nav-icon" onClick={toggle} title={label} aria-label={label}>
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      )}
      <span className="pbj-nav-icon-label" aria-hidden="true">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}

// Signed out: "Login". Signed in: "Register" (or "Dashboard" once the team exists; "Judging" for judges, "Admin" for
// organisers) plus a log-out door.
export function SiteHeader() {
  // Shows the signed-out label first and switches once the session (and team) check answers.
  const { signedIn, registered, home } = useViewerStatus();
  const cta = !signedIn
    ? { label: 'Login', href: LOGIN_HREF }
    : home === '/judge'
      ? { label: 'Judging', href: '/judge' }
      : home === '/admin'
        ? { label: 'Admin', href: '/admin' }
        : registered
      ? { label: 'Dashboard', href: DASHBOARD_HREF }
      : { label: 'Register', href: REGISTER_HREF };
  return (
    <header className="topbar">
      <NavBar
        links={NAV}
        cta={cta}
        actions={<><ThemeToggle />{signedIn ? <LogoutButton /> : null}</>}
        homeHref="/"
        logo={{ src: '/brand/founders-club.png', alt: 'Founders Club home' }}
      />
    </header>
  );
}

// The page's main call to action: "Register your team", or "Open dashboard" for a leader whose team is registered.
// Signed-out visitors keep "Register your team" (it leads through /login).
export function TeamCta({ size = 'lg' }) {
  const { registered } = useViewerStatus();
  return registered
    ? <Button size={size} href={DASHBOARD_HREF}>Open dashboard</Button>
    : <Button size={size} href={REGISTER_HREF}>Register your team</Button>;
}

export function SiteFooter() {
  return (
    <Footer
      logos={[
        { src: '/brand/founders-club.png', alt: 'Founders Club', height: 72 },
        { src: '/brand/dei-logo-on-dark.png', alt: 'Directorate of Entrepreneurship and Innovation', height: 64 },
      ]}
      note="PBJ is organised by Founders Club under the Directorate of Entrepreneurship and Innovation, SRM Institute of Science and Technology."
      columns={[
        { title: 'Event', links: NAV },
        { title: 'Teams', links: [{ label: 'Register', href: REGISTER_HREF }, { label: 'Home', href: '/' }] },
      ]}
    />
  );
}
