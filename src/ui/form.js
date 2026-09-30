/**
 * Formulário de preenchimento: modelos de HTML, preenchimento a partir do estado,
 * indicadores derivados (idade, IMC, diferenças), listas dinâmicas, fotos e navegação.
 */
import {
  AFUNDO_LABELS, AGACH_CHECKS, AJUSTES_SUGG, BILATERAL, CAPTION_MAX, DEFAULT_LABELS, LIST_LIMIT, LIST_MAXLEN,
  NAV, OBJETIVOS, OBS_MAX, PERIMETRIA, PERI_OBS_MAX, PHOTO_KEYS, PHRASES, STEP_LABELS,
} from '../core/config.js';
import { ageAt, agachStatus, bmi, diffInfo, fmt, getPath } from '../core/model.js';
import { $, $$, ICON, esc } from './dom.js';
import { LOGO_URLS } from '../report/engine.js';

/* ---------------- modelos ---------------- */
const sheet = (id, title, body) => `
  <section class="sheet" id="s-${id}" aria-labelledby="h-${id}" data-sec="${id}">
    <header class="bar"><img class="bar-logo" src="${LOGO_URLS['logo-white']}" alt=""><h2 id="h-${id}">${title}</h2><span data-slot="${id}"></span></header>
    <div class="sheet-body">${body}</div>
  </section>`;

const fText = (path, label, { ph = '', cls = '', max = 120, hint = 'next' } = {}) =>
  `<label class="field ${cls}"><span class="field-l">${label}</span><input type="text" data-bind="${path}" maxlength="${max}" placeholder="${esc(ph)}" autocomplete="off" autocapitalize="words" enterkeyhint="${hint}"></label>`;

const fDate = (path, label, hintKey = '') =>
  `<label class="field"><span class="field-l">${label}</span><input type="date" data-bind="${path}">${hintKey ? `<span class="hint" data-hint="${hintKey}"></span>` : ''}</label>`;

const numInput = (path, unit, aria = '', step = '0.1') =>
  `<span class="inp-wrap"><input type="number" inputmode="decimal" step="${step}" min="0" enterkeyhint="next" data-bind="${path}"${aria ? ` aria-label="${esc(aria)}"` : ''}>${unit ? `<span class="unit">${unit}</span>` : ''}</span>`;

const fNum = (path, label, unit, { step = '0.1', hintKey = '' } = {}) =>
  `<label class="field"><span class="field-l">${label}</span>${numInput(path, unit, '', step)}${hintKey ? `<span class="hint" data-hint="${hintKey}"></span>` : ''}</label>`;

const fArea = (path, label = 'Observações', max = OBS_MAX, rows = 3) =>
  `<label class="field"><span class="field-l">${label}</span><textarea data-bind="${path}" maxlength="${max}" rows="${rows}" autocapitalize="sentences"></textarea><span class="count" data-count="${path}">0/${max}</span></label>`;

const statusChips = (path, labels, legend = 'Classificação') =>
  `<fieldset class="chipset"><legend class="field-l">${legend}</legend><div class="chips">${['ok', 'warn', 'bad']
    .map((s) => `<label class="chip st s-${s}"><input type="radio" name="${path}" value="${s}" data-bind="${path}" data-toggle><span>${labels[s]}</span></label>`)
    .join('')}</div></fieldset>`;

const phraseChips = (path, list) =>
  `<div class="phrases"><span class="field-l">Frases rápidas (inserem o texto nas observações)</span><div class="sugg">${list
    .map((p) => `<button type="button" class="sugg-b" data-phrase="${esc(p)}" data-target="${path}">${esc(p)}</button>`)
    .join('')}</div></div>`;

