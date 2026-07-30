import { Navigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: protótipo antigo → SuperAgefin (AGEFIN canónica). */
export default function AgefinPage() {
  const location = useLocation();
  return <Navigate to={`${createPageUrl('SuperAgefin')}${location.search || ''}`} replace />;
}
