import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: painel duplicado → CaixasAtivos. */
export default function ControleCaixasAtivosPage() {
  return <Navigate to={createPageUrl('CaixasAtivos')} replace />;
}
