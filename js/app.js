import {
  translator, isRtl, money, groupDigits, longDate, monthLabel, receiptNumber, todayIso, symbolOf, LANGUAGES, CURRENCIES,
} from './i18n.js';
import {
  state, loadAll, isSetUp, saveSettings, newId, getReceipt, saveReceipt, deleteReceipt,
  signed, drafts, totalPaid, paidTo, people, sameName, exportBackup, importBackup,
  projects, getProject, activeProject, addProject, renameProject, setActiveProject, deleteEmptyProject, projectSummary,
} from './store.js';
import { SignaturePad, drawSignature } from './signature.js';
import { renderReceipt, buildPdfFile, buildImageFile } from './receipt.js';

const root = document.getElementById('app');
const overlay = document.getElementById('overlay');
const stack = [];
const screens = {};
const pdfs = new Map();
const images = new Map();
let t = translator('he');
let activePad = null;

const ICON = {
  chevronDown: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/></svg>',
  back: '<svg class="flip" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
};

/* Helpers ------------------------------------------------------------- */

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function view(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

const moneyHtml = (n, currency) => `<bdi dir="ltr">${esc(money(n, currency))}</bdi>`;

function applyLanguage() {
  const { lang } = state.settings;
  t = translator(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr';
  document.title = t('appName');
}

function render() {
  if (activePad) {
    activePad.destroy();
    activePad = null;
  }
  const frame = stack[stack.length - 1];
  const node = screens[frame.name](frame);
  root.replaceChildren(node);
  if (node.mount) node.mount();
  window.scrollTo(0, frame.scroll || 0);
}

function go(name, params = {}) {
  stack[stack.length - 1].scroll = window.scrollY;
  stack.push({ name, ...params });
  render();
}

function back() {
  if (stack.length > 1) stack.pop();
  render();
}

function barHtml(title) {
  return `<header class="bar">
    <button class="bar-back" data-back type="button">${ICON.back}<span>${esc(t('back'))}</span></button>
    <h1 class="bar-title">${esc(title)}</h1>
  </header>`;
}

function bindBack(node, handler = back) {
  node.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', handler));
}

function toast(message) {
  const node = view(`<div class="toast" role="status">${esc(message)}</div>`);
  document.body.append(node);
  setTimeout(() => node.remove(), 3200);
}

function ask({ title, body, yes, no, danger }) {
  return new Promise((resolve) => {
    const node = view(`<div class="scrim">
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title">${esc(title)}</h2>
        <p>${esc(body)}</p>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-yes type="button">${esc(yes)}</button>
        <button class="btn ghost" data-no type="button">${esc(no)}</button>
      </div>
    </div>`);
    const close = (answer) => {
      node.remove();
      resolve(answer);
    };
    node.querySelector('[data-yes]').addEventListener('click', () => close(true));
    node.querySelector('[data-no]').addEventListener('click', () => close(false));
    overlay.append(node);
    node.querySelector('[data-no]').focus();
  });
}

// Must be called straight from a tap, or iOS refuses to open the share sheet.
async function deliver(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Puts in thousands separators as he types. A comma typed last is a decimal point.
function formatTyping(value) {
  let s = value;
  if (s.endsWith(',')) s = `${s.slice(0, -1)}.`;
  s = s.replace(/,/g, '').replace(/[^\d.]/g, '');
  const [whole, ...rest] = s.split('.');
  const int = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+$)/g, ',');
  return rest.length ? `${int}.${rest.join('').slice(0, 2)}` : int;
}

const parseAmount = (value) => {
  const n = parseFloat(value.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

const receiptOptions = (r) => ({
  lang: state.settings.lang,
  payer: state.settings.name,
  project: getProject(r.projectId)?.name,
  paidToDate: r.status === 'signed' ? r.paidToDate : Math.round((paidTo(r.recipient, r.currency, r.projectId) + r.amount) * 100) / 100,
});

function preparePdf(r) {
  if (!pdfs.has(r.id)) pdfs.set(r.id, buildPdfFile(r, receiptOptions(r)));
  return pdfs.get(r.id);
}

function prepareImage(r) {
  if (!images.has(r.id)) images.set(r.id, buildImageFile(r, receiptOptions(r)));
  return images.get(r.id);
}

function stubHtml(r) {
  const isDraft = r.status === 'draft';
  const lead = isDraft
    ? `<span class="stub-flag">${esc(t('signTag'))}</span>`
    : `<span class="stub-no">${esc(receiptNumber(r.number))}</span>`;
  const detail = [r.stage, r.description].filter(Boolean).join(', ');
  return `<button class="stub" type="button" data-receipt="${esc(r.id)}">
    <span class="stub-lead">${lead}</span>
    <span class="stub-body">
      <span class="stub-name">${esc(r.recipient)}</span>
      ${detail ? `<span class="stub-detail">${esc(detail)}</span>` : ''}
      <span class="stub-date">${esc(longDate(r.date, state.settings.lang))}</span>
    </span>
    <span class="stub-amount fig">${moneyHtml(r.amount, r.currency)}</span>
  </button>`;
}

const byNewest = (a, b) => (a.date === b.date ? (b.number || 0) - (a.number || 0) : a.date < b.date ? 1 : -1);

function listHtml(receipts) {
  let html = '';
  let month = '';
  for (const r of receipts) {
    const key = r.date.slice(0, 7);
    if (key !== month) {
      month = key;
      html += `<h2 class="month">${esc(monthLabel(r.date, state.settings.lang))}</h2>`;
    }
    html += stubHtml(r);
  }
  return html;
}

function bindStubs(node) {
  node.querySelectorAll('[data-receipt]').forEach((b) => {
    b.addEventListener('click', () => go('detail', { id: b.dataset.receipt }));
  });
}

const tallySize = (text) => (text.length <= 8 ? 'xl' : text.length <= 11 ? 'l' : 'm');

function choiceRow(name, options, selected) {
  return options
    .map(
      (o) => `<label class="choice">
        <input type="radio" name="${name}" value="${esc(o.value)}" ${o.value === selected ? 'checked' : ''}>
        <span>${esc(o.label)}</span>
      </label>`
    )
    .join('');
}

const languageChoices = () => LANGUAGES.map((l) => ({ value: l.code, label: l.label }));
const currencyChoices = () => CURRENCIES.map((c) => ({ value: c.code, label: c.symbol }));

/* First run ------------------------------------------------------------ */

screens.welcome = (frame) => {
  const s = state.settings;
  const node = view(`<div class="welcome">
    <header class="welcome-head">
      <h1 class="welcome-title">${esc(t('appName'))}</h1>
      <p>${esc(t('welcomeLead'))}</p>
    </header>
    <form class="paper form" novalidate>
      <fieldset class="field">
        <legend>${esc(t('language'))}</legend>
        <div class="choices two">${choiceRow('lang', languageChoices(), s.lang)}</div>
      </fieldset>
      <div class="field">
        <label for="w-name">${esc(t('yourName'))}</label>
        <input id="w-name" class="line" autocomplete="name" value="${esc(frame.nameDraft ?? s.name)}">
        <p class="help">${esc(t('yourNameHelp'))}</p>
        <p class="error" hidden></p>
      </div>
      <div class="field">
        <label for="w-project">${esc(t('firstProject'))}</label>
        <input id="w-project" class="line" placeholder="${esc(t('projectPlaceholder'))}" value="${esc(frame.projectDraft ?? '')}">
        <p class="help">${esc(t('firstProjectHelp'))}</p>
      </div>
      <fieldset class="field">
        <legend>${esc(t('currency'))}</legend>
        <div class="choices five">${choiceRow('currency', currencyChoices(), s.currency)}</div>
      </fieldset>
      <button class="btn primary" type="submit">${esc(t('start'))}</button>
    </form>
  </div>`);

  const name = node.querySelector('#w-name');
  const project = node.querySelector('#w-project');
  node.querySelectorAll('input[name=lang]').forEach((input) => {
    input.addEventListener('change', async () => {
      frame.nameDraft = name.value;
      frame.projectDraft = project.value;
      await saveSettings({ lang: input.value });
      applyLanguage();
      render();
    });
  });
  node.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = node.querySelector('.error');
    if (!name.value.trim()) {
      error.textContent = t('errYourName');
      error.hidden = false;
      name.focus();
      return;
    }
    await saveSettings({
      name: name.value.trim(),
      currency: node.querySelector('input[name=currency]:checked').value,
    });
    await addProject(project.value.trim() || t('projectPlaceholder'));
    stack.length = 0;
    stack.push({ name: 'home' });
    render();
  });
  return node;
};

/* Home ----------------------------------------------------------------- */

function installHintHtml() {
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const onIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (standalone || !onIos || state.settings.installHintDismissed) return '';
  return `<aside class="notice">
    <h2>${esc(t('installTitle'))}</h2>
    <p>${esc(t('installBody'))}</p>
    <button class="link" type="button" data-dismiss>${esc(t('gotIt'))}</button>
  </aside>`;
}

screens.home = (frame) => {
  const tab = frame.tab || 'payments';
  const { settings } = state;
  const total = money(totalPaid(), settings.currency);
  const waiting = drafts().sort(byNewest);
  const done = signed().sort(byNewest);
  const everyone = people();

  let body;
  if (tab === 'people') {
    body = everyone.length
      ? everyone.map((p, i) => personRowHtml(p, i)).join('')
      : `<div class="empty"><h2>${esc(t('emptyTitle'))}</h2><p>${esc(t('emptyPeople'))}</p></div>`;
  } else if (!done.length && !waiting.length) {
    body = `<div class="empty"><h2>${esc(t('emptyTitle'))}</h2><p>${esc(t('emptyBody'))}</p></div>`;
  } else {
    body = `
      ${waiting.length ? `<section class="waiting"><h2 class="month">${esc(t('waiting'))}</h2>${waiting.map(stubHtml).join('')}</section>` : ''}
      ${done.length > 6 ? `<div class="search"><input type="search" placeholder="${esc(t('search'))}" aria-label="${esc(t('search'))}"></div>` : ''}
      <div data-list>${listHtml(done)}</div>`;
  }

  const node = view(`<div class="screen">
    <header class="cover">
      <div class="cover-top">
        <button class="project-switch" type="button" data-projects aria-label="${esc(t('switchProject'))}">
          <span>${esc(activeProject().name)}</span>${ICON.chevronDown}
        </button>
        <button class="icon-btn" type="button" data-settings aria-label="${esc(t('settings'))}">${ICON.gear}</button>
      </div>
      <p class="tally-label">${esc(t('paidSoFar'))}</p>
      <p class="tally fig ${tallySize(total)}"><bdi dir="ltr">${esc(total)}</bdi></p>
      <nav class="tabs">
        <button type="button" data-tab="payments" ${tab === 'payments' ? 'aria-current="page"' : ''}>${esc(t('payments'))}</button>
        <button type="button" data-tab="people" ${tab === 'people' ? 'aria-current="page"' : ''}>${esc(t('people'))}</button>
      </nav>
    </header>
    <main class="book">${installHintHtml()}${body}</main>
    <div class="dock"><button class="btn primary" type="button" data-new>${esc(t('newPayment'))}</button></div>
  </div>`);

  node.querySelector('[data-settings]').addEventListener('click', () => go('settings'));
  node.querySelector('[data-projects]').addEventListener('click', openProjects);
  node.querySelector('[data-new]').addEventListener('click', () => go('form', { focus: true }));
  node.querySelectorAll('[data-tab]').forEach((b) => {
    b.addEventListener('click', () => {
      frame.tab = b.dataset.tab;
      frame.scroll = 0;
      render();
    });
  });
  node.querySelector('[data-dismiss]')?.addEventListener('click', async () => {
    await saveSettings({ installHintDismissed: true });
    render();
  });
  node.querySelectorAll('[data-person]').forEach((b) => {
    b.addEventListener('click', () => go('person', { person: everyone[Number(b.dataset.person)].name }));
  });
  bindStubs(node);

  const search = node.querySelector('.search input');
  if (search) {
    const list = node.querySelector('[data-list]');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      const found = done.filter((r) =>
        [r.recipient, r.description, r.stage, r.notes, receiptNumber(r.number)].join(' ').toLowerCase().includes(q)
      );
      list.innerHTML = found.length ? listHtml(found) : `<p class="no-results">${esc(t('noResults'))}</p>`;
      bindStubs(list);
    });
  }
  return node;
};

