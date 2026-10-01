/**
 * Motor de layout do relatório A4 (6 páginas).
 *
 * Recebe o estado da avaliação e devolve, para cada página, uma "lista de desenho":
 * retângulos, textos, imagens e caminhos em coordenadas de milímetro (origem no canto
 * superior esquerdo). A mesma lista é desenhada em SVG (pré-visualização) e em PDF,
 * de modo que a tela e o arquivo final são idênticos por construção.
 *
 * O módulo é puro (sem DOM). A medição de texto é injetada, o que permite rodar
 * os mesmos cálculos no navegador e nos testes em Node.
 */
import { AFUNDO_LABELS, AGACH_CHECKS, BIL, DEFAULT_LABELS, PERIMETRIA, STEP_LABELS } from '../core/config.js';
import { ageAt, agachStatus, bmi, brDate, diffInfo, heightFmt, objetivoText, summaryItems, unitFmt } from '../core/model.js';
import { PT, baseline, clean, ellipsize, lh, wrap } from './text.js';

export const TOTAL_PAGES = 6;
export const PAGE = { w: 210, h: 297, x0: 13, cw: 184, top: 32.4, bottom: 283, footLine: 285, footBase: 291 };
/** Largura útil (mm) de cada quadro de foto de evidência: dois quadros lado a lado, com moldura. */
export const PHOTO_BOX_W = (PAGE.cw - 5) / 2 - 3.6;

export const C = {
  black: '#000000', white: '#FFFFFF', ink: '#1E1E1E', text: '#2A2A2A', dim: '#4A4A4A', mid: '#555555',
  muted: '#666666', muted2: '#6A6A6A', faint: '#8A8A8A', ph: '#9A9A9A', neutral: '#BDBDBD',
  band: '#F0F0F0', line: '#DEDEDE', line2: '#E4E4E4', foot: '#CFCFCF', photoBg: '#F1F1F1',
};
export const STATUS = { ok: '#177A3A', warn: '#9A6206', bad: '#BF261B' };
const sc = (s) => STATUS[s] || null;
const UP = (s) => clean(s).toLocaleUpperCase('pt-BR');

const LBL = 7.3; // corpo dos rótulos pequenos
const LBL_H = lh(LBL);
const OBS = 9.5;

class Sheet {
  constructor(n) {
    this.n = n;
    this.items = [];
    this.overflow = false;
  }
  rect(x, y, w, h, fill, extra = {}) { this.items.push({ t: 'rect', x, y, w, h, fill, ...extra }); }
  hline(x, y, w, color, sw = 0.3) { this.rect(x, y, w, sw, color); }
  vline(x, y, h, color, sw = 0.3) { this.rect(x, y, sw, h, color); }
  text(x, y, s, f, size, color, extra = {}) { if (s !== '') this.items.push({ t: 'text', x, y, s, f, size, color, anchor: 'start', ls: 0, ...extra }); }
  image(ref, x, y, w, h, fit = 'contain', align = 'center') { this.items.push({ t: 'image', ref, x, y, w, h, fit, align }); }
  path(d, extra) { this.items.push({ t: 'path', d, ...extra }); }
  circle(cx, cy, r, fill) { this.items.push({ t: 'circle', cx, cy, r, fill }); }
}

/**
 * @param {object} s estado da avaliação
 * @param {{measure:Function, photos:Record<string,boolean>}} ctx
 * @returns {{pages:Array, overflowPages:number[]}}
 */
export function layoutReport(s, ctx) {
  const L = new Layout(s, ctx);
  const pages = [L.cover(), L.p2(), L.p3(), L.p4(), L.p5(), L.p6()];
  return { pages, overflowPages: pages.filter((p) => p.overflow).map((p) => p.n) };
}

class Layout {
  constructor(s, ctx) {
    this.s = s;
    this.m = ctx.measure;
    this.photos = ctx.photos || {};
  }

