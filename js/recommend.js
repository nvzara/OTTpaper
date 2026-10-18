// "Picked for you": rank titles related to what the reader clipped. Pure logic (no DOM, no network), unit-tested.
//
// Inputs come from TMDB: for every clipped title ("seed") its recommendations and its genres.
// A candidate scores on three things, in this order of weight:
//   relevance  how many seeds point at it (newer clippings count more) and how well its genres fit the reader's taste
//   recency    newer releases first (a smooth decay, no hard cut-off)
//   quality    TMDB score, trusted only as far as the vote count supports it
// plus a small bonus when it is on one of the reader's own services.

export const SEEDS_MAX = 10;                       // newest clippings that shape the picks
const DAY = 864e5;
export const keyOf = (type, id) => `${type}:${id}`;
// Seeds are newest first; each older clipping counts a bit less (1, .83, .71, .63 ...).
export const seedWeight = i => 1 / (1 + 0.2 * i);

// Genre weights of the reader's taste, scaled so the strongest genre is 1.
export function tasteGenres(seeds, infoBySeed) {
  const w = new Map();
  seeds.forEach((s, i) => {
    for (const g of infoBySeed.get(keyOf(s.media_type, s.id))?.genres || []) {
      const id = typeof g === 'object' ? g?.id : g;
      if (Number.isInteger(id)) w.set(id, (w.get(id) || 0) + seedWeight(i));
    }
  });
  const max = Math.max(0, ...w.values());
  if (max > 0) for (const [k, v] of w) w.set(k, v / max);
  return w;
}

// 1 for a brand-new release, .75 at one year, .5 at three, .23 at ten. Unknown date: .3. Not released yet: .6 (cannot be watched yet).
export function recencyScore(item, now = Date.now()) {
  const d = Date.parse(item?.release_date || item?.first_air_date || '');
  if (!Number.isFinite(d)) return 0.3;
  if (d > now) return 0.6;
  return 1 / (1 + (now - d) / DAY / 365.25 / 3);
}

// TMDB average, pulled toward a neutral 6.5 when few people voted (Bayesian average, 50 prior votes).
export function qualityScore(item) {
  const va = Number(item?.vote_average) || 0, vc = Number(item?.vote_count) || 0;
  return (vc * va + 50 * 6.5) / (vc + 50) / 10;
}

export const WEIGHTS = { relevance: 0.55, recency: 0.25, quality: 0.1, mine: 0.1 };

// seeds: clipped titles, newest first [{id, media_type, title}]
// recsBySeed: Map("type:id" -> TMDB recommendation items); infoBySeed: Map("type:id" -> {genres})
// excludeKeys: titles never to suggest (already clipped); openedKeys: already opened (shown, but lower)
// onMine: Set of "type:id" known to be on the reader's services
// Returns [{ item, score, seed, n }] best first: `seed` is the clipping that supports it most, `n` how many clippings point at it.
export function rankPicks({ seeds, recsBySeed, infoBySeed = new Map(), excludeKeys = new Set(), openedKeys = new Set(), onMine = new Set(), now = Date.now() }) {
  const taste = tasteGenres(seeds, infoBySeed);
  const found = new Map();   // key -> { item, support, seed, seedW, n }
  seeds.forEach((s, i) => {
    const w = seedWeight(i);
    for (const raw of recsBySeed.get(keyOf(s.media_type, s.id)) || []) {
      if (!raw || !Number.isInteger(raw.id) || raw.adult === true) continue;
      const type = raw.media_type === 'tv' || raw.media_type === 'movie' ? raw.media_type : s.media_type;
      const k = keyOf(type, raw.id);
      if (excludeKeys.has(k)) continue;
      const cur = found.get(k) || { item: { ...raw, media_type: type }, support: 0, seed: s, seedW: 0, n: 0 };
      cur.support += w; cur.n += 1;
      if (w > cur.seedW) { cur.seed = s; cur.seedW = w; }
      found.set(k, cur);
    }
  });
  const maxSupport = Math.max(0, ...[...found.values()].map(c => c.support));
  const out = [...found.entries()].map(([k, c]) => {
    const ids = c.item.genre_ids || [];
    const fit = ids.length ? ids.reduce((a, g) => a + (taste.get(g) || 0), 0) / ids.length : 0;
    const relevance = 0.6 * (maxSupport ? c.support / maxSupport : 0) + 0.4 * fit;
    let score = WEIGHTS.relevance * relevance + WEIGHTS.recency * recencyScore(c.item, now) + WEIGHTS.quality * qualityScore(c.item) + (onMine.has(k) ? WEIGHTS.mine : 0);
    if (openedKeys.has(k)) score *= 0.7;
    if (!c.item.poster_path) score *= 0.85;   // a front page without a picture reads poorly
    return { item: c.item, score, seed: c.seed, n: c.n };
  });
  return out.sort((a, b) => b.score - a.score || a.item.id - b.item.id);
}

// Keep the first `head` places varied: at most `perSeed` of them may come from the same clipping; the rest follow in score order.
export function diversify(ranked, { head = 9, perSeed = 3 } = {}) {
  const used = new Map(), first = [], later = [];
  for (const r of ranked) {
    const k = keyOf(r.seed.media_type, r.seed.id);
    if (first.length < head && (used.get(k) || 0) < perSeed) { first.push(r); used.set(k, (used.get(k) || 0) + 1); }
    else later.push(r);
  }
  // If the cap left holes (few seeds), top the head up from the remainder.
  while (first.length < head && later.length) first.push(later.shift());
  return [...first.sort((a, b) => b.score - a.score), ...later];
}
