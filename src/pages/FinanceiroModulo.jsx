import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: hub financeiro removido → Fluxo de Caixa. */
export default function FinanceiroModuloPage() {
  return <Navigate to={createPageUrl('FluxoCaixa')} replace />;
}