  /* ---------------- moldura ---------------- */
  footer(pg) {
    const { x0, cw, footLine, footBase } = PAGE;
    pg.hline(x0, footLine, cw, C.foot);
    pg.text(x0, footBase, 'Lab-4 Performance, Centro de Treinamento de Performance do Futebol', 'b400', 7.5, C.muted2);
    pg.text(x0 + cw, footBase, `Página ${pg.n} de ${TOTAL_PAGES}`, 'b400', 7.5, C.muted2, { anchor: 'end' });
  }

  header(pg) {
    const { x0, cw } = PAGE;
    pg.image('logo-black', x0, 11, 13, 13);
    pg.text(x0 + 16.5, 17.3, 'AVALIAÇÃO FUNCIONAL', 'c800', 15, C.black, { ls: 0.02 });
    const nome = clean(this.s.id.nome) || 'Atleta não identificado';
    pg.text(x0 + 16.5, 22.1, ellipsize(this.m, nome, 'b600', 9, 110), 'b600', 9, C.dim);
    pg.text(x0 + cw, 16.6, 'Lab-4 Performance', 'b400', 8.5, C.mid, { anchor: 'end' });
    pg.text(x0 + cw, 20.8, `Avaliação em ${brDate(this.s.id.dataAval)}`, 'b400', 8.5, C.mid, { anchor: 'end' });
    pg.rect(x0, 26.6, cw, 0.7, C.black);
  }

  page(n) {
    const pg = new Sheet(n);
    if (n > 1) this.header(pg);
    this.footer(pg);
    return pg;
  }

  finish(pg, y, limit = PAGE.bottom) {
    pg.overflow = y > limit + 0.05;
    return pg;
  }

  /** Laterais e base de um bloco, na cor de borda suave. */
  frame(pg, x, y, w, h, color = C.line) {
    pg.vline(x, y, h, color);
    pg.vline(x + w - 0.3, y, h, color);
    pg.hline(x, y + h - 0.3, w, color);
  }

  /* ---------------- componentes ---------------- */
  bar(pg, y, title, status = '', label = '') {
    const { x0, cw } = PAGE;
    pg.rect(x0, y, cw, 10, C.black);
    pg.image('logo-white', x0 + 1.4, y + 1.2, 7.6, 7.6);
    pg.text(x0 + 12, baseline(y, 13, 10 / (13 * PT)), UP(title), 'c800', 13, C.white, { ls: 0.04 });
    if (status && label) {
      const tw = this.m(label, 'b700', 8);
      const bw = 2.8 + 2 + 1.6 + tw + 2.8;
      const bx = x0 + cw - 3 - bw;
      pg.rect(bx, y + 2.4, bw, 5.2, C.white, { r: 2.6 });
      pg.circle(bx + 3.8, y + 5, 1, sc(status));
      pg.text(bx + 6.4, baseline(y + 2.4, 8, 5.2 / (8 * PT)), label, 'b700', 8, sc(status));
    }
    return y + 10;
  }

  /** Bloco de observação em largura total (agachamento, afundo). */
  obsWide(pg, y, label, text, status) {
    const { x0, cw } = PAGE;
    const tw = cw - 1.3 - 8;
    const body = clean(text).length ? wrap(this.m, text, 'b600', OBS, tw) : null;
    const n = body ? body.length : 1;
    const H = 2.8 + LBL_H + 0.8 + n * lh(OBS) + 2.8;
    pg.rect(x0, y, cw, H, C.band);
    pg.rect(x0, y, 1.3, H, sc(status) || C.neutral);
    this.obsText(pg, x0 + 5.3, y + 2.8, label, body, status);
    return y + H;
  }

  obsText(pg, x, top, label, lines, status) {
    pg.text(x, baseline(top, LBL), label, 'b600', LBL, C.muted);
    let t = top + LBL_H + 0.8;
    if (!lines) {
      pg.text(x, baseline(t, OBS), 'Sem observações.', 'b400', OBS, C.faint);
      return;
    }
    for (const ln of lines) {
      pg.text(x, baseline(t, OBS), ln, 'b600', OBS, sc(status) || C.text);
      t += lh(OBS);
    }
  }

