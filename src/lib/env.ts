declare global {
  interface Window {
    electronAPI?: any;
  }
}

export const isElectron = () => {
  // Check if we are running in Electron
  const isElectronApp = typeof window !== 'undefined' && 
         (window.electronAPI || 
          window.process?.versions?.electron || 
          navigator.userAgent.indexOf('Electron') >= 0);
  return !!isElectronApp;
};

export const isDesktop = isElectron;
