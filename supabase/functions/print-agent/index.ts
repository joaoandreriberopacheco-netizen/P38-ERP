import { servePorted } from '../_shared/servePorted.ts';
import { handle } from '../_shared/handlers/printAgent.ts';
Deno.serve(servePorted(handle));
