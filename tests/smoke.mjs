// Browser smoke test with a mocked TMDB API. Run: node tests/smoke.mjs  (needs `playwright` + Chromium)
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  try { res.setHeader('content-type', MIME[extname(p)] || 'text/html'); res.end(await readFile(join(ROOT, p === '/' ? 'index.html' : p))); }
  catch { res.statusCode = 404; res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined }).catch(() => chromium.launch());
const ctx = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const cspErrors = [], origins = new Set();
page.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) cspErrors.push(m.text()); });
page.on('request', r => origins.add(new URL(r.url()).origin));
await page.route('https://api.themoviedb.org/**', r => {
  const u = r.request().url();
  let j = { results: [{ id: 1, media_type: 'movie', title: '<b>테스트</b>', poster_path: '/a.jpg', release_date: '2020-01-01', vote_average: 7.5 }] };
  if (/\/watch\/providers\/(movie|tv)\?/.test(u)) j = { results: [{ provider_id: 356, provider_name: 'Wavve' }, { provider_id: 8, provider_name: 'Netflix' }] };
  else if (u.includes('/watch/providers')) j = { results: { KR: { link: 'https://tmdb/x',
    flatrate: [{ provider_name: 'Netflix', display_priority: 1 }, { provider_name: 'Wavve', display_priority: 2 }],
    rent: [{ provider_name: 'Google Play Movies', display_priority: 3 }] } } };
  else if (u.includes('/movie/1?')) j = { id: 1, title: '테스트', overview: '줄거리', genres: [], vote_average: 7.5, runtime: 100, release_date: '2020-01-01', credits: { cast: [{ name: '배우' }] } };
  r.fulfill({ json: j });
});
await page.route(/image\.tmdb\.org/, r => r.fulfill({ status: 204 }));

// 1. first visit -> welcome
await page.goto(base + '/');
await page.waitForSelector('.welcome');
ok(await page.locator('.welcome h1').innerText() === 'Welcome to OTTpaper', 'first visit shows welcome');
await page.click('#start');
ok(await page.locator('#toast.show').count() === 1, 'start without key is blocked with a message');
await page.fill('#key', 'test-key');
await page.click('label.chip:has(.ott[value=wavve])');
await page.click('#start');
await page.waitForSelector('.notice ~ .tabs');
ok(true, 'start with key goes to home');
ok((await page.locator('.notice').innerText()).includes('no revenue'), 'home shows non-commercial notice');
await page.waitForSelector('.card');
ok(await page.locator('.card .t').first().innerText() === '<b>테스트</b>', 'cards render, HTML escaped');

await page.waitForSelector('.lead-story h2 a');
ok((await page.locator('.lead-story h2 a').innerText()) === '<b>테스트</b>' && (await page.locator('.lead-story .kicker').innerText()).length > 0, "home: today's lead story renders (escaped)");
ok((await page.locator('.lead-story .kicker').innerText()).toLowerCase().includes('services') || (await page.locator('.lead-story .kicker').innerText()).includes('서비스'), "lead: picked from titles on my services");

// 2. next visit -> straight to home (settings persisted)
await page.reload();
await page.waitForSelector('.card');
ok(await page.locator('.welcome').count() === 0, 'second visit skips welcome');

// 3. tabs
for (const t of ['movie', 'tv', 'upcoming', 'trending']) {
  await page.click(`[data-t=${t}]`); await page.waitForSelector('.card');
}
ok(true, 'all home tabs load');

// 4. detail + my OTT
await page.click('.card');
await page.waitForSelector('.pill');
ok((await page.locator('.pill.mine').allInnerTexts()).join().includes('Wavve'), 'my OTT highlighted');
ok((await page.locator('#prov .pill').first().innerText()).includes('Wavve'), 'my OTT sorted first');
await page.click('[data-k=rent]');
ok(await page.locator('#prov .pill').count() === 1, 'type filter works');
ok(await page.locator('.ww').count() === 1 && await page.locator('.ww tr.cur').count() === 1, 'worldwide availability table lists the current country');

// detail layout: poster placeholder must stay inside its column
ok(await page.evaluate(() => { const n = document.querySelector('.detail .p'); return !n || n.getBoundingClientRect().width <= 260; }), 'detail poster column stays narrow');

// 5. search
await page.fill('#q', 'abc'); await page.press('#q', 'Enter');
await page.waitForSelector('.card');
ok(page.url().includes('#/search?q=abc'), 'search works');
await page.waitForSelector('.card.on-mine .avail');
ok((await page.locator('.avail').first().innerText()).length > 0, 'search: "on my services" badge appears');
await page.click('#onlyMine');
ok(await page.locator('#results.only-mine').count() === 1 && await page.locator('.card.on-mine').first().isVisible(), 'search: "my services only" filter keeps matching titles');

