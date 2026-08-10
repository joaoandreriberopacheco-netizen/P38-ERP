import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

// Avalia fórmulas simples e retorna apenas o resultado numérico
const avaliarFormula = (valor) => {
  if (typeof valor !== 'string' || !valor.trim()) return valor;
  const trimmed = valor.trim();
  if (!trimmed.startsWith('=')) {
    const num = parseFloat(trimmed);
    return isNaN(num) ? trimmed : num;
  }
  try {
    const expressao = trimmed.substring(1);
    if (!/^[\d\s+\-*/.()]+$/.test(expressao)) return null;
    const resultado = Function('"use strict"; return (' + expressao + ')')();
    if (typeof resultado !== 'number' || isNaN(resultado)) return null;
    return Math.round(resultado * 100) / 100;
  } catch {
    return null;
  }
};

const COLUNAS = [
  { key: 'codigo_interno',      label: 'Código',        tipo: 'text',     largura: 90,  readonly: true },
  { key: 'campo_hierarquico_1', label: 'Nome',          tipo: 'text',     largura: 200 },
  { key: 'valor_compra',        label: 'Custo',         tipo: 'number',   largura: 90 },
  { key: 'preco_venda_padrao',  label: 'Preço',         tipo: 'number',   largura: 90 },
  { key: 'estoque_atual',       label: 'Estoque',       tipo: 'number',   largura: 75,  readonly: true },
  { key: 'codigo_barras',       label: 'EAN',           tipo: 'text',     largura: 120 },
  { key: 'preco_livre',         label: 'Preço Livre',   tipo: 'boolean',  largura: 85 },
  { key: 'casas_decimais',      label: 'Decimais Qtd',  tipo: 'decimais', largura: 95 },
  // Colunas calculadas
  { key: '_margem_bruta',       label: 'Margem %',      tipo: 'calculated', largura: 85, readonly: true },
  { key: '_diferenca',          label: 'Diferença',     tipo: 'calculated', largura: 85, readonly: true },
];

const MARGEM_CRITICA = 15;

