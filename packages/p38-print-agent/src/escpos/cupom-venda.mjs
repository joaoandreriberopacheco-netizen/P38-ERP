/**
 * Geração ESC/POS — espelho de imprimirCupomTermicoEscpos.ts (padrão extenso).
 */

const ESC = '\x1B';
const GS = '\x1D';

export const ESCPOS = {
  INIT: ESC + '@',
  ALIGN_CENTER: ESC + 'a' + '1',
  ALIGN_LEFT: ESC + 'a' + '0',
  ALIGN_RIGHT: ESC + 'a' + '2',
  BOLD_ON: ESC + 'E' + '1',
  BOLD_OFF: ESC + 'E' + '0',
  SIZE_NORMAL: GS + '!' + '\x00',
  SIZE_DOUBLE: GS + '!' + '\x11',
  CUT: GS + 'V' + '1',
  FEED: ESC + 'd' + '3',
  LINE_FEED: '\n',
};

function formatarValor(valor) {
  const num = parseFloat(String(valor)) || 0;
  return num.toFixed(2);
}

function centralizar(texto, largura = 48) {
  const padding = Math.max(0, Math.floor((largura - texto.length) / 2));
  return ' '.repeat(padding) + texto;
}

function linha(char = '-', largura = 48) {
  return char.repeat(largura);
}

