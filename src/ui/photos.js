/**
 * Processamento de imagens no próprio aparelho.
 * As fotos são decodificadas uma de cada vez (fila) para evitar picos de memória
 * com câmeras de alta resolução, redimensionadas e recomprimidas em JPEG.
 */
import { PHOTO_JPEG_QUALITY, PHOTO_MAX_DIM } from '../core/config.js';

let queue = Promise.resolve();

async function decode(file) {
  if ('createImageBitmap' in globalThis) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* recurso parcial: tenta <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await (img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; }));
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function resize(file, maxDim) {
  const src = await decode(file);
  const w0 = src.naturalWidth || src.width;
  const h0 = src.naturalHeight || src.height;
  if (!w0 || !h0) throw new Error('Imagem sem dimensões');
  const s = Math.min(1, maxDim / Math.max(w0, h0));
  const w = Math.round(w0 * s);
  const h = Math.round(h0 * s);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  src.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', PHOTO_JPEG_QUALITY));
  canvas.width = 0; // libera memória do canvas (relevante no iOS)
  canvas.height = 0;
  if (!blob) throw new Error('Falha ao comprimir a imagem');
  return { buf: await blob.arrayBuffer(), type: 'image/jpeg', w, h };
}

/** @returns {Promise<{buf:ArrayBuffer,type:string,w:number,h:number}>} */
export function processImage(file, slot) {
  const job = queue.then(() => resize(file, PHOTO_MAX_DIM[slot] || PHOTO_MAX_DIM.default));
  queue = job.catch(() => {});
  return job;
}

/** Mantém object URLs para exibição, liberando os antigos. */
export class PhotoUrls {
  constructor() { this.urls = {}; }
  set(slot, rec) {
    this.revoke(slot);
    if (rec) this.urls[slot] = URL.createObjectURL(new Blob([rec.buf], { type: rec.type }));
  }
  get(slot) { return this.urls[slot] || null; }
  revoke(slot) { if (this.urls[slot]) URL.revokeObjectURL(this.urls[slot]); delete this.urls[slot]; }
  reset(photos) {
    Object.keys(this.urls).forEach((k) => this.revoke(k));
    Object.entries(photos).forEach(([k, r]) => this.set(k, r));
  }
}
