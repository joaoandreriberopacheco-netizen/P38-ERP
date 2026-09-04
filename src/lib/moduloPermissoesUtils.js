import { MODULOS } from '@/components/config/PerfilFormTela';

/** Chave plana usada em override_permissoes e no resolver. */
export function chavePermissao(moduloKey, pathParts) {
  return `${moduloKey}.${pathParts.join('.')}`;
}

export function getValorPermissao(permissoes, chave) {
  const partes = chave.split('.');
  if (partes.length === 2) {
    return permissoes?.[partes[0]]?.[partes[1]] === true;
  }
  if (partes.length === 3) {
    return permissoes?.[partes[0]]?.[partes[1]]?.[partes[2]] === true;
  }
  return false;
}

/** Todas as permissões folha (sem itens deprecated). */
export function listarPermissoesFolha(modulos = MODULOS) {
  const folhas = [];

  function walk(moduloKey, subs, path) {
    for (const sub of subs || []) {
      if (sub.deprecated) continue;
      const next = [...path, sub.key];
      const filhosAtivos = (sub.submodulos || []).filter((s) => !s.deprecated);
      if (filhosAtivos.length > 0) {
        walk(moduloKey, sub.submodulos, next);
      } else {
        folhas.push({
          chave: chavePermissao(moduloKey, next),
          moduloKey,
          label: sub.label,
        });
      }
    }
  }

  for (const mod of modulos) {
    walk(mod.key, mod.submodulos, []);
  }
  return folhas;
}

export function agruparPermissoesPorModulo(folhas = listarPermissoesFolha()) {
  const map = new Map();
  for (const folha of folhas) {
    if (!map.has(folha.moduloKey)) map.set(folha.moduloKey, []);
    map.get(folha.moduloKey).push(folha);
  }
  return map;
}