function projectRowHtml(project, isCurrent) {
  const summary = projectSummary(project.id);
  const counts = [t('receiptsCount', { n: summary.signedCount })];
  if (summary.waitingCount) counts.push(t('waitingCount', { n: summary.waitingCount }));
  return `<div class="project-row ${isCurrent ? 'current' : ''}">
    <button class="project-pick" type="button" data-pick="${esc(project.id)}" ${isCurrent ? 'aria-current="true"' : ''}>
      <span class="person-main">
        <span class="stub-name">${esc(project.name)}</span>
        <span class="stub-date">${esc(counts.join(', '))}</span>
      </span>
      <span class="stub-amount fig">${moneyHtml(summary.total, state.settings.currency)}</span>
    </button>
    <button class="project-edit" type="button" data-edit="${esc(project.id)}" aria-label="${esc(t('editProject'))}">${ICON.pencil}</button>
  </div>`;
}

function openProjects() {
  const current = activeProject();
  const node = view(`<div class="scrim">
    <div class="dialog projects-sheet" role="dialog" aria-modal="true" aria-labelledby="projects-title">
      <h2 id="projects-title">${esc(t('projects'))}</h2>
      <div class="project-list">${projects().map((p) => projectRowHtml(p, p.id === current.id)).join('')}</div>
      <button class="btn primary" type="button" data-add>${esc(t('newProject'))}</button>
      <button class="btn ghost" type="button" data-close>${esc(t('close'))}</button>
    </div>
  </div>`);
  const close = () => node.remove();
  node.addEventListener('click', (e) => { if (e.target === node) close(); });
  node.querySelector('[data-close]').addEventListener('click', close);
  node.querySelector('[data-add]').addEventListener('click', () => { close(); openProjectEditor(null); });
  node.querySelectorAll('[data-edit]').forEach((b) => {
    b.addEventListener('click', () => { close(); openProjectEditor(getProject(b.dataset.edit)); });
  });
  node.querySelectorAll('[data-pick]').forEach((b) => {
    b.addEventListener('click', async () => {
      await setActiveProject(b.dataset.pick);
      close();
      stack[stack.length - 1].scroll = 0;
      render();
    });
  });
  overlay.append(node);
}

