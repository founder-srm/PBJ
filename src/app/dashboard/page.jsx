import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Button, JellyDrip, PeanutAmount } from '../../design-system/components.jsx';
import SignOutButton from '../../components/SignOutButton.jsx';
import { SiteFooter, SiteHeader } from '../../site.jsx';
import { EVENT } from '../../content.js';
import { sql } from '../../lib/db.js';
import { getViewer } from '../../lib/viewer.js';
import { NEXT_STEP } from './next-step.js';
import './dashboard.css';

export const metadata = { title: 'Dashboard · PBJ' };
export const dynamic = 'force-dynamic';

const STATUS = {
  registered: { tone: 'cloud', label: 'Registered · fee pending' },
  paid: { tone: 'gain', label: 'Paid · ready to play' },
  finalist: { tone: 'jelly', label: 'Finalist' },
  winner: { tone: 'jelly', label: 'Winner' },
  withdrawn: { tone: 'cloud', label: 'Withdrawn' },
  disqualified: { tone: 'cloud', label: 'Disqualified' },
};

// Sidebar items. The selected one comes from ?view=; the first (home) is the default.
const VIEWS = [
  { id: 'home', label: 'Home' },
  { id: 'shop', label: 'Shop' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'team', label: 'Team Details' },
];

const opensOn = `Opens ${EVENT.dates.split('–')[0]} Feb`;

export default async function DashboardPage({ searchParams }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  if (!viewer.teamId) redirect('/register');

  const { view: requested } = await searchParams;
  const view = VIEWS.find((v) => v.id === requested)?.id ?? VIEWS[0].id;

  const [team] = await sql`
    select t.name, t.slug, t.status, t.size, t.created_at, r.name as room, b.balance
    from teams t
    left join rooms r on r.id = t.room_id
    join team_balances b on b.team_id = t.id
    where t.id = ${viewer.teamId}`;
  const members = view === 'team'
    ? await sql`
        select position, name, ra_number, college_email from team_members
        where team_id = ${viewer.teamId} order by position`
    : [];
  const status = STATUS[team.status] ?? STATUS.registered;
  const next = NEXT_STEP[team.status] ?? NEXT_STEP.registered;
  const firstName = viewer.name.split(' ')[0] || 'there';

  return (
    <div className="dash-shell">
      <aside className="dash-side">
        <p className="dash-side-title">Dashboard</p>
        <nav className="dash-side-nav" aria-label="Dashboard sections">
          {VIEWS.map((v) => (
            <Link
              key={v.id}
              href={v.id === VIEWS[0].id ? '/dashboard' : `/dashboard?view=${v.id}`}
              scroll={false}
              className="dash-side-link"
              aria-current={v.id === view ? 'page' : undefined}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        <div className="dash-side-foot">
          <p className="note">Signed in as {viewer.email}</p>
          <SignOutButton />
        </div>
      </aside>

      <div className="page page-plain">
        <JellyDrip className="page-drip" />
        <SiteHeader />
        <main className="plain-main">
          <div className="plain-inner dash">
            {view === 'home' ? (
              <>
                <div className="band-head">
                  <p className="eyebrow">Dashboard · {EVENT.dates}</p>
                  <h1 className="display-l">{team.name}</h1>
                  <div className="dash-wallet-line">
                    <PeanutAmount value={Number(team.balance)} size="md" unit />
                  </div>
                  <p className="plain-lead">Welcome, {firstName}. This is your team’s home for PBJ.</p>
                  <div className="meta">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <Badge tone="cloud">{team.room ? `Room ${team.room}` : 'Room assigned at check-in'}</Badge>
                  </div>
                </div>

                <section className="pbj pbj-reg dash-card dash-next" aria-labelledby="dash-next-title">
                  <div className="pbj-reg-head">
                    <p className="dash-next-eyebrow">What to do now</p>
                    <h3 id="dash-next-title">{next.title}</h3>
                    <p>{next.body}</p>
                  </div>
                  {next.steps ? (
                    <ol className="wide dash-next-steps">
                      {next.steps.map((s) => <li key={s}>{s}</li>)}
                    </ol>
                  ) : null}
                  {next.action ? (
                    <div className="wide">
                      {next.action.href
                        ? <Button href={next.action.href} target="_blank" rel="noopener noreferrer">{next.action.label}</Button>
                        : <p className="note">{next.action.pending}</p>}
                    </div>
                  ) : null}
                </section>
              </>
            ) : null}

            {view === 'team' ? (
              <section className="dash-view" aria-labelledby="dash-view-title">
                <div className="band-head">
                  <h1 id="dash-view-title" className="dash-view-title">Team Details</h1>
                  <p className="plain-lead">{team.size} members. The leader manages the team from this login.</p>
                </div>
                <ol className="dash-members">
                  {members.map((m) => (
                    <li key={m.position}>
                      <span className="dash-member-name">{m.name}{m.position === 1 ? <Badge tone="jelly">Leader</Badge> : null}</span>
                      <span className="dash-member-meta">{m.ra_number} · {m.college_email}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {view === 'shop' ? (
              <section className="dash-view" aria-labelledby="dash-view-title">
                <div className="band-head">
                  <h1 id="dash-view-title" className="dash-view-title">Shop <Badge tone="cloud">{opensOn}</Badge></h1>
                  <p className="plain-lead">Spend Peanuts on mentor slots, design help, user testing and FC promotion.</p>
                </div>
              </section>
            ) : null}

            {view === 'leaderboard' ? (
              <section className="dash-view" aria-labelledby="dash-view-title">
                <div className="band-head">
                  <h1 id="dash-view-title" className="dash-view-title">Leaderboard <Badge tone="cloud">{opensOn}</Badge></h1>
                  <p className="plain-lead">Live share prices, funding raised and verified users.</p>
                </div>
              </section>
            ) : null}
          </div>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
