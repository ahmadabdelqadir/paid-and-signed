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
  project: '',
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
  // Ask the browser not to clear this data when space runs low.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

export const isSetUp = () => Boolean(state.settings.name);

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

export const signed = () => state.receipts.filter((r) => r.status === 'signed');
export const drafts = () => state.receipts.filter((r) => r.status === 'draft');

const round = (n) => Math.round(n * 100) / 100;

export function totalPaid(currency = state.settings.currency) {
  return round(signed().filter((r) => r.currency === currency).reduce((sum, r) => sum + r.amount, 0));
}

export function paidTo(name, currency = state.settings.currency) {
  return round(
    signed()
      .filter((r) => r.currency === currency && sameName(r.recipient, name))
      .reduce((sum, r) => sum + r.amount, 0)
  );
}

// One entry per person who has ever been paid, most recent first.
export function people() {
  const byName = new Map();
  const sorted = [...state.receipts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
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
  for (const person of byName.values()) person.total = paidTo(person.name);
  return [...byName.values()];
}

export function exportBackup() {
  return JSON.stringify({ app: 'paid-and-signed', version: 1, settings: state.settings, receipts: state.receipts });
}

// Adds receipts from a backup. Receipts already on the phone stay as they are.
export async function importBackup(text) {
  const data = JSON.parse(text);
  if (data.app !== 'paid-and-signed' || !Array.isArray(data.receipts)) throw new Error('Not a backup file');
  let added = 0;
  for (const receipt of data.receipts) {
    if (!receipt.id || getReceipt(receipt.id)) continue;
    await saveReceipt(receipt);
    added += 1;
  }
  const highest = Math.max(0, ...state.receipts.map((r) => r.number || 0));
  await saveSettings({ nextNo: Math.max(state.settings.nextNo, highest + 1) });
  return added;
}
