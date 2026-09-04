import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Search, Plus, Minus, Trash2,
  CheckCircle2, Loader2, Package, ChevronDown, ChevronUp,
  X, Camera, Lock, AlertTriangle, SendHorizonal, RotateCcw, Boxes
} from "lucide-react";
import { saveConferenciaItem } from "@/functions/saveConferenciaItem";
import { omitConferenciaEspelho } from "@/lib/omitEspelhoPersist";
import { syncConferenciaItens } from "@/lib/syncConferenciaItens";
import { calcularSaldoExtratoProduto, parseEstoqueCadastro } from "@/lib/movimentacaoEstoqueSaldo";
import ProductUnitSelectorDialog from "@/components/produtos/ProductUnitSelectorDialog";
import {
  buildCountEntry,
  changeCountEntryUnit,
  formatCountQuantity,
  getCountUnitForEntry,
  getDefaultCountUnit,
  getEntryBaseQuantity,
  getEntryDisplayQuantity,
  getGroupDisplayFromBase,
  resolveInventoryProductName,
  updateCountEntryQuantity,
} from "@/lib/inventoryCountUnits";
import { filterAndSortProducts } from "@/components/compras/productMatchingUtils";

// Tela de CONTAGEM CEGA — operário NÃO vê estoque do sistema
export default function ConferenciaEditor({ conferencia: conferenciaInicial, onVoltar }) {
  const conferencia_id = conferenciaInicial.id;
  const bloqueada = ["Concluída", "Cancelada", "Aguardando Auditoria", "Aprovada"].includes(conferenciaInicial.status);

  const [produtos, setProdutos] = useState([]);
  const [busca, setBusca] = useState("");
  const [produtosFiltrados, setProdutosFiltrados] = useState([]);
  const [itens, setItens] = useState(conferenciaInicial.itens_conferidos || []);
  const [saving, setSaving] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [itemExpandido, setItemExpandido] = useState(null);
  const [modalQtd, setModalQtd] = useState(null);
  const [modalConfirmar, setModalConfirmar] = useState(false); // modal de confirmação de envio
  const [divergencias, setDivergencias] = useState([]); // produtos com diferença vs sistema
  const [verificandoDivergencias, setVerificandoDivergencias] = useState(false);
  const [unitSelector, setUnitSelector] = useState({ open: false, context: null, itemIdx: null, product: null });
  const qtdInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const buscaRef = useRef(null);

  useEffect(() => { carregar(); }, [conferencia_id]);

  const carregar = async () => {
    setLoading(true);
    // Carrega apenas nome, código, hierarquia — SEM estoque (contagem cega)
    const prods = await base44.entities.Produto.list("-nome", 2000);
    setProdutos(prods);
    setLoading(false);
  };

  useEffect(() => {
    if (!busca.trim()) { setProdutosFiltrados([]); return; }
    setProdutosFiltrados(filterAndSortProducts(produtos, busca));
  }, [busca, produtos]);

  const salvarItens = async (novosItens) => {
    setSaving(true);
    try {
      await syncConferenciaItens(conferencia_id, novosItens, produtos);
    } catch (err) {
      console.warn('Sincronia ConferenciaItem falhou:', err?.message || err);
    }
    setSaving(false);
  };

  const selecionarProduto = (produto) => {
    setBusca("");
    const nome = resolveInventoryProductName(produto);
    setModalQtd({ produto: { ...produto, nome }, qtdStr: "1", unitOption: getDefaultCountUnit(produto) });
    setTimeout(() => {
      if (qtdInputRef.current) { qtdInputRef.current.focus(); qtdInputRef.current.select(); }
    }, 100);
  };

  const confirmarQtd = async () => {
    if (!modalQtd) return;
    const qtd = parseFloat(modalQtd.qtdStr) || 0;
    const novosItens = [...itens, buildCountEntry(modalQtd.produto, qtd, modalQtd.unitOption)];
    setItens(novosItens);
    setModalQtd(null);
    setItemExpandido(modalQtd.produto.id);
    await salvarItens(novosItens);
  };

  const atualizarQtd = async (idx, delta) => {
    const novosItens = itens.map((item, i) => {
      if (i !== idx) return item;
      const produto = produtos.find(p => p.id === item.produto_id);
      const qtdAtual = getEntryDisplayQuantity(item, produto);
      return updateCountEntryQuantity(item, produto, Math.max(0, qtdAtual + delta));
    });
    setItens(novosItens);
    await salvarItens(novosItens);
  };

  const definirQtd = async (idx, valor) => {
    const qtd = parseFloat(valor) || 0;
    const novosItens = itens.map((item, i) => {
      if (i !== idx) return item;
      const produto = produtos.find(p => p.id === item.produto_id);
      return updateCountEntryQuantity(item, produto, qtd);
    });
    setItens(novosItens);
    await salvarItens(novosItens);
  };

  const abrirSeletorUnidadeItem = (idx) => {
    const item = itens[idx];
    const produto = produtos.find(p => p.id === item?.produto_id);
    if (!produto) return;
    setUnitSelector({ open: true, context: "entry", itemIdx: idx, product: produto });
  };

  const aplicarUnidadeSelecionada = async (unitOption) => {
    if (!unitOption) return;
    if (unitSelector.context === "modal") {
      setModalQtd((prev) => prev ? { ...prev, unitOption } : prev);
      setUnitSelector({ open: false, context: null, itemIdx: null, product: null });
      setTimeout(() => {
        if (qtdInputRef.current) { qtdInputRef.current.focus(); qtdInputRef.current.select(); }
      }, 50);
      return;
    }

    if (unitSelector.context === "entry" && unitSelector.itemIdx !== null) {
      const novosItens = itens.map((item, idx) => {
        if (idx !== unitSelector.itemIdx) return item;
        const produto = produtos.find(p => p.id === item.produto_id);
        return changeCountEntryUnit(item, produto, unitOption);
      });
      setItens(novosItens);
      setUnitSelector({ open: false, context: null, itemIdx: null, product: null });
      await salvarItens(novosItens);
      return;
    }

    setUnitSelector({ open: false, context: null, itemIdx: null, product: null });
  };

  const removerItem = async (idx) => {
    const novosItens = itens.filter((_, i) => i !== idx);
    setItens(novosItens);
    await salvarItens(novosItens);
  };

  // Verifica divergências vs sistema antes de finalizar
  const abrirConfirmacao = async () => {
    setVerificandoDivergencias(true);
    const divs = [];
    for (const grupo of itensAgrupados) {
      const prod = produtos.find(p => p.id === grupo.produto_id);
      if (!prod) continue;
      const saldoExtrato = await calcularSaldoExtratoProduto(base44, grupo.produto_id);
      if (Math.abs(grupo.totalBase - saldoExtrato) > 0.001) {
        const cad = parseEstoqueCadastro(prod.estoque_atual);
        const exibicao = getGroupDisplayFromBase(prod, grupo.totalBase);
        divs.push({
          produto_id: grupo.produto_id,
          produto_nome: grupo.produto_nome,
          contado: grupo.totalBase,
          contado_display: exibicao.quantidade,
          unidade_display: exibicao.unidade,
          sistema: saldoExtrato,
          sistema_cadastro: cad !== saldoExtrato ? cad : null,
        });
      }
    }
    setDivergencias(divs);
    setVerificandoDivergencias(false);
    setModalConfirmar(true);
  };

  // Ao finalizar, vai para "Aguardando Auditoria" — responsável vai auditar
  const finalizar = async () => {
    setFinalizando(true);
    await base44.entities.ConferenciaEstoque.update(conferencia_id, omitConferenciaEspelho({
      status: "Aguardando Auditoria",
      data_fim: new Date().toISOString(),
    }));

    // Sincronia canonica: agrupa contagens por produto, deriva qty_base e
    // divergencia, e regrava em ConferenciaItem (espelho recomposto pelo backend).
    try {
      const agrupados = (itens || []).reduce((acc, it) => {
        const produto = produtos.find(p => p.id === it.produto_id);
        const unit = getCountUnitForEntry(produto, it);
        const key = `${it.produto_id}::${unit.unidade}`;
        if (!acc[key]) {
          acc[key] = {
            produto_id: it.produto_id,
            produto_nome: it.produto_nome,
            unidade_sigla: unit.unidade,
            unidade_medida: unit.unidade,
            produto_unidade_id: unit.id,
            fator_conversao: unit.fator_conversao,
            quantidade_contada_comercial: 0,
          };
        }
        acc[key].quantidade_contada_comercial += getEntryDisplayQuantity(it, produto);
        return acc;
      }, {});
      const itensCanonicos = Object.values(agrupados).map((it, idx) => ({
        produto_id: it.produto_id,
        produto_nome: it.produto_nome,
        unidade_sigla: it.unidade_sigla,
        unidade_medida: it.unidade_medida,
        produto_unidade_id: it.produto_unidade_id,
        fator_conversao: it.fator_conversao,
        quantidade_contada_comercial: Number(it.quantidade_contada_comercial) || 0,
        ordem: idx,
      })).filter((it) => it.produto_id);

      if (itensCanonicos.length > 0) {
        await saveConferenciaItem({
          action: 'replaceAll',
          conferencia_id,
          items: itensCanonicos,
        });
      }
    } catch (canonicalErr) {
      console.warn('Sincronia canonica de ConferenciaItem falhou:', canonicalErr?.message || canonicalErr);
    }

    setFinalizando(false);
    setModalConfirmar(false);
    onVoltar();
  };

  const itensAgrupados = itens.reduce((acc, item, idx) => {
    const produto = produtos.find(p => p.id === item.produto_id);
    const quantidadeBase = getEntryBaseQuantity(item, produto);
    const quantidadeDisplay = getEntryDisplayQuantity(item, produto);
    const unit = getCountUnitForEntry(produto, item);
    const existente = acc.findIndex(a => a.produto_id === item.produto_id);
    if (existente >= 0) {
      acc[existente].totalBase += quantidadeBase;
      acc[existente].entradas.push({ idx, qtd: quantidadeDisplay, unidade: unit.unidade, base: quantidadeBase });
    } else {
      acc.push({
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        totalBase: quantidadeBase,
        display: getGroupDisplayFromBase(produto, quantidadeBase),
        entradas: [{ idx, qtd: quantidadeDisplay, unidade: unit.unidade, base: quantidadeBase }],
      });
    }
    const grupoAtual = existente >= 0 ? acc[existente] : acc[acc.length - 1];
    grupoAtual.display = getGroupDisplayFromBase(produto, grupoAtual.totalBase);
    return acc;
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-card flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="min-h-screen bg-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 flex-shrink-0 bg-card border-b border-border/40 dark:border-border/40">
        <button onClick={onVoltar} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold font-glacial text-foreground truncate">{conferenciaInicial?.nome_conferencia}</h2>
          <p className="text-xs text-muted-foreground">
            {itensAgrupados.length} produto{itensAgrupados.length !== 1 ? "s" : ""} contados
            {saving && <span className="ml-2 text-muted-foreground">· salvando...</span>}
          </p>
        </div>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />}
      </div>

      {/* Banner bloqueio */}
      {bloqueada && (
        <div className="mx-4 mb-3 flex items-center gap-2.5 bg-muted dark:bg-muted rounded-2xl px-4 py-3">
          <Lock className="w-4 h-4 text-muted-foreground dark:text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Conferência <strong className="text-foreground/90">{conferenciaInicial.status}</strong> — somente visualização.
          </p>
        </div>
      )}

      {/* Busca — só se não bloqueada */}
      {!bloqueada && (
        <div className="px-4 pb-3 relative flex-shrink-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={buscaRef}
                variant="search"
                placeholder="Buscar produto por nome ou código..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-9 pr-9 rounded-xl border-0 bg-muted dark:bg-muted text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground h-11 focus-visible:ring-1 focus-visible:ring-border/40 dark:focus-visible:ring-ring"
              />
              {busca && (
                <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-11 h-11 rounded-xl bg-muted dark:bg-muted flex items-center justify-center text-muted-foreground dark:text-muted-foreground flex-shrink-0"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return; e.target.value = "";
                const reader = new FileReader();
                reader.onload = async (ev) => {
                  const blob = await (await fetch(ev.target.result)).blob();
                  const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });
                  const res = await base44.integrations.Core.InvokeLLM({
                    prompt: "Extraia o código de barras (EAN/UPC) visível na imagem. Retorne apenas o número, sem espaços. Se não houver, retorne null.",
                    file_urls: [file_url],
                    response_json_schema: { type: "object", properties: { codigo_barras: { type: "string" } } }
                  });
                  const codigo = res?.codigo_barras;
                  if (codigo) {
                    const encontrado = produtos.find(p => p.codigo_barras === codigo || p.codigo_barras?.replace(/\D/g, "") === codigo.replace(/\D/g, ""));
                    if (encontrado) selecionarProduto(encontrado); else setBusca(codigo);
                  }
                };
                reader.readAsDataURL(file);
              }}
            />
          </div>
          {produtosFiltrados.length > 0 && (
            <div className="absolute top-full left-4 right-4 z-30 mt-1 bg-card rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto border border-border/40">
              <div className="divide-y divide-border/40 dark:divide-border/40">
                {produtosFiltrados.map(prod => {
                  const nome = resolveInventoryProductName(prod);
                  const contagens = itens.filter(i => i.produto_id === prod.id);
                  const totalBase = contagens.reduce((s, i) => s + getEntryBaseQuantity(i, prod), 0);
                  const totalDisplay = getGroupDisplayFromBase(prod, totalBase);
                  return (
                    <button key={prod.id} onClick={() => selecionarProduto(prod)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 dark:hover:bg-muted transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{nome}</p>
                        {(prod.codigo_interno || prod.codigo_barras) && (
                          <p className="text-xs text-muted-foreground">{prod.codigo_interno || prod.codigo_barras}</p>
                        )}
                      </div>
                      {contagens.length > 0 && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-xs text-green-400 font-medium">
                            {formatCountQuantity(totalDisplay.quantidade)} {totalDisplay.unidade}
                          </span>
                        </div>
                      )}
                      <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista itens scrollável */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-4">
        {itensAgrupados.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground dark:text-foreground/90">
            <Package className="w-10 h-10 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum produto conferido</p>
            {!bloqueada && <p className="text-xs mt-1 text-muted-foreground dark:text-foreground/90">Busque ou escaneie produtos acima</p>}
          </div>
        )}

        {itensAgrupados.map((grupo) => (
          <div key={grupo.produto_id} className="bg-background rounded-2xl overflow-hidden shadow-sm">
            <button
              onClick={() => setItemExpandido(prev => prev === grupo.produto_id ? null : grupo.produto_id)}
              className="w-full flex items-start gap-3 p-3.5 text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                <Package className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug break-words">{grupo.produto_nome}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {grupo.entradas.length} entrada{grupo.entradas.length !== 1 ? "s" : ""}
                  {grupo.display?.fator_conversao > 1 && (
                    <span> · base {formatCountQuantity(grupo.totalBase)} {grupo.display.unidade_base}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                <div className="text-right">
                  <span className="text-xl font-bold font-glacial text-foreground">
                    {formatCountQuantity(grupo.display?.quantidade ?? grupo.totalBase)}
                  </span>
                  <span className="ml-1 text-xs font-semibold text-muted-foreground">
                    {grupo.display?.unidade || "UN"}
                  </span>
                </div>
                {itemExpandido === grupo.produto_id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {itemExpandido === grupo.produto_id && (
              <div className="border-t border-border/40 divide-y divide-border/40 dark:divide-border/40">
                {grupo.entradas.map((entrada, eIdx) => (
                  <div key={entrada.idx} className="flex items-center gap-2 px-3 py-2.5 min-w-0">
                    <span className="text-xs text-muted-foreground w-14 flex-shrink-0">Entrada {eIdx + 1}</span>
                    <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                      {!bloqueada && (
                        <button onClick={() => atualizarQtd(entrada.idx, -1)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                          <Minus className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => abrirSeletorUnidadeItem(entrada.idx)}
                        className="h-7 inline-flex items-center gap-1 rounded-lg bg-card px-2 text-[11px] font-semibold text-muted-foreground shadow-sm"
                        title="Trocar unidade"
                      >
                        <Boxes className="w-3 h-3" />
                        {entrada.unidade || "UN"}
                      </button>
                      <Input
                        type="number" inputMode="decimal"
                        value={entrada.qtd}
                        readOnly={bloqueada}
                        onChange={e => !bloqueada && definirQtd(entrada.idx, e.target.value)}
                        className="w-14 text-center text-sm font-medium border-0 bg-transparent text-foreground focus-visible:ring-0 p-0 h-7"
                      />
                      {!bloqueada && (
                        <>
                          <button onClick={() => atualizarQtd(entrada.idx, 1)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                            <Plus className="w-3 h-3 text-muted-foreground" />
                          </button>
                          <button onClick={() => removerItem(entrada.idx)} className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/60 flex items-center justify-center ml-1">
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {!bloqueada && (
                  <button
                    onClick={() => { const prod = produtos.find(p => p.id === grupo.produto_id); if (prod) selecionarProduto(prod); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground"
                  >
                    <Plus className="w-3 h-3" /> Adicionar outra entrada
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer — botão finalizar */}
      {!bloqueada && (
        <div className="flex-shrink-0 px-4 pb-4 pt-3 bg-card border-t border-border/40 dark:border-border/40" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          <Button
            onClick={abrirConfirmacao}
            disabled={verificandoDivergencias || itens.length === 0}
            className="w-full h-12 rounded-2xl bg-background dark:bg-card hover:bg-primary/90 dark:hover:bg-muted text-foreground shadow-none font-semibold disabled:opacity-30"
          >
            {verificandoDivergencias
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><SendHorizonal className="w-4 h-4 mr-2" /> Encerrar e Enviar para Auditoria</>
            }
          </Button>
        </div>
      )}

      {/* Modal confirmação envio para auditoria */}
      {modalConfirmar && (
        <div className="fixed inset-0 z-50 flex items-center md:items-end justify-center p-4 md:p-0">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !finalizando && setModalConfirmar(false)} />
          <div className="relative bg-card rounded-3xl md:rounded-t-3xl md:rounded-b-none p-6 w-full max-w-sm shadow-2xl max-h-[80vh] md:max-h-[85vh] flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${divergencias.length > 0 ? 'bg-amber-50 dark:bg-amber-950/40' : 'bg-green-50 dark:bg-green-950/40'}`}>
                {divergencias.length > 0
                  ? <AlertTriangle className="w-5 h-5 text-amber-500" />
                  : <CheckCircle2 className="w-5 h-5 text-green-500" />
                }
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {divergencias.length > 0 ? `${divergencias.length} item${divergencias.length > 1 ? 's' : ''} com diferença` : 'Contagem sem divergências'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {itensAgrupados.length} produto{itensAgrupados.length !== 1 ? 's' : ''} contados
                </p>
              </div>
            </div>

            {divergencias.length > 0 && (
              <>
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl px-3 py-2">
                  Os itens abaixo diferem do saldo calculado pelas movimentações (a quantidade que você informou é a contagem física, não um acréscimo ou decréscimo). Você pode revisar antes de enviar — o auditor verá as diferenças.
                </p>
                <div className="overflow-y-auto flex-1 space-y-1.5 mb-4">
                  {divergencias.map(div => (
                    <div key={div.produto_id} className="flex items-center gap-3 bg-amber-50/70 dark:bg-amber-950/20 rounded-xl px-3 py-2.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <p className="text-xs text-foreground/90 flex-1 truncate">{div.produto_nome}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs font-semibold text-foreground">
                          {formatCountQuantity(div.contado_display ?? div.contado)} {div.unidade_display || ""}
                        </span>
                        <span className="text-xs text-muted-foreground">vs saldo</span>
                        <span className="text-xs text-muted-foreground line-through">{formatCountQuantity(div.sistema)}</span>
                        {div.sistema_cadastro != null && (
                          <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">cad. {div.sistema_cadastro}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {divergencias.length === 0 && (
              <p className="text-xs text-muted-foreground mb-4">
                Tudo certo! A contagem será enviada para revisão do auditor.
              </p>
            )}

            <div className="flex gap-2 mt-auto">
              <Button
                variant="ghost"
                onClick={() => setModalConfirmar(false)}
                disabled={finalizando}
                className="flex-1 h-11 rounded-2xl bg-muted text-muted-foreground hover:bg-muted dark:hover:bg-primary/90"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Revisar
              </Button>
              <Button
                onClick={finalizar}
                disabled={finalizando}
                className="flex-1 h-11 rounded-2xl bg-background dark:bg-card hover:bg-primary/90 dark:hover:bg-muted text-foreground shadow-none font-semibold"
              >
                {finalizando
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><SendHorizonal className="w-4 h-4 mr-1.5" /> Enviar</>
                }
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal qtd */}
      {modalQtd && (
        <div className="fixed inset-0 z-50 flex items-center md:items-end justify-center p-4 md:p-0">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalQtd(null)} />
          <div className="relative bg-card rounded-3xl md:rounded-t-3xl md:rounded-b-none p-6 w-full max-w-sm shadow-2xl">
            <p className="text-xs text-muted-foreground mb-1">Produto selecionado</p>
            <p className="text-sm font-semibold text-foreground mb-5 leading-snug">{modalQtd.produto.nome}</p>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="text-xs text-muted-foreground block">Quantidade contada</label>
              <button
                type="button"
                onClick={() => setUnitSelector({ open: true, context: "modal", itemIdx: null, product: modalQtd.produto })}
                className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-1.5 text-xs font-semibold text-foreground/90"
              >
                <Boxes className="w-3.5 h-3.5" />
                {modalQtd.unitOption?.unidade || "UN"}
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setModalQtd(m => ({ ...m, qtdStr: String(Math.max(0, (parseFloat(m.qtdStr) || 0) - 1)) }))} className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <Minus className="w-5 h-5 text-muted-foreground dark:text-foreground/90" />
              </button>
              <Input
                ref={qtdInputRef} type="number" inputMode="numeric"
                value={modalQtd.qtdStr}
                onChange={e => setModalQtd(m => ({ ...m, qtdStr: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && confirmarQtd()}
                className="flex-1 text-center text-3xl font-bold font-glacial border-0 bg-muted text-foreground rounded-2xl h-14 focus-visible:ring-1 focus-visible:ring-border/40 dark:focus-visible:ring-ring"
              />
              <button onClick={() => setModalQtd(m => ({ ...m, qtdStr: String((parseFloat(m.qtdStr) || 0) + 1) }))} className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <Plus className="w-5 h-5 text-muted-foreground dark:text-foreground/90" />
              </button>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setModalQtd(null)} className="flex-1 h-12 rounded-2xl bg-muted text-muted-foreground hover:bg-muted dark:hover:bg-primary/90">Cancelar</Button>
              <Button onClick={confirmarQtd} className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:hover:bg-muted/90 dark:text-foreground shadow-none font-semibold">
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      <ProductUnitSelectorDialog
        open={unitSelector.open}
        product={unitSelector.product}
        mode="sale"
        onClose={() => setUnitSelector({ open: false, context: null, itemIdx: null, product: null })}
        onConfirm={aplicarUnidadeSelecionada}
      />
    </div>
  );
}