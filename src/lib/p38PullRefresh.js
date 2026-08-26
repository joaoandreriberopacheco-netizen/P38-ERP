import { p38Keys } from '@/lib/p38QueryConfig';

export const P38_PULL_REFRESH_EVENT = 'p38:pull-refresh';

export function dispatchP38PullRefresh(page) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(P38_PULL_REFRESH_EVENT, { detail: { page } }));
}

/** Comportamento padrão: evento para páginas com lógica própria + invalidar cache React Query. */
export async function runDefaultP38PullRefresh(queryClient, page) {
  dispatchP38PullRefresh(page);
  await queryClient.invalidateQueries({ queryKey: p38Keys.all });
}
