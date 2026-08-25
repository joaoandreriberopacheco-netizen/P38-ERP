/**
 * ICMS interestadual + desconto Suframa para catálogo B2B.
 * Fabricante (UF origem) vem do template; comprador informa UF destino no diálogo.
 *
 * Regra de negócio (quadro aprovado):
 * - PIS 1,65% e COFINS 7% fixos quando aplicáveis.
 * - ICMS: alíquota interestadual integral (ex.: BA→AM 12%); Sul/Sudeste→N/NE/CO
 *   com 25% usa fator 28% → desconto ICMS 7% (Formigres/SC).
 * - ALC + lucro real: só ICMS (PIS/COFINS vedados).
 * - Amazônia Ocidental: 0% (IPI já zero em cerâmica).
 */

export const UF_LIST = [
  { uf: 'AC', nome: 'Acre' },
  { uf: 'AL', nome: 'Alagoas' },
  { uf: 'AM', nome: 'Amazonas' },
  { uf: 'AP', nome: 'Amapá' },
  { uf: 'BA', nome: 'Bahia' },
  { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' },
  { uf: 'ES', nome: 'Espírito Santo' },
  { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' },
  { uf: 'MG', nome: 'Minas Gerais' },
  { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MT', nome: 'Mato Grosso' },
  { uf: 'PA', nome: 'Pará' },
  { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PE', nome: 'Pernambuco' },
  { uf: 'PI', nome: 'Piauí' },
  { uf: 'PR', nome: 'Paraná' },
  { uf: 'RJ', nome: 'Rio de Janeiro' },
  { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RO', nome: 'Rondônia' },
  { uf: 'RR', nome: 'Roraima' },
  { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SE', nome: 'Sergipe' },
  { uf: 'SP', nome: 'São Paulo' },
  { uf: 'TO', nome: 'Tocantins' },
];

/** PIS/COFINS desonerados — fixos (não variam por UF). */
export const PIS_DESONERADO_PCT = 1.65;
export const COFINS_DESONERADO_PCT = 7;
/** ICMS 25% (Sul/Sudeste → N/NE/CO): desconto = 28% da alíquota (7%). Demais: integral. */
export const ICMS_ALIQUOTA_REDUCIDA_FATOR = 0.28;
export const ICMS_ALIQUOTA_SUL_N = 25;

const SUL_SUDESTE = new Set(['PR', 'SC', 'RS', 'SP', 'RJ', 'MG']);
const N_NE_CO_ES = new Set([
  'AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO',
  'AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE',
  'DF', 'GO', 'MT', 'MS', 'ES',
]);

/** Alíquota ICMS interestadual (produtos industrializados — tabela simplificada CONFAZ). */
export function icmsInterestadual(ufOrigem, ufDestino) {
  const o = String(ufOrigem || '').toUpperCase();
  const d = String(ufDestino || '').toUpperCase();
  if (!o || !d || o === d) return 0;
  const oSulSudeste = SUL_SUDESTE.has(o);
  const dSulSudeste = SUL_SUDESTE.has(d);
  const oEs = o === 'ES';
  const dEs = d === 'ES';
  const dNneCoEs = N_NE_CO_ES.has(d);
  const oNneCoEs = N_NE_CO_ES.has(o) || oEs;
  if (oSulSudeste && !oEs && dNneCoEs) return 25;
  if (oNneCoEs && dSulSudeste && !dEs) return 12;
  if (oSulSudeste && dSulSudeste) return 12;
  if (oNneCoEs && dNneCoEs) return 12;
  return 12;
}

function roundPct(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** Desconto ICMS (%): integral se alíquota < 25%; se 25% (Sul→N) aplica 28% → 7%. */
export function calcIcmsDescontoPct(icms) {
  const ic = Number(icms) || 0;
  if (ic >= ICMS_ALIQUOTA_SUL_N) {
    return roundPct(ic * ICMS_ALIQUOTA_REDUCIDA_FATOR);
  }
  return roundPct(ic);
}

/**
 * Desconto regime Suframa (% sobre preço de fábrica).
 * Retorna detalhe ICMS + PIS/COFINS + total.
 */
export function calcDescontoRegime({ icms, destino, tributario }) {
  const ic = Number(icms) || 0;
  if (destino === 'amoc') {
    return { icms: ic, icmsDesconto: 0, pis: 0, cofins: 0, incentivo: 0 };
  }
  const icmsDesconto = calcIcmsDescontoPct(ic);
  const vedaPisCofins = destino === 'alc' && tributario === 'lucro_real';
  const pis = vedaPisCofins ? 0 : PIS_DESONERADO_PCT;
  const cofins = vedaPisCofins ? 0 : COFINS_DESONERADO_PCT;
  const incentivo = roundPct(icmsDesconto + pis + cofins);
  return { icms: ic, icmsDesconto, pis, cofins, incentivo };
}

/** @deprecated alias — use calcDescontoRegime */
export function calcIncentivoSuframaPct({ icms, destino, tributario }) {
  return calcDescontoRegime({ icms, destino, tributario }).incentivo;
}

export function calcRegimeIncentivoFromState({ fabricanteUf, compradorUf, destino, tributario }) {
  const icms = icmsInterestadual(fabricanteUf, compradorUf);
  const breakdown = calcDescontoRegime({ icms, destino, tributario });
  return { icms, ...breakdown };
}

/** Gera bloco JS para embed no HTML do catálogo (mesma lógica, sem imports). */
export function buildSuframaClientJs({ fabricanteUf = 'SC', fabricanteNome = 'Formigres' } = {}) {
  return `
    const FABRICANTE_UF = ${JSON.stringify(String(fabricanteUf).toUpperCase())};
    const FABRICANTE_NOME = ${JSON.stringify(fabricanteNome)};
    const UF_LIST = ${JSON.stringify(UF_LIST)};
    const PIS_DESONERADO_PCT = ${PIS_DESONERADO_PCT};
    const COFINS_DESONERADO_PCT = ${COFINS_DESONERADO_PCT};
    const ICMS_ALIQUOTA_REDUCIDA_FATOR = ${ICMS_ALIQUOTA_REDUCIDA_FATOR};
    const ICMS_ALIQUOTA_SUL_N = ${ICMS_ALIQUOTA_SUL_N};
    const _SUL_SUDESTE = new Set(['PR','SC','RS','SP','RJ','MG']);
    const _N_NE_CO_ES = new Set(['AC','AM','AP','PA','RO','RR','TO','AL','BA','CE','MA','PB','PE','PI','RN','SE','DF','GO','MT','MS','ES']);
    function icmsInterestadual(ufOrigem, ufDestino) {
      const o = String(ufOrigem || '').toUpperCase();
      const d = String(ufDestino || '').toUpperCase();
      if (!o || !d || o === d) return 0;
      const oSulSudeste = _SUL_SUDESTE.has(o);
      const dSulSudeste = _SUL_SUDESTE.has(d);
      const oEs = o === 'ES';
      const dEs = d === 'ES';
      const dNneCoEs = _N_NE_CO_ES.has(d);
      const oNneCoEs = _N_NE_CO_ES.has(o) || oEs;
      if (oSulSudeste && !oEs && dNneCoEs) return 25;
      if (oNneCoEs && dSulSudeste && !dEs) return 12;
      if (oSulSudeste && dSulSudeste) return 12;
      if (oNneCoEs && dNneCoEs) return 12;
      return 12;
    }
    function calcIcmsDescontoPct(icms) {
      const ic = Number(icms) || 0;
      if (ic >= ICMS_ALIQUOTA_SUL_N) {
        return Math.round(ic * ICMS_ALIQUOTA_REDUCIDA_FATOR * 100) / 100;
      }
      return Math.round(ic * 100) / 100;
    }
    function calcDescontoRegime(opts) {
      const ic = Number(opts.icms) || 0;
      if (opts.destino === 'amoc') {
        return { icms: ic, icmsDesconto: 0, pis: 0, cofins: 0, incentivo: 0 };
      }
      const icmsDesconto = calcIcmsDescontoPct(ic);
      const vedaPisCofins = opts.destino === 'alc' && opts.tributario === 'lucro_real';
      const pis = vedaPisCofins ? 0 : PIS_DESONERADO_PCT;
      const cofins = vedaPisCofins ? 0 : COFINS_DESONERADO_PCT;
      const incentivo = Math.round((icmsDesconto + pis + cofins) * 100) / 100;
      return { icms: ic, icmsDesconto: icmsDesconto, pis: pis, cofins: cofins, incentivo: incentivo };
    }
    function calcIncentivoSuframaPct(opts) {
      return calcDescontoRegime(opts).incentivo;
    }
    function calcRegimeIncentivoFromState(state) {
      const icms = icmsInterestadual(FABRICANTE_UF, state.compradorUf);
      const breakdown = calcDescontoRegime({ icms: icms, destino: state.destino, tributario: state.tributario });
      return Object.assign({ icms: icms }, breakdown);
    }
  `.trim();
}
