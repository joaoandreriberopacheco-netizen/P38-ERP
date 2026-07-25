#!/usr/bin/env node
/**
 * Cria secrets/p38-chaves.txt a partir do modelo (se ainda não existir).
 */
import { initP38SecretsBundle, P38_SECRETS_BUNDLE_PATH } from './load-p38-secrets-bundle.mjs';

const created = initP38SecretsBundle();
if (created) {
  console.log('[secrets:init] Criado:', P38_SECRETS_BUNDLE_PATH);
  console.log('  → Abre o ficheiro, cola os valores (KEY=valor) e grava.');
  console.log('  → Depois: npm run secrets:check -- --context=cloud-agent');
} else {
  console.log('[secrets:init] Já existe:', P38_SECRETS_BUNDLE_PATH);
  console.log('  → Edita o ficheiro e corre npm run secrets:check');
}
