import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Printer, Zap, Share2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { imprimirCupomTermico } from '@/functions/imprimirCupomTermico';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getUnidadeMedidaItemPedidoVenda } from '@/lib/productUnits';
import { TIMEZONE_SISTEMA } from '@/components/utils/dateUtils';
import { shareOrDownloadBlob, shouldUseMobileDocumentExport } from '@/lib/mobilePrintAndShare';
import { useCaixaNestedDialogZ } from '@/components/vendas/caixa/CaixaOverlayStackContext';
import { cn } from '@/components/utils';

/** Exibição de data/hora no fuso do negócio (Tabatinga — `TIMEZONE_SISTEMA`). */
const fmtDtTZ = (d) => d ? new Intl.DateTimeFormat('pt-BR', { timeZone: TIMEZONE_SISTEMA, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : '-';

const fmtDataTZ = (d) => {
  if (!d) return '-';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TIMEZONE_SISTEMA, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));
};

const fmtHoraTZ = (d) => {
  if (!d) return '-';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TIMEZONE_SISTEMA, hour: '2-digit', minute: '2-digit' }).format(new Date(d));
};

const buildEmpresaCupom = (dadosEmpresa) => {
  const nomeFantasia = (dadosEmpresa?.nome_fantasia || dadosEmpresa?.razao_social || 'EMPRESA').toUpperCase();
  const razaoSocial = (dadosEmpresa?.nome_fantasia && dadosEmpresa?.razao_social)
    ? dadosEmpresa.razao_social
    : null;
  return {
    nomeFantasia,
    razaoSocial,
    cnpj: dadosEmpresa?.cnpj,
    endereco: [dadosEmpresa?.endereco, dadosEmpresa?.numero].filter(Boolean).join(', '),
    bairro_cidade: [dadosEmpresa?.bairro, dadosEmpresa?.cidade, dadosEmpresa?.estado].filter(Boolean).join(' - '),
    telefone: dadosEmpresa?.telefone,
    mensagem: (dadosEmpresa?.mensagem_rodape || 'OBRIGADO PELA PREFERÊNCIA!').toUpperCase(),
  };
};

const buildClienteCupom = (pedido, dadosCliente) => {
  const nome = pedido?.cliente_nome || dadosCliente?.nome;
  if (!nome && !dadosCliente) return null;
  const enderecoLinha = dadosCliente
    ? [dadosCliente.endereco, dadosCliente.numero].filter(Boolean).join(', ')
    : null;
  const cidadeLinha = dadosCliente
    ? [dadosCliente.bairro, dadosCliente.cidade, dadosCliente.estado].filter(Boolean).join(' - ')
    : null;
  return {
    nome,
    enderecoLinha,
    cidadeLinha,
    cep: dadosCliente?.cep,
    telefone: dadosCliente?.telefone,
  };
};

// Formato brasileiro: virgula para decimais, ponto para milhares
const fmtV = (v) => {
  const num = parseFloat(v) || 0;
  const formatted = num.toFixed(2).replace('.', ','); // converte a virgula
  const parts = formatted.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // adiciona pontos nos milhares
  return parts.join(',');
};
const PRETO_CUPOM = '#000';

const ordenarItensComprovante = (itens = []) =>
  [...itens].sort((a, b) =>
    String(a?.produto_nome || '').localeCompare(String(b?.produto_nome || ''), 'pt-BR', { sensitivity: 'base' })
  );

