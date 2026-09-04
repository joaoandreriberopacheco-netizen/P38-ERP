// Port automático de base44/functions/imprimirCupomTermico/entry.ts
import type { createP38Client } from '../p38Client.ts';
import { gerarCupomESCPOS } from './imprimirCupomTermicoEscpos.ts';

export async function handle(req: Request, base44: Awaited<ReturnType<typeof createP38Client>>): Promise<Response> {
  try {
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pedido_id, ip_impressora, porta = 9100 } = await req.json();

    if (!pedido_id) {
      return Response.json({ error: 'pedido_id é obrigatório' }, { status: 400 });
    }

    if (!ip_impressora) {
      return Response.json({ error: 'ip_impressora é obrigatório' }, { status: 400 });
    }

    const pedidos = await base44.entities.PedidoVenda.filter({ id: pedido_id });
    if (!pedidos || pedidos.length === 0) {
      return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }
    const pedido = pedidos[0];

    const empresas = await base44.entities.DadosEmpresa.list();
    const dadosEmpresa = empresas && empresas.length > 0 ? empresas[0] : null;

    const cupomESCPOS = gerarCupomESCPOS(pedido, dadosEmpresa);

    const encoder = new TextEncoder();
    const dados = encoder.encode(cupomESCPOS);

    try {
      const conn = await Deno.connect({ hostname: ip_impressora, port: porta });
      await conn.write(dados);
      conn.close();

      return Response.json({
        success: true,
        message: 'Cupom enviado para impressora térmica com sucesso',
        bytes_enviados: dados.length,
      });
    } catch (error) {
      console.error('Erro ao conectar com impressora:', error);
      return Response.json({
        error: 'Falha ao conectar com a impressora térmica',
        detalhes: error.message,
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
