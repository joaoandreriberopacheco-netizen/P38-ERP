/** Corrige textos com mojibake conhecidos (UTF-8 lido como Latin-1 / `??` no código). */
const SUBSTITUICOES = [
  [/Importa\?\?o/gi, 'Importação'],
  [/Benefici\?rio/gi, 'Beneficiário'],
  [/n\?o identificado/gi, 'não identificado'],
  [/descri\?\?o/gi, 'descrição'],
  [/observa\?\?es/gi, 'observações'],
  [/instru\?\?es/gi, 'instruções'],
  [/liga\?\?o/gi, 'ligação'],
  [/atualiza\?\?o/gi, 'atualização'],
  [/reimporta\?\?o/gi, 'reimportação'],
  [/lan\?amento/gi, 'lançamento'],
  [/el\?trica/gi, 'elétrica'],
  [/Minist\?rio/gi, 'Ministério'],
  [/Sugest\?o/gi, 'Sugestão'],
  [/autom\?tico/gi, 'automático'],
  [/confirmada/gi, 'confirmada'],
  [/\?\?nico/gi, 'Único'],
  [/N\?o consegui/gi, 'Não consegui'],
  [/tamb\?m/gi, 'também'],
  [/j\?/gi, 'já'],
  [/\?til/gi, 'útil'],
  [/S\?/gi, 'Só'],
];

export function corrigirTextoPt(texto) {
  if (texto === null || texto === undefined) return '';
  let out = String(texto);
  for (const [pattern, replacement] of SUBSTITUICOES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
