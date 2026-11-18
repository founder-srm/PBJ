'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Badge, Button, Clouds, Countdown, DayTimeline, FAQ, JellyDrip, PeanutAmount, StatTile,
} from './design-system/components.jsx';
import { EVENT, DAYS, FAQS } from './content.js';
import { SiteFooter, SiteHeader, TeamCta } from './site.jsx';

// WebGL only exists in the browser, so the 3D stage is never rendered on the server.
const Stage = dynamic(() => import('./scene/Stage.jsx'), { ssr: false });

function useReducedMotion() {
  const q = '(prefers-reduced-motion: reduce)';
  // Starts false so the server and first client render match; the effect reads the real setting.
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setR(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return r;
}

// Phones and portrait tablets: there is no room for the scroll story, so the sandwich gets its own box in the hero instead.
// Keep in sync with the compact-layout media query in styles.css.
const NARROW = '(max-width: 1023px)';
function useNarrow() {
  const [n, setN] = useState(null); // null until measured, so neither version renders on the server
  useEffect(() => {
    const m = window.matchMedia(NARROW);
    const on = () => setN(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return n;
}

// The whole sandwich, slowly turning, sized to its own box. Stops rendering while scrolled off-screen.
function HeroSandwich({ reduced }) {
  const box = useRef(null);
  const still = useRef(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '100px' });
    if (box.current) io.observe(box.current);
    return () => io.disconnect();
  }, []);
  return (
    <div className="hero-sandwich" ref={box} aria-hidden="true">
      <Stage progressRef={still} reduced={reduced} compact active={visible} className="hero-sandwich-canvas" />
    </div>
  );
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

export default function HomePage() {
  const story = useRef(null);
  const [progress, chapter] = useStoryProgress(story);
  const reduced = useReducedMotion();
  const narrow = useNarrow();
  const [gl, setGl] = useState(true);
  useEffect(() => setGl(webglAvailable()), []);

  return (
    <div className="page" data-chapter={chapter} data-layout={narrow ? 'compact' : 'story'}>
      <SiteHeader />

      <div className="story" ref={story}>
        {/* Pinned to the top of the page, not the sticky stage, so it scrolls away. */}
        <JellyDrip className="story-drip" />
        <div className="stage" aria-hidden="true">
          <Clouds variant="hero" className="stage-clouds" />
          {gl && narrow === false ? <Stage progressRef={progress} reduced={reduced} /> : null}
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
              <TeamCta />
              <Button size="lg" variant="secondary" href="#idea">See how it works</Button>
            </div>
            <div className="meta">
              <Badge tone="cloud">{EVENT.dates}</Badge>
              <Badge tone="cloud">Teams of 2–4</Badge>
              <Badge tone="cloud">₹{EVENT.fee} per team</Badge>
            </div>
            <p className="scroll-hint">Scroll to take it apart</p>
            {gl && narrow ? <HeroSandwich reduced={reduced} /> : null}
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
              <TeamCta />
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
            <Countdown to={EVENT.startISO} label="PBJ starts in" className="schedule-countdown" />
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

      </main>

      <SiteFooter />
    </div>
  );
}
