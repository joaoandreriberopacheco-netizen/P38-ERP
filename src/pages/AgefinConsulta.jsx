import { Navigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: AGEFIN antiga → SuperAgefin (mantém query ?competencia= etc.). */
export default function AgefinConsultaPage() {
  const location = useLocation();
  return <Navigate to={`${createPageUrl('SuperAgefin')}${location.search || ''}`} replace />;
}
