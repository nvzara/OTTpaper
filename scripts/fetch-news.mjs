// Build-time news aggregator: fetches RSS feeds server-side (browsers cannot, CORS) and writes a small news.json.
// Usage: node scripts/fetch-news.mjs [outFile]   (default: news/news.json)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseFeed } from './rss.mjs';

const out = process.argv[2] || 'news/news.json';
const cfg = JSON.parse(await readFile(new URL('../news/feeds.json', import.meta.url), 'utf8'));
const UA = 'OTTpaper-newsbot (+https://github.com/nvzara/OTTpaper)';
const MAX_PER_FEED = 12, MAX_TOTAL = 60, MAX_BYTES = 3e6;

const status = [], items = [];
await Promise.all(cfg.feeds.map(async f => {
  try {
    const r = await fetch(f.url, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/atom+xml, text/xml' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const xml = (await r.text()).slice(0, MAX_BYTES);
    const kw = cfg.keywords.map(k => k.toLowerCase());
    const got = parseFeed(xml).filter(i => { const h = (i.title + ' ' + i.summary).toLowerCase() + ' '; return kw.some(k => h.includes(k)); })
      .slice(0, MAX_PER_FEED).map(i => ({ ...i, source: f.name, sourceUrl: f.home, lang: f.lang }));
    items.push(...got); status.push({ name: f.name, ok: true, count: got.length });
  } catch (e) { status.push({ name: f.name, ok: false, error: String(e.message || e) }); }
}));

const seen = new Set();
const list = items.sort((a, b) => (b.published || '').localeCompare(a.published || ''))
  .filter(i => !seen.has(i.link) && seen.add(i.link)).slice(0, MAX_TOTAL);
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), items: list }, null, 1));
for (const s of status) console.log(s.ok ? `ok   ${s.name}: ${s.count} items` : `FAIL ${s.name}: ${s.error}`);
console.log(`wrote ${list.length} items to ${out}`);
