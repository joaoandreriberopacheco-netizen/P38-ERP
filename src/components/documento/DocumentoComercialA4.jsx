import React, { useEffect } from 'react';
import { normalizeEmpresaCupom, extractObservacoesUsuario } from '@/lib/orcamentoRapidoCupom';
import {
  buildResumoDocumentoComercial,
  DOCUMENTO_COMERCIAL_A4_BORDER,
  DOCUMENTO_COMERCIAL_A4_BORDER_STRONG,
  documentoComercialA4DocStyle,
  documentoComercialA4PageStyle,
  ensureDocumentoComercialA4FontLoaded,
  fmtDataDocumento,
  fmtMoedaBRL,
  fmtNumeroPt,
  itensTemColunaCaixas,
  labelColunaPrecoUnit,
  labelColunaQuantidade,
} from '@/lib/documentoComercialA4';

const lineBottom = `1px solid ${DOCUMENTO_COMERCIAL_A4_BORDER}`;
const lineBottomStrong = `1px solid ${DOCUMENTO_COMERCIAL_A4_BORDER_STRONG}`;

const thStyle = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#111',
  textAlign: 'left',
  padding: '6px 0 8px',
  borderBottom: lineBottomStrong,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  verticalAlign: 'middle',
};

const tdStyleBase = {
  padding: '10px 0',
  borderBottom: lineBottom,
};

const tdStyleProduto = {
  ...tdStyleBase,
  verticalAlign: 'middle',
};

const tdStyleResumo = {
  ...tdStyleBase,
  verticalAlign: 'top',
};

const colQty = { width: '12%', textAlign: 'right', whiteSpace: 'nowrap', paddingRight: '8px' };
const colDesc = { width: '40%', paddingRight: '12px' };
const colNum = { width: '14%', textAlign: 'right', whiteSpace: 'nowrap' };
const colCx = { width: '10%', textAlign: 'right', whiteSpace: 'nowrap' };
const colSep = {
  width: '12px',
  textAlign: 'center',
  color: '#b0b0b0',
  padding: '10px 0',
  verticalAlign: 'middle',
  fontWeight: 400,
  fontSize: '12px',
  lineHeight: 1,
};

function linhaItemTotal(item) {
  if (item.total_liquido != null) return Number(item.total_liquido) || 0;
  if (item.total != null) return Number(item.total) || 0;
  const qtd = Number(item.qtd ?? item.quantidade) || 0;
  const preco = Number(item.preco_unit ?? item.preco_unitario) || 0;
  return qtd * preco;
}

function linhaItemPrecoUnit(item) {
  if (item.preco_unit_liquido != null) return Number(item.preco_unit_liquido) || 0;
  return Number(item.preco_unit ?? item.preco_unitario) || 0;
}

/**
 * Documento A4 comercial (orçamento / pedido de venda).
 * Mantém id="cupom-print" para fluxos de impressão/PDF existentes.
 */
