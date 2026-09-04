import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { P38MobileLine, P38MobileLineList, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';
import { ArrowLeft, Search, Printer, CheckCircle2, Camera, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import QuantidadeFracionadaInput from '@/components/vendas/QuantidadeFracionadaInput';
import { format } from 'date-fns';
import { createPageUrl } from '@/components/utils';
import { openPrintWindowOrShareHtml } from '@/lib/mobilePrintAndShare';
import SelecionarTrocaStep from '@/components/vendas/SelecionarTrocaStep';
import {
  calcularCreditoDevolucao,
  calcularLinhaCreditoDevolucao,
  calcularPrecoUnitarioCredito,
  formatValorBRL,
  pedidoItemKey,
} from '@/lib/creditoDevolucaoTroca';
import { criarRascunhoTrocaParaCaixa } from '@/lib/rascunhoTrocaCaixa';
import { hydratePedidoVendaParaDevolucao } from '@/lib/fetchPedidoVendaItens';
import { formatQuantidadeDisplay } from '@/lib/parseQuantidadeInput';

function tituloModulo(tipo) {
  if (tipo === 'Troca') return 'Troca de Produto';
  if (tipo === 'Cancelamento') return 'Cancelamento de Venda';
  return 'Devolução de Produto';
}

// Step 1: Buscar pedido
function BuscarPedidoStep({ onFound }) {
  const [numeroPedido, setNumeroPedido] = useState('');
  const [buscando, setBuscando] = useState(false);
  const { toast } = useToast();

  const buscar = async () => {
    const termo = numeroPedido.trim().toUpperCase();
    if (!termo) return;
    setBuscando(true);
    const todos = await base44.entities.PedidoVenda.list();
    const encontrado = todos.find(p =>
      p.numero?.toUpperCase() === termo ||
      p.numero?.toUpperCase().includes(termo)
    );
    if (!encontrado) {
      setBuscando(false);
      toast({ title: 'Pedido não encontrado', variant: 'destructive' });
      return;
    }
    const statusOk = ['Financeiro OK', 'Em Separação', 'Em Rota de Entrega', 'Pedido Concluído'];
    if (!statusOk.includes(encontrado.status)) {
      setBuscando(false);
      toast({ title: 'Este pedido não pode ser devolvido', description: `Status: ${encontrado.status}`, variant: 'destructive' });
      return;
    }
    const pedidoComItens = await hydratePedidoVendaParaDevolucao(base44, encontrado);
    setBuscando(false);
    if (!Array.isArray(pedidoComItens.itens) || pedidoComItens.itens.length === 0) {
      toast({
        title: 'Pedido sem itens',
        description: 'Não foi possível carregar os produtos deste pedido para devolução ou troca.',
        variant: 'destructive',
      });
      return;
    }
    onFound(pedidoComItens);
  };

  return (
    <div className="flex flex-col gap-5 p-5 max-w-lg mx-auto w-full">
      <div className="bg-card rounded-2xl p-5 shadow-sm">
        <p className="text-sm text-muted-foreground mb-4">Informe o número do pedido de venda</p>
        <div className="flex gap-3">
          <Input
            data-pulse-sensor="devolucao-troca.busca-pedido"
            autoFocus
            placeholder="Ex: PV-00042"
            value={numeroPedido}
            onChange={e => setNumeroPedido(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscar()}
            className="text-lg font-mono uppercase border-0 border-b border-border/40 rounded-none bg-transparent focus-visible:ring-0 flex-1 h-12"
          />
          <Button onClick={buscar} disabled={buscando} className="bg-card text-card-foreground rounded-xl px-6 h-12">
            {buscando ? '...' : <Search className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Step 2: Selecionar itens, forma de reembolso, fotos
function SelecionarItensStep({ pedido, tipo, onConfirm }) {
  const [qtds, setQtds] = useState(
    Object.fromEntries((pedido.itens || []).map((i) => [pedidoItemKey(i), 0]))
  );
  const [formaReembolso, setFormaReembolso] = useState('Vale Troca');
  const [aguardaSubstituto, setAguardaSubstituto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [fotos, setFotos] = useState([]); // { file, previewUrl, uploading, url }
  const [uploadingFotos, setUploadingFotos] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const totalDevolvido = calcularCreditoDevolucao(pedido, qtds);

  const itensSelecionados = (pedido.itens || []).filter((i) => (qtds[pedidoItemKey(i)] || 0) > 0);

  const handleAdicionarFotos = async (files) => {
    const novasFotos = Array.from(files).slice(0, 5 - fotos.length);
    if (novasFotos.length === 0) return;

    const previews = novasFotos.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      uploading: true,
      url: null
    }));
    setFotos(prev => [...prev, ...previews]);
    setUploadingFotos(true);

    const uploadadas = await Promise.all(
      novasFotos.map(async (file, idx) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        return { ...previews[idx], uploading: false, url: file_url };
      })
    );

    setFotos(prev => {
      const base = prev.slice(0, prev.length - novasFotos.length);
      return [...base, ...uploadadas];
    });
    setUploadingFotos(false);
  };

  const removerFoto = (idx) => {
    setFotos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirmarClick = () => {
    if (uploadingFotos) {
      toast({ title: 'Aguarde o upload das fotos', variant: 'destructive' });
      return;
    }
    const fotosUrls = fotos.filter(f => f.url).map(f => f.url);
    onConfirm({
      itensSelecionados,
      qtds,
      formaReembolso,
      motivo,
      totalDevolvido,
      fotosUrls,
      aguardaSubstituto: formaReembolso !== 'Vale Troca' && aguardaSubstituto,
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4 pb-[calc(11rem+68px+env(safe-area-inset-bottom,0px))]">
      {/* Cabeçalho do pedido */}
      <div className="bg-card rounded-2xl px-4 py-4 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-base font-semibold text-foreground">{pedido.numero}</div>
            <div className="text-sm text-muted-foreground">{pedido.cliente_nome}</div>
          </div>
          <div className="text-base font-bold text-foreground/90">{formatValorBRL(pedido.valor_total)}</div>
        </div>
      </div>

      {/* Itens */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-medium text-foreground">Selecione os itens a devolver</p>
        </div>
        <P38MobileLineList allViewports>
          {(pedido.itens || []).map((item, index) => {
            const key = pedidoItemKey(item);
            const qtd = qtds[key] || 0;
            const unitCredito = calcularPrecoUnitarioCredito(item, pedido);
            const unitLista = Number(item.preco_unitario_praticado) || 0;
            const temDesconto = unitCredito < unitLista - 0.009;
            return (
              <P38MobileLine
                key={key}
                striped={index % 2 === 1}
                accent={p38AccentKeyFromTone(qtd > 0 ? 'danger' : 'muted')}
                className="flex items-center gap-3 px-4 py-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{item.produto_nome}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatQuantidadeDisplay(item.quantidade)}x ·{' '}
                    {temDesconto ? (
                      <>
                        <span className="line-through">{formatValorBRL(unitLista)}</span>{' '}
                        <span className="font-medium text-emerald-700 dark:text-emerald-400">
                          {formatValorBRL(unitCredito)}/un
                        </span>
                      </>
                    ) : (
                      <>{formatValorBRL(unitLista)}/un</>
                    )}
                  </div>
                </div>
                <QuantidadeFracionadaInput
                  value={qtd}
                  max={item.quantidade}
                  onChange={(next) => setQtds((prev) => ({ ...prev, [key]: next }))}
                />
              </P38MobileLine>
            );
          })}
        </P38MobileLineList>
      </div>

      {/* Forma de reembolso + Motivo */}
      <div className="bg-card rounded-2xl px-4 py-5 shadow-sm space-y-4">
        <div>
          <label className="text-sm text-muted-foreground block mb-2">Forma de reembolso</label>
          <Select
            value={formaReembolso}
            onValueChange={(v) => {
              setFormaReembolso(v);
              if (v === 'Vale Troca') setAguardaSubstituto(false);
              else if (v === 'Dinheiro' || v === 'PIX') setAguardaSubstituto(true);
            }}
          >
            <SelectTrigger className="bg-muted/40 dark:bg-muted border-0 rounded-xl h-12 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="dark:bg-muted">
              <SelectItem value="Vale Troca">Vale Troca (crédito na loja)</SelectItem>
              <SelectItem value="Dinheiro">Dinheiro</SelectItem>
              <SelectItem value="PIX">PIX</SelectItem>
              <SelectItem value="Estorno Cartão">Estorno no Cartão</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(formaReembolso === 'Dinheiro' || formaReembolso === 'PIX') && (
          <label className="flex items-start gap-3 cursor-pointer rounded-xl bg-muted/40 dark:bg-muted/50 p-3">
            <Checkbox
              checked={aguardaSubstituto}
              onCheckedChange={(c) => setAguardaSubstituto(!!c)}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground/90 leading-snug">
              Cliente vai levar outro produto agora (troca no caixa)
            </span>
          </label>
        )}
        <div>
          <label className="text-sm text-muted-foreground block mb-2">Motivo</label>
          <Input
            placeholder="Ex: Produto com defeito, cliente desistiu..."
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            className="bg-muted/40 dark:bg-muted border-0 rounded-xl h-12 text-sm"
          />
        </div>
      </div>

      {/* Fotos da mercadoria */}
      <div className="bg-card rounded-2xl px-4 py-5 shadow-sm">
        <label className="text-sm text-muted-foreground block mb-3">Fotos da mercadoria (opcional)</label>
        <div className="flex flex-wrap gap-3">
          {fotos.map((foto, idx) => (
            <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0">
              <img src={foto.previewUrl} alt="" className="w-full h-full object-cover" />
              {foto.uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!foto.uploading && (
                <button
                  onClick={() => removerFoto(idx)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
            </div>
          ))}
          {fotos.length < 5 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-border/40 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-border/40 dark:hover:border-border/40 transition-colors flex-shrink-0"
            >
              <Camera className="w-5 h-5" />
              <span className="text-xs">Foto</span>
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={e => handleAdicionarFotos(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Total + Botão fixo no rodapé */}
      <div className="fixed left-0 right-0 z-[55] space-y-3 border-t border-border/40 bg-card p-4 dark:border-border/40 dark:bg-background p38-bottom-dock">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <span className="text-sm text-muted-foreground">Total a reembolsar</span>
          <span className="text-2xl font-bold text-red-600 dark:text-red-400 font-glacial">{formatValorBRL(totalDevolvido)}</span>
        </div>
        <Button
          disabled={itensSelecionados.length === 0 || totalDevolvido === 0}
          onClick={handleConfirmarClick}
          className="w-full max-w-lg mx-auto block h-14 bg-card text-card-foreground rounded-2xl font-semibold text-base"
        >
          Confirmar {tipo}
        </Button>
      </div>
    </div>
  );
}

// Step 3: Comprovante
function ComprovanteStep({ resultado, onClose }) {
  const isTroca = resultado.tipo === 'Troca';
  const titulo = isTroca ? 'Comprovante de Troca' : 'Comprovante de Devolução';

  const imprimir = async () => {
    const html = `<html><head><title>${titulo}</title>
      <style>body{font-family:monospace;font-size:13px;padding:20px;max-width:320px;margin:0 auto}
      .center{text-align:center}.dashed{border-top:2px dashed #aaa;margin:12px 0}.big{font-size:20px;font-weight:bold}.row{display:flex;justify-content:space-between;margin:6px 0}
      .alert{background:#f0fdf4;border:1px solid #86efac;padding:10px;border-radius:6px;margin:8px 0;text-align:center}
      </style></head><body>
      <div class="center"><b>VAREJOSYNC</b><br/><small>${titulo}</small></div>
      <div class="dashed"></div>
      <div class="row"><span>Nº:</span><b>${resultado.numero}</b></div>
      <div class="row"><span>Pedido Origem:</span><b>${resultado.pedidoNumero}</b></div>
      <div class="row"><span>Cliente:</span><span>${resultado.clienteNome}</span></div>
      <div class="row"><span>Data/Hora:</span><span>${format(new Date(), 'dd/MM/yyyy HH:mm')}</span></div>
      <div class="dashed"></div>
      ${isTroca ? `
      <div class="row"><span>Crédito devolução:</span><b>R$ ${(resultado.creditoDevolucao || 0).toFixed(2).replace('.', ',')}</b></div>
      <div class="row"><span>Novos produtos:</span><b>R$ ${(resultado.valorSubstitutos || 0).toFixed(2).replace('.', ',')}</b></div>
      <div class="row big"><span>Saldo:</span><span>R$ ${(resultado.saldoLiquido || 0).toFixed(2).replace('.', ',')}</span></div>
      ` : `
      <div class="row big"><span>VALOR:</span><span>-R$ ${(resultado.valorTotal || 0).toFixed(2).replace('.', ',')}</span></div>
      <div class="row"><span>Reembolso:</span><b>${resultado.formaReembolso}</b></div>
      `}
      ${resultado.valeCode ? `
        <div class="dashed"></div>
        <div class="alert">
          <b>VALE TROCA: ${resultado.valeCode}</b><br/>
          <small>Saldo: R$ ${(resultado.valeValor || resultado.valorTotal || 0).toFixed(2).replace('.', ',')}</small><br/>
          <small>Apresente este código na próxima compra</small><br/>
          <small>O código permanece válido enquanto houver saldo</small>
        </div>` : ''}
      ${resultado.diferencaPagar > 0 ? `<div class="row"><span>A pagar no caixa:</span><b>R$ ${resultado.diferencaPagar.toFixed(2).replace('.', ',')}</b></div>` : ''}
      ${resultado.senhaAtendimento ? `
        <div class="dashed"></div>
        <div class="alert" style="background:#fffbeb;border-color:#fcd34d">
          <b>SENHA CAIXA: ${resultado.senhaAtendimento.slice(-4)}</b><br/>
          <small>${resultado.senhaAtendimento}</small><br/>
          <small>Apresente no caixa para homologar o pagamento</small>
        </div>` : ''}
      <div class="dashed"></div>
      ${resultado.motivo ? `<p><small>Motivo: ${resultado.motivo}</small></p>` : ''}
      <div class="center"><small>Não é documento fiscal</small></div>
      </body></html>`;
    try {
      await openPrintWindowOrShareHtml(html, `comprovante-devolucao-${resultado.numero}.html`, 'Comprovante de devolução', {
        windowFeatures: 'width=400,height=650',
      });
    } catch {
      /* popup bloqueado */
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 p-5 max-w-lg mx-auto w-full">
      <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-[#4A5D23] dark:text-[#a4ce33]" />
      </div>

      <div className="w-full bg-card rounded-2xl shadow-sm overflow-hidden" style={{ fontFamily: 'Courier New, monospace' }}>
        <div className="px-5 py-4 text-center border-b-2 border-dashed border-border/40">
          <div className="text-sm font-bold text-foreground">VAREJOSYNC</div>
          <div className="text-xs text-muted-foreground">{titulo}</div>
        </div>
        <div className="px-5 py-4 space-y-3">
          {[
            { l: 'Número', v: resultado.numero },
            { l: 'Pedido Origem', v: resultado.pedidoNumero },
            { l: 'Cliente', v: resultado.clienteNome },
            { l: 'Data/Hora', v: format(new Date(), 'dd/MM/yyyy HH:mm') },
          ].map(({ l, v }) => (
            <div key={l} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{l}:</span>
              <span className="font-semibold text-foreground">{v}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t-2 border-b-2 border-dashed border-border/40 space-y-2">
          {isTroca ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Crédito devolução:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatValorBRL(resultado.creditoDevolucao)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Novos produtos:</span>
                <span className="font-semibold text-foreground">
                  −{formatValorBRL(resultado.valorSubstitutos)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Saldo:</span>
                <span className="text-xl font-bold font-glacial text-foreground">
                  {formatValorBRL(resultado.saldoLiquido)}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Valor reembolsado:</span>
                <span className="text-xl font-bold text-red-600 dark:text-red-400 font-glacial">
                  −{formatValorBRL(resultado.valorTotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Forma:</span>
                <span className="font-semibold text-foreground">{resultado.formaReembolso}</span>
              </div>
            </>
          )}
        </div>

        {resultado.valeCode && (
          <div className="px-5 py-4 bg-emerald-50 dark:bg-emerald-900/20 space-y-2">
            <p className="text-xs text-[#4A5D23] dark:text-[#a4ce33] text-center font-medium">Vale Troca Gerado</p>
            <p className="text-2xl font-bold text-[#4A5D23] dark:text-[#a4ce33] font-mono text-center">{resultado.valeCode}</p>
            <p className="text-xs text-muted-foreground text-center">
              Saldo: {formatValorBRL(resultado.valeValor ?? resultado.valorTotal)}
            </p>
            <div className="bg-emerald-100/60 dark:bg-emerald-900/30 rounded-xl p-3 mt-1">
              <p className="text-xs text-[#4A5D23] dark:text-[#a4ce33] text-center leading-relaxed">
                📌 Se o cliente usar apenas parte do saldo, o mesmo código continuará válido com o saldo restante.
              </p>
            </div>
          </div>
        )}

        {resultado.diferencaPagar > 0 && (
          <div className="px-5 py-3 border-t border-border/40 bg-amber-50 dark:bg-amber-900/20 space-y-2">
            <p className="text-sm text-amber-900 dark:text-amber-200 text-center">
              Cliente deve pagar <strong>{formatValorBRL(resultado.diferencaPagar)}</strong> no caixa.
            </p>
            {resultado.senhaAtendimento && (
              <div className="rounded-xl bg-card px-3 py-3 text-center">
                <p className="text-xs text-muted-foreground">Senha enviada à fila do caixa</p>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {resultado.senhaAtendimento.slice(-4)}
                </p>
                <p className="text-xs text-muted-foreground">{resultado.senhaAtendimento}</p>
              </div>
            )}
          </div>
        )}

        {resultado.motivo && (
          <div className="px-5 py-3 border-t border-border/40">
            <p className="text-xs text-muted-foreground">Motivo: {resultado.motivo}</p>
          </div>
        )}

        <div className="px-5 py-3 text-center">
          <p className="text-xs text-muted-foreground">Não é documento fiscal</p>
        </div>
      </div>

      <div className="w-full flex gap-3 pb-4">
        <button onClick={onClose} className="flex-1 h-14 bg-muted text-foreground/90 rounded-2xl font-medium text-base">
          Fechar
        </button>
        <button onClick={imprimir} className="flex-1 h-14 rounded-2xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground flex items-center justify-center gap-2 text-base">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>
    </div>
  );
}

export default function DevolucaoTrocaPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const tipo = urlParams.get('tipo') || 'Devolução';
  const [step, setStep] = useState('buscar');
  const [pedido, setPedido] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [processando, setProcessando] = useState(false);
  const { toast } = useToast();

  const handleClose = () => {
    window.location.href = createPageUrl('VendasGestao');
  };

  const handleConfirm = async ({
    itensSelecionados,
    qtds,
    formaReembolso,
    motivo,
    totalDevolvido,
    fotosUrls,
    aguardaSubstituto,
  }) => {
    setProcessando(true);
    try {
    const user = await base44.auth.me();
    const todos = await base44.entities.DevolucaoTroca.list();
    const nextNum = (todos.length > 0 ? Math.max(...todos.map(d => parseInt(d.numero?.split('-')[1] || 0) || 0)) : 0) + 1;
    const numeroDev = `DT-${String(nextNum).padStart(5, '0')}`;

    const itensDevolvidos = itensSelecionados.map(item => {
      const key = pedidoItemKey(item);
      const qtd = qtds[key] || 0;
      const linha = calcularLinhaCreditoDevolucao(item, pedido, qtd);
      return {
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        quantidade_devolvida: qtd,
        preco_unitario: linha.unitCredito,
        total: linha.total,
      };
    });

    let valeId = null;
    let valeCodigo = null;
    if (formaReembolso === 'Vale Troca') {
      const todosVales = await base44.entities.ValeCompra.list();
      const nextVale = (todosVales.length > 0 ? Math.max(...todosVales.map(v => parseInt(v.codigo?.split('-')[1] || 0) || 0)) : 0) + 1;
      valeCodigo = `VC-${String(nextVale).padStart(5, '0')}`;
      const vale = await base44.entities.ValeCompra.create({
        codigo: valeCodigo,
        valor_original: totalDevolvido,
        valor_disponivel: totalDevolvido,
        cliente_id: pedido.cliente_id,
        cliente_nome: pedido.cliente_nome,
        origem_tipo: tipo,
        pedido_origem_id: pedido.id,
        pedido_origem_numero: pedido.numero,
        status: 'Ativo',
      });
      valeId = vale.id;
    }

    await base44.entities.DevolucaoTroca.create({
      numero: numeroDev,
      tipo,
      pedido_origem_id: pedido.id,
      pedido_origem_numero: pedido.numero,
      cliente_id: pedido.cliente_id,
      cliente_nome: pedido.cliente_nome,
      itens_devolvidos: itensDevolvidos,
      valor_total_devolvido: totalDevolvido,
      forma_reembolso: formaReembolso,
      vale_compra_id: valeId,
      vale_compra_codigo: valeCodigo,
      aguarda_substituto: !!aguardaSubstituto,
      motivo,
      fotos_mercadoria: fotosUrls || [],
      operador_id: user?.id,
      operador_nome: user?.full_name,
      status: 'Processada',
    });

    for (const item of itensDevolvidos) {
      const produto = await base44.entities.Produto.get(item.produto_id);
      if (produto) {
        await base44.entities.Produto.update(item.produto_id, {
          estoque_atual: (produto.estoque_atual || 0) + item.quantidade_devolvida,
        });
        await base44.entities.MovimentacaoEstoque.create({
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          tipo: 'Entrada',
          motivo: 'Devolução',
          quantidade: item.quantidade_devolvida,
          custo_unitario: item.preco_unitario,
          referencia_tipo: 'PedidoVenda',
          referencia_id: pedido.id,
          referencia_numero: pedido.numero,
          ...(pedido.cliente_nome
            ? {
                cliente_nome: pedido.cliente_nome,
                referencia_cliente_nome: pedido.cliente_nome,
                terceiro_nome: pedido.cliente_nome,
              }
            : {}),
          usuario_responsavel: user?.full_name,
        });
      }
    }

    if (formaReembolso === 'Dinheiro') {
      const todosEstornos = await base44.entities.AutorizacaoEstorno.list();
      const nextEstorno = (todosEstornos.length > 0 ? Math.max(...todosEstornos.map(a => parseInt(a.numero?.split('-')[1] || 0) || 0)) : 0) + 1;
      const numeroEstorno = `AE-${String(nextEstorno).padStart(5, '0')}`;
      const todossTurnos = await base44.entities.TurnoCaixa.list();
      const turnosAtivos = todossTurnos.filter(t => !t.data_fechamento);
      for (const turno of turnosAtivos) {
        await base44.entities.AutorizacaoEstorno.create({
          numero: numeroEstorno,
          devolucao_id: numeroDev,
          devolucao_numero: numeroDev,
          pedido_origem_numero: pedido.numero,
          cliente_nome: pedido.cliente_nome,
          valor_autorizado: totalDevolvido,
          forma_reembolso: 'Dinheiro',
          motivo: `${tipo}${motivo ? ` - ${motivo}` : ''}`,
          turno_caixa_destino_id: turno.id,
          turno_caixa_destino_numero: turno.numero,
          gerente_aprovador_id: user?.id,
          gerente_aprovador_nome: user?.full_name,
          status: 'Pendente',
        });
      }
    } else if (formaReembolso === 'PIX') {
      const contas = await base44.entities.ContasFinanceiras.list();
      const caixaGeral = contas.find(c => c.is_caixa_geral) || contas[0];
      if (caixaGeral) {
        await base44.entities.LancamentoFinanceiro.create({
          tipo: 'Despesa',
          descricao: `${tipo} - ${numeroDev} - ${pedido.numero}`,
          valor: totalDevolvido,
          conta_financeira_id: caixaGeral.id,
          conta_financeira_nome: caixaGeral.nome,
          data_vencimento: format(new Date(), 'yyyy-MM-dd'),
          data_pagamento: format(new Date(), 'yyyy-MM-dd'),
          status: 'Pago',
          categoria: 'Outros',
          referencia_tipo: 'PedidoVenda',
          referencia_id: pedido.id,
          referencia_numero: pedido.numero,
          observacoes: `Reembolso PIX por ${tipo}`,
        });
        await base44.entities.ContasFinanceiras.update(caixaGeral.id, {
          saldo_atual: (caixaGeral.saldo_atual || 0) - totalDevolvido,
        });
      }
    }

    setResultado({
      numero: numeroDev,
      pedidoNumero: pedido.numero,
      clienteNome: pedido.cliente_nome,
      valorTotal: totalDevolvido,
      formaReembolso,
      valeCode: valeCodigo,
      motivo,
      tipo,
    });
    setStep('comprovante');
    } catch (error) {
      toast({ title: 'Erro ao processar', description: error.message, variant: 'destructive' });
    }
    setProcessando(false);
  };

  const handleConfirmTroca = async ({
    itensSelecionados,
    qtds,
    substitutos,
    creditoDevolucao,
    valorSubstitutos,
    saldoLiquido,
    saldoVale,
    diferencaPagar,
    motivo,
    fotosUrls,
  }) => {
    setProcessando(true);
    try {
      const user = await base44.auth.me();
      const todos = await base44.entities.DevolucaoTroca.list();
      const nextNum =
        (todos.length > 0
          ? Math.max(...todos.map((d) => parseInt(d.numero?.split('-')[1] || 0, 10) || 0))
          : 0) + 1;
      const numeroDev = `DT-${String(nextNum).padStart(5, '0')}`;

      const itensDevolvidos = itensSelecionados.map((item) => {
        const key = pedidoItemKey(item);
        const qtd = qtds[key] || 0;
        const linha = calcularLinhaCreditoDevolucao(item, pedido, qtd);
        return {
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          quantidade_devolvida: qtd,
          preco_unitario: linha.unitCredito,
          total: linha.total,
        };
      });

      const itensSubstitutos = substitutos.map((sub) => ({
        produto_id: sub.produto_id,
        produto_nome: sub.produto_nome,
        quantidade: sub.quantidade,
        preco_unitario: sub.preco_unitario,
        total: sub.total,
      }));

      let valeId = null;
      let valeCodigo = null;
      if (saldoVale > 0) {
        const todosVales = await base44.entities.ValeCompra.list();
        const nextVale =
          (todosVales.length > 0
            ? Math.max(...todosVales.map((v) => parseInt(v.codigo?.split('-')[1] || 0, 10) || 0))
            : 0) + 1;
        valeCodigo = `VC-${String(nextVale).padStart(5, '0')}`;
        const vale = await base44.entities.ValeCompra.create({
          codigo: valeCodigo,
          valor_original: saldoVale,
          valor_disponivel: saldoVale,
          cliente_id: pedido.cliente_id,
          cliente_nome: pedido.cliente_nome,
          origem_tipo: 'Troca',
          pedido_origem_id: pedido.id,
          pedido_origem_numero: pedido.numero,
          status: 'Ativo',
        });
        valeId = vale.id;
      }

      const formaReembolso = saldoVale > 0 ? 'Vale Troca' : diferencaPagar > 0 ? 'Dinheiro' : 'Vale Troca';

      await base44.entities.DevolucaoTroca.create({
        numero: numeroDev,
        tipo: 'Troca',
        pedido_origem_id: pedido.id,
        pedido_origem_numero: pedido.numero,
        cliente_id: pedido.cliente_id,
        cliente_nome: pedido.cliente_nome,
        itens_devolvidos: itensDevolvidos,
        itens_substitutos: itensSubstitutos,
        valor_total_devolvido: creditoDevolucao,
        valor_substitutos: valorSubstitutos,
        saldo_liquido: saldoLiquido,
        forma_reembolso: formaReembolso,
        vale_compra_id: valeId,
        vale_compra_codigo: valeCodigo,
        aguarda_substituto: diferencaPagar > 0,
        motivo,
        observacoes:
          diferencaPagar > 0
            ? `Troca no caixa — diferença a pagar: R$ ${diferencaPagar.toFixed(2)}`
            : saldoVale > 0
              ? `Vale troca gerado: ${valeCodigo}`
              : 'Troca sem saldo',
        fotos_mercadoria: fotosUrls || [],
        operador_id: user?.id,
        operador_nome: user?.full_name,
        status: 'Processada',
      });

      for (const item of itensDevolvidos) {
        const produto = await base44.entities.Produto.get(item.produto_id);
        if (produto) {
          await base44.entities.Produto.update(item.produto_id, {
            estoque_atual: (produto.estoque_atual || 0) + item.quantidade_devolvida,
          });
          await base44.entities.MovimentacaoEstoque.create({
            produto_id: item.produto_id,
            produto_nome: item.produto_nome,
            tipo: 'Entrada',
            motivo: 'Troca',
            quantidade: item.quantidade_devolvida,
            custo_unitario: item.preco_unitario,
            referencia_tipo: 'PedidoVenda',
            referencia_id: pedido.id,
            referencia_numero: pedido.numero,
            ...(pedido.cliente_nome
              ? {
                  cliente_nome: pedido.cliente_nome,
                  referencia_cliente_nome: pedido.cliente_nome,
                  terceiro_nome: pedido.cliente_nome,
                }
              : {}),
            usuario_responsavel: user?.full_name,
          });
        }
      }

      for (const item of itensSubstitutos) {
        const produto = await base44.entities.Produto.get(item.produto_id);
        if (produto) {
          await base44.entities.Produto.update(item.produto_id, {
            estoque_atual: Math.max(0, (produto.estoque_atual || 0) - item.quantidade),
          });
          await base44.entities.MovimentacaoEstoque.create({
            produto_id: item.produto_id,
            produto_nome: item.produto_nome,
            tipo: 'Saída',
            motivo: 'Troca',
            quantidade: item.quantidade,
            custo_unitario: item.preco_unitario,
            referencia_tipo: 'PedidoVenda',
            referencia_id: pedido.id,
            referencia_numero: pedido.numero,
            ...(pedido.cliente_nome
              ? {
                  cliente_nome: pedido.cliente_nome,
                  referencia_cliente_nome: pedido.cliente_nome,
                  terceiro_nome: pedido.cliente_nome,
                }
              : {}),
            usuario_responsavel: user?.full_name,
          });
        }
      }

      let rascunhoCaixa = null;
      if (diferencaPagar > 0) {
        rascunhoCaixa = await criarRascunhoTrocaParaCaixa({
          pedido,
          itensSubstitutos,
          creditoDevolucao,
          valorSubstitutos,
          diferencaPagar,
          numeroDev,
          operador: user,
          motivo,
        });
        if (rascunhoCaixa?.senha_atendimento) {
          toast({
            title: 'Senha enviada ao caixa',
            description: `Senha ${rascunhoCaixa.senha_atendimento.slice(-4)} aguardando homologação no PDV Caixa.`,
          });
        }
      }

      setResultado({
        numero: numeroDev,
        pedidoNumero: pedido.numero,
        clienteNome: pedido.cliente_nome,
        valorTotal: creditoDevolucao,
        creditoDevolucao,
        valorSubstitutos,
        saldoLiquido,
        diferencaPagar,
        valeValor: saldoVale,
        formaReembolso,
        valeCode: valeCodigo,
        senhaAtendimento: rascunhoCaixa?.senha_atendimento || null,
        motivo,
        tipo: 'Troca',
      });
      setStep('comprovante');
    } catch (error) {
      toast({ title: 'Erro ao processar troca', description: error.message, variant: 'destructive' });
    }
    setProcessando(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border/40 px-4 py-3 flex items-center flex-shrink-0 sticky top-0 z-20">
        <button
          onClick={step === 'itens' ? () => setStep('buscar') : handleClose}
          className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <ArrowLeft className="w-6 h-6 text-foreground/90" />
        </button>
        <h2 className="flex-1 text-center text-lg font-semibold text-foreground font-glacial">
          {tituloModulo(tipo)}
        </h2>
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto relative">
        {processando && (
          <div className="absolute inset-0 bg-card/80 dark:bg-background/80 flex items-center justify-center z-50">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-border/40 dark:border-white" />
          </div>
        )}
        {step === 'buscar' && <BuscarPedidoStep onFound={p => { setPedido(p); setStep('itens'); }} />}
        {step === 'itens' && pedido && tipo === 'Troca' && (
          <SelecionarTrocaStep pedido={pedido} onConfirm={handleConfirmTroca} />
        )}
        {step === 'itens' && pedido && tipo !== 'Troca' && (
          <SelecionarItensStep pedido={pedido} tipo={tipo} onConfirm={handleConfirm} />
        )}
        {step === 'comprovante' && resultado && <ComprovanteStep resultado={resultado} onClose={handleClose} />}
      </div>
    </div>
  );
}