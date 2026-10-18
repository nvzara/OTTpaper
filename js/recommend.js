// "Picked for you": rank titles related to what the reader clipped. Pure logic (no DOM, no network), unit-tested.
//
// Inputs come from TMDB: for every clipped title ("seed") the titles TMDB recommends after it (in TMDB's own order),
// the seed's genres and, when available, keywords. A candidate's score is
//
//   relevance  = support (how high, and in how many clippings' lists, TMDB puts it; newer clippings count more)
//              + taste    (how closely its genres and keywords match what the reader clipped; rare traits count more)
//              + language (same original language as the clippings)
//   × recency   a swing of at most 30%: a newer title beats an older one of the same relevance, never an irrelevant one
//   × trust     titles with few votes are trusted less (a brand-new obscure title must not outrank a well-known fit)
//   × small factors: quality, on the reader's own services, already opened, no poster.
//
// Relevance comes first on purpose: recency only decides between titles that are about equally relevant.

export const SEEDS_MAX = 10;                       // newest clippings that shape the picks
const DAY = 864e5;
export const keyOf = (type, id) => `${type}:${id}`;
// Seeds are newest first; each older clipping counts a bit less (1, .83, .71, .63 ...).
export const seedWeight = i => 1 / (1 + 0.2 * i);
// TMDB lists recommendations best first: position 0 counts 1, 5 counts .5, 19 counts .2.
export const posWeight = p => 1 / (1 + p / 5);

export const WEIGHTS = { support: 0.5, taste: 0.35, lang: 0.15 };   // parts of relevance (sum 1)
export const RECENCY_SWING = 0.3;                                    // recency can change a score by up to 30%

// Trait weights of the reader's taste (genre ids or keyword ids), scaled so the strongest is 1.
function traitWeights(seeds, traitsOf) {
  const w = new Map();
  seeds.forEach((s, i) => {
    for (const g of traitsOf(s) || []) {
      const id = typeof g === 'object' ? g?.id : g;
      if (Number.isInteger(id)) w.set(id, (w.get(id) || 0) + seedWeight(i));
    }
  });
  const max = Math.max(0, ...w.values());
  if (max > 0) for (const [k, v] of w) w.set(k, v / max);
  return w;
}
// Genre weights of the reader's taste, scaled so the strongest genre is 1.
export const tasteGenres = (seeds, infoBySeed) => traitWeights(seeds, s => infoBySeed.get(keyOf(s.media_type, s.id))?.genres);