// search filters (mock result is a 2020 movie)
await page.click('[data-decade="2010"]');
ok(await page.locator('#results .card').count() === 0, 'search: decade filter hides non-matching titles');
await page.click('[data-decade="2020"]');
ok(await page.locator('#results .card').count() === 1, 'search: decade filter keeps matching titles');
await page.click('[data-decade="any"]'); await page.click('[data-sort="top"]');
ok(await page.locator('[data-sort="top"][aria-pressed="true"]').count() === 1 && await page.locator('#results .card').count() === 1, 'search: sort chips work');
await page.waitForSelector('.card.on-mine');
await page.click('[data-decade="2010"]'); await page.click('[data-decade="any"]');
ok(await page.locator('.card.on-mine .avail').count() === 1, 'search: "on my services" badge survives re-filtering');

ok(await page.evaluate(() => [...document.querySelectorAll('#qlist option')].some(o => o.value === 'abc')), 'search suggestions: recent searches fill the datalist');
ok((await page.getAttribute('#q', 'list')) === 'qlist', 'search box linked to suggestions');

// 6. settings: change + save, theme
await page.click('#navSet'); await page.waitForSelector('#save');
await page.selectOption('#country', 'US');
await page.click('.seg label:has(input[value=black])');
ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'black', 'theme preview applies (black)');
await page.click('.seg label:has(input[value=white])');
ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'white', 'white theme');
await page.click('.seg label:has(input[value=ivory])');
ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'ivory', 'ivory theme');
await page.click('.seg label:has(input[value=black])');
await page.selectOption('#font', 'sans');
await page.click('.seg label:has(input[value=l])');
ok(await page.evaluate(() => document.documentElement.dataset.font + document.documentElement.dataset.size) === 'sansl', 'font + size apply');
await page.click('#save');
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('settings')));
ok(saved.country === 'US' && saved.theme === 'black' && saved.font === 'sans' && saved.size === 'l' && saved.apiKey === 'test-key' && saved.myOtts.includes('wavve'), 'settings saved');

// 7. backup download
await page.click('label.chip:has(#inclKey)');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exp')]);
const bk = JSON.parse(await readFile(await dl.path(), 'utf8'));
ok(bk.app === 'OTTpaper' && bk.settings.apiKey === 'test-key' && bk.settings.country === 'US' && dl.suggestedFilename().startsWith('ottpaper-backup-'), 'backup file contains settings');
await page.click('label.chip:has(#inclKey)');
const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#exp')]);
ok(JSON.parse(await readFile(await dl2.path(), 'utf8')).settings.apiKey === '', 'backup can exclude API key');

// 8. wipe storage, restore from backup
await page.evaluate(() => localStorage.clear());
await page.goto(base + '/#/');
await page.reload();
await page.waitForSelector('.welcome');
ok(true, 'cleared browser data -> welcome again');
await page.click('a[href="#/settings"]');
await page.waitForSelector('#file', { state: 'attached' });
await page.setInputFiles('#file', await dl.path());
await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings') || '{}').apiKey === 'test-key');
const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('settings')));
ok(restored.country === 'US' && restored.lang === 'auto' && restored.onboarded === true && restored.myOtts.includes('wavve'), 'restore brings settings back');
await page.goto(base + '/#/');
await page.reload(); await page.waitForSelector('.card');
ok(true, 'after restore, home opens directly');

// 9. bad / hostile backup rejected
await page.click('#navSet'); await page.waitForSelector('#file', { state: 'attached' });
await page.setInputFiles('#file', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"other"}') });
await page.waitForSelector('#toast.show');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('settings')).apiKey) === 'test-key', 'invalid backup rejected, settings intact');

// 10. clear history keeps settings
page.on('dialog', d => d.accept());
await page.click('#clr');
ok(await page.evaluate(() => !!JSON.parse(localStorage.getItem('settings')).apiKey), 'clear history keeps API key');

// 11. mobile layout: no horizontal scroll
await page.setViewportSize({ width: 375, height: 700 });
await page.goto(base + '/#/'); await page.waitForSelector('.card');
ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll on mobile');


