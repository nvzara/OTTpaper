// View: Title page as a newspaper article (where to watch, worldwide, trailer, recommendations)
import * as T from '../tmdb.js';
import { I } from '../icons.js';
import { OTTS, ottKey, getSettings, recentViews, clippings } from '../store.js';
import { worldwideRows } from '../advisor.js';
import { pickTrailer } from '../filters.js';
import { t, getLang, countryName } from '../i18n.js';
import { $, $app, esc, fmtDate, fmtNum, typeLabel, toast, poster, grid, errView, sec, stars, lede, scriptCls, skStory } from '../ui.js';

let kindFilter = 'all';
const KINDS = ['flatrate', 'free', 'ads', 'rent', 'buy'];
function certification(d, type, country) {
  if (type === 'movie') {
    const r = d.release_dates?.results?.find(x => x.iso_3166_1 === country);
    return r?.release_dates?.find(x => x.certification)?.certification || '';
  }
  return d.content_ratings?.results?.find(x => x.iso_3166_1 === country)?.rating || '';
}
// Providers of one kind, my services first.
const sorted = (p, k, mine) => (p[k] || []).slice().sort((a, b) => (mine.has(ottKey(b.provider_name)) - mine.has(ottKey(a.provider_name))) || a.display_priority - b.display_priority);
function provHtml(p, s) {
  if (!p) return `<p class="note">${t('no_prov_country')}</p>`;
  const mine = new Set(s.myOtts);
  const rows = KINDS.filter(k => kindFilter === 'all' || kindFilter === k).map(k => {
    const list = sorted(p, k, mine);
    if (!list.length) return '';
    return `<div><dt>${t('k_' + k)}</dt><dd><ul class="pills">${list.map(x => {
      const key = ottKey(x.provider_name), own = key && mine.has(key);
      const url = key ? OTTS.find(o => o.key === key).url : p.link;
      return `<li><a class="pill${own ? ' mine' : ''}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${own ? I.check() : ''}${esc(x.provider_name)}</a></li>`;
    }).join('')}</ul></dd></div>`;
  }).join('');
  return (rows ? `<dl class="listing">${rows}</dl>` : `<p class="note">${t('no_prov_kind')}</p>`) +
    (p.link ? `<p class="note"><a href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">${t('tmdb_page')} ${I.external()}</a> ${t('jw_credit')}</p>` : '');
}
// One line under the headline that answers "where can I stream this?" before anything else.
function glanceHtml(p, s, cname) {
  if (!p) return '';
  const mine = new Set(s.myOtts), seen = new Set();
  const list = ['flatrate', 'free', 'ads'].flatMap(k => sorted(p, k, mine)).filter(x => !seen.has(x.provider_name) && seen.add(x.provider_name));
  return `<p class="glance"><span class="lbl">${esc(t('glance', cname))}</span>${list.length
    ? list.slice(0, 6).map(x => { const own = mine.has(ottKey(x.provider_name)); return `<span class="pill${own ? ' mine' : ''}">${own ? I.check() : ''}${esc(x.provider_name)}</span>`; }).join('')
    : `<span class="none">${esc(t('glance_none', cname))}</span>`}</p>`;
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
  if (type !== 'movie' && type !== 'tv' || !/^\d+$/.test(id)) { $app.innerHTML = `<div class="err">${I.info()}<span>${t('bad_url')}</span></div>`; return; }
  $app.innerHTML = skStory();
  const s = getSettings();
  try {
    const [d, pv] = await Promise.all([T.detail(type, id), T.providers(type, id)]);
    // Titles without an overview in the chosen language fall back to the English one.
    if (!d.overview && getLang() !== 'en') d.overview = await T.overviewEn(type, id).catch(() => '');
    const title = d.title || d.name;
    document.title = `${title} — OTTpaper`;
    recentViews.add({ id: d.id, media_type: type, title, poster_path: d.poster_path,
      release_date: d.release_date, first_air_date: d.first_air_date }, (a, b) => a.id === b.id && a.media_type === b.media_type);
    const cert = certification(d, type, s.country), cname = countryName(s.country);
    const run = type === 'movie' ? d.runtime : d.episode_run_time?.[0];
    const names = (list, n) => (list || []).slice(0, n).map(x => esc(x.name)).join(', ');
    const cast = names(d.credits?.cast, 4);
    const makers = type === 'movie' ? names((d.credits?.crew || []).filter(c => c.job === 'Director'), 2) : names(d.created_by, 2);
    const year = (d.release_date || d.first_air_date || '').slice(0, 4);
    const origTitle = d.original_title || d.original_name;
    const kicker = [typeLabel(type), ...(d.genres || []).slice(0, 2).map(g => g.name), year].filter(Boolean).map(esc).join(' · ');
    const facts = [
      [t('fact_rating'), d.vote_average ? `${stars(d.vote_average)}${d.vote_count ? ` <small>(${esc(t('fact_votes', fmtNum(d.vote_count)))})</small>` : ''}` : ''],
      [t('fact_rated'), esc(cert)],
      [t('fact_runtime'), run ? esc(t('min', run)) : ''],
      [t('fact_seasons'), type === 'tv' && d.number_of_seasons ? esc(t('seasons', d.number_of_seasons, d.number_of_episodes)) : ''],
      [t('fact_released'), esc(d.release_date || d.first_air_date ? fmtDate(d.release_date || d.first_air_date, { dateStyle: 'long' }) : '')],
      [t('fact_status'), esc(d.status || '')],
      [t('orig_title'), origTitle && origTitle !== title ? esc(origTitle) : ''],
    ].filter(([, v]) => v);
    const pr = pv.results?.[s.country];
    const trailerKey = pickTrailer(d.videos?.results);
    const recs = (d.recommendations?.results || []).filter(x => x.id !== d.id).slice(0, 12).map(x => ({ ...x, media_type: type }));
    const clipItem = { id: d.id, media_type: type, title, poster_path: d.poster_path, release_date: d.release_date, first_air_date: d.first_air_date };
    const size = title.length > 70 ? ' xlong' : title.length > 36 ? ' long' : '';
    $app.innerHTML = `<article class="article">
      <header class="art-head">
        <p class="kicker">${kicker}</p>
        <h1 class="art-title${size}${scriptCls(title)}">${esc(title)}</h1>
        ${d.tagline ? `<p class="deck">${esc(d.tagline)}</p>` : ''}
        <div class="byrow">
          <p class="byline">${makers ? `<span>${esc(t(type === 'movie' ? 'art_by' : 'art_created'))} <b>${makers}</b></span>` : ''}${makers && cast ? ' · ' : ''}${cast ? `<span>${esc(t('art_starring'))} <b>${cast}</b></span>` : ''}</p>
          <p class="actions"><button class="btn" id="clip"></button>${trailerKey ? `<a class="btn" href="https://www.youtube.com/watch?v=${encodeURIComponent(trailerKey)}" target="_blank" rel="noopener noreferrer">${I.external()} ${t('trailer')}</a>` : ''}</p>
        </div>
        ${glanceHtml(pr, s, cname)}
      </header>
      <div class="art-body">
        <figure class="photo">${poster(d.poster_path, 'w500')}<figcaption><span class="credit">${esc(t('photo_credit'))}</span>${esc(title)}${year ? ` (${esc(year)})` : ''}</figcaption></figure>
        <div class="art-text">${d.overview ? lede(d.overview) : `<p class="note">${t('no_overview')}</p>`}</div>
        <section class="where" aria-labelledby="whereH">
          <h2 class="where-h" id="whereH">${I.tvbox()} ${esc(t('where', cname))}</h2>
          <div class="chips" id="kf">${['all', ...KINDS].map(k =>
            `<button data-k="${k}" aria-pressed="${k === kindFilter}">${t('k_' + k)}</button>`).join('')}</div>
          <div class="prov" id="prov">${provHtml(pr, s)}</div>
          <p class="note">${t('mine_note')}</p>
        </section>
        ${facts.length ? `<aside class="facts" aria-label="${esc(t('facts_title'))}"><h3>${esc(t('facts_title'))}</h3><dl>${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl></aside>` : ''}
        ${worldwideHtml(pv.results)}
      </div>
      ${recs.length ? `<section class="recs">${sec(t('similar'))}${grid(recs, null, 'strip')}</section>` : ''}
    </article>`;
    const paintClip = () => { const on = clippings.has(clipItem); $('#clip').innerHTML = I.scissors() + ' ' + t(on ? 'clip_saved' : 'clip_add'); $('#clip').setAttribute('aria-pressed', on); };
    paintClip();
    $('#clip').onclick = () => { toast(t(clippings.toggle(clipItem) ? 'clip_added' : 'clip_removed')); paintClip(); };
    document.querySelectorAll('#kf [data-k]').forEach(b => b.onclick = () => {
      kindFilter = b.dataset.k;
      document.querySelectorAll('#kf [data-k]').forEach(x => x.setAttribute('aria-pressed', x === b));
      $('#prov').innerHTML = provHtml(pr, s);
    });
  } catch (e) { $app.innerHTML = errView(e); }
}