// How rare a trait is among the candidates (a trait every candidate has says nothing: weight 1; a rare one counts up to ~4x).
function idf(lists) {
  const df = new Map(), n = lists.length;
  for (const l of lists) for (const id of new Set(l)) df.set(id, (df.get(id) || 0) + 1);
  return id => Math.log((n + 1) / ((df.get(id) || 0) + 1)) + 1;
}
// Cosine similarity of the reader's taste (trait -> weight) and a candidate's traits, both scaled by rarity.
function similarity(taste, traits, rare) {
  let dot = 0, tn = 0, cn = 0;
  for (const [id, w] of taste) { const v = w * rare(id); tn += v * v; }
  for (const id of new Set(traits)) { const c = rare(id); cn += c * c; if (taste.has(id)) dot += taste.get(id) * rare(id) * c; }
  return tn && cn ? dot / Math.sqrt(tn * cn) : 0;
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
// How far the vote count backs a title up: about .35 with no votes, .65 at 40 votes, .77 at 100, .92 at 300, 1 from 500 votes.
// A title few people have rated is a gamble: it must be clearly more relevant than a known one to win.
export const trustScore = item => 0.35 + 0.65 * Math.min(1, Math.log10(1 + (Number(item?.vote_count) || 0)) / Math.log10(500)) ** 1.5;

// seeds: clipped titles, newest first [{id, media_type, title}]
// recsBySeed: Map("type:id" -> TMDB items in TMDB's order); infoBySeed: Map("type:id" -> {genres, language})
// keywords: Map("type:id" -> keyword ids) for seeds and, optionally, candidates
// excludeKeys: titles never to suggest (already clipped); openedKeys: already opened (shown, but lower)
// onMine: Set/Map of "type:id" known to be on the reader's services
// Returns [{ item, score, seed, n }] best first: `seed` is the clipping that supports it most, `n` how many clippings point at it.
export function rankPicks({ seeds, recsBySeed, infoBySeed = new Map(), keywords = new Map(), excludeKeys = new Set(), openedKeys = new Set(), onMine = new Set(), now = Date.now() }) {
  const found = new Map();   // key -> { item, support, seed, best, n }
  let maxSupport = 0;
  seeds.forEach((s, i) => {
    const w = seedWeight(i);
    const list = recsBySeed.get(keyOf(s.media_type, s.id)) || [];
    if (list.length) maxSupport += w;   // a clipping TMDB knows nothing about does not weaken the others
    list.forEach((raw, pos) => {
      if (!raw || !Number.isInteger(raw.id) || raw.adult === true) return;
      const type = raw.media_type === 'tv' || raw.media_type === 'movie' ? raw.media_type : s.media_type;
      const k = keyOf(type, raw.id);
      if (excludeKeys.has(k)) return;
      const part = w * posWeight(pos);
      const cur = found.get(k) || { item: { ...raw, media_type: type }, support: 0, seed: s, best: 0, n: 0 };
      cur.support += part; cur.n += 1;
      if (part > cur.best) { cur.best = part; cur.seed = s; }   // the clipping that points at it most strongly
      found.set(k, cur);
    });
  });
  const cands = [...found.entries()];
  // The reader's taste, and how rare each trait is among the candidates.
  const tasteG = tasteGenres(seeds, infoBySeed), rareG = idf(cands.map(([, c]) => c.item.genre_ids || []));
  const tasteK = traitWeights(seeds, s => keywords.get(keyOf(s.media_type, s.id)));
  const withKw = cands.filter(([k]) => keywords.has(k));
  const rareK = idf(withKw.map(([k]) => keywords.get(k)));
  const langW = new Map();   // original language -> share of the reader's taste
  let langTotal = 0;
  seeds.forEach((s, i) => { const l = infoBySeed.get(keyOf(s.media_type, s.id))?.language; if (l) { langW.set(l, (langW.get(l) || 0) + seedWeight(i)); langTotal += seedWeight(i); } });

  const out = cands.map(([k, c]) => {
    const support = maxSupport ? Math.min(1, c.support / maxSupport) : 0;
    const genreSim = similarity(tasteG, c.item.genre_ids || [], rareG);
    const kw = keywords.get(k);
    const taste = kw && tasteK.size ? 0.4 * genreSim + 0.6 * similarity(tasteK, kw, rareK) : genreSim;
    const lang = langTotal && c.item.original_language ? (langW.get(c.item.original_language) || 0) / langTotal : 0.5;
    const relevance = WEIGHTS.support * support + WEIGHTS.taste * taste + WEIGHTS.lang * lang;
    let score = relevance * (1 - RECENCY_SWING + RECENCY_SWING * recencyScore(c.item, now)) * trustScore(c.item) * (0.8 + 0.2 * qualityScore(c.item));
    if (tasteK.size && withKw.length && !kw) score *= 0.92;   // keywords were checked for the best candidates only
    if (onMine.has(k)) score *= 1.12;
    if (openedKeys.has(k)) score *= 0.7;
    if (!c.item.poster_path) score *= 0.85;   // a front page without a picture reads poorly
    return { item: c.item, score, seed: c.seed, n: c.n };
  });
  return out.sort((a, b) => b.score - a.score || a.item.id - b.item.id);
}

// The lead story is the biggest thing on the page: among the best few picks, prefer one that enough people have rated well.
export function leadFirst(ranked, { within = 5, minVotes = 100, minScore = 6.5 } = {}) {
  const i = ranked.slice(0, within).findIndex(r => (r.item.vote_count || 0) >= minVotes && (r.item.vote_average || 0) >= minScore);
  if (i <= 0) return ranked;
  return [ranked[i], ...ranked.slice(0, i), ...ranked.slice(i + 1)];
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
