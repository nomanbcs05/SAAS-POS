import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Clock,
  ClipboardList,
  Package,
  Settings2,
  Users,
   BarChart3,
  Settings,
  LogOut,
  Lock,
  Coffee,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Menu,
  ShieldCheck,
  Building2,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";
import { useQueryClient } from '@tanstack/react-query';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMultiTenant } from '@/hooks/useMultiTenant';

const AppSidebar = ({ isCollapsed, onToggle }: AppSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, tenant, isAdmin } = useMultiTenant();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [hideManagement, setHideManagement] = useState(() => {
    return localStorage.getItem('pos_hide_management') === 'true';
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  useEffect(() => {
    const updateDisplayName = () => {
      const saved = localStorage.getItem('active_staff_name');
      if (saved) {
        setDisplayName(saved);
      } else {
        setDisplayName(profile?.full_name || "User");
      }
    };

    updateDisplayName();
    window.addEventListener('active-staff-name-changed', updateDisplayName);
    
    const handleVisibilityChange = () => {
      setHideManagement(localStorage.getItem('pos_hide_management') === 'true');
    };
    window.addEventListener('pos-navigation-visibility-change', handleVisibilityChange);

    return () => {
      window.removeEventListener('active-staff-name-changed', updateDisplayName);
      window.removeEventListener('pos-navigation-visibility-change', handleVisibilityChange);
    };
  }, [profile]);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutGrid },
    { name: 'SaaS Admin', href: '/saas-admin', icon: ShieldCheck, superAdminOnly: true },
    { name: 'Running Orders', href: '/ongoing-orders', icon: Clock },
    { name: 'Orders', href: '/orders', icon: ClipboardList },
    { name: 'Products', href: '/products', icon: Package, adminOnly: true, management: true },
    { name: 'Customers', href: '/customers', icon: Users, adminOnly: true },
    { name: 'Reports', href: '/reports', icon: BarChart3, adminOnly: true, management: true },
    { name: 'Settings', href: '/settings', icon: Settings, adminOnly: true, management: true },
  ].filter(item => {
    if (item.superAdminOnly) return profile?.role === 'super-admin';
    if (item.adminOnly) {
      if (!isAdmin) return false;
      if (hideManagement && item.management) return false;
      return true;
    }
    return true;
  });

  const handleLogout = async () => {
    try {
      localStorage.removeItem("pos_local_user"); // Clear local dev session
      localStorage.removeItem("pos_hide_management"); // Reset hide state on logout
      await supabase.auth.signOut(); 
      toast.success("Logged out successfully");
      navigate("/auth");
    } catch (error) {
      toast.error("Error logging out");
    }
  };

  const handleLock = () => {
    localStorage.setItem('pos_is_locked', 'true');
    window.dispatchEvent(new Event('pos-lock-state-change'));
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        "bg-sidebar text-sidebar-foreground flex flex-col h-full transition-all duration-300 relative border-r border-sidebar-border",
        isCollapsed ? "w-[70px]" : "w-[200px]"
      )}>
        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-20 bg-sidebar-primary text-sidebar-primary-foreground w-6 h-6 rounded-full flex items-center justify-center shadow-lg border border-sidebar-border z-50 hover:scale-110 transition-transform"
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>

        {/* Logo */}
        <div className={cn(
          "p-4 border-b border-sidebar-border overflow-hidden",
          isCollapsed ? "items-center" : ""
        )}>
          <div className="flex items-center gap-3 min-w-max">
            <div className="w-10 h-10 rounded-2xl bg-sidebar-primary flex items-center justify-center shadow-lg shadow-sidebar-primary/20 shrink-0">
              <Building2 className="h-6 w-6 text-sidebar-primary-foreground" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
                <h1 className="font-black font-heading text-sm tracking-tight uppercase leading-none truncate">
                  GENX CLOUD POS
                </h1>
                <p className="text-[10px] font-bold text-sidebar-foreground/50 uppercase tracking-widest mt-1">
                  POS SYSTEM
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;

            return (
              isCollapsed ? (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold font-heading uppercase tracking-wider transition-all min-w-max",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-bold font-heading uppercase text-[10px] tracking-widest">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold font-heading uppercase tracking-wider transition-all min-w-max",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="animate-in fade-in slide-in-from-left-2 duration-300">{item.name}</span>
                  {/* Keyboard shortcut hints */}
                  {item.name === 'Dashboard' && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-sidebar-border text-sidebar-foreground/50 animate-in fade-in zoom-in duration-300">
                      F1
                    </span>
                  )}
                </NavLink>
              )
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-3 border-t border-sidebar-border">
          <div className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/50 overflow-hidden min-w-max",
            isCollapsed ? "justify-center px-2" : ""
          )}>
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center shadow-md shrink-0">
              <span className="text-[10px] font-black font-heading text-sidebar-primary-foreground">
                {(displayName || profile?.full_name || "US").substring(0, 2).toUpperCase()}
              </span>
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
                <p className="text-xs font-black font-heading truncate leading-tight tracking-tight uppercase">
                  {displayName || profile?.full_name || "User"}
                </p>
                <p className="text-[10px] font-black text-sidebar-foreground/40 uppercase tracking-widest mt-0.5">
                  {profile?.role || "Staff"}
                </p>
              </div>
            )}
          </div>

          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLock}
                  className={cn(
                    "w-full mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold font-heading uppercase tracking-widest text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all min-w-max",
                    "justify-center"
                  )}
                >
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-bold font-heading uppercase text-[10px] tracking-widest">
                Lock Terminal
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLock}
              className={cn(
                "w-full mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold font-heading uppercase tracking-widest text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all min-w-max"
              )}
            >
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span className="animate-in fade-in slide-in-from-left-2 duration-300">Lock Terminal</span>
            </button>
          )}

          {/* Install App Button */}
          {showInstallBtn && (
            isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleInstallClick}
                    className="w-full mb-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold font-heading uppercase tracking-widest text-sidebar-primary hover:bg-sidebar-primary/10 transition-all min-w-max"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-bold font-heading uppercase text-[10px] tracking-widest">
                  Install App
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={handleInstallClick}
                className="w-full mb-1 flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold font-heading uppercase tracking-widest text-sidebar-primary hover:bg-sidebar-primary/10 transition-all min-w-max"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span className="animate-in fade-in slide-in-from-left-2 duration-300">Install App</span>
              </button>
            )
          )}

          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className={cn(
                    "w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold font-heading uppercase tracking-widest text-sidebar-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-all min-w-max",
                    "justify-center"
                  )}
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-bold font-heading uppercase text-[10px] tracking-widest">
                Log out
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className={cn(
                "w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold font-heading uppercase tracking-widest text-sidebar-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-all min-w-max"
              )}
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span className="animate-in fade-in slide-in-from-left-2 duration-300">Log out</span>
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default AppSidebar;
