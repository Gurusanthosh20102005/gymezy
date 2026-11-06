import React, { createContext, useContext, useState, useCallback } from 'react';

const RefreshContext = createContext({
  refreshKey: 0,
  isRefreshing: false,
  triggerRefresh: () => {},
});

export const RefreshProvider = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const triggerRefresh = useCallback(() => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);

    // Broadcast standard DOM custom event so any component or hook can listen if needed
    window.dispatchEvent(new CustomEvent('app:refresh', { detail: { timestamp: Date.now() } }));

    // Reset spinning state after quick pulse
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  }, []);

  return (
    <RefreshContext.Provider value={{ refreshKey, isRefreshing, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefresh = () => {
  const context = useContext(RefreshContext);
  if (!context) {
    return {
      refreshKey: 0,
      isRefreshing: false,
      triggerRefresh: () => window.location.reload(),
    };
  }
  return context;
};

export default RefreshContext;

