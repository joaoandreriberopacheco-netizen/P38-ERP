import {
  CERAM_MASSA_CRITICA_CX,
  CERAM_META_VAGAS,
  CERAM_MIN_LINHAS_SALDAVEL,
  atingeMassaCriticaCeramica,
  avaliarProdutoCompraCeramica,
} from '@/lib/modeloCatalogo/regrasCeramica';

/** Estoque em caixas para regra cerâmica (vitrine CX ou fallback base). */
export function portalEstoqueCx(row) {
  const sigla = String(row.estoque_sigla || '').toUpperCase();
  if (sigla === 'CX') return Number(row.estoque_vitrine) || 0;
  return Number(row.estoque) || 0;
}

export function enrichPortalSupplyLineCeramica(line) {
  const skusEval = line.skus.map((row) => ({
    ...row,
    estoque_simulado: portalEstoqueCx(row),
    eixo_b_texto: row.eixo_b || row.eixo_b_rotulo || '',
  }));

  const ceramica = avaliarProdutoCompraCeramica(skusEval, {
    massaCritica: CERAM_MASSA_CRITICA_CX,
    metaVagas: CERAM_META_VAGAS,
    minLinhasSaldavel: CERAM_MIN_LINHAS_SALDAVEL,
  });

  const zerados = skusEval.filter((s) => portalEstoqueCx(s) <= 0).length;
  const abaixoMassa = skusEval.filter((s) => !atingeMassaCriticaCeramica(portalEstoqueCx(s))).length;

  let veredicto;
  let veredictoTom = 'ok';

  if (ceramica.saldavel) {
    veredicto = `Saldável — ${ceramica.linhas_com_massa_critica} linhas com ≥${CERAM_MASSA_CRITICA_CX} CX (meta ${CERAM_MIN_LINHAS_SALDAVEL})`;
    veredictoTom = 'ok';
  } else if (zerados === line.skus.length) {
    veredicto = `Sem estoque — ${zerados} SKU(s) zerado(s) nesta esquadra`;
    veredictoTom = 'critico';
  } else if (ceramica.linhas_com_massa_critica < CERAM_MIN_LINHAS_SALDAVEL) {
    const faltam = CERAM_MIN_LINHAS_SALDAVEL - ceramica.linhas_com_massa_critica;
    veredicto = `Não saldável — faltam ${faltam} linha(s) com massa ≥${CERAM_MASSA_CRITICA_CX} CX (${ceramica.linhas_com_massa_critica}/${CERAM_MIN_LINHAS_SALDAVEL})`;
    veredictoTom = 'alerta';
  } else {
    veredicto = `Repor atenção — ${abaixoMassa} SKU(s) abaixo da massa crítica`;
    veredictoTom = 'alerta';
  }

  if (ceramica.posicoes_ocupadas > ceramica.meta_vagas) {
    veredicto += ` · ${ceramica.posicoes_ocupadas}/${ceramica.meta_vagas} posições (acima da meta)`;
    veredictoTom = veredictoTom === 'ok' ? 'alerta' : veredictoTom;
  } else if (ceramica.vagas_restantes > 0 && veredictoTom === 'ok') {
    veredicto += ` · ${ceramica.vagas_restantes} vaga(s) livre(s)`;
  }

  const alerta = !ceramica.saldavel || zerados > 0;

  return {
    ...line,
    ...ceramica,
    zerados,
    abaixo_massa: abaixoMassa,
    veredicto,
    veredicto_tom: veredictoTom,
    alerta,
    pfut_simulado: zerados === line.skus.length ? -3 : !ceramica.saldavel ? -1 : 12,
    massa_critica: CERAM_MASSA_CRITICA_CX,
    meta_vagas: CERAM_META_VAGAS,
    min_linhas_saldavel: CERAM_MIN_LINHAS_SALDAVEL,
  };
}

export function summarizePortalSupply(lines) {
  const total = lines.length;
  const saldaveis = lines.filter((l) => l.saldavel).length;
  const alertas = lines.filter((l) => l.alerta).length;
  return { total, saldaveis, alertas, naoSaldaveis: total - saldaveis };
}
