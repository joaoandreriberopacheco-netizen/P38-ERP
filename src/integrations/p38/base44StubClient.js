/**
 * Stub do cliente Base44 — produção Supabase nunca instancia o SDK real.
 */
export function createBase44StubClient(reason) {
  const fail = () => {
    throw new Error(
      `[P38] Base44 indisponível (${reason}). ` +
        'Produção usa Supabase (VITE_P38_PROVIDER=supabase).'
    );
  };
  const handler = {
    get: () =>
      new Proxy(function () {}, {
        get: () => handler.get(),
        apply: fail,
      }),
  };
  return new Proxy({ name: 'base44-stub' }, handler);
}
