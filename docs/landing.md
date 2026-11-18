# Landing page

Owner area: **Landing** (`src/HomePage.jsx`, `src/scene/*`, `src/content.js`, the Story / After-the-story / compact sections of `src/styles.css`).

Route `/` → `src/app/page.jsx` → `src/HomePage.jsx` (client component, prerendered as static HTML).

## Content first

Event facts live in `src/content.js`. Edit copy there before touching JSX.

- `EVENT`: `{ dates: '15–17 February 2027', startISO, fee: 200 }`. Dates are **tentative** until Founders Club confirms. Every page reads dates and the fee from here.
- `DAYS`: three `{ label, date, title, body, items: [{ time, label }] }` for `DayTimeline`.
- `FAQS`: `{ q, a }` for `FAQ`.

Chapter copy (hero, problem, P, B, J, finale) is inline in `HomePage.jsx`.

## Page structure

```
SiteHeader (fixed)
.story                      six chapters, each ~one screen tall
  .stage (sticky)           Clouds + 3D Stage + progress rail (Start, Why, P, B, J, Jump)
  JellyDrip .story-drip     pinned to the top of the page; scrolls away (not to the screen)
  section.chapter ×6        hero (#top), problem (#idea), Pitch, Build, Jump, finale
main.after
  #schedule                 stats, DayTimeline, Countdown (centred, enlarged via .schedule-countdown)
  #faq                      FAQ
SiteFooter
```

Rules from the owner: the jelly drip appears **once**, at the top of the page, and does not follow the viewport. Hero and navbar CTAs come from `TeamCta` / `SiteHeader` (Login → Register → Dashboard by state; see `docs/auth.md`).

## Two layouts

`HomePage.jsx` picks a layout with `useNarrow()` (`(max-width: 1023px)`, kept in sync with a media query in `styles.css`), exposed as `data-layout="story|compact"` on `.page`.

- **story** (≥ 1024px): the sticky 3D stage plays the scroll story behind the chapter panels.
- **compact** (< 1024px): no scroll story. The hero gets its own box (`HeroSandwich` → `Stage compact`), where the whole sandwich turns slowly; it stops rendering when scrolled off-screen (`IntersectionObserver` → `active={false}`).

`useNarrow()` returns `null` until measured, so neither 3D version renders on the server.

> This compact layout was added while these docs were being written. If the code and this section disagree, the code wins: update this section.

## The 3D scene (`src/scene/`)

- `Stage.jsx` (default export `Stage`): `<Canvas>` with lights, environment and the sandwich. Props: `progressRef` (ref holding 0–1 scroll progress), `reduced` (reduced motion), `compact`, `active` (frameloop on/off), `className`.
- **Keyframes:** `K` in `Stage.jsx`, one row per chapter, each layer `[position, rotation (radians), scale]`. Chapter order: 0 hero (whole) · 1 problem (loosened) · 2 Pitch (spread) · 3 Build (bread) · 4 Jump (jelly, wobbling) · 5 finale (whole, then a hop). Layers ease toward the current keyframe every frame.
- `sandwich.js`: `buildSandwich({ lite })` generates geometry and canvas textures in code (no model files); `DIM` holds layer thicknesses; `blobShadowTexture()` makes the soft floor shadow. Tune colours, thickness and how far fillings ooze here.
- **Performance:** `lite` mode (phones, ≤ 4 cores, compact) lowers textures and DPR. Without WebGL the page works with no 3D. With reduced motion the sandwich stays still and whole.
- Scroll progress is written to a ref (`useStoryProgress`) so the scene reads it without React re-renders; only the chapter index is state.

## Gotchas

- Anything reading `window`/`matchMedia` starts neutral and updates in an effect (hydration).
- The stage is sticky with a negative bottom margin; chapters scroll over it. Z-order: stage 0, drip 2, rail 3, chapters 4, topbar 30.
- `scroll-padding-top` in `styles.css` keeps anchor links (`/#idea`, `/#schedule`, `/#faq`) clear of the fixed navbar.
