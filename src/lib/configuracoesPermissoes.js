import { temPermissaoConfig } from '@/lib/permissaoKit';

/** Abas principais de Configurações → chave em configuracoes.* */
export const CONFIG_TAB_PERMS = {
  vendas: 'parametros_gerais',
  operacoes: 'parametros_gerais',
  financeiro: 'parametros_gerais', // tab shell; sub-abas refinam
  geral: 'acesso', // shell; sub-abas refinam
  sistema: 'parametros_gerais',
};

export const CONFIG_GERAL_SUB_PERMS = {
  empresa: 'dados_empresa',
  'usuarios-app': 'gerenciar_usuarios',
  'perfis-acesso': 'gerenciar_perfis',
};

export const CONFIG_FIN_SUB_PERMS = {
  contas: 'parametros_gerais',
  categorias: 'parametros_gerais',
  formas: 'gerenciar_formas_pagamento',
  maquininhas: 'gerenciar_formas_pagamento',
};

export function podeVerAbaConfig(user, perfil, tab) {
  const key = CONFIG_TAB_PERMS[tab];
  if (tab === 'geral') {
    return Object.values(CONFIG_GERAL_SUB_PERMS).some((k) => temPermissaoConfig(user, perfil, k));
  }
  if (tab === 'financeiro') {
    return Object.values(CONFIG_FIN_SUB_PERMS).some((k) => temPermissaoConfig(user, perfil, k));
  }
  return temPermissaoConfig(user, perfil, key);
}

export function podeVerSubAbaConfigGeral(user, perfil, sub) {
  const key = CONFIG_GERAL_SUB_PERMS[sub];
  return key ? temPermissaoConfig(user, perfil, key) : false;
}

export function podeVerSubAbaConfigFin(user, perfil, sub) {
  const key = CONFIG_FIN_SUB_PERMS[sub];
  return key ? temPermissaoConfig(user, perfil, key) : false;
}

export function primeiraAbaConfigPermitida(user, perfil) {
  return ['vendas', 'operacoes', 'financeiro', 'geral', 'sistema'].find((t) => podeVerAbaConfig(user, perfil, t)) || null;
}