// Sits at the top of the screen so the keyboard never covers it.
function openProjectEditor(project) {
  const canDelete = project && projects().length > 1 && projectSummary(project.id).isEmpty;
  const node = view(`<div class="scrim top">
    <form class="dialog" novalidate role="dialog" aria-modal="true" aria-labelledby="project-title">
      <h2 id="project-title">${esc(project ? t('editProject') : t('newProject'))}</h2>
      <div>
        <label class="field-label" for="p-name">${esc(t('projectName'))}</label>
        <input id="p-name" class="line" autocomplete="off" value="${esc(project?.name ?? '')}">
        <p class="error" hidden></p>
      </div>
      <button class="btn primary" type="submit">${esc(t('save'))}</button>
      <button class="btn ghost" type="button" data-cancel>${esc(t('cancel'))}</button>
      ${canDelete ? `<button class="link danger" type="button" data-delete>${esc(t('deleteProject'))}</button>` : ''}
    </form>
  </div>`);
  const input = node.querySelector('#p-name');
  const error = node.querySelector('.error');
  const finish = () => {
    node.remove();
    stack[stack.length - 1].scroll = 0;
    render();
  };
  node.querySelector('[data-cancel]').addEventListener('click', () => {
    node.remove();
    openProjects();
  });
  node.querySelector('[data-delete]')?.addEventListener('click', async () => {
    await deleteEmptyProject(project.id);
    finish();
  });
  node.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    const clash = projects().some((p) => p.name === name && p.id !== project?.id);
    error.textContent = !name ? t('errProjectName') : clash ? t('errProjectExists') : '';
    error.hidden = !error.textContent;
    if (error.textContent) return;
    if (project) await renameProject(project.id, name);
    else await addProject(name);
    finish();
  });
  overlay.append(node);
  input.focus();
}

