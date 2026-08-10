import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado: editor de layouts de documento removido → Configurações. */
export default function EditorLayoutsTresPage() {
  return <Navigate to={createPageUrl('Configuracoes')} replace />;
}