export default function GradeEdicaoMassiva({ produtos, onSalvar }) {
  const [dados, setDados] = useState(
    produtos.map(p => ({
      id: p.id,
      ...COLUNAS.reduce((acc, col) => {
        if (col.tipo !== 'calculated') {
          acc[col.key] = p[col.key] ?? (col.tipo === 'boolean' ? false : col.tipo === 'decimais' ? 0 : '');
        }
        return acc;
      }, {}),
    }))
  );

  const [alteracoes, setAlteracoes] = useState({});
  const [celulaSelecionada, setCelulaSelecionada] = useState(null);
  const [celulaEmEdicao, setCelulaEmEdicao] = useState(null);
  const [dragFillAtivo, setDragFillAtivo] = useState(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const calcularColunaCalculada = useCallback((produtoId, chaveColuna) => {
    const linha = dados.find(d => d.id === produtoId);
    if (!linha) return '';
    const custo = parseFloat(linha.valor_compra) || 0;
    const preco = parseFloat(linha.preco_venda_padrao) || 0;
    if (chaveColuna === '_margem_bruta') {
      if (custo === 0) return '0%';
      return `${(((preco - custo) / custo) * 100).toFixed(1)}%`;
    }
    if (chaveColuna === '_diferenca') return (preco - custo).toFixed(2);
    return '';
  }, [dados]);

  const obterStatusCelula = useCallback((produtoId, chaveColuna) => {
    const linha = dados.find(d => d.id === produtoId);
    if (!linha) return 'normal';
    const custo = parseFloat(linha.valor_compra) || 0;
    const preco = parseFloat(linha.preco_venda_padrao) || 0;
    if (chaveColuna === 'preco_venda_padrao') {
      if (preco > 0 && preco < custo) return 'erro';
      if (custo > 0) {
        const margem = ((preco - custo) / custo) * 100;
        if (margem < MARGEM_CRITICA && margem >= 0) return 'aviso';
      }
    }
    return 'normal';
  }, [dados]);

  const temErrosCriticos = useMemo(() => {
    return dados.some(linha => {
      const custo = parseFloat(linha.valor_compra) || 0;
      const preco = parseFloat(linha.preco_venda_padrao) || 0;
      return preco > 0 && preco < custo;
    });
  }, [dados]);

  const registrarAlteracao = useCallback((produtoId, chaveColuna, valorFinal) => {
    setDados(prev => prev.map(d => d.id === produtoId ? { ...d, [chaveColuna]: valorFinal } : d));
    setAlteracoes(prev => ({
      ...prev,
      [produtoId]: { ...(prev[produtoId] || {}), [chaveColuna]: valorFinal },
    }));
  }, []);

  const handleEditarCelula = useCallback((produtoId, chaveColuna, valor) => {
    const coluna = COLUNAS.find(c => c.key === chaveColuna);
    if (coluna?.readonly) return;
    let valorFinal = valor;
    if (coluna?.tipo === 'number') {
      const avaliado = avaliarFormula(valor);
      valorFinal = avaliado === null ? valor : avaliado;
    }
    registrarAlteracao(produtoId, chaveColuna, valorFinal);
  }, [registrarAlteracao]);

  const handleToggleBoolean = useCallback((produtoId, chaveColuna) => {
    const linha = dados.find(d => d.id === produtoId);
    if (!linha) return;
    registrarAlteracao(produtoId, chaveColuna, !linha[chaveColuna]);
  }, [dados, registrarAlteracao]);

  const handleSetDecimais = useCallback((produtoId, chaveColuna, valor) => {
    registrarAlteracao(produtoId, chaveColuna, valor);
  }, [registrarAlteracao]);

  // Drag-to-fill com mouse
  const handleMouseDown = useCallback((e, produtoId, chaveColuna) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isNearEdge = e.clientX > rect.right - 8 && e.clientY > rect.bottom - 8;
    if (isNearEdge) {
      e.preventDefault();
      setDragFillAtivo({ produtoId, chaveColuna, startY: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragFillAtivo) return;
    const distancia = e.clientY - dragFillAtivo.startY;
    setDragFillAtivo(prev => ({ ...prev, linhasAbaixo: Math.round(distancia / 36) }));
  }, [dragFillAtivo]);

  const handleMouseUp = useCallback(() => {
    if (dragFillAtivo?.linhasAbaixo > 0) {
      const valor = dados.find(d => d.id === dragFillAtivo.produtoId)?.[dragFillAtivo.chaveColuna];
      const indexAtual = dados.findIndex(d => d.id === dragFillAtivo.produtoId);
      setDados(prev => {
        const novo = [...prev];
        for (let i = 1; i <= dragFillAtivo.linhasAbaixo && indexAtual + i < novo.length; i++) {
          novo[indexAtual + i] = { ...novo[indexAtual + i], [dragFillAtivo.chaveColuna]: valor };
          setAlteracoes(p => ({
            ...p,
            [novo[indexAtual + i].id]: { ...(p[novo[indexAtual + i].id] || {}), [dragFillAtivo.chaveColuna]: valor },
          }));
        }
        return novo;
      });
    }
    setDragFillAtivo(null);
  }, [dragFillAtivo, dados]);

  useEffect(() => {
    if (dragFillAtivo) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragFillAtivo, handleMouseMove, handleMouseUp]);

  const handleKeyDown = useCallback((e, produtoId, chaveColuna) => {
    const coluna = COLUNAS.find(c => c.key === chaveColuna);
    if (e.key === 'Enter' && !coluna?.readonly && coluna?.tipo === 'text' || coluna?.tipo === 'number') {
      e.preventDefault();
      setCelulaEmEdicao({ produtoId, chaveColuna });
      setTimeout(() => inputRef.current?.focus(), 0);
    } else if (e.key === 'Escape') {
      setCelulaEmEdicao(null);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const i = dados.findIndex(d => d.id === produtoId);
      if (i < dados.length - 1) setCelulaSelecionada({ produtoId: dados[i + 1].id, chaveColuna });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const i = dados.findIndex(d => d.id === produtoId);
      if (i > 0) setCelulaSelecionada({ produtoId: dados[i - 1].id, chaveColuna });
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const ic = COLUNAS.findIndex(c => c.key === chaveColuna);
      if (ic < COLUNAS.length - 1) setCelulaSelecionada({ produtoId, chaveColuna: COLUNAS[ic + 1].key });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const ic = COLUNAS.findIndex(c => c.key === chaveColuna);
      if (ic > 0) setCelulaSelecionada({ produtoId, chaveColuna: COLUNAS[ic - 1].key });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const ic = COLUNAS.findIndex(c => c.key === chaveColuna);
      const nova = e.shiftKey ? COLUNAS[ic - 1] : COLUNAS[ic + 1];
      if (nova) setCelulaSelecionada({ produtoId, chaveColuna: nova.key });
    }
  }, [dados]);

  const handleSalvar = async () => {
    if (temErrosCriticos) return;
    setLoading(true);
    try {
      const alteracoesFiltradas = Object.entries(alteracoes).reduce((acc, [id, mudancas]) => {
        const filtradas = Object.fromEntries(Object.entries(mudancas).filter(([k]) => !k.startsWith('_')));
        if (Object.keys(filtradas).length > 0) acc[id] = filtradas;
        return acc;
      }, {});
      await onSalvar(alteracoesFiltradas);
      setAlteracoes({});
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {dados.length} produto{dados.length !== 1 ? 's' : ''} •{' '}
          {Object.keys(alteracoes).length} alterado{Object.keys(alteracoes).length !== 1 ? 's' : ''}
        </div>
        <div className="flex gap-2">
          {temErrosCriticos && (
            <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              Erros críticos detectados
            </div>
          )}
          <button
            onClick={handleSalvar}
            disabled={Object.keys(alteracoes).length === 0 || temErrosCriticos || loading}
            className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded transition-colors"
          >
            {loading ? 'Salvando...' : 'Sincronizar'}
          </button>
        </div>
      </div>

      {/* Grade */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-card">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-muted/50">
            <tr>
              {COLUNAS.map(col => (
                <th
                  key={col.key}
                  style={{ width: col.largura }}
                  className="px-3 py-2 text-left text-xs font-semibold text-foreground/90 border-r border-border/40 whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.map((linha) => (
              <tr
                key={linha.id}
                className={`border-b border-border/40 hover:bg-muted/40 dark:hover:bg-muted/50 ${
                  alteracoes[linha.id] ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                }`}
              >
                {COLUNAS.map(col => {
                  const valor = col.tipo === 'calculated' ? calcularColunaCalculada(linha.id, col.key) : linha[col.key];
                  const status = obterStatusCelula(linha.id, col.key);
                  const isSelected = celulaSelecionada?.produtoId === linha.id && celulaSelecionada?.chaveColuna === col.key;
                  const isEmEdicao = celulaEmEdicao?.produtoId === linha.id && celulaEmEdicao?.chaveColuna === col.key;

                  // ── Coluna booleana (Preço Livre) ──
                  if (col.tipo === 'boolean') {
                    return (
                      <td
                        key={col.key}
                        style={{ width: col.largura }}
                        className="px-3 py-2 border-r border-border/40 text-center"
                        onClick={() => handleToggleBoolean(linha.id, col.key)}
                      >
                        <div className={`inline-flex items-center justify-center w-6 h-6 rounded cursor-pointer transition-colors ${
                          valor ? 'bg-primary dark:bg-muted' : 'bg-muted border border-border/40 dark:border-border/40'
                        }`}>
                          {valor && <span className="text-foreground text-xs font-bold">✓</span>}
                        </div>
                      </td>
                    );
                  }

                  // ── Coluna decimais (seletor 0-3) ──
                  if (col.tipo === 'decimais') {
                    return (
                      <td
                        key={col.key}
                        style={{ width: col.largura }}
                        className="px-2 py-1.5 border-r border-border/40"
                      >
                        <div className="flex items-center gap-0.5">
                          {[0, 1, 2, 3].map(n => (
                            <button
                              key={n}
                              onClick={() => handleSetDecimais(linha.id, col.key, n)}
                              className={`w-7 h-6 text-xs rounded transition-colors ${
                                (valor ?? 0) === n
                                  ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground font-bold'
                                  : 'text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </td>
                    );
                  }

                  // ── Coluna readonly / calculada ──
                  if (col.readonly || col.tipo === 'calculated') {
                    return (
                      <td
                        key={col.key}
                        style={{ width: col.largura }}
                        className={`px-3 py-2 border-r border-border/40 ${
                          status === 'erro' ? 'bg-red-100 dark:bg-red-900/20' : status === 'aviso' ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''
                        }`}
                      >
                        <div className="text-xs text-foreground/90">{valor}</div>
                      </td>
                    );
                  }

                  // ── Coluna editável (text / number) ──
                  return (
                    <td
                      key={col.key}
                      style={{ width: col.largura }}
                      className={`px-3 py-2 border-r border-border/40 relative ${
                        status === 'erro' ? 'bg-red-100 dark:bg-red-900/20' : status === 'aviso' ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''
                      }`}
                      onClick={() => setCelulaSelecionada({ produtoId: linha.id, chaveColuna: col.key })}
                      onMouseDown={(e) => handleMouseDown(e, linha.id, col.key)}
                    >
                      {isEmEdicao ? (
                        <input autoComplete="off"
                          ref={inputRef}
                          type="text"
                          value={valor}
                          onChange={(e) => handleEditarCelula(linha.id, col.key, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') { setCelulaEmEdicao(null); }
                            else if (e.key === 'Enter') {
                              setCelulaEmEdicao(null);
                              const i = dados.findIndex(d => d.id === linha.id);
                              if (i < dados.length - 1) setCelulaSelecionada({ produtoId: dados[i + 1].id, chaveColuna: col.key });
                            } else { handleKeyDown(e, linha.id, col.key); }
                          }}
                          onBlur={() => setCelulaEmEdicao(null)}
                          autoFocus
                          className="w-full px-2 py-1 text-xs bg-card dark:bg-muted border border-blue-500 text-foreground rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <input autoComplete="off"
                          type="text"
                          value={valor}
                          readOnly
                          onKeyDown={(e) => handleKeyDown(e, linha.id, col.key)}
                          onFocus={() => setCelulaSelecionada({ produtoId: linha.id, chaveColuna: col.key })}
                          className={`w-full px-2 py-1 text-xs bg-transparent border-0 cursor-pointer text-foreground ${
                            isSelected ? 'ring-1 ring-blue-500 rounded' : ''
                          }`}
                        />
                      )}
                      {!col.readonly && isSelected && (
                        <div className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-cell hover:bg-blue-600" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="px-4 py-3 border-t border-border/40 bg-muted/50/50 text-xs text-muted-foreground space-y-2">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-100 dark:bg-red-900/20 rounded" />
            Preço &lt; Custo
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-100 dark:bg-yellow-900/20 rounded" />
            Margem &lt; {MARGEM_CRITICA}%
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-50 dark:bg-blue-900/10 rounded" />
            Alterado
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center w-5 h-5 rounded bg-primary dark:bg-muted">
              <span className="text-foreground text-[10px] font-bold">✓</span>
            </div>
            Preço Livre
          </div>
        </div>
        <div className="text-muted-foreground">
          <strong>Atalhos:</strong> Enter = editar | Esc = cancelar | Setas/Tab = navegar | Arraste canto = fill
        </div>
      </div>
    </div>
  );
}