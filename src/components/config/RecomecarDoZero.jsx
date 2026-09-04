import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { zerarEntidade } from '@/functions/zerarEntidade';
import { runOperacaoAuthBypass } from '@/components/auth/runOperacaoAuthBypass';

// Ordem respeita dependências: registros filhos antes dos pais
const ENTITIES = [
  // Registros operacionais (dependem de produtos, clientes, contas)
  { id: 'AnexoDocumento', label: 'Anexos', description: 'Anexos de documentos' },
  { id: 'MovimentacaoEstoque', label: 'Movimentações de Estoque', description: 'Histórico de entradas/saídas' },
  { id: 'MovimentosCaixa', label: 'Movimentos de Caixa', description: 'Reforços e sangrias de caixa' },
  { id: 'LancamentoFinanceiro', label: 'Lançamentos Financeiros', description: 'Receitas e despesas' },
  { id: 'OrdemSeparacao', label: 'Ordens de Separação', description: 'Ordens de separação de pedidos' },
  { id: 'ProtocoloEntrega', label: 'Protocolos de Entrega', description: 'Comprovantes de entrega' },
  { id: 'AgendaLogistica', label: 'Agenda Logística', description: 'Agendamentos de entregas' },
  { id: 'ConferenciaCompra', label: 'Conferências de Compra', description: 'Conferências de recebimento' },
  { id: 'DivergenciaCompra', label: 'Divergências de Compra', description: 'Divergências de recebimento' },
  { id: 'RascunhoPedidoVenda', label: 'Rascunhos PDV', description: 'Pré-vendas aguardando caixa' },
  { id: 'PedidoVenda', label: 'Pedidos de Venda', description: 'Todas as vendas e orçamentos' },
  { id: 'VendaPerdida', label: 'Vendas Perdidas', description: 'Registros de vendas perdidas' },
  { id: 'DevolucaoTroca', label: 'Devoluções e Trocas', description: 'Registros de devoluções' },
  { id: 'AutorizacaoEstorno', label: 'Autorizações de Estorno', description: 'Estornos autorizados' },
  { id: 'ManifestoEntrada', label: 'Manifestos de Entrada', description: 'Manifestos de recebimento' },
  { id: 'Supermanifesto', label: 'Supermanifestos', description: 'Agrupamentos logísticos' },
  { id: 'PedidoCompra', label: 'Pedidos de Compra', description: 'Todos os pedidos de compra' },
  { id: 'Cotacao', label: 'Cotações', description: 'Cotações de compra' },
  { id: 'ConferenciaEstoque', label: 'Conferências de Estoque', description: 'Inventários realizados' },
  { id: 'LoteEstoque', label: 'Lotes de Estoque', description: 'Controle de lotes' },
  { id: 'TurnoCaixa', label: 'Turnos de Caixa', description: 'Histórico de turnos' },
  { id: 'Tarefa', label: 'Tarefas', description: 'Todas as tarefas do sistema' },
  { id: 'ValeCompra', label: 'Vales de Compra', description: 'Vales emitidos' },
  { id: 'EventosLogisticos', label: 'Eventos Logísticos', description: 'Viagens e fretes' },
  { id: 'AvisosAuto', label: 'Avisos Automáticos', description: 'Notificações geradas' },
  // Cadastros base
  { id: 'CustoDetalhado', label: 'Custos Detalhados', description: 'Composição de custos de produtos' },
  { id: 'Produto', label: 'Produtos', description: 'Todos os produtos cadastrados' },
  { id: 'Campanha', label: 'Campanhas', description: 'Promoções e campanhas' },
  { id: 'Veiculo', label: 'Veículos', description: 'Frota cadastrada' },
  { id: 'Colaborador', label: 'Colaboradores', description: 'Motoristas e estoquistas' },
  { id: 'Terceiro', label: 'Terceiros', description: 'Clientes e fornecedores' },
  { id: 'ContasFinanceiras', label: 'Contas Financeiras', description: 'Contas bancárias e caixas' },
  { id: 'FormasDePagamento', label: 'Formas de Pagamento', description: 'Meios de pagamento' },
  { id: 'TabelaPreco', label: 'Tabelas de Preço', description: 'Tabelas de precificação' },
  { id: 'CategoriaFinanceira', label: 'Categorias Financeiras', description: 'Categorias de lançamentos' },
  { id: 'Categoria', label: 'Categorias de Produto', description: 'Categorias de produtos' },
  { id: 'Area', label: 'Áreas/Setores', description: 'Setores do armazém' },
];