const photoSlot = (key, label, { required = false, capPh = '' } = {}) => `
  <div class="photo" data-photo="${key}">
    <span class="field-l">${label}${required ? '<em class="req">obrigatória</em>' : ''}</span>
    <input type="file" accept="image/*" data-src="gallery" hidden>
    <input type="file" accept="image/*" capture="environment" data-src="camera" hidden>
    <div class="photo-drop" role="button" tabindex="0" aria-label="Adicionar ${esc(label)}">
      ${ICON.cam}<b>Adicionar foto</b><small class="fine-only">Clique ou arraste uma imagem</small>
    </div>
    <div class="photo-src touch-only"><button type="button" class="btn btn-line" data-photo-act="camera">${ICON.cam}Câmera</button><button type="button" class="btn btn-line" data-photo-act="gallery">${ICON.gallery}Galeria</button></div>
    <img class="photo-img" alt="${esc(label)}">
    <div class="photo-actions"><button type="button" class="btn btn-line" data-photo-act="gallery">Trocar</button><button type="button" class="btn btn-line" data-photo-act="remove">Remover</button></div>
    ${capPh ? `<input type="text" class="cap" data-bind="captions.${key}" maxlength="${CAPTION_MAX}" placeholder="Legenda no PDF, ex.: ${esc(capPh)}" aria-label="Legenda da ${esc(label)}" enterkeyhint="done">` : ''}
  </div>`;

const listEditor = (name, ph, help) => `
  <p class="help">${help}</p>
  <ul class="list" id="list-${name}"></ul>
  <div class="add-row"><input type="text" id="add-${name}" maxlength="${LIST_MAXLEN}" placeholder="${esc(ph)}" aria-label="Novo item" autocapitalize="sentences" enterkeyhint="done"><button type="button" class="btn btn-dark" data-add="${name}">Adicionar</button></div>
  <div class="list-foot"><span class="hint fine-only">Enter também adiciona. Use as setas para ordenar.</span><span class="hint" id="lim-${name}"></span></div>`;

