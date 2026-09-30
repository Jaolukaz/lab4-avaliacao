/**
 * Modelo de dados da avaliação. Funções puras, sem DOM:
 * usadas pelo formulário, pelo motor de layout do relatório e pelos testes em Node.
 */
import { BILATERAL, PHOTO_KEYS, AFUNDO_LABELS, STEP_LABELS, DEFAULT_LABELS } from './config.js';

export const SCHEMA_VERSION = 2;

export function todayISO(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

export function defaults() {
  return {
    v: SCHEMA_VERSION,
    id: { nome: '', nasc: '', peso: '', altura: '', objetivo: 'Performance', objetivoOutro: '', avaliador: '', dataAval: todayISO() },
    historico: [],
    perimetria: { coxa: { d: '', e: '' }, comprimento: { d: '', e: '' }, panturrilha: { d: '', e: '' }, obs: '' },
    tests: Object.fromEntries(BILATERAL.map((b) => [b.id, { d: '', e: '', status: '', obs: '' }])),
    agachamento: { otimo: false, quadril: false, joelho: false, obs: '' },
    afundo: { status: '', obs: '' },
    stepdown: { d: '', e: '', status: '', obs: '' },
    ajustes: [],
    captions: {},
  };
}

/** Mescla dados externos (rascunho antigo, arquivo importado) sobre o esquema atual, descartando tipos inválidos. */
function merge(base, src) {
  if (!src || typeof src !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (!(k in src)) continue;
    const bv = base[k];
    const sv = src[k];
    if (Array.isArray(bv)) base[k] = Array.isArray(sv) ? sv.filter((x) => typeof x === 'string') : bv;
    else if (bv && typeof bv === 'object') base[k] = merge(bv, sv);
    else if (typeof sv === typeof bv) base[k] = sv;
  }
  return base;
}

export function hydrate(raw) {
  const s = merge(defaults(), raw);
  s.v = SCHEMA_VERSION;
  s.captions = {};
  if (raw && raw.captions && typeof raw.captions === 'object') {
    for (const k of PHOTO_KEYS) if (typeof raw.captions[k] === 'string') s.captions[k] = raw.captions[k];
  }
  return s;
}

export function getPath(o, p) {
  return p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
}
export function setPath(o, p, v) {
  const ks = p.split('.');
  let a = o;
  for (const k of ks.slice(0, -1)) {
    if (a[k] == null || typeof a[k] !== 'object') a[k] = {};
    a = a[k];
  }
  a[ks[ks.length - 1]] = v;
}

/* ---------- números e datas ---------- */
export const num = (v) => {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
export const fmt = (n, d = 1) => (n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d }));
export const brDate = (iso) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export function ageAt(birth, ref) {
  if (!birth) return null;
  const b = new Date(`${birth}T00:00`);
  const r = new Date(`${ref || todayISO()}T00:00`);
  if (Number.isNaN(+b) || Number.isNaN(+r)) return null;
  let a = r.getFullYear() - b.getFullYear();
  const m = r.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && r.getDate() < b.getDate())) a -= 1;
  return a >= 0 && a < 120 ? a : null;
}

export function bmi(peso, alturaCm) {
  const p = num(peso);
  const h = num(alturaCm);
  if (!p || !h) return null;
  return p / (h / 100) ** 2;
}

export function unitFmt(v, unit) {
  const n = num(v);
  if (n == null) return '—';
  if (unit === '°') return `${fmt(n)}°`;
  return unit ? `${fmt(n)} ${unit}` : fmt(n);
}

export function heightFmt(alturaCm) {
  const h = num(alturaCm);
  return h ? `${(h / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m` : '—';
}

export function diffInfo(d, e, unit, pct = false) {
  const a = num(d);
  const b = num(e);
  if (a == null || b == null) return { text: '—', side: '' };
  const df = Math.abs(a - b);
  let text = unitFmt(df, unit);
  if (pct) {
    const m = Math.max(a, b);
    if (m > 0) text += ` (${fmt((df / m) * 100)}%)`;
  }
  const side = df === 0 ? 'simétrico' : a > b ? 'maior à direita' : 'maior à esquerda';
  return { text, side };
}

/* ---------- classificações ---------- */
export function agachStatus(s) {
  const a = s.agachamento;
  if (a.otimo) return ['ok', 'Padrão ótimo'];
  if (a.quadril || a.joelho) return ['bad', 'Padrão desajustado'];
  return ['', ''];
}

export function summaryItems(s) {
  const [as, al] = agachStatus(s);
  return [
    ['Agachamento bipodal', as, al],
    ['Padrão de afundo', s.afundo.status, AFUNDO_LABELS[s.afundo.status] || ''],
    ['Step-down', s.stepdown.status, STEP_LABELS[s.stepdown.status] || ''],
    ...BILATERAL.map((b) => [b.short, s.tests[b.id].status, (b.labels || DEFAULT_LABELS)[s.tests[b.id].status] || '']),
  ];
}

export const objetivoText = (id) => (id.objetivo === 'Outro' ? id.objetivoOutro.trim() || 'Outro' : id.objetivo);

export const slug = (s) =>
  String(s || 'atleta').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'atleta';

export const pdfFileName = (s) => `Avaliacao-Funcional-LAB4_${slug(s.id.nome)}_${s.id.dataAval || todayISO()}.pdf`;
