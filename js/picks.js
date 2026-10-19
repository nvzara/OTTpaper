// "Picked for you": gathers what TMDB recommends after the reader's clippings and ranks it (ranking lives in recommend.js).
import * as T from './tmdb.js';
import { clippings, recentViews, getSettings } from './store.js';
import { onMyServices } from './advisor.js';
import { rankPicks, diversify, leadFirst, SEEDS_MAX, keyOf } from './recommend.js';

// Run fn over items with a few requests in flight (provider and recommendation data are cached for days).
async function pool(items, n, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) await fn(items[next++]); }));
}

// Returns null when there is nothing to base picks on; otherwise { list: [{ item, seed, n, mine: [ottKeys] }] } best first.
export async function loadPicks(alive = () => true) {
  const all = clippings.list(), seeds = all.slice(0, SEEDS_MAX);
  if (!seeds.length) return null;
  const recsBySeed = new Map(), infoBySeed = new Map(), keywords = new Map();
  await pool(seeds, 6, async s => {
    const k = keyOf(s.media_type, s.id);
    const [r, i, kw] = await Promise.allSettled([T.recommendations(s.media_type, s.id), T.basic(s.media_type, s.id), T.keywords(s.media_type, s.id)]);
    let list = r.status === 'fulfilled' && Array.isArray(r.value?.results) ? r.value.results : [];
    if (list.length < 5) {   // a niche title: TMDB has few recommendations, so add its "similar" titles after them
      try {
        const have = new Set(list.map(x => x?.id)), sim = (await T.similar(s.media_type, s.id)).results;
        list = [...list, ...(Array.isArray(sim) ? sim.filter(x => x && !have.has(x.id)) : [])];
      } catch { /* keep what we have */ }
    }
    recsBySeed.set(k, list);
    if (i.status === 'fulfilled') infoBySeed.set(k, { genres: Array.isArray(i.value?.genres) ? i.value.genres : [], language: i.value?.original_language });
    if (kw.status === 'fulfilled') keywords.set(k, kw.value);
  });
  if (!alive()) return null;
  const excludeKeys = new Set(all.map(c => keyOf(c.media_type, c.id)));
  const openedKeys = new Set(recentViews.list().map(v => keyOf(v.media_type, v.id)));
  const rank = (onMine = new Set()) => rankPicks({ seeds, recsBySeed, infoBySeed, keywords, excludeKeys, openedKeys, onMine });
  let ranked = rank();
  // Keywords say more about the "feel" of a title than genres do: look them up for the best candidates (cached a week).
  await pool(ranked.slice(0, 24), 8, async r => {
    const k = keyOf(r.item.media_type, r.item.id);
    try { keywords.set(k, await T.keywords(r.item.media_type, r.item.id)); } catch { /* genres only for this one */ }
  });
  if (!alive()) return null;
  ranked = rank();
  // Only titles the reader can actually watch are suggested: keep those on one of the reader's own services (in their country).
  // Candidates are checked best first until enough are found (provider data is cached 3 days).
  const mine = new Set(getSettings().myOtts);
  let onMine = new Map(), keep = ranked;
  if (mine.size) {
    onMine = await availableOnMine(ranked.map(r => r.item), alive, { need: 16, max: 80 });
    if (!alive()) return null;
    keep = ranked.filter(r => onMine.has(keyOf(r.item.media_type, r.item.id)));
  }
  const list = leadFirst(diversify(keep, { head: 9, perSeed: 3 })).slice(0, 16).map(r => ({ ...r, mine: onMine.get(keyOf(r.item.media_type, r.item.id)) || [] }));
  return list.length ? { list } : null;
}

// Which of these titles can the reader watch on one of their own services in their country (subscription, free or ad-supported;
// renting or buying does not count)? Returns Map("type:id" -> [service keys]). Titles are checked in order, in batches, until
// `need` are found or `max` were checked; a title with no provider data counts as not watchable.
export async function availableOnMine(items, alive = () => true, { need = Infinity, max = 80 } = {}) {
  const mine = new Set(getSettings().myOtts), country = getSettings().country, found = new Map();
  if (!mine.size) return found;
  const todo = items.slice(0, max);
  for (let at = 0; at < todo.length && found.size < need && alive(); at += 16) {
    await pool(todo.slice(at, at + 16), 8, async it => {
      try {
        const keys = onMyServices((await T.providers(it.media_type, it.id)).results?.[country], mine);
        if (keys.length) found.set(keyOf(it.media_type, it.id), keys);
      } catch { /* no data for this title: not watchable as far as we know */ }
    });
  }
  return found;
}
