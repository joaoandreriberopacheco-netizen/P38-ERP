import { useEffect, useState } from 'react';
import {
  ORIENTATION_CHANGE_EVENT,
  getPreferredOrientation,
  togglePreferredOrientation,
} from '@/lib/portraitOrientationLock';

export function usePreferredOrientation() {
  const [orientation, setOrientation] = useState(getPreferredOrientation);

  useEffect(() => {
    const sync = () => setOrientation(getPreferredOrientation());
    window.addEventListener(ORIENTATION_CHANGE_EVENT, sync);
    window.addEventListener('orientationchange', sync);
    screen.orientation?.addEventListener?.('change', sync);
    return () => {
      window.removeEventListener(ORIENTATION_CHANGE_EVENT, sync);
      window.removeEventListener('orientationchange', sync);
      screen.orientation?.removeEventListener?.('change', sync);
    };
  }, []);

  const rotationUnlocked = orientation === 'auto';

  return {
    orientation,
    rotationUnlocked,
    /** @deprecated usar rotationUnlocked */
    landscape: rotationUnlocked,
    toggle: () => togglePreferredOrientation(),
  };
}
