import { MODULOS } from '@/components/config/PerfilFormTela';
import { getCachedUserSession } from '@/lib/userSessionCache';

/**
 * Modelo de autorização (ordem única de decisão):
 *
 * 1) `user.role === 'admin'` (Base44) → acesso técnico total; tratado nos pontos de entrada (Home, menu, guards).
 *
 * 2) Usuário sem `perfil_acesso_id` e sem `override_permissoes` → modo legado (“ainda não atribuído ao quarter master”):
 *    menu e atalhos amplos, como antes da matriz de perfis.
 *
 * 3) Usuário com perfil e/ou overrides → aplica-se só o que `resolverPermissoes` produzir (template + overrides).
 *
 * 4) Escopo total no perfil (`acesso_geral` ou nome heurístico de administrador) → ignora negações pontuais;
 *    novas chaves no código são tratadas em `garantirChavesPermissoes` ao salvar o perfil.
 */

/**
 * Mescla o template `PerfilDeAcesso.permissoes` com `override_permissoes` do usuário
 * (chaves `modulo.permissao` ou `modulo.permissao.subtipo`).
 */
export function resolverPermissoes(perfilDeAcesso, overridePermissoes = {}) {
  const base = perfilDeAcesso?.permissoes || {};
  const resultado = JSON.parse(JSON.stringify(base));

  Object.entries(overridePermissoes || {}).forEach(([chave, valor]) => {
    const partes = chave.split('.');
    if (partes.length === 2) {
      const [modulo, permissao] = partes;
      if (!resultado[modulo]) resultado[modulo] = {};
      resultado[modulo][permissao] = valor;
    } else if (partes.length === 3) {
      const [modulo, permissao, subtipo] = partes;
      if (!resultado[modulo]) resultado[modulo] = {};
      if (!resultado[modulo][permissao]) resultado[modulo][permissao] = {};
      resultado[modulo][permissao][subtipo] = valor;
    }
  });

  return resultado;
}

/** Nome do perfil sugere “mochila completa” (fallback quando não há flag explícita). */
export function perfilNomeImplicaAcessoTotal(perfil) {
  const n = (perfil?.nome || '').toLowerCase().trim();
  if (!n) return false;
  return (
    n.includes('administrador') ||
    n.includes('admin ') ||
    n === 'admin' ||
    n.includes('dono') ||
    n.includes('gestor master') ||
    n.includes('super admin')
  );
}

/** Acesso a todos os módulos configuráveis no formulário de perfil. */
export function perfilTemEscopoTotal(perfil) {
  if (!perfil) return false;
  if (perfil.acesso_geral === true) return true;
  return perfilNomeImplicaAcessoTotal(perfil);
}

/**
 * Sem vínculo a perfil e sem overrides individuais → compatibilidade com contas antigas.
 * Não confundir com “perfil vazio”: aqui não existe matriz aplicada.
 */
export function usuarioLegadoSemMatrizPerfil(user) {
  if (!user || user.role === 'admin') return false;
  const temPerfil = !!user.perfil_acesso_id;
  const temOverrides =
    user.override_permissoes && Object.keys(user.override_permissoes).length > 0;
  return !temPerfil && !temOverrides;
}

/**
 * Objeto `PerfilDeAcesso` a usar nas checagens: estado React, ou cache quando o fetch ainda não voltou.
 */
export function perfilResolvidoParaUsuario(user, perfilCarregado) {
  const temPerfil = !!user?.perfil_acesso_id;
  if (!temPerfil) return perfilCarregado ?? null;
  return perfilCarregado ?? getCachedUserSession()?.perfilDeAcesso ?? null;
}

/** Configurações exige permissão explícita no kit (perfil + overrides), salvo role técnico admin. */
export function podeAcessarConfiguracoes(user, perfilCarregado) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (usuarioLegadoSemMatrizPerfil(user)) return false;
  const perfil = perfilResolvidoParaUsuario(user, perfilCarregado);
  if (user.perfil_acesso_id && !perfil) return false;
  const perm = resolverPermissoes(perfil, user.override_permissoes);
  return perm?.configuracoes?.acesso === true;
}

export function podeVisualizarCatalogoProdutos(user, perfilCarregado) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (usuarioLegadoSemMatrizPerfil(user)) return true;
  const perfil = perfilResolvidoParaUsuario(user, perfilCarregado);
  if (user.perfil_acesso_id && !perfil) return false;
  if (perfilTemEscopoTotal(perfil)) return true;
  const perm = resolverPermissoes(perfil, user.override_permissoes);
  return perm?.estoque?.visualizar_produtos === true;
}

/**
 * IDs de atalhos da home alinhados ao menu (`permissaoCheck` por item).
 * `itensAtivos`: ex. `quickActionsAtivos()` (sem rotas descontinuadas).
 */
export function idsAtalhosHomePermitidos(user, perfilCarregado, itensAtivos) {
  if (!user) return [];
  if (user.role === 'admin') return itensAtivos.map((a) => a.id);
  if (usuarioLegadoSemMatrizPerfil(user)) return itensAtivos.map((a) => a.id);

  const perfil = perfilResolvidoParaUsuario(user, perfilCarregado);
  if (user.perfil_acesso_id && !perfil) return [];
  const perm = resolverPermissoes(perfil, user.override_permissoes);
  if (perfilTemEscopoTotal(perfil)) {
    return itensAtivos
      .filter((a) => (a.id !== 'configuracoes' ? true : perm?.configuracoes?.acesso === true))
      .map((a) => a.id);
  }

  return itensAtivos
    .filter((a) => !a.permissaoCheck || a.permissaoCheck(perm))
    .map((a) => a.id);
}

/**
 * Garante que toda chave definida em MODULOS exista no objeto salvo.
 * Chaves novas recebem `novasComo` (default false), exceto perfil administrador → true nas novas.
 */
export function garantirChavesPermissoes(permissoes = {}, { novasComo = false, perfilAdministrador = false } = {}) {
  const def = perfilAdministrador ? true : novasComo;
  const merged = permissoes && typeof permissoes === 'object' ? JSON.parse(JSON.stringify(permissoes)) : {};

  for (const mod of MODULOS) {
    if (!merged[mod.key]) merged[mod.key] = {};
    mergeSubmodulos(merged[mod.key], mod.submodulos || [], def);
  }
  return merged;
}

function mergeSubmodulos(target, subs, def) {
  for (const sub of subs || []) {
    if (sub.deprecated) continue;
    if (sub.submodulos?.length) {
      if (target[sub.key] === undefined || typeof target[sub.key] !== 'object' || target[sub.key] === null) {
        target[sub.key] = {};
      }
      mergeSubmodulos(target[sub.key], sub.submodulos, def);
    } else if (target[sub.key] === undefined) {
      target[sub.key] = def;
    }
  }
}
