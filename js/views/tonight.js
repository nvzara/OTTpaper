// View: Tonight picker
import * as T from '../tmdb.js';
import { I } from '../icons.js';
import { getSettings } from '../store.js';
import { MOODS, resolveProviderIds, buildDiscoverParams, pickOne, LENGTHS } from '../tonight.js';
import { t } from '../i18n.js';
import { $, $app, esc, typeLabel, poster, grid, errView } from '../ui.js';

// ---- Tonight: pick by type / mood / length, from my services ----
const tn = { type: 'movie', mood: '', len: 0, mine: true };
export function tonightView() {
  const s = getSettings(), hasMine = s.myOtts.length > 0;
  if (!hasMine) tn.mine = false;
  if (!MOODS[tn.type][tn.mood]) tn.mood = '';
  const seg = (name, opts, cur) => `<div class="chips" role="radiogroup">${opts.map(([v, l]) => `<button data-${name}="${v}" aria-pressed="${String(cur) === String(v)}">${esc(l)}</button>`).join('')}</div>`;
  $app.innerHTML = `<h1 class="page-h">${I.moon()} ${t('tn_title')}</h1><p class="note">${t('tn_sub')}</p>
    <section class="panel"><h3>${t('tn_type')}</h3>${seg('type', [['movie', t('type_movie')], ['tv', t('type_tv')]], tn.type)}
    <h3>${t('tn_mood')}</h3>${seg('mood', [['', t('tn_any')], ...Object.keys(MOODS[tn.type]).map(k => [k, t('m_' + k)])], tn.mood)}
    <h3>${t('tn_length')}</h3>${seg('len', [[0, t('tn_any')], ...LENGTHS[tn.type].map(n => [n, t('tn_len', n)])], tn.len)}
    ${hasMine ? `<label class="chip inline"><input type="checkbox" id="tnMine"${tn.mine ? ' checked' : ''}><span>${t('tn_mine')}</span></label>` : ''}
    <p class="actions"><button class="btn primary" id="spin">${I.sparkle()} ${t('tn_spin')}</button></p></section>
    <div id="tnOut" aria-live="polite"></div>`;
  for (const k of ['type', 'mood', 'len']) document.querySelectorAll(`[data-${k}]`).forEach(b => b.onclick = () => { tn[k] = k === 'len' ? +b.dataset.len : b.dataset[k]; tonightView(); });
  $('#tnMine')?.addEventListener('change', e => { tn.mine = e.target.checked; });
  $('#spin').onclick = tonightSpin;
}
let tnList = [], tnSeen = new Set();
async function tonightSpin() {
  const s = getSettings(), out = $('#tnOut');
  out.innerHTML = `<p class="note">${t('loading')}</p>`;
  try {
    let ids = [], noprov = false;
    if (tn.mine && s.myOtts.length) {
      ids = resolveProviderIds((await T.providerList(tn.type, s.country)).results, new Set(s.myOtts));
      noprov = !ids.length;
    }
    const params = buildDiscoverParams({ type: tn.type, mood: tn.mood, maxRuntime: tn.len || 0, region: s.country, providerIds: ids });
    tnList = ((await T.discover(tn.type, params)).results || []).slice(0, 20).map(x => ({ ...x, media_type: tn.type }));
    tnSeen = new Set();
    out.dataset.noprov = noprov ? '1' : '';
    showTonight();
  } catch (e) { out.innerHTML = errView(e); }
}
function showTonight() {
  const out = $('#tnOut'), pick = pickOne(tnList, tnSeen);
  if (!pick) { out.innerHTML = `<div class="err">${I.info()} ${t('tn_none')}</div>`; return; }
  tnSeen.add(pick.id);
  const date = (pick.release_date || pick.first_air_date || '').slice(0, 4), over = (pick.overview || '').slice(0, 300);
  out.innerHTML = `${out.dataset.noprov ? `<p class="note">${t('tn_noprov')}</p>` : ''}
    <article class="lead-story"><a class="lp" href="#/title/${pick.media_type}/${Number(pick.id)}">${poster(pick.poster_path, 'w342')}</a>
      <div><div class="kicker">${I.moon()} ${esc(t('tn_pick'))}</div>
      <h2 class="lead-h"><a href="#/title/${pick.media_type}/${Number(pick.id)}">${esc(pick.title || pick.name)}</a></h2>
      <p class="meta">${esc(typeLabel(pick.media_type))}${date ? ' · ' + esc(date) : ''}${pick.vote_average ? ' · ★ ' + pick.vote_average.toFixed(1) : ''}</p>
      ${over ? `<p>${esc(over)}${over.length >= 300 ? '…' : ''}</p>` : ''}
      <p class="actions"><button class="btn" id="again">${I.sparkle()} ${t('tn_again')}</button>
      <a class="btn" href="#/title/${pick.media_type}/${Number(pick.id)}">${esc(t('lead_open'))}</a></p></div></article>
    <h2 class="sec">${t('tn_more')}</h2>${grid(tnList.filter(x => x.id !== pick.id).slice(0, 12))}`;
  $('#again').onclick = showTonight;
}
