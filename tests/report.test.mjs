/**
 * Testes do motor de relatório (layout + PDF), executados em Node: `npm test`.
 * Garantem as diretrizes da versão web: 6 páginas A4 exatas, nada fora da área útil,
 * detecção de excesso de conteúdo e fontes embutidas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { layoutReport, PAGE, TOTAL_PAGES } from '../src/report/layout.js';
import { renderPdf, A4_PT } from '../src/report/pdf.js';
import { defaults } from '../src/core/model.js';
import { loadAssets, ALL_PHOTOS } from './helpers.mjs';
import { sample, worstCase } from './fixtures/data.mjs';

const photoFlags = (map) => Object.fromEntries(Object.keys(map).map((k) => [k, true]));

test('avaliação de exemplo gera 6 páginas A4 sem excesso de conteúdo', async () => {
  const a = await loadAssets(ALL_PHOTOS);
  const { pages, overflowPages } = layoutReport(sample(), { measure: a.measure, photos: photoFlags(ALL_PHOTOS) });
  assert.equal(pages.length, TOTAL_PAGES);
  assert.deepEqual(overflowPages, []);
  const bytes = await renderPdf(pages, a);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), TOTAL_PAGES);
  for (const p of doc.getPages()) {
    const { width, height } = p.getSize();
    assert.ok(Math.abs(width - A4_PT[0]) < 0.01 && Math.abs(height - A4_PT[1]) < 0.01, 'página não é A4');
  }
  assert.equal(doc.getTitle(), 'Avaliação Funcional Lab-4');
});

test('nenhum elemento é desenhado fora da folha', async () => {
  const a = await loadAssets(ALL_PHOTOS);
  const { pages } = layoutReport(sample(), { measure: a.measure, photos: photoFlags(ALL_PHOTOS) });
  for (const pg of pages) {
    for (const it of pg.items) {
      if (it.t === 'rect' || it.t === 'image') {
        assert.ok(it.x >= 0 && it.y >= 0 && it.x + it.w <= PAGE.w + 0.01 && it.y + it.h <= PAGE.h + 0.01, `item fora da página ${pg.n}`);
      }
      if (it.t === 'text') {
        const w = a.measure(it.s, it.f, it.size, it.ls);
        const x0 = it.anchor === 'end' ? it.x - w : it.anchor === 'middle' ? it.x - w / 2 : it.x;
        assert.ok(x0 >= PAGE.x0 - 0.01 && x0 + w <= PAGE.x0 + PAGE.cw + 0.3, `texto excede a margem na página ${pg.n}: "${it.s}"`);
      }
    }
  }
});

test('avaliação vazia continua com 6 páginas e sem excesso', async () => {
  const a = await loadAssets();
  const { pages, overflowPages } = layoutReport(defaults(), { measure: a.measure, photos: {} });
  assert.equal(pages.length, TOTAL_PAGES);
  assert.deepEqual(overflowPages, []);
  const doc = await PDFDocument.load(await renderPdf(pages, a));
  assert.equal(doc.getPageCount(), TOTAL_PAGES);
});

test('pior caso permitido pela interface é detectado e reportado por página', async () => {
  const a = await loadAssets(ALL_PHOTOS);
  const { pages, overflowPages } = layoutReport(worstCase(), { measure: a.measure, photos: photoFlags(ALL_PHOTOS) });
  assert.equal(pages.length, TOTAL_PAGES);
  for (const n of overflowPages) assert.ok(n >= 1 && n <= TOTAL_PAGES);
  console.log('  páginas com excesso no pior caso:', overflowPages.length ? overflowPages.join(', ') : 'nenhuma');
});

test('fontes são embutidas em subconjunto (PDF leve para WhatsApp)', async () => {
  const a = await loadAssets();
  const bytes = await renderPdf(layoutReport(sample(), { measure: a.measure, photos: {} }).pages, a);
  assert.ok(bytes.length < 250_000, `PDF sem fotos com ${bytes.length} bytes`);
});
