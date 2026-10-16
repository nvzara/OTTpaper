// "Subscription advisor": which streaming services cover the most of the user's clippings. Pure logic, no DOM/network.
import { ottKey } from './store.js';

// clips: [{id, media_type, title}], pvByClip: Map("type:id" -> TMDB watch-provider country object | null), myKeys: Set of OTT keys
export function computeCoverage(clips, pvByClip, myKeys) {
  const svc = new Map();            // service id -> { name, key, mine, ids:Set }
  const noData = [], noSub = [];    // titles without data / only free, rent or buy
  const covered = new Set();        // clip ids covered by one of my services
  for (const c of clips) {
    const id = `${c.media_type}:${c.id}`;
    const p = pvByClip.get(id);
    if (!p) { noData.push(c); continue; }
    const flat = p.flatrate || [];
    if (!flat.length) noSub.push(c);
    for (const x of flat) {
      const key = ottKey(x.provider_name);
      const sid = key || 'p:' + x.provider_name;
      if (!svc.has(sid)) svc.set(sid, { name: x.provider_name, key, mine: !!(key && myKeys.has(key)), ids: new Set() });
      svc.get(sid).ids.add(id);
      if (svc.get(sid).mine) covered.add(id);
    }
  }
  const ranking = [...svc.values()].map(s => ({ ...s, count: s.ids.size, titles: clips.filter(c => s.ids.has(`${c.media_type}:${c.id}`)) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  // Best service to ADD: most currently-uncovered titles
  let best = null;
  for (const s of ranking) {
    if (s.mine) continue;
    const gain = [...s.ids].filter(i => !covered.has(i)).length;
    if (gain > 0 && (!best || gain > best.gain)) best = { name: s.name, gain };
  }
  const withData = clips.length - noData.length;
  return { total: clips.length, withData, covered: covered.size, ranking, best, noSub, noData };
}
