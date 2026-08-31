/**
 * Propõe linha do Excel estudo (P38-sku-hierarquia-ab) a partir do cadastro legado (h1–h5).
 * Nomenclatura nova vive no Excel → manifest → UI; Supabase não é fonte de hierarquia no preview.
 */
import { planLinhaCompraAnalise, montarNomeProposto, norm } from '../hierarquiaPortal/planLinhaCompra.js';

const C1 = {
  bloco: 'C — Acabamentos (prévia)',
  sub_bloco: 'C1 Revestimentos',
  etapa: '4 — Revestimentos',
  core: 'ASSENTAMENTO_CERAMICA',
};

const LINHA_DISPLAY = {
  CERAMICA_BOLD: 'CERÂMICA BOLD',
  CERAMICA_RETIF: 'CERÂMICA RETIF',
  CIMENTO: 'CIMENTO·N',
  ARGAMASSA: 'ARGAMASSA',
  SOLDAVEL: 'SOLDÁVEL',
};

function trim(s) {
  return String(s ?? '').trim();
}

function isCeramicaProduto(produto) {
  const h1 = norm(produto.campo_hierarquico_1);
  const nome = norm(produto.nome);
  return (
    h1 === 'PISO'
    || h1.includes('CERAM')
    || h1.includes('PORCELAN')
    || h1.includes('REVEST')
    || nome.includes('CERAM')
    || nome.includes('PISO')
  );
}

function classifyCeramica(produto) {
  const blob = [
    produto.nome,
    produto.campo_hierarquico_2,
    produto.campo_hierarquico_3,
    produto.campo_hierarquico_4,
    produto.marca,
  ]
    .map(norm)
    .join(' ');

  const retif =
    blob.includes('RETIF')
    || blob.includes('PORCELAN')
    || /\b60\s*[xX]\s*120\b/.test(blob)
    || blob.includes('66X66')
    || blob.includes('66X120');

  if (retif) {
    return {
      ...C1,
      linha_codigo: 'CERAMICA_RETIF',
      linha: LINHA_DISPLAY.CERAMICA_RETIF,
      produto_compra: 'CERAM RETIF ANTI',
      eixo_a: trim(produto.campo_hierarquico_2) || '',
      eixo_b: trim(produto.campo_hierarquico_3) || trim(produto.campo_hierarquico_4) || '',
      confianca: 'alta',
      motivo: 'ceramica_retif',
    };
  }

  return {
    ...C1,
    linha_codigo: 'CERAMICA_BOLD',
    linha: LINHA_DISPLAY.CERAMICA_BOLD,
    produto_compra: 'CERAM BOLD ANTI',
    eixo_a: trim(produto.campo_hierarquico_2) || '',
    eixo_b: trim(produto.campo_hierarquico_3) || trim(produto.campo_hierarquico_4) || '',
    confianca: 'alta',
    motivo: 'ceramica_bold',
  };
}

function blocoFromPlan(plan, produto) {
  if (isCeramicaProduto(produto)) return classifyCeramica(produto);

  const h1 = norm(produto.campo_hierarquico_1);
  if (h1.includes('CIMENTO') || h1.includes('BLOCO') || h1.includes('TIJOLO') || h1.includes('AREIA')) {
    return {
      bloco: 'A — Edificações',
      sub_bloco: 'A1 Estrutura / alvenaria',
      etapa: plan.motivo?.includes('cimento') ? '1 — Estrutura' : '1 — Estrutura',
      core: 'ALVENARIA',
      linha: plan.linha_nome === 'CIMENTO' ? 'CIMENTO·N' : plan.linha_nome,
      linha_codigo: plan.linha_nome?.replace(/[^A-Z0-9]+/gi, '_').toUpperCase().slice(0, 48),
      produto_compra: plan.produto_compra_nome,
      eixo_a: plan.eixo_a || '',
      eixo_b: plan.eixo_b || '',
      confianca: plan.confianca,
      motivo: plan.motivo,
    };
  }

  if (plan.linha_nome === 'CONEXÃO SOLDÁVEL' || norm(produto.campo_hierarquico_2).includes('SOLD')) {
    return {
      bloco: 'B — Hidráulica',
      sub_bloco: 'B1 — Hidráulica',
      etapa: '2 — Instalações',
      core: 'AGUA_FRIA_SOLDAVEL',
      grupo: 'C&C — Canos e Conexões · Soldável',
      grupo_ordem: 10,
      linha: 'SOLDÁVEL',
      linha_codigo: 'SOLDAVEL',
      produto_compra: plan.produto_compra_nome,
      eixo_a: plan.eixo_a || '',
      eixo_b: plan.eixo_b || '',
      confianca: plan.confianca,
      motivo: plan.motivo,
    };
  }

  return {
    bloco: '',
    sub_bloco: '',
    etapa: '',
    core: '',
    linha: plan.linha_nome,
    linha_codigo: '',
    produto_compra: plan.produto_compra_nome,
    eixo_a: plan.eixo_a || '',
    eixo_b: plan.eixo_b || '',
    confianca: plan.confianca,
    motivo: plan.motivo,
  };
}

/**
 * @returns {object} Campos para colunas do Excel estudo + metadados
 */
export function proposeEstudoRowFromProduto(produto) {
  const plan = planLinhaCompraAnalise(produto);
  const place = blocoFromPlan(plan, produto);

  const novoSku = montarNomeProposto({
    produtoCompraNome: place.produto_compra || plan.produto_compra_nome,
    eixoA: place.eixo_a,
    eixoB: place.eixo_b,
    marca: trim(produto.marca),
  });

  return {
    codigo_interno: trim(produto.codigo_interno).toUpperCase(),
    sku_atual: trim(produto.nome),
    novo_sku: novoSku || trim(produto.nome),
    bloco: place.bloco,
    sub_bloco: place.sub_bloco,
    grupo: place.grupo || '',
    grupo_ordem: place.grupo_ordem || 0,
    etapa: place.etapa || '',
    core: place.core || '',
    linha: place.linha || plan.linha_nome,
    produto_compra: place.produto_compra || plan.produto_compra_nome,
    eixo_a: place.eixo_a,
    eixo_b: place.eixo_b,
    confianca: place.confianca || plan.confianca,
    motivo: place.motivo || plan.motivo,
    linha_codigo_sugerido: place.linha_codigo || '',
  };
}

/** Linha Excel já usa nomenclatura nova (ex.: CERAM, CERÂMICA BOLD). */
export function excelRowJaModernizado(row) {
  const blob = [
    row.linha,
    row.novo_sku,
    row.produto_compra,
    row.core,
  ]
    .map((s) => norm(s))
    .join(' ');
  if (blob.includes('CERAM')) return true;
  if (blob.includes('CERAMICA RETIF') || blob.includes('CERÂMICA RETIF')) return true;
  if (blob.includes('CERAMICA BOLD') || blob.includes('CERÂMICA BOLD')) return true;
  if (blob.includes('AGUA_FRIA_SOLDAVEL')) return true;
  return false;
}

export function shouldOverwriteExcelRow(existing, proposed, { force = false } = {}) {
  if (force) return true;
  if (!existing?.novo_sku && proposed.novo_sku) return true;
  if (excelRowJaModernizado(existing)) return false;
  const oldBlob = norm(`${existing?.novo_sku} ${existing?.linha} ${existing?.sku_atual}`);
  if (oldBlob.includes('PISO') && isCeramicaProduto({ nome: existing.sku_atual, campo_hierarquico_1: 'PISO' })) {
    return true;
  }
  return proposed.confianca === 'alta';
}
