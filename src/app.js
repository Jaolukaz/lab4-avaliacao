/**
 * Controlador da aplicação: mantém a avaliação em edição, liga o formulário ao estado,
 * salva automaticamente no IndexedDB e executa os comandos (PDF, avaliações, exportar, importar).
 */
import { APP_VERSION, LIST_LIMIT, LIST_MAXLEN } from './core/config.js';
import { brDate, defaults, getPath, setPath, slug, todayISO } from './core/model.js';
import * as repo from './storage/repo.js';
import { $, $$, ICON, debounce, esc, isTouch } from './ui/dom.js';
import { ask, busy, toast } from './ui/feedback.js';
import { buildForm, populate, renderList, renderPhoto, syncAgach, toggleOutro, updateDerived, updateNav } from './ui/form.js';
import { PhotoUrls, processImage } from './ui/photos.js';
import { deliver } from './ui/share.js';
import { initPwa, promptInstall, requestPersistence } from './ui/pwa.js';
import { LOGO_URLS, buildPdf, computeLayout, getEngine, layoutToSvg } from './report/engine.js';

const app = {
  id: null,
  createdAt: null,
  state: defaults(),
  photos: {},
  urls: new PhotoUrls(),
  storageKind: 'idb',
  mode: 'form',
};

/* ============================================================
   Persistência
   ============================================================ */
function setSaveState(msg, warn = false) {
  $$('[data-save-state]').forEach((el) => {
    el.textContent = msg;
    el.classList.toggle('warn', warn);
  });
}

async function saveNow() {
  try {
    await repo.saveEval(app.id, app.state, app.createdAt);
    const t = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setSaveState(app.storageKind === 'memory' ? 'Sem salvamento local' : `Salvo às ${t}`, app.storageKind === 'memory');
  } catch (err) {
    console.error(err);
    setSaveState('Falha ao salvar', true);
    toast('Não foi possível salvar no aparelho. Use "Exportar" para não perder a avaliação.', 8000);
  }
}
const scheduleSave = debounce(saveNow, 500);

async function openEval(id) {
  const rec = await repo.loadEval(id);
  if (!rec) return false;
  app.id = rec.id;
  app.createdAt = rec.createdAt;
  app.state = rec.state;
  app.photos = await repo.loadPhotos(id);
  app.urls.reset(app.photos);
  await repo.setCurrentId(id);
  populate(app);
  scheduleRender();
  return true;
}

async function flushPending() {
  if (scheduleSave.pending()) await scheduleSave.flush();
}

/* ============================================================
   Mudanças no formulário
   ============================================================ */
function onChange(path) {
  if (path && path.startsWith('agachamento.')) syncAgach(app.state, path);
  if (path === 'id.objetivo') toggleOutro(app.state);
  updateDerived(app);
  scheduleSave();
  scheduleRender();
}

function addItem(name, text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (app.state[name].length >= LIST_LIMIT[name]) {
    toast(`Limite de ${LIST_LIMIT[name]} itens, para manter o relatório dentro da página.`);
    return false;
  }
  app.state[name].push(t.slice(0, LIST_MAXLEN));
  renderList(app, name);
  onChange();
  return true;
}

async function setPhoto(slot, file) {
  if (!file) return;
  const el = $(`[data-photo="${slot}"]`);
  el.classList.add('busy');
  try {
    const rec = await processImage(file, slot);
    app.photos[slot] = rec;
    app.urls.set(slot, rec);
    renderPhoto(app, slot);
    onChange();
    await repo.savePhoto(app.id, slot, rec);
    requestPersistence();
  } catch (err) {
    console.error(err);
    toast('Não foi possível ler esta imagem. Tente outra foto ou um arquivo JPG ou PNG.', 6000);
  } finally {
    el.classList.remove('busy');
  }
}

async function removePhoto(slot) {
  delete app.photos[slot];
  app.urls.revoke(slot);
  renderPhoto(app, slot);
  onChange();
  await repo.deletePhoto(app.id, slot);
}

/* ============================================================
   Pré-visualização A4 (mesma lista de desenho do PDF)
   ============================================================ */
let lastLayout = null;
const urlFor = (ref) => (ref.startsWith('photo:') ? app.urls.get(ref.slice(6)) : LOGO_URLS[ref] || null);

async function renderPreview() {
  if (app.mode !== 'preview') return;
  try {
    lastLayout = await computeLayout(app.state, app.photos);
    $('#report').innerHTML = layoutToSvg(lastLayout, urlFor).map((svg) => `<div class="a4">${svg}</div>`).join('');
    const msg = $('#ovf-msg');
    const pages = lastLayout.overflowPages;
    msg.hidden = !pages.length;
    if (pages.length) msg.textContent = `O conteúdo ultrapassa a área da folha na página ${pages.join(', ')}. Reduza o texto das observações ou o número de itens da lista.`;
  } catch (err) {
    console.error(err);
    $('#report').innerHTML = '<p class="list-empty">Não foi possível montar a pré-visualização. Recarregue a página e tente novamente.</p>';
  }
}
const scheduleRender = debounce(renderPreview, 250);

