'use client';

import { useNavigationTransition } from '@/lib/NavigationTransitionContext';

/** Barra fina no topo — feedback imediato ao clicar num link. */
export default function NavigationProgressBar() {
  const { isNavigating } = useNavigationTransition();

  if (!isNavigating) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
      role="progressbar"
      aria-hidden
    >
      <div
        className="h-full w-1/3 bg-[#4a5240] dark:bg-[#a4ce33]"
        style={{ animation: 'p38-nav-progress 0.9s ease-in-out infinite' }}
      />
    </div>
  );
}