// Grupos para exibição organizada
const GRUPOS = [
  {
    label: 'Operacional',
    ids: ['AnexoDocumento','MovimentacaoEstoque','MovimentosCaixa','LancamentoFinanceiro','OrdemSeparacao','ProtocoloEntrega','AgendaLogistica','ConferenciaCompra','DivergenciaCompra','RascunhoPedidoVenda','PedidoVenda','VendaPerdida','DevolucaoTroca','AutorizacaoEstorno','ManifestoEntrada','Supermanifesto','PedidoCompra','Cotacao','ConferenciaEstoque','LoteEstoque','TurnoCaixa','Tarefa','ValeCompra','EventosLogisticos','AvisosAuto']
  },
  {
    label: 'Cadastros',
    ids: ['CustoDetalhado','Produto','Campanha','Veiculo','Colaborador','Terceiro','ContasFinanceiras','FormasDePagamento','TabelaPreco','CategoriaFinanceira','Categoria','Area']
  }
];

export default function RecomecarDoZero() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEntities, setSelectedEntities] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, entity: '', recordsDeleted: 0, currentRecords: 0 });
  const [result, setResult] = useState(null);

  const handleToggleEntity = (entityId) => {
    setSelectedEntities(prev =>
      prev.includes(entityId) ? prev.filter(id => id !== entityId) : [...prev, entityId]
    );
  };

  const handleSelectGroup = (ids) => {
    const allSelected = ids.every(id => selectedEntities.includes(id));
    if (allSelected) {
      setSelectedEntities(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedEntities(prev => [...new Set([...prev, ...ids])]);
    }
  };

  const handleSelectAll = () => {
    if (selectedEntities.length === ENTITIES.length) {
      setSelectedEntities([]);
    } else {
      setSelectedEntities(ENTITIES.map(e => e.id));
    }
  };

  const handleInitiateDelete = () => {
    if (selectedEntities.length === 0) return;
    void runOperacaoAuthBypass(handleAuthSuccess);
  };

  const deleteAllRecords = async (entityId, onProgressUpdate) => {
    try {
      const response = await zerarEntidade({ entityId });
      const deleted = response.data?.deleted || 0;
      
      // Simula progresso de exclusão em lotes de 25
      if (onProgressUpdate) {
        const batchSize = 25;
        for (let i = 0; i < deleted; i += batchSize) {
          const deleted_so_far = Math.min(i + batchSize, deleted);
          onProgressUpdate(deleted_so_far, deleted);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      return deleted;
    } catch (error) {
      console.error('Erro na exclusão:', error);
      throw error;
    }
  };

  const handleAuthSuccess = async () => {
    setIsProcessing(true);
    setResult(null);

    // Ordena selecionadas respeitando a ordem de dependências definida em ENTITIES
    const orderedSelected = ENTITIES.map(e => e.id).filter(id => selectedEntities.includes(id));
    setProgress({ current: 0, total: orderedSelected.length, entity: '' });

    let totalDeleted = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < orderedSelected.length; i++) {
      const entityId = orderedSelected[i];
      const entityLabel = ENTITIES.find(e => e.id === entityId)?.label || entityId;
      setProgress({ current: i + 1, total: orderedSelected.length, entity: entityLabel, recordsDeleted: 0, currentRecords: 0 });

      try {
        // Verificar se entidade existe no SDK antes de tentar deletar
        if (!base44.entities[entityId]) {
          console.warn(`Entidade ${entityId} não encontrada no SDK, pulando...`);
          continue;
        }
        
        const deleted = await deleteAllRecords(entityId, (deletedSoFar, totalCount) => {
          setProgress(prev => ({
            ...prev,
            recordsDeleted: deletedSoFar,
            currentRecords: totalCount
          }));
        });
        
        totalDeleted += deleted;
        successCount++;
      } catch (error) {
        console.error(`Erro ao zerar ${entityId}:`, error);
        errors.push(entityLabel);
        errorCount++;
      }
    }

    setIsProcessing(false);
    setSelectedEntities([]);
    setResult({ totalDeleted, successCount, errorCount, errors });

    setTimeout(() => {
      setIsOpen(false);
      setResult(null);
      window.location.reload();
    }, 3000);
  };

  return (
    <>
      <div className="bg-card rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            <RefreshCw className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground mb-1">Recomeçar do Zero</h3>
            <p className="text-sm text-muted-foreground">
              Apaga permanentemente os registros selecionados. Ação irreversível — requer autenticação.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="gap-2 shadow-sm border-0 h-10 rounded-xl"
          onClick={() => setIsOpen(true)}
        >
          <Trash2 className="w-4 h-4" />
          Abrir Ferramenta
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={(v) => { if (!isProcessing) setIsOpen(v); }}>
        <DialogContent className="max-w-2xl h-[90vh] flex flex-col bg-card border-0 shadow-2xl rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border/40">
            <DialogTitle className="text-foreground flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Recomeçar do Zero
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 px-6 py-4">
            {/* Alerta */}
            <div className="p-4 bg-muted rounded-2xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-0.5">Operação Irreversível</p>
                  <p className="text-xs text-muted-foreground">
                    Os registros deletados não poderão ser recuperados. Configurações (formas de pagamento, tabelas de preço, etc.) só serão apagadas se explicitamente selecionadas.
                  </p>
                </div>
              </div>
            </div>

            {/* Resultado */}
            {result && (
              <div className={`p-4 rounded-2xl flex items-start gap-3 ${result.errorCount === 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                <CheckCircle2 className={`w-5 h-5 flex-shrink-0 mt-0.5 ${result.errorCount === 0 ? 'text-emerald-600' : 'text-amber-600'}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {result.totalDeleted} registro(s) apagado(s) em {result.successCount} entidade(s).
                  </p>
                  {result.errorCount > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Erros em: {result.errors.join(', ')}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">Recarregando em instantes...</p>
                </div>
              </div>
            )}

            {/* Progress */}
            {isProcessing && (
              <div className="p-4 bg-muted/50 rounded-2xl space-y-3">
                {/* Progress geral de entidades */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground/90">Entidades: {progress.current}/{progress.total}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary dark:bg-card h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                
                {/* Progress de registros da entidade atual */}
                {progress.entity && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-2">
                      {progress.entity}
                    </p>
                    {progress.currentRecords > 0 && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Excluindo registros: {progress.recordsDeleted} de {progress.currentRecords}
                      </p>
                    )}
                    <div className="w-full bg-green-200 dark:bg-green-900/30 rounded-full h-1">
                      <div
                        className="bg-green-600 dark:bg-green-500 h-1 rounded-full transition-all duration-200"
                        style={{ width: progress.currentRecords > 0 ? `${(progress.recordsDeleted / progress.currentRecords) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Seleção */}
            {!isProcessing && !result && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-foreground/90">
                    Selecionar dados para apagar
                  </h4>
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-muted-foreground hover:text-foreground/90 dark:hover:text-muted-foreground underline underline-offset-2"
                  >
                    {selectedEntities.length === ENTITIES.length ? 'Desmarcar tudo' : 'Marcar tudo'}
                  </button>
                </div>

                <div className="space-y-4">
                  {GRUPOS.map(grupo => {
                    const grupoEntities = ENTITIES.filter(e => grupo.ids.includes(e.id));
                    const allSelected = grupoEntities.every(e => selectedEntities.includes(e.id));
                    const someSelected = grupoEntities.some(e => selectedEntities.includes(e.id));
                    return (
                      <div key={grupo.label}>
                        <div className="flex items-center justify-between mb-2 px-1">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{grupo.label}</span>
                          <button
                            onClick={() => handleSelectGroup(grupo.ids)}
                            className="text-[11px] text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground underline underline-offset-2"
                          >
                            {allSelected ? 'Desmarcar grupo' : 'Marcar grupo'}
                          </button>
                        </div>
                        <div className="space-y-1">
                          {grupoEntities.map(entity => (
                            <label
                              key={entity.id}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                                selectedEntities.includes(entity.id)
                                  ? 'bg-muted'
                                  : 'bg-muted/50 hover:bg-muted'
                              }`}
                            >
                              <Checkbox
                                checked={selectedEntities.includes(entity.id)}
                                onCheckedChange={() => handleToggleEntity(entity.id)}
                                className="flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground">{entity.label}</div>
                                <div className="text-xs text-muted-foreground truncate">{entity.description}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 px-6 py-4 border-t border-border/40">
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-muted-foreground">
                {selectedEntities.length > 0 ? `${selectedEntities.length} selecionada(s)` : 'Nenhuma selecionada'}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="border-0 shadow-sm rounded-xl"
                  disabled={isProcessing}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleInitiateDelete}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:hover:bg-muted dark:text-foreground rounded-xl"
                  disabled={selectedEntities.length === 0 || isProcessing}
                >
                  {isProcessing ? 'Processando...' : 'Zerar selecionados'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}