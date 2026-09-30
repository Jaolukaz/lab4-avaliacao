/**
 * Ponte entre a interface e o motor de relatório.
 * O pdf-lib é carregado sob demanda (import dinâmico), para que o formulário abra rápido
 * mesmo em celulares modestos; o motor fica pronto em segundo plano logo após a abertura.
 */
import { layoutReport } from './layout.js';
import { pageToSvg } from './svg.js';
import { pdfFileName } from '../core/model.js';
import b400 from '../assets/fonts/Barlow-400.ttf?url';
import b600 from '../assets/fonts/Barlow-600.ttf?url';
import b700 from '../assets/fonts/Barlow-700.ttf?url';
import c700 from '../assets/fonts/BarlowCondensed-700.ttf?url';
import c800 from '../assets/fonts/BarlowCondensed-800.ttf?url';
import logoBlack from '../assets/logo-black.png?url';
import logoWhite from '../assets/logo-white.png?url';

export const LOGO_URLS = { 'logo-black': logoBlack, 'logo-white': logoWhite };
const FONT_URLS = { b400, b600, b700, c700, c800 };

const bytesOf = async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer());

let enginePromise;
/** Carrega fontes, logos e o módulo de PDF uma única vez. */
export function getEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const [pdf, fontList, logoList] = await Promise.all([
        import('./pdf.js'),
        Promise.all(Object.entries(FONT_URLS).map(async ([k, u]) => [k, await bytesOf(u)])),
        Promise.all(Object.entries(LOGO_URLS).map(async ([k, u]) => [k, { type: 'png', bytes: await bytesOf(u) }])),
      ]);
      const fonts = Object.fromEntries(fontList);
      const measure = await pdf.createMeasurer(fonts);
      return { pdf, fonts, logos: Object.fromEntries(logoList), measure };
    })();
    enginePromise.catch(() => { enginePromise = null; });
  }
  return enginePromise;
}

export async function computeLayout(state, photos) {
  const e = await getEngine();
  const flags = Object.fromEntries(Object.keys(photos).map((k) => [k, true]));
  return layoutReport(state, { measure: e.measure, photos: flags });
}

export function layoutToSvg(layout, urlFor) {
  return layout.pages.map((pg) => pageToSvg(pg, urlFor));
}

/**
 * @param {object} state
 * @param {Record<string,{buf:ArrayBuffer,type:string}>} photos
 * @returns {Promise<{file: File, layout: object}>}
 */
export async function buildPdf(state, photos) {
  const e = await getEngine();
  const layout = await computeLayout(state, photos);
  const images = { ...e.logos };
  for (const [k, p] of Object.entries(photos)) {
    images[`photo:${k}`] = { type: /png/.test(p.type) ? 'png' : 'jpg', bytes: new Uint8Array(p.buf) };
  }
  const nome = state.id.nome.trim();
  const bytes = await e.pdf.renderPdf(layout.pages, {
    fonts: e.fonts,
    images,
    meta: { title: nome ? `Avaliação Funcional Lab-4 | ${nome}` : 'Avaliação Funcional Lab-4', author: state.id.avaliador.trim() || 'Lab-4 Performance' },
  });
  const name = pdfFileName(state);
  const file = new File([bytes], name, { type: 'application/pdf' });
  return { file, layout };
}
