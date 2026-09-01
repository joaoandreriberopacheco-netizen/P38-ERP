/** Páginas do módulo Financeiro protegidas por senha / biometria. */
import { p38PublicEnv } from '@/lib/p38PublicEnv';

export const FINANCEIRO_PROTECTED_PAGES = new Set([
  'FluxoCaixa',
  'ContasFinanceiras',
  'AprovacoesFinanceiras',
  'FinanceiroAprovacoes',
  'CaixasAtivos',
  'TurnosFechados',
  'Agefin',
  'AgefinConsulta',
  'SuperAgefin',
  'ExtratoConta',
  'LancamentoAnexos',
  'AtualizarBoletoRecorrente',
  'ReversaoDespesasSangrias',
  'FolhaPrevisao',
  'PlanejamentoFinanceiro',
  'PlanejamentoFinanceiroV2',
  'Budgets',
  'VisaoFinanceira',
  'Dizimo',
  'AgendaFinanceira',
]);

export const FINANCEIRO_UNLOCK_TTL_MS = 15 * 60 * 1000;

/** Definir `VITE_FINANCEIRO_GATE_PASSWORD` no deploy (ex.: Vercel). Comparação sem maiúsc./minúsc. */
export const FINANCEIRO_GATE_PASSWORD = String(
  p38PublicEnv('VITE_FINANCEIRO_GATE_PASSWORD') ?? '',
).trim();

export const FINANCEIRO_GATE_ENABLED = FINANCEIRO_GATE_PASSWORD.length > 0;

export function isFinanceiroProtectedPage(pageName) {
  return FINANCEIRO_PROTECTED_PAGES.has(pageName);
}

export function financeiroGatePasswordMatches(input) {
  if (!FINANCEIRO_GATE_ENABLED) return true;
  return String(input ?? '').trim().toLowerCase() === FINANCEIRO_GATE_PASSWORD.toLowerCase();
}