function accountLine(person) {
  if (person.agreedTotal == null) return '';
  const remaining = Math.max(0, person.agreedTotal - person.total);
  return t('remainingOf', {
    remaining: moneyHtml(remaining, state.settings.currency),
    agreed: moneyHtml(person.agreedTotal, state.settings.currency),
  });
}

function personRowHtml(p, index) {
  const share = p.agreedTotal ? Math.min(100, (p.total / p.agreedTotal) * 100) : null;
  return `<button class="person" type="button" data-person="${index}">
    <span class="person-main">
      <span class="stub-name">${esc(p.name)}</span>
      <span class="stub-date">${esc(t('receiptsCount', { n: p.count }))}</span>
    </span>
    <span class="stub-amount fig">${moneyHtml(p.total, state.settings.currency)}</span>
    ${share != null ? `<span class="meter" aria-hidden="true"><span style="width:${share}%"></span></span><span class="person-left">${accountLine(p)}</span>` : ''}
  </button>`;
}

screens.person = (frame) => {
  const person = people().find((p) => sameName(p.name, frame.person));
  if (!person) {
    stack.pop();
    return screens[stack[stack.length - 1].name](stack[stack.length - 1]);
  }
  const mine = state.receipts.filter((r) => sameName(r.recipient, person.name));
  const waiting = mine.filter((r) => r.status === 'draft').sort(byNewest);
  const done = mine.filter((r) => r.status === 'signed').sort(byNewest);
  const total = money(person.total, state.settings.currency);
  const node = view(`<div class="screen">
    <header class="cover compact">
      <div class="cover-top">
        <button class="bar-back on-blue" data-back type="button">${ICON.back}<span>${esc(t('back'))}</span></button>
      </div>
      <h1 class="cover-name">${esc(person.name)}</h1>
      <p class="tally fig ${tallySize(total)}"><bdi dir="ltr">${esc(total)}</bdi></p>
      ${person.agreedTotal != null ? `<p class="cover-left">${accountLine(person)}</p>` : ''}
    </header>
    <main class="book">
      ${waiting.length ? `<section class="waiting"><h2 class="month">${esc(t('waiting'))}</h2>${waiting.map(stubHtml).join('')}</section>` : ''}
      ${listHtml(done)}
    </main>
    <div class="dock"><button class="btn primary" type="button" data-new>${esc(t('newPaymentTo', { name: person.name }))}</button></div>
  </div>`);
  bindBack(node);
  bindStubs(node);
  node.querySelector('[data-new]').addEventListener('click', () => {
    go('form', {
      focus: true,
      prefill: { recipient: person.name, recipientId: person.recipientId, agreedTotal: person.agreedTotal },
    });
  });
  return node;
};

/* New or edit payment -------------------------------------------------- */

