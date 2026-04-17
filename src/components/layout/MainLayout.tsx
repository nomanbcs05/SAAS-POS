import { ReactNode, useState, useEffect } from 'react';
import AppSidebar from './AppSidebar';
import { LockScreen } from '@/components/pos/LockScreen';

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
      
      <LockScreen />
    </div>
  );
};

export default MainLayout;
