#!/usr/bin/env node
/**
 * Esquenta: cruza lista local com Formigres (45x45) e Cerbras (46x46).
 * Sem Supabase — só HTTP nos sites dos fornecedores.
 *
 * Uso: node scripts/esquenta-pisos-fornecedor.mjs
 */
import { findBestMatch as findFormigres } from './lib/formigresCatalog.mjs';
import { findBestMatch as findCerbras } from './lib/cerbrasCatalog.mjs';

const PRECO_TABELA_M2 = 28.5;
const DESCONTO = 0.15;
const PRECO_LIQUIDO_M2 = PRECO_TABELA_M2 * (1 - DESCONTO);

/** Lista da consulta (prints do utilizador). */
const ITENS = [
  'PISO 18X114 A ENGENHO RETIFICADO (2.13)',
  'PISO 31X120 CARBONO PLUS RETIFICADO (2.2)',
  'PISO 34X34 A ADELAIDE ESM. (2.10)(PPF341)',
  'PISO 34X34 A FLORIDA (2.10)(PPF34030) BR',
  'PISO 34X34 A MONTEREY ESM. (2.10)(PPF341)',
  'PISO 37X59 A FLOX HD (2.43)(543121) BRIL',
  'PISO 45X45 A (2.32) (PD-35199) GRANILHA',
  'PISO 45X45 A (2.32) (PD-35739) BRILHANT',
  'PISO 45X45 A ALLURE BR HD 45 (2) PEI 4',
  'PISO 45X45 A ALLURE PT HD 45 (2) PEI 2',
  'PISO 45X45 A AMENDOA 45 (2) PEI 4 FORM',
  'PISO 45X45 A ARGUS HD 45 (2) PEI 4 GARN',
  'PISO 45X45 A ASTRA BG 45 (2) PEI 4 STA',
  'PISO 45X45 A (PD-45389) (2.32) ACET. BOL',
  'PISO 45X45 A CRISTAL AZUL 45 (2) GEOM. P',
  'PISO 45X45 A DELUX 45 (2) PEI 3 STAR GOL',
  'PISO 45X45 A DELUX CL 45 (2) PEI 3 STAR',
  'PISO 45X45 A DESIGN ESM. (2.32)(PD-33010)',
  'PISO 45X45 A DESIGN ESM. (2.32)(PD-35709)',
  'PISO 45X45 A DESIGN ESM. (2.32)(PD-45029)',
  'PISO 45X45 A DESIGN ESM. (2.32)(PD-45079)',
  'PISO 45X45 A ETNA BG HD 45 (2) PEI 4 GRA',
  'PISO 45X45 A ETNA CZ HD 45 (2) PEI 4 GRAN',
  'PISO 45X45 A GLACIAL BG 45 (2) PEI 5 LE',
  'PISO 45X45 A GRIMES (2)(123241) ACETINAD',
  'PISO 45X45 A IMBUIA CL 45 (2) PEI 4 BRIL',
  'PISO 45X45 A IMBUIA M 45 (2) PEI 3 BRILH',
  'PISO 45X45 A MATRIX WHITE 45 (2) PEI 4 B',
  'PISO 45X45 A MINERALE HD 45 (2) PEI 3 JG',
  'PISO 45X45 A PASSARELA HD 45 (2) PEI 4',
  'PISO 45X45 A PLANALTO 45 (2) PEI 4 PR',
  'PISO 45X45 A SAUDI AZUL HD (2)(2064D) BR',
  'PISO 45X45 A SAUDI MADERA HD 45 (2) BRI',
  'PISO 45X45 A SHANGAI BEGE 45 (2) PEI 4 GR',
  'PISO 45X45 A SOL RED 45 (2) PEI 4 GARNIL',
  'PISO 45X45 A TRAVERTINO CINZA 45 (2) PEI',
  'PISO 45X45 A VITORIA (2)(1252PE) BRILHAN',
  'PISO 46X46 A AURORA BEGE (1.005101) (2',
  'PISO 46X46 A CARPINA DECK HD (2.3) PEI',
];

function switchOn(ok) {
  return ok ? '🟢 ON' : '⚪ OFF';
}

function fmtPrecoCaixa(m2Caixa) {
  const m2 = parseFloat(String(m2Caixa).replace(',', '.')) || 0;
  if (!m2) return '—';
  const total = m2 * PRECO_LIQUIDO_M2;
  return `R$ ${total.toFixed(2).replace('.', ',')} (${m2} m² × R$ ${PRECO_LIQUIDO_M2.toFixed(2).replace('.', ',')}/m²)`;
}

async function main() {
  const results = [];
  let stats = { formigres: 0, cerbras: 0, off: 0, fora: 0 };

  for (let i = 0; i < ITENS.length; i++) {
    const desc = ITENS[i];
    const fmt = desc.match(/(\d{2,3})\s*[xX]\s*(\d{2,3})/);
    const formato = fmt ? `${fmt[1]}x${fmt[2]}`.toLowerCase() : '';

    let row = {
      descricao: desc,
      formato,
      site: '',
      switch: '⚪ OFF',
      score: 0,
      match_titulo: '',
      match_url: '',
      busca: '',
      preco_caixa: fmtPrecoCaixa((desc.match(/\((\d+[,.]?\d*)\)/) || [])[1]),
      nota: '',
    };

    if (formato === '45x45') {
      row.site = 'Formigres';
      const { parsed, match, score, reason } = await findFormigres(desc, { requireFormatoSite: true });
      row.busca = parsed.busca;
      if (match) {
        row.switch = switchOn(true);
        row.score = score;
        row.match_titulo = match.titulo;
        row.match_url = `https://www.formigres.com.br/produto/${match.id}`;
        stats.formigres++;
      } else {
        row.nota = reason || 'sem_match';
        stats.off++;
      }
    } else if (formato === '46x46') {
      row.site = 'Cerbras';
      const { parsed, match, score, reason } = await findCerbras(desc);
      row.busca = parsed.busca;
      if (match) {
        row.switch = switchOn(true);
        row.score = score;
        row.match_titulo = match.titulo;
        row.match_url = match.url;
        stats.cerbras++;
      } else {
        row.nota = reason || 'sem_match';
        stats.off++;
      }
    } else {
      row.site = '—';
      row.nota = 'fora escopo (esquenta 45×45 / 46×46)';
      stats.fora++;
    }

    results.push(row);
    if ((i + 1) % 10 === 0) process.stderr.write(`… ${i + 1}/${ITENS.length}\n`);
  }

  console.log(JSON.stringify({
    preco_tabela_m2: PRECO_TABELA_M2,
    desconto_pct: DESCONTO * 100,
    preco_liquido_m2: PRECO_LIQUIDO_M2,
    stats,
    results,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
