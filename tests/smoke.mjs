// Browser smoke test with a mocked TMDB API. Run: node tests/smoke.mjs  (needs `playwright` + Chromium)
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  try { res.setHeader('content-type', MIME[extname(p)] || 'text/html'); res.end(await readFile(join(ROOT, p === '/' ? 'index.html' : p))); }
  catch { res.statusCode = 404; res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined }).catch(() => chromium.launch());
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('https://api.themoviedb.org/**', r => {
  const u = r.request().url();
  let j = { results: [{ id: 1, media_type: 'movie', title: '<b>테스트</b>', poster_path: '/a.jpg', release_date: '2020-01-01', vote_average: 7.5 }] };
  if (u.includes('/watch/providers')) j = { results: { KR: { link: 'https://tmdb/x',
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
await page.waitForSelector('.notice + .tabs');
ok(true, 'start with key goes to home');
ok((await page.locator('.notice').innerText()).includes('no revenue'), 'home shows non-commercial notice');
await page.waitForSelector('.card');
ok(await page.locator('.card .t').first().innerText() === '<b>테스트</b>', 'cards render, HTML escaped');

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
ok((await page.locator('.pill').first().innerText()).includes('Wavve'), 'my OTT sorted first');
await page.click('[data-k=rent]');
ok(await page.locator('.pill').count() === 1, 'type filter works');

// 5. search
await page.fill('#q', 'abc'); await page.press('#q', 'Enter');
await page.waitForSelector('.card');
ok(page.url().includes('#/search?q=abc'), 'search works');

// 6. settings: change + save, theme
await page.click('#navSet'); await page.waitForSelector('#save');
await page.selectOption('#country', 'US');
await page.click('.seg label:has(input[value=dark])');
ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'theme preview applies');
await page.click('#save');
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('settings')));
ok(saved.country === 'US' && saved.theme === 'dark' && saved.apiKey === 'test-key' && saved.myOtts.includes('wavve'), 'settings saved');

// 7. backup download
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
  const c = await browser.newContext({ locale });
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
await page.unroute('**/news/news.json');
await page.route('**/news/news.json', r => r.fulfill({ status: 404 }));
await page.goto(base + '/#/news'); await page.reload(); await page.waitForSelector('.err');
ok(true, 'missing news.json shows friendly message');

ok(errors.length === 0, 'no JS errors' + (errors.length ? ': ' + errors.join('; ') : ''));
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