function blankReceipt() {
  return {
    id: newId(),
    projectId: activeProject().id,
    status: 'draft',
    createdAt: new Date().toISOString(),
    amount: null,
    currency: state.settings.currency,
    date: todayIso(),
    recipient: '',
    recipientId: '',
    description: '',
    stage: '',
    method: 'cash',
    reference: '',
    agreedTotal: null,
    notes: '',
  };
}

screens.form = (frame) => {
  const existing = frame.id ? getReceipt(frame.id) : null;
  const r = existing ? { ...existing } : { ...blankReceipt(), ...(frame.prefill || {}) };
  // Names from other projects are offered too, but agreed totals stay per project.
  const known = people();
  for (const other of people(null)) {
    if (!known.some((p) => sameName(p.name, other.name))) known.push({ ...other, agreedTotal: null });
  }
  const showMore = Boolean(r.agreedTotal != null || r.recipientId || r.notes);
  const methods = ['cash', 'transfer', 'cheque', 'other'].map((m) => ({ value: m, label: t(`method_${m}`) }));
  const stages = ['stage1', 'stage2', 'stage3', 'stageFinal'].map((k) => t(k));

  const node = view(`<div class="screen">
    ${barHtml(existing ? t('editTitle') : t('newTitle'))}
    <form class="paper form" novalidate autocomplete="off">
      <p class="form-project">${esc(getProject(r.projectId)?.name)}</p>
      <div class="field">
        <label for="f-amount">${esc(t('amountPaid'))}</label>
        <div class="amount" dir="ltr">
          <span class="amount-symbol fig">${esc(symbolOf(r.currency))}</span>
          <input id="f-amount" class="amount-input fig" inputmode="decimal" placeholder="0" value="${r.amount != null ? esc(groupDigits(r.amount)) : ''}">
        </div>
        <p class="error" data-error="amount" hidden></p>
      </div>

      <div class="field">
        <label for="f-recipient">${esc(t('paidTo'))}</label>
        <input id="f-recipient" class="line" placeholder="${esc(t('paidToPlaceholder'))}" value="${esc(r.recipient)}">
        <div class="chips" data-people></div>
        <p class="error" data-error="recipient" hidden></p>
      </div>

      <div class="field">
        <label for="f-date">${esc(t('date'))}</label>
        <input id="f-date" class="line" type="date" value="${esc(r.date)}">
        <p class="error" data-error="date" hidden></p>
      </div>

      <div class="field">
        <label for="f-description">${esc(t('forWhat'))}</label>
        <textarea id="f-description" class="line" rows="2" placeholder="${esc(t('forWhatPlaceholder'))}">${esc(r.description)}</textarea>
      </div>

      <div class="field">
        <label for="f-stage">${esc(t('stage'))}</label>
        <input id="f-stage" class="line" placeholder="${esc(t('stagePlaceholder'))}" value="${esc(r.stage)}">
        <div class="chips">${stages.map((s) => `<button class="chip" type="button" data-stage="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      </div>

      <fieldset class="field">
        <legend>${esc(t('method'))}</legend>
        <div class="choices two">${choiceRow('method', methods, r.method)}</div>
        <div data-reference ${r.method === 'cash' ? 'hidden' : ''}>
          <label for="f-reference" class="sub-label">${esc(t('reference'))}</label>
          <input id="f-reference" class="line" value="${esc(r.reference)}">
        </div>
      </fieldset>

      <details class="more" ${showMore ? 'open' : ''}>
        <summary>${esc(t('moreDetails'))}</summary>
        <div class="field">
          <label for="f-agreed">${esc(t('agreedTotal'))}</label>
          <input id="f-agreed" class="line" inputmode="decimal" dir="ltr" value="${r.agreedTotal != null ? esc(groupDigits(r.agreedTotal)) : ''}">
          <p class="help">${esc(t('agreedHelp'))}</p>
        </div>
        <div class="field">
          <label for="f-id">${esc(t('recipientId'))}</label>
          <input id="f-id" class="line" value="${esc(r.recipientId)}">
        </div>
        <div class="field">
          <label for="f-notes">${esc(t('notes'))}</label>
          <textarea id="f-notes" class="line" rows="2">${esc(r.notes)}</textarea>
        </div>
      </details>

      <div class="form-actions">
        <button class="btn primary" type="submit">${esc(t('getSignatures'))}</button>
        <button class="btn ghost" type="button" data-later>${esc(t('signLater'))}</button>
      </div>
    </form>
  </div>`);

  const get = (id) => node.querySelector(`#f-${id}`);
  const form = node.querySelector('form');
  const amount = get('amount');
  const agreed = get('agreed');
  const recipient = get('recipient');
  const idField = get('id');

  amount.addEventListener('input', () => { amount.value = formatTyping(amount.value); });
  agreed.addEventListener('input', () => { agreed.value = formatTyping(agreed.value); });

  node.querySelectorAll('input[name=method]').forEach((input) => {
    input.addEventListener('change', () => {
      node.querySelector('[data-reference]').hidden = input.value === 'cash';
    });
  });
  node.querySelectorAll('[data-stage]').forEach((b) => {
    b.addEventListener('click', () => { get('stage').value = b.dataset.stage; });
  });

  // Names he has paid before, narrowed as he types.
  const chipBox = node.querySelector('[data-people]');
  const showPeople = () => {
    const q = recipient.value.trim().toLowerCase();
    const matches = known.filter((p) => p.name.toLowerCase().includes(q) && p.name.toLowerCase() !== q).slice(0, 6);
    chipBox.innerHTML = matches.map((p) => `<button class="chip" type="button" data-name="${esc(p.name)}">${esc(p.name)}</button>`).join('');
    chipBox.querySelectorAll('[data-name]').forEach((b) => {
      b.addEventListener('click', () => {
        const person = known.find((p) => p.name === b.dataset.name);
        recipient.value = person.name;
        if (!idField.value && person.recipientId) idField.value = person.recipientId;
        if (!agreed.value && person.agreedTotal != null) agreed.value = groupDigits(person.agreedTotal);
        showPeople();
      });
    });
  };
  recipient.addEventListener('input', showPeople);
  showPeople();

  const snapshot = () => new URLSearchParams(new FormData(form)).toString()
    + [...form.querySelectorAll('input:not([type=radio]),textarea')].map((f) => f.value).join('|');
  let original = '';

  const showError = (key, message) => {
    const box = node.querySelector(`[data-error=${key}]`);
    box.textContent = message;
    box.hidden = !message;
  };

  async function save() {
    const parsed = parseAmount(amount.value);
    const name = recipient.value.trim();
    const date = get('date').value;
    showError('amount', parsed ? '' : t('errAmount'));
    showError('recipient', name ? '' : t('errName'));
    showError('date', date ? '' : t('errDate'));
    if (!parsed) { amount.focus(); return null; }
    if (!name) { recipient.focus(); return null; }
    if (!date) { get('date').focus(); return null; }
    const method = node.querySelector('input[name=method]:checked').value;
    const record = {
      ...r,
      amount: parsed,
      recipient: name,
      date,
      description: get('description').value.trim(),
      stage: get('stage').value.trim(),
      method,
      reference: method === 'cash' ? '' : get('reference').value.trim(),
      agreedTotal: parseAmount(agreed.value),
      recipientId: idField.value.trim(),
      notes: get('notes').value.trim(),
    };
    await saveReceipt(record);
    return record;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const record = await save();
    if (!record) return;
    stack.pop();
    if (frame.id) stack.pop(); // Replaces the old detail page when editing.
    stack.push({ name: 'detail', id: record.id });
    stack.push({ name: 'sign', id: record.id, step: 'payer', collected: {} });
    render();
  });

  node.querySelector('[data-later]').addEventListener('click', async () => {
    const record = await save();
    if (record) back();
  });

  bindBack(node, async () => {
    if (snapshot() !== original) {
      const leave = await ask({
        title: t('discardTitle'), body: t('discardBody'), yes: t('discard'), no: t('keepEditing'), danger: true,
      });
      if (!leave) return;
    }
    back();
  });

  node.mount = () => {
    original = snapshot();
    if (frame.focus) {
      frame.focus = false;
      amount.focus();
    }
  };
  return node;
};