  /** Teste bilateral: Direita | Esquerda | Assimetria | Observações. */
  bilateral(pg, y, b) {
    const { x0, cw } = PAGE;
    const t = this.s.tests[b.id];
    const labels = b.labels || DEFAULT_LABELS;
    y = this.bar(pg, y, b.title, t.status, labels[t.status]);
    const cols = [0, 25, 50];
    const obsX = x0 + 77;
    const obsW = cw - 77;
    const body = clean(t.obs).length ? wrap(this.m, t.obs, 'b600', OBS, obsW - 1.3 - 8) : null;
    const obsH = 2.6 + LBL_H + 0.8 + (body ? body.length : 1) * lh(OBS) + 2.6;
    const valH = 2.6 + LBL_H + 0.8 + lh(19, 1.05) + lh(LBL) + 2.2;
    const H = Math.max(obsH, valH);

    pg.rect(x0, y, 77, H, C.band);
    pg.vline(x0 + 25, y, H, C.white);
    pg.vline(x0 + 50, y, H, C.white);
    pg.rect(obsX, y, obsW, H, C.white);
    pg.rect(obsX, y, 1.3, H, sc(t.status) || C.neutral);
    this.frame(pg, x0, y, cw, H);

    const info = diffInfo(t.d, t.e, b.unit);
    const unitNote = b.scoreLabel || '';
    const cells = [
      ['Direita', unitFmt(t.d, b.unit), unitNote],
      ['Esquerda', unitFmt(t.e, b.unit), unitNote],
      ['Assimetria', info.text, info.side],
    ];
    cells.forEach(([lab, val, small], i) => {
      const cx = x0 + cols[i] + 3;
      let top = y + 2.6;
      pg.text(cx, baseline(top, LBL), lab, 'b600', LBL, C.muted);
      top += LBL_H + 0.8;
      pg.text(cx, baseline(top, 19, 1.05), val, 'c700', 19, C.ink);
      top += lh(19, 1.05);
      pg.text(cx, baseline(top, LBL), small, 'b400', LBL, C.muted);
    });
    this.obsText(pg, obsX + 5.3, y + 2.6, 'Observações', body, t.status);
    return y + H;
  }

  photoPair(pg, y, keys, hMax) {
    const { x0, cw } = PAGE;
    const fw = (cw - 5) / 2;
    const room = PAGE.bottom - y - 9;
    const h = Math.max(60, Math.min(hMax, room));
    keys.forEach((k, i) => {
      const fx = x0 + i * (fw + 5);
      pg.rect(fx, y, fw, h + 9, C.white, { stroke: C.black, sw: 0.35 });
      const bx = fx + 1.8;
      const by = y + 1.8;
      const bw = PHOTO_BOX_W;
      pg.rect(bx, by, bw, h, C.photoBg);
      if (this.photos[k]) pg.image(`photo:${k}`, bx, by, bw, h, 'contain');
      else pg.text(bx + bw / 2, by + h / 2 + 1, 'Foto não anexada', 'b400', 8.5, C.ph, { anchor: 'middle' });
      const cap = clean(this.s.captions[k]);
      if (cap) pg.text(bx + bw / 2, baseline(by + h + 1.2, 8, 4.5 / (8 * PT)), ellipsize(this.m, cap, 'b600', 8, bw - 2), 'b600', 8, C.dim, { anchor: 'middle' });
    });
    return y + h + 9;
  }

