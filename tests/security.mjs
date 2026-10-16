// Static security & licensing checks. Run: node tests/security.mjs
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;
let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
async function walk(d, out = []) {
  for (const n of await readdir(d)) {
    if (['.git', 'node_modules', '_site'].includes(n)) continue;
    const p = join(d, n); (await stat(p)).isDirectory() ? await walk(p, out) : out.push(p);
  }
  return out;
}
const files = await walk(ROOT);
const rel = f => f.slice(ROOT.length);
const texts = Object.fromEntries(await Promise.all(files.filter(f => /\.(html|js|mjs|css|json|md|yml|txt)$/.test(f)).map(async f => [rel(f), await readFile(f, 'utf8')])));
const html = texts['index.html'];

// CSP
const csp = (html.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
ok(/script-src 'self'(;|$)/.test(csp) && !/unsafe-inline|unsafe-eval/.test(csp.split('style-src')[0]), 'CSP: scripts only from self, no unsafe-inline/eval');
ok(/connect-src 'self' https:\/\/api\.themoviedb\.org(;|$)/.test(csp), 'CSP: network limited to api.themoviedb.org');
ok(/default-src 'none'/.test(csp) && /object-src 'none'/.test(csp) && /base-uri 'none'/.test(csp), 'CSP: default-src none, no plugins, no base tag');
ok(/name="referrer" content="no-referrer"/.test(html), 'Referrer-Policy: no-referrer');
ok(!/(src|href)="https?:\/\/(?!www\.themoviedb|www\.justwatch)/.test(html.replace(/<a [^>]*>/g, '')) && !/<script[^>]+src="http/.test(html) && !/<link[^>]+href="http/.test(html), 'index.html loads nothing from third-party hosts');
ok(!/@import|url\(\s*["']?https?:/.test(texts['css/style.css']), 'CSS loads nothing from third-party hosts');
ok(!/style="/.test(html + (texts['js/app.js'] || '')), 'no inline style attributes (CSP style-src self)');

// Secrets
const keyLike = /\b[0-9a-f]{32}\b|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|api_key=[0-9a-f]{8,}|ghp_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}/i;
const hits = Object.entries(texts).filter(([f, t]) => keyLike.test(t)).map(([f]) => f);
ok(hits.length === 0, 'no API-key/token-like strings committed' + (hits.length ? ': ' + hits : ''));
ok(!files.some(f => /(^|\/)\.env/.test(rel(f))), 'no .env files');

// Key handling rules in code
const js = Object.entries(texts).filter(([f]) => /^js\//.test(f));
ok(!js.some(([, t]) => /console\.(log|debug|info|warn|error)/.test(t)), 'no console output in app code (cannot log secrets)');
ok(!js.some(([, t]) => /location\.(hash|search|href)\s*=[^=]*apiKey|encodeURIComponent\(\s*[^)]*apiKey/.test(t)), 'API key is never put into a URL by the app');
ok(!js.filter(([f]) => f !== 'js/tmdb.js').some(([, t]) => /api_key/.test(t)), 'only js/tmdb.js builds API requests');
ok(/credentials: 'omit'/.test(texts['js/tmdb.js']) && /referrerPolicy: 'no-referrer'/.test(texts['js/tmdb.js']), 'TMDB requests: no cookies, no referrer');
ok(/id="inclKey">/.test(texts['js/app.js']) && !/id="inclKey" checked/.test(texts['js/app.js']), 'backup excludes API key by default');
ok(!/innerHTML\s*=[^;]*\bapiKey\b/.test(texts['js/app.js'].replace(/value="\$\{esc\(s\.apiKey\)\}"/g, '')), 'API key never rendered as raw HTML');

// Fonts: every bundled font family has its OFL license + notice
const fonts = files.map(rel).filter(f => /^fonts\/.*\.woff2$/.test(f));
ok(fonts.length > 0 && fonts.every(f => /playfair|source-serif/.test(f)), 'only documented font families are bundled');
ok(!!texts['fonts/OFL-PlayfairDisplay.txt'] && !!texts['fonts/OFL-SourceSerif4.txt'] && /Open Font License/.test(texts['fonts/OFL-PlayfairDisplay.txt'] + texts['fonts/OFL-SourceSerif4.txt']), 'OFL license texts shipped with fonts');
ok(/Adobe/.test(texts['fonts/OFL-SourceSerif4.txt']) && /Playfair Display Project Authors/.test(texts['fonts/OFL-PlayfairDisplay.txt']), 'font copyright notices present');
ok(/Playfair Display/.test(texts['docs/ATTRIBUTION.md']) && /Source Serif/.test(texts['docs/ATTRIBUTION.md']), 'fonts listed in docs/ATTRIBUTION.md');
ok(!files.some(f => /\.(ttf|otf|woff)$/.test(f)), 'no unlicensed/unknown font formats');
const images = files.map(rel).filter(f => /\.(png|jpe?g|gif|webp|svg|ico)$/.test(f));
ok(images.length === 0, 'no bundled images (no unlicensed artwork)' + (images.length ? ': ' + images : ''));
ok(/MIT License/.test(await readFile(join(ROOT, 'LICENSE'), 'utf8')), 'MIT LICENSE present');

console.log(bad ? 'security FAILED' : 'security OK');
process.exit(bad ? 1 : 0);
