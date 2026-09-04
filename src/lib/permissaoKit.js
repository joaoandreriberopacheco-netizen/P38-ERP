import {
  resolverPermissoes,
  perfilResolvidoParaUsuario,
  usuarioLegadoSemMatrizPerfil,
  perfilTemEscopoTotal,
} from '@/lib/perfilPermissoes';

export function permissoesEfetivas(user, perfilCarregado) {
  const perfil = perfilResolvidoParaUsuario(user, perfilCarregado);
  return resolverPermissoes(perfil, user?.override_permissoes);
}

export function bypassPermissaoKit(user, perfilCarregado) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (usuarioLegadoSemMatrizPerfil(user)) return true;
  const perfil = perfilResolvidoParaUsuario(user, perfilCarregado);
  return perfilTemEscopoTotal(perfil);
}

function getNested(obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

/**
 * Verifica permissão no kit (perfil + overrides).
 * @param {string} path - ex.: 'pdv.aplicar_desconto'
 * @param {string|null} fallbackPath - se indefinido/negação implícita, usa fallback (ex.: 'financeiro.acesso')
 */
export function temPermissaoKit(user, perfilCarregado, path, fallbackPath = null) {
  if (bypassPermissaoKit(user, perfilCarregado)) return true;
  const perfil = perfilResolvidoParaUsuario(user, perfilCarregado);
  if (user?.perfil_acesso_id && !perfil) return false;

  const perm = resolverPermissoes(perfil, user?.override_permissoes);
  const val = getNested(perm, path);
  if (val === true) return true;
  if (val === false) return false;

  if (fallbackPath) {
    const fb = getNested(perm, fallbackPath);
    return fb === true;
  }
  return false;
}

/** Qualquer uma das paths (com fallback individual opcional). */
export function temAlgumaPermissaoKit(user, perfilCarregado, entries) {
  return entries.some(({ path, fallback }) => temPermissaoKit(user, perfilCarregado, path, fallback ?? null));
}

export function temPermissaoConfig(user, perfilCarregado, key) {
  if (key === 'acesso') return temPermissaoKit(user, perfilCarregado, 'configuracoes.acesso');
  return temPermissaoKit(user, perfilCarregado, `configuracoes.${key}`, 'configuracoes.acesso');
}

/** Páginas financeiras com permissão granular (além do menu). */
export const FINANCEIRO_PAGE_PERMS = {
  FluxoCaixa: [{ path: 'financeiro.acesso' }],
  FolhaPrevisao: [{ path: 'financeiro.acesso' }],
  SuperAgefin: [{ path: 'financeiro.acesso' }],
  Agefin: [{ path: 'financeiro.acesso' }],
  AgefinConsulta: [{ path: 'financeiro.acesso' }],
  PlanejamentoFinanceiro: [{ path: 'financeiro.acesso' }],
  PlanejamentoFinanceiroV2: [{ path: 'financeiro.acesso' }],
  Budgets: [{ path: 'financeiro.acesso' }],
  VisaoFinanceira: [{ path: 'financeiro.acesso' }],
  Dizimo: [{ path: 'financeiro.acesso' }],
  TurnosFechados: [{ path: 'financeiro.acesso' }],
  AgendaFinanceira: [{ path: 'financeiro.acesso' }],
  LancamentoAnexos: [{ path: 'financeiro.criar_lancamento', fallback: 'financeiro.acesso' }],
  SimuladorCartao: [{ path: 'financeiro.acesso' }],
  AtualizarBoletoRecorrente: [{ path: 'financeiro.acesso' }],
  ReversaoDespesasSangrias: [{ path: 'financeiro.acesso' }],
  LixeiraLancamentos: [{ path: 'financeiro.acesso' }],
  ContasFinanceiras: [{ path: 'financeiro.contas', fallback: 'financeiro.acesso' }],
  AprovacoesFinanceiras: [{ path: 'financeiro.aprovar_pagamentos', fallback: 'financeiro.acesso' }],
  FinanceiroAprovacoes: [{ path: 'financeiro.aprovar_pagamentos', fallback: 'financeiro.acesso' }],
  ExtratoConta: [{ path: 'financeiro.ver_extrato', fallback: 'financeiro.acesso' }],
  CaixasAtivos: [{ path: 'financeiro.caixas_ativos', fallback: 'financeiro.acesso' }],
  ControleCaixasAtivos: [{ path: 'financeiro.caixas_ativos', fallback: 'financeiro.acesso' }],
};

export function podeAcessarPaginaFinanceiro(user, perfilCarregado, pageName) {
  const entries = FINANCEIRO_PAGE_PERMS[pageName];
  if (!entries) return null;
  return temAlgumaPermissaoKit(user, perfilCarregado, entries);
}

/** Relatórios com chave dedicada ou acesso geral. */
export const RELATORIO_PAGE_PERMS = {
  RelatorioMargem: [{ path: 'relatorios.relatorio_margem', fallback: 'relatorios.acesso' }],
  RelatorioCatalogoVendas: [{ path: 'relatorios.relatorio_vendas', fallback: 'relatorios.acesso' }],
  RelatorioCatalogoEstoque: [{ path: 'relatorios.relatorio_estoque', fallback: 'relatorios.acesso' }],
  RelatorioPerformance: [{ path: 'relatorios.acesso' }],
  RelatorioConsumoInterno: [{ path: 'relatorios.acesso' }],
  PrecoJustoDashboard: [{ path: 'relatorios.relatorio_vendas', fallback: 'relatorios.acesso' }],
};

export function podeAcessarPaginaRelatorio(user, perfilCarregado, pageName) {
  const entries = RELATORIO_PAGE_PERMS[pageName];
  if (!entries) return null;
  return temAlgumaPermissaoKit(user, perfilCarregado, entries);
}

export function podeAcessarPaginaGranular(user, perfilCarregado, pageName) {
  const fin = podeAcessarPaginaFinanceiro(user, perfilCarregado, pageName);
  if (fin !== null) return fin;
  const rel = podeAcessarPaginaRelatorio(user, perfilCarregado, pageName);
  if (rel !== null) return rel;
  return null;
}

/** Colunas de catálogo que expõem custo/margem — ocultar sem estoque.ver_custo_compra. */
export const COLUNAS_CUSTO_CATALOGO = [
  'preco_custo',
  'valor_compra',
  'markup',
  'inventario_valorizado',
  'margem',
  'avaria_percentual',
];

export function filtrarColunasCatalogoPorPermissao(columns, podeVerCusto) {
  if (podeVerCusto || !Array.isArray(columns)) return columns;
  return columns.filter((c) => !COLUNAS_CUSTO_CATALOGO.includes(c));
}
