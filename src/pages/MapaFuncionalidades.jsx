import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: mapa interno de funcionalidades removido → Home. */
export default function MapaFuncionalidadesPage() {
  return <Navigate to={createPageUrl('Home')} replace />;
}
