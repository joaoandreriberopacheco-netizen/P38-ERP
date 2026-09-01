import { generateRelatorioDizimoEnxutoPdf } from '@/lib/relatorioDizimoPdf';

/** Gera o PDF do Dízimo diretamente no browser. */
export async function gerarRelatorioDizimo(body) {
  return generateRelatorioDizimoEnxutoPdf(body ?? {});
}
