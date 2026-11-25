#!/usr/bin/env node
/**
 * Gera link do catálogo PagLeve válido por N horas (default 24).
 * Requer o mesmo segredo no Vercel (CATALOGO_PAGLEVE_CONVITE_SECRET).
 *
 * Uso: node scripts/catalogo/gerar-link-temporario-pagleve.mjs [--hours 24]
 */
import {
  createConviteToken,
  formatExpiryPtBr,
  resolveConviteSecret,
  ensureLocalConviteSecret,
} from '../lib/catalogoPagleveConvite.mjs';

const hoursArg = process.argv.find((a) => a.startsWith('--hours='))
  ? Number(process.argv.find((a) => a.startsWith('--hours=')).split('=')[1])
  : process.argv.includes('--hours')
    ? Number(process.argv[process.argv.indexOf('--hours') + 1])
    : 24;

const secret = resolveConviteSecret().length >= 16 ? resolveConviteSecret() : ensureLocalConviteSecret();
const { url, expMs, hours, token } = createConviteToken({ hours: hoursArg, secret });

const out = {
  ok: true,
  hours,
  expiraEm: new Date(expMs).toISOString(),
  expiraEmLegivel: `${formatExpiryPtBr(expMs)} (Acre)`,
  url,
  tokenPreview: `${token.slice(0, 24)}…`,
  vercelSecret: 'CATALOGO_PAGLEVE_CONVITE_SECRET',
};
console.log(JSON.stringify(out, null, 2));
console.log('');
console.log('── Link para enviar (WhatsApp, etc.) ──');
console.log(url);
console.log(`Válido por ${hours} h · expira ${out.expiraEmLegivel}`);
console.log('────────────────────────────────────');