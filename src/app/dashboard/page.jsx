import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, JellyDrip, PeanutAmount } from '../../design-system/components.jsx';
import SignOutButton from '../../components/SignOutButton.jsx';
import { SiteFooter, SiteHeader } from '../../site.jsx';
import { sql } from '../../lib/db.js';
import { getSchedule, getSettings, formatDate } from '../../lib/event.js';
import { checkDriveLink } from '../../lib/drive.js';
import { getLiveState } from '../../lib/live.js';
import { effectiveStage } from '../../lib/stage.js';
import { getViewer } from '../../lib/viewer.js';
import HomeStage, { STAGE_BADGE, formatEventDates } from './HomeStage.jsx';
import './dashboard.css';

export const metadata = { title: 'Dashboard · PBJ' };
export const dynamic = 'force-dynamic';

// Sidebar items. The selected one comes from ?view=; the first (home) is the default.
const VIEWS = [
  { id: 'home', label: 'Home' },
  { id: 'shop', label: 'Shop' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'team', label: 'Team Details' },
];

export default async function DashboardPage({ searchParams }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  if (!viewer.teamId) redirect('/register');

  const { view: requested } = await searchParams;
  const view = VIEWS.find((v) => v.id === requested)?.id ?? VIEWS[0].id;

  const [schedule, settings] = await Promise.all([getSchedule(), getSettings()]);
  const [team] = await sql`
    select t.name, t.slug, t.stage, t.size, t.team_code, t.pitch_video_url, t.created_at, r.name as room, b.balance
    from teams t
    left join rooms r on r.id = t.room_id
    join team_balances b on b.team_id = t.id
    where t.id = ${viewer.teamId}`;
  const members = view === 'team'
    ? await sql`
        select position, name, ra_number, college_email from team_members
        where team_id = ${viewer.teamId} order by position`
    : [];
  const stage = effectiveStage(team.stage, schedule);
  const badge = STAGE_BADGE[stage];
  const live = view === 'home' && stage === 'live' ? await getLiveState(viewer.teamId) : null;
  // Re-check the video's sharing while it's under review, in case the team made it private after submitting.
  const videoAccess = view === 'home' && stage === 'in_review' && team.pitch_video_url ? await checkDriveLink(team.pitch_video_url) : null;
  const opensOn = `Opens ${formatDate(schedule.event.startsAt).replace(/ \d{4}$/, '')}`;
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
                  <p className="eyebrow">Dashboard</p>
                  <h1 className="display-l">{team.name}</h1>
                  <div className="dash-wallet-line">
                    <PeanutAmount value={Number(team.balance)} size="md" unit />
                  </div>
                  <p className="plain-lead">Welcome, {firstName}. This is your team’s home for PBJ.</p>
                  <div className="meta">
                    {badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null}
                    {team.room ? <Badge tone="cloud">Venue: {team.room}</Badge> : null}
                  </div>
                </div>

                <HomeStage stage={stage} team={team} schedule={schedule} settings={settings} live={live} videoAccess={videoAccess} />
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
