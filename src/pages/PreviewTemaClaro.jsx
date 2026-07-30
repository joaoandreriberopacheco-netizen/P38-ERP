import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: preview de tema removido → Home. */
export default function PreviewTemaClaroPage() {
  return <Navigate to={createPageUrl('Home')} replace />;
}
