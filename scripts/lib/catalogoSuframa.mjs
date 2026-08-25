/**
 * ICMS interestadual + incentivo Suframa para catálogo B2B (client-side embed).
 * Fabricante (UF origem) vem do template; comprador informa UF destino no diálogo.
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

/**
 * Incentivo Suframa (% sobre preço) a partir do ICMS interestadual.
 * ZFM/ALC presumido: 65% do ICMS · ALC lucro real: 28% do ICMS · Amoc: 0 (IPI).
 */
export function calcIncentivoSuframaPct({ icms, destino, tributario }) {
  const ic = Number(icms) || 0;
  if (destino === 'amoc') return 0;
  if (destino === 'alc' && tributario === 'lucro_real') {
    return Math.round(ic * 0.28 * 100) / 100;
  }
  return Math.round(ic * 0.65 * 100) / 100;
}

export function calcRegimeIncentivoFromState({ fabricanteUf, compradorUf, destino, tributario }) {
  const icms = icmsInterestadual(fabricanteUf, compradorUf);
  const incentivo = calcIncentivoSuframaPct({ icms, destino, tributario });
  return { icms, incentivo };
}

/** Gera bloco JS para embed no HTML do catálogo (mesma lógica, sem imports). */
export function buildSuframaClientJs({ fabricanteUf = 'SC', fabricanteNome = 'Formigres' } = {}) {
  return `
    const FABRICANTE_UF = ${JSON.stringify(String(fabricanteUf).toUpperCase())};
    const FABRICANTE_NOME = ${JSON.stringify(fabricanteNome)};
    const UF_LIST = ${JSON.stringify(UF_LIST)};
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
    function calcIncentivoSuframaPct(opts) {
      const ic = Number(opts.icms) || 0;
      if (opts.destino === 'amoc') return 0;
      if (opts.destino === 'alc' && opts.tributario === 'lucro_real') {
        return Math.round(ic * 0.28 * 100) / 100;
      }
      return Math.round(ic * 0.65 * 100) / 100;
    }
    function calcRegimeIncentivoFromState(state) {
      const icms = icmsInterestadual(FABRICANTE_UF, state.compradorUf);
      const incentivo = calcIncentivoSuframaPct({ icms, destino: state.destino, tributario: state.tributario });
      return { icms, incentivo };
    }
  `.trim();
}
