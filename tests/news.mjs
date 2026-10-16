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
process.exit(bad ? 1 : 0);