// 12. languages: browser default, manual choice, TMDB request language, overview fallback
async function langCase(locale, fn) {
  const c = await browser.newContext({ locale, serviceWorkers: 'block' });
  const pg = await c.newPage();
  const reqs = [];
  pg.on('pageerror', e => errors.push(e.message));
  pg.on('request', r => { if (r.url().includes('api.themoviedb.org')) reqs.push(r.url()); });
  await pg.route(/image\.tmdb\.org/, r => r.fulfill({ status: 204 }));
  await pg.route('https://api.themoviedb.org/**', r => {
    const u = r.request().url();
    let j = { results: [{ id: 1, media_type: 'movie', title: 'T', poster_path: null, release_date: '2020-01-01' }] };
    if (u.includes('/watch/providers')) j = { results: {} };
    else if (u.includes('/movie/1?')) j = { id: 1, title: 'T', overview: u.includes('language=en-US') ? 'English fallback overview' : '', genres: [], release_date: '2020-01-01' };
    r.fulfill({ json: j });
  });
  await fn(pg, reqs, c);
  await c.close();
}
await langCase('ko-KR', async pg => {
  await pg.goto(base + '/'); await pg.waitForSelector('.welcome');
  ok((await pg.locator('.welcome h1').innerText()).includes('환영'), 'ko browser -> Korean UI');
  ok(await pg.evaluate(() => document.documentElement.lang) === 'ko', 'html lang=ko');
});
await langCase('fr-FR', async pg => {
  await pg.goto(base + '/'); await pg.waitForSelector('.welcome');
  ok(await pg.locator('.welcome h1').innerText() === 'Welcome to OTTpaper', 'unsupported browser language -> English');
});
await langCase('ja-JP', async pg => {
  await pg.goto(base + '/'); await pg.waitForSelector('.welcome');
  ok((await pg.locator('.welcome h1').innerText()).includes('ようこそ'), 'ja browser -> Japanese UI');
  ok((await pg.locator('.attrib').innerText()).includes('ご了承'), 'footer shows translation disclaimer (ja)');
});
await langCase('en-US', async (pg, reqs) => {
  await pg.goto(base + '/'); await pg.waitForSelector('.welcome');
  await pg.fill('#key', 'typed-key');
  await pg.selectOption('#lang', 'ja');
  await pg.waitForFunction(() => document.querySelector('.welcome h1')?.textContent.includes('ようこそ'));
  ok(await pg.inputValue('#key') === 'typed-key', 'language change keeps typed API key');
  ok(await pg.evaluate(() => document.title.includes('配信')), 'document title translated');
  await pg.click('#start'); await pg.waitForSelector('.card');
  ok(reqs.some(u => u.includes('language=ja-JP')), 'content requested in ja-JP');
  await pg.click('.card'); await pg.waitForSelector('.detail');
  await pg.waitForFunction(() => document.body.textContent.includes('English fallback overview'));
  ok(true, 'missing overview falls back to English');
  await pg.click('#navSet'); await pg.waitForSelector('#lang');
  await pg.selectOption('#lang', 'ko');
  await pg.waitForFunction(() => document.querySelector('h1')?.textContent.includes('설정'));
  ok(await pg.evaluate(() => JSON.parse(localStorage.getItem('settings')).lang) === 'ko', 'chosen language persisted');
  await pg.reload(); await pg.waitForSelector('#lang');
  ok((await pg.locator('h1').innerText()).includes('설정'), 'language kept after reload');
});


// 13. news wire: renders fixture, escapes, only http(s) links, graceful when missing
await page.setViewportSize({ width: 1000, height: 800 });
await page.route('**/news/news.json', r => r.fulfill({ json: { generatedAt: '2026-01-01T00:00:00Z', items: [
  { title: 'Lead <i>story</i>', link: 'https://example.com/a', source: 'Variety', published: '2026-01-01T00:00:00Z', summary: 'Sum <b>x</b>' },
  { title: 'Evil', link: 'javascript:alert(1)', source: 'X', summary: '' } ] } }));
await page.goto(base + '/#/news'); await page.waitForSelector('.story');
ok(await page.locator('.story').count() === 2 && (await page.locator('.story.lead h3').innerText()) === 'Lead <i>story</i>', 'news renders and escapes HTML');
ok(await page.locator('.story a[href^="javascript"]').count() === 0, 'unsafe news links neutralized');
ok((await page.locator('.story.lead a').first().getAttribute('rel')).includes('noopener'), 'news links open safely');
ok((await page.locator('main').innerText()).includes('do not') || (await page.locator('main').innerText()).includes('does not host'), 'news attribution shown');
await page.click('[data-ns=netflix]');
ok(await page.locator('.story').count() === 0, 'news: service filter hides unrelated stories');
await page.click('[data-ns=all]');
ok(await page.locator('.story').count() === 2, 'news: "All" restores stories');
await page.unroute('**/news/news.json');
await page.route('**/news/news.json', r => r.fulfill({ status: 404 }));
await page.goto(base + '/#/news'); await page.reload(); await page.waitForSelector('.err');
ok(true, 'missing news.json shows friendly message');


