import React, { useState, useCallback, useRef } from 'react';
import { X, Search, Plus, Minus, Trash2, FileText, Printer, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { openPrintWindowOrShareHtml } from '@/lib/mobilePrintAndShare';
import ProdutoThumb from '@/components/produtos/ProdutoThumb';

const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n) => (n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

// ── Cupom de impressão (80mm e A4) ───────────────────────────────────────────
function CupomImpressao({ itens, calcularPreco, tabelaSelecionada, onClose }) {
  const [formato, setFormato] = useState('80mm');
  const total = itens.reduce((acc, item) => acc + calcularPreco(item.produto) * item.qtd, 0);

  const handlePrint = async () => {
    const css80 = `
      @page { size: 80mm auto; margin: 4mm; }
      body { font-family: monospace; font-size: 10px; width: 72mm; }
      .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
      .item { display: flex; justify-content: space-between; margin-bottom: 3px; }
      .item-nome { flex: 1; margin-right: 4px; word-break: break-word; }
      .item-preco { white-space: nowrap; font-weight: bold; }
      .item-qtd { font-size: 9px; color: #555; }
      .total { border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; text-align: right; font-size: 12px; font-weight: bold; }
      .footer { text-align: center; margin-top: 8px; font-size: 9px; color: #666; }
    `;
    const cssA4 = `
      @page { size: A4; margin: 20mm; }
      body { font-family: Arial, sans-serif; font-size: 12px; }
      .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
      .header h1 { font-size: 20px; margin: 0 0 4px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f0f0f0; border-bottom: 1px solid #ccc; padding: 8px; text-align: left; font-size: 11px; }
      td { padding: 8px; border-bottom: 1px solid #eee; }
      .total { margin-top: 20px; text-align: right; font-size: 16px; font-weight: bold; }
      .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #888; }
    `;

    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const conteudo80 = `
      <div class="header">
        <strong>ORÇAMENTO</strong><br/>
        ${tabelaSelecionada ? tabelaSelecionada.nome_tabela : 'Tabela Padrão'}<br/>
        ${dataAtual} ${horaAtual}
      </div>
      ${itens.map(item => {
        const preco = calcularPreco(item.produto);
        return `
          <div class="item">
            <div class="item-nome">
              ${item.produto.nome}
              <div class="item-qtd">${fmtN(item.qtd)} ${item.produto.unidade_principal || 'UN'} × R$ ${fmtR(preco)}</div>
            </div>
            <div class="item-preco">R$ ${fmtR(preco * item.qtd)}</div>
          </div>
        `;
      }).join('')}
      <div class="total">TOTAL: R$ ${fmtR(total)}</div>
      <div class="footer">Orçamento gerado via VarejoSync<br/>Válido por 7 dias</div>
    `;

    const conteudoA4 = `
      <div class="header">
        <h1>ORÇAMENTO</h1>
        <div>${tabelaSelecionada ? tabelaSelecionada.nome_tabela : 'Tabela Padrão'}</div>
        <div>Data: ${dataAtual} às ${horaAtual}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Qtd</th>
            <th>Un</th>
            <th>Preço Un.</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itens.map(item => {
            const preco = calcularPreco(item.produto);
            return `
              <tr>
                <td>${item.produto.nome}</td>
                <td>${fmtN(item.qtd)}</td>
                <td>${item.produto.unidade_principal || 'UN'}</td>
                <td>R$ ${fmtR(preco)}</td>
                <td style="text-align:right">R$ ${fmtR(preco * item.qtd)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <div class="total">Total Geral: R$ ${fmtR(total)}</div>
      <div class="footer">Orçamento gerado via VarejoSync · Válido por 7 dias</div>
    `;

    const doc = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8"/>
          <title>Orçamento</title>
          <style>${formato === '80mm' ? css80 : cssA4}</style>
        </head>
        <body>${formato === '80mm' ? conteudo80 : conteudoA4}</body>
      </html>
    `;
    try {
      await openPrintWindowOrShareHtml(doc, `orcamento-tabela-${Date.now()}.html`, 'Orçamento');
    } catch {
      /* popup bloqueado no desktop */
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <h3 className="text-sm font-semibold text-foreground font-glacial">Gerar Orçamento</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Resumo */}
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-2">{itens.length} produto{itens.length !== 1 ? 's' : ''} no orçamento</p>
            <p className="text-xl font-bold text-foreground font-glacial">R$ {fmtR(total)}</p>
            {tabelaSelecionada && (
              <p className="text-xs text-muted-foreground mt-0.5">Tabela: {tabelaSelecionada.nome_tabela}</p>
            )}
          </div>

          {/* Seleção de formato */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Formato de impressão</p>
            <div className="grid grid-cols-2 gap-2">
              {['80mm', 'A4'].map(f => (
                <button
                  key={f}
                  onClick={() => setFormato(f)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                    formato === f
                      ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {f === '80mm' ? '🧾 Cupom 80mm' : '📄 Folha A4'}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handlePrint}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:hover:bg-muted dark:text-foreground h-11 rounded-xl gap-2"
          >
            <Printer className="w-4 h-4" />
            Imprimir / Salvar PDF
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Item do carrinho ─────────────────────────────────────────────────────────
function ItemCarrinho({ item, calcularPreco, onChangeQtd, onRemove }) {
  const preco = calcularPreco(item.produto);
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 border-b border-border/40">
      <ProdutoThumb produto={item.produto} size="sm" roundedClassName="rounded-lg" className="w-8 h-8" asDiv />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-foreground/90 leading-snug uppercase truncate">{item.produto.nome}</p>
        <p className="text-[10px] text-muted-foreground">R$ {fmtR(preco)} × {fmtN(item.qtd)} = <span className="font-semibold text-muted-foreground">R$ {fmtR(preco * item.qtd)}</span></p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => onChangeQtd(item.produto.id, item.qtd - 1)} className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
          <Minus className="w-3 h-3 text-muted-foreground" />
        </button>
        <span className="text-[11px] font-medium w-6 text-center text-foreground/90">{item.qtd}</span>
        <button onClick={() => onChangeQtd(item.produto.id, item.qtd + 1)} className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
          <Plus className="w-3 h-3 text-muted-foreground" />
        </button>
        <button onClick={() => onRemove(item.produto.id)} className="w-6 h-6 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center ml-1">
          <Trash2 className="w-3 h-3 text-red-500" />
        </button>
      </div>
    </div>
  );
}

// ── Sheet principal ──────────────────────────────────────────────────────────
export default function OrcamentoSheet({ produtos, calcularPreco, tabelaSelecionada, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  const [showCupom, setShowCupom] = useState(false);
  const [aba, setAba] = useState('buscar'); // 'buscar' | 'carrinho'

  const produtosFiltrados = produtos.filter(p => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return p.nome?.toLowerCase().includes(t) ||
      p.codigo_interno?.toLowerCase().includes(t) ||
      p.codigo_barras?.toLowerCase().includes(t);
  });

  const addProduto = useCallback((produto) => {
    setCarrinho(prev => {
      const existe = prev.find(i => i.produto.id === produto.id);
      if (existe) return prev.map(i => i.produto.id === produto.id ? { ...i, qtd: i.qtd + 1 } : i);
      return [...prev, { produto, qtd: 1 }];
    });
  }, []);

  const changeQtd = useCallback((id, qtd) => {
    if (qtd <= 0) setCarrinho(prev => prev.filter(i => i.produto.id !== id));
    else setCarrinho(prev => prev.map(i => i.produto.id === id ? { ...i, qtd } : i));
  }, []);

  const remove = useCallback((id) => {
    setCarrinho(prev => prev.filter(i => i.produto.id !== id));
  }, []);

  const total = carrinho.reduce((acc, item) => acc + calcularPreco(item.produto) * item.qtd, 0);
  const totalItens = carrinho.reduce((acc, i) => acc + i.qtd, 0);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground font-glacial">Orçamento</h2>
            {tabelaSelecionada && (
              <p className="text-[11px] text-muted-foreground">{tabelaSelecionada.nome_tabela}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/40 flex-shrink-0">
          <button
            onClick={() => setAba('buscar')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              aba === 'buscar'
                ? 'text-foreground border-b-2 border-border/40 dark:border-border/40'
                : 'text-muted-foreground'
            }`}
          >
            Buscar Produtos
          </button>
          <button
            onClick={() => setAba('carrinho')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
              aba === 'carrinho'
                ? 'text-foreground border-b-2 border-border/40 dark:border-border/40'
                : 'text-muted-foreground'
            }`}
          >
            Orçamento
            {totalItens > 0 && (
              <span className="ml-1.5 bg-primary dark:bg-muted text-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {totalItens}
              </span>
            )}
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {aba === 'buscar' ? (
            <>
              <div className="px-3 py-2 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Buscar produto..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    autoFocus
                    className="border-none bg-muted h-10 text-sm pl-9 shadow-none focus-visible:ring-0 rounded-xl text-foreground/90"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-border/40 dark:divide-border/40">
                {produtosFiltrados.map(p => {
                  const noCarrinho = carrinho.find(i => i.produto.id === p.id);
                  const preco = calcularPreco(p);
                  return (
                    <button
                      key={p.id}
                      onClick={() => addProduto(p)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 dark:hover:bg-muted/50 active:bg-muted transition-colors"
                    >
                      <ProdutoThumb produto={p} size="xs" roundedClassName="rounded-lg" asDiv />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-normal text-foreground/90 uppercase leading-snug truncate">{p.nome}</p>
                        {p.codigo_interno && (
                          <p className="text-[9px] text-muted-foreground font-mono">#{p.codigo_interno}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {preco > 0 && (
                          <span className="text-[12px] font-semibold text-foreground tabular-nums">
                            R$ {fmtR(preco)}
                          </span>
                        )}
                        {noCarrinho ? (
                          <span className="w-6 h-6 rounded-lg bg-primary dark:bg-muted flex items-center justify-center text-[9px] font-bold text-foreground">
                            {noCarrinho.qtd}
                          </span>
                        ) : (
                          <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
                {produtosFiltrados.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground text-xs">Nenhum produto encontrado</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                {carrinho.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground text-xs">Nenhum produto adicionado</div>
                ) : (
                  carrinho.map(item => (
                    <ItemCarrinho
                      key={item.produto.id}
                      item={item}
                      calcularPreco={calcularPreco}
                      onChangeQtd={changeQtd}
                      onRemove={remove}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Rodapé — total + gerar */}
        {carrinho.length > 0 && (
          <div className="flex-shrink-0 px-4 py-3 border-t border-border/40 bg-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{totalItens} {totalItens === 1 ? 'item' : 'itens'}</span>
              <span className="text-lg font-bold text-foreground font-glacial">R$ {fmtR(total)}</span>
            </div>
            <Button
              onClick={() => setShowCupom(true)}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:hover:bg-muted dark:text-foreground h-11 rounded-xl gap-2"
            >
              <FileText className="w-4 h-4" />
              Gerar Orçamento
            </Button>
          </div>
        )}
      </div>

      {showCupom && (
        <CupomImpressao
          itens={carrinho}
          calcularPreco={calcularPreco}
          tabelaSelecionada={tabelaSelecionada}
          onClose={() => setShowCupom(false)}
        />
      )}
    </>
  );
}