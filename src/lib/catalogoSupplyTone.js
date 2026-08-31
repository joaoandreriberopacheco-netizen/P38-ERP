/**
 * Tons LED SMART SUPPLY — reutiliza regras cerâmica do portal.
 */
import {
  CERAM_MIN_LINHAS_SALDAVEL,
  atingeMassaCriticaCeramica,
} from '@/lib/modeloCatalogo/regrasCeramica';
import { portalEstoqueCx } from '@/lib/hierarquiaPortal/buildPortalSupplyCeramica';

export function resolveSkuSupplyTone(row, massaCritica) {
  const cx = portalEstoqueCx(row);
  if (cx <= 0) return 'ruptura';
  if (row.ponto_negativo) return 'ruptura_pfut';
  if (!atingeMassaCriticaCeramica(cx, massaCritica)) {
    return cx < massaCritica / 2 ? 'alerta_escuro' : 'alerta';
  }
  return 'off';
}

export function resolveEsquadraSupplyTone(eq) {
  const m = eq.metrics;
  if (eq.zerados > 0 || eq.veredicto_tom === 'critico') return 'ruptura';
  if (m?.ponto_negativo) return 'ruptura_pfut';
  if (eq.saldavel) return 'off';
  const ratio = (eq.abaixo_massa || 0) / (eq.sku_count || 1);
  return ratio >= 0.5 ? 'alerta_escuro' : 'alerta';
}

export function resolveLinhaSupplyTone(linha) {
  const m = linha.metrics;
  const esquadras = linha.esquadras || [];
  if (esquadras.some((e) => e.zerados > 0 || e.veredicto_tom === 'critico')) return 'ruptura';
  if (m?.ponto_negativo) return 'ruptura_pfut';
  if (
    linha.resumo?.esquadras_saldaveis === linha.resumo?.esquadras_total
    && linha.resumo?.esquadras_total > 0
  ) {
    return 'off';
  }
  const ratio = (linha.resumo?.esquadras_alerta || 0) / (linha.resumo?.esquadras_total || 1);
  return ratio >= 0.5 ? 'alerta_escuro' : 'alerta';
}
