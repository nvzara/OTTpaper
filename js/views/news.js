// View: The Wire (news), one edition per country
import { I } from '../icons.js';
import { getSettings } from '../store.js';
import { NEWS_SERVICES, newsMatches } from '../filters.js';
import { t, countryName } from '../i18n.js';
import { $, $app, esc, httpUrl, fmtDate } from '../ui.js';

// news/news.<CC>.json is generated at deploy time by scripts/fetch-news.mjs (one file per country edition).
export async function newsView() {
  const cc = getSettings().country, cname = countryName(cc);
  $app.innerHTML = `<h1 class="page-h">${I.news()} ${t('news_title')} <span class="edition-tag">${esc(t('news_edition', cname))}</span></h1><p class="note">${t('news_sub')}</p><div id="wire"><p class="note">${t('loading')}</p></div>
    <p class="note">${t('news_attrib')}</p>`;
  let d = null;
  try { const r = await fetch(`news/news.${encodeURIComponent(cc)}.json`, { cache: 'no-cache' }); if (r.ok) d = await r.json(); } catch {}
  const items = Array.isArray(d?.items) ? d.items.slice(0, 60) : [];
  if (!items.length) { $('#wire').innerHTML = `<div class="err">${I.info()} ${t('news_empty')}</div>`; return; }
  const label = k => k === 'all' ? t('ns_all') : t('ns_' + k) !== 'ns_' + k ? t('ns_' + k) : k[0].toUpperCase() + k.slice(1);
  const story = (n, lead) => `<article class="story${lead ? ' lead' : ''}">
      <div class="kicker">${esc(n.source)}${n.published ? ' · ' + esc(fmtDate(n.published, { dateStyle: 'medium' })) : ''}</div>
      <h3><a href="${esc(httpUrl(n.link))}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a></h3>
      ${n.summary ? `<p>${esc(n.summary)}</p>` : ''}
      <a class="more" href="${esc(httpUrl(n.link))}" target="_blank" rel="noopener noreferrer">${esc(t('news_read', n.source))} ${I.external()}</a></article>`;
  const section = (title, list, first) => list.length ? `<h2 class="sec">${esc(title)}</h2><div class="wire">${list.map((n, i) => story(n, first && i === 0)).join('')}</div>` : '';
  const paint = key => {
    const list = items.filter(n => newsMatches(n, key)), local = list.filter(n => n.local), world = list.filter(n => !n.local);
    $('#wireList').innerHTML = list.length
      ? section(t('news_local', cname), local, true) + section(local.length ? t('news_world') : t('news_edition', cname), world, !local.length)
      : `<p class="note">${t('no_results')}</p>`;
  };
  $('#wire').innerHTML = `<p class="note">${t('news_updated', fmtDate(d.generatedAt, { dateStyle: 'medium', timeStyle: 'short' }))}</p>
    ${d.localSources === 0 ? `<p class="note">${esc(t('news_nolocal', cname))} ${esc(t('news_lang'))}</p>` : ''}
    <div class="chips" role="radiogroup" aria-label="${esc(t('news_service'))}">${['all', ...Object.keys(NEWS_SERVICES)].map(k => `<button data-ns="${k}" aria-pressed="${k === 'all'}">${esc(label(k))}</button>`).join('')}</div>
    <div id="wireList"></div>`;
  paint('all');
  document.querySelectorAll('[data-ns]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-ns]').forEach(x => x.setAttribute('aria-pressed', x === b)); paint(b.dataset.ns); });
}
