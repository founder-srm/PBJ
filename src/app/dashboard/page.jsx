import { redirect } from 'next/navigation';
import { Badge, JellyDrip, PeanutAmount } from '../../design-system/components.jsx';
import SignOutButton from '../../components/SignOutButton.jsx';
import { SiteFooter, SiteHeader } from '../../site.jsx';
import { EVENT } from '../../content.js';
import { sql } from '../../lib/db.js';
import { getViewer } from '../../lib/viewer.js';

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

export default async function DashboardPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  if (!viewer.teamId) redirect('/register');

  const [team] = await sql`
    select t.name, t.slug, t.status, t.size, t.created_at, r.name as room, b.balance
    from teams t
    left join rooms r on r.id = t.room_id
    join team_balances b on b.team_id = t.id
    where t.id = ${viewer.teamId}`;
  const members = await sql`
    select position, name, ra_number, college_email from team_members
    where team_id = ${viewer.teamId} order by position`;
  const status = STATUS[team.status] ?? STATUS.registered;
  const firstName = viewer.name.split(' ')[0] || 'there';

  return (
    <div className="page page-plain">
      <JellyDrip className="page-drip" />
      <SiteHeader />
      <main className="plain-main">
        <div className="plain-inner dash">
          <div className="band-head">
            <p className="eyebrow">Dashboard · {EVENT.dates}</p>
            <h1 className="display-l">{team.name}</h1>
            <p className="plain-lead">Welcome, {firstName}. This is your team’s home for PBJ: your Peanuts, the shop and the leaderboard all live here.</p>
            <div className="meta">
              <Badge tone={status.tone}>{status.label}</Badge>
              <Badge tone="cloud">{team.room ? `Room ${team.room}` : 'Room assigned at check-in'}</Badge>
            </div>
          </div>

          <div className="dash-grid">
            <section className="pbj pbj-reg dash-card dash-wallet">
              <div className="pbj-reg-head">
                <h3>Wallet</h3>
                <p>{team.status === 'registered' ? `Pay the ₹${EVENT.fee} team fee at check-in to receive 100,000 Peanuts.` : 'Peanuts your team can invest and spend.'}</p>
              </div>
              <div className="wide"><PeanutAmount value={Number(team.balance)} size="lg" unit /></div>
            </section>

            <section className="pbj pbj-reg dash-card">
              <div className="pbj-reg-head">
                <h3>Team</h3>
                <p>{team.size} members. The leader manages the team from this login.</p>
              </div>
              <ol className="wide dash-members">
                {members.map((m) => (
                  <li key={m.position}>
                    <span className="dash-member-name">{m.name}{m.position === 1 ? <Badge tone="jelly">Leader</Badge> : null}</span>
                    <span className="dash-member-meta">{m.ra_number} · {m.college_email}</span>
                  </li>
                ))}
              </ol>
            </section>

            {[
              ['Invest', 'Back other teams in your room after the Day 1 pitches.'],
              ['Shop', 'Spend Peanuts on mentor slots, design help, user testing and FC promotion.'],
              ['Leaderboard', 'Live share prices, funding raised and verified users.'],
            ].map(([title, body]) => (
              <section key={title} className="pbj pbj-reg dash-card dash-soon">
                <div className="pbj-reg-head">
                  <h3>{title} <Badge tone="cloud">Opens {EVENT.dates.split('–')[0]} Feb</Badge></h3>
                  <p>{body}</p>
                </div>
              </section>
            ))}
          </div>

          <div className="dash-foot">
            <p className="note">Signed in as {viewer.email}</p>
            <SignOutButton />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
