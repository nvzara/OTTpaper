// View: Clippings (a scrapbook of saved titles) + subscription advisor
import * as T from '../tmdb.js';
import { I } from '../icons.js';
import { OTTS, ottName, getSettings, clippings } from '../store.js';
import { computeCoverage } from '../advisor.js';
import { t, getLang, countryName } from '../i18n.js';
import { $, $app, esc, grid, errView, pageHead, empty, viewGuard } from '../ui.js';

export function clippingsView() {
  const l = clippings.list();
  $app.innerHTML = pageHead({ kicker: t('clips_kicker'), title: t('clips_title'), deck: t('clips_sub'), extra: l.length ? `<p class="byline">${esc(t('clips_count', l.length))}</p>` : '' }) +
    (l.length ? `<p class="actions"><button class="btn primary" id="adv">${I.sparkle()} ${t('adv_btn')}</button><button class="btn" id="print">${I.download()} ${t('print_btn')}</button><a class="btn" href="#/?taste">${I.scissors()} ${t('taste_more')}</a></p>
      <p class="print-only">${esc(t('print_title', l.length))}</p><div id="advOut" aria-live="polite"></div><div class="clips">${grid(l)}</div>`
      : empty(t('clips_empty')) + `<p class="actions"><a class="btn primary" href="#/?taste">${I.scissors()} ${t('taste_more')}</a></p>`);
  if (l.length) { $('#adv').onclick = () => advise(l); $('#print').onclick = () => window.print(); }
}
async function advise(clips) {
  const s = getSettings(), out = $('#advOut'), alive = viewGuard(), list = clips.slice(0, 60); // cap requests; provider data is cached 3 days
  const pv = new Map();
  let done = 0, next = 0;
  out.innerHTML = `<p class="note" role="status">${esc(t('adv_running', 0, list.length))}</p>`;
  const worker = async () => {
    while (next < list.length) {
      const c = list[next++];
      try { pv.set(`${c.media_type}:${c.id}`, (await T.providers(c.media_type, c.id)).results?.[s.country] || null); }
      catch (e) { if (e.message === 'NO_KEY' || e.message === 'BAD_KEY') throw e; pv.set(`${c.media_type}:${c.id}`, null); }
      if (!alive()) return;
      out.innerHTML = `<p class="note" role="status">${esc(t('adv_running', ++done, list.length))}</p>`;
    }
  };
  try { await Promise.all([worker(), worker(), worker(), worker()]); } catch (e) { if (alive()) out.innerHTML = errView(e); return; }
  if (!alive()) return;
  const r = computeCoverage(list, pv, new Set(s.myOtts));
  const names = Object.fromEntries(OTTS.map(o => [o.key, ottName(o, getLang())]));
  const link = c => `<a href="#/title/${c.media_type}/${Number(c.id)}">${esc(c.title)}</a>`;
  // A printed chart: ranked services, one bar each, figures in tabular numerals.
  out.innerHTML = `<section class="advisor"><p class="kicker">${esc(countryName(s.country))}</p><h2>${t('adv_title')}</h2>
    <p class="big">${esc(t('adv_summary', r.covered, r.withData, r.total - r.withData))}</p>
    <p>${esc(r.best ? t('adv_best', r.best.name, r.best.gain) : t('adv_nobest'))}</p>
    <h3>${t('adv_ranking')}</h3>
    <ol class="rank">${r.ranking.slice(0, 12).map(x => `<li${x.mine ? ' class="mine"' : ''}>
      <span class="rname">${esc(x.key ? names[x.key] : x.name)}${x.mine ? ` <em>(${t('adv_mine')})</em>` : ''}</span>
      <progress value="${x.count}" max="${r.withData || 1}" aria-label="${esc(t('adv_count', x.count, r.withData))}"></progress><span class="rcount">${t('adv_count', x.count, r.withData)}</span>
      <details><summary>${esc(t('clips_count', x.titles.length))}</summary><div class="rtitles">${x.titles.map(link).join(', ')}</div></details></li>`).join('')}</ol>
    ${r.noSub.length ? `<h3>${t('adv_nosub')}</h3><p class="note">${r.noSub.map(link).join(', ')}</p>` : ''}
    <p class="note">${esc(t('adv_note', countryName(s.country)))}</p></section>`;
}
