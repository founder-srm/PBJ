'use client';

// PBJ Design System components, ported from the design system's bundle.js to ES modules.
// Styles live in components.css; every colour, size and radius comes from tokens.css.
import { useEffect, useId, useState, isValidElement, cloneElement } from 'react';

const cx = (...a) => a.filter(Boolean).join(' ');
export const fmt = (n, locale = 'en-US') => Number(n || 0).toLocaleString(locale);

/* ---------- Motifs ---------- */
const DRIPS = [[138, 28, 52, 18], [402, 34, 74, 22], [598, 22, 38, 14], [964, 30, 60, 19], [1270, 24, 44, 16], [1500, 34, 68, 22], [1760, 26, 48, 17]];
const POOLS = [[80, 60, 10], [330, 70, 12], [800, 90, 11], [1150, 60, 9], [1420, 80, 12], [1860, 70, 10]];
export function JellyDrip({ height, className }) {
  return (
    <svg className={cx('pbj-drip', className)} viewBox="0 0 1920 100" preserveAspectRatio="xMinYMin slice" aria-hidden="true" style={height ? { height } : undefined}>
      <rect x="0" y="0" width="1920" height="20" />
      {POOLS.map((d, i) => <ellipse key={'p' + i} cx={d[0]} cy="20" rx={d[1]} ry={d[2]} />)}
      {DRIPS.map((d, i) => (
        <g key={'d' + i}>
          <rect x={d[0]} y="0" width={d[1]} height={d[2]} rx={d[1] / 2} />
          <circle cx={d[0] + d[1] / 2} cy={d[2] + 2} r={d[3]} />
        </g>
      ))}
      {[[419, 72], [1517, 66], [979, 58]].map((s, i) => <ellipse key={'s' + i} className="shine" cx={s[0] - 7} cy={s[1]} rx="5" ry="9" />)}
    </svg>
  );
}

const CLOUD_SETS = {
  hero: [['70%', '18%', 0.55, 0.75], ['58%', '62%', 1.05, 0.95], ['86%', '40%', 0.7, 0.85], ['-10%', '94%', 0.5, 0.5]],
  band: [['78%', '-20%', 0.5, 0.7], ['-4%', '60%', 0.55, 0.5]],
  quiet: [['82%', '8%', 0.4, 0.6]],
};
export function Clouds({ variant = 'hero', className }) {
  const set = CLOUD_SETS[variant] || CLOUD_SETS.hero;
  return (
    <div className={cx('pbj-clouds', className)} aria-hidden="true">
      {set.map(([x, y, s, op], i) => (
        <svg key={i} viewBox="0 0 440 200" width={440 * s} height={200 * s} style={{ left: x, top: y, opacity: op }}>
          <g className="c">
            <ellipse cx="220" cy="150" rx="210" ry="50" /><circle cx="140" cy="120" r="70" />
            <circle cx="240" cy="90" r="90" /><circle cx="340" cy="130" r="60" />
          </g>
        </svg>
      ))}
    </div>
  );
}

/* ---------- Marketing ---------- */
export function Button({ variant = 'primary', size = 'md', className, href, children, ...rest }) {
  const cls = cx('pbj', 'pbj-btn', 'pbj-btn-' + variant, size === 'lg' && 'pbj-btn-lg', className);
  if (href) return <a {...rest} href={href} className={cls}>{children}</a>;
  return <button type="button" {...rest} className={cls}>{children}</button>;
}

export function Badge({ tone = 'soft', className, children }) {
  return <span className={cx('pbj', 'pbj-badge', 'pbj-badge-' + tone, className)}>{children}</span>;
}

// `logo` ({ src, alt }) replaces the PBJ wordmark with an image mark.
// `actions` renders extra controls after the CTA (e.g. a log-out button).
export function NavBar({ links = [], cta, actions, homeHref = '#', logo, className }) {
  const [open, setOpen] = useState(false);
  return (
    <nav className={cx('pbj', 'pbj-nav', open && 'open', className)} aria-label="Main">
      <a className={cx('pbj-nav-mark', logo && 'pbj-nav-mark-img')} href={homeHref}>
        {logo ? <img src={logo.src} alt={logo.alt} /> : <>PB<span>J</span></>}
      </a>
      <button className="pbj-nav-toggle" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close' : 'Menu'}</button>
      <ul className="pbj-nav-links">
        {links.map((l, i) => (
          <li key={i}><a href={l.href || '#'} aria-current={l.active ? 'page' : undefined} onClick={() => setOpen(false)}>{l.label}</a></li>
        ))}
      </ul>
      {cta ? <Button href={cta.href || '#'}>{cta.label}</Button> : null}
      {actions}
    </nav>
  );
}

