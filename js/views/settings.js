// View: Welcome + Settings (incl. backup/restore)
import { I } from '../icons.js';
import { OTTS, COUNTRIES, ottName, getSettings, saveSettings, forgetApiKey, buildBackup, restoreBackup, clearUserData, requestPersistence } from '../store.js';
import { t, getLang, LANGS, countryName } from '../i18n.js';
import { $, $app, esc, toast, notice, applyTheme, hooks, pageHead } from '../ui.js';

// ---- Settings form (shared by welcome + settings) ----
// Unsaved form values survive a language switch in memory only (never written to storage).
let draft = null;
function formHtml(s) {
  if (draft) { s = { ...s, ...draft }; draft = null; }
  const lang = s.lang;
  return `<div class="form">
  <section class="fs key wide"><h2>${I.lock()} ${t('api_title')}</h2>
    <label class="fld"><span class="lbl">${t('api_label')}</span>
      <span class="keyrow"><input id="key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(s.apiKey)}" placeholder="${t('api_ph')}">
      <button type="button" class="btn" id="keyToggle">${t('key_show')}</button></span></label>
    <label class="chip"><input type="checkbox" id="remember"${s.rememberKey ? ' checked' : ''}><span>${t('key_remember')}</span></label>
    <p class="note">${t('key_remember_off')}</p>
    <p class="note">${t('api_note')} ${t('sec_note')}</p>
    <p class="note"><a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer">${t('get_key')} ${I.external()}</a></p></section>
  <section class="fs"><h2>${I.language()} ${t('lang_title')}</h2>
    <label class="fld"><span class="lbl">${t('lang_label')}</span>
      <select id="lang"><option value="auto"${lang === 'auto' ? ' selected' : ''}>${t('lang_auto')} (${LANGS[getLang()]})</option>
        ${Object.entries(LANGS).map(([k, v]) => `<option value="${k}"${k === lang ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    <p class="note">${t('lang_disclaimer')}</p></section>
  <section class="fs"><h2>${I.globe()} ${t('country_title')}</h2>
    <label class="fld"><span class="lbl">${t('country_label')}</span>
      <select id="country">${COUNTRIES.map(k =>
        `<option value="${k}"${k === s.country ? ' selected' : ''}>${esc(countryName(k))}</option>`).join('')}</select></label></section>
  <section class="fs wide"><h2>${I.tvbox()} ${t('ott_title')}</h2>
    <p class="note">${t('ott_note')}</p>
    <div class="chk">${OTTS.map(o => `<label class="chip"><input type="checkbox" class="ott" value="${o.key}"${s.myOtts.includes(o.key) ? ' checked' : ''}><span>${esc(ottName(o, getLang()))}</span></label>`).join('')}</div></section>
  <section class="fs"><h2>${I.palette()} ${t('theme_title')}</h2>
    <div class="seg" role="radiogroup" aria-label="${t('theme_title')}">${['auto', 'ivory', 'white', 'black'].map(k =>
      `<label><input type="radio" name="theme" value="${k}"${k === s.theme ? ' checked' : ''}><span>${t('theme_' + k)}</span></label>`).join('')}</div></section>
  <section class="fs"><h2>${I.type()} ${t('font_title')}</h2>
    <label class="fld"><span class="lbl">${t('font_label')}</span>
      <select id="font">${['paper', 'serif', 'sans', 'mono'].map(k => `<option value="${k}"${k === s.font ? ' selected' : ''}>${t('font_' + k)}</option>`).join('')}</select></label>
    <span class="lbl">${t('size_label')}</span>
    <div class="seg" role="radiogroup" aria-label="${t('size_label')}">${['s', 'm', 'l', 'xl'].map(k =>
      `<label><input type="radio" name="size" value="${k}"${k === s.size ? ' checked' : ''}><span>${t('size_' + k)}</span></label>`).join('')}</div>
    <p class="preview">${t('motto')}</p></section></div>`;
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
  $('#lang').onchange = () => { draft = readForm(); saveSettings({ lang: draft.lang }); hooks.applyLang(); hooks.route(); };
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
export function welcomeView() {
  const s = getSettings();
  $app.innerHTML = `<div class="welcome">
    ${pageHead({ kicker: t('w_kicker'), title: t('w_title'), deck: t('w_sub') })}
    <ol class="steps">
      <li><b>1</b><span>${t('w_s1')}</span></li>
      <li><b>2</b><span>${t('w_s2')}</span></li>
      <li><b>3</b><span>${t('w_s3')}</span></li></ol>
    ${formHtml(s)}
    <div class="start"><button class="btn primary" id="start">${I.check()} ${t('start')}</button>
    <p class="note center">${t('w_note')}</p></div>
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

// ---- Settings ----
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function settingsView() {
  const s = getSettings();
  $app.innerHTML = `<div class="set">${pageHead({ kicker: t('set_kicker'), title: t('settings'), deck: t('set_deck') })}
    ${formHtml(s)}
    <div class="saverow"><button class="btn primary" id="save">${I.check()} ${t('save')}</button><p class="note" id="autoNote" role="status">${t('set_auto')}</p></div>
    <div class="form">
    <section class="fs"><h2>${I.download()} ${t('backup_title')}</h2>
      <p class="note">${t('backup_note')}</p>
      <label class="chip"><input type="checkbox" id="inclKey"><span>${t('incl_key')}</span></label>
      <p class="note warn">${t('backup_warn')}</p>
      <p class="actions"><button class="btn" id="exp">${I.download()} ${t('backup_btn')}</button>
      <button class="btn" id="imp">${I.upload()} ${t('restore_btn')}</button>
      <input type="file" id="file" accept="application/json,.json" hidden></p></section>
    <section class="fs"><h2>${I.trash()} ${t('clear_title')}</h2>
      <p class="note">${t('clear_note')}</p>
      <p class="actions"><button class="btn danger" id="clr">${I.trash()} ${t('clear_btn')}</button>
      <button class="btn danger" id="forget">${I.key()} ${t('key_forget')}</button></p></section>
    <section class="fs wide"><h2>${I.info()} ${t('credits_title')}</h2>
      <ul class="credits"><li>${t('cr1')}</li><li>${t('cr2')}</li><li>${t('cr3')}</li><li>${t('cr4')}</li><li>${t('cr5')}</li><li>${t('cr6')}</li></ul></section></div></div>`;
  // Country and services are not secret: save them as soon as they change (the key still needs the Save button).
  const autosave = () => { const f = readForm(); saveSettings({ country: f.country, myOtts: f.myOtts }); hooks.applyLang(); $('#autoNote').textContent = t('saved') + ' ' + t('set_auto'); };
  $('#country').addEventListener('change', autosave);
  document.querySelectorAll('.ott').forEach(el => el.addEventListener('change', autosave));
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
      applyTheme(); hooks.applyLang(); toast(t('restored')); settingsView();
    } catch (err) {
      toast(err instanceof SyntaxError ? t('bad_json') : err.message === 'TOO_BIG' ? t('too_big') : t('not_backup'));
    }
  };
  $('#forget').onclick = () => { forgetApiKey(); $('#key').value = ''; toast(t('key_forgot')); };
  $('#clr').onclick = () => { if (confirm(t('clear_confirm'))) { clearUserData(); toast(t('cleared')); } };
}
