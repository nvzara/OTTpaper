// View: Home (front page, tabs, today's lead)
import * as T from '../tmdb.js';
import { I } from '../icons.js';
import { getSettings, recentViews } from '../store.js';
import { onMyServices, pickLead } from '../advisor.js';
import { t } from '../i18n.js';
import { $app, esc, typeLabel, notice, poster, card, grid, errView, $ } from '../ui.js';

// ---- Home ----
let homeTab = 'trending';
export async function home() {
  const tabs = [['trending', t('tab_trending'), I.trending()], ['movie', t('tab_movie'), I.film()], ['tv', t('tab_tv'), I.tv()], ['upcoming', t('tab_upcoming'), I.calendar()]];
  const rv = recentViews.list();
  $app.innerHTML = `${notice()}
    <div id="lead"></div>
    <div class="tabs" role="tablist">${tabs.map(([k, l, ic]) =>
      `<button role="tab" data-t="${k}" aria-pressed="${k === homeTab}">${ic}${l}</button>`).join('')}</div>
    <div id="list"><p class="note">${t('loading')}</p></div>
    ${rv.length ? `<h2 class="sec">${I.clock()} ${t('recent_views')}</h2><div class="grid">${rv.map(card).join('')}</div>` : ''}`;
  $app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { homeTab = b.dataset.t; home(); });
  renderLead();
  const $l = $('#list');
  try {
    const d = homeTab === 'trending' ? await T.trending()
      : homeTab === 'upcoming' ? await T.upcoming() : await T.popular(homeTab);
    const kind = homeTab === 'movie' || homeTab === 'upcoming' ? 'movie' : homeTab === 'tv' ? 'tv' : null;
    $l.innerHTML = grid(d.results, kind);
  } catch (e) { $l.innerHTML = errView(e); }
}

// ---- Today's lead: the front-page story, one pick per day (prefers titles on my services) ----
async function renderLead() {
  const el = $('#lead');
  try {
    const s = getSettings(), mine = new Set(s.myOtts);
    const items = (await T.trending()).results.filter(x => x.media_type === 'movie' || x.media_type === 'tv').slice(0, 12);
    const avail = new Map();
    if (mine.size) {
      let next = 0;
      const worker = async () => { while (next < items.length) { const it = items[next++];
        try { avail.set(`${it.media_type}:${it.id}`, onMyServices((await T.providers(it.media_type, it.id)).results?.[s.country], mine).length); } catch {} } };
      await Promise.all([worker(), worker(), worker(), worker()]);
    }
    const day = new Date().toLocaleDateString('en-CA');
    const pick = pickLead(items, avail, day);
    if (!pick || !$('#lead')) return;
    const it = pick.item, d = await T.detail(it.media_type, it.id);
    const over = (d.overview || it.overview || '').slice(0, 280);
    $('#lead').innerHTML = `<article class="lead-story"><a class="lp" href="#/title/${it.media_type}/${Number(it.id)}">${poster(it.poster_path, 'w342')}</a>
      <div><div class="kicker">${I.sparkle()} ${esc(t('lead_kicker'))} · ${esc(pick.onMine ? t('lead_on') : t('lead_any'))}</div>
      <h2 class="lead-h"><a href="#/title/${it.media_type}/${Number(it.id)}">${esc(it.title || it.name)}</a></h2>
      <p class="meta">${esc(typeLabel(it.media_type))}${(it.release_date || it.first_air_date) ? ' · ' + esc((it.release_date || it.first_air_date).slice(0, 4)) : ''}${it.vote_average ? ' · ★ ' + it.vote_average.toFixed(1) : ''}</p>
      ${over ? `<p>${esc(over)}${over.length >= 280 ? '…' : ''}</p>` : ''}
      <a class="more" href="#/title/${it.media_type}/${Number(it.id)}">${esc(t('lead_open'))} →</a></div></article>`;
  } catch { el && (el.innerHTML = ''); }
}