export function buildForm() {
  const bilateral = (b) => sheet(b.id, b.title, `
    <div class="bil">
      <label class="field"><span class="field-l">Direita${b.scoreLabel ? ` (${b.scoreLabel})` : ''}</span>${numInput(`tests.${b.id}.d`, b.unit)}</label>
      <div class="bil-mid" data-diff="${b.id}"><span>Assimetria</span><b>—</b><small></small></div>
      <label class="field"><span class="field-l">Esquerda${b.scoreLabel ? ` (${b.scoreLabel})` : ''}</span>${numInput(`tests.${b.id}.e`, b.unit)}</label>
    </div>
    ${statusChips(`tests.${b.id}.status`, b.labels || DEFAULT_LABELS)}
    ${fArea(`tests.${b.id}.obs`)}
    ${phraseChips(`tests.${b.id}.obs`, b.phrases)}`);

  const vdChips = (side) => `
    <fieldset class="chipset"><legend class="field-l">${side === 'd' ? 'Direita' : 'Esquerda'}</legend><div class="chips">
      <label class="chip st s-ok"><input type="radio" name="stepdown.${side}" value="aus" data-bind="stepdown.${side}" data-toggle><span>Ausência de V.D.</span></label>
      <label class="chip st s-bad"><input type="radio" name="stepdown.${side}" value="pres" data-bind="stepdown.${side}" data-toggle><span>Presença de V.D.</span></label>
    </div></fieldset>`;

  $('#form').innerHTML = `
  <h2 class="block-h" id="b-ident">Identificação e histórico</h2>
  ${sheet('ident', 'Identificação do atleta', `
    <div class="ident">
      <div class="grid2">
        ${fText('id.nome', 'Nome completo', { cls: 'span2', ph: 'Nome e sobrenome do atleta', max: 80 })}
        ${fDate('id.nasc', 'Data de nascimento', 'idade')}
        ${fDate('id.dataAval', 'Data da avaliação')}
        ${fNum('id.peso', 'Peso', 'kg')}
        ${fNum('id.altura', 'Altura', 'cm', { step: '1', hintKey: 'imc' })}
        ${fText('id.avaliador', 'Avaliador responsável', { cls: 'span2', ph: 'Nome do profissional', max: 60, hint: 'done' })}
        <fieldset class="chipset span2"><legend class="field-l">Objetivo</legend><div class="chips">${OBJETIVOS
          .map((o) => `<label class="chip"><input type="radio" name="id.objetivo" value="${o}" data-bind="id.objetivo"><span>${o}</span></label>`)
          .join('')}</div><input type="text" id="obj-outro" data-bind="id.objetivoOutro" maxlength="40" placeholder="Descreva o objetivo" aria-label="Outro objetivo" hidden></fieldset>
      </div>
      ${photoSlot('atleta', 'Foto do atleta')}
    </div>`)}
  ${sheet('historico', 'História pregressa', listEditor('historico', 'Ex.: Entorse de tornozelo direito (2024), sem exame de imagem',
    'Lesões, cirurgias, dores e episódios relevantes, um registro por linha, na ordem em que devem aparecer no relatório.'))}

  <h2 class="block-h">Avaliações bilaterais</h2>
  ${sheet('perimetria', 'Perimetria', `
    <div class="peri">
      <span class="peri-h"></span><span class="peri-h">Direita</span><span class="peri-h">Esquerda</span><span class="peri-h peri-hd">Assimetria</span>
      ${PERIMETRIA.map((p) => `
        <span class="peri-l">${p.label}</span>
        ${numInput(`perimetria.${p.id}.d`, 'cm', `${p.label}, direita`)}
        ${numInput(`perimetria.${p.id}.e`, 'cm', `${p.label}, esquerda`)}
        <span class="peri-d" data-diff="peri-${p.id}">—</span>`).join('')}
    </div>
    ${fArea('perimetria.obs', 'Observações (opcional)', PERI_OBS_MAX, 2)}`)}
  ${BILATERAL.map(bilateral).join('')}

  <h2 class="block-h">Testes qualitativos</h2>
  ${sheet('agachamento', 'Agachamento bipodal', `
    <fieldset class="chipset"><legend class="field-l">Resultado</legend><div class="chips">${AGACH_CHECKS
      .map(([k, l]) => `<label class="chip ck ${k === 'otimo' ? 's-ok' : 's-bad'}"><input type="checkbox" data-bind="agachamento.${k}"><span>${l}</span></label>`)
      .join('')}</div><span class="hint">Marcar "Padrão ótimo" desmarca as compensações, e vice-versa.</span></fieldset>
    ${fArea('agachamento.obs')}
    ${phraseChips('agachamento.obs', PHRASES.agachamento)}
    <div class="photos">
      ${photoSlot('agach1', 'Evidência 1', { required: true, capPh: 'vista lateral' })}
      ${photoSlot('agach2', 'Evidência 2', { required: true, capPh: 'vista frontal' })}
    </div>`)}
  ${sheet('afundo', 'Padrão de afundo', `
    ${statusChips('afundo.status', AFUNDO_LABELS)}
    ${fArea('afundo.obs', 'Observação técnica')}
    ${phraseChips('afundo.obs', PHRASES.afundo)}
    <div class="photos">
      ${photoSlot('afundo1', 'Evidência 1', { capPh: 'perna direita à frente' })}
      ${photoSlot('afundo2', 'Evidência 2', { capPh: 'perna esquerda à frente' })}
    </div>`)}
  ${sheet('stepdown', 'Step-down', `
    <p class="help">V.D. significa valgo dinâmico.</p>
    <div class="bil vd">${vdChips('d')}${vdChips('e')}</div>
    ${statusChips('stepdown.status', STEP_LABELS, 'Estabilidade geral')}
    ${fArea('stepdown.obs', 'Observação técnica')}
    ${phraseChips('stepdown.obs', PHRASES.stepdown)}
    <div class="photos">
      ${photoSlot('step1', 'Evidência 1', { capPh: 'apoio direito' })}
      ${photoSlot('step2', 'Evidência 2', { capPh: 'apoio esquerdo' })}
    </div>`)}

  <h2 class="block-h">Conclusão</h2>
  ${sheet('ajustes', 'Ajustes individuais', `
    ${listEditor('ajustes', 'Escreva uma recomendação de treinamento', 'Recomendações personalizadas que ligam os achados desta avaliação à prescrição do treinamento.')}
    <div class="phrases"><span class="field-l">Sugestões frequentes</span><div class="sugg" id="sugg-ajustes"></div></div>`)}
  `;

  $('#side').innerHTML = `
    <p class="side-prog" id="prog"></p><div class="side-bar"><i id="prog-bar"></i></div>
    ${NAV.map(([g, items]) => `<h4>${g}</h4><ul>${items.map(([id, l]) => `<li><a href="#s-${id}" data-nav="${id}"><span class="dot" data-dot="${id}"></span>${l}</a></li>`).join('')}</ul>`).join('')}`;

  $('#strip').innerHTML = NAV.flatMap(([, items]) => items)
    .map(([id, l]) => `<a href="#s-${id}" data-nav="${id}"><span class="dot" data-dot="${id}"></span>${l}</a>`)
    .join('');
}

