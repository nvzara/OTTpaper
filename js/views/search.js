// View: Search results, filters, suggestions
import * as T from '../tmdb.js';
import { I } from '../icons.js';
import { getSettings, recentSearch } from '../store.js';
import { onMyServices } from '../advisor.js';
import { DECADES, SORTS, filterSearch } from '../filters.js';
import { t } from '../i18n.js';
import { $, $app, esc, grid, errView, sec, pageHead, empty, skGrid } from '../ui.js';

// Search suggestions: the browser's own <datalist> fed with this device's recent searches (nothing is sent anywhere).
export function refreshSuggest() { $('#qlist').innerHTML = recentSearch.list().map(x => `<option value="${esc(x)}"></option>`).join(''); }

// ---- Search ----
export async function searchView(q) {
  q = (q || '').trim();
  $('#q').value = q;
  if (!q) {
    const rs = recentSearch.list();
    $app.innerHTML = pageHead({ kicker: t('nav_search'), title: t('recent_searches'), deck: t('search_hint') }) + (rs.length
      ? `<div class="chips news-index">${rs.map(s => `<button data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>`
      : empty(t('no_history')));
    $app.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { location.hash = '/search?q=' + encodeURIComponent(b.dataset.q); });
    return;
  }
  recentSearch.add(q, (a, b) => a === b);
  refreshSuggest();
  $app.innerHTML = `${pageHead({ kicker: t('nav_search'), title: esc(t('search_results', q)), long: q.length > 16, extra: '<p class="byline" id="count">&nbsp;</p>' })}<div id="list">${skGrid(12, t('searching'))}</div>`;
  try {
    const d = await T.search(q);
    const items = d.results.filter(x => x.media_type === 'movie' || x.media_type === 'tv');
    const mine = new Set(getSettings().myOtts);
    const st = { decade: 'any', sort: 'rel', onlyMine: false }, avail = new Set();   // avail: "type:id" keys on my services
    const chips = (name, opts, cur) => `<div class="chips" role="radiogroup" aria-label="${esc(opts.label)}"><span class="chiplabel" aria-hidden="true">${esc(opts.label)}</span>${opts.items.map(([v, l]) => `<button data-${name}="${v}" aria-pressed="${v === cur}">${esc(l)}</button>`).join('')}</div>`;
    const by = (r, ty) => r.filter(x => x.media_type === ty);
    $('#count').textContent = t('search_count', items.length, by(items, 'movie').length, by(items, 'tv').length);
    if (!items.length) { $('#list').innerHTML = empty(t('search_none')); return; }
    const render = () => {
      const r = filterSearch(items, st), mv = by(r, 'movie'), tv = by(r, 'tv');
      $('#results').innerHTML = (mv.length || !tv.length ? sec(t('movies'), mv.length) + grid(mv) : '') + (tv.length ? sec(t('tv'), tv.length) + grid(tv) : '');
      $('#results').classList.toggle('only-mine', st.onlyMine);
      for (const k of avail) decorate(k);
    };
    $('#list').innerHTML = `<div class="filters">
      ${chips('decade', { label: t('f_decade'), items: DECADES.map(k => [k, k === 'any' ? t('tn_any') : t('d_' + k)]) }, st.decade)}
      ${chips('sort', { label: t('f_sort'), items: SORTS.map(k => [k, t('sort_' + k)]) }, st.sort)}
      ${mine.size ? `<button class="toggle" id="onlyMine" aria-pressed="false">${t('filter_mine')}</button><p class="note" id="availNote" role="status">${t('avail_checking')}</p>` : ''}</div>
      <div id="results"></div>`;
    for (const k of ['decade', 'sort']) document.querySelectorAll(`[data-${k}]`).forEach(b => b.onclick = () => {
      st[k] = b.dataset[k]; document.querySelectorAll(`[data-${k}]`).forEach(x => x.setAttribute('aria-pressed', x === b)); render();
    });
    const btn = $('#onlyMine');
    if (btn) btn.onclick = () => { st.onlyMine = btn.getAttribute('aria-pressed') !== 'true'; btn.setAttribute('aria-pressed', st.onlyMine); $('#results').classList.toggle('only-mine', st.onlyMine); };
    const decorate = k => {
      const el = $(`.card[data-k="${k}"]`);
      if (el && !el.classList.contains('on-mine')) { el.classList.add('on-mine'); el.querySelector('.p')?.insertAdjacentHTML('beforeend', `<span class="avail">${I.check()} ${t('badge_mine')}</span>`); }
    };
    render();
    if (mine.size) markAvailability(items.slice(0, 24), mine, k => { avail.add(k); decorate(k); });
  } catch (e) { $('#list').innerHTML = errView(e); }
}

// Find search results that are on one of MY services (background; provider data is cached 3 days) and report each via onHit.
async function markAvailability(items, mine, onHit) {
  const country = getSettings().country;
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const it = items[next++];
      try {
        const pv = await T.providers(it.media_type, it.id);
        if (onMyServices(pv.results?.[country], mine).length) onHit(`${it.media_type}:${Number(it.id)}`);
      } catch (e) { if (e.message === 'NO_KEY' || e.message === 'BAD_KEY') return; }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  $('#availNote')?.remove();
}