  list(pg, y, items, empty) {
    const { x0, cw } = PAGE;
    const f = items.map(clean).filter(Boolean);
    const compact = f.length > 5;
    const pad = compact ? 1.5 : 2.3;
    const size = compact ? 9 : OBS;
    const factor = compact ? 1.3 : 1.35;
    const start = y;
    if (!f.length) {
      const H = pad * 2 + lh(size, factor);
      pg.rect(x0, y, cw, H, C.band);
      pg.text(x0 + 4, baseline(y + pad, size, factor), empty, 'b400', size, C.faint);
      y += H;
    } else {
      f.forEach((item, i) => {
        const lines = wrap(this.m, item, 'b600', size, cw - 13);
        const H = pad * 2 + lines.length * lh(size, factor);
        if (i % 2 === 0) pg.rect(x0, y, cw, H, C.band);
        const tt = y + pad + lh(size, factor) / 2 - 1.2;
        pg.path(`M${x0 + 4} ${tt}L${x0 + 6.2} ${tt + 1.2}L${x0 + 4} ${tt + 2.4}Z`, { fill: C.black });
        lines.forEach((ln, j) => pg.text(x0 + 9, baseline(y + pad + j * lh(size, factor), size, factor), ln, 'b600', size, C.ink));
        y += H;
      });
    }
    this.frame(pg, x0, start, cw, y - start);
    return y;
  }

