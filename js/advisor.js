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

// Which of MY services offer this title in the chosen country (subscription, free or ad-supported). p = TMDB provider object for that country.
export function onMyServices(p, myKeys) {
  if (!p || !myKeys.size) return [];
  const keys = new Set();
  for (const kind of ['flatrate', 'free', 'ads']) for (const x of p[kind] || []) { const k = ottKey(x.provider_name); if (k && myKeys.has(k)) keys.add(k); }
  return [...keys];
}

// Worldwide table: every country TMDB knows, subscription providers first. results = TMDB `results` map (country code -> providers).
export function worldwideRows(results) {
  return Object.entries(results || {}).map(([code, p]) => ({
    code,
    flatrate: (p.flatrate || []).map(x => x.provider_name),
    other: [...new Set([...(p.free || []), ...(p.ads || [])].map(x => x.provider_name))],
    rentBuy: new Set([...(p.rent || []), ...(p.buy || [])].map(x => x.provider_name)).size,
  })).filter(r => r.flatrate.length || r.other.length || r.rentBuy)
    .sort((a, b) => b.flatrate.length - a.flatrate.length || a.code.localeCompare(b.code));
}

// Today's lead story: deterministic per calendar day (same pick all day, new one tomorrow).
// items: candidate titles; mineById: Map(key -> number of MY services offering it). Prefers titles on my services.
export function pickLead(items, mineById, dayKey) {
  if (!items.length) return null;
  const onMine = items.filter(i => (mineById.get(`${i.media_type}:${i.id}`) || 0) > 0);
  const pool = onMine.length ? onMine : items;
  let h = 5381;
  for (const ch of String(dayKey)) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return { item: pool[h % pool.length], onMine: onMine.length > 0 };
}