function setMode(mode) {
  app.mode = mode;
  const prev = mode === 'preview';
  document.body.classList.toggle('preview', prev);
  $('#report-wrap').setAttribute('aria-hidden', prev ? 'false' : 'true');
  $$('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  if (prev) {
    $('#report').innerHTML = '<p class="loading">Montando páginas…</p>';
    scheduleRender.flush() || renderPreview();
  }
  window.scrollTo({ top: 0 });
}

/* ============================================================
   Comandos
   ============================================================ */
async function validate(layout) {
  const issues = [];
  if (!app.state.id.nome.trim()) issues.push('O nome do atleta não foi informado.');
  const miss = ['agach1', 'agach2'].filter((k) => !app.photos[k]);
  if (miss.length) {
    issues.push(`Agachamento bipodal: ${miss.length === 2 ? 'faltam as 2 fotos' : 'falta 1 foto'} de evidência obrigatória.`);
    miss.forEach((k) => $(`[data-photo="${k}"]`).classList.add('missing'));
  }
  if (layout.overflowPages.length) issues.push(`Conteúdo excedendo a folha na página ${layout.overflowPages.join(', ')}.`);
  return issues;
}

async function cmdPdf() {
  await flushPending();
  busy(true, 'Preparando o relatório…');
  let layout;
  try {
    layout = await computeLayout(app.state, app.photos);
  } catch (err) {
    busy(false);
    console.error(err);
    toast('Não foi possível carregar o gerador de PDF. Verifique a conexão na primeira abertura e tente novamente.', 7000);
    return;
  }
  busy(false);
  const issues = await validate(layout);
  if (issues.length) {
    const r = await ask('Revise antes de gerar',
      `<p>Encontramos pontos que podem deixar o PDF incompleto:</p><ul>${issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`,
      [{ label: 'Voltar e corrigir', value: 'back' }, { label: 'Gerar mesmo assim', value: 'go', cls: 'btn-dark' }]);
    if (r !== 'go') {
      if (r === 'back' && app.mode === 'form' && issues.some((i) => i.startsWith('Agachamento'))) $('#s-agachamento').scrollIntoView({ behavior: 'smooth' });
      return;
    }
  }
  busy(true, 'Gerando PDF…');
  try {
    const { file } = await buildPdf(app.state, app.photos);
    busy(false);
    await deliver(file, {
      kind: 'pdf',
      heading: 'PDF pronto',
      title: `Avaliação funcional Lab-4${app.state.id.nome ? ` | ${app.state.id.nome}` : ''}`,
    });
  } catch (err) {
    busy(false);
    console.error(err);
    toast('Falha ao gerar o PDF. Tente novamente; se persistir, exporte a avaliação e envie ao suporte.', 7000);
  }
}

async function cmdExport() {
  await flushPending();
  const json = repo.buildExport(app.state, app.photos);
  const file = new File([json], `avaliacao-lab4_${slug(app.state.id.nome)}_${app.state.id.dataAval || todayISO()}.json`, { type: 'application/json' });
  await deliver(file, {
    kind: 'json',
    heading: 'Cópia da avaliação',
    title: 'Avaliação Lab-4 (arquivo de dados)',
    note: '<p>Este arquivo guarda todos os campos e fotos. Use "Importar" em qualquer aparelho para reabri-lo.</p>',
  });
}

async function cmdImport(file) {
  if (!file) return;
  busy(true, 'Importando…');
  try {
    await flushPending();
    const { id } = await repo.importEval(await file.text());
    await openEval(id);
    busy(false);
    toast('Avaliação importada e aberta para edição.');
  } catch (err) {
    busy(false);
    toast(err.message || 'Não foi possível importar este arquivo.', 6000);
  }
}

async function cmdNew() {
  if ($('#evals').open) $('#evals').close();
  await flushPending();
  const { id } = await repo.createEval();
  await openEval(id);
  setMode('form');
  toast('Nova avaliação iniciada. A anterior continua salva em "Avaliações".');
}

const when = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