/* Signing -------------------------------------------------------------- */

screens.sign = (frame) => {
  const r = getReceipt(frame.id);
  const isPayer = frame.step === 'payer';
  const { settings } = state;
  const date = longDate(r.date, settings.lang);
  const heading = isPayer ? t('payerHeading') : t('recipientHeading', { name: r.recipient });
  const body = isPayer
    ? t('payerBody', { recipient: r.recipient, date })
    : t('recipientBody', { payer: settings.name, date });
  const saved = isPayer ? settings.savedSignature : null;

  const node = view(`<div class="sign">
    <header class="sign-top">
      <div class="sign-bar">
        <button type="button" class="sign-cancel" data-cancel>${esc(t('cancel'))}</button>
        <span>${esc(t('stepOf', { n: isPayer ? 1 : 2 }))}</span>
      </div>
      <h1>${esc(heading)}</h1>
      <p class="sign-amount fig">${moneyHtml(r.amount, r.currency)}</p>
      <p class="sign-body">${esc(body)}</p>
      ${r.description ? `<p class="sign-for">${esc(t('forLine', { text: r.description }))}</p>` : ''}
    </header>
    <div class="pad">
      <div class="pad-line" aria-hidden="true"></div>
      <span class="flag" aria-hidden="true">${esc(t('signHere'))}</span>
      <canvas aria-label="${esc(t('signHere'))}"></canvas>
    </div>
    <footer class="sign-foot">
      ${isPayer ? `<label class="check"><input type="checkbox" data-remember ${settings.savedSignature !== false ? 'checked' : ''}><span>${esc(t('remember'))}</span></label>` : ''}
      <div class="sign-actions">
        <button class="btn ghost" type="button" data-clear>${esc(t('clear'))}</button>
        <button class="btn primary" type="button" data-confirm disabled>${esc(isPayer ? t('confirmPayer') : t('confirmRecipient'))}</button>
      </div>
    </footer>
  </div>`);

  const confirm = node.querySelector('[data-confirm]');
  const flag = node.querySelector('.flag');

  node.querySelector('[data-cancel]').addEventListener('click', () => back());

  node.mount = () => {
    const pad = new SignaturePad(node.querySelector('canvas'), () => {
      confirm.disabled = !pad.isValid;
      flag.classList.toggle('gone', !pad.isEmpty);
    });
    activePad = pad;
    if (saved) pad.load(saved);
    node.querySelector('[data-clear]').addEventListener('click', () => pad.clear());
    confirm.addEventListener('click', async () => {
      confirm.disabled = true;
      if (isPayer) {
        const remember = node.querySelector('[data-remember]').checked;
        await saveSettings({ savedSignature: remember ? { strokes: pad.toData().strokes } : null });
        frame.collected.payer = pad.toData();
        frame.step = 'recipient';
        render();
      } else {
        frame.collected.recipient = pad.toData();
        await finishSigning(r, frame.collected);
      }
    });
  };
  return node;
};

