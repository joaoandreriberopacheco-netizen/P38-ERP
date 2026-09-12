import { servePorted } from '../_shared/servePorted.ts';
import { handle } from '../_shared/handlers/cancelarPedidoVenda.ts';

Deno.serve(servePorted(handle));
