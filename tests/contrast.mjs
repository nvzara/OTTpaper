// WCAG contrast check for every theme's color tokens (ivory default, white, black, and system-dark). Run: node tests/contrast.mjs
import { readFile } from 'node:fs/promises';
const css = await readFile(new URL('../css/style.css', import.meta.url), 'utf8');
const vars = block => Object.fromEntries([...block.matchAll(/--([a-z0-9]+):(#[0-9a-f]{3,6})/gi)].map(m => [m[1], m[2]]));
const base = vars(css.match(/:root\{([^}]*--paper:[^}]*)\}/)[1]);
const grab = re => vars((css.match(re) || [])[1] || '');
const themes = {
  ivory: base,
  white: { ...base, ...grab(/:root\[data-theme=white\]\{([^}]*)\}/) },
  black: { ...base, ...grab(/:root\[data-theme=black\]\{([^}]*)\}/) },
  'system-dark': { ...base, ...grab(/:root:not\(\[data-theme\]\)\{([^}]*)\}/) },
};
const lum = hex => { let h = hex.slice(1); if (h.length === 3) h = [...h].map(c => c + c).join(''); const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
// [foreground token, background token, min ratio, where it is used]
const PAIRS = [['ink', 'paper', 7, 'body text'], ['ink', 'paper2', 7, 'text on panels'], ['mut', 'paper', 4.5, 'secondary text'], ['mut', 'paper2', 4.5, 'secondary text on panels'],
  ['acc', 'paper', 4.5, 'links / kickers'], ['acc', 'paper2', 4.5, 'links on panels'], ['accfg', 'acc', 4.5, 'primary button text'], ['paper', 'ink', 4.5, 'selected chips / score tags'],
  ['ok', 'okbg', 4.5, '"my service" pills'], ['ok', 'paper', 4.5, '"on my services" tag, advisor ranking'], ['paper', 'ok', 4.5, '"on my services" badge'], ['danger', 'paper2', 4.5, 'error text'], ['warn', 'paper2', 4.5, 'warning text']];
let bad = 0;
for (const [name, t] of Object.entries(themes)) {
  for (const [fg, bg, min, use] of PAIRS) {
    const r = ratio(t[fg], t[bg]);
    const pass = r >= min;
    if (!pass) bad++;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: ${fg} on ${bg} = ${r.toFixed(2)} (need ${min}) — ${use}`);
  }
}
console.log(bad ? 'contrast FAILED' : 'contrast OK');
process.exit(bad ? 1 : 0);