export function Card({ eyebrow, title, tone, footer, className, children }) {
  return (
    <article className={cx('pbj', 'pbj-card', tone === 'inverse' && 'pbj-card-inverse', className)}>
      {eyebrow ? <p className="pbj-card-eyebrow">{eyebrow}</p> : null}
      {title ? <h3 className="pbj-card-title">{title}</h3> : null}
      {children ? <div className="pbj-card-body">{children}</div> : null}
      {footer ? <div className="pbj-card-foot">{footer}</div> : null}
    </article>
  );
}

export function FAQ({ items = [], openFirst, className }) {
  return (
    <div className={cx('pbj', 'pbj-faq', className)}>
      {items.map((it, i) => (
        <details key={i} open={openFirst && i === 0 ? true : undefined}>
          <summary>{it.q}</summary>
          <div>{it.a}</div>
        </details>
      ))}
    </div>
  );
}

export function Footer({ logos = [], note, columns = [], className }) {
  return (
    <footer className={cx('pbj', 'pbj-footer', className)}>
      <div className="pbj-footer-brand">
        {logos.length ? (
          <div className="pbj-footer-logos">
            {logos.map((l, i) => <img key={i} src={l.src} alt={l.alt} style={l.height ? { height: l.height } : undefined} />)}
          </div>
        ) : null}
        {note ? <p className="pbj-footer-note">{note}</p> : null}
      </div>
      {columns.map((c, i) => (
        <div key={i}>
          <h3>{c.title}</h3>
          <ul>{c.links.map((l, j) => <li key={j}><a href={l.href || '#'}>{l.label}</a></li>)}</ul>
        </div>
      ))}
    </footer>
  );
}

/* ---------- Event ---------- */
export function DayTimeline({ days = [], current, className }) {
  return (
    <ol className={cx('pbj', 'pbj-timeline', className)}>
      {days.map((d, i) => (
        <li key={i} className={cx('pbj-day', current === i && 'is-current')} aria-current={current === i ? 'step' : undefined}>
          <div className="pbj-day-head"><span className="pbj-day-label">{d.label}</span>{d.date ? <span className="pbj-day-date">{d.date}</span> : null}</div>
          <h3>{d.title}</h3>
          {d.body ? <p>{d.body}</p> : null}
          {d.items?.length ? <ul>{d.items.map((it, j) => <li key={j}><b>{it.time}</b>{it.label}</li>)}</ul> : null}
        </li>
      ))}
    </ol>
  );
}

export function StatTile({ value, label, tone, className }) {
  return (
    <div className={cx('pbj', 'pbj-stat', tone === 'inverse' && 'pbj-stat-inverse', className)}>
      <span className="pbj-stat-value">{value}</span>
      <span className="pbj-stat-label">{label}</span>
    </div>
  );
}

function remaining(to) {
  const ms = Math.max(0, new Date(to).getTime() - Date.now());
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60, done: ms === 0 };
}
export function Countdown({ to, label, doneLabel = 'We’re live', className }) {
  // null until mounted: the page is pre-rendered, so the time left is only known in the browser.
  const [t, setT] = useState(null);
  useEffect(() => {
    const tick = () => setT(remaining(to));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [to]);
  const pad = (n) => (n < 10 ? '0' + n : String(n));
  const units = [['Days', t ? String(t.d) : '--'], ['Hours', t ? pad(t.h) : '--'], ['Mins', t ? pad(t.m) : '--'], ['Secs', t ? pad(t.s) : '--']];
  return (
    <div className={cx('pbj', 'pbj-countdown', className)} role="timer" aria-label={t ? `${label}: ${t.d} days ${t.h} hours ${t.m} minutes` : label}>
      {label ? <span className="pbj-countdown-label">{t?.done ? doneLabel : label}</span> : null}
      <div className="pbj-countdown-units" aria-hidden="true">
        {units.map(([u, v]) => <div key={u} className="pbj-countdown-unit"><b>{v}</b><span>{u}</span></div>)}
      </div>
    </div>
  );
}

/* ---------- Forms ---------- */
export function Field({ label, hint, error, id: givenId, className, children }) {
  const auto = useId();
  const id = givenId || auto;
  const hintId = id + '-hint', errId = id + '-err';
  const child = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': cx(hint && hintId, error && errId) || undefined,
      })
    : children;
  return (
    <div className={cx('pbj', 'pbj-field', className)}>
      <label className="pbj-field-label" htmlFor={id}>{label}</label>
      {child}
      {hint ? <span className="pbj-field-hint" id={hintId}>{hint}</span> : null}
      {error ? <span className="pbj-field-error" id={errId} role="alert">{error}</span> : null}
    </div>
  );
}

export function Input({ as = 'input', options = [], className, ...rest }) {
  if (as === 'select') {
    return (
      <select {...rest} className={cx('pbj-input', className)}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o : { value: o, label: o };
          return <option key={v.value} value={v.value}>{v.label}</option>;
        })}
      </select>
    );
  }
  const Tag = as;
  return <Tag {...rest} className={cx('pbj-input', className)} />;
}

