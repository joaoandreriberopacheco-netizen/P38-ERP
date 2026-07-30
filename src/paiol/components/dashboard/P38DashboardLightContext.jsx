import React, { createContext, useContext } from 'react';

const P38DashboardLightContext = createContext(false);

/** Activa superfícies modo claro mobile (shell carvão + folha branca). */
export function P38DashboardLightProvider({ enabled, children }) {
  return (
    <P38DashboardLightContext.Provider value={Boolean(enabled)}>
      {children}
    </P38DashboardLightContext.Provider>
  );
}

export function useP38DashboardLightShell() {
  return useContext(P38DashboardLightContext);
}