async function finishSigning(r, signatures) {
  const { settings } = state;
  const number = settings.nextNo;
  const record = {
    ...r,
    status: 'signed',
    number,
    payer: settings.name,
    project: getProject(r.projectId)?.name,
    lang: settings.lang,
    signatures,
    paidToDate: Math.round((paidTo(r.recipient, r.currency, r.projectId) + r.amount) * 100) / 100,
  };
  await saveReceipt(record);
  await saveSettings({ nextNo: number + 1 });
  stack.pop(); // Leaves the signing page.
  stack[stack.length - 1].justSigned = true;
  render();
}

/* Receipt page --------------------------------------------------------- */

screens.detail = (frame) => {
  const r = getReceipt(frame.id);
  const isDraft = r.status === 'draft';
  const justSigned = frame.justSigned;
  frame.justSigned = false;
  const title = isDraft ? t('draft') : t('receiptNo', { n: receiptNumber(r.number) });

  const node = view(`<div class="screen">
    ${barHtml(title)}
    <main class="detail">
      ${justSigned ? `<p class="signed-note">${esc(t('signedDone'))}</p>` : ''}
      <div class="sheet ${justSigned ? 'torn' : ''}"></div>
      <div class="detail-actions">
        ${isDraft
          ? `<button class="btn primary" type="button" data-sign>${esc(t('getSignatures'))}</button>
             <button class="btn ghost" type="button" data-edit>${esc(t('edit'))}</button>`
          : `<button class="btn primary" type="button" data-share disabled>${esc(t('preparing'))}</button>
             <p class="help center">${esc(t('shareHint'))}</p>
             <button class="btn ghost" type="button" data-photo disabled>${esc(t('savePhoto'))}</button>
             <p class="help center">${esc(t('photoHint'))}</p>`}
        <button class="link danger" type="button" data-delete>${esc(isDraft ? t('deletePayment') : t('deleteReceipt'))}</button>
      </div>
    </main>
  </div>`);

  bindBack(node);
  node.querySelector('[data-sign]')?.addEventListener('click', () => go('sign', { id: r.id, step: 'payer', collected: {} }));
  node.querySelector('[data-edit]')?.addEventListener('click', () => go('form', { id: r.id }));
  node.querySelector('[data-delete]').addEventListener('click', async () => {
    const yes = await ask({
      title: isDraft ? t('deleteDraftTitle') : t('deleteSignedTitle', { n: receiptNumber(r.number) }),
      body: t('deleteBody'),
      yes: isDraft ? t('deletePayment') : t('deleteReceipt'),
      no: t('keep'),
      danger: true,
    });
    if (!yes) return;
    await deleteReceipt(r.id);
    pdfs.delete(r.id);
    images.delete(r.id);
    back();
  });

  node.mount = () => {
    node.querySelector('.sheet').append(renderReceipt(r, receiptOptions(r), 1));
    const share = node.querySelector('[data-share]');
    if (!share) return;
    const photo = node.querySelector('[data-photo]');
    let file = null;
    let image = null;
    share.addEventListener('click', () => {
      if (file) deliver(file);
    });
    photo.addEventListener('click', () => {
      if (image) deliver(image);
    });
    // Built before the tap: iOS only opens the share sheet straight after one.
    // One at a time, so the phone never holds two large canvases together.
    setTimeout(async () => {
      try {
        file = await preparePdf(r);
        share.textContent = t('sharePdf');
        share.disabled = false;
      } catch {
        pdfs.delete(r.id);
        share.textContent = t('pdfFailed');
      }
      try {
        image = await prepareImage(r);
        photo.disabled = false;
      } catch {
        images.delete(r.id);
        photo.textContent = t('photoFailed');
      }
    }, 60);
  };
  return node;
};

