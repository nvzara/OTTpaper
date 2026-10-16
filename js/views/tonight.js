// View: Tonight picker — an evening feature: choose type / mood / length, we pick one from your services
import * as T from '../tmdb.js';
import { I } from '../icons.js';
import { getSettings } from '../store.js';
import { MOODS, resolveProviderIds, buildDiscoverParams, pickOne, LENGTHS } from '../tonight.js';
import { t } from '../i18n.js';
import { $, $app, esc, typeLabel, poster, grid, errView, pageHead, empty, sec, stars, lede, clip, scriptCls, skStory, yearOfItem, viewGuard } from '../ui.js';

const tn = { type: 'movie', mood: '', len: 0, mine: true };
export function tonightView() {
  const s = getSettings(), hasMine = s.myOtts.length > 0;
  if (!MOODS[tn.type][tn.mood]) tn.mood = '';
  if (!LENGTHS[tn.type].includes(tn.len)) tn.len = 0;   // lengths differ per type (film vs episode)
  const row = (label, name, opts, cur) => `<div class="row"><span class="lbl" id="lb-${name}">${label}</span><div class="chips" role="radiogroup" aria-labelledby="lb-${name}">${opts.map(([v, l]) => `<button data-${name}="${v}" aria-pressed="${String(cur) === String(v)}">${esc(l)}</button>`).join('')}</div></div>`;
  $app.innerHTML = pageHead({ kicker: t('tn_kicker'), title: t('tn_title'), deck: t('tn_sub') }) +
    `<section class="picker">
      ${row(t('tn_type'), 'type', [['movie', t('type_movie')], ['tv', t('type_tv')]], tn.type)}
      ${row(t('tn_mood'), 'mood', [['', t('tn_any')], ...Object.keys(MOODS[tn.type]).map(k => [k, t('m_' + k)])], tn.mood)}
      ${row(t('tn_length'), 'len', [[0, t('tn_any')], ...LENGTHS[tn.type].map(n => [n, t('tn_len', n)])], tn.len)}
      <div class="go">${hasMine ? `<label class="chip"><input type="checkbox" id="tnMine"${tn.mine ? ' checked' : ''}><span>${t('tn_mine')}</span></label>` : '<span></span>'}
      <p class="actions"><button class="btn primary" id="spin">${I.moon()} ${t('tn_spin')}</button></p></div></section>
    <div id="tnOut" aria-live="polite"></div>`;
  for (const k of ['type', 'mood', 'len']) document.querySelectorAll(`[data-${k}]`).forEach(b => b.onclick = () => {
    tn[k] = k === 'len' ? +b.dataset.len : b.dataset[k];
    if (k === 'type') { tonightView(); return; }   // moods differ per type
    document.querySelectorAll(`[data-${k}]`).forEach(x => x.setAttribute('aria-pressed', x === b));
  });
  $('#tnMine')?.addEventListener('change', e => { tn.mine = e.target.checked; });
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
    const params = buildDiscoverParams({ type: tn.type, mood: tn.mood, maxRuntime: tn.len || 0, region: s.country, providerIds: ids });
    const found = ((await T.discover(tn.type, params)).results || []).slice(0, 20).map(x => ({ ...x, media_type: tn.type }));
    if (no !== spinNo || !alive()) return;   // a newer request has taken over (double click), or the reader left
    tnList = found; tnSeen = new Set();
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
  $('#again').onclick = showTonight;
}