async function cmdEvals() {
  await flushPending();
  const list = await repo.listEvals();
  const dlg = $('#evals');
  const body = $('#evals-list');
  body.innerHTML = list.length
    ? list.map((e) => `
      <li class="ev ${e.id === app.id ? 'current' : ''}">
        <div class="ev-info"><b>${esc(e.nome.trim() || 'Atleta sem nome')}</b>
          <span>Avaliação em ${brDate(e.dataAval)}, editada em ${when(e.updatedAt)}</span>
          ${e.id === app.id ? '<em>Em edição</em>' : ''}</div>
        <div class="ev-act">
          ${e.id === app.id ? '' : `<button type="button" class="btn btn-line" data-ev-open="${e.id}">Abrir</button>`}
          <button type="button" class="icon-btn" data-ev-del="${e.id}" aria-label="Excluir avaliação de ${esc(e.nome || 'atleta sem nome')}">${ICON.trash}</button>
        </div>
      </li>`).join('')
    : '<li class="list-empty">Nenhuma avaliação salva.</li>';
  $('#evals-count').textContent = `${list.length} ${list.length === 1 ? 'avaliação salva' : 'avaliações salvas'} neste aparelho`;
  if (!dlg.open) dlg.showModal();
}

async function cmdDelete(id) {
  const rec = await repo.loadEval(id);
  const nome = rec?.state.id.nome.trim() || 'atleta sem nome';
  $('#evals').close();
  const r = await ask('Excluir avaliação',
    `<p>A avaliação de <b>${esc(nome)}</b>, com todas as fotos, será apagada deste aparelho. Essa ação não pode ser desfeita.</p><p>Se quiser guardar uma cópia, use "Exportar" antes.</p>`,
    [{ label: 'Cancelar', value: null }, { label: 'Excluir', value: 'del', cls: 'btn-danger-solid' }]);
  if (r !== 'del') { cmdEvals(); return; }
  await repo.deleteEval(id);
  if (id === app.id) {
    const rest = await repo.listEvals();
    if (rest.length) await openEval(rest[0].id);
    else { const { id: nid } = await repo.createEval(); await openEval(nid); }
  }
  toast('Avaliação excluída.');
  cmdEvals();
}

/* ============================================================
   Eventos
   ============================================================ */
