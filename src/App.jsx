import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  Badge, Button, Clouds, Countdown, DayTimeline, FAQ, Footer, JellyDrip, NavBar, PeanutAmount, RegistrationForm, StatTile,
} from './design-system/components.jsx';
import { EVENT, DAYS, FAQS } from './content.js';

const Stage = lazy(() => import('./scene/Stage.jsx'));

function useReducedMotion() {
  const q = '(prefers-reduced-motion: reduce)';
  const [r, setR] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setR(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return r;
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// Scroll progress (0–1) through the story wrapper, written to a ref so the 3D scene reads it without re-rendering React.
function useStoryProgress(ref) {
  const progress = useRef(0);
  const [chapter, setChapter] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
      progress.current = p;
      setChapter(Math.round(p * 5));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ref]);
  return [progress, chapter];
}

const NAV = [
  { label: 'The idea', href: '#idea' },
  { label: 'Schedule', href: '#schedule' },
  { label: 'FAQ', href: '#faq' },
];

export default function App() {
  const story = useRef(null);
  const [progress, chapter] = useStoryProgress(story);
  const reduced = useReducedMotion();
  const [gl, setGl] = useState(true);
  useEffect(() => setGl(webglAvailable()), []);

  return (
    <div className="page" data-chapter={chapter}>
      <header className="topbar">
        <NavBar
          links={NAV}
          cta={{ label: 'Register', href: '#register' }}
          homeHref="#top"
          logo={{ src: '/brand/founders-club.png', alt: 'Founders Club home' }}
        />
      </header>

      <div className="story" ref={story}>
        {/* Pinned to the top of the page, not the sticky stage, so it scrolls away. */}
        <JellyDrip className="story-drip" />
        <div className="stage" aria-hidden="true">
          <Clouds variant="hero" className="stage-clouds" />
          {gl ? (
            <Suspense fallback={null}>
              <Stage progressRef={progress} reduced={reduced} />
            </Suspense>
          ) : null}
          <ol className="progress-rail">
            {['Start', 'Why', 'P', 'B', 'J', 'Jump'].map((l, i) => (
              <li key={l} className={i === chapter ? 'on' : undefined}>{l}</li>
            ))}
          </ol>
        </div>

        {/* 0 · Hero */}
        <section className="chapter chapter-hero" id="top">
          <div className="copy">
            <Badge tone="jelly">Founders Club · Startupathon</Badge>
            <h1 className="hero-title">Pitch, Build<span>and Jump</span></h1>
            <p className="lead">Three days to build a real startup: pitch it, fund it, ship it, and prove that people want it.</p>
            <div className="actions">
              <Button size="lg" href="#register">Register your team</Button>
              <Button size="lg" variant="secondary" href="#idea">See how it works</Button>
            </div>
            <div className="meta">
              <Badge tone="cloud">{EVENT.dates}</Badge>
              <Badge tone="cloud">Teams of 2–4</Badge>
              <Badge tone="cloud">₹{EVENT.fee} per team</Badge>
            </div>
            <p className="scroll-hint">Scroll to take it apart</p>
          </div>
        </section>

        {/* 1 · The problem */}
        <section className="chapter" id="idea">
          <div className="copy panel">
            <p className="eyebrow">Why PBJ</p>
            <h2>Campus events stop before the hard part.</h2>
            <p>An ideathon ends at a slide. A hackathon ends at a prototype nobody uses. Startups rarely fail at the idea or the code: they fail at raising money, spending it well, and finding people who want the product.</p>
            <p><strong>PBJ is three days of the parts that are usually skipped.</strong></p>
          </div>
        </section>

        {/* 2 · P — Pitch */}
        <section className="chapter">
          <div className="copy panel">
            <p className="letter" aria-hidden="true">P</p>
            <p className="eyebrow">Day 1 · Pitch</p>
            <h2>Ninety seconds to make your room believe.</h2>
            <p>Every team pitches to the other teams in its room. Then the room invests. Your ₹{EVENT.fee} fee comes back as <PeanutAmount value={100000} size="sm" unit />, and you must put 20,000–40,000 of them into teams you believe in.</p>
            <ul className="facts">
              <li>Funding lands in a team’s wallet the moment someone invests.</li>
              <li>Share prices rise live on the projector after every window.</li>
              <li>Back the teams that score well and you earn Peanuts back.</li>
            </ul>
          </div>
        </section>

        {/* 3 · B — Build */}
        <section className="chapter">
          <div className="copy panel">
            <p className="letter" aria-hidden="true">B</p>
            <p className="eyebrow">Day 1 → Day 2 · Build</p>
            <h2>Ship something people can actually use.</h2>
            <p>Build all afternoon and overnight. AI and no-code tools are welcome. Spend Peanuts on mentor slots, design help and user testing. Submit your product link by 8:00 on Day 2, when FC seniors evaluate every team.</p>
            <ul className="facts">
              <li>Judged on the version you submit, not the one in your head.</li>
              <li>Strong scores pay your investors, so funding follows quality.</li>
            </ul>
          </div>
        </section>

        {/* 4 · J — Jump */}
        <section className="chapter">
          <div className="copy panel">
            <p className="letter" aria-hidden="true">J</p>
            <p className="eyebrow">Day 2 → Day 3 · Jump</p>
            <h2>Go out and win real users.</h2>
            <p>Every team gets its own PBJ link. A student signs in with their college account, is counted once, and lands on your product. Fake sign-ups and other participants don’t count.</p>
            <ul className="facts">
              <li>Buy Founders Club posts and broadcasts with your Peanuts.</li>
              <li>The top 15 by evaluation and verified users reach the finals.</li>
            </ul>
          </div>
        </section>

        {/* 5 · Finale */}
        <section className="chapter chapter-finale">
          <div className="copy panel">
            <p className="eyebrow">Day 3 · Finals</p>
            <h2>Put it together, then jump.</h2>
            <p>Finalists pitch to the Directorate of Entrepreneurship and Innovation with their users, cost per user and returning users. Winners are pre-incubated by DEI.</p>
            <div className="actions">
              <Button size="lg" href="#register">Register your team</Button>
            </div>
          </div>
        </section>
      </div>

      <main className="after">
        <section className="band" id="schedule">
          <div className="band-inner">
            <div className="band-head">
              <p className="eyebrow">{EVENT.dates}</p>
              <h2 className="display-l">Three days, one startup.</h2>
            </div>
            <div className="stats">
              <StatTile value="3" label="days, within college hours" />
              <StatTile value="130+" label="teams expected" />
              <StatTile value="400+" label="students expected" />
              <StatTile value="15" label="finalists pitch to DEI" tone="inverse" />
            </div>
            <DayTimeline days={DAYS} />
            <Countdown to={EVENT.startISO} label="PBJ starts in" />
          </div>
        </section>

        <section className="band band-surface" id="faq">
          <div className="band-inner narrow">
            <div className="band-head">
              <p className="eyebrow">Questions</p>
              <h2 className="heading">Before you register</h2>
            </div>
            <FAQ items={FAQS} openFirst />
          </div>
        </section>

        <section className="band" id="register">
          <div className="band-inner narrow">
            <RegistrationForm />
            <p className="note">Registration is a preview: the form checks your details but doesn’t send them anywhere yet.</p>
          </div>
        </section>
      </main>

      <Footer
        logos={[
          { src: '/brand/founders-club.png', alt: 'Founders Club', height: 72 },
          { src: '/brand/dei-logo-on-dark.png', alt: 'Directorate of Entrepreneurship and Innovation', height: 64 },
        ]}
        note="PBJ is organised by Founders Club under the Directorate of Entrepreneurship and Innovation, SRM Institute of Science and Technology."
        columns={[
          { title: 'Event', links: [{ label: 'The idea', href: '#idea' }, { label: 'Schedule', href: '#schedule' }, { label: 'FAQ', href: '#faq' }] },
          { title: 'Teams', links: [{ label: 'Register', href: '#register' }, { label: 'Back to top', href: '#top' }] },
        ]}
      />
    </div>
  );
}
