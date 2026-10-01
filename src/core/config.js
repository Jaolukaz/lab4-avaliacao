/**
 * Configuração de domínio da Avaliação Funcional Lab-4.
 * Tudo o que descreve testes, rótulos, frases rápidas e limites fica aqui,
 * para que formulário, pré-visualização e PDF leiam da mesma fonte.
 */

export const APP_VERSION = '2.0.2';

export const PHOTO_KEYS = ['atleta', 'agach1', 'agach2', 'afundo1', 'afundo2', 'step1', 'step2'];
export const LIST_LIMIT = { historico: 8, ajustes: 10 };
export const LIST_MAXLEN = 170;
export const OBS_MAX = 320;
export const PERI_OBS_MAX = 200;
export const CAPTION_MAX = 60;

/**
 * Dimensão máxima (px, lado maior) das fotos gravadas no aparelho.
 * 1920 px garante pelo menos 300 dpi no maior quadro de foto do PDF para fotos 3:4 e 9:16
 * (verificado em tests/report.test.mjs). A foto do atleta ocupa um quadro menor.
 */
export const PHOTO_MAX_DIM = { atleta: 1200, default: 1920 };
export const PHOTO_JPEG_QUALITY = 0.9;
/** Densidade mínima de impressão que as fotos do relatório devem atingir. */
export const PRINT_DPI = 300;

export const DEFAULT_LABELS = { ok: 'Adequado', warn: 'Atenção', bad: 'Déficit' };
export const OBJETIVOS = ['Performance', 'Prevenção de lesões', 'Retorno ao esporte', 'Reabilitação', 'Outro'];

export const PERIMETRIA = [
  { id: 'coxa', label: 'Coxa' },
  { id: 'comprimento', label: 'Comprimento do membro' },
  { id: 'panturrilha', label: 'Panturrilha' },
];

export const BILATERAL = [
  {
    id: 'thomas', title: 'Teste de Thomas', short: 'Teste de Thomas', unit: '°',
    phrases: ['Boa flexibilidade de flexores de quadril e extensores de joelho bilateral', 'Encurtamento de flexores de quadril à direita', 'Encurtamento de flexores de quadril à esquerda'],
  },
  {
    id: 'gluteo', title: 'Função de glúteo médio', short: 'Glúteo médio', unit: '', scoreLabel: 'escore',
    labels: { ok: 'Boa função', warn: 'Função reduzida', bad: 'Baixa função' },
    phrases: ['Baixa função de glúteo médio bilateral', 'Boa função de glúteo médio bilateral', 'Baixa função de glúteo médio à direita', 'Baixa função de glúteo médio à esquerda'],
  },
  {
    id: 'isquios', title: 'Teste de flexibilidade de isquiossurais', short: 'Isquiossurais', unit: '°',
    phrases: ['Leve hiperatividade de isquiotibiais bilateral', 'Boa flexibilidade de isquiossurais bilateral', 'Encurtamento de isquiossurais bilateral'],
  },
  {
    id: 'rotadores', title: 'Rigidez de rotadores internos (quadril)', short: 'Rotadores internos', unit: '°',
    phrases: ['Boa mobilidade bilateral de quadril', 'Rigidez de rotadores internos à direita', 'Rigidez de rotadores internos à esquerda'],
  },
  {
    id: 'tornozelo', title: 'Rigidez de tornozelo', short: 'Tornozelo', unit: '°',
    phrases: ['Boa mobilidade de tornozelo bilateral', 'Mobilidade de dorsiflexão reduzida à direita', 'Mobilidade de dorsiflexão reduzida à esquerda'],
  },
];
export const BIL = Object.fromEntries(BILATERAL.map((b) => [b.id, b]));

export const AFUNDO_LABELS = { ok: 'Padrão adequado', warn: 'Corrige com feedback', bad: 'Padrão desajustado' };
export const STEP_LABELS = { ok: 'Boa estabilidade', warn: 'Estabilidade parcial', bad: 'Pobre estabilidade' };
export const AGACH_CHECKS = [['otimo', 'Padrão ótimo'], ['quadril', 'E. de quadril'], ['joelho', 'E. de joelho']];

export const PHRASES = {
  agachamento: ['Padrão de movimento (PM) desajustado', 'Padrão de movimento adequado', 'Corrige após feedback verbal'],
  afundo: ['Correções após feedbacks verbais, porém com leve instabilidade durante a fase excêntrica do movimento', 'Boa estabilidade durante todo o movimento', 'Instabilidade de joelho na fase excêntrica'],
  stepdown: ['Ausência de valgo dinâmico bilateral', 'Pobre estabilidade central e articular bilateral (joelhos e tornozelos)', 'Presença de valgo dinâmico à direita', 'Presença de valgo dinâmico à esquerda'],
};

export const AJUSTES_SUGG = [
  'Promover o ajuste objetivo e ideal do padrão de movimento (Modelo Lab-4)',
  'Promover ganho de estabilidade articular de joelhos e tornozelos bilaterais',
  'Promover maior ativação da estabilidade central (core)',
  'Promover maior ativação e ganho de função de glúteos',
  'Considerando o histórico do atleta, trabalhar a propriocepção com eficiência',
  'Com base na avaliação de força com dinamômetro, promover simetria de adutores',
  'Promover ganho de força geral em todo o membro inferior',
];

export const NAV = [
  ['Identificação e histórico', [['ident', 'Atleta'], ['historico', 'História pregressa']]],
  ['Avaliações bilaterais', [['perimetria', 'Perimetria'], ...BILATERAL.map((b) => [b.id, b.short])]],
  ['Testes qualitativos', [['agachamento', 'Agachamento bipodal'], ['afundo', 'Padrão de afundo'], ['stepdown', 'Step-down']]],
  ['Conclusão', [['ajustes', 'Ajustes individuais']]],
];
