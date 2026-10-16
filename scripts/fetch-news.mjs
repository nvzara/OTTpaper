// Build-time news aggregator: fetches RSS feeds server-side (browsers cannot, CORS) and writes one small file per country edition:
//   <outDir>/news.<CC>.json   (CC from news/feeds.json "countries")
// Usage: node scripts/fetch-news.mjs [outDir]   (default: news)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseFeed } from './rss.mjs';
import { assembleEdition, inEdition, localSourceCount } from './editions.mjs';

const outDir = process.argv[2] || 'news';
const cfg = JSON.parse(await readFile(new URL('../news/feeds.json', import.meta.url), 'utf8'));
const UA = 'OTTpaper-newsbot (+https://github.com/nvzara/OTTpaper)';
const MAX_PER_FEED = 12, MAX_BYTES = 3e6;
const kw = cfg.keywords.map(k => k.toLowerCase());

const feeds = cfg.feeds.filter(f => f.enabled !== false);
const status = [], results = [];
await Promise.all(feeds.map(async f => {
  try {
    const r = await fetch(f.url, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/atom+xml, text/xml' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const xml = (await r.text()).slice(0, MAX_BYTES);
    const items = parseFeed(xml).filter(i => { const h = (i.title + ' ' + i.summary).toLowerCase() + ' '; return kw.some(k => h.includes(k)); })
      .slice(0, MAX_PER_FEED).map(i => ({ ...i, source: f.name, sourceUrl: f.home, lang: f.lang }));
    results.push({ feed: f, items }); status.push({ name: f.name, ok: true, count: items.length });
  } catch (e) { status.push({ name: f.name, ok: false, error: String(e.message || e) }); }
}));

await mkdir(outDir, { recursive: true });
const generatedAt = new Date().toISOString();
for (const cc of cfg.countries) {
  const items = assembleEdition(results, cc);
  await writeFile(`${outDir}/news.${cc}.json`, JSON.stringify({ generatedAt, edition: cc, localSources: localSourceCount(cfg.feeds, cc), items }, null, 1));
  console.log(`edition ${cc}: ${items.length} items (${items.filter(i => i.local).length} local, ${localSourceCount(cfg.feeds, cc)} local sources)`);
}
for (const s of status) console.log(s.ok ? `ok   ${s.name}: ${s.count} items` : `FAIL ${s.name}: ${s.error}`);
