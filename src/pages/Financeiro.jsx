import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: hub financeiro antigo → Fluxo de Caixa. */
export default function FinanceiroPage() {
  return <Navigate to={createPageUrl('FluxoCaixa')} replace />;
}
