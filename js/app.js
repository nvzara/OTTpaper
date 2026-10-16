import * as T from './tmdb.js';
import { IMG } from './tmdb.js';
import { I } from './icons.js';
import {
  OTTS, COUNTRIES, ottKey, ottName, getSettings, saveSettings, recentSearch, recentViews,
  clippings, forgetApiKey, buildBackup, restoreBackup, clearUserData, requestPersistence,
} from './store.js';
import { computeCoverage, onMyServices, worldwideRows, pickLead } from './advisor.js';
import { t, getLang, LANGS, countryName } from './i18n.js';

const $app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const typeLabel = x => t(x === 'movie' ? 'type_movie' : 'type_tv');
const KINDS = ['flatrate', 'free', 'ads', 'rent', 'buy'];
const $ = (sel, root = document) => root.querySelector(sel);

// Theme / font / size are plain data-attributes on <html>; styles live in css/style.css.
function applyTheme() {
  const { theme, font, size } = getSettings();
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = theme;
  if (font === 'paper') root.removeAttribute('data-font'); else root.dataset.font = font;
  if (size === 'm') root.removeAttribute('data-size'); else root.dataset.size = size;
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

const notice = () => `<aside class="notice" aria-label="About and credits">
  <div class="notice-h">${I.heart()}<strong>${t('notice_h')}</strong></div>
  <p>${t('notice_p1')}</p><p>${t('notice_p2')}</p></aside>`;

// ---- Cards ----
const SAFE_IMG = /^\/[\w.-]{1,80}$/;
const poster = (p, size = 'w342') => SAFE_IMG.test(p || '') ? `<img loading="lazy" src="${IMG}${size}${esc(p)}" alt="">` : `<div class="noimg">${I.film()}</div>`;
function card(it) {
  const type = it.media_type || it._type;
  if (type !== 'movie' && type !== 'tv') return '';
  const title = it.title || it.name || '';
  const date = (it.release_date || it.first_air_date || '').slice(0, 4);
  const score = it.vote_average ? `<span class="score">${I.star()}${it.vote_average.toFixed(1)}</span>` : '';
  return `<a class="card" data-k="${type}:${Number(it.id)}" href="#/title/${type}/${Number(it.id)}"><div class="p">${poster(it.poster_path)}${score}</div>
    <div class="t">${esc(title)}</div><div class="s">${typeLabel(type)}${date ? ' · ' + esc(date) : ''}</div></a>`;
}
const grid = (items, type) => {
  const h = items.map(i => card(type ? { ...i, _type: type } : i)).join('');
  return h ? `<div class="grid">${h}</div>` : `<p class="note">${t('no_results')}</p>`;
};

function errView(e) {
  if (e.message === 'NO_KEY' || e.message === 'BAD_KEY') {
    const m = t(e.message === 'NO_KEY' ? 'err_nokey' : 'err_badkey');
    return `<div class="err">${I.info()} ${m} ${t('err_open')} <a href="#/settings">${t('settings')}</a>${t('err_open2')}</div>`;
  }
  return `<div class="err">${I.info()} ${esc(t('err_load', e.message))}</div>`;
}

// ---- Settings form (shared by welcome + settings) ----
// Unsaved form values survive a language switch in memory only (never written to storage).
let draft = null;
function formHtml(s) {
  if (draft) { s = { ...s, ...draft }; draft = null; }
  const lang = s.lang;
  return `
  <section class="panel"><h2>${I.language()} ${t('lang_title')}</h2>
    <label class="fld"><span>${t('lang_label')}</span>
      <select id="lang"><option value="auto"${lang === 'auto' ? ' selected' : ''}>${t('lang_auto')} (${LANGS[getLang()]})</option>
        ${Object.entries(LANGS).map(([k, v]) => `<option value="${k}"${k === lang ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    <p class="note">${t('lang_disclaimer')}</p></section>
  <section class="panel"><h2>${I.key()} ${t('api_title')}</h2>
    <label class="fld"><span>${t('api_label')}</span>
      <span class="keyrow"><input id="key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(s.apiKey)}" placeholder="${t('api_ph')}">
      <button type="button" class="btn" id="keyToggle">${t('key_show')}</button></span></label>
    <label class="chip inline"><input type="checkbox" id="remember"${s.rememberKey ? ' checked' : ''}><span>${t('key_remember')}</span></label>
    <p class="note">${t('api_note')} ${t('sec_note')}</p>
    <p class="note"><a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer">${t('get_key')} ${I.external()}</a></p></section>
  <section class="panel"><h2>${I.globe()} ${t('country_title')}</h2>
    <label class="fld"><span>${t('country_label')}</span>
      <select id="country">${COUNTRIES.map(k =>
        `<option value="${k}"${k === s.country ? ' selected' : ''}>${esc(countryName(k))}</option>`).join('')}</select></label></section>
  <section class="panel"><h2>${I.tvbox()} ${t('ott_title')}</h2>
    <p class="note">${t('ott_note')}</p>
    <div class="chk">${OTTS.map(o => `<label class="chip"><input type="checkbox" class="ott" value="${o.key}"${s.myOtts.includes(o.key) ? ' checked' : ''}><span>${esc(ottName(o, getLang()))}</span></label>`).join('')}</div></section>
  <section class="panel"><h2>${I.palette()} ${t('theme_title')}</h2>
    <div class="seg" role="radiogroup" aria-label="${t('theme_title')}">${['auto', 'ivory', 'white', 'black'].map(k =>
      `<label><input type="radio" name="theme" value="${k}"${k === s.theme ? ' checked' : ''}><span>${t('theme_' + k)}</span></label>`).join('')}</div></section>
  <section class="panel"><h2>${I.type()} ${t('font_title')}</h2>
    <label class="fld"><span>${t('font_label')}</span>
      <select id="font">${['paper', 'serif', 'sans', 'mono'].map(k => `<option value="${k}"${k === s.font ? ' selected' : ''}>${t('font_' + k)}</option>`).join('')}</select></label>
    <div class="seg" role="radiogroup" aria-label="${t('size_label')}">${['s', 'm', 'l', 'xl'].map(k =>
      `<label><input type="radio" name="size" value="${k}"${k === s.size ? ' checked' : ''}><span>${t('size_' + k)}</span></label>`).join('')}</div>
    <p class="note preview">${t('motto')}</p></section>`;
}
function readForm() {
  return {
    apiKey: $('#key').value.trim(), rememberKey: $('#remember').checked, country: $('#country').value, lang: $('#lang').value,
    theme: ($('input[name=theme]:checked') || {}).value || 'auto', font: $('#font').value,
    size: ($('input[name=size]:checked') || {}).value || 'm',
    myOtts: [...document.querySelectorAll('.ott:checked')].map(x => x.value),
  };
}
// Changing the language re-renders the page in the new language; keep whatever was typed so far.
function bindLang() {
  $('#lang').onchange = () => { draft = readForm(); saveSettings({ lang: draft.lang }); applyLang(); route(); };
}
// Live preview of theme / font / size while choosing (saved immediately; the key is only saved with the Save button).
const previewTheme = () => {
  document.querySelectorAll('input[name=theme],input[name=size],#font').forEach(el => el.addEventListener('change', () => {
    const f = readForm(); saveSettings({ theme: f.theme, font: f.font, size: f.size }); applyTheme();
  }));
  $('#keyToggle').onclick = () => {
    const k = $('#key'), show = k.type === 'password';
    k.type = show ? 'text' : 'password'; $('#keyToggle').textContent = t(show ? 'key_hide' : 'key_show');
  };
};

// ---- Welcome (first visit) ----
function welcomeView() {
  const s = getSettings();
  $app.innerHTML = `<div class="welcome">
    <div class="hero">${I.logo('big')}<h1>${t('w_title')}</h1><p>${t('w_sub')}</p></div>
    <ol class="steps">
      <li><b>1</b><span>${t('w_s1')}</span></li>
      <li><b>2</b><span>${t('w_s2')}</span></li>
      <li><b>3</b><span>${t('w_s3')}</span></li></ol>
    ${formHtml(s)}
    <p class="actions"><button class="btn primary" id="start">${I.check()} ${t('start')}</button></p>
    <p class="note center">${t('w_note')}</p>
    ${notice()}</div>`;
  previewTheme(); bindLang();
  $('#start').onclick = () => {
    const f = readForm();
    if (!f.apiKey) { toast(t('need_key')); $('#key').focus(); return; }
    saveSettings({ ...f, onboarded: true });
    requestPersistence();
    location.hash = '/';
  };
}

// ---- Home ----
let homeTab = 'trending';
async function home() {
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

// ---- Search ----
async function searchView(q) {
  q = (q || '').trim();
  $('#q').value = q;
  if (!q) {
    const rs = recentSearch.list();
    $app.innerHTML = `<h2 class="sec">${I.clock()} ${t('recent_searches')}</h2>` + (rs.length
      ? `<div class="chips">${rs.map(s => `<a class="btn" href="#/search?q=${encodeURIComponent(s)}">${esc(s)}</a>`).join('')}</div>`
      : `<p class="note">${t('no_history')}</p>`);
    return;
  }
  recentSearch.add(q, (a, b) => a === b);
  $app.innerHTML = `<h2 class="sec">${I.search()} ${esc(t('search_results', q))}</h2><div id="list"><p class="note">${t('searching')}</p></div>`;
  try {
    const d = await T.search(q);
    const r = d.results.filter(x => x.media_type === 'movie' || x.media_type === 'tv');
    const by = ty => r.filter(x => x.media_type === ty);
    const mine = new Set(getSettings().myOtts);
    $('#list').innerHTML = (mine.size ? `<div class="chips"><button id="onlyMine" aria-pressed="false">${I.check()} ${t('filter_mine')}</button></div><p class="note" id="availNote">${t('avail_checking')}</p>` : '') +
      `<div id="results"><h2 class="sec">${I.film()} ${t('movies')}</h2>${grid(by('movie'))}<h2 class="sec">${I.tv()} ${t('tv')}</h2>${grid(by('tv'))}</div>`;
    if (mine.size) markAvailability(r.slice(0, 24), mine);
  } catch (e) { $('#list').innerHTML = errView(e); }
}

// Badge search results that are on one of MY services (runs in the background; provider data is cached 3 days).
async function markAvailability(items, mine) {
  const country = getSettings().country;
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const it = items[next++];
      try {
        const pv = await T.providers(it.media_type, it.id);
        if (!onMyServices(pv.results?.[country], mine).length) continue;
        const el = $(`.card[data-k="${it.media_type}:${Number(it.id)}"]`);
        if (el) { el.classList.add('on-mine'); el.querySelector('.p')?.insertAdjacentHTML('beforeend', `<span class="avail">${I.check()} ${t('badge_mine')}</span>`); }
      } catch (e) { if (e.message === 'NO_KEY' || e.message === 'BAD_KEY') return; }
    }
  };
  const btn = $('#onlyMine');
  if (btn) btn.onclick = () => { const on = btn.getAttribute('aria-pressed') !== 'true'; btn.setAttribute('aria-pressed', on); $('#results')?.classList.toggle('only-mine', on); };
  await Promise.all([worker(), worker(), worker(), worker()]);
  $('#availNote')?.remove();
}

// ---- Detail ----
let kindFilter = 'all';
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
async function detailView(type, id) {
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
    const clip = { id: d.id, media_type: type, title, poster_path: d.poster_path, release_date: d.release_date, first_air_date: d.first_air_date };
    $app.innerHTML = `<div class="detail"><div class="p">${poster(d.poster_path, 'w500')}</div><div>
      <h1>${esc(title)}</h1>
      <p class="actions"><button class="btn" id="clip"></button></p>
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
      </div></div>`;
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

// ---- Clippings (+ subscription advisor) ----
function clippingsView() {
  const l = clippings.list();
  $app.innerHTML = `<h1 class="page-h">${I.bookmark()} ${t('clips_title')}</h1><p class="note">${t('clips_sub')}</p>` +
    (l.length ? `<p class="actions"><button class="btn primary" id="adv">${I.sparkle()} ${t('adv_btn')}</button></p><div id="advOut" aria-live="polite"></div>${grid(l)}`
      : `<div class="err">${I.info()} ${t('clips_empty')}</div>`);
  if (l.length) $('#adv').onclick = () => advise(l);
}
async function advise(clips) {
  const s = getSettings(), out = $('#advOut'), list = clips.slice(0, 60); // cap requests; provider data is cached 3 days
  const pv = new Map();
  let done = 0, next = 0;
  out.innerHTML = `<p class="note">${esc(t('adv_running', 0, list.length))}</p>`;
  const worker = async () => {
    while (next < list.length) {
      const c = list[next++];
      try { pv.set(`${c.media_type}:${c.id}`, (await T.providers(c.media_type, c.id)).results?.[s.country] || null); }
      catch (e) { if (e.message === 'NO_KEY' || e.message === 'BAD_KEY') throw e; pv.set(`${c.media_type}:${c.id}`, null); }
      out.innerHTML = `<p class="note">${esc(t('adv_running', ++done, list.length))}</p>`;
    }
  };
  try { await Promise.all([worker(), worker(), worker(), worker()]); } catch (e) { out.innerHTML = errView(e); return; }
  const r = computeCoverage(list, pv, new Set(s.myOtts));
  const names = Object.fromEntries(OTTS.map(o => [o.key, ottName(o, getLang())]));
  out.innerHTML = `<section class="panel advisor"><h2>${I.sparkle()} ${t('adv_title')}</h2>
    <p><strong>${esc(t('adv_summary', r.covered, r.withData, r.total - r.withData))}</strong></p>
    <p>${esc(r.best ? t('adv_best', r.best.name, r.best.gain) : t('adv_nobest'))}</p>
    <h3>${t('adv_ranking')}</h3>
    <ol class="rank">${r.ranking.slice(0, 12).map(x => `<li${x.mine ? ' class="mine"' : ''}>
      <span class="rname">${esc(x.key ? names[x.key] : x.name)}${x.mine ? ` <em>(${t('adv_mine')})</em>` : ''}</span>
      <progress value="${x.count}" max="${r.withData || 1}"></progress><span class="rcount">${t('adv_count', x.count, r.withData)}</span>
      <details><summary>${x.titles.length}</summary><div class="rtitles">${x.titles.map(c => `<a href="#/title/${c.media_type}/${Number(c.id)}">${esc(c.title)}</a>`).join(', ')}</div></details></li>`).join('')}</ol>
    ${r.noSub.length ? `<h3>${t('adv_nosub')}</h3><p class="note">${r.noSub.map(c => `<a href="#/title/${c.media_type}/${Number(c.id)}">${esc(c.title)}</a>`).join(', ')}</p>` : ''}
    <p class="note">${esc(t('adv_note', countryName(s.country)))}</p></section>`;
}

// ---- News wire (news.json is generated at deploy time by scripts/fetch-news.mjs) ----
const httpUrl = u => { try { return /^https?:$/.test(new URL(u).protocol) ? u : '#'; } catch { return '#'; } };
const fmtDate = (iso, opts) => { try { return new Intl.DateTimeFormat(getLang(), opts).format(new Date(iso)); } catch { return ''; } };
async function newsView() {
  $app.innerHTML = `<h1 class="page-h">${I.news()} ${t('news_title')}</h1><p class="note">${t('news_sub')}</p><div id="wire"><p class="note">${t('loading')}</p></div>
    <p class="note">${t('news_lang')} ${t('news_attrib')}</p>`;
  let d = null;
  try { const r = await fetch('news/news.json', { cache: 'no-cache' }); if (r.ok) d = await r.json(); } catch {}
  const items = Array.isArray(d?.items) ? d.items.slice(0, 60) : [];
  $('#wire').innerHTML = !items.length ? `<div class="err">${I.info()} ${t('news_empty')}</div>` :
    `<p class="note">${t('news_updated', fmtDate(d.generatedAt, { dateStyle: 'medium', timeStyle: 'short' }))}</p>
    <div class="wire">${items.map((n, i) => `<article class="story${i === 0 ? ' lead' : ''}">
      <div class="kicker">${esc(n.source)}${n.published ? ' · ' + esc(fmtDate(n.published, { dateStyle: 'medium' })) : ''}</div>
      <h3><a href="${esc(httpUrl(n.link))}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a></h3>
      ${n.summary ? `<p>${esc(n.summary)}</p>` : ''}
      <a class="more" href="${esc(httpUrl(n.link))}" target="_blank" rel="noopener noreferrer">${esc(t('news_read', n.source))} ${I.external()}</a></article>`).join('')}</div>`;
}

// ---- Settings ----
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function settingsView() {
  const s = getSettings();
  $app.innerHTML = `<div class="set"><h1>${I.settings()} ${t('settings')}</h1>
    ${formHtml(s)}
    <p class="actions"><button class="btn primary" id="save">${I.check()} ${t('save')}</button></p>
    <section class="panel"><h2>${I.download()} ${t('backup_title')}</h2>
      <p class="note">${t('backup_note')}</p>
      <label class="chip inline"><input type="checkbox" id="inclKey"><span>${t('incl_key')}</span></label>
      <p class="note warn">${t('backup_warn')}</p>
      <p class="actions"><button class="btn" id="exp">${I.download()} ${t('backup_btn')}</button>
      <button class="btn" id="imp">${I.upload()} ${t('restore_btn')}</button>
      <input type="file" id="file" accept="application/json,.json" hidden></p></section>
    <section class="panel"><h2>${I.trash()} ${t('clear_title')}</h2>
      <p class="note">${t('clear_note')}</p>
      <p class="actions"><button class="btn danger" id="clr">${I.trash()} ${t('clear_btn')}</button>
      <button class="btn danger" id="forget">${I.key()} ${t('key_forget')}</button></p></section>
    <section class="panel"><h2>${I.info()} ${t('credits_title')}</h2>
      <ul class="credits"><li>${t('cr1')}</li><li>${t('cr2')}</li><li>${t('cr3')}</li><li>${t('cr4')}</li><li>${t('cr5')}</li><li>${t('cr6')}</li></ul></section></div>`;
  previewTheme(); bindLang();
  $('#save').onclick = () => {
    const f = readForm();
    if (!f.apiKey) { toast(t('need_key')); return; }
    saveSettings({ ...f, onboarded: true });
    applyTheme(); requestPersistence(); toast(t('saved'));
  };
  $('#exp').onclick = () => {
    const b = buildBackup({ includeKey: $('#inclKey').checked });
    download(`ottpaper-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b, null, 2));
    toast(t('backed_up'));
  };
  $('#imp').onclick = () => $('#file').click();
  $('#file').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      if (f.size > 1e6) throw new Error('TOO_BIG');
      restoreBackup(JSON.parse(await f.text()));
      applyTheme(); applyLang(); toast(t('restored')); settingsView();
    } catch (err) {
      toast(err instanceof SyntaxError ? t('bad_json') : err.message === 'TOO_BIG' ? t('too_big') : t('not_backup'));
    }
  };
  $('#forget').onclick = () => { forgetApiKey(); $('#key').value = ''; toast(t('key_forgot')); };
  $('#clr').onclick = () => { if (confirm(t('clear_confirm'))) { clearUserData(); toast(t('cleared')); } };
}

// ---- Static page chrome (header, footer, title) in the current language ----
function applyLang() {
  document.documentElement.lang = getLang();
  document.title = t('page_title');
  $('#q').placeholder = t('search_ph');
  $('#navHome').innerHTML = I.home() + `<span>${t('nav_home')}</span>`;
  $('#navClips').innerHTML = I.bookmark() + `<span>${t('nav_clips')}</span>`;
  $('#navNews').innerHTML = I.news() + `<span>${t('nav_news')}</span>`;
  $('#navSet').innerHTML = I.settings() + `<span>${t('nav_settings')}</span>`;
  $('#dateline').textContent = fmtDate(Date.now(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  $('#edition').textContent = t('edition');
  $('#motto').textContent = t('motto');
  $('#f1').innerHTML = t('f1'); $('#f2').textContent = t('f2'); $('#f3').textContent = t('f3');
}

// ---- Router ----
function route() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  window.scrollTo(0, 0);
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#/' + (parts[0] || '')));
  const first = !getSettings().onboarded;
  if (parts[0] === 'settings') settingsView();
  else if (parts[0] === 'welcome' || first) welcomeView();
  else if (parts[0] === 'search') searchView(new URLSearchParams(qs).get('q'));
  else if (parts[0] === 'news') newsView();
  else if (parts[0] === 'clippings') clippingsView();
  else if (parts[0] === 'title') detailView(parts[1], parts[2]);
  else home();
}
$('#searchForm').onsubmit = e => {
  e.preventDefault();
  const q = $('#q').value.trim();
  location.hash = '/search' + (q ? '?q=' + encodeURIComponent(q) : '');
};
$('#searchForm').insertAdjacentHTML('afterbegin', `<span class="si">${I.search()}</span>`);
applyTheme();
applyLang();
// "/" focuses the search box (like many newspaper-style sites and dev tools)
addEventListener('keydown', e => {
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) { e.preventDefault(); $('#q').focus(); }
});
addEventListener('hashchange', route);
route();
