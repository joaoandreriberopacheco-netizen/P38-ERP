import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

const NavigationTransitionContext = createContext(null);

const noop = {
  beginNavigation: () => {},
  isNavigating: false,
  pendingHref: null,
};

export const NavigationTransitionProvider = ({ children }) => {
  const { pathname } = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);
  const [pendingHref, setPendingHref] = useState(null);

  const beginNavigation = useCallback((href) => {
    const dest = String(href || '/');
    setPendingHref(dest);
    setIsNavigating(true);
  }, []);

  useEffect(() => {
    setIsNavigating(false);
    setPendingHref(null);
  }, [pathname]);

  const value = useMemo(
    () => ({
      beginNavigation,
      isNavigating,
      pendingHref,
      triggerTransition: async (callback) => {
        if (callback) callback();
      },
      showTransition: false,
      setShowTransition: () => {},
    }),
    [beginNavigation, isNavigating, pendingHref],
  );

  return (
    <NavigationTransitionContext.Provider value={value}>
      {children}
    </NavigationTransitionContext.Provider>
  );
};

export const useNavigationTransition = () => {
  const context = useContext(NavigationTransitionContext);
  return context ?? noop;
};

export function NavigationTransitionDetector() {
  return null;
}