  /* ---------------- página 1: capa ---------------- */
  cover() {
    const pg = this.page(1);
    const { x0, cw } = PAGE;
    const s = this.s;
    const id = s.id;

    pg.image('logo-black', x0, 11, 28, 28);
    pg.text(x0 + 33, 21.4, 'AVALIAÇÃO', 'c800', 29, C.black, { ls: 0.005 });
    pg.text(x0 + 33, 30.9, 'FUNCIONAL LAB-4', 'c800', 29, C.black, { ls: 0.005 });
    pg.text(x0 + 33, 36.6, 'Centro de Treinamento de Performance do Futebol', 'b600', 9, C.mid);
    // Traços diagonais (marca gráfica do documento original)
    const hx = x0 + cw - 36;
    const hy = 9;
    const k = 0.36;
    [[14, 66, 42, 5, 7], [29, 68, 58, 3, 8.5], [45, 67, 73, 9, 7], [61, 66, 86, 15, 5.5], [76, 63, 95, 27, 4]].forEach(([a, b, c, d, w]) =>
      pg.path(`M${hx + a * k} ${hy + b * k}L${hx + c * k} ${hy + d * k}`, { stroke: C.black, sw: w * k, cap: 'round' }));
    // Pincelada
    const by = 40.4;
    const pts = [[0, 0.6], [0.012, 0.12], [0.22, 0], [0.48, 0.28], [0.76, 0.04], [1, 0], [0.992, 0.78], [0.64, 1], [0.3, 0.82], [0.01, 1]];
    pg.path(`${pts.map(([px, py], i) => `${i ? 'L' : 'M'}${(x0 + px * cw).toFixed(2)} ${(by + py * 2.6).toFixed(2)}`).join('')}Z`, { fill: C.black });

    // Bloco do atleta
    let y = 48;
    const leftW = cw - 6 - 42;
    pg.text(x0, baseline(y, LBL), 'Atleta', 'b600', LBL, C.muted);
    let ty = y + LBL_H + 0.6;
    const nameLines = wrap(this.m, UP(id.nome) || 'NOME NÃO INFORMADO', 'c800', 22, leftW).slice(0, 2);
    nameLines.forEach((ln) => {
      pg.text(x0, baseline(ty, 22, 1.02), ln, 'c800', 22, C.ink);
      ty += lh(22, 1.02);
    });
    ty += 3.2;
    const age = ageAt(id.nasc, id.dataAval);
    const imc = bmi(id.peso, id.altura);
    const cells = [
      ['Data de nascimento', brDate(id.nasc), age != null ? `(${age} anos)` : ''],
      ['Peso', unitFmt(id.peso, 'kg'), ''],
      ['Altura', heightFmt(id.altura), ''],
      ['IMC', imc ? `${imc.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg/m²` : '—', ''],
      ['Data da avaliação', brDate(id.dataAval), ''],
      ['Avaliador', clean(id.avaliador) || '—', ''],
    ];
    const cellW = leftW / 3;
    const cellH = 2.4 + LBL_H + 0.6 + lh(10.5, 1.3) + 2.4;
    pg.rect(x0, ty, leftW, cellH * 2, C.band);
    pg.vline(x0 + cellW, ty, cellH * 2, C.white, 0.4);
    pg.vline(x0 + cellW * 2, ty, cellH * 2, C.white, 0.4);
    pg.hline(x0, ty + cellH, leftW, C.white, 0.4);
    cells.forEach(([dt, dd, small], i) => {
      const cx = x0 + (i % 3) * cellW + 3;
      const cy = ty + Math.floor(i / 3) * cellH + 2.4;
      pg.text(cx, baseline(cy, LBL), dt, 'b600', LBL, C.muted);
      const vy = baseline(cy + LBL_H + 0.6, 10.5, 1.3);
      const val = ellipsize(this.m, dd, 'b700', 10.5, cellW - 6);
      pg.text(cx, vy, val, 'b700', 10.5, C.ink);
      if (small) pg.text(cx + this.m(val, 'b700', 10.5) + 1.2, vy, small, 'b400', 8.5, C.mid);
    });
    ty += cellH * 2 + 3.5;
    const goalH = 6.2;
    pg.text(x0, baseline(ty, 8.5, goalH / (8.5 * PT)), 'Objetivo', 'b600', 8.5, C.mid);
    const gx = x0 + this.m('Objetivo', 'b600', 8.5) + 3;
    const goal = ellipsize(this.m, UP(objetivoText(id)), 'c700', 12, leftW - 30, 0.04);
    const gw = this.m(goal, 'c700', 12, 0.04) + 6;
    pg.rect(gx, ty, gw, goalH, C.black);
    pg.text(gx + 3, baseline(ty, 12, goalH / (12 * PT)), goal, 'c700', 12, C.white, { ls: 0.04 });
    ty += goalH;

    const px = x0 + cw - 42;
    pg.rect(px, y, 42, 55, '#F0F0F0', { stroke: C.black, sw: 0.6 });
    if (this.photos.atleta) pg.image('photo:atleta', px + 0.3, y + 0.3, 41.4, 54.4, 'cover', 'top');
    else {
      const ini = (clean(id.nome).split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('') || 'L4').toLocaleUpperCase('pt-BR');
      pg.text(px + 21, y + 27.5 + 3.2, ini, 'c800', 26, C.neutral, { anchor: 'middle' });
    }
    y = Math.max(ty, y + 55) + 5;

    // Síntese
    y = this.bar(pg, y, 'Síntese dos resultados');
    const items = summaryItems(s);
    const rowH = 7.6;
    const colW = cw / 2;
    const top = y;
    items.forEach(([name, st, label], i) => {
      const cx = x0 + (i % 2) * colW;
      const cy = top + Math.floor(i / 2) * rowH;
      const color = sc(st);
      pg.circle(cx + 4.9, cy + rowH / 2, 1.4, color || '#C8C8C8');
      const bl = baseline(cy, OBS, rowH / (OBS * PT));
      pg.text(cx + 8.7, bl, name, 'b600', OBS, C.ink);
      pg.text(cx + colW - 3.5, bl, st ? label : 'Não classificado', 'b700', 8.3, color || C.faint, { anchor: 'end' });
    });
    const rows = Math.ceil(items.length / 2);
    for (let r = 1; r < rows; r += 1) pg.hline(x0, top + r * rowH, cw, C.line2);
    pg.vline(x0 + colW, top, rows * rowH, C.line2);
    this.frame(pg, x0, top, cw, rows * rowH);
    y = top + rows * rowH + 5;

    // História pregressa
    y = this.bar(pg, y, 'História pregressa');
    y = this.list(pg, y, s.historico, 'Nenhum registro informado.');
    return this.finish(pg, y);
  }