// 14. clippings + "/" shortcut
await page.route('**/news/news.json', r => r.fulfill({ status: 404 }));
await page.goto(base + '/#/clippings'); await page.waitForSelector('.err');
ok(true, 'empty clippings shows hint');
await page.goto(base + '/#/title/movie/1'); await page.waitForSelector('#clip');
await page.click('#clip');
ok(await page.locator('#clip').getAttribute('aria-pressed') === 'true', 'clip button toggles on');
await page.goto(base + '/#/clippings'); await page.waitForSelector('.card');
ok(await page.locator('.card').count() === 1, 'clipped title listed');
await page.goto(base + '/#/settings'); await page.waitForSelector('#exp');
const [dl3] = await Promise.all([page.waitForEvent('download'), page.click('#exp')]);
ok(JSON.parse(await readFile(await dl3.path(), 'utf8')).clippings.length === 1, 'backup includes clippings');
await page.click('#clr');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('cl') || '[]').length) === 1, 'delete history keeps clippings');
await page.evaluate(() => localStorage.removeItem('cl'));
await page.setInputFiles('#file', await dl3.path());
await page.waitForFunction(() => JSON.parse(localStorage.getItem('cl') || '[]').length === 1);
ok(true, 'restore brings clippings back');
await page.goto(base + '/#/'); await page.waitForSelector('.card');
await page.keyboard.press('/');
ok(await page.evaluate(() => document.activeElement.id) === 'q', '"/" focuses search');


// 15. security: key handling, CSP, third-party requests, fonts, themes
await page.goto(base + '/#/settings'); await page.waitForSelector('#save');
ok(await page.locator('#inclKey').isChecked() === false, 'backup "include API key" is off by default');
ok(await page.getAttribute('#key', 'type') === 'password', 'API key field is masked');
await page.click('#keyToggle');
ok(await page.getAttribute('#key', 'type') === 'text', 'key can be revealed');
await page.click('#keyToggle');
// remember OFF -> key only in sessionStorage
await page.click('label.chip:has(#remember)');
await page.fill('#key', 'session-only-key'); await page.click('#save');
const st = await page.evaluate(() => ({ ls: localStorage.getItem('settings'), ss: sessionStorage.getItem('ottpaper.session-key') }));
ok(!st.ls.includes('session-only-key') && st.ss === 'session-only-key', 'remember off: key kept only in sessionStorage');
await page.reload(); await page.waitForSelector('#key');
ok(await page.inputValue('#key') === 'session-only-key', 'session key survives reload in same tab');
// remember ON again, then forget
await page.click('label.chip:has(#remember)'); await page.fill('#key', 'test-key'); await page.click('#save');
await page.click('#forget');
const gone = await page.evaluate(() => ({ ls: JSON.parse(localStorage.getItem('settings')).apiKey, ss: sessionStorage.getItem('ottpaper.session-key') }));
ok(gone.ls === '' && gone.ss === null, 'forget removes the key everywhere');
await page.fill('#key', 'test-key'); await page.click('#save');
// fonts + themes
await page.goto(base + '/#/'); await page.waitForSelector('.card');
await page.evaluate(() => document.fonts.ready);
ok(await page.evaluate(async () => { await document.fonts.load('900 20px "Playfair Display"'); return document.fonts.check('900 20px "Playfair Display"'); }), 'bundled Playfair Display font loads from our own origin');
ok(await page.evaluate(async () => { await document.fonts.load('16px "Source Serif 4"'); return document.fonts.check('16px "Source Serif 4"'); }), 'bundled Source Serif 4 font loads');
ok(cspErrors.length === 0, 'no CSP violations' + (cspErrors.length ? ': ' + cspErrors[0] : ''));
const allowed = new Set([base, 'https://api.themoviedb.org', 'https://image.tmdb.org']);
const foreign = [...origins].filter(o => !allowed.has(o));
ok(foreign.length === 0, 'requests only to own origin / TMDB' + (foreign.length ? ': ' + foreign : ''));
// legacy theme values migrate
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('settings')); s.theme = 'dark'; localStorage.setItem('settings', JSON.stringify(s)); });
await page.reload(); await page.waitForSelector('.card');
ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'black', 'legacy "dark" theme migrates to black');


