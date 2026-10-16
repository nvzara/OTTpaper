// Recent-search panel under the search box: a small "index" in the paper's style, built on this device's history only.
// Behaviour: opens on focus/typing, filters as you type, arrow keys + Enter, Esc closes, per-entry remove, clear all.
import { I } from './icons.js';
import { recentSearch } from './store.js';
import { t } from './i18n.js';
import { $, esc } from './ui.js';

let active = -1;            // index of the highlighted entry (-1 = none)
let shown = [];             // entries currently listed

const input = () => $('#q');
const panel = () => $('#sug');

// Entries matching what is typed (all recent searches when the box is empty or unchanged from a finished search).
function matches() {
  const typed = input().value.trim().toLowerCase();
  const all = recentSearch.list();
  return typed ? all.filter(x => x.toLowerCase().includes(typed) && x.toLowerCase() !== typed) : all;
}
const mark = (text, typed) => {
  const i = typed ? text.toLowerCase().indexOf(typed.toLowerCase()) : -1;
  return i < 0 ? esc(text) : `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + typed.length))}</mark>${esc(text.slice(i + typed.length))}`;
};

export function closeSuggest() {
  const p = panel(); if (!p) return;
  p.hidden = true; active = -1; input().setAttribute('aria-expanded', 'false'); input().removeAttribute('aria-activedescendant');
}
function go(q) { closeSuggest(); location.hash = '/search?q=' + encodeURIComponent(q); }

function highlight() {
  panel().querySelectorAll('[role=option]').forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
  if (active >= 0) input().setAttribute('aria-activedescendant', 'sug-' + active); else input().removeAttribute('aria-activedescendant');
}

export function openSuggest() {
  const p = panel(); if (!p) return;
  shown = matches();
  if (!shown.length) { closeSuggest(); return; }
  const typed = input().value.trim();
  active = -1;
  p.innerHTML = `<div class="sug-head"><span>${esc(t('recent_searches'))}</span><button type="button" class="sug-clear">${esc(t('sug_clear'))}</button></div>
    <ul>${shown.map((x, i) => `<li id="sug-${i}" role="option" aria-selected="false" data-i="${i}"><span class="sug-n" aria-hidden="true">${i + 1}</span><span class="sug-t">${mark(x, typed)}</span>
      <button type="button" class="sug-x" data-i="${i}" aria-label="${esc(t('sug_remove', x))}" title="${esc(t('sug_remove', x))}">${I.close()}</button></li>`).join('')}</ul>`;
  p.hidden = false; input().setAttribute('aria-expanded', 'true');
}

// Re-render after history changes or a language switch (only if currently open).
export function refreshSuggest() { const p = panel(); if (p && !p.hidden) openSuggest(); }

export function initSuggest() {
  const q = input(), form = $('#searchForm');
  if (!q || !form || panel()) return;
  form.insertAdjacentHTML('beforeend', '<div id="sug" class="sug" role="listbox" hidden></div>');
  q.setAttribute('role', 'combobox'); q.setAttribute('aria-expanded', 'false'); q.setAttribute('aria-controls', 'sug'); q.setAttribute('aria-autocomplete', 'list');
  q.addEventListener('focus', openSuggest);
  q.addEventListener('click', () => { if (panel().hidden) openSuggest(); });
  q.addEventListener('input', openSuggest);
  q.addEventListener('keydown', e => {
    const open = !panel().hidden;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!open) { openSuggest(); if (panel().hidden) return; }
      e.preventDefault();
      active = e.key === 'ArrowDown' ? (active + 1) % shown.length : (active - 1 + shown.length) % shown.length;
      highlight();
    } else if (e.key === 'Enter' && open && active >= 0) { e.preventDefault(); go(shown[active]); }
    else if (e.key === 'Escape' && open) { e.preventDefault(); closeSuggest(); }
  });
  const p = panel();
  p.addEventListener('mousedown', e => e.preventDefault());           // keep focus in the input while clicking inside the panel
  p.addEventListener('click', e => {
    const x = e.target.closest('.sug-x'), clear = e.target.closest('.sug-clear'), li = e.target.closest('[role=option]');
    if (x) { const v = shown[+x.dataset.i]; recentSearch.remove(item => item === v); openSuggest(); }
    else if (clear) { recentSearch.clear(); closeSuggest(); }
    else if (li) go(shown[+li.dataset.i]);
  });
  document.addEventListener('mousedown', e => { if (!form.contains(e.target)) closeSuggest(); });
  q.addEventListener('blur', () => setTimeout(() => { if (!form.contains(document.activeElement)) closeSuggest(); }, 0));
}
