// View: Title page (where to watch, worldwide, trailer, recommendations)
import * as T from '../tmdb.js';
import { I } from '../icons.js';
import { OTTS, ottKey, getSettings, recentViews, clippings } from '../store.js';
import { worldwideRows } from '../advisor.js';
import { pickTrailer } from '../filters.js';
import { t, getLang, countryName } from '../i18n.js';
import { $, $app, esc, typeLabel, toast, poster, grid, errView } from '../ui.js';

// ---- Detail ----
let kindFilter = 'all';
const KINDS = ['flatrate', 'free', 'ads', 'rent', 'buy'];
function certification(d, type, country) {
  if (type === 'movie') {
    const r = d.release_dates?.results?.find(x => x.iso_3166_1 === country);
    return r?.release_dates?.find(x => x.certification)?.certification || '';
  }
  return d.content_ratings?.results?.find(x => x.iso_3166_1 === country)?.rating || '';
}
function provHtml(p, s) {
  if (!p) return `<p class="note">${t('no_prov_country')}</p>`;
  const mine = new Set(s.myOtts);
  const sections = KINDS.filter(k => kindFilter === 'all' || kindFilter === k).map(k => {
    const list = (p[k] || []).slice().sort((a, b) => (mine.has(ottKey(b.provider_name)) - mine.has(ottKey(a.provider_name))) || a.display_priority - b.display_priority);
    if (!list.length) return '';
    return `<h3>${t('k_' + k)}</h3><div class="pills">` + list.map(x => {
      const key = ottKey(x.provider_name);
      const own = key && mine.has(key);
      const url = key ? OTTS.find(o => o.key === key).url : p.link;
      return `<a class="pill${own ? ' mine' : ''}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${own ? I.check() : ''}${esc(x.provider_name)}</a>`;
    }).join('') + '</div>';
  }).join('');
  return (sections || `<p class="note">${t('no_prov_kind')}</p>`) +
    (p.link ? `<p class="note"><a href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">${t('tmdb_page')} ${I.external()}</a> ${t('jw_credit')}</p>` : '');
}
function worldwideHtml(results) {
  const rows = worldwideRows(results);
  if (!rows.length) return '';
  const mine = new Set(getSettings().myOtts), cur = getSettings().country;
  return `<details class="ww"><summary>${I.globe()} ${esc(t('ww_title'))} · ${esc(t('ww_sub', rows.length))}</summary>
    <table><tbody>${rows.map(r => `<tr${r.code === cur ? ' class="cur"' : ''}><th scope="row">${esc(countryName(r.code))}</th>
      <td>${r.flatrate.map(n => `<span class="pill${mine.has(ottKey(n)) ? ' mine' : ''}">${esc(n)}</span>`).join('')}
      ${r.other.length ? `<span class="note">${esc(t('ww_other'))}: ${esc(r.other.join(', '))}</span>` : ''}
      ${!r.flatrate.length && !r.other.length ? `<span class="note">${esc(t('ww_rentbuy'))}</span>` : ''}</td></tr>`).join('')}</tbody></table>
    <p class="note">${esc(t('ww_note'))}</p></details>`;
}
export async function detailView(type, id) {
  if (type !== 'movie' && type !== 'tv' || !/^\d+$/.test(id)) { $app.innerHTML = `<p>${t('bad_url')}</p>`; return; }
  $app.innerHTML = `<p class="note">${t('loading')}</p>`;
  const s = getSettings();
  try {
    const [d, pv] = await Promise.all([T.detail(type, id), T.providers(type, id)]);
    // Titles without an overview in the chosen language fall back to the English one.
    if (!d.overview && getLang() !== 'en') d.overview = await T.overviewEn(type, id).catch(() => '');
    const title = d.title || d.name;
    recentViews.add({ id: d.id, media_type: type, title, poster_path: d.poster_path,
      release_date: d.release_date, first_air_date: d.first_air_date }, (a, b) => a.id === b.id && a.media_type === b.media_type);
    const cert = certification(d, type, s.country);
    const run = type === 'movie' ? d.runtime : d.episode_run_time?.[0];
    const cast = (d.credits?.cast || []).slice(0, 8).map(c => esc(c.name)).join(', ');
    const meta = [typeLabel(type), (d.release_date || d.first_air_date || '').slice(0, 4), cert, run ? t('min', run) : '',
      type === 'tv' ? t('seasons', d.number_of_seasons, d.number_of_episodes) : '', d.status].filter(Boolean).map(esc).join(' · ');
    const pr = pv.results?.[s.country];
    const trailerKey = pickTrailer(d.videos?.results);
    const recs = (d.recommendations?.results || []).filter(x => x.id !== d.id).slice(0, 12).map(x => ({ ...x, media_type: type }));
    const clip = { id: d.id, media_type: type, title, poster_path: d.poster_path, release_date: d.release_date, first_air_date: d.first_air_date };
    $app.innerHTML = `<div class="detail"><div class="p">${poster(d.poster_path, 'w500')}</div><div>
      <h1>${esc(title)}</h1>
      <p class="actions"><button class="btn" id="clip"></button>${trailerKey ? `<a class="btn" href="https://www.youtube.com/watch?v=${encodeURIComponent(trailerKey)}" target="_blank" rel="noopener noreferrer">${I.external()} ${t('trailer')}</a>` : ''}</p>
      <div class="meta">${d.vote_average ? `<span class="score inline">${I.star()}${d.vote_average.toFixed(1)}</span> ` : ''}${meta}</div>
      <p class="meta">${esc((d.genres || []).map(g => g.name).join(', '))}</p>
      <p>${esc(d.overview) || `<span class="note">${t('no_overview')}</span>`}</p>
      ${cast ? `<p class="meta">${t('cast')}: ${cast}</p>` : ''}
      <h2 class="sec">${I.tvbox()} ${esc(t('where', countryName(s.country)))}</h2>
      <div class="chips" id="kf">${['all', ...KINDS].map(k =>
        `<button data-k="${k}" aria-pressed="${k === kindFilter}">${t('k_' + k)}</button>`).join('')}</div>
      <div class="prov" id="prov">${provHtml(pr, s)}</div>
      <p class="note">${I.check()} ${t('mine_note')}</p>
      ${worldwideHtml(pv.results)}
      </div></div>${recs.length ? `<section class="recs"><h2 class="sec">${I.sparkle()} ${t('similar')}</h2>${grid(recs)}</section>` : ''}`;
    const paintClip = () => { const on = clippings.has(clip); $('#clip').innerHTML = I.bookmark(on) + ' ' + t(on ? 'clip_saved' : 'clip_add'); $('#clip').setAttribute('aria-pressed', on); };
    paintClip();
    $('#clip').onclick = () => { toast(t(clippings.toggle(clip) ? 'clip_added' : 'clip_removed')); paintClip(); };
    document.querySelectorAll('#kf [data-k]').forEach(b => b.onclick = () => {
      kindFilter = b.dataset.k;
      document.querySelectorAll('#kf [data-k]').forEach(x => x.setAttribute('aria-pressed', x === b));
      $('#prov').innerHTML = provHtml(pr, s);
    });
  } catch (e) { $app.innerHTML = errView(e); }
}
