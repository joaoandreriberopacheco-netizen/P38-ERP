import OrcamentoPanel from '@/components/orcamento/OrcamentoPanel';

/** @deprecated Use OrcamentoPanel — mantido para o launcher FAB (Ctrl+Q). */
export default function QuickBudgetPanel(props) {
  return <OrcamentoPanel {...props} origem="rapido" />;
}
