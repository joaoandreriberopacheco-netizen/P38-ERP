import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: manual multi-inquilino removido → Home. */
export default function ManualPage() {
  return <Navigate to={createPageUrl('Home')} replace />;
}
