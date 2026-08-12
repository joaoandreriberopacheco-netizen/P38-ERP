import { base44 } from '@/api/base44Client';

/** Prefixo AAMMDD do dia corrente (ex.: 260812). */
export function prefixoSenhaAtendimentoHoje(date = new Date()) {
  const ano = String(date.getFullYear()).slice(-2);
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}${mes}${dia}`;
}

/** Próxima senha sequencial do dia (formato AAMMDD###). */
export async function gerarProximaSenhaAtendimento() {
  const prefixoData = prefixoSenhaAtendimentoHoje();
  const todosRascunhos = await base44.entities.RascunhoPedidoVenda.list();
  const rascunhosHoje = (todosRascunhos || []).filter((r) =>
    r.senha_atendimento?.startsWith(prefixoData)
  );
  const proximoSequencial = rascunhosHoje.length + 1;
  return `${prefixoData}${String(proximoSequencial).padStart(3, '0')}`;
}
