import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

/** Legado — redirecciona para o catálogo 4×3 (cópia da tela Produtos). */
export default function CatalogoExcelPage() {
  return <Navigate to={createPageUrl('ProdutosCatalogo4x3')} replace />;
}
