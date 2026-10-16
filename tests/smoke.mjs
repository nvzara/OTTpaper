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
    rent: [{ provider_name: 'Google Play Movies', display_priority: 3 }] },
    JP: { flatrate: [{ provider_name: 'Disney Plus', display_priority: 1 }] }, FR: { flatrate: [{ provider_name: 'Canal+', display_priority: 1 }] } } };
  else if (u.includes('/movie/1?')) j = { id: 1, title: '테스트', overview: '줄거리', genres: [], vote_average: 7.5, runtime: 100, release_date: '2020-01-01', credits: { cast: [{ name: '배우' }] }, recommendations: { results: [{ id: 2, title: 'Rec Film', release_date: '2021-01-01' }] }, videos: { results: [{ site: 'YouTube', type: 'Trailer', key: 'abcDEF12345', official: true }] } };
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
ok(await page.inputValue('#country') === 'US', 'first-visit default country follows the browser (en-US -> US)');
await page.selectOption('#country', 'KR');
await page.click('label.chip:has(.ott[value=wavve])');
await page.click('#start');
await page.waitForSelector('.front .notice[open]'); await page.waitForSelector('.listings .tabs');
ok(true, 'start with key goes to home');
ok((await page.locator('.notice').innerText()).includes('no revenue'), 'home shows non-commercial notice');
await page.waitForSelector('.card');
ok(await page.locator('.card .t').first().innerText() === '<b>테스트</b>', 'cards render, HTML escaped');

await page.waitForSelector('.lead-story h2 a');
ok((await page.locator('.lead-story h2 a').innerText()) === '<b>테스트</b>' && (await page.locator('.lead-story .kicker').innerText()).length > 0, "home: today's lead story renders (escaped)");
ok((await page.locator('.lead-story .kicker').innerText()).toLowerCase().includes('services') || (await page.locator('.lead-story .kicker').innerText()).includes('서비스'), "lead: picked from titles on my services");

ok((await page.locator('#edition').innerText()).length > 0 && (await page.locator('#dateline').innerText()).length > 0, 'masthead folio shows date and country edition');

// 2. next visit -> straight to home (settings persisted)
await page.reload();
await page.waitForSelector('.card');
ok(await page.locator('.welcome').count() === 0, 'second visit skips welcome');
ok(await page.locator('.notice:not([open])').count() === 1 && (await page.locator('.notice summary').innerText()).length > 0, "publisher's note folds to one visible line after the first visit");

// 3. tabs
for (const t of ['movie', 'tv', 'upcoming', 'trending']) {
  await page.click(`[data-t=${t}]`); await page.waitForSelector('.card');
}
ok(true, 'all home tabs load');
await page.focus('[data-t=trending]'); await page.keyboard.press('ArrowRight');
ok(await page.locator('[data-t=movie][aria-selected=true]').count() === 1 && await page.evaluate(() => document.activeElement.dataset.t) === 'movie', 'listings tabs: arrow keys move and select');
await page.click('[data-t=trending]'); await page.waitForSelector('.card');
ok(await page.evaluate(() => document.documentElement.dataset.page) === 'front' && await page.locator('#navHome[aria-current=page]').count() === 1 && await page.locator('main h1').count() === 1, 'front page: full nameplate, current section marked, one page heading');