/* ---------------- sincronização ---------------- */
export function populate(app) {
  const { state } = app;
  $$('[data-bind]', $('#form')).forEach((el) => {
    const v = getPath(state, el.dataset.bind);
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'radio') el.checked = v === el.value;
    else el.value = v ?? '';
  });
  renderList(app, 'historico');
  renderList(app, 'ajustes');
  PHOTO_KEYS.forEach((k) => renderPhoto(app, k));
  toggleOutro(state);
  updateDerived(app);
}

export function toggleOutro(state) { $('#obj-outro').hidden = state.id.objetivo !== 'Outro'; }

export function syncAgach(state, path) {
  const a = state.agachamento;
  if (path === 'agachamento.otimo' && a.otimo) { a.quadril = false; a.joelho = false; }
  if ((path === 'agachamento.quadril' || path === 'agachamento.joelho') && (a.quadril || a.joelho)) a.otimo = false;
  AGACH_CHECKS.forEach(([k]) => { $(`[data-bind="agachamento.${k}"]`).checked = !!a[k]; });
}

const pill = (status, label) => (status ? `<span class="badge pill s-${status}">${esc(label)}</span>` : '');

export function updateDerived(app) {
  const s = app.state;
  const age = ageAt(s.id.nasc, s.id.dataAval);
  $('[data-hint="idade"]').textContent = age != null ? `${age} anos na data da avaliação` : '';
  const imc = bmi(s.id.peso, s.id.altura);
  $('[data-hint="imc"]').textContent = imc ? `IMC ${fmt(imc)} kg/m²` : '';

  PERIMETRIA.forEach((p) => {
    const v = s.perimetria[p.id];
    const info = diffInfo(v.d, v.e, 'cm', true);
    $(`[data-diff="peri-${p.id}"]`).innerHTML = `${esc(info.text)}<small>${info.side}</small>`;
  });
  BILATERAL.forEach((b) => {
    const t = s.tests[b.id];
    const info = diffInfo(t.d, t.e, b.unit);
    const box = $(`[data-diff="${b.id}"]`);
    $('b', box).textContent = info.text;
    $('small', box).textContent = info.side;
    $(`[data-slot="${b.id}"]`).innerHTML = pill(t.status, (b.labels || DEFAULT_LABELS)[t.status]);
  });
  const [as, al] = agachStatus(s);
  $('[data-slot="agachamento"]').innerHTML = pill(as, al);
  $('[data-slot="afundo"]').innerHTML = pill(s.afundo.status, AFUNDO_LABELS[s.afundo.status]);
  $('[data-slot="stepdown"]').innerHTML = pill(s.stepdown.status, STEP_LABELS[s.stepdown.status]);

  $$('[data-count]').forEach((c) => {
    const ta = c.previousElementSibling;
    const max = +ta.maxLength;
    const n = ta.value.length;
    c.textContent = `${n}/${max}`;
    c.classList.toggle('near', n > max * 0.85);
  });
  updateNav(app);
}

