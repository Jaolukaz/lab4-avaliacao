/**
 * Repositório de avaliações. Várias avaliações ficam salvas no aparelho, cada uma com suas fotos.
 */
import { openStore } from './db.js';
import { PHOTO_KEYS } from '../core/config.js';
import { hydrate, defaults, SCHEMA_VERSION } from '../core/model.js';

const LEGACY_STATE = 'lab4.avaliacao.v1';
const LEGACY_PHOTOS = 'lab4.fotos.v1';

let store;

export async function initRepo() {
  store = await openStore();
  return store.kind;
}

export const newId = () =>
  globalThis.crypto?.randomUUID?.() || `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/* ---------- avaliações ---------- */
export async function listEvals() {
  const all = await store.getAll('evals');
  return all
    .map((r) => ({ id: r.id, nome: r.state?.id?.nome || '', dataAval: r.state?.id?.dataAval || '', updatedAt: r.updatedAt, createdAt: r.createdAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadEval(id) {
  const r = await store.get('evals', id);
  return r ? { ...r, state: hydrate(r.state) } : null;
}

export async function saveEval(id, state, createdAt) {
  const now = Date.now();
  await store.put('evals', { id, v: SCHEMA_VERSION, state, createdAt: createdAt || now, updatedAt: now });
  return now;
}

export async function deleteEval(id) {
  await store.delMany('photos', PHOTO_KEYS.map((k) => `${id}|${k}`));
  await store.del('evals', id);
}

export async function getCurrentId() { return store.get('meta', 'current'); }
export async function setCurrentId(id) { return store.put('meta', id, 'current'); }
export async function getMeta(key) { return store.get('meta', key); }
export async function setMeta(key, value) { return store.put('meta', value, key); }

/* ---------- fotos ---------- */
/** @returns {Promise<Record<string,{buf:ArrayBuffer,type:string,w:number,h:number}>>} */
export async function loadPhotos(id) {
  const out = {};
  for (const k of PHOTO_KEYS) {
    const p = await store.get('photos', `${id}|${k}`);
    if (p && p.buf) out[k] = p;
  }
  return out;
}
export const savePhoto = (id, slot, rec) => store.put('photos', rec, `${id}|${slot}`);
export const deletePhoto = (id, slot) => store.del('photos', `${id}|${slot}`);

/* ---------- conversões ---------- */
async function dataUrlToPhoto(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  let w = 0;
  let h = 0;
  try {
    const bmp = await createImageBitmap(blob);
    w = bmp.width; h = bmp.height; bmp.close?.();
  } catch { /* dimensões não são essenciais */ }
  return { buf: await blob.arrayBuffer(), type: blob.type || 'image/jpeg', w, h };
}

function bufToDataUrl(buf, type) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}

/** Arquivo de exportação: compatível com o formato da versão 1 (fotos em data URL). */
export function buildExport(state, photos) {
  const out = {};
  for (const [k, p] of Object.entries(photos)) out[k] = bufToDataUrl(p.buf, p.type);
  return JSON.stringify({ app: 'lab4-avaliacao-funcional', v: SCHEMA_VERSION, exportadoEm: new Date().toISOString(), state, photos: out });
}

/** Importa um arquivo exportado (v1 ou v2) como nova avaliação salva. */
export async function importEval(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Arquivo inválido: o conteúdo não é um JSON legível.'); }
  if (!data || typeof data.state !== 'object') throw new Error('Este arquivo não é uma avaliação exportada por esta aplicação.');
  const id = newId();
  const state = hydrate(data.state);
  const photos = {};
  for (const k of PHOTO_KEYS) {
    const v = data.photos?.[k];
    if (typeof v === 'string' && v.startsWith('data:image/')) {
      photos[k] = await dataUrlToPhoto(v);
      await savePhoto(id, k, photos[k]);
    }
  }
  await saveEval(id, state);
  return { id, state, photos };
}

/** Recupera o rascunho salvo pela versão 1 (localStorage), se existir no mesmo endereço. */
export async function migrateLegacy() {
  let raw;
  try { raw = localStorage.getItem(LEGACY_STATE); } catch { return null; }
  if (!raw) return null;
  try {
    const state = hydrate(JSON.parse(raw));
    const id = newId();
    const legacy = JSON.parse(localStorage.getItem(LEGACY_PHOTOS) || '{}');
    for (const k of PHOTO_KEYS) {
      if (typeof legacy[k] === 'string' && legacy[k].startsWith('data:image/')) await savePhoto(id, k, await dataUrlToPhoto(legacy[k]));
    }
    await saveEval(id, state);
    localStorage.removeItem(LEGACY_STATE);
    localStorage.removeItem(LEGACY_PHOTOS);
    return id;
  } catch (err) {
    console.warn('[lab4] falha ao migrar rascunho da versão 1', err);
    return null;
  }
}

export async function createEval() {
  const id = newId();
  const state = defaults();
  await saveEval(id, state);
  return { id, state, photos: {} };
}
