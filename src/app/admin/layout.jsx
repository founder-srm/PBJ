import Link from 'next/link';
import { JellyDrip } from '../../design-system/components.jsx';
import { requireOrganiser } from '../../lib/admin.js';
import { SiteFooter, SiteHeader } from '../../site.jsx';
import './admin.css';

export const metadata = { title: 'Admin · PBJ' };
export const dynamic = 'force-dynamic';

const LINKS = [
  ['/admin/teams', 'Teams'],
  ['/admin/payments', 'Payments'],
  ['/admin/venues', 'Venues'],
  ['/admin/judging', 'Judging results'],
  ['/admin/judges', 'Judging setup'],
  ['/admin/schedule', 'Schedule'],
];

// Organisers and admins only (users.role). Every action re-checks the role too.
export default async function AdminLayout({ children }) {
  const org = await requireOrganiser();
  return (
    <div className="page page-plain">
      <JellyDrip className="page-drip" />
      <SiteHeader />
      <main className="plain-main">
        <div className="admin">
          <div className="admin-top">
            <p className="eyebrow">Admin · {org.email}</p>
            <nav className="admin-nav" aria-label="Admin">
              {LINKS.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
            </nav>
          </div>
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
