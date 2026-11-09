// Everything is kept on the phone, in IndexedDB. Nothing is sent anywhere.
const DB_NAME = 'paid-and-signed';
const DB_VERSION = 1;
const RECEIPTS = 'receipts';
const META = 'meta';

let db;
export const state = {
  settings: null,
  receipts: [],
};

const DEFAULT_SETTINGS = {
  lang: 'he',
  name: '',
  projects: [],
  activeProjectId: null,
  currency: 'ILS',
  nextNo: 1,
  savedSignature: null,
  installHintDismissed: false,
};

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const d = request.result;
      d.createObjectStore(RECEIPTS, { keyPath: 'id' });
      d.createObjectStore(META);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(store, mode, work) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = work(t.objectStore(store));
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function loadAll() {
  db = await openDb();
  const [saved, receipts] = await Promise.all([
    tx(META, 'readonly', (s) => s.get('settings')),
    tx(RECEIPTS, 'readonly', (s) => s.getAll()),
  ]);
  state.settings = { ...DEFAULT_SETTINGS, ...(saved || {}) };
  state.receipts = receipts || [];
  await moveToProjects();
  // Ask the browser not to clear this data when space runs low.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

// Older versions had one list and a project name in settings. This puts
// everything into a first project, so nothing is lost when the app updates.
async function moveToProjects() {
  const s = state.settings;
  if (!s.projects.length && (s.name || state.receipts.length)) {
    const name = s.project || state.receipts.find((r) => r.project)?.project || 'הבית שלנו';
    s.projects = [{ id: newId(), name, createdAt: new Date().toISOString() }];
  }
  if (!s.projects.length) return;
  if (!s.projects.some((p) => p.id === s.activeProjectId)) s.activeProjectId = s.projects[0].id;
  delete s.project;
  await tx(META, 'readwrite', (store) => store.put(s, 'settings'));
  for (const r of state.receipts) {
    if (r.projectId) continue;
    r.projectId = s.activeProjectId;
    await tx(RECEIPTS, 'readwrite', (store) => store.put(r));
  }
}

export const isSetUp = () => Boolean(state.settings.name && state.settings.projects.length);

export function saveSettings(patch) {
  Object.assign(state.settings, patch);
  return tx(META, 'readwrite', (s) => s.put(state.settings, 'settings'));
}

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export const getReceipt = (id) => state.receipts.find((r) => r.id === id);

export function saveReceipt(receipt) {
  receipt.updatedAt = new Date().toISOString();
  const at = state.receipts.findIndex((r) => r.id === receipt.id);
  if (at >= 0) state.receipts[at] = receipt;
  else state.receipts.push(receipt);
  return tx(RECEIPTS, 'readwrite', (s) => s.put(receipt));
}

export function deleteReceipt(id) {
  state.receipts = state.receipts.filter((r) => r.id !== id);
  return tx(RECEIPTS, 'readwrite', (s) => s.delete(id));
}

export const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const projects = () => state.settings.projects;
export const getProject = (id) => projects().find((p) => p.id === id);
export const activeProject = () => getProject(state.settings.activeProjectId) || projects()[0];
const activeId = () => activeProject()?.id;

export function createProject(name, id = newId()) {
  const project = { id, name, createdAt: new Date().toISOString() };
  state.settings.projects = [...projects(), project];
  return project;
}

export async function addProject(name) {
  const project = createProject(name);
  await saveSettings({ activeProjectId: project.id });
  return project;
}

export function renameProject(id, name) {
  return saveSettings({ projects: projects().map((p) => (p.id === id ? { ...p, name } : p)) });
}

export const setActiveProject = (id) => saveSettings({ activeProjectId: id });

// Only an empty project can be deleted, so a signed receipt can never vanish this way.
export async function deleteEmptyProject(id) {
  if (state.receipts.some((r) => r.projectId === id) || projects().length < 2) return;
  const left = projects().filter((p) => p.id !== id);
  await saveSettings({
    projects: left,
    activeProjectId: state.settings.activeProjectId === id ? left[0].id : state.settings.activeProjectId,
  });
}

// projectId: leave it out for the open project, or pass null for every project.
const inProject = (r, projectId) => projectId === null || r.projectId === projectId;

export const signed = (projectId = activeId()) =>
  state.receipts.filter((r) => r.status === 'signed' && inProject(r, projectId));
export const drafts = (projectId = activeId()) =>
  state.receipts.filter((r) => r.status === 'draft' && inProject(r, projectId));

const round = (n) => Math.round(n * 100) / 100;

export function totalPaid(currency = state.settings.currency, projectId = activeId()) {
  return round(signed(projectId).filter((r) => r.currency === currency).reduce((sum, r) => sum + r.amount, 0));
}

export function paidTo(name, currency = state.settings.currency, projectId = activeId()) {
  return round(
    signed(projectId)
      .filter((r) => r.currency === currency && sameName(r.recipient, name))
      .reduce((sum, r) => sum + r.amount, 0)
  );
}

export function projectSummary(id) {
  return {
    signedCount: signed(id).length,
    waitingCount: drafts(id).length,
    total: totalPaid(state.settings.currency, id),
    isEmpty: !state.receipts.some((r) => r.projectId === id),
  };
}

// One entry per person who has been paid, most recent first.
export function people(projectId = activeId()) {
  const byName = new Map();
  const sorted = state.receipts.filter((r) => inProject(r, projectId)).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  for (const r of sorted) {
    const key = r.recipient.trim().toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, { name: r.recipient.trim(), recipientId: r.recipientId || '', agreedTotal: null, count: 0, total: 0 });
    }
    const person = byName.get(key);
    if (person.agreedTotal == null && r.agreedTotal != null) person.agreedTotal = r.agreedTotal;
    if (!person.recipientId && r.recipientId) person.recipientId = r.recipientId;
    if (r.status === 'signed') person.count += 1;
  }
  for (const person of byName.values()) person.total = paidTo(person.name, state.settings.currency, projectId);
  return [...byName.values()];
}

export function exportBackup() {
  return JSON.stringify({ app: 'paid-and-signed', version: 1, settings: state.settings, receipts: state.receipts });
}

function projectForImported(receipt, backupProjects) {
  const existing = getProject(receipt.projectId);
  if (existing) return existing;
  const fromBackup = backupProjects.find((p) => p.id === receipt.projectId);
  const name = fromBackup?.name || receipt.project;
  if (!name) return activeProject();
  return projects().find((p) => p.name === name) || createProject(name, fromBackup?.id);
}

// Adds receipts from a backup. Receipts already on the phone stay as they are.
export async function importBackup(text) {
  const data = JSON.parse(text);
  if (data.app !== 'paid-and-signed' || !Array.isArray(data.receipts)) throw new Error('Not a backup file');
  let added = 0;
  for (const receipt of data.receipts) {
    if (!receipt.id || getReceipt(receipt.id)) continue;
    receipt.projectId = projectForImported(receipt, data.settings?.projects || []).id;
    await saveReceipt(receipt);
    added += 1;
  }
  const highest = Math.max(0, ...state.receipts.map((r) => r.number || 0));
  await saveSettings({ nextNo: Math.max(state.settings.nextNo, highest + 1) });
  return added;
}