// 4. detail + my OTT
await page.click('.card');
await page.waitForSelector('.pill');
ok((await page.locator('.pill.mine').allInnerTexts()).join().includes('Wavve'), 'my OTT highlighted');
ok((await page.locator('#prov .pill').first().innerText()).includes('Wavve'), 'my OTT sorted first');
ok((await page.locator('.glance .pill').first().innerText()).includes('Wavve') && await page.locator('.glance .pill').count() === 2, 'title page: "streaming in" line under the headline lists subscription services, mine first');
ok((await page.title()) === '테스트 — OTTpaper', 'title page sets the document title');
await page.click('[data-k=rent]');
ok(await page.locator('#prov .pill').count() === 1, 'type filter works');
ok((await page.getAttribute('a:has-text("trailer")', 'href')) === 'https://www.youtube.com/watch?v=abcDEF12345' && (await page.getAttribute('a:has-text("trailer")', 'rel')).includes('noopener'), 'detail: trailer link (YouTube, opens safely)');
ok(await page.locator('.recs .card').count() === 1 && (await page.locator('.recs .card .t').innerText()) === 'Rec Film', 'detail: recommendations grid');
ok(await page.locator('.ww').count() === 1 && await page.locator('.ww tr.cur').count() === 1, 'worldwide availability table lists the current country');
{ const rows = await page.locator('.ww tbody tr').evaluateAll(r => r.map(x => x.textContent)); ok(rows.length === 2 && /Korea/.test(rows[0]) && /Japan/.test(rows[1]) && !rows.join().includes('France'), 'availability table: only Korea, Japan and English-speaking countries, in that order'); }
ok(await page.evaluate(() => document.documentElement.dataset.page) === 'inside' && await page.locator('.nav a[aria-current]').count() === 0, 'inside pages use the compact running head');

// detail layout: poster placeholder must stay inside its column
ok(await page.evaluate(() => { const n = document.querySelector('.article .photo'); return !n || n.getBoundingClientRect().width <= 270; }), 'article photo column stays narrow');

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

// recent-search panel
await page.fill('#q', ''); await page.focus('#q');
ok(await page.locator('#sug:not([hidden]) [role=option]').count() >= 1 && (await page.locator('#sug .sug-t').first().innerText()) === 'abc', 'recent searches: panel opens on focus with the latest search first');
await page.fill('#q', 'ab');
ok(await page.locator('#sug [role=option]').count() === 1 && (await page.locator('#sug mark').innerText()) === 'ab', 'recent searches: filters while typing and highlights the match');
await page.fill('#q', 'zzz');
ok(await page.locator('#sug').isHidden(), 'recent searches: panel hides when nothing matches');
await page.fill('#q', ''); await page.keyboard.press('ArrowDown');
ok(await page.locator('#sug [aria-selected=true]').count() === 1 && (await page.getAttribute('#q', 'aria-activedescendant')) === 'sug-0', 'recent searches: arrow keys move the highlight (aria-activedescendant)');
await page.keyboard.press('Escape');
ok(await page.locator('#sug').isHidden(), 'recent searches: Esc closes the panel');
await page.fill('#q', ''); await page.focus('#q'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
await page.waitForFunction(() => location.hash.startsWith('#/search?q=abc'));
ok(await page.locator('#sug').isHidden(), 'recent searches: Enter on a highlighted entry searches it and closes the panel');
await page.fill('#q', 'second'); await page.press('#q', 'Enter'); await page.waitForFunction(() => /second/.test(document.querySelector('#app h1, #app h2')?.innerText || '') && document.querySelector('#app .card'));
await page.fill('#q', ''); await page.click('#q');
await page.waitForSelector('#sug:not([hidden]) .sug-x');
await page.click('#sug .sug-x >> nth=0');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('rs')).join()) === 'abc', 'recent searches: the x button removes one entry');
await page.click('#sug .sug-clear');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('rs')).length) === 0 && await page.locator('#sug').isHidden(), 'recent searches: "Clear" removes everything');
await page.fill('#q', 'abc'); await page.press('#q', 'Enter'); await page.waitForSelector('.card');

