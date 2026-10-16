// View: The Wire (news)
import { I } from '../icons.js';
import { NEWS_SERVICES, newsMatches } from '../filters.js';
import { t } from '../i18n.js';
import { $, $app, esc, httpUrl, fmtDate } from '../ui.js';

// ---- News wire (news.json is generated at deploy time by scripts/fetch-news.mjs) ----
export async function newsView() {
  $app.innerHTML = `<h1 class="page-h">${I.news()} ${t('news_title')}</h1><p class="note">${t('news_sub')}</p><div id="wire"><p class="note">${t('loading')}</p></div>
    <p class="note">${t('news_lang')} ${t('news_attrib')}</p>`;
  let d = null;
  try { const r = await fetch('news/news.json', { cache: 'no-cache' }); if (r.ok) d = await r.json(); } catch {}
  const items = Array.isArray(d?.items) ? d.items.slice(0, 60) : [];
  if (!items.length) { $('#wire').innerHTML = `<div class="err">${I.info()} ${t('news_empty')}</div>`; return; }
  const label = k => k === 'all' ? t('ns_all') : t('ns_' + k) !== 'ns_' + k ? t('ns_' + k) : k[0].toUpperCase() + k.slice(1);
  const paint = key => {
    const list = items.filter(n => newsMatches(n, key));
    $('#wireList').innerHTML = list.map((n, i) => `<article class="story${i === 0 ? ' lead' : ''}">
      <div class="kicker">${esc(n.source)}${n.published ? ' · ' + esc(fmtDate(n.published, { dateStyle: 'medium' })) : ''}</div>
      <h3><a href="${esc(httpUrl(n.link))}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a></h3>
      ${n.summary ? `<p>${esc(n.summary)}</p>` : ''}
      <a class="more" href="${esc(httpUrl(n.link))}" target="_blank" rel="noopener noreferrer">${esc(t('news_read', n.source))} ${I.external()}</a></article>`).join('') || `<p class="note">${t('no_results')}</p>`;
  };
  $('#wire').innerHTML = `<p class="note">${t('news_updated', fmtDate(d.generatedAt, { dateStyle: 'medium', timeStyle: 'short' }))}</p>
    <div class="chips" role="radiogroup" aria-label="${esc(t('news_service'))}">${['all', ...Object.keys(NEWS_SERVICES)].map(k => `<button data-ns="${k}" aria-pressed="${k === 'all'}">${esc(label(k))}</button>`).join('')}</div>
    <div class="wire" id="wireList"></div>`;
  paint('all');
  document.querySelectorAll('[data-ns]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-ns]').forEach(x => x.setAttribute('aria-pressed', x === b)); paint(b.dataset.ns); });
}
