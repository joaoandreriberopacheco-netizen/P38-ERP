import { useEffect, useState } from 'react';
import {
  FORCE_LANDSCAPE_ATTR,
  ORIENTATION_CHANGE_EVENT,
  isForceLandscapeCssActive,
} from '@/lib/portraitOrientationLock';

/** true quando o fallback CSS de paisagem está activo (telemóvel/tablet em pé). */
export function useForceLandscape() {
  const [active, setActive] = useState(() => isForceLandscapeCssActive());

  useEffect(() => {
    const sync = () => setActive(isForceLandscapeCssActive());
    window.addEventListener(ORIENTATION_CHANGE_EVENT, sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [FORCE_LANDSCAPE_ATTR],
    });
    return () => {
      window.removeEventListener(ORIENTATION_CHANGE_EVENT, sync);
      observer.disconnect();
    };
  }, []);

  return active;
}
