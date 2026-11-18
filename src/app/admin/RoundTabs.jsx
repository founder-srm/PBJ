import Link from 'next/link';
import { formatDateTime } from '../../lib/event.js';

const STATE = { open: 'Open now', upcoming: 'Upcoming', closed: 'Closed' };

// Links to switch between judging rounds (?round=<id>), each with its state. Used by /admin and /judge pages.
export default function RoundTabs({ rounds, current, base }) {
  if (!rounds.length) return null;
  return (
    <nav className="admin-rounds" aria-label="Judging rounds">
      {rounds.map((r) => (
        <Link key={r.id} href={`${base}?round=${r.id}`} aria-current={r.id === current?.id ? 'page' : undefined} className="admin-round">
          <span className="admin-round-name">{r.name}</span>
          <span className="admin-round-meta">
            <span className={`admin-state is-${r.state}`}>{STATE[r.state]}</span>
            {formatDateTime(r.startsAt)}
          </span>
        </Link>
      ))}
    </nav>
  );
}
