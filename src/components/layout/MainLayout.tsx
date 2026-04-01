import { ReactNode, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import AppSidebar from './AppSidebar';
import StartDayModal from '@/components/pos/StartDayModal';
import { LockScreen } from '@/components/pos/LockScreen';

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const [showStartDayModal, setShowStartDayModal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  // Check for an open register
  const { data: openRegister, isLoading } = useQuery({
    queryKey: ['open-register'],
    queryFn: api.registers.getOpen,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    // If not loading and no open register found, show the modal
    if (!isLoading && openRegister === null) {
      setShowStartDayModal(true);
    } else {
      setShowStartDayModal(false);
    }
  }, [openRegister, isLoading]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
      
      <StartDayModal 
        isOpen={showStartDayModal} 
        onSuccess={() => setShowStartDayModal(false)} 
      />

      <LockScreen />
    </div>
  );
};

export default MainLayout;
