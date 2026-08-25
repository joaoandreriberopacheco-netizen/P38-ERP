#!/usr/bin/env node
/**
 * Garante embalagem Arielle por marca (não herdada de Formigres).
 */
import { resolveEmbalagemArielle } from '../lib/arielleEmbalagem.mjs';
import { resolveEmbalagemFormigres } from '../lib/formigresEmbalagem.mjs';

const cases = [
  { formato: '84x84', titulo: 'Lençóis Soft RT 84x84', expectM2: 2.81, notM2: 2.32 },
  { formato: '68x68', titulo: 'Íris Lux 68x68', expectM2: 2.79, notM2: 2.18 },
  { formato: '67x67', titulo: 'Malva Sand 67x67', expectM2: 2.71, notM2: 2.18 },
  { formato: '54x54', titulo: 'Cadar Brown 54x54', expectM2: 2.62, notM2: 2.5 },
  { formato: '37x59', titulo: 'Arden Clean 37x59', expectM2: 2.43, notM2: 2.02 },
  { formato: '36x58', titulo: 'RETIF Arden 36x58', expectM2: 2.43, alias: '37x59' },
];

const results = cases.map((c) => {
  const emb = resolveEmbalagemArielle(c);
  const fg = resolveEmbalagemFormigres(c);
  const ok = emb.embalagem_marca === 'arielle'
    && emb.m2_por_caixa === c.expectM2
    && emb.m2_por_caixa !== c.notM2
    && fg.m2_por_caixa !== emb.m2_por_caixa
    && (c.alias ? emb.formato_embalagem === c.alias : true);
  return { ...c, ok, arielle: emb, formigresM2: fg.m2_por_caixa };
});

const ok = results.every((r) => r.ok);

console.log(JSON.stringify({ ok, results }, null, 2));
process.exit(ok ? 0 : 1);
