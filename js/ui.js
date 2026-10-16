// Shared UI helpers: DOM, escaping, toast, newspaper building blocks (cards, heads, notes, loading), error view.
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

// ---- Type helpers ----
// Script class for headlines: Korean keeps words whole, Japanese uses strict line breaking.
export const scriptCls = s => /[가-힯]/.test(s) ? ' ko' : /[぀-ヿ㐀-鿿]/.test(s) ? ' ja' : '';
// Shorten text at a word boundary.
export const clip = (s, n) => { s = String(s || ''); if (s.length <= n) return s; const c = s.slice(0, n); return c.slice(0, Math.max(c.lastIndexOf(' '), n * .8 | 0)).replace(/[\s,.;:–—-]+$/, '') + '…'; };
// Review-style stars (TMDB score out of 10 → up to five stars, in halves) plus the number.
export function stars(v) {
  if (!v) return '';
  const h = Math.round(v) / 2;
  return `<span class="stars" role="img" aria-label="${esc(t('score_of', v.toFixed(1)))}">${'★'.repeat(Math.floor(h))}${h % 1 ? '½' : ''}<span class="sv">${v.toFixed(1)}</span></span>`;
}
// Lede paragraph: drop cap only for Latin text, end mark (■) closes the story.
export const lede = text => `<p class="lede end${/^["“‘(]?[A-Za-z]/.test(text) ? ' dc' : ''}">${esc(text)}</p>`;

// ---- Page furniture ----
export const sec = (title, n) => `<h2 class="sec"><span>${title}</span>${n != null ? `<span class="n">${n}</span>` : ''}</h2>`;
export const pageHead = ({ kicker, title, deck, extra = '' }) =>
  `<header class="sect-head">${kicker ? `<p class="kicker">${kicker}</p>` : ''}<h1>${title}</h1>${deck ? `<p class="deck">${deck}</p>` : ''}${extra}</header>`;
// Empty states read as an editor's note, not an error.
export const empty = (msg, label = t('note_h')) => `<div class="empty"><p class="kicker">${label}</p><p>${msg}</p></div>`;
// Loading: quiet grey type blocks (screen readers hear the loading text).
const skCard = '<div><div class="sk-p"></div><div class="sk-l s"></div><div class="sk-l"></div></div>';
export const skGrid = (n = 12, msg = t('loading')) => `<p class="vh" role="status">${esc(msg)}</p><div class="grid sk" aria-hidden="true">${skCard.repeat(n)}</div>`;
export const skStory = () => `<p class="vh" role="status">${esc(t('loading'))}</p><div class="sk" aria-hidden="true"><div class="sk-l k"></div><div class="sk-l h"></div><div class="sk-l h s"></div><div class="sk-l"></div><div class="sk-l"></div><div class="sk-l s"></div></div>`;

// Publisher's note (free / non-commercial / private + credits). Collapsible; the summary line always stays visible.
export const notice = (open = true) => `<details class="notice"${open ? ' open' : ''} aria-label="About and credits">
  <summary><span class="kicker">${t('notice_k')}</span><strong>${t('notice_h')}</strong></summary>
  <p>${t('notice_p1')}</p><p>${t('notice_p2')}</p></details>`;

// ---- Cards ----
const SAFE_IMG = /^\/[\w.-]{1,80}$/;
export const poster = (p, size = 'w342') => SAFE_IMG.test(p || '') ? `<img loading="lazy" src="${IMG}${size}${esc(p)}" alt="">` : '<div class="noimg" aria-hidden="true"></div>';
export const yearOfItem = it => (it.release_date || it.first_air_date || '').slice(0, 4);
export function card(it) {
  const type = it.media_type || it._type;
  if (type !== 'movie' && type !== 'tv') return '';
  const title = it.title || it.name || '';
  const date = yearOfItem(it);
  return `<a class="card" data-k="${type}:${Number(it.id)}" href="#/title/${type}/${Number(it.id)}"><div class="p">${poster(it.poster_path)}</div>
    <span class="k">${typeLabel(type)}${date ? ' · ' + esc(date) : ''}</span><span class="t${scriptCls(title)}">${esc(title)}</span>${stars(it.vote_average)}${it._why ? `<span class="why">${esc(it._why)}</span>` : ''}</a>`;
}
export const grid = (items, type, cls = '') => {
  const h = items.map(i => card(type ? { ...i, _type: type } : i)).join('');
  return h ? `<div class="grid${cls ? ' ' + cls : ''}">${h}</div>` : `<p class="note">${t('no_results')}</p>`;
};

export function errView(e) {
  if (e.message === 'NO_KEY' || e.message === 'BAD_KEY') {
    const m = t(e.message === 'NO_KEY' ? 'err_nokey' : 'err_badkey');
    return `<div class="err">${I.info()}<span>${m} ${t('err_open')} <a href="#/settings">${t('settings')}</a>${t('err_open2')}</span></div>`;
  }
  if (e.message === 'HTTP_429') return `<div class="err">${I.info()}<span>${t('err_rate')}</span></div>`;
  if (!navigator.onLine || e.name === 'TypeError') return `<div class="err">${I.info()}<span>${t('err_offline')}</span></div>`;   // fetch() rejects with TypeError when the network is unreachable
  return `<div class="err">${I.info()}<span>${esc(t('err_load', e.message))}</span></div>`;
}

export const httpUrl = u => { try { return /^https?:$/.test(new URL(u).protocol) ? u : '#'; } catch { return '#'; } };
export const fmtDate = (iso, opts) => { try { return new Intl.DateTimeFormat(getLang(), opts).format(new Date(iso)); } catch { return ''; } };
export const fmtNum = n => { try { return new Intl.NumberFormat(getLang()).format(n); } catch { return String(n); } };