/* Settings ------------------------------------------------------------- */

function csvText() {
  const clean = (value) => {
    const s = String(value ?? '');
    const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${guarded.replace(/"/g, '""')}"`;
  };
  const header = ['Project', 'No.', 'Date', 'Paid to', 'Amount', 'Currency', 'For', 'Stage', 'Method', 'Reference', 'Notes'];
  const rows = signed(null).sort((a, b) => a.number - b.number).map((r) => [
    getProject(r.projectId)?.name, receiptNumber(r.number), r.date, r.recipient, r.amount, r.currency, r.description, r.stage, r.method, r.reference, r.notes,
  ]);
  return `﻿${[header, ...rows].map((row) => row.map(clean).join(',')).join('\r\n')}`;
}

screens.settings = () => {
  const s = state.settings;
  const node = view(`<div class="screen">
    ${barHtml(t('settings'))}
    <form class="paper form" novalidate>
      <div class="field">
        <label for="s-name">${esc(t('yourName'))}</label>
        <input id="s-name" class="line" value="${esc(s.name)}">
      </div>
      <fieldset class="field">
        <legend>${esc(t('language'))}</legend>
        <div class="choices two">${choiceRow('lang', languageChoices(), s.lang)}</div>
      </fieldset>
      <fieldset class="field">
        <legend>${esc(t('currency'))}</legend>
        <div class="choices five">${choiceRow('currency', currencyChoices(), s.currency)}</div>
      </fieldset>
      <div class="field">
        <p class="field-label">${esc(t('savedSignature'))}</p>
        ${s.savedSignature
          ? `<canvas class="saved-sig" width="660" height="240"></canvas><button class="link danger" type="button" data-remove-sig>${esc(t('removeSignature'))}</button>`
          : `<p class="help">${esc(t('noSavedSignature'))}</p>`}
      </div>
      <div class="field">
        <p class="field-label">${esc(t('records'))}</p>
        <p class="help">${esc(t('recordsBody'))}</p>
        <div class="stack-btns">
          <button class="btn ghost" type="button" data-backup>${esc(t('saveBackup'))}</button>
          <button class="btn ghost" type="button" data-restore>${esc(t('restoreBackup'))}</button>
          <button class="btn ghost" type="button" data-csv>${esc(t('exportCsv'))}</button>
          <input type="file" accept=".json,application/json" hidden data-file>
        </div>
      </div>
    </form>
  </div>`);

  bindBack(node);
  node.querySelector('form').addEventListener('submit', (e) => e.preventDefault());

  const name = node.querySelector('#s-name');
  name.addEventListener('change', () => {
    if (name.value.trim()) saveSettings({ name: name.value.trim() });
    else name.value = state.settings.name;
  });
  node.querySelectorAll('input[name=lang]').forEach((input) => {
    input.addEventListener('change', async () => {
      await saveSettings({ lang: input.value });
      applyLanguage();
      render();
    });
  });
  node.querySelectorAll('input[name=currency]').forEach((input) => {
    input.addEventListener('change', () => saveSettings({ currency: input.value }));
  });
  node.querySelector('[data-remove-sig]')?.addEventListener('click', async () => {
    await saveSettings({ savedSignature: null });
    render();
  });
  node.querySelector('[data-backup]').addEventListener('click', () => {
    deliver(new File([exportBackup()], `Paid and Signed backup ${todayIso()}.json`, { type: 'application/json' }));
  });
  node.querySelector('[data-csv]').addEventListener('click', () => {
    deliver(new File([csvText()], `Payments ${todayIso()}.csv`, { type: 'text/csv' }));
  });
  const file = node.querySelector('[data-file]');
  node.querySelector('[data-restore]').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    if (!file.files[0]) return;
    try {
      const added = await importBackup(await file.files[0].text());
      toast(t('restored', { n: added }));
    } catch {
      toast(t('restoreFailed'));
    }
    file.value = '';
  });

  node.mount = () => {
    const canvas = node.querySelector('.saved-sig');
    if (canvas) drawSignature(canvas.getContext('2d'), s.savedSignature, { x: 20, y: 20, w: 620, h: 200 });
  };
  return node;
};

/* Start ---------------------------------------------------------------- */

async function start() {
  try {
    await loadAll();
  } catch {
    root.replaceChildren(view(`<div class="empty"><p>${esc(t('storageFailed'))}</p></div>`));
    return;
  }
  applyLanguage();
  stack.push({ name: isSetUp() ? 'home' : 'welcome' });
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

start();
