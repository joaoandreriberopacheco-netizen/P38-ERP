/** Senha de autorização para operações críticas (ex.: cancelar venda). */
export function resolveSenhaCancelarVenda(): string {
  return Deno.env.get('P38_SENHA_CANCELAR_VENDA')?.trim() || '#Tamborim01#';
}

export function validarSenhaCancelarVenda(informada: string): boolean {
  const senha = String(informada || '').trim();
  if (!senha) return false;
  return senha === resolveSenhaCancelarVenda();
}
