import React, { useRef } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { CaixaDialogContent } from './CaixaDialogContent';
import { Button } from '@/components/ui/button';
import { Printer, X, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { openPrintWindowOrShareHtml } from '@/lib/mobilePrintAndShare';

const R = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function PromissoriaDialog({ open, onClose, pedido, valorFiado, empresaNome }) {
  if (!pedido) return null;

  const dataHoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const horaHoje = format(new Date(), 'HH:mm');
  const valorStr = R(valorFiado || 0);
  const nomeCliente = pedido.cliente_nome || '___________________________';
  const numeroPedido = pedido.numero || '—';

  const imprimir = async () => {
    const itensHtml = (pedido.itens || []).map(item =>
      `<tr>
        <td style="padding:3px 0;font-size:11px;">${item.produto_nome}</td>
        <td style="padding:3px 0;font-size:11px;text-align:center;">${item.quantidade}</td>
        <td style="padding:3px 0;font-size:11px;text-align:right;">R$ ${(item.preco_unitario_praticado || 0).toFixed(2)}</td>
        <td style="padding:3px 0;font-size:11px;text-align:right;">R$ ${(item.total || 0).toFixed(2)}</td>
      </tr>`
    ).join('');

    const doc = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Promissória / Fiado</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;padding:20px;max-width:420px;margin:0 auto;color:#111}
  .empresa{text-align:center;font-weight:700;font-size:14px;margin-bottom:2px}
  .subtitulo{text-align:center;font-size:10px;color:#666;margin-bottom:10px}
  .divider{border:none;border-top:1px dashed #999;margin:10px 0}
  .titulo{text-align:center;font-size:13px;font-weight:700;letter-spacing:1px;margin:8px 0}
  .info{font-size:11px;margin:4px 0}
  .info b{font-weight:700}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  thead tr{border-bottom:1px solid #ccc}
  thead th{font-size:10px;text-align:left;padding:2px 0;color:#555;font-weight:600}
  thead th:not(:first-child){text-align:right}
  .total-row{border-top:1px solid #ccc;margin-top:6px}
  .total-label{font-size:12px;font-weight:700}
  .total-valor{font-size:16px;font-weight:700}
  .assinatura{margin-top:28px;padding-top:8px;border-top:1px solid #555;text-align:center;font-size:10px;color:#666}
  .obs{margin-top:10px;font-size:9px;color:#888;text-align:center}
  .numero{font-size:9px;color:#aaa;text-align:right;margin-bottom:6px}
</style>
</head>
<body>
<div class="empresa">${empresaNome || 'VAREJOSYNC'}</div>
<div class="subtitulo">PROMISSÓRIA / RECIBO DE FIADO</div>
<div class="numero">${numeroPedido} · ${dataHoje} · ${horaHoje}</div>
<hr class="divider"/>

<div class="info">Cliente: <b>${nomeCliente}</b></div>
<div class="info">Operador: <b>${pedido.vendedor_nome || '—'}</b></div>

<hr class="divider"/>
<div class="titulo">ITENS DA VENDA</div>

<table>
  <thead>
    <tr>
      <th>Produto</th>
      <th style="text-align:center">Qtd</th>
      <th style="text-align:right">Unitário</th>
      <th style="text-align:right">Total</th>
    </tr>
  </thead>
  <tbody>
    ${itensHtml}
  </tbody>
</table>

${pedido.valor_desconto > 0 ? `<div class="info" style="text-align:right">Desconto: <b>− R$ ${(pedido.valor_desconto||0).toFixed(2)}</b></div>` : ''}

<hr class="divider"/>
<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
  <span class="total-label">TOTAL A PRAZO</span>
  <span class="total-valor">${valorStr}</span>
</div>
<hr class="divider"/>

<div style="margin-top:14px;padding:10px;border:1px solid #ccc;border-radius:4px">
  <div style="font-size:11px;font-weight:700;margin-bottom:6px">RECONHECIMENTO DE DÍVIDA</div>
  <div style="font-size:10px;line-height:1.5">
    Eu, <b>${nomeCliente}</b>, reconheço a dívida no valor de <b>${valorStr}</b>
    referente à compra realizada em <b>${dataHoje}</b> e me comprometo a quitar
    este valor junto ao estabelecimento.
  </div>
</div>

<div class="assinatura">
  ___________________________________<br/>
  Assinatura do cliente<br/>
  ${nomeCliente}
</div>

<div class="assinatura" style="margin-top:16px">
  ___________________________________<br/>
  Assinatura do responsável pelo caixa
</div>

<div class="obs">Não é documento fiscal · Pedido ${numeroPedido}</div>
</body>
</html>`;
    try {
      await openPrintWindowOrShareHtml(doc, `promissoria-${numeroPedido}.html`, 'Promissória / fiado', { windowFeatures: 'width=500,height=700', printDelayMs: 400 });
    } catch {
      alert('Permita pop-ups para imprimir.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <CaixaDialogContent className="max-w-sm dark:bg-background">
        {/* Preview card */}
        <div className="flex flex-col items-center gap-1 pt-2 pb-1">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-1">
            <FileText className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-base font-semibold text-foreground">Promissória / Fiado</p>
          <p className="text-xs text-muted-foreground text-center">
            {numeroPedido} · {nomeCliente}
          </p>
        </div>

        {/* Resumo mini */}
        <div className="bg-muted/50 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Valor a prazo</span>
            <span className="text-lg font-bold text-foreground">{valorStr}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Data</span>
            <span className="text-xs text-foreground/90">{dataHoje}</span>
          </div>
          {pedido.itens?.length > 0 && (
            <div className="border-t border-border/40 dark:border-white/10 pt-2 space-y-1">
              {pedido.itens.slice(0, 4).map((item, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-xs text-muted-foreground truncate max-w-[160px]">{item.produto_nome}</span>
                  <span className="text-xs text-muted-foreground ml-2">{item.quantidade}x</span>
                </div>
              ))}
              {pedido.itens.length > 4 && (
                <p className="text-xs text-muted-foreground text-right">+{pedido.itens.length - 4} itens</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-border/40">
            <X className="w-4 h-4 mr-2" /> Pular
          </Button>
          <Button onClick={imprimir} className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-card dark:hover:bg-muted dark:text-foreground">
            <Printer className="w-4 h-4 mr-2" /> Imprimir
          </Button>
        </div>
      </CaixaDialogContent>
    </Dialog>
  );
}