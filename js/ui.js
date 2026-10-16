// Shared UI helpers: DOM shortcuts, HTML escaping, toast, cards/grid, error view.
import { IMG } from './tmdb.js';
import { I } from './icons.js';
import { getSettings } from './store.js';
import { t, getLang } from './i18n.js';

export const $app = document.getElementById('app');
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const typeLabel = x => t(x === 'movie' ? 'type_movie' : 'type_tv');
export const $ = (sel, root = document) => root.querySelector(sel);
// Late-bound callbacks set by app.js (lets views re-render the page chrome without importing app.js).
export const hooks = { applyLang() {}, route() {} };

// Theme / font / size are plain data-attributes on <html>; styles live in css/style.css.
export function applyTheme() {
  const { theme, font, size } = getSettings();
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = theme;
  if (font === 'paper') root.removeAttribute('data-font'); else root.dataset.font = font;
  if (size === 'm') root.removeAttribute('data-size'); else root.dataset.size = size;
}

let toastTimer;
export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

export const notice = () => `<aside class="notice" aria-label="About and credits">
  <div class="notice-h">${I.heart()}<strong>${t('notice_h')}</strong></div>
  <p>${t('notice_p1')}</p><p>${t('notice_p2')}</p></aside>`;

// ---- Cards ----
const SAFE_IMG = /^\/[\w.-]{1,80}$/;
export const poster = (p, size = 'w342') => SAFE_IMG.test(p || '') ? `<img loading="lazy" src="${IMG}${size}${esc(p)}" alt="">` : `<div class="noimg">${I.film()}</div>`;
export function card(it) {
  const type = it.media_type || it._type;
  if (type !== 'movie' && type !== 'tv') return '';
  const title = it.title || it.name || '';
  const date = (it.release_date || it.first_air_date || '').slice(0, 4);
  const score = it.vote_average ? `<span class="score">${I.star()}${it.vote_average.toFixed(1)}</span>` : '';
  return `<a class="card" data-k="${type}:${Number(it.id)}" href="#/title/${type}/${Number(it.id)}"><div class="p">${poster(it.poster_path)}${score}</div>
    <div class="t">${esc(title)}</div><div class="s">${typeLabel(type)}${date ? ' · ' + esc(date) : ''}</div></a>`;
}
export const grid = (items, type) => {
  const h = items.map(i => card(type ? { ...i, _type: type } : i)).join('');
  return h ? `<div class="grid">${h}</div>` : `<p class="note">${t('no_results')}</p>`;
};

export function errView(e) {
  if (e.message === 'NO_KEY' || e.message === 'BAD_KEY') {
    const m = t(e.message === 'NO_KEY' ? 'err_nokey' : 'err_badkey');
    return `<div class="err">${I.info()} ${m} ${t('err_open')} <a href="#/settings">${t('settings')}</a>${t('err_open2')}</div>`;
  }
  if (e.message === 'HTTP_429') return `<div class="err">${I.info()} ${t('err_rate')}</div>`;
  if (!navigator.onLine || e.name === 'TypeError') return `<div class="err">${I.info()} ${t('err_offline')}</div>`;   // fetch() rejects with TypeError when the network is unreachable
  return `<div class="err">${I.info()} ${esc(t('err_load', e.message))}</div>`;
}

export const httpUrl = u => { try { return /^https?:$/.test(new URL(u).protocol) ? u : '#'; } catch { return '#'; } };
export const fmtDate = (iso, opts) => { try { return new Intl.DateTimeFormat(getLang(), opts).format(new Date(iso)); } catch { return ''; } };
