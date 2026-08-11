import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowRight, User, Bot, Users, AlertTriangle, Package } from 'lucide-react';
import { formatarDataHora } from '@/components/utils/dateUtils';
import { formatQuantity } from '@/lib/financialUtils';
import {
  calcularItensOrfaosPedido,
  listarEmbarquesComDivergenciaRecepcao,
} from '@/lib/embarqueLogisticaHelpers';
import { hydrateEmbarquesPedidoFromSql } from '@/lib/fetchEmbarqueItens';

const STATUS_CORES = {
  'Rascunho':             'bg-muted text-foreground/90 dark:bg-muted dark:text-foreground/90',
  'Enviado':              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  'Aguardando Liberação': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  'Aprovado':             'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'Despachado':           'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'Em Recepção':          'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  'Pendência':            'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  'Devolvido':            'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  'Concluído':            'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  'Cancelado':            'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const TIPO_ICON = {
  'Usuario':      User,
  'Interveniente': Users,
  'Sistema':      Bot,
};

export default function LogsPedidoCompra({ pedidoId, pedido }) {
  const [logs, setLogs] = useState([]);
  const [embarques, setEmbarques] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pedidoId) return;
    setLoading(true);
    Promise.all([
      base44.entities.TransicaoPedidoCompra.filter({ pedido_id: pedidoId }, '-data_transicao'),
      base44.entities.Embarque.filter({ pedido_compra_id: pedidoId }, '-created_date', 100),
    ])
      .then(async ([transicoesData, embarquesData]) => {
        const embarquesHydrated = pedidoId
          ? await hydrateEmbarquesPedidoFromSql(base44, pedidoId, embarquesData || [])
          : (embarquesData || []);
        setLogs(transicoesData || []);
        setEmbarques(embarquesHydrated);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [pedidoId]);

  const embarquesComDivergencia = listarEmbarquesComDivergenciaRecepcao(embarques);
  const itensOrfaos = pedido ? calcularItensOrfaosPedido(pedido, embarques) : [];
  const temConteudo = logs.length > 0 || embarquesComDivergencia.length > 0 || itensOrfaos.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-border/40 border-t-muted-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (!temConteudo) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <ArrowRight className="w-5 h-5" />
        </div>
        <p className="text-sm">Nenhuma transição registrada</p>
        <p className="text-xs mt-1">O histórico aparecerá aqui conforme o pedido avança</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {embarquesComDivergencia.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Recepções com divergência
            </span>
          </div>
          {embarquesComDivergencia.map((emb) => (
            <div key={emb.id} className="rounded-lg border border-amber-500/20 bg-muted/40 px-3 py-2.5 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  Embarque {emb.codigo_exibicao || emb.numero || emb.id?.slice(0, 8)}
                </span>
                {emb.transportadora_nome && (
                  <span className="text-xs text-muted-foreground">· {emb.transportadora_nome}</span>
                )}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  {emb.status_recebimento || 'Com Divergência'}
                </span>
              </div>
              {emb.observacoes && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {emb.observacoes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {itensOrfaos.length > 0 && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <Package className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Órfãos aguardando novo embarque
            </span>
          </div>
          <ul className="space-y-1.5">
            {itensOrfaos.map((item) => (
              <li
                key={item.produto_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-orange-500/20 bg-muted/40 px-3 py-2"
              >
                <span className="text-sm text-foreground truncate">{item.produto_nome}</span>
                <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                  {formatQuantity(item.qtd_pendente)}{' '}
                  <span className="font-normal text-muted-foreground">{item.unidade_medida}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {logs.map((log, idx) => {
        const Icon = TIPO_ICON[log.tipo_autenticacao] || User;
        const dataFormatada = formatarDataHora(log.data_transicao);

        return (
          <div key={log.id || idx} className="bg-muted/50 rounded-xl px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {log.status_anterior && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CORES[log.status_anterior] || 'bg-muted text-muted-foreground'}`}>
                  {log.status_anterior}
                </span>
              )}
              {log.status_anterior && (
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CORES[log.status_novo] || 'bg-muted text-muted-foreground'}`}>
                {log.status_novo}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground truncate">
                  {log.responsavel_nome || log.responsavel_email || 'Sistema'}
                </span>
                {log.codigo_operacao && (
                  <span className="text-xs text-muted-foreground font-mono hidden sm:inline">· {log.codigo_operacao}</span>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">{dataFormatada}</span>
            </div>

            {log.observacao && (
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed border-t border-border/40 pt-1.5">
                {log.observacao}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
