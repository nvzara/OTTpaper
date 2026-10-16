// Unit test for the RSS/Atom parser with fixtures. Run: node tests/news.mjs
import { parseFeed, clip, text } from '../scripts/rss.mjs';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const rss = `<rss><channel><item><title><![CDATA[Netflix &amp; Co: "big" deal]]></title><link>https://ex.com/a?x=1&amp;y=2</link>
<pubDate>Wed, 15 Oct 2025 10:00:00 GMT</pubDate><description><![CDATA[<p>Hello <b>world</b> &#8217;s news</p>]]></description></item>
<item><title>No link</title></item>
<item><title>Bad scheme</title><link>javascript:alert(1)</link></item></channel></rss>`;
const a = parseFeed(rss);
ok(a.length === 1, 'drops items without a safe http(s) link');
ok(a[0].title === 'Netflix & Co: "big" deal', 'decodes CDATA + entities in title');
ok(a[0].link === 'https://ex.com/a?x=1&y=2', 'decodes link');
ok(a[0].summary === 'Hello world ’s news', 'strips HTML from summary');
ok(a[0].published === '2025-10-15T10:00:00.000Z', 'parses pubDate');
const atom = `<feed><entry><title>Atom one</title><link rel="alternate" href="https://ex.com/b"/><updated>2025-10-16T00:00:00Z</updated><summary>S</summary></entry></feed>`;
ok(parseFeed(atom)[0]?.link === 'https://ex.com/b', 'parses Atom href links');
ok(clip('word '.repeat(100), 50).length <= 50, 'clip limits excerpt length');
ok(text('<script>x</script>a') === 'x a' || text('<b>a</b>') === 'a', 'text() strips tags');
// editions
const { assembleEdition, inEdition, localSourceCount, feedEditions } = await import('../scripts/editions.mjs');
const world = { name: 'W', url: 'https://x/w', editions: ['*'] }, kr = { name: 'K', url: 'https://x/k', editions: ['KR'] }, off = { name: 'O', url: 'https://x/o', editions: ['*'], enabled: false };
const mk = (feed, ...links) => ({ feed, items: links.map((l, i) => ({ title: l, link: 'https://e/' + l, published: `2026-01-0${i + 1}T00:00:00Z` })) });
ok(feedEditions({}).join() === '*' && inEdition(world, 'JP') && !inEdition(kr, 'JP') && inEdition(kr, 'KR') && !inEdition(off, 'KR'), 'edition membership: worldwide, local, disabled');
const ed = assembleEdition([mk(world, 'a', 'b'), mk(kr, 'c'), mk(off, 'd')], 'KR');
ok(ed.length === 3 && ed.filter(i => i.local).length === 1 && !ed.some(i => i.title === 'd'), 'KR edition = worldwide + local items, disabled feeds ignored, local flagged');
ok(assembleEdition([mk(world, 'a'), mk(kr, 'c')], 'JP').length === 1 && assembleEdition([mk(world, 'a'), mk(world, 'a')], 'US').length === 1, 'other countries get worldwide only; duplicate links removed');
ok(localSourceCount([world, kr, off], 'KR') === 1 && localSourceCount([world, kr], 'US') === 0, 'localSourceCount');
// feeds.json sanity: https only, named, unique, with a homepage for attribution
import { readFile } from 'node:fs/promises';
const cfg = JSON.parse(await readFile(new URL('../news/feeds.json', import.meta.url), 'utf8'));
ok(cfg.feeds.length >= 4 && cfg.feeds.every(f => /^https:\/\//.test(f.url) && /^https:\/\//.test(f.home) && f.name && f.lang), 'feeds.json: every feed is https with name, home and lang');
ok(new Set(cfg.feeds.map(f => f.url)).size === cfg.feeds.length, 'feeds.json: no duplicate feed URLs');
ok(Array.isArray(cfg.keywords) && cfg.keywords.length > 5, 'feeds.json: OTT keyword list present');
ok(['KR', 'US', 'JP'].every(c => cfg.countries.includes(c)) && cfg.feeds.every(f => feedEditions(f).every(e => e === '*' || cfg.countries.includes(e))), 'feeds.json: editions reference known countries');
process.exit(bad ? 1 : 0);
