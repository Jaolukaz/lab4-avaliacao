/**
 * Renderizador PDF vetorial.
 * Converte a lista de desenho do motor de layout em um PDF A4 com texto real (selecionável),
 * fontes Barlow embutidas em subconjunto e fotos JPEG embutidas sem recompressão.
 * Funciona no navegador e em Node (usado nos testes automatizados).
 */
import { PDFDocument, LineCapStyle, rgb, pushGraphicsState, popGraphicsState, setCharacterSpacing, moveTo, lineTo, closePath, clip, endPath } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { MM_TO_PT } from './text.js';

export const A4_PT = [595.2756, 841.8898];
export const FONT_KEYS = ['b400', 'b600', 'b700', 'c700', 'c800'];

const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/**
 * Cria um medidor de texto a partir dos bytes das fontes. O mesmo medidor é usado pelo
 * layout no navegador e nos testes, garantindo quebras de linha idênticas em todos os aparelhos.
 * @param {Record<string, ArrayBuffer|Uint8Array>} fontBytes
 * @returns {Promise<(s:string,f:string,size:number,ls?:number)=>number>} largura em mm
 */
export async function createMeasurer(fontBytes) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = {};
  for (const k of FONT_KEYS) fonts[k] = await doc.embedFont(fontBytes[k], { subset: false });
  const cache = new Map();
  return (s, f, size, ls = 0) => {
    const key = `${f}|${s}`;
    let w1 = cache.get(key);
    if (w1 === undefined) {
      w1 = fonts[f].widthOfTextAtSize(s, 1);
      if (cache.size > 5000) cache.clear();
      cache.set(key, w1);
    }
    const chars = [...s].length;
    return (w1 * size + (chars > 1 ? ls * size * (chars - 1) : 0)) / MM_TO_PT;
  };
}

function roundRectPath(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  return `M${x + rr} ${y}H${x + w - rr}A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}V${y + h - rr}A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}H${x + rr}A${rr} ${rr} 0 0 1 ${x} ${y + h - rr}V${y + rr}A${rr} ${rr} 0 0 1 ${x + rr} ${y}Z`;
}

/**
 * @param {Array<{n:number, items:Array}>} pages lista de desenho
 * @param {{fonts:Record<string,Uint8Array|ArrayBuffer>, images:Record<string,{bytes:Uint8Array|ArrayBuffer,type:'png'|'jpg'}>, meta?:object}} assets
 * @returns {Promise<Uint8Array>}
 */
export async function renderPdf(pages, assets) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const meta = assets.meta || {};
  doc.setTitle(meta.title || 'Avaliação Funcional Lab-4', { showInWindowTitleBar: true });
  doc.setAuthor(meta.author || 'Lab-4 Performance');
  doc.setSubject('Avaliação funcional');
  doc.setCreator('Lab-4 Avaliação Funcional');
  doc.setProducer('Lab-4 Avaliação Funcional (pdf-lib)');
  doc.setLanguage('pt-BR');
  doc.setCreationDate(meta.date || new Date());

  const fonts = {};
  for (const k of FONT_KEYS) fonts[k] = await doc.embedFont(assets.fonts[k], { subset: true });

  const embedded = new Map();
  const getImage = async (ref) => {
    if (embedded.has(ref)) return embedded.get(ref);
    const src = assets.images[ref];
    let img = null;
    if (src) img = src.type === 'png' ? await doc.embedPng(src.bytes) : await doc.embedJpg(src.bytes);
    embedded.set(ref, img);
    return img;
  };

  const [W, H] = A4_PT;
  const P = (mm) => mm * MM_TO_PT;

  for (const pg of pages) {
    const page = doc.addPage([W, H]);
    for (const it of pg.items) {
      switch (it.t) {
        case 'rect': {
          if (it.r) {
            page.drawSvgPath(roundRectPath(it.x, it.y, it.w, it.h, it.r), { x: 0, y: H, scale: MM_TO_PT, color: it.fill ? hex(it.fill) : undefined });
          } else {
            const opts = { x: P(it.x), y: H - P(it.y + it.h), width: P(it.w), height: P(it.h) };
            if (it.fill) opts.color = hex(it.fill);
            if (it.stroke) { opts.borderColor = hex(it.stroke); opts.borderWidth = P(it.sw || 0.3); }
            page.drawRectangle(opts);
          }
          break;
        }
        case 'circle':
          page.drawCircle({ x: P(it.cx), y: H - P(it.cy), size: P(it.r), color: hex(it.fill) });
          break;
        case 'path':
          page.drawSvgPath(it.d, {
            x: 0, y: H, scale: MM_TO_PT,
            color: it.fill ? hex(it.fill) : undefined,
            borderColor: it.stroke ? hex(it.stroke) : undefined,
            borderWidth: it.stroke ? it.sw : undefined,
            borderLineCap: it.cap === 'round' ? LineCapStyle.Round : undefined,
          });
          break;
        case 'text': {
          const font = fonts[it.f];
          const chars = [...it.s].length;
          const w = font.widthOfTextAtSize(it.s, it.size) + (it.ls && chars > 1 ? it.ls * it.size * (chars - 1) : 0);
          let x = P(it.x);
          if (it.anchor === 'end') x -= w;
          else if (it.anchor === 'middle') x -= w / 2;
          if (it.ls) page.pushOperators(pushGraphicsState(), setCharacterSpacing(it.ls * it.size));
          page.drawText(it.s, { x, y: H - P(it.y), size: it.size, font, color: hex(it.color) });
          if (it.ls) page.pushOperators(popGraphicsState());
          break;
        }
        case 'image': {
          const img = await getImage(it.ref);
          if (!img) break;
          const s = it.fit === 'cover' ? Math.max(it.w / img.width, it.h / img.height) : Math.min(it.w / img.width, it.h / img.height);
          const dw = img.width * s;
          const dh = img.height * s;
          const dx = it.x + (it.w - dw) / 2;
          const dy = it.fit === 'cover' && it.align === 'top' ? it.y : it.y + (it.h - dh) / 2;
          if (it.fit === 'cover') {
            page.pushOperators(pushGraphicsState(),
              moveTo(P(it.x), H - P(it.y)), lineTo(P(it.x + it.w), H - P(it.y)),
              lineTo(P(it.x + it.w), H - P(it.y + it.h)), lineTo(P(it.x), H - P(it.y + it.h)),
              closePath(), clip(), endPath());
          }
          page.drawImage(img, { x: P(dx), y: H - P(dy + dh), width: P(dw), height: P(dh) });
          if (it.fit === 'cover') page.pushOperators(popGraphicsState());
          break;
        }
        default:
          break;
      }
    }
  }
  return doc.save({ useObjectStreams: true });
}
