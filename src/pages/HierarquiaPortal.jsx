import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Portal legado — redirecciona para Catálogo 4×3. */
export default function HierarquiaPortalPage() {
  return <Navigate to={createPageUrl('ProdutosCatalogo4x3')} replace />;
}
