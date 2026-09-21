/**
 * Normaliza JSON devolvido pelo Groq para o formato dos parsers locais.
 */

function asNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asStr(v) {
  return String(v ?? '').trim();
}

export function normalizarPedidoGroq(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const fornecedor = raw.fornecedor && typeof raw.fornecedor === 'object' ? raw.fornecedor : {};
  const itensRaw = Array.isArray(raw.itens) ? raw.itens : [];
  const itens = itensRaw
    .map((item) => {
      const descricao = asStr(item.descricao || item.descricao_pdf || item.nome);
      const quantidade = asNum(item.quantidade ?? item.quantidade_pdf) || 1;
      const preco = asNum(item.preco_unitario ?? item.preco_unitario_pdf);
      if (!descricao || descricao.length > 160 || !preco || preco <= 0) return null;
      return {
        descricao,
        codigo: asStr(item.codigo || item.codigo_pdf),
        codigo_barras: asStr(item.codigo_barras || item.codigo_barras_pdf),
        marca: asStr(item.marca || item.marca_pdf),
        quantidade,
        preco_unitario: preco,
        unidade_medida_documento: asStr(item.unidade_medida_documento || item.unidade) || 'UN',
      };
    })
    .filter(Boolean);

  return {
    fornecedor: {
      nome_identificado: asStr(fornecedor.nome_identificado || fornecedor.nome),
      cnpj_identificado: asStr(fornecedor.cnpj_identificado || fornecedor.cnpj),
    },
    itens,
  };
}

export function normalizarCotacaoGroq(raw) {
  const base = normalizarPedidoGroq(raw);
  if (!base) return null;
  const fin = raw.financeiro && typeof raw.financeiro === 'object' ? raw.financeiro : {};
  const itens = (Array.isArray(raw.itens) ? raw.itens : []).map((item) => {
    const descricao = asStr(item.descricao_pdf || item.descricao || item.nome);
    const quantidade = asNum(item.quantidade_pdf ?? item.quantidade) || 1;
    const preco = asNum(item.preco_unitario_pdf ?? item.preco_unitario);
    if (!descricao || !preco) return null;
    return {
      descricao_pdf: descricao,
      codigo_pdf: asStr(item.codigo_pdf || item.codigo),
      marca_pdf: asStr(item.marca_pdf || item.marca),
      quantidade_pdf: quantidade,
      preco_unitario_pdf: preco,
    };
  }).filter(Boolean);

  return {
    fornecedor: base.fornecedor,
    financeiro: {
      subtotal: asNum(fin.subtotal) ?? 0,
      desconto_global: asNum(fin.desconto_global) ?? 0,
      total_final: asNum(fin.total_final) ?? 0,
      desconto_comercial: asNum(fin.desconto_comercial) ?? 0,
      desconto_suframa: asNum(fin.desconto_suframa) ?? 0,
    },
    itens: itens.length ? itens : base.itens.map((item) => ({
      descricao_pdf: item.descricao,
      codigo_pdf: item.codigo,
      marca_pdf: item.marca,
      quantidade_pdf: item.quantidade,
      preco_unitario_pdf: item.preco_unitario,
    })),
  };
}

export function normalizarListaFotoGroq(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const itens = (Array.isArray(raw.itens) ? raw.itens : [])
    .map((item) => {
      const texto = asStr(item.texto_identificado || item.descricao || item.texto);
      if (!texto) return null;
      return {
        texto_identificado: texto,
        quantidade_escrita: item.quantidade_escrita != null ? asStr(item.quantidade_escrita) : null,
        confianca: asStr(item.confianca) || 'media',
      };
    })
    .filter(Boolean);
  return { itens };
}

export function normalizarBoletoGroq(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const valor = asNum(raw.valor_pagamento ?? raw.valor);
  const descricao = asStr(raw.descricao || raw.beneficiario);
  if (!valor && !descricao && !asStr(raw.linha_digitavel)) return null;
  return {
    descricao,
    beneficiario: asStr(raw.beneficiario || descricao),
    valor_pagamento: valor,
    data_vencimento: asStr(raw.data_vencimento) || null,
    competencia: asStr(raw.competencia) || null,
    numero_parcela: null,
    linha_digitavel: asStr(raw.linha_digitavel),
    codigo_pix_copia_cola: asStr(raw.codigo_pix_copia_cola),
    natureza_sugerida: asStr(raw.natureza_sugerida) || 'Único',
    confianca_leitura: asStr(raw.confianca_leitura) || 'media',
  };
}

export function normalizarComprovanteGroq(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const valor = asNum(raw.valor);
  const descricao = asStr(raw.descricao);
  if (!valor && !descricao) return null;
  return {
    valor,
    descricao,
    data_pagamento: asStr(raw.data_pagamento) || null,
    origem: 'groq_fallback',
  };
}

const NORMALIZERS = {
  pedido_compra: normalizarPedidoGroq,
  cotacao_pdf: normalizarCotacaoGroq,
  lista_foto: normalizarListaFotoGroq,
  boleto_agefin: normalizarBoletoGroq,
  comprovante: normalizarComprovanteGroq,
};

export function normalizarRespostaGroq(tipo, raw) {
  const fn = NORMALIZERS[tipo];
  return fn ? fn(raw) : raw;
}
