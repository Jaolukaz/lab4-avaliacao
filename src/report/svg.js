/**
 * Renderizador SVG da lista de desenho, usado na pré-visualização A4.
 * Usa exatamente as mesmas coordenadas e quebras de linha do PDF.
 */
import { PT } from './text.js';

const FONT = {
  b400: ['Barlow', 400], b600: ['Barlow', 600], b700: ['Barlow', 700],
  c700: ['Barlow Condensed', 700], c800: ['Barlow Condensed', 800],
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const n = (v) => +v.toFixed(3);

/**
 * @param {{n:number, items:Array, overflow:boolean}} pg
 * @param {(ref:string)=>string|null} urlFor URL de exibição para logos e fotos
 */
export function pageToSvg(pg, urlFor) {
  const out = [];
  for (const it of pg.items) {
    switch (it.t) {
      case 'rect': {
        const r = it.r ? ` rx="${n(it.r)}"` : '';
        const st = it.stroke ? ` stroke="${it.stroke}" stroke-width="${n(it.sw || 0.3)}"` : '';
        out.push(`<rect x="${n(it.x)}" y="${n(it.y)}" width="${n(it.w)}" height="${n(it.h)}"${r} fill="${it.fill || 'none'}"${st}/>`);
        break;
      }
      case 'circle':
        out.push(`<circle cx="${n(it.cx)}" cy="${n(it.cy)}" r="${n(it.r)}" fill="${it.fill}"/>`);
        break;
      case 'path':
        out.push(`<path d="${it.d}" fill="${it.fill || 'none'}"${it.stroke ? ` stroke="${it.stroke}" stroke-width="${n(it.sw)}"` : ''}${it.cap ? ` stroke-linecap="${it.cap}"` : ''}/>`);
        break;
      case 'text': {
        const [fam, wt] = FONT[it.f];
        const size = it.size * PT;
        const anchor = it.anchor === 'start' ? '' : ` text-anchor="${it.anchor}"`;
        const ls = it.ls ? ` letter-spacing="${n(it.ls * size)}"` : '';
        out.push(`<text x="${n(it.x)}" y="${n(it.y)}" font-family="${fam}" font-weight="${wt}" font-size="${n(size)}" fill="${it.color}"${anchor}${ls}>${esc(it.s)}</text>`);
        break;
      }
      case 'image': {
        const url = urlFor(it.ref);
        if (!url) break;
        const par = it.fit === 'cover' ? (it.align === 'top' ? 'xMidYMin slice' : 'xMidYMid slice') : 'xMidYMid meet';
        out.push(`<image href="${esc(url)}" x="${n(it.x)}" y="${n(it.y)}" width="${n(it.w)}" height="${n(it.h)}" preserveAspectRatio="${par}"/>`);
        break;
      }
      default:
        break;
    }
  }
  return `<svg class="pg-svg${pg.overflow ? ' overflow' : ''}" viewBox="0 0 210 297" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Página ${pg.n}"><rect width="210" height="297" fill="#fff"/>${out.join('')}</svg>`;
}