function bindForm() {
  const form = $('#form');

  const onField = (e) => {
    const el = e.target;
    if (el.dataset.bind) {
      if (el.type === 'radio' && !el.checked) return;
      setPath(app.state, el.dataset.bind, el.type === 'checkbox' ? el.checked : el.value);
      onChange(el.dataset.bind);
    } else if (el.dataset.list) {
      app.state[el.dataset.list][+el.dataset.idx] = el.value;
      onChange();
    }
  };
  form.addEventListener('input', onField);
  form.addEventListener('change', (e) => {
    if (e.target.type === 'file') {
      const slot = e.target.closest('.photo').dataset.photo;
      setPhoto(slot, e.target.files[0]);
      e.target.value = '';
      return;
    }
    onField(e);
  });

  // Classificação desmarcável: tocar de novo na opção marcada limpa a escolha
  form.addEventListener('pointerdown', (e) => {
    const inp = e.target.closest('label.chip')?.querySelector('input[type=radio][data-toggle]');
    if (inp) inp.dataset.was = inp.checked ? '1' : '0';
  });
  form.addEventListener('click', (e) => {
    const inp = e.target;
    if (inp.matches?.('input[type=radio][data-toggle]') && inp.dataset.was === '1') {
      inp.checked = false;
      inp.dataset.was = '0';
      setPath(app.state, inp.dataset.bind, '');
      onChange(inp.dataset.bind);
      return;
    }
    const t = e.target.closest('button, .photo-drop');
    if (!t) return;
    if (t.dataset.phrase) {
      const path = t.dataset.target;
      const cur = String(getPath(app.state, path) || '').trim();
      const ta = $(`textarea[data-bind="${path}"]`);
      const next = cur ? `${cur.replace(/[;.]\s*$/, '')}; ${t.dataset.phrase}` : t.dataset.phrase;
      if (next.length > ta.maxLength) { toast('A observação atingiria o limite de caracteres. Edite o texto manualmente.'); return; }
      setPath(app.state, path, next);
      ta.value = next;
      onChange(path);
      return;
    }
    if (t.dataset.add) {
      const inp2 = $(`#add-${t.dataset.add}`);
      if (addItem(t.dataset.add, inp2.value)) { inp2.value = ''; inp2.focus(); }
      return;
    }
    if (t.dataset.sugg) { addItem('ajustes', t.dataset.sugg); return; }
    if (t.dataset.listAct) {
      const name = t.dataset.list;
      const i = +t.dataset.idx;
      const arr = app.state[name];
      if (t.dataset.listAct === 'del') arr.splice(i, 1);
      if (t.dataset.listAct === 'up' && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
      if (t.dataset.listAct === 'down' && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
      renderList(app, name);
      onChange();
      return;
    }
    const slot = t.closest('.photo');
    if (!slot) return;
    const act = t.classList.contains('photo-drop') ? 'gallery' : t.dataset.photoAct;
    if (act === 'gallery' || act === 'camera') $(`input[data-src="${act}"]`, slot).click();
    if (act === 'remove') removePhoto(slot.dataset.photo);
  });

  form.addEventListener('keydown', (e) => {
    const el = e.target;
    if (el.id?.startsWith('add-') && e.key === 'Enter') {
      e.preventDefault();
      if (addItem(el.id.slice(4), el.value)) el.value = '';
    }
    if (el.classList.contains('photo-drop') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      $('input[data-src="gallery"]', el.closest('.photo')).click();
    }
  });

  form.addEventListener('dragover', (e) => { const s = e.target.closest('.photo'); if (s) { e.preventDefault(); s.classList.add('drag'); } });
  form.addEventListener('dragleave', (e) => { const s = e.target.closest('.photo'); if (s && !s.contains(e.relatedTarget)) s.classList.remove('drag'); });
  form.addEventListener('drop', (e) => {
    const s = e.target.closest('.photo');
    if (!s) return;
    e.preventDefault();
    s.classList.remove('drag');
    const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) setPhoto(s.dataset.photo, f); else toast('Arraste um arquivo de imagem.');
  });
}

function bindChrome() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode], [data-cmd], [data-ev-open], [data-ev-del], [data-nav]');
    if (!b) return;
    if (b.dataset.nav) {
      e.preventDefault();
      if (app.mode !== 'form') setMode('form');
      $(`#s-${b.dataset.nav}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (b.dataset.mode) { setMode(b.dataset.mode); return; }
    if (b.dataset.evOpen) { $('#evals').close(); flushPending().then(() => openEval(b.dataset.evOpen)).then(() => { setMode('form'); toast('Avaliação aberta.'); }); return; }
    if (b.dataset.evDel) { cmdDelete(b.dataset.evDel); return; }
    const cmd = b.dataset.cmd;
    if (b.closest('#menu')) $('#menu').close();
    if (cmd === 'pdf') cmdPdf();
    else if (cmd === 'export') cmdExport();
    else if (cmd === 'import') $('#import-file').click();
    else if (cmd === 'new') cmdNew();
    else if (cmd === 'evals') cmdEvals();
    else if (cmd === 'menu') $('#menu').showModal();
    else if (cmd === 'install') promptInstall();
    else if (cmd === 'close-evals') $('#evals').close();
  });
  $('#import-file').addEventListener('change', (e) => { cmdImport(e.target.files[0]); e.target.value = ''; });
  ['#menu', '#evals'].forEach((sel) => $(sel).addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }));

  // Salva ao sair ou ao mandar o app para segundo plano (comum no celular)
  const flush = () => { flushPending(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  // Destaque da seção visível na faixa de navegação do celular
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const id = en.target.dataset.sec;
        $$('#strip a').forEach((a) => a.classList.toggle('active', a.dataset.nav === id));
        const act = $(`#strip a[data-nav="${id}"]`);
        const strip = $('#strip');
        // rola só a faixa horizontal, sem interferir na rolagem da página
        if (act && strip.scrollWidth > strip.clientWidth) strip.scrollTo({ left: act.offsetLeft - strip.clientWidth / 2 + act.clientWidth / 2, behavior: 'smooth' });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('.sheet').forEach((s) => io.observe(s));
  }
}

/* ============================================================
   Inicialização
   ============================================================ */
export async function start() {
  buildForm();
  $$('[data-icon]').forEach((el) => { el.innerHTML = ICON[el.dataset.icon] || ''; });
  $('#app-version').textContent = `Versão ${APP_VERSION}. Os dados ficam somente neste aparelho.`;
  $$('img[data-logo]').forEach((i) => { i.src = LOGO_URLS['logo-black']; });
  $$('img[data-logo-white]').forEach((i) => { i.src = LOGO_URLS['logo-white']; });
  document.body.classList.toggle('touch', isTouch());
  bindForm();
  bindChrome();

  app.storageKind = await repo.initRepo();
  let id = null;
  const migrated = await repo.migrateLegacy();
  if (migrated) id = migrated;
  else id = await repo.getCurrentId();
  if (!id || !(await openEval(id))) {
    const all = await repo.listEvals();
    if (all.length) await openEval(all[0].id);
    else { const r = await repo.createEval(); await openEval(r.id); }
  }
  updateNav(app);
  if (migrated) toast('Rascunho da versão anterior recuperado.');
  if (app.storageKind === 'memory') { setSaveState('Sem salvamento local', true); toast('Este navegador não permite salvar no aparelho. Use "Exportar" ao terminar a avaliação.', 8000); }
  else setSaveState('Salvo no aparelho');

  initPwa();
  // Carrega o motor de PDF em segundo plano, depois que a tela já está utilizável
  const warm = () => getEngine().catch((err) => console.warn('[lab4] motor de PDF ainda não carregado', err));
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 2500 }); else setTimeout(warm, 800);
}
