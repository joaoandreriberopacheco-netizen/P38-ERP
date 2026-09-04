import {
  CERAM_MIN_LINHAS_SALDAVEL,
  atingeMassaCriticaCeramica,
} from '@/lib/modeloCatalogo/regrasCeramica';
import { portalEstoqueCx } from '@/lib/hierarquiaPortal/buildPortalSupplyCeramica';

export const SUPPLY_LED = {
  off: 'bg-muted-foreground/20 dark:bg-[#3c3c3c]',
  alerta: 'bg-[#e8b824] dark:bg-[#e8b824]',
  alerta_escuro: 'bg-[#d4a017] dark:bg-[#d4a017]',
  ruptura_pfut: 'bg-orange-500 dark:bg-orange-400',
  ruptura: 'bg-red-500 dark:bg-red-400',
};

export function resolveSkuLed(row, massaCritica) {
  const cx = portalEstoqueCx(row);
  if (cx <= 0) return 'ruptura';
  if (row.ponto_negativo) return 'ruptura_pfut';
  if (!atingeMassaCriticaCeramica(cx, massaCritica)) {
    return cx < massaCritica / 2 ? 'alerta_escuro' : 'alerta';
  }
  return 'off';
}

export function resolveEsquadraLed(eq) {
  if (eq.zerados > 0 || eq.veredicto_tom === 'critico') return 'ruptura';
  if (eq.metrics?.ponto_negativo) return 'ruptura_pfut';
  if (eq.saldavel) return 'off';
  const ratio = (eq.abaixo_massa || 0) / (eq.sku_count || 1);
  return ratio >= 0.5 ? 'alerta_escuro' : 'alerta';
}

export function resolveAggregateLed(node) {
  if (node.kind === 'sku' && node.sku) {
    return resolveSkuLed(node.sku, node.line?.massa_critica);
  }
  if (node.kind === 'esquadra' && node.line) {
    return resolveEsquadraLed(node.line);
  }
  const lines = node.lines || [];
  if (lines.some((l) => l.zerados > 0 || l.veredicto_tom === 'critico')) return 'ruptura';
  if (node.metrics?.ponto_negativo) return 'ruptura_pfut';
  if (node.saldavel) return 'off';
  const ratio = (node.resumo?.esquadras_alerta || 0) / (node.resumo?.esquadras_total || 1);
  return ratio >= 0.5 ? 'alerta_escuro' : 'alerta';
}

export function massaLabel(node) {
  if (node.kind === 'esquadra' && node.line) {
    return `${node.line.linhas_com_massa_critica}/${CERAM_MIN_LINHAS_SALDAVEL}`;
  }
  if (node.resumo?.esquadras_total != null) {
    return `${node.resumo.esquadras_saldaveis}/${node.resumo.esquadras_total}`;
  }
  return '';
}
