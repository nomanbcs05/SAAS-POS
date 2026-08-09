import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sun, Wallet, LogOut, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { shiftService, getCurrentCashierName } from '@/services/shiftService';
import { supabase } from '@/integrations/supabase/client';
import { isDesktop } from '@/lib/env';
import { toast } from 'sonner';

export const OpenShiftModal: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [openingCash, setOpeningCash] = useState<string>('1');
  const [loading, setLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const checkShiftStatus = () => {
    // Only check shift status on protected routes (not auth/login pages)
    const unauthenticatedPaths = ['/auth', '/login', '/license-manager', '/saas-admin'];
    if (unauthenticatedPaths.includes(location.pathname)) {
      setIsOpen(false);
      return;
    }

    const currentShift = shiftService.getCurrentCashierOpenShift();
    if (!currentShift) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    checkShiftStatus();

    const handleShiftChange = () => {
      checkShiftStatus();
    };

    window.addEventListener('shift_changed', handleShiftChange);
    return () => {
      window.removeEventListener('shift_changed', handleShiftChange);
    };
  }, [location.pathname]);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const cashNum = parseFloat(openingCash);
    if (isNaN(cashNum) || cashNum < 1) {
      toast.error('Please enter a valid opening cash amount (Min: 1 Rs.)');
      return;
    }

    setLoading(true);
    try {
      const cashierName = getCurrentCashierName();
      await shiftService.openShift(cashNum, cashierName);
      toast.success(`Shift opened successfully for ${cashierName} with Rs. ${cashNum.toLocaleString()}`);
      setIsOpen(false);
    } catch (err: any) {
      toast.error('Failed to open shift: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('pos_local_user');
      localStorage.removeItem('pos_daily_counter');
      localStorage.removeItem('pos_session_id');
      localStorage.removeItem('pos_offline_session');
      localStorage.removeItem('pos_offline_profile');
      localStorage.removeItem('active_staff_name');
      if (!isDesktop()) {
        await supabase.auth.signOut();
      }
      toast.info('Logged out successfully');
      setIsOpen(false);
      navigate('/auth');
    } catch (err: any) {
      toast.error('Logout error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-50 dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-200/50 dark:border-slate-800 text-slate-900 dark:text-slate-100 flex flex-col items-center text-center">
        
        {/* Sun Icon Header */}
        <div className="mb-4 p-4 rounded-full bg-amber-100/80 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center animate-bounce duration-1000">
          <Sun className="h-12 w-12 text-amber-500 fill-amber-400" />
        </div>

        {/* Title & Description */}
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1 text-slate-900 dark:text-white">
          Start Business Day
        </h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">
          Enter initial cash in drawer (Min: 1 Rs.)
        </p>

        {/* Opening Cash Input Form */}
        <form onSubmit={handleOpenShift} className="w-full space-y-6">
          <div className="relative text-left">
            <Label htmlFor="openingCash" className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2 ml-1">
              Opening Cash (Rs.)
            </Label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-slate-500 pointer-events-none flex items-center">
                <Wallet className="h-5 w-5" />
              </div>
              <Input
                id="openingCash"
                type="number"
                min="1"
                step="any"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                required
                className="pl-11 h-13 text-lg font-bold rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-[#002855] focus:ring-2 focus:ring-[#002855]/20"
                placeholder="1"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleLogout}
              disabled={loading}
              className="text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-200/60 font-bold uppercase tracking-wider text-xs h-11 px-4 rounded-xl"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>

            <Button
              type="submit"
              disabled={loading}
              className="bg-[#002855] hover:bg-[#001D40] text-white font-black tracking-wider uppercase text-xs h-11 px-8 rounded-full shadow-lg shadow-[#002855]/25 flex-1 max-w-[200px]"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : (
                'Open Shift'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OpenShiftModal;