export default function DocumentoComercialA4({
  tipo = 'orcamento',
  empresa = null,
  clienteNome = '',
  numero = '',
  data = new Date(),
  titulo = '',
  subtitulo = '',
  itens = [],
  subtotal = 0,
  desconto = 0,
  frete = null,
  freteIncluso = false,
  total = 0,
  observacoes = '',
  vendedorNome = '',
  pagamentos = [],
  avisoPreco = '',
  rodapeLegal = 'Este documento não possui validade fiscal.',
  printId = 'cupom-print',
}) {
  const empresaNorm = normalizeEmpresaCupom(empresa);
  const observacoesUsuario = extractObservacoesUsuario(observacoes);
  const lista = Array.isArray(itens) ? itens : [];
  const comCaixas = itensTemColunaCaixas(lista);
  const st = Number(subtotal) || lista.reduce((s, i) => s + linhaItemTotal(i), 0);
  const desc = Math.max(Number(desconto) || 0, 0);
  const tot = Number(total) || Math.max(st - desc, 0);
  const resumo = buildResumoDocumentoComercial(lista, tot);

  const tituloDoc = titulo
    || (tipo === 'pedido_venda'
      ? `Pedido de venda${numero ? ` nº ${numero}` : ''}`
      : 'Orçamento');

  const metaData = fmtDataDocumento(data);
  const labelQty = labelColunaQuantidade(lista);
  const labelUnit = labelColunaPrecoUnit(lista);

  const somaCaixas = comCaixas
    ? lista.reduce((s, i) => s + (Number(i.caixas ?? i.quantidade_caixas) || 0), 0)
    : 0;
  const somaQty = lista.reduce((s, i) => s + (Number(i.qtd ?? i.quantidade) || 0), 0);

  const freteValor = Number(frete);
  const temFreteLinha = Boolean(freteIncluso) || (Number.isFinite(freteValor) && freteValor > 0);

  const pagamentosLista = Array.isArray(pagamentos) ? pagamentos.filter((p) => p?.valor > 0) : [];

  useEffect(() => {
    ensureDocumentoComercialA4FontLoaded().catch(() => {});
  }, []);

  const metaLinhaStyle = {
    fontSize: '12px',
    color: '#666',
    marginTop: '3px',
    lineHeight: 1.45,
  };

  return (
    <div id={printId} className="p38-documento-comercial-a4" style={documentoComercialA4PageStyle}>
      <div style={documentoComercialA4DocStyle}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '28px',
            marginBottom: '22px',
            paddingBottom: '16px',
            borderBottom: lineBottom,
          }}
        >
          {empresaNorm?.nome ? (
            <div style={{ flex: '1 1 50%', minWidth: 0 }}>
              {empresa?.logo_url && (
                <img
                  src={empresa.logo_url}
                  alt=""
                  style={{ maxWidth: '140px', maxHeight: '56px', display: 'block', marginBottom: '10px', objectFit: 'contain' }}
                />
              )}
              <div style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '4px' }}>
                {empresaNorm.nome}
              </div>
              {empresaNorm.razaoSocial && (
                <div style={{ fontSize: '12px', color: '#555', marginBottom: '2px' }}>{empresaNorm.razaoSocial}</div>
              )}
              <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.5 }}>
                {empresaNorm.cnpj && <div>CNPJ {empresaNorm.cnpj}</div>}
                {empresaNorm.endereco && <div>{empresaNorm.endereco}</div>}
                {empresaNorm.complemento && <div>{empresaNorm.complemento}</div>}
                {empresaNorm.bairroCidade && <div>{empresaNorm.bairroCidade}</div>}
                {empresaNorm.telefone && <div>{empresaNorm.telefone}</div>}
                {empresaNorm.email && <div>{empresaNorm.email}</div>}
              </div>
            </div>
          ) : (
            <div style={{ flex: '1 1 50%' }} />
          )}

          <div style={{ flex: '0 1 46%', textAlign: 'right', minWidth: '200px' }}>
            <h1
              style={{
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                margin: 0,
                lineHeight: 1.35,
                color: '#111',
              }}
            >
              {tituloDoc}
            </h1>
            {subtitulo && <p style={{ ...metaLinhaStyle, color: '#444' }}>{subtitulo}</p>}
            <p style={metaLinhaStyle}>
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '11px' }}>Data</span>
              {' '}
              {metaData}
            </p>
            {vendedorNome && (
              <p style={metaLinhaStyle}>
                <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '11px' }}>Vendedor:</span>
                {' '}
                {vendedorNome}
              </p>
            )}
            {lista.length > 0 && (
              <p style={{ marginTop: '10px', fontSize: '13px', fontWeight: 600, color: '#111' }}>{resumo}</p>
            )}
          </div>
        </header>

        {clienteNome && (
          <div style={{ marginBottom: '22px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#666', marginBottom: '4px' }}>
              Cliente
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#111' }}>
              {String(clienteNome).toUpperCase()}
            </div>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, ...colQty, textAlign: 'right' }}>{labelQty}</th>
              <th style={{ ...thStyle, ...colSep, borderBottom: lineBottomStrong }} aria-hidden="true" />
              <th style={{ ...thStyle, ...colDesc }}>Descrição</th>
              {comCaixas && (
                <>
                  <th style={{ ...thStyle, ...colSep, borderBottom: lineBottomStrong }} aria-hidden="true" />
                  <th style={{ ...thStyle, ...colCx, textAlign: 'right' }}>Caixas</th>
                </>
              )}
              <th style={{ ...thStyle, ...colSep, borderBottom: lineBottomStrong }} aria-hidden="true" />
              <th style={{ ...thStyle, ...colNum, textAlign: 'right' }}>{labelUnit}</th>
              <th style={{ ...thStyle, ...colSep, borderBottom: lineBottomStrong }} aria-hidden="true" />
              <th style={{ ...thStyle, ...colNum, textAlign: 'right' }}>Valor total</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((item, idx) => {
              const qtd = Number(item.qtd ?? item.quantidade) || 0;
              const nome = item.nome || item.produto_nome || '';
              const cx = Number(item.caixas ?? item.quantidade_caixas);
              return (
                <tr key={item.id || item.produto_id || idx}>
                  <td style={{ ...tdStyleProduto, ...colQty }}>{fmtNumeroPt(qtd)}</td>
                  <td style={{ ...tdStyleProduto, ...colSep, borderBottom: lineBottom }}>·</td>
                  <td style={{ ...tdStyleProduto, ...colDesc }}>{nome}</td>
                  {comCaixas && (
                    <>
                      <td style={{ ...tdStyleProduto, ...colSep, borderBottom: lineBottom }}>·</td>
                      <td style={{ ...tdStyleProduto, ...colCx }}>
                        {Number.isFinite(cx) && cx > 0 ? fmtNumeroPt(cx, 0) : ''}
                      </td>
                    </>
                  )}
                  <td style={{ ...tdStyleProduto, ...colSep, borderBottom: lineBottom }}>·</td>
                  <td style={{ ...tdStyleProduto, ...colNum }}>{fmtMoedaBRL(linhaItemPrecoUnit(item))}</td>
                  <td style={{ ...tdStyleProduto, ...colSep, borderBottom: lineBottom }}>·</td>
                  <td style={{ ...tdStyleProduto, ...colNum }}>{fmtMoedaBRL(linhaItemTotal(item))}</td>
                </tr>
              );
            })}
            {lista.length > 0 && (
              <>
                <tr>
                  <td style={{ ...tdStyleResumo, ...colQty, fontWeight: 600, borderTop: lineBottomStrong, borderBottom: 'none', paddingTop: '10px' }}>
                    {fmtNumeroPt(somaQty)}
                  </td>
                  <td style={{ ...tdStyleResumo, ...colSep, borderTop: lineBottomStrong, borderBottom: 'none' }} />
                  <td style={{ ...tdStyleResumo, ...colDesc, fontWeight: 600, borderTop: lineBottomStrong, borderBottom: 'none', paddingTop: '10px' }}>
                    Subtotal
                  </td>
                  {comCaixas && (
                    <>
                      <td style={{ ...tdStyleResumo, ...colSep, borderTop: lineBottomStrong, borderBottom: 'none' }} />
                      <td style={{ ...tdStyleResumo, ...colCx, fontWeight: 600, borderTop: lineBottomStrong, borderBottom: 'none', paddingTop: '10px' }}>
                        {somaCaixas > 0 ? fmtNumeroPt(somaCaixas, 0) : ''}
                      </td>
                    </>
                  )}
                  <td style={{ ...tdStyleResumo, ...colSep, borderTop: lineBottomStrong, borderBottom: 'none' }} />
                  <td style={{ ...tdStyleResumo, ...colNum, borderTop: lineBottomStrong, borderBottom: 'none', paddingTop: '10px' }} />
                  <td style={{ ...tdStyleResumo, ...colSep, borderTop: lineBottomStrong, borderBottom: 'none' }} />
                  <td style={{ ...tdStyleResumo, ...colNum, fontWeight: 600, borderTop: lineBottomStrong, borderBottom: 'none', paddingTop: '10px' }}>
                    {fmtMoedaBRL(st)}
                  </td>
                </tr>
                {desc > 0 && (
                  <tr>
                    <td style={{ ...tdStyleResumo, ...colQty, color: '#444', fontWeight: 500 }} />
                    <td style={{ ...tdStyleResumo, ...colSep }} />
                    <td style={{ ...tdStyleResumo, ...colDesc, color: '#444', fontWeight: 500 }}>Desconto comercial</td>
                    {comCaixas && (
                      <>
                        <td style={{ ...tdStyleResumo, ...colSep }} />
                        <td style={{ ...tdStyleResumo, ...colCx }} />
                      </>
                    )}
                    <td style={{ ...tdStyleResumo, ...colSep }} />
                    <td style={{ ...tdStyleResumo, ...colNum }} />
                    <td style={{ ...tdStyleResumo, ...colSep }} />
                    <td style={{ ...tdStyleResumo, ...colNum, color: '#444', fontWeight: 500 }}>− {fmtMoedaBRL(desc)}</td>
                  </tr>
                )}
                {temFreteLinha && (
                  <tr>
                    <td style={{ ...tdStyleResumo, ...colQty, fontWeight: 600 }} />
                    <td style={{ ...tdStyleResumo, ...colSep }} />
                    <td style={{ ...tdStyleResumo, ...colDesc, fontWeight: 600 }}>Frete</td>
                    {comCaixas && (
                      <>
                        <td style={{ ...tdStyleResumo, ...colSep }} />
                        <td style={{ ...tdStyleResumo, ...colCx }} />
                      </>
                    )}
                    <td style={{ ...tdStyleResumo, ...colSep }} />
                    <td style={{ ...tdStyleResumo, ...colNum, fontWeight: 500 }}>
                      {freteIncluso ? 'Incluso' : ''}
                    </td>
                    <td style={{ ...tdStyleResumo, ...colSep }} />
                    <td style={{ ...tdStyleResumo, ...colNum }}>
                      {freteIncluso ? '—' : (freteValor > 0 ? fmtMoedaBRL(freteValor) : '—')}
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ ...tdStyleResumo, ...colQty, fontWeight: 600, fontSize: '14px', borderTop: lineBottomStrong, paddingTop: '12px', borderBottom: 'none' }} />
                  <td style={{ ...tdStyleResumo, ...colSep, borderTop: lineBottomStrong, borderBottom: 'none' }} />
                  <td style={{ ...tdStyleResumo, ...colDesc, fontWeight: 600, fontSize: '14px', borderTop: lineBottomStrong, paddingTop: '12px', borderBottom: 'none' }}>
                    Total
                  </td>
                  {comCaixas && (
                    <>
                      <td style={{ ...tdStyleResumo, ...colSep, borderTop: lineBottomStrong, borderBottom: 'none' }} />
                      <td style={{ ...tdStyleResumo, ...colCx, borderTop: lineBottomStrong, borderBottom: 'none', paddingTop: '12px' }} />
                    </>
                  )}
                  <td style={{ ...tdStyleResumo, ...colSep, borderTop: lineBottomStrong, borderBottom: 'none' }} />
                  <td style={{ ...tdStyleResumo, ...colNum, borderTop: lineBottomStrong, borderBottom: 'none', paddingTop: '12px' }} />
                  <td style={{ ...tdStyleResumo, ...colSep, borderTop: lineBottomStrong, borderBottom: 'none' }} />
                  <td style={{ ...tdStyleResumo, ...colNum, fontWeight: 600, fontSize: '14px', borderTop: lineBottomStrong, paddingTop: '12px', borderBottom: 'none' }}>
                    {fmtMoedaBRL(tot)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {(observacoesUsuario || pagamentosLista.length > 0 || avisoPreco) && (
          <div style={{ marginTop: '20px', fontSize: '12px', color: '#555', lineHeight: 1.55 }}>
            {observacoesUsuario && (
              <div style={{ whiteSpace: 'pre-wrap', marginBottom: pagamentosLista.length ? '10px' : 0 }}>
                {observacoesUsuario.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < observacoesUsuario.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            )}
            {pagamentosLista.length > 0 && (
              <div style={{ marginTop: observacoesUsuario ? '8px' : 0 }}>
                <strong style={{ color: '#333' }}>Pagamento:</strong>
                {pagamentosLista.map((pag, i) => (
                  <div key={i}>
                    {(pag.forma_pagamento || 'Forma').toUpperCase()}
                    {pag.parcelas > 1 ? ` ${pag.parcelas}x` : ''}
                    {' — '}
                    {fmtMoedaBRL(pag.valor)}
                  </div>
                ))}
              </div>
            )}
            {avisoPreco && (
              <p style={{ marginTop: '12px' }}>
                <strong>{avisoPreco}</strong>
              </p>
            )}
          </div>
        )}

        {rodapeLegal && (
          <p style={{ marginTop: '18px', fontSize: '11px', color: '#888', textAlign: 'center' }}>{rodapeLegal}</p>
        )}
      </div>
    </div>
  );
}