  /* ---------------- página 2: perimetria + agachamento ---------------- */
  p2() {
    const pg = this.page(2);
    const { x0, cw } = PAGE;
    const P = this.s.perimetria;
    let y = this.bar(pg, PAGE.top, 'Perimetria');
    const colX = [x0, x0 + 58, x0 + 100, x0 + 142];
    const colW = [58, 42, 42, 42];
    const headH = 7.5;
    const top = y;
    ['Medida', 'Direita', 'Esquerda', 'Assimetria'].forEach((h, i) => {
      const bl = baseline(y, 7.8, headH / (7.8 * PT));
      if (i === 0) pg.text(colX[0] + 3, bl, h, 'b700', 7.8, '#444444');
      else pg.text(colX[i] + colW[i] / 2, bl, h, 'b700', 7.8, '#444444', { anchor: 'middle' });
    });
    y += headH;
    PERIMETRIA.forEach((p, i) => {
      const rowH = 10;
      if (i % 2 === 0) pg.rect(x0, y, cw, rowH, C.band);
      pg.text(colX[0] + 3, baseline(y, 9, rowH / (9 * PT)), UP(p.label), 'b700', 9, C.ink, { ls: 0.02 });
      const v = P[p.id];
      [unitFmt(v.d, 'cm'), unitFmt(v.e, 'cm')].forEach((val, j) =>
        pg.text(colX[j + 1] + colW[j + 1] / 2, baseline(y, 10.5, rowH / (10.5 * PT)), val, 'b600', 10.5, C.ink, { anchor: 'middle' }));
      const info = diffInfo(v.d, v.e, 'cm', true);
      const dc = colX[3] + colW[3] / 2;
      if (info.side) {
        pg.text(dc, y + 5, info.text, 'b600', 10.5, C.ink, { anchor: 'middle' });
        pg.text(dc, y + 8.2, info.side, 'b400', 7, C.muted2, { anchor: 'middle' });
      } else pg.text(dc, baseline(y, 10.5, rowH / (10.5 * PT)), info.text, 'b600', 10.5, C.ink, { anchor: 'middle' });
      y += rowH;
    });
    this.frame(pg, x0, top, cw, y - top);
    if (clean(P.obs)) {
      y += 2;
      wrap(this.m, P.obs, 'b400', 8.8, cw - 6).forEach((ln) => {
        pg.text(x0 + 3, baseline(y, 8.8), ln, 'b400', 8.8, '#333333');
        y += lh(8.8);
      });
    }
    y += 5;

    const a = this.s.agachamento;
    const [as, al] = agachStatus(this.s);
    y = this.bar(pg, y, 'Agachamento bipodal', as, al);
    const rowH = 10.5;
    let cx = x0 + 4;
    AGACH_CHECKS.forEach(([k2, label]) => {
      const bxy = y + (rowH - 4.4) / 2;
      pg.rect(cx, bxy, 4.4, 4.4, a[k2] ? C.black : C.white, { stroke: C.black, sw: 0.5 });
      if (a[k2]) pg.path(`M${cx + 1.2} ${bxy + 1.2}L${cx + 3.2} ${bxy + 3.2}M${cx + 3.2} ${bxy + 1.2}L${cx + 1.2} ${bxy + 3.2}`, { stroke: C.white, sw: 0.55, cap: 'round' });
      pg.text(cx + 6.4, baseline(y, OBS, rowH / (OBS * PT)), label, 'b700', OBS, C.ink);
      cx += 6.4 + this.m(label, 'b700', OBS) + 7;
    });
    this.frame(pg, x0, y, cw, rowH);
    y += rowH;
    y = this.obsWide(pg, y, 'Observações', a.obs, as);
    y += 5;
    y = this.photoPair(pg, y, ['agach1', 'agach2'], 118);
    return this.finish(pg, y);
  }

  /* ---------------- página 3: afundo ---------------- */
  p3() {
    const pg = this.page(3);
    const f = this.s.afundo;
    let y = this.bar(pg, PAGE.top, 'Padrão de afundo', f.status, AFUNDO_LABELS[f.status]);
    y = this.obsWide(pg, y, 'Observação técnica', f.obs, f.status);
    y += 5;
    y = this.photoPair(pg, y, ['afundo1', 'afundo2'], 172);
    return this.finish(pg, y);
  }

