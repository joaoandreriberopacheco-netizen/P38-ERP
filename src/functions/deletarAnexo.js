import { isSupabaseBrowserConfigured, getSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';
import { deletarAnexoSupabase } from '@/lib/anexosSupabase';
import { invokeFunction } from './_invokeHelper';

export async function deletarAnexo(body) {
  if (isSupabaseBrowserConfigured()) {
    const supabase = getSupabaseBrowserClient();
    const result = await deletarAnexoSupabase({ supabase, body });
    return { data: result };
  }
  return invokeFunction('deletarAnexo', body);
}