// 6. settings: change + save, theme
await page.click('#navSet'); await page.waitForSelector('#save');
ok(await page.locator('#country option').count() === 8 && (await page.locator('#country option').evaluateAll(o => o.map(x => x.value))).join() === 'KR,JP,US,GB,CA,AU,NZ,IE', 'settings: country list is Korea, Japan and English-speaking countries');
await page.selectOption('#country', 'US');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('settings')).country) === 'US', 'settings: country is saved as soon as it changes');
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
  await pg.click('.card'); await pg.waitForSelector('.article');
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
await page.route('**/news/news.*.json', r => r.fulfill({ json: { generatedAt: '2026-01-01T00:00:00Z', items: [
  { title: 'Lead <i>story</i>', link: 'https://example.com/a', source: 'Variety', published: '2026-01-01T00:00:00Z', summary: 'Sum <b>x</b>' },
  { title: 'Evil', link: 'javascript:alert(1)', source: 'X', summary: '' },
  { title: 'Local story', link: 'https://example.com/local', source: 'Local Paper', local: true, published: '2026-01-02T00:00:00Z' } ], localSources: 1 } }));
await page.goto(base + '/#/news'); await page.waitForSelector('.story');
ok((await page.locator('.edition-tag').innerText()).length > 0, 'news: edition tag shows the country');
ok(await page.locator('.story').count() === 3 && (await page.locator('.wire').count()) === 2 && (await page.locator('.story h3 a', { hasText: 'Lead <i>story</i>' }).count()) === 1, 'news renders and escapes HTML');
ok(await page.locator('.story a[href^="javascript"]').count() === 0, 'unsafe news links neutralized');
ok((await page.locator('.story.lead a').first().getAttribute('rel')).includes('noopener'), 'news links open safely');
ok((await page.locator('main').innerText()).includes('do not') || (await page.locator('main').innerText()).includes('does not host'), 'news attribution shown');
await page.click('[data-ns=netflix]');
ok(await page.locator('.story').count() === 0, 'news: service filter hides unrelated stories');
await page.click('[data-ns=all]');
ok(await page.locator('.story').count() === 3, 'news: "All" restores stories');
await page.unroute('**/news/news.*.json');
await page.route('**/news/news.*.json', r => r.fulfill({ status: 404 }));
await page.goto(base + '/#/news'); await page.reload(); await page.waitForSelector('.empty');
ok(true, 'missing news.json shows friendly message');


// 14. clippings + "/" shortcut
await page.route('**/news/news.*.json', r => r.fulfill({ status: 404 }));
await page.goto(base + '/#/clippings'); await page.waitForSelector('.empty');
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
ok(await page.locator('[data-len="0"]').getAttribute('aria-pressed') === 'true' && await page.locator('[data-len="90"]').count() === 0, 'tonight: switching type resets the film length (no stale 90-minute limit)');
tnReqs.length = 0; await page.click('#spin'); await page.waitForSelector('#tnOut .lead-story h2 a');
ok(tnReqs.length > 0 && tnReqs.every(u => !u.includes('with_runtime.lte')), 'tonight: no runtime limit sent after switching to TV');
const setMine = async v => { await page.evaluate(v => { const st = JSON.parse(localStorage.getItem('settings')); st.myOtts = v; localStorage.setItem('settings', JSON.stringify(st)); }, v); await page.evaluate(() => { location.hash = '/news'; }); await page.waitForSelector('.wire-sec, #wire, .err'); await page.evaluate(() => { location.hash = '/tonight'; }); await page.waitForSelector('#spin'); };
await setMine([]);
ok(await page.locator('#tnMine').count() === 0, 'tonight: without services there is no "only my services" option');
await setMine(['wavve']);
ok(await page.locator('#tnMine').isChecked(), 'tonight: "only my services" is on again once services are added');

// 19. friendly errors: network down -> offline message; rate limit -> rate message
for (const [mode, expect] of [['abort', 'offline'], ['429', 'limiting requests']]) {
  const c = await browser.newContext({ serviceWorkers: 'block' });
  const pg = await c.newPage();
  await pg.addInitScript(() => localStorage.setItem('settings', JSON.stringify({ apiKey: 'k', onboarded: true, lang: 'en', myOtts: [], country: 'KR' })));
  await pg.route('https://api.themoviedb.org/**', r => mode === 'abort' ? r.abort('failed') : r.fulfill({ status: 429, body: '{}' }));
  await pg.goto(base + '/#/search?q=x'); await pg.waitForSelector('.err');
  ok((await pg.locator('.err').innerText()).includes(expect), `friendly error for ${mode === 'abort' ? 'network failure' : 'HTTP 429'}`);
  await c.close();
}

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

