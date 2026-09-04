import { isSupabaseBrowserConfigured, getSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';
import { listarAnexosSupabase } from '@/lib/anexosSupabase';
import { invokeFunction } from './_invokeHelper';

export async function listarAnexos(body) {
  if (isSupabaseBrowserConfigured()) {
    const supabase = getSupabaseBrowserClient();
    const result = await listarAnexosSupabase({ supabase, body });
    return { data: result };
  }
  return invokeFunction('listarAnexos', body);
}