export function gerarCupomESCPOS(pedido, dadosEmpresa) {
  let cupom = ESCPOS.INIT;

  cupom += ESCPOS.ALIGN_CENTER;
  cupom += ESCPOS.SIZE_DOUBLE + ESCPOS.BOLD_ON;
  cupom += String(dadosEmpresa?.nome_fantasia || dadosEmpresa?.razao_social || 'VAREJOSYNC').toUpperCase() + ESCPOS.LINE_FEED;
  cupom += ESCPOS.BOLD_OFF + ESCPOS.SIZE_NORMAL;

  if (dadosEmpresa?.endereco) {
    cupom += String(dadosEmpresa.endereco);
    if (dadosEmpresa.numero) cupom += ', ' + dadosEmpresa.numero;
    cupom += ESCPOS.LINE_FEED;
  }

  if (dadosEmpresa?.bairro || dadosEmpresa?.cidade) {
    if (dadosEmpresa.bairro) cupom += String(dadosEmpresa.bairro) + ' - ';
    if (dadosEmpresa.cidade) cupom += String(dadosEmpresa.cidade);
    if (dadosEmpresa.estado) cupom += '/' + dadosEmpresa.estado;
    cupom += ESCPOS.LINE_FEED;
  }

  if (dadosEmpresa?.cep) cupom += 'CEP: ' + dadosEmpresa.cep + ESCPOS.LINE_FEED;
  if (dadosEmpresa?.cnpj) cupom += 'CNPJ: ' + dadosEmpresa.cnpj + ESCPOS.LINE_FEED;
  if (dadosEmpresa?.telefone) cupom += 'Tel: ' + dadosEmpresa.telefone + ESCPOS.LINE_FEED;

  cupom += ESCPOS.LINE_FEED;
  cupom += linha() + ESCPOS.LINE_FEED;

  cupom += ESCPOS.SIZE_DOUBLE + ESCPOS.BOLD_ON;
  cupom += centralizar('CUPOM Nº ' + String(pedido.numero || 'S/N')) + ESCPOS.LINE_FEED;
  cupom += ESCPOS.BOLD_OFF + ESCPOS.SIZE_NORMAL;
  cupom += linha() + ESCPOS.LINE_FEED;
  cupom += ESCPOS.ALIGN_LEFT;

  const dataHora = new Date(String(pedido.created_date || pedido.created_at || new Date()));
  const dataFormatada = String(dataHora.getDate()).padStart(2, '0') + '/' +
    String(dataHora.getMonth() + 1).padStart(2, '0') + '/' +
    String(dataHora.getFullYear()).slice(-2) + ' ' +
    String(dataHora.getHours()).padStart(2, '0') + ':' +
    String(dataHora.getMinutes()).padStart(2, '0');

  cupom += ESCPOS.SIZE_DOUBLE;
  cupom += 'DATA/HORA: ' + dataFormatada + ESCPOS.LINE_FEED;
  cupom += 'CLIENTE: ' + String(pedido.cliente_nome || 'AVULSO').substring(0, 28).toUpperCase() + ESCPOS.LINE_FEED;
  cupom += ESCPOS.SIZE_NORMAL;
  cupom += linha() + ESCPOS.LINE_FEED;

  const itens = pedido.itens
    ? [...pedido.itens].sort((a, b) =>
      String(a?.produto_nome || '').localeCompare(String(b?.produto_nome || ''))
    )
    : [];

  itens.forEach((item, idx) => {
    const nome = String(item?.produto_nome || '').toUpperCase();
    const qtd = parseFloat(String(item?.quantidade)).toFixed(0);
    const preco = formatarValor(item?.preco_unitario_praticado);
    const total = formatarValor(item?.total);

    cupom += ESCPOS.SIZE_DOUBLE + ESCPOS.BOLD_ON;
    cupom += String(idx + 1).padStart(2, '0') + ' ' + nome.substring(0, 32) + ESCPOS.LINE_FEED;
    cupom += ESCPOS.BOLD_OFF;
    cupom += '  ' + qtd + ' UN x R$ ' + preco + ' = R$ ' + total + ESCPOS.LINE_FEED;
    cupom += ESCPOS.SIZE_NORMAL;
  });

  cupom += linha() + ESCPOS.LINE_FEED;
  cupom += ESCPOS.ALIGN_RIGHT;
  cupom += ESCPOS.SIZE_DOUBLE;
  cupom += 'SUBTOTAL: R$ ' + formatarValor(pedido.subtotal || pedido.total || 0) + ESCPOS.LINE_FEED;

  if (Number(pedido.valor_desconto) > 0) {
    cupom += 'DESCONTO: R$ ' + formatarValor(pedido.valor_desconto) + ESCPOS.LINE_FEED;
  }
  if (Number(pedido.valor_frete) > 0) {
    cupom += 'FRETE: R$ ' + formatarValor(pedido.valor_frete) + ESCPOS.LINE_FEED;
  }

  cupom += ESCPOS.BOLD_ON;
  cupom += 'TOTAL: R$ ' + formatarValor(pedido.valor_total || pedido.total || 0) + ESCPOS.LINE_FEED;
  cupom += ESCPOS.BOLD_OFF + ESCPOS.SIZE_NORMAL;
  cupom += ESCPOS.ALIGN_LEFT;
  cupom += linha() + ESCPOS.LINE_FEED;

  if (pedido.pagamentos?.length) {
    cupom += ESCPOS.SIZE_DOUBLE + ESCPOS.BOLD_ON;
    cupom += 'PAGAMENTO:' + ESCPOS.BOLD_OFF + ESCPOS.LINE_FEED;
    pedido.pagamentos.forEach((pag) => {
      const forma = String(pag?.forma_pagamento || '').toUpperCase();
      const parcelas = Number(pag?.parcelas) > 1 ? ` ${pag.parcelas}x` : '';
      cupom += forma + parcelas + ': R$ ' + formatarValor(pag?.valor) + ESCPOS.LINE_FEED;
    });
    cupom += ESCPOS.SIZE_NORMAL;
    cupom += linha() + ESCPOS.LINE_FEED;
  }

  cupom += ESCPOS.ALIGN_CENTER;
  cupom += ESCPOS.LINE_FEED;
  cupom += String(dadosEmpresa?.mensagem_rodape || 'OBRIGADO PELA PREFERENCIA!') + ESCPOS.LINE_FEED;
  cupom += ESCPOS.LINE_FEED;
  cupom += 'Este documento nao possui validade fiscal' + ESCPOS.LINE_FEED;
  cupom += ESCPOS.FEED;
  cupom += ESCPOS.CUT;

  return cupom;
}