// 20. robustness: corrupted storage and sparse API responses never blank a screen
for (const [label, ls, hash, api, expect] of [
  ['corrupted clippings/views storage', { cl: JSON.stringify([null, 7, { id: 5, media_type: 'movie', title: 'Kept' }]), rv: JSON.stringify([null, 1]) }, '/#/clippings', null, 'Kept'],
  ['title response without a title', {}, '/#/title/movie/1', u => (/watch\/providers/.test(u) ? { results: {} } : { id: 1 }), 'CLIP IT'],
]) {
  const c = await browser.newContext({ serviceWorkers: 'block' });
  const pg = await c.newPage(); const pe = [];
  pg.on('pageerror', e => pe.push(e.message));
  await pg.addInitScript(([l, st]) => { localStorage.setItem('settings', JSON.stringify(st)); for (const [k, v] of Object.entries(l)) localStorage.setItem(k, v); }, [ls, { apiKey: 'k', onboarded: true, lang: 'en', country: 'KR', myOtts: [] }]);
  await pg.route('https://api.themoviedb.org/**', r => r.fulfill({ json: api ? api(r.request().url()) : { results: [] } }));
  await pg.route(/image\.tmdb/, r => r.fulfill({ status: 204 }));
  await pg.goto(base + hash); await pg.waitForSelector('main#app *'); await pg.waitForTimeout(500);
  ok((await pg.locator('#app').innerText()).toUpperCase().includes(expect.toUpperCase()) && pe.length === 0, `robust: ${label}` + (pe.length ? ': ' + pe[0] : ''));
  await c.close();
}

// 21. late responses: leaving a screen before its data arrives must not repaint over the new screen
for (const [label, first, then, expect] of [
  ['title page', '/title/movie/111', '/clippings', 'SCRAPBOOK'],
  ['search results', '/search?q=slowone', '/tonight', 'EVENING FEATURE'],
  ['search results replaced by a newer search', '/search?q=slowone', '/search?q=fast', 'QUICK RESULT'],
]) {
  const c = await browser.newContext({ serviceWorkers: 'block' });
  const pg = await c.newPage(); const pe = [];
  pg.on('pageerror', e => pe.push(e.message));
  await pg.addInitScript(() => localStorage.setItem('settings', JSON.stringify({ apiKey: 'k', onboarded: true, lang: 'en', country: 'KR', myOtts: [] })));
  await pg.route('https://api.themoviedb.org/**', async r => {
    const u = r.request().url();
    if (/slowone|\/movie\/111/.test(u)) await new Promise(res => setTimeout(res, 900));
    r.fulfill({ json: /watch\/providers/.test(u) ? { results: {} } : /\/movie\/111/.test(u) ? { id: 111, title: 'Slow Film' } : { results: [{ id: 5, media_type: 'movie', title: /slowone/.test(u) ? 'Late Result' : 'Quick Result' }] } });
  });
  await pg.route(/image\.tmdb/, r => r.fulfill({ status: 204 }));
  await pg.goto(base + '/#/'); await pg.waitForSelector('#q');
  await pg.evaluate(h => { location.hash = h; }, first); await pg.waitForTimeout(150);
  await pg.evaluate(h => { location.hash = h; }, then); await pg.waitForTimeout(1500);
  const txt = (await pg.locator('#app').innerText()).toUpperCase();
  ok(txt.includes(expect) && !txt.includes('SLOW FILM') && !txt.includes('LATE RESULT') && pe.length === 0, `late response is ignored: ${label}` + (pe.length ? ': ' + pe[0] : ''));
  await c.close();
}

ok(errors.length === 0, 'no JS errors' + (errors.length ? ': ' + errors.join('; ') : ''));
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