export function RegistrationForm({ onSubmit, emailDomain = 'srmist.edu.in', fee = 200, title = 'Register your team', className }) {
  const init = { team: '', size: '3', lead: '', email: '', members: '', agree: false };
  const [v, setV] = useState(init);
  const [errs, setErrs] = useState({});
  const [done, setDone] = useState(false);
  const set = (k) => (ev) => setV({ ...v, [k]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value });
  const mates = Number(v.size) - 1;

  function submit(ev) {
    ev.preventDefault();
    const x = {};
    if (!v.team.trim()) x.team = 'Give your team a name.';
    if (!v.lead.trim()) x.lead = 'Enter the team lead’s full name.';
    if (!new RegExp('^[^@\\s]+@' + emailDomain.replace(/\./g, '\\.') + '$', 'i').test(v.email.trim())) x.email = `Use your college email ending in @${emailDomain}.`;
    const count = v.members.split(/\n|,/).filter((m) => m.trim()).length;
    if (count !== mates) x.members = `List ${mates} teammate${mates === 1 ? '' : 's'}, one per line.`;
    if (!v.agree) x.agree = 'Accept the rules to register.';
    setErrs(x);
    if (Object.keys(x).length === 0) {
      setDone(true);
      onSubmit?.(v);
    }
  }

  if (done) {
    return (
      <div className={cx('pbj', 'pbj-reg', className)}>
        <div className="pbj-reg-done">
          <Badge tone="gain">Registered</Badge>
          <h3 className="pbj-card-title">{v.team} is in.</h3>
          <p className="pbj-card-body">Pay the ₹{fee} team fee to receive your 100,000 Peanuts. Your room appears on your dashboard.</p>
          <Button variant="secondary" onClick={() => { setDone(false); setV(init); }}>Register another team</Button>
        </div>
      </div>
    );
  }
  return (
    <form className={cx('pbj', 'pbj-reg', className)} onSubmit={submit} noValidate>
      <div className="pbj-reg-head"><h3>{title}</h3><p>Teams of 2–4. ₹{fee} per team, returned as Peanuts.</p></div>
      <Field label="Team name" error={errs.team}><Input id="reg-team" value={v.team} onChange={set('team')} placeholder="Night Owls" autoComplete="off" /></Field>
      <Field label="Team size"><Input id="reg-size" as="select" value={v.size} onChange={set('size')} options={[{ value: '2', label: '2 members' }, { value: '3', label: '3 members' }, { value: '4', label: '4 members' }]} /></Field>
      <Field label="Team lead" error={errs.lead}><Input id="reg-lead" value={v.lead} onChange={set('lead')} autoComplete="name" /></Field>
      <Field label="Lead’s college email" hint="We send the wallet login here." error={errs.email}><Input id="reg-email" type="email" value={v.email} onChange={set('email')} placeholder={'you@' + emailDomain} autoComplete="email" /></Field>
      <Field className="wide" label="Teammates" hint="Name and register number, one per line." error={errs.members}><Input id="reg-members" as="textarea" value={v.members} onChange={set('members')} /></Field>
      <div className="wide pbj-field">
        <label className="pbj-check"><input id="reg-agree" type="checkbox" checked={v.agree} onChange={set('agree')} />I’ve read the PBJ rules. Peanuts are virtual and can’t be exchanged for money.</label>
        {errs.agree ? <span className="pbj-field-error" role="alert">{errs.agree}</span> : null}
      </div>
      <div className="wide"><Button type="submit" size="lg">Register team</Button></div>
    </form>
  );
}

/* ---------- Peanut platform ---------- */
function PeanutGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle className="coin" cx="12" cy="12" r="11" />
      <circle className="ring" cx="12" cy="12" r="8" />
      <path className="swirl" d="M7.5 13.5c1.5-3 4.5-3.5 6-2.2 1.3 1.1.6 3.2-1.2 3.2-1.4 0-1.9-1.2-1.3-2" />
    </svg>
  );
}
export function PeanutAmount({ value = 0, size = 'md', signed, unit, locale, className }) {
  const v = Number(value);
  const sign = signed ? (v > 0 ? '+' : v < 0 ? '−' : '') : v < 0 ? '−' : '';
  const text = sign + fmt(Math.abs(v), locale);
  return (
    <span className={cx('pbj', 'pbj-peanut', 'pbj-peanut-' + size, signed && v > 0 && 'is-gain', signed && v < 0 && 'is-loss', className)} aria-label={text + ' Peanuts'}>
      <PeanutGlyph />
      <span aria-hidden="true">{text}</span>
      {unit ? <span className="pbj-peanut-unit" aria-hidden="true">Peanuts</span> : null}
    </span>
  );
}
