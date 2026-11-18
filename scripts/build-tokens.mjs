// Compiles the PBJ design system's tokens.json into CSS custom properties.
// Run automatically by `npm run dev` and `npm run build`. Edit tokens.json, never tokens.css.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'design-system');
const t = JSON.parse(readFileSync(join(dir, 'tokens.json'), 'utf8'));
const themes = t.color.themes.map((th) => th.id);
const first = themes[0];
const pick = (v, th) => (typeof v === 'string' ? v : v[th] ?? v[first]);
const resolve = (v) => (/^\{.+\}$/.test(v) ? `var(--${v.slice(1, -1)})` : v);

function themed(th) {
  const lines = [];
  for (const c of t.color.tokens) lines.push(`  --${c.name}: ${resolve(pick(c.value, th))};`);
  for (const s of t.shadow?.tokens ?? []) lines.push(`  --${s.name}: ${pick(s.value, th)};`);
  return lines.join('\n');
}

let css = `/* PBJ Design System — generated from tokens.json */\n`;
css += `:root, [data-theme="${first}"] {\n${themed(first)}\n  color-scheme: light;\n}\n`;
for (const th of themes.slice(1)) {
  css += `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="${first}"]) {\n${themed(th).replace(/^/gm, '  ')}\n    color-scheme: dark;\n  }\n}\n`;
  css += `[data-theme="${th}"] {\n${themed(th)}\n  color-scheme: dark;\n}\n`;
}
css += `:root {\n`;
for (const fam of ['spacing', 'radius']) for (const x of t[fam].tokens) css += `  --${x.name}: ${x.value};\n`;
for (const [k, v] of Object.entries(t.type.families)) css += `  --font-${k}: ${v};\n`;
css += `}\n`;
for (const g of t.type.groups) {
  for (const s of g.styles) {
    const fam = s.family ?? g.family;
    css += `.${s.name} { font-family: var(--font-${fam}); font-size: ${s.fontSize}; line-height: ${s.lineHeight}; font-weight: ${s.fontWeight};${s.letterSpacing ? ` letter-spacing: ${s.letterSpacing};` : ''} }\n`;
  }
}
writeFileSync(join(dir, 'tokens.css'), css);
console.log('tokens.css written:', t.color.tokens.length, 'colours,', themes.length, 'themes');