function sectionScore(app, id) {
  const { state: s, photos } = app;
  const has = (v) => String(v ?? '').trim() !== '';
  const nPh = (keys) => keys.filter((k) => photos[k]).length;
  switch (id) {
    case 'ident': { const n = [s.id.nome, s.id.nasc, s.id.peso, s.id.altura].filter(has).length; return n === 4 ? 2 : n ? 1 : 0; }
    case 'historico': return s.historico.some(has) ? 2 : 0;
    case 'ajustes': return s.ajustes.some(has) ? 2 : 0;
    case 'perimetria': { const n = PERIMETRIA.reduce((a, p) => a + has(s.perimetria[p.id].d) + has(s.perimetria[p.id].e), 0); return n === 6 ? 2 : n ? 1 : 0; }
    case 'agachamento': { const a = s.agachamento; const c = a.otimo || a.quadril || a.joelho; const p = nPh(['agach1', 'agach2']); return c && p === 2 ? 2 : c || p || has(a.obs) ? 1 : 0; }
    case 'afundo': { const p = nPh(['afundo1', 'afundo2']); return has(s.afundo.status) && p === 2 ? 2 : has(s.afundo.status) || p || has(s.afundo.obs) ? 1 : 0; }
    case 'stepdown': { const t = s.stepdown; const p = nPh(['step1', 'step2']); return has(t.d) && has(t.e) && has(t.status) && p === 2 ? 2 : has(t.d) || has(t.e) || has(t.status) || has(t.obs) || p ? 1 : 0; }
    default: { const t = s.tests[id]; if (!t) return 0; return has(t.d) && has(t.e) && has(t.status) ? 2 : has(t.d) || has(t.e) || has(t.status) || has(t.obs) ? 1 : 0; }
  }
}

export function updateNav(app) {
  const ids = NAV.flatMap(([, it]) => it.map(([id]) => id));
  let done = 0;
  ids.forEach((id) => {
    const sc = sectionScore(app, id);
    if (sc === 2) done += 1;
    $$(`[data-dot="${id}"]`).forEach((d) => { d.className = `dot${sc ? ` p${sc}` : ''}`; });
  });
  $('#prog').textContent = `${done} de ${ids.length} seções completas`;
  $('#prog-bar').style.width = `${(done / ids.length) * 100}%`;
}

/* ---------------- listas ---------------- */
export function renderList(app, name) {
  const ul = $(`#list-${name}`);
  const items = app.state[name];
  const max = LIST_LIMIT[name];
  ul.innerHTML = !items.length
    ? `<li class="list-empty">${name === 'historico' ? 'Nenhum registro ainda. Adicione lesões, cirurgias ou queixas no campo abaixo.' : 'Nenhum ajuste ainda. Escreva no campo abaixo ou use uma sugestão.'}</li>`
    : items.map((t, i) => `<li class="li-row">
        <input type="text" value="${esc(t)}" maxlength="${LIST_MAXLEN}" data-list="${name}" data-idx="${i}" aria-label="Item ${i + 1}" autocapitalize="sentences">
        <button type="button" class="icon-btn" data-list-act="up" data-list="${name}" data-idx="${i}" aria-label="Mover para cima" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
        <button type="button" class="icon-btn" data-list-act="down" data-list="${name}" data-idx="${i}" aria-label="Mover para baixo" ${i === items.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
        <button type="button" class="icon-btn" data-list-act="del" data-list="${name}" data-idx="${i}" aria-label="Remover item">${ICON.x}</button>
      </li>`).join('');
  const full = items.length >= max;
  $(`#add-${name}`).disabled = full;
  $(`[data-add="${name}"]`).disabled = full;
  $(`#lim-${name}`).textContent = full ? `Limite de ${max} itens atingido` : `${items.length} de ${max} itens`;
  if (name === 'ajustes') {
    const have = new Set(items.map((s) => s.trim().toLowerCase()));
    const avail = AJUSTES_SUGG.filter((s) => !have.has(s.toLowerCase()));
    $('#sugg-ajustes').innerHTML = avail.length
      ? avail.map((s) => `<button type="button" class="sugg-b" data-sugg="${esc(s)}" ${full ? 'disabled' : ''}>${esc(s)}</button>`).join('')
      : '<span class="hint">Todas as sugestões já foram adicionadas.</span>';
  }
}

/* ---------------- fotos ---------------- */
export function renderPhoto(app, key) {
  const slot = $(`[data-photo="${key}"]`);
  if (!slot) return;
  const img = $('.photo-img', slot);
  const url = app.urls.get(key);
  if (url) { img.src = url; slot.classList.add('has'); } else { img.removeAttribute('src'); slot.classList.remove('has'); }
  slot.classList.remove('missing');
}
