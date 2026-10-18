// View: Tonight picker — an evening feature: choose type / mood / length, we pick one from your services
import * as T from '../tmdb.js';
import { I } from '../icons.js';
import { getSettings, recentViews, tonightTaste } from '../store.js';
import { MOODS, resolveProviderIds, buildDiscoverParams, pickOne, LENGTHS, ERAS, RATINGS, ORIGINS, ORDERS, cleanTaste, fineCount } from '../tonight.js';
import { t, getLang } from '../i18n.js';
import { $, $app, esc, typeLabel, poster, grid, errView, pageHead, empty, sec, stars, lede, clip, scriptCls, skStory, yearOfItem, viewGuard } from '../ui.js';

let tn = null;   // the taste profile, loaded from storage on the first visit and saved on every change
const save = () => tonightTaste.set(tn);
// "Any" for the rest of the row means: nothing chosen.
export function tonightView() {
  const s = getSettings(), hasMine = s.myOtts.length > 0;
  tn = cleanTaste(tn || tonightTaste.get());
  const lang = getLang();
  const moodKeys = Object.keys(MOODS[tn.type]), fine = fineCount(tn);
  const radio = (label, name, opts, cur) => `<div class="row"><span class="lbl" id="lb-${name}">${label}</span><div class="chips" role="radiogroup" aria-labelledby="lb-${name}">${opts.map(([v, l]) => `<button data-${name}="${v}" aria-pressed="${String(cur) === String(v)}">${esc(l)}</button>`).join('')}</div></div>`;
  const multi = (label, name, keys, cur, any) => `<div class="row"><span class="lbl" id="lb-${name}">${label}</span><div class="chips" role="group" aria-labelledby="lb-${name}">${any ? `<button data-${name}="" aria-pressed="${!cur.length}">${esc(t('tn_any'))}</button>` : ''}${keys.map(k => `<button data-${name}="${k}" aria-pressed="${cur.includes(k)}">${esc(t('m_' + k))}</button>`).join('')}</div></div>`;
  const langName = c => c ? (new Intl.DisplayNames([lang], { type: 'language' }).of(c) || c) : t('tn_any');
  $app.innerHTML = pageHead({ kicker: t('tn_kicker'), title: t('tn_title'), deck: t('tn_sub') }) +
    `<section class="picker">
      ${radio(t('tn_type'), 'type', [['movie', t('type_movie')], ['tv', t('type_tv')]], tn.type)}
      ${multi(t('tn_mood'), 'moods', moodKeys, tn.moods, true)}
      ${radio(t('tn_length'), 'len', [[0, t('tn_any')], ...LENGTHS[tn.type].map(n => [n, t('tn_len', n)])], tn.len)}
      <details class="fine"${fine ? ' open' : ''}><summary>${esc(t('tn_fine'))}<span class="n" id="fineN">${fine || ''}</span></summary>
        ${multi(t('tn_exclude'), 'exclude', moodKeys, tn.exclude, false)}
        ${radio(t('tn_era'), 'era', ERAS.map(k => [k, k === 'any' ? t('tn_any') : t('d_' + k)]), tn.era)}
        ${radio(t('tn_rating'), 'rating', RATINGS.map(n => [n, n ? t('tn_rate', n) : t('tn_any')]), tn.rating)}
        ${radio(t('tn_lang'), 'lang', ORIGINS.map(c => [c, langName(c)]), tn.lang)}
        ${radio(t('tn_order'), 'order', ORDERS.map(k => [k, t('tn_sort_' + k)]), tn.order)}
        <div class="row"><span class="lbl"></span><div class="chips"><label class="chip"><input type="checkbox" id="tnSeen"${tn.skipSeen ? ' checked' : ''}><span>${esc(t('tn_skipseen'))}</span></label><button type="button" id="tnReset">${esc(t('tn_reset'))}</button></div></div>
      </details>
      <div class="go">${hasMine ? `<label class="chip"><input type="checkbox" id="tnMine"${tn.mine ? ' checked' : ''}><span>${t('tn_mine')}</span></label>` : '<span></span>'}
      <p class="actions"><button class="btn primary" id="spin">${I.moon()} ${t('tn_spin')}</button></p></div></section>
    <div id="tnOut" aria-live="polite"></div>`;
  // Reflect the profile in the chips without redrawing (keeps keyboard focus where it is).
  const sync = () => {
    document.querySelectorAll('[data-moods]').forEach(b => b.setAttribute('aria-pressed', b.dataset.moods ? tn.moods.includes(b.dataset.moods) : !tn.moods.length));
    document.querySelectorAll('[data-exclude]').forEach(b => b.setAttribute('aria-pressed', tn.exclude.includes(b.dataset.exclude)));
    for (const k of ['len', 'era', 'rating', 'lang', 'order']) document.querySelectorAll(`[data-${k}]`).forEach(b => b.setAttribute('aria-pressed', String(tn[k]) === b.dataset[k]));
    const n = fineCount(tn); $('#fineN').textContent = n || '';
    save();
  };
  const toggle = (list, k) => list.includes(k) ? list.filter(x => x !== k) : [...list, k];
  document.querySelectorAll('[data-type]').forEach(b => b.onclick = () => {
    tn = cleanTaste({ ...tn, type: b.dataset.type }); save();   // moods and lengths differ per type
    tonightView(); $('[data-type][aria-pressed=true]')?.focus();   // keep the keyboard where it was
  });
  document.querySelectorAll('[data-moods]').forEach(b => b.onclick = () => {
    const k = b.dataset.moods;
    tn.moods = k ? toggle(tn.moods, k) : [];
    tn.exclude = tn.exclude.filter(x => !tn.moods.includes(x));   // a mood cannot be both wanted and excluded
    sync();
  });
  document.querySelectorAll('[data-exclude]').forEach(b => b.onclick = () => {
    const k = b.dataset.exclude;
    tn.exclude = toggle(tn.exclude, k);
    tn.moods = tn.moods.filter(x => !tn.exclude.includes(x));
    sync();
  });
  for (const k of ['len', 'era', 'rating']) document.querySelectorAll(`[data-${k}]`).forEach(b => b.onclick = () => { tn[k] = k === 'era' ? b.dataset[k] : +b.dataset[k]; sync(); });
  for (const k of ['lang', 'order']) document.querySelectorAll(`[data-${k}]`).forEach(b => b.onclick = () => { tn[k] = b.dataset[k]; sync(); });
  $('#tnSeen').addEventListener('change', e => { tn.skipSeen = e.target.checked; sync(); });
  $('#tnReset').onclick = () => { tn = cleanTaste({ type: tn.type, mine: tn.mine }); save(); tonightView(); $('details.fine').open = true; $('#tnReset')?.focus(); };   // stay in the panel the reader was using
  $('#tnMine')?.addEventListener('change', e => { tn.mine = e.target.checked; save(); });
  $('#spin').onclick = tonightSpin;
}
let tnList = [], tnSeen = new Set();
let spinNo = 0;
async function tonightSpin() {
  const s = getSettings(), out = $('#tnOut'), no = ++spinNo, alive = viewGuard();
  out.innerHTML = skStory();
  try {
    let ids = [], noprov = false;
    if (tn.mine && s.myOtts.length) {
      ids = resolveProviderIds((await T.providerList(tn.type, s.country)).results, new Set(s.myOtts));
      noprov = !ids.length;
    }
    const params = buildDiscoverParams({ type: tn.type, moods: tn.moods, exclude: tn.exclude, maxRuntime: tn.len || 0, region: s.country, providerIds: ids, era: tn.era, minRating: tn.rating, lang: tn.lang, order: tn.order });
    const found = ((await T.discover(tn.type, params)).results || []).map(x => ({ ...x, media_type: tn.type }));
    const opened = tn.skipSeen ? new Set(recentViews.list().filter(v => v.media_type === tn.type).map(v => v.id)) : null;
    const fresh = opened ? found.filter(x => !opened.has(x.id)) : found;
    if (no !== spinNo || !alive()) return;   // a newer request has taken over (double click), or the reader left
    tnList = fresh.slice(0, 20); tnSeen = new Set();
    out.dataset.noprov = noprov ? '1' : '';
    showTonight();
  } catch (e) { if (no === spinNo && alive()) out.innerHTML = errView(e); }
}
function showTonight() {
  const out = $('#tnOut'), pick = pickOne(tnList, tnSeen);
  if (!pick) { out.innerHTML = empty(t('tn_none')); return; }
  tnSeen.add(pick.id);
  const y = yearOfItem(pick), title = pick.title || pick.name, href = `#/title/${pick.media_type}/${Number(pick.id)}`;
  out.innerHTML = `${out.dataset.noprov ? `<p class="ed-note">${t('tn_noprov')}</p>` : ''}
    <article class="lead-story">
      <div class="kicker">${esc(t('tn_pick'))}</div>
      <h2 class="lead-h${scriptCls(title)}"><a href="${href}">${esc(title)}</a></h2>
      <p class="byline">${esc(typeLabel(pick.media_type))}${y ? ' · ' + esc(y) : ''}${pick.vote_average ? ' · ' + stars(pick.vote_average) : ''}</p>
      <div class="lead-body">
        <figure class="lp"><a href="${href}" tabindex="-1" aria-hidden="true">${poster(pick.poster_path, 'w500')}</a><figcaption><span class="credit">${esc(t('photo_credit'))}</span></figcaption></figure>
        ${pick.overview ? lede(clip(pick.overview, 420)) : ''}
        <p class="actions"><a class="btn primary" href="${href}">${esc(t('lead_open'))}</a><button class="btn" id="again">${I.sparkle()} ${t('tn_again')}</button></p>
      </div></article>
    ${sec(t('tn_more'))}${grid(tnList.filter(x => x.id !== pick.id).slice(0, 12))}`;
  $('#again').onclick = () => { showTonight(); $('#again')?.focus(); };
}
