import { JellyDrip } from '../../design-system/components.jsx';
import { requireJudge } from '../../lib/judge.js';
import { SiteFooter, SiteHeader } from '../../site.jsx';
import '../admin/admin.css';
import './judge.css';

export const metadata = { title: 'Judging · PBJ' };
export const dynamic = 'force-dynamic';

// Judges only (users.role = 'judge' or 'admin'). Reuses the admin page styles.
export default async function JudgeLayout({ children }) {
  const judge = await requireJudge();
  return (
    <div className="page page-plain">
      <JellyDrip className="page-drip" />
      <SiteHeader />
      <main className="plain-main">
        <div className="admin">
          <div className="admin-top">
            <p className="eyebrow">Judging · {judge.email}</p>
          </div>
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
