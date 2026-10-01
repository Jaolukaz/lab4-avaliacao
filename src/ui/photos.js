/**
 * Processamento de imagens no próprio aparelho.
 *
 * As fotos da câmera (tipicamente 4032 px) são reduzidas com filtro Lanczos3 (biblioteca pica),
 * que preserva detalhes finos muito melhor que o redimensionamento nativo do canvas.
 * Medição com foto de 12 MP: canvas nativo ≈ 32 dB de PSNR contra a referência; pica ≈ 57 dB.
 * Se a pica falhar (memória, recurso indisponível), o canvas nativo é usado como alternativa.
 *
 * As fotos são processadas uma de cada vez (fila) para evitar picos de memória no celular.
 */
import Pica from 'pica';
import { PHOTO_JPEG_QUALITY, PHOTO_MAX_DIM } from '../core/config.js';

let queue = Promise.resolve();
let picaInstance = null;
const getPica = () => {
  if (!picaInstance) picaInstance = Pica({ features: ['js', 'wasm', 'ww'] });
  return picaInstance;
};

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

/** Redimensiona `src` para dentro de `canvas` com a melhor qualidade disponível. */
async function drawResized(src, canvas, scaled) {
  const ctx = canvas.getContext('2d');
  if (scaled) {
    try {
      await getPica().resize(src, canvas, { filter: 'lanczos3' });
      // fotos com transparência (PNG) recebem fundo branco antes da conversão para JPEG
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      return 'lanczos3';
    } catch (err) {
      console.warn('[lab4] redução de alta qualidade indisponível, usando o canvas nativo', err);
    }
  }
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return scaled ? 'canvas' : 'original';
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
  const method = await drawResized(src, canvas, s < 1);
  src.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', PHOTO_JPEG_QUALITY));
  canvas.width = 0; // libera memória do canvas (relevante no iOS)
  canvas.height = 0;
  if (!blob) throw new Error('Falha ao comprimir a imagem');
  return { buf: await blob.arrayBuffer(), type: 'image/jpeg', w, h, method };
}

/** @returns {Promise<{buf:ArrayBuffer,type:string,w:number,h:number,method:string}>} */
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
