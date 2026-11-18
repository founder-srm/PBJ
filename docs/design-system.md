# Design system and styling

Owner area: **Design system** (`src/design-system/*`, `scripts/build-tokens.mjs`). Everyone uses it.

The PBJ Design System lives as a Claude artifact ("PBJ Design System", https://claude.ai/artifact/HpZfMPzFQjMByRvhuKgezp). `src/design-system/` is a port of it: `tokens.json` copied from the artifact, `components.jsx`/`components.css` ported from its bundle. When the two disagree, the artifact is the reference for brand decisions; this repo is the reference for code.

## Tokens

- Source: `src/design-system/tokens.json`. Generated: `tokens.css` (by `npm run tokens`, which `dev`/`build` run first). **Never edit `tokens.css`.**
- Colours (each has light and dark values): `sky` (page background), `surface`, `cloud` (cards), `line`, `line-strong`, `ink`, `ink-muted`, `jelly` (accent, primary buttons), `on-jelly`, `jelly-text` (jelly for text), `jelly-soft`, `butter`, `butter-soft`, `butter-text`, `gain`, `gain-soft`, `inverse`, `on-inverse`, `on-inverse-accent`, `focus`.
- Also spacing (`--space-1, -2, -3, -4, -6, -8, -12, -16, -24` only: there is no `--space-5` or `--space-10`), radius (`--radius-sm/md/lg/pill`), shadow (`--shadow-cloud`), fonts (`--font-display` Rubik, `--font-sans` DM Sans).
- Use as `var(--name)`. Jelly as text only at large/bold sizes; on `sky` it's a fill, not text.

## Theme

`<html data-theme="light|dark">` is set before paint from the OS preference (script in `src/app/layout.jsx`). `tokens.css` defines both themes. Don't use `@media (prefers-color-scheme)` for colours in new CSS; just use tokens.

## Components (`src/design-system/components.jsx`, `'use client'`)

| Component | Key props | Notes |
| --- | --- | --- |
| `Button` | `variant` primary/secondary/ghost, `size` md/lg, `href` (renders `<a>`), rest → element | Primary = jelly; hover darkens |
| `Badge` | `tone` soft/jelly/cloud/butter/gain | Small uppercase pill |
| `NavBar` | `links`, `cta {label, href}`, `actions` (node after CTA), `homeHref`, `logo {src, alt}` | Collapses to Menu below 760px |
| `Footer` | `logos`, `note`, `columns [{title, links}]` | |
| `JellyDrip` | `height`, `className` | Decorative top drip; use once per page, at the top |
| `Clouds` | `variant` | Hero background clouds |
| `Card` | `eyebrow`, `title`, `tone`, `footer` | |
| `FAQ` | `items [{q, a}]`, `openFirst` | |
| `DayTimeline` | `days`, `current` | Schedule |
| `StatTile` | `value`, `label`, `tone` | |
| `Countdown` | `to` (ISO), `label`, `doneLabel` | Renders `--` until mounted (hydration-safe) |
| `Field` | `label`, `hint`, `error`, `id` | Wires `aria-invalid`/`aria-describedby` onto its child |
| `Input` | `as` input/select/textarea, `options` | Class `pbj-input` |
| `PeanutAmount` | `value`, `size` sm/md/lg, `signed`, `unit` | The currency display; always use it for Peanuts |
| `RegistrationForm` | | **Legacy, unused.** The live form is `src/components/RegistrationForm.jsx`. Don't build on this one. |

Changing components: add new components or new optional props. Don't change existing defaults or prop meanings: the landing, login, register, dashboard and 404 pages all depend on them.

Shared CSS classes worth reusing: `.pbj-reg` (the cloud card used for forms and dashboard cards), `.pbj-reg-head`, `.pbj-field`, `.pbj-input`, `.pbj-check`, `.pbj-btn*`.

## Page CSS

- `src/app/layout.jsx` imports, in order: `tokens.css`, `components.css`, `src/styles.css`.
- `src/styles.css` holds page-level styles in commented sections: base, Top bar, Story (landing), After the story (bands, schedule, countdown), Simple pages (`.page-plain`, `.plain-main`, `.plain-inner`: the shared layout for register/login/dashboard/404), registration form (`.reg-*`), Login (`.signin-*`), Dashboard (`.dash-*`), 404 (`.nf-*`), responsive blocks.
- **New pages/areas:** put styles in a CSS file beside the route and import it from the page (e.g. `import './shop.css'` in `src/app/shop/page.jsx`). Prefix classes with the area (`.shop-…`). This keeps `styles.css` from becoming a merge hotspot.
- Reuse the simple-page skeleton for new pages:

```jsx
<div className="page page-plain">
  <JellyDrip className="page-drip" />
  <SiteHeader />
  <main className="plain-main">
    <div className="plain-inner">…</div>
  </main>
  <SiteFooter />
</div>
```

## Layout rules

- Works at 390px with a 16px gutter and no horizontal scroll; check 1024 and 1440 too.
- Wide screens shouldn't leave a narrow column stranded on one side: centre it or use a two-column split (see `.signin-page`).
- Breakpoints in use: 1100px (tablet), 960px (login split), 860, 760 (phone/nav collapse), 640, 480.
- Respect `prefers-reduced-motion` for animation.
