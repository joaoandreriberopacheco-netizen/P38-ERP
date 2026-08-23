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
    return () => window.removeEventListener(ORIENTATION_CHANGE_EVENT, sync);
  }, []);

  const landscape = orientation === 'landscape';

  return {
    orientation,
    landscape,
    toggle: () => togglePreferredOrientation(),
  };
}