// ── Cupom Térmico 80mm ────────────────────────────────────────────────────────
function CupomTermico({ pedido, dadosEmpresa }) {
  const itens = ordenarItensComprovante(pedido.itens || []);
  const font = "'Barlow Condensed', 'Arial Narrow', sans-serif";
  const F = 12;
  const preto = PRETO_CUPOM;
  /** Grid: quant | un | descrição (flex) | preço | total — colunas numéricas estreitas */
  const gridItens = '26px 22px minmax(0, 1fr) 42px 46px';
  const gapCol = '4px';
  const estiloGridLinha = {
    display: 'grid',
    gridTemplateColumns: gridItens,
    columnGap: gapCol,
    alignItems: 'start',
    width: '100%',
  };
  const estiloCelulaCentro = { textAlign: 'center', alignSelf: 'center' };
  const estiloDescricao = {
    textAlign: 'justify',
    hyphens: 'auto',
    WebkitHyphens: 'auto',
    msHyphens: 'auto',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    lineHeight: 1.32,
    paddingRight: '2px',
  };

  const empresa = buildEmpresaCupom(dadosEmpresa);

  const Sep = () => (
    <div style={{ margin: '4px 0', fontSize: F - 1, fontFamily: font, color: preto, letterSpacing: '1px' }}>
      {'- - - - - - - - - - - - - - - - - - - - - - - - - - - - - -'}
    </div>
  );

  return (
    <div
      id="cupom-print"
      style={{
        width: '275px', background: '#fff', color: preto,
        fontFamily: font, fontSize: F,
        padding: '8px 10px 12px', margin: '0 auto', lineHeight: '1.4',
      }}
    >
      {/* ── Cabeçalho ── */}
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        {dadosEmpresa?.logo_url && (
          <img src={dadosEmpresa.logo_url} alt="Logo" style={{ maxWidth: '100px', maxHeight: '50px', filter: 'grayscale(100%) contrast(200%)', display: 'block', margin: '0 auto 6px' }} />
        )}
        {/* Nome Fantasia — maior */}
        <div style={{ fontSize: F + 7, fontWeight: '400', letterSpacing: '0.5px', lineHeight: 1.1, marginBottom: '3px' }}>
          {empresa.nomeFantasia}
        </div>
        {/* Razão Social */}
        {empresa.razaoSocial && (
          <div style={{ fontSize: F - 1, fontWeight: '400', color: preto, lineHeight: 1.3 }}>
            {empresa.razaoSocial}
          </div>
        )}
        {/* Dados da empresa — 25% menores */}
        <div style={{ fontSize: F - 1, fontWeight: '400', color: preto, lineHeight: 1.35, marginTop: '2px' }}>
          {empresa.cnpj && <div>CNPJ: {empresa.cnpj}</div>}
          {empresa.endereco && <div>{empresa.endereco}</div>}
          {empresa.bairro_cidade && <div>{empresa.bairro_cidade}</div>}
          {empresa.telefone && <div>Fone: {empresa.telefone}</div>}
        </div>
        <div style={{ fontSize: F - 1, color: preto, marginTop: '3px' }}>Cupom nº {pedido.numero || 'S/N'}</div>
      </div>

      <Sep />

      {/* ── Meta do pedido ── */}
      <div style={{ fontSize: F, lineHeight: 1.55 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{fmtDtTZ(pedido.created_date || new Date())}</span>
          <span>Nº {pedido.numero || 'S/N'}</span>
        </div>
        {pedido.cliente_nome && <div>Cliente: {pedido.cliente_nome.toUpperCase()}</div>}
        {pedido.vendedor_nome && <div>Vendedor: {pedido.vendedor_nome}</div>}
      </div>

      <Sep />

      {/* ── Cabeçalho colunas ── */}
      <div style={{ ...estiloGridLinha, fontSize: F - 1, fontWeight: '600', color: preto, lineHeight: 1.35, marginBottom: '4px' }}>
        <span style={estiloCelulaCentro}>QUANT</span>
        <span style={estiloCelulaCentro}>UN</span>
        <span style={{ textAlign: 'left' }}>DESCRIÇÃO</span>
        <span style={{ textAlign: 'right' }}>PREÇO</span>
        <span style={{ textAlign: 'right' }}>TOTAL</span>
      </div>

      <Sep />

      <div style={{ padding: '4px 0 2px' }}>
        {itens.map((item, idx) => {
          const nome = item.produto_nome || '';
          const qtd = String(parseFloat(item.quantidade) || 0);
          const precoItem = fmtV(item.preco_unitario_praticado);
          const totalItem = fmtV(item.total);
          const unidade = getUnidadeMedidaItemPedidoVenda(item).substring(0, 4);

          return (
            <div
              key={item.pedido_venda_item_id || item.produto_id || idx}
              style={{
                ...estiloGridLinha,
                fontSize: F,
                color: preto,
                padding: '8px 0',
                marginBottom: idx < itens.length - 1 ? '4px' : 0,
                borderBottom: idx < itens.length - 1 ? `0.5px solid ${preto}` : 'none',
              }}
            >
              <span style={estiloCelulaCentro}>{qtd}</span>
              <span style={estiloCelulaCentro}>{unidade}</span>
              <span lang="pt-BR" style={{ ...estiloDescricao, textTransform: 'uppercase' }}>{nome}</span>
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap', alignSelf: 'center' }}>{precoItem}</span>
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap', alignSelf: 'center' }}>{totalItem}</span>
            </div>
          );
        })}
      </div>

      <Sep />

      {/* ── Totais ── */}
      <div style={{ marginTop: '2px' }}>
        {pedido.subtotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: F, color: preto }}>
            <span>Subtotal</span><span>R$ {fmtV(pedido.subtotal)}</span>
          </div>
        )}
        {pedido.valor_desconto > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: F, color: preto }}>
            <span>Desconto</span><span>-R$ {fmtV(pedido.valor_desconto)}</span>
          </div>
        )}
        {pedido.valor_frete > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: F, color: preto }}>
            <span>Frete</span><span>R$ {fmtV(pedido.valor_frete)}</span>
          </div>
        )}
        {/* TOTAL — hierarquia só por tamanho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: F + 6, fontWeight: '400', margin: '5px 0 3px', color: preto }}>
          <span>TOTAL</span>
          <span>R$ {fmtV(pedido.valor_total || 0)}</span>
        </div>
      </div>

      {/* ── Pagamentos ── */}
      {pedido.pagamentos && pedido.pagamentos.length > 0 && (
        <div style={{ marginTop: '2px' }}>
          {pedido.pagamentos.map((pag, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: F + 3, fontWeight: '400', color: preto }}>
              <span>{(pag.forma_pagamento || '').toUpperCase()}{pag.parcelas > 1 ? ` ${pag.parcelas}x` : ''}</span>
              <span>R$ {fmtV(pag.valor)}</span>
            </div>
          ))}
        </div>
      )}

      <Sep />

      {/* ── Rodapé ── */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: F + 3, fontWeight: '400', letterSpacing: '0.5px', margin: '4px 0 3px', color: preto }}>
          {empresa.mensagem}
        </div>
        <div style={{ fontSize: F - 1, color: preto }}>Este documento não possui validade fiscal.</div>
      </div>
    </div>
  );
}

