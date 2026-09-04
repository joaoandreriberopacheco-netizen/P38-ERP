export const ORCAMENTO_RAPIDO_AVISO_PRECO =
  'Preços sujeitos a variação. Valores informados para consulta; confirme no caixa antes da venda.';

const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCurrency = (n) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = () => new Date().toLocaleDateString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function quickBudgetItemsToCupomItens(items = []) {
  return (items || []).map((item) => ({
    nome: item.produto_nome || item.nome || '',
    qtd: Number(item.quantidade) || 0,
    preco_unit: Number(item.preco_unitario ?? item.preco_unit) || 0,
    unidade: item.unidade || item.unidade_medida || 'UN',
  }));
}

/** Linhas legado SQL / PedidoVendaItem → cupom orçamento rápido. */
export function legacyItensToCupomItens(itens = []) {
  return (itens || []).map((item) => ({
    nome: item.produto_nome || '',
    qtd: Number(item.quantidade) || 0,
    preco_unit: Number(item.preco_unitario_praticado ?? item.preco_unitario) || 0,
    unidade: item.unidade_medida || item.unidade_apresentacao || 'UN',
  }));
}

export function extractObservacoesUsuario(observacoes = '') {
  const texto = String(observacoes || '').trim();
  if (!texto) return '';
  return texto
    .split('\n')
    .filter((line) => line.trim() !== ORCAMENTO_RAPIDO_AVISO_PRECO)
    .join('\n')
    .trim();
}

/** DadosEmpresa → bloco de cabeçalho do comprovante. */
export function normalizeEmpresaCupom(empresa) {
  if (!empresa) return null;
  const nome = empresa.nome_fantasia || empresa.nome || empresa.razao_social || '';
  const razaoSocial = empresa.nome_fantasia && empresa.razao_social ? empresa.razao_social : null;
  return {
    nome,
    razaoSocial,
    cnpj: empresa.cnpj || '',
    endereco: [empresa.endereco, empresa.numero].filter(Boolean).join(', '),
    complemento: empresa.complemento || '',
    bairroCidade: [empresa.bairro, empresa.cidade, empresa.estado].filter(Boolean).join(' · '),
    telefone: empresa.telefone || '',
    email: empresa.email || '',
    site: empresa.site || '',
  };
}

export function orcamentoSalvoToCupomProps(orcamento = {}) {
  const itens = legacyItensToCupomItens(orcamento.itens);
  const subtotal = Number(orcamento.subtotal) || itens.reduce((s, i) => s + i.preco_unit * i.qtd, 0);
  const desconto = Number(orcamento.valor_desconto) || 0;
  const total = Number(orcamento.valor_total) || Math.max(subtotal - desconto, 0);
  const observacoesBase = orcamento.observacoes?.trim() || '';
  const observacoes = observacoesBase
    ? `${observacoesBase}\n\n${ORCAMENTO_RAPIDO_AVISO_PRECO}`
    : ORCAMENTO_RAPIDO_AVISO_PRECO;

  return {
    itens,
    subtotal,
    desconto,
    total,
    observacoes,
    clienteNome: orcamento.cliente_nome || '',
    numero: orcamento.numero || '',
  };
}

export function quickBudgetStateToCupomProps({
  items = [],
  descontoResumo = {},
  clienteNome = '',
  observacoes = '',
} = {}) {
  const itens = quickBudgetItemsToCupomItens(items);
  const subtotal = Number(descontoResumo.subtotal) || 0;
  const desconto = Number(descontoResumo.valorDesconto) || 0;
  const total = Number(descontoResumo.total) || 0;
  const observacoesBase = observacoes?.trim() || '';
  const observacoesFull = observacoesBase
    ? `${observacoesBase}\n\n${ORCAMENTO_RAPIDO_AVISO_PRECO}`
    : ORCAMENTO_RAPIDO_AVISO_PRECO;

  return {
    itens,
    subtotal,
    desconto,
    total,
    observacoes: observacoesFull,
    clienteNome,
  };
}

function buildEmpresaHtml(empresaNorm) {
  if (!empresaNorm?.nome) return '';
  const lines = [
    empresaNorm.razaoSocial ? `<div class="empresa-razao">${empresaNorm.razaoSocial}</div>` : '',
    empresaNorm.cnpj ? `<div>CNPJ ${empresaNorm.cnpj}</div>` : '',
    empresaNorm.endereco ? `<div>${empresaNorm.endereco}</div>` : '',
    empresaNorm.complemento ? `<div>${empresaNorm.complemento}</div>` : '',
    empresaNorm.bairroCidade ? `<div>${empresaNorm.bairroCidade}</div>` : '',
    empresaNorm.telefone ? `<div>${empresaNorm.telefone}</div>` : '',
    empresaNorm.email ? `<div>${empresaNorm.email}</div>` : '',
  ].filter(Boolean).join('');
  return `
    <div class="empresa">
      <div class="empresa-nome">${empresaNorm.nome}</div>
      ${lines}
    </div>
  `;
}

function buildItensHtml(itens = []) {
  return itens.map((item) => {
    const linhaTotal = item.preco_unit * item.qtd;
    return `
      <div class="item">
        <div>
          <div class="item-name">${item.nome}</div>
          <div class="item-meta">${item.qtd} ${item.unidade || 'UN'} × ${fmtCurrency(item.preco_unit)}</div>
        </div>
        <div class="item-total">${fmtCurrency(linhaTotal)}</div>
      </div>
    `;
  }).join('');
}

/**
 * HTML moderno (letras grandes) para compartilhar orçamento rápido.
 */
export function buildOrcamentoRapidoShareHtml({
  empresa = null,
  nomeTabela = '',
  clienteNome = '',
  numero = '',
  itens = [],
  subtotal = 0,
  desconto = 0,
  total = 0,
  observacoes = '',
  catalogSubtotal = 0,
} = {}) {
  const empresaNorm = normalizeEmpresaCupom(empresa);
  const observacoesUsuario = extractObservacoesUsuario(observacoes);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Orçamento</title>
  <style>
    body { margin: 0; font-family: 'DIN 1451', DINish, system-ui, sans-serif; background: #f8fafc; color: #111827; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
    .card { background: #fff; border-radius: 24px; box-shadow: 0 6px 24px rgba(15, 23, 42, 0.08); padding: 20px; }
    .empresa { margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #e5e7eb; }
    .empresa-nome { font-size: 22px; font-weight: 700; line-height: 1.2; margin-bottom: 6px; }
    .empresa-razao { font-size: 13px; color: #4b5563; margin-bottom: 4px; }
    .empresa div { font-size: 13px; color: #6b7280; line-height: 1.45; }
    .top { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
    h1 { margin: 0; font-size: 28px; letter-spacing: -0.02em; }
    .muted { color: #6b7280; font-size: 14px; }
    .total { text-align: right; }
    .total strong { display: block; font-size: 28px; }
    .list { margin-top: 18px; display: grid; gap: 10px; }
    .item { background: #f8fafc; border-radius: 18px; padding: 14px; display: flex; justify-content: space-between; gap: 12px; }
    .item-name { font-weight: 600; font-size: 15px; line-height: 1.35; }
    .item-meta { font-size: 13px; color: #6b7280; margin-top: 4px; }
    .item-total { font-weight: 700; font-size: 16px; white-space: nowrap; }
    .summary { margin-top: 18px; background: #f8fafc; border-radius: 18px; padding: 14px; display: grid; gap: 8px; }
    .summary-row { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
    .summary-row.total-row { font-size: 20px; font-weight: 700; }
    .obs { margin-top: 14px; padding: 12px; background: #f1f5f9; border-radius: 12px; font-size: 13px; color: #334155; line-height: 1.45; }
    .aviso { margin-top: 14px; padding: 12px 14px; background: #fffbeb; border-radius: 12px; font-size: 13px; color: #92400e; line-height: 1.45; font-weight: 600; }
    .footer { margin-top: 14px; text-align: center; font-size: 11px; color: #9ca3af; }
    .actions { margin-top: 18px; }
    .button { border: 0; border-radius: 16px; padding: 14px 18px; background: #111827; color: white; font-weight: 600; cursor: pointer; }
    @media print { body { background: white; } .wrap { padding: 0; } .card { box-shadow: none; } .actions { display: none; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      ${buildEmpresaHtml(empresaNorm)}
      <div class="top">
        <div>
          <h1>Orçamento</h1>
          ${numero ? `<div class="muted">Nº ${numero}</div>` : ''}
          ${clienteNome ? `<div class="muted">Cliente: ${clienteNome}</div>` : ''}
          ${nomeTabela ? `<div class="muted">Tabela: ${nomeTabela}</div>` : ''}
          <div class="muted">${itens.length} itens · ${fmtData()}</div>
        </div>
        <div class="total">
          <div class="muted">Total</div>
          <strong>${fmtCurrency(total)}</strong>
        </div>
      </div>
      <div class="list">${buildItensHtml(itens)}</div>
      <div class="summary">
        <div class="summary-row"><span>Subtotal</span><strong>${fmtCurrency(subtotal)}</strong></div>
        ${catalogSubtotal > 0 && catalogSubtotal < subtotal ? `<div class="summary-row"><span>Limite catálogo</span><strong>${fmtCurrency(catalogSubtotal)}</strong></div>` : ''}
        ${desconto > 0 ? `<div class="summary-row"><span>Desconto</span><strong>- ${fmtCurrency(desconto)}</strong></div>` : ''}
        <div class="summary-row total-row"><span>Total</span><strong>${fmtCurrency(total)}</strong></div>
      </div>
      ${observacoesUsuario ? `<div class="obs"><strong>Observações:</strong> ${observacoesUsuario.replace(/\n/g, '<br/>')}</div>` : ''}
      <div class="aviso">${ORCAMENTO_RAPIDO_AVISO_PRECO}</div>
      <div class="footer">Documento sem validade fiscal · Orçamento para consulta de preços</div>
      <div class="actions">
        <button class="button" onclick="window.print()">Baixar PDF</button>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export { fmtR, fmtCurrency, fmtData };