  /* ---------------- página 4: quatro testes bilaterais ---------------- */
  p4() {
    const pg = this.page(4);
    let y = PAGE.top;
    ['thomas', 'gluteo', 'isquios', 'rotadores'].forEach((id, i) => {
      if (i) y += 5;
      y = this.bilateral(pg, y, BIL[id]);
    });
    return this.finish(pg, y);
  }

  /* ---------------- página 5: step-down ---------------- */
  p5() {
    const pg = this.page(5);
    const { x0, cw } = PAGE;
    const s = this.s.stepdown;
    let y = this.bar(pg, PAGE.top, 'Step-down', s.status, STEP_LABELS[s.status]);
    const obsX = x0 + 68;
    const obsW = cw - 68;
    const body = clean(s.obs).length ? wrap(this.m, s.obs, 'b600', OBS, obsW - 1.3 - 8) : null;
    const vd = (v) => (v === 'aus' ? ['Ausência de V.D.', STATUS.ok] : v === 'pres' ? ['Presença de V.D.', STATUS.bad] : ['—', C.ink]);
    const vals = [['Direita', ...vd(s.d)], ['Esquerda', ...vd(s.e)]].map(([lab, txt, col]) => [lab, wrap(this.m, txt, 'c700', 12.5, 28), col]);
    const valH = 2.6 + LBL_H + 0.8 + Math.max(...vals.map((v) => v[1].length)) * lh(12.5, 1.15) + 2.6;
    const obsH = 2.6 + LBL_H + 0.8 + (body ? body.length : 1) * lh(OBS) + 2.6;
    const H = Math.max(valH, obsH);
    pg.rect(x0, y, 68, H, C.band);
    pg.vline(x0 + 34, y, H, C.white);
    pg.rect(obsX, y, obsW, H, C.white);
    pg.rect(obsX, y, 1.3, H, sc(s.status) || C.neutral);
    this.frame(pg, x0, y, cw, H);
    vals.forEach(([lab, lines, col], i) => {
      const cx = x0 + i * 34 + 3;
      let top = y + 2.6;
      pg.text(cx, baseline(top, LBL), lab, 'b600', LBL, C.muted);
      top += LBL_H + 0.8;
      lines.forEach((ln) => {
        pg.text(cx, baseline(top, 12.5, 1.15), ln, 'c700', 12.5, col);
        top += lh(12.5, 1.15);
      });
    });
    this.obsText(pg, obsX + 5.3, y + 2.6, 'Observação técnica', body, s.status);
    y += H;
    pg.text(x0, baseline(y + 0.6, LBL), 'V.D.: valgo dinâmico.', 'b400', LBL, C.muted2);
    y += 0.6 + LBL_H + 4;
    y = this.photoPair(pg, y, ['step1', 'step2'], 162);
    return this.finish(pg, y);
  }

  /* ---------------- página 6: tornozelo + ajustes + assinatura ---------------- */
  p6() {
    const pg = this.page(6);
    const { x0, cw } = PAGE;
    let y = this.bilateral(pg, PAGE.top, BIL.tornozelo);
    y += 5;
    y = this.bar(pg, y, 'Ajustes individuais');
    y = this.list(pg, y, this.s.ajustes, 'Nenhum ajuste registrado.');
    const signTop = PAGE.bottom - 13;
    const w1 = (cw - 12) * (1.4 / 2.4);
    const w2 = cw - 12 - w1;
    const id = this.s.id;
    [[x0, w1, clean(id.avaliador), 'Avaliador responsável'], [x0 + w1 + 12, w2, brDate(id.dataAval), 'Data da avaliação']].forEach(([x, w, val, lab]) => {
      pg.rect(x, signTop, w, 0.35, C.black);
      if (val) pg.text(x, signTop + 5.4, ellipsize(this.m, val, 'b700', 10, w), 'b700', 10, C.ink);
      pg.text(x, signTop + 9.6, lab, 'b400', 8, C.muted);
    });
    return this.finish(pg, y, signTop - 6);
  }
}
