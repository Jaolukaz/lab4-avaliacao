/**
 * Dados de teste TOTALMENTE FICTÍCIOS: um caso típico e um caso-limite.
 * Nunca coloque dados reais de atletas aqui: este repositório é público.
 */
import { defaults } from '../../src/core/model.js';
import { LIST_LIMIT, LIST_MAXLEN, OBS_MAX, PERI_OBS_MAX, CAPTION_MAX } from '../../src/core/config.js';

export function sample() {
  const s = defaults();
  Object.assign(s.id, { nome: 'Atleta Exemplo da Silva', nasc: '2000-01-15', peso: '78', altura: '176', avaliador: 'Avaliador Exemplo', dataAval: '2026-01-10' });
  s.historico = ['Entorse de tornozelo esquerdo, 2023', 'Dor anterior no joelho direito após treino, sem exame de imagem', 'Episódio de luxação de ombro relatado'];
  s.perimetria = { coxa: { d: '55', e: '53' }, comprimento: { d: '91', e: '92' }, panturrilha: { d: '37', e: '38' }, obs: '' };
  const t = (d, e, status, obs) => ({ d, e, status, obs });
  s.tests.thomas = t('0', '0', 'ok', 'Boa flexibilidade de flexores de quadril e extensores de joelho bilateral');
  s.tests.gluteo = t('0', '0', 'bad', 'Baixa função de glúteo médio bilateral');
  s.tests.isquios = t('85', '85', 'warn', 'Leve hiperatividade de isquiotibiais bilateral');
  s.tests.rotadores = t('31', '31', 'ok', 'Boa mobilidade bilateral de quadril');
  s.tests.tornozelo = t('38', '42', 'ok', 'Boa mobilidade de tornozelo bilateral');
  s.agachamento = { otimo: false, quadril: true, joelho: true, obs: 'Padrão de movimento (PM) desajustado' };
  s.afundo = { status: 'warn', obs: 'Correções após feedbacks verbais, porém com leve instabilidade durante a fase excêntrica do movimento' };
  s.stepdown = { d: 'aus', e: 'aus', status: 'bad', obs: 'Ausência de valgo dinâmico bilateral; pobre estabilidade central e articular bilateral (joelhos e tornozelos)' };
  s.ajustes = ['Promover o ajuste objetivo e ideal do padrão de movimento (Modelo Lab-4)', 'Promover ganho de estabilidade articular de joelhos e tornozelos bilaterais', 'Promover maior ativação da estabilidade central (core)', 'Promover maior ativação e ganho de função de glúteos', 'Considerando o histórico do atleta, trabalhar a propriocepção com eficiência', 'Com base na avaliação de força com dinamômetro, promover simetria de adutores'];
  s.captions = { agach1: 'Vista lateral', agach2: 'Vista frontal', afundo1: 'Perna direita à frente', afundo2: 'Perna esquerda à frente' };
  return s;
}

/** Todos os campos de texto no limite máximo permitido pela interface. */
export function worstCase() {
  const s = sample();
  const long = (n) => 'Texto de observação técnica longo para verificar o comportamento do layout quando o avaliador escreve bastante conteúdo detalhado sobre o teste realizado. '.repeat(6).slice(0, n);
  s.id.nome = 'Maximiliano Albuquerque de Vasconcelos Figueiredo Júnior';
  s.id.avaliador = 'Profissional com nome bastante extenso';
  s.historico = Array.from({ length: LIST_LIMIT.historico }, (_, i) => `Registro ${i + 1}: ${long(LIST_MAXLEN)}`.slice(0, LIST_MAXLEN));
  s.ajustes = Array.from({ length: LIST_LIMIT.ajustes }, (_, i) => `Ajuste ${i + 1}: ${long(LIST_MAXLEN)}`.slice(0, LIST_MAXLEN));
  s.perimetria.obs = long(PERI_OBS_MAX);
  for (const k of Object.keys(s.tests)) s.tests[k].obs = long(OBS_MAX);
  s.agachamento.obs = long(OBS_MAX);
  s.afundo.obs = long(OBS_MAX);
  s.stepdown.obs = long(OBS_MAX);
  for (const k of ['agach1', 'agach2', 'afundo1', 'afundo2', 'step1', 'step2']) s.captions[k] = long(CAPTION_MAX);
  return s;
}