// 16. subscription advisor on clippings
await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('settings')); st.country = 'KR'; st.myOtts = ['wavve']; st.lang = 'en'; localStorage.setItem('settings', JSON.stringify(st));
  localStorage.setItem('cl', JSON.stringify([1, 2].map(id => ({ id, media_type: 'movie', title: 'Clip ' + id, poster_path: null, release_date: '2020-01-01' }))));
});
await page.goto(base + '/#/clippings'); await page.reload(); await page.waitForSelector('#adv');
await page.click('#adv'); await page.waitForSelector('.advisor');
const adv = await page.locator('.advisor').innerText();
ok(adv.includes('cover 2 of 2'), 'advisor: my service covers 2 of 2 clipped titles');
ok(await page.locator('.rank li').count() >= 2 && await page.locator('.rank li.mine').count() === 1, 'advisor: ranking with my service highlighted');
ok(adv.includes('Best one to add: Netflix') || adv.includes('Nothing else'), 'advisor: add-on suggestion shown');
ok(adv.includes('JustWatch'), 'advisor: JustWatch credited');

// skip link + print
await page.goto(base + '/#/clippings'); await page.waitForSelector('.card');
await page.focus('#skip'); await page.keyboard.press('Enter');
ok(await page.evaluate(() => document.activeElement.id) === 'app' && page.url().endsWith('#/clippings'), 'skip link moves focus to content without changing the page');
ok(await page.locator('#print').count() === 1 && /\d+ titles/.test(await page.locator('.print-only').textContent()), 'clippings print button and print heading present');
await page.emulateMedia({ media: 'print' });
ok(!(await page.locator('.bar').isVisible()) && await page.locator('.print-only').isVisible(), 'print stylesheet hides navigation and shows the print heading');
await page.emulateMedia({ media: 'screen' });

// 18. Tonight picker
ok(await page.evaluate(() => [...document.querySelectorAll('.nav a')].every(a => a.getAttribute('aria-label'))), 'nav links have accessible labels (icon-only on mobile)');
await page.evaluate(() => { const st = JSON.parse(localStorage.getItem('settings')); st.myOtts = ['wavve']; st.country = 'KR'; st.lang = 'en'; localStorage.setItem('settings', JSON.stringify(st)); });
const tnReqs = [];
page.on('request', r => { if (r.url().includes('/discover/')) tnReqs.push(r.url()); });
await page.goto(base + '/#/tonight'); await page.reload(); await page.waitForSelector('#spin');
await page.click('[data-mood=comedy]'); await page.click('[data-len="90"]');
await page.click('#spin'); await page.waitForSelector('#tnOut .lead-story h2 a');
ok(tnReqs.some(u => u.includes('with_genres=35') && u.includes('with_runtime.lte=90') && u.includes('with_watch_providers=356') && u.includes('watch_region=KR')), 'tonight: discover filtered by mood, length and my provider ids');
ok(await page.locator('#again').count() === 1, 'tonight: "another one" available');
await page.click('[data-type=tv]');
ok(await page.locator('[data-mood=horror]').count() === 0 && await page.locator('[data-mood=crime]').count() === 1, 'tonight: moods follow the media type');

// 17. PWA: manifest + service worker; app shell opens offline; SW never handles cross-origin
{
  const c = await browser.newContext({ serviceWorkers: 'allow' });
  const pg = await c.newPage();
  await pg.route('https://api.themoviedb.org/**', r => r.fulfill({ json: { results: [] } }));
  await pg.goto(base + '/'); await pg.waitForSelector('#q');
  ok(await pg.evaluate(() => fetch('manifest.webmanifest').then(r => r.json()).then(m => m.short_name === 'OTTpaper' && m.display === 'standalone')), 'PWA manifest valid');
  await pg.evaluate(() => navigator.serviceWorker.ready);
  await pg.waitForFunction(async () => (await caches.keys()).includes('ottpaper-v1') && (await (await caches.open('ottpaper-v1')).keys()).length > 8);
  ok(true, 'service worker installed and app shell cached');
  const cached = await pg.evaluate(async () => (await (await caches.open('ottpaper-v1')).keys()).map(r => new URL(r.url).origin));
  ok(cached.length > 8 && cached.every(o => o === base), 'cache holds only same-origin files');
  await pg.reload(); await pg.waitForSelector('#q');
  await c.setOffline(true);
  await pg.reload(); await pg.waitForSelector('#q');
  ok((await pg.title()).includes('OTTpaper'), 'app shell opens offline');
  await c.close();
}

ok(errors.length === 0, 'no JS errors' + (errors.length ? ': ' + errors.join('; ') : ''));
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