// ── Preview com scale automático (mesma lógica do OrcamentoCupom) ─────────────
function PreviewScaled({ children }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const docWidthPx = 275;

  useEffect(() => {
    const calc = () => {
      if (!containerRef.current) return;
      const available = containerRef.current.offsetWidth - 32;
      setScale(Math.min(1, available / docWidthPx));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  return (
    <div ref={containerRef} className="w-full flex justify-center py-4 px-4">
      <div
        style={{
          width: docWidthPx,
          transformOrigin: 'top center',
          transform: `scale(${scale})`,
        }}
      >
        <div className="shadow-2xl rounded-sm overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Cupom A4 (mesma estrutura do 80mm; cabeçalho em duas colunas) ─────────────
function CupomA4({ pedido, dadosEmpresa, dadosCliente }) {
  const itens = ordenarItensComprovante(pedido.itens || []);
  const font = "'Barlow Condensed', 'Arial Narrow', sans-serif";
  const F = 14;
  const preto = PRETO_CUPOM;
  const empresa = buildEmpresaCupom(dadosEmpresa);
  const cliente = buildClienteCupom(pedido, dadosCliente);
  const dataPedido = pedido.created_date || new Date();

  const gridItens = '36px 30px minmax(0, 1fr) 56px 62px';
  const gapCol = '6px';
  const estiloGridLinha = {
    display: 'grid',
    gridTemplateColumns: gridItens,
    columnGap: gapCol,
    alignItems: 'start',
    width: '100%',
  };
  const estiloCelulaCentro = { textAlign: 'center', alignSelf: 'center' };
  const estiloDescricao = {
    textAlign: 'justify',
    hyphens: 'auto',
    WebkitHyphens: 'auto',
    msHyphens: 'auto',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    lineHeight: 1.32,
    paddingRight: '4px',
  };

  const Sep = () => (
    <div style={{ margin: '6px 0', fontSize: F - 1, fontFamily: font, color: preto, letterSpacing: '1px' }}>
      {'- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -'}
    </div>
  );

  return (
    <div
      id="cupom-print"
      style={{
        width: '210mm', minHeight: '297mm',
        background: '#fff', color: preto,
        fontFamily: font, fontSize: F,
        padding: '14mm 16mm 18mm', margin: '0 auto', lineHeight: '1.4',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12mm', marginBottom: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {dadosEmpresa?.logo_url && (
            <img
              src={dadosEmpresa.logo_url}
              alt="Logo"
              style={{ maxWidth: '120px', maxHeight: '60px', filter: 'grayscale(100%) contrast(200%)', display: 'block', marginBottom: '8px' }}
            />
          )}
          <div style={{ fontSize: F + 8, fontWeight: '400', letterSpacing: '0.5px', lineHeight: 1.1, marginBottom: '4px' }}>
            {empresa.nomeFantasia}
          </div>
          {empresa.razaoSocial && (
            <div style={{ fontSize: F, fontWeight: '400', color: preto, lineHeight: 1.3 }}>
              {empresa.razaoSocial}
            </div>
          )}
          <div style={{ fontSize: F, fontWeight: '400', color: preto, lineHeight: 1.4, marginTop: '4px' }}>
            {empresa.cnpj && <div>CNPJ: {empresa.cnpj}</div>}
            {empresa.endereco && <div>{empresa.endereco}</div>}
            {empresa.bairro_cidade && <div>{empresa.bairro_cidade}</div>}
            {empresa.telefone && <div>Fone: {empresa.telefone}</div>}
          </div>

          {cliente && (
            <div style={{ marginTop: '10px', fontSize: F, lineHeight: 1.5, color: preto }}>
              {cliente.nome && <div style={{ fontWeight: '500' }}>Cliente: {cliente.nome.toUpperCase()}</div>}
              {cliente.enderecoLinha && <div>{cliente.enderecoLinha}</div>}
              {cliente.cidadeLinha && <div>{cliente.cidadeLinha}{cliente.cep ? ` — CEP: ${cliente.cep}` : ''}</div>}
              {cliente.telefone && <div>Fone: {cliente.telefone}</div>}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '52mm', fontSize: F, lineHeight: 1.65 }}>
          <div style={{ fontSize: F + 2, marginBottom: '4px' }}>Cupom nº {pedido.numero || 'S/N'}</div>
          <div>Data: {fmtDataTZ(dataPedido)}</div>
          <div>Hora: {fmtHoraTZ(dataPedido)}</div>
          {pedido.vendedor_nome && <div style={{ marginTop: '6px' }}>Vendedor: {pedido.vendedor_nome}</div>}
        </div>
      </div>

      <Sep />

      <div style={{ ...estiloGridLinha, fontSize: F - 1, fontWeight: '600', color: preto, lineHeight: 1.35, marginBottom: '6px' }}>
        <span style={estiloCelulaCentro}>QUANT</span>
        <span style={estiloCelulaCentro}>UN</span>
        <span style={{ textAlign: 'left' }}>DESCRIÇÃO</span>
        <span style={{ textAlign: 'right' }}>PREÇO</span>
        <span style={{ textAlign: 'right' }}>TOTAL</span>
      </div>

      <Sep />

      <div style={{ padding: '6px 0 4px' }}>
        {itens.map((item, idx) => {
          const nome = item.produto_nome || '';
          const qtd = String(parseFloat(item.quantidade) || 0);
          const precoItem = fmtV(item.preco_unitario_praticado);
          const totalItem = fmtV(item.total);
          const unidade = getUnidadeMedidaItemPedidoVenda(item).substring(0, 4);

          return (
            <div
              key={item.pedido_venda_item_id || item.produto_id || idx}
              style={{
                ...estiloGridLinha,
                fontSize: F,
                color: preto,
                padding: '10px 0',
                marginBottom: idx < itens.length - 1 ? '6px' : 0,
                borderBottom: idx < itens.length - 1 ? `0.5px solid ${preto}` : 'none',
              }}
            >
              <span style={estiloCelulaCentro}>{qtd}</span>
              <span style={estiloCelulaCentro}>{unidade}</span>
              <span lang="pt-BR" style={{ ...estiloDescricao, textTransform: 'uppercase' }}>{nome}</span>
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap', alignSelf: 'center' }}>{precoItem}</span>
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap', alignSelf: 'center' }}>{totalItem}</span>
            </div>
          );
        })}
      </div>

      <Sep />

      <div style={{ marginTop: '4px' }}>
        {pedido.subtotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: F, color: preto }}>
            <span>Subtotal</span><span>R$ {fmtV(pedido.subtotal)}</span>
          </div>
        )}
        {pedido.valor_desconto > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: F, color: preto }}>
            <span>Desconto</span><span>-R$ {fmtV(pedido.valor_desconto)}</span>
          </div>
        )}
        {pedido.valor_frete > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: F, color: preto }}>
            <span>Frete</span><span>R$ {fmtV(pedido.valor_frete)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: F + 8, fontWeight: '400', margin: '8px 0 4px', color: preto }}>
          <span>TOTAL</span>
          <span>R$ {fmtV(pedido.valor_total || 0)}</span>
        </div>
      </div>

      {pedido.pagamentos && pedido.pagamentos.length > 0 && (
        <div style={{ marginTop: '4px' }}>
          {pedido.pagamentos.map((pag, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: F + 4, fontWeight: '400', color: preto }}>
              <span>{(pag.forma_pagamento || '').toUpperCase()}{pag.parcelas > 1 ? ` ${pag.parcelas}x` : ''}</span>
              <span>R$ {fmtV(pag.valor)}</span>
            </div>
          ))}
        </div>
      )}

      {pedido.observacoes && (
        <>
          <Sep />
          <div style={{ fontSize: F, color: preto, lineHeight: 1.5 }}>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>Observações</div>
            <div>{pedido.observacoes}</div>
          </div>
        </>
      )}

      <Sep />

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: F + 4, fontWeight: '400', letterSpacing: '0.5px', margin: '6px 0 4px', color: preto }}>
          {empresa.mensagem}
        </div>
        <div style={{ fontSize: F - 1, color: preto }}>Este documento não possui validade fiscal.</div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ComprovanteCompra({ pedido, open, onClose }) {
  const nestedZ = useCaixaNestedDialogZ();
  const [dadosEmpresa, setDadosEmpresa] = useState(null);
  const [dadosCliente, setDadosCliente] = useState(null);
  const [ipImpressora, setIpImpressora] = useState('');
  const [imprimindoTermica, setImprimindoTermica] = useState(false);
  const [formato, setFormato] = useState(() => localStorage.getItem('comprovante_formato_venda') || 'a4');
  const [gerando, setGerando] = useState(false);

  const escolherFormato = (novoFormato) => {
    setFormato(novoFormato);
    localStorage.setItem('comprovante_formato_venda', novoFormato);
  };

  useEffect(() => {
    if (!open) return;
    setFormato(localStorage.getItem('comprovante_formato_venda') || 'a4');
    setDadosCliente(null);
    base44.entities.DadosEmpresa.list().then(r => r?.length && setDadosEmpresa(r[0])).catch(() => {});
    if (pedido?.cliente_id) {
      base44.entities.Terceiro.get(pedido.cliente_id).then(setDadosCliente).catch(() => {});
    }
    const ip = localStorage.getItem('ip_impressora_termica');
    if (ip) setIpImpressora(ip);
  }, [open]);

  const handlePrint = async () => {
    const el = document.getElementById('cupom-print');
    if (!el) return;

    if (shouldUseMobileDocumentExport()) {
      setGerando(true);
      try {
        const pdf = await gerarPDF();
        if (!pdf) {
          toast.error('Não foi possível montar o PDF');
          return;
        }
        const fileName = `pedido-${pedido?.numero || 'comprovante'}.pdf`;
        const r = await shareOrDownloadBlob(pdf.output('blob'), fileName, 'application/pdf', `Pedido ${pedido?.numero || ''}`);
        if (r === 'downloaded') toast.success('PDF pronto — use Abrir em para imprimir');
      } catch (e) {
        if (e?.name !== 'AbortError') toast.error('Erro ao gerar PDF');
      } finally {
        setGerando(false);
      }
      return;
    }

    const pageSize = formato === 'a4' ? 'A4 portrait' : '80mm auto';

    const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Pedido ${pedido?.numero || ''}</title>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #fff; }
        @page { size: ${pageSize}; margin: 0; }
      </style>
    </head><body>${el.outerHTML}</body></html>`;

    // Remove iframe anterior se existir
    const old = document.getElementById('print-frame');
    if (old) old.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'print-frame';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
    document.body.appendChild(iframe);

    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();

    // Aguarda fontes/imagens carregarem, então imprime
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        // Remove após impressão
        setTimeout(() => iframe.remove(), 2000);
      }, 300);
    };
  };

  const gerarPDF = async () => {
    const el = document.getElementById('cupom-print');
    if (!el) return null;

    const isA4 = formato === 'a4';

    const canvas = await html2canvas(el, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');

    let pdf;
    if (isA4) {
      pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210;
      const pageH = 297;
      const ratio = canvas.width / canvas.height;
      const imgH = pageW / ratio;
      pdf.addImage(imgData, 'PNG', 0, 0, pageW, Math.min(imgH, pageH));
    } else {
      // 80mm cupom: largura fixa 80mm, altura proporcional
      const widthMm = 80;
      const heightMm = (canvas.height / canvas.width) * widthMm;
      pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [widthMm, heightMm] });
      pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);
    }

    return pdf;
  };

  const handleShare = async () => {
    setGerando(true);
    try {
      const pdf = await gerarPDF();
      if (!pdf) {
        toast.error('Não foi possível montar o PDF');
        return;
      }

      const fileName = `pedido-${pedido?.numero || 'comprovante'}.pdf`;
      const r = await shareOrDownloadBlob(pdf.output('blob'), fileName, 'application/pdf', `Pedido ${pedido?.numero || ''}`);
      if (r === 'downloaded') toast.success('PDF gerado com sucesso');
    } catch (e) {
      if (e.name !== 'AbortError') toast.error('Erro ao gerar PDF');
    } finally {
      setGerando(false);
    }
  };

  const handleImprimirTermica = async () => {
    if (!ipImpressora) { toast.error('Informe o IP da impressora térmica'); return; }
    setImprimindoTermica(true);
    try {
      const response = await imprimirCupomTermico({ pedido_id: pedido.id, ip_impressora: ipImpressora });
      if (response.data.success) {
        toast.success('Cupom enviado para impressora térmica!');
        localStorage.setItem('ip_impressora_termica', ipImpressora);
      } else {
        toast.error(response.data.error || 'Erro ao imprimir');
      }
    } catch {
      toast.error('Falha na comunicação com a impressora');
    } finally {
      setImprimindoTermica(false);
    }
  };

  if (!open || !pedido) return null;

  return (
    <div className={cn('fixed inset-0 flex flex-col bg-muted dark:bg-background', nestedZ || 'z-[60]')}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border/40 flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <span className="text-sm font-semibold text-foreground font-glacial">Comprovante</span>
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrint}
            disabled={gerando}
            size="sm"
            variant="outline"
            className="h-9 text-xs gap-1.5 rounded-xl px-3"
            title="Imprimir"
          >
            {gerando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
          </Button>
          <Button
            onClick={handleShare}
            disabled={gerando}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:hover:bg-muted dark:text-foreground h-9 text-xs gap-1.5 rounded-xl px-4"
          >
            {gerando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
            {gerando ? 'Gerando...' : 'PDF'}
          </Button>
        </div>
      </div>

      {/* Opções de formato e impressora térmica */}
      <div className="px-4 py-2 bg-card border-b border-border/40 flex-shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Formato:</span>
          <Button
            onClick={() => escolherFormato('80mm')}
            size="sm"
            variant={formato === '80mm' ? 'default' : 'outline'}
            className="h-8 text-xs"
          >
            80mm
          </Button>
          <Button
            onClick={() => escolherFormato('a4')}
            size="sm"
            variant={formato === 'a4' ? 'default' : 'outline'}
            className="h-8 text-xs"
          >
            A4
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="IP impressora térmica (ex: 192.168.1.100)"
            value={ipImpressora}
            onChange={(e) => setIpImpressora(e.target.value)}
            className="h-8 text-xs flex-1"
          />
          <Button
            onClick={handleImprimirTermica}
            disabled={imprimindoTermica}
            size="sm"
            className="h-8 bg-green-600 hover:bg-green-700 text-white whitespace-nowrap gap-1.5 text-xs"
          >
            <Zap className="w-3.5 h-3.5" />
            {imprimindoTermica ? 'Enviando...' : 'Térmica'}
          </Button>
        </div>
      </div>

      {/* Preview com scale - ocupa toda a tela */}
      <div className="flex-1 overflow-y-auto w-full">
        {formato === '80mm' ? (
          <div className="w-full h-full flex justify-center py-4 px-4">
            <div style={{ width: '275px', transformOrigin: 'top center', transform: 'scale(1)' }} className="shadow-2xl rounded-sm overflow-hidden">
              <CupomTermico pedido={pedido} dadosEmpresa={dadosEmpresa} />
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center py-4 px-4">
            <div style={{ width: `${210 * 3.7795}px`, transformOrigin: 'top center' }} className="shadow-2xl rounded-sm overflow-hidden">
              <CupomA4 pedido={pedido} dadosEmpresa={dadosEmpresa} dadosCliente={dadosCliente} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}