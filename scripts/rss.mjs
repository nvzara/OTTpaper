// Minimal dependency-free RSS/Atom parser used at build time.
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
export const decode = s => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const cdata = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
export const text = s => decode(cdata(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const tag = (block, name) => { const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return m ? m[1] : ''; };
export const clip = (s, n) => s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
const safeUrl = u => { try { const x = new URL(u.trim()); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };

export function parseFeed(xml) {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  return blocks.map(b => {
    let link = text(tag(b, 'link'));
    if (!link) { const m = b.match(/<link[^>]*?href=["']([^"']+)["'][^>]*>/i); link = m ? decode(m[1]) : ''; }
    const date = new Date(text(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')));
    return {
      title: text(tag(b, 'title')), link: safeUrl(link),
      published: isNaN(date) ? null : date.toISOString(),
      summary: clip(text(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content:encoded')), 220),
    };
  }).filter(i => i.title && i.link);
}
