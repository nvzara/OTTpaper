// "Picked for you": gathers what TMDB recommends after the reader's clippings and ranks it (ranking lives in recommend.js).
import * as T from './tmdb.js';
import { clippings, recentViews, getSettings } from './store.js';
import { onMyServices } from './advisor.js';
import { rankPicks, diversify, SEEDS_MAX, keyOf } from './recommend.js';

// Run fn over items with a few requests in flight (provider and recommendation data are cached for days).
async function pool(items, n, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) await fn(items[next++]); }));
}

// Returns null when there is nothing to base picks on; otherwise { list: [{ item, seed, n, mine: [ottKeys] }] } best first.
export async function loadPicks(alive = () => true) {
  const all = clippings.list(), seeds = all.slice(0, SEEDS_MAX);
  if (!seeds.length) return null;
  const recsBySeed = new Map(), infoBySeed = new Map();
  await pool(seeds, 4, async s => {
    const k = keyOf(s.media_type, s.id);
    const [r, i] = await Promise.allSettled([T.recommendations(s.media_type, s.id), T.basic(s.media_type, s.id)]);
    if (r.status === 'fulfilled') recsBySeed.set(k, Array.isArray(r.value?.results) ? r.value.results : []);
    if (i.status === 'fulfilled') infoBySeed.set(k, { genres: Array.isArray(i.value?.genres) ? i.value.genres : [] });
  });
  if (!alive()) return null;
  const excludeKeys = new Set(all.map(c => keyOf(c.media_type, c.id)));
  const openedKeys = new Set(recentViews.list().map(v => keyOf(v.media_type, v.id)));
  let ranked = rankPicks({ seeds, recsBySeed, infoBySeed, excludeKeys, openedKeys });
  // Titles on the reader's own services get a bonus: check the best candidates (provider data is cached 3 days).
  const mine = new Set(getSettings().myOtts), country = getSettings().country, onMine = new Map();
  if (mine.size && ranked.length) {
    await pool(ranked.slice(0, 30), 4, async r => {
      try {
        const keys = onMyServices((await T.providers(r.item.media_type, r.item.id)).results?.[country], mine);
        if (keys.length) onMine.set(keyOf(r.item.media_type, r.item.id), keys);
      } catch { /* no data for this title: no bonus */ }
    });
    if (!alive()) return null;
    ranked = rankPicks({ seeds, recsBySeed, infoBySeed, excludeKeys, openedKeys, onMine });
  }
  const list = diversify(ranked, { head: 9, perSeed: 3 }).slice(0, 16).map(r => ({ ...r, mine: onMine.get(keyOf(r.item.media_type, r.item.id)) || [] }));
  return list.length ? { list } : null;
}
