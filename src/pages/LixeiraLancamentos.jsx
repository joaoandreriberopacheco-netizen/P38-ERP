import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: lixeira de lançamentos removida → AGEFIN. */
export default function LixeiraLancamentosPage() {
  return <Navigate to={createPageUrl('SuperAgefin')} replace />;
}
