import React, { useState, useEffect } from 'react';
import { Play, Square, Wallet, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { shiftService, ShiftSession, getCurrentCashierName, getCurrentUserId } from '@/services/shiftService';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { toast } from 'sonner';

export const PosShiftBar: React.FC = () => {
  const { tenant } = useMultiTenant();
  const [currentShift, setCurrentShift] = useState<ShiftSession | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [closingBalance, setClosingBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const refreshShift = () => {
    const shift = shiftService.getCurrentDeviceShift();
    setCurrentShift(shift);
  };

  useEffect(() => {
    refreshShift();

    const handleShiftChange = () => {
      refreshShift();
    };

    window.addEventListener('shift_changed', handleShiftChange);
    return () => {
      window.removeEventListener('shift_changed', handleShiftChange);
    };
  }, []);

  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const balanceNum = parseFloat(openingBalance);
    if (isNaN(balanceNum) || balanceNum < 0) {
      toast.error('Please enter a valid opening balance (0 or positive)');
      return;
    }

    setLoading(true);
    try {
      const cashierName = getCurrentCashierName();
      const userId = getCurrentUserId();
      const newShift = await shiftService.openShift(balanceNum, cashierName, userId, tenant?.id);
      setCurrentShift(newShift);
      setShowStartModal(false);
      setOpeningBalance('0');
      toast.success(`Shift started on this device with Rs. ${balanceNum.toLocaleString()}`);
    } catch (err: any) {
      toast.error('Failed to start shift: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleEndShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const balanceNum = closingBalance.trim() ? parseFloat(closingBalance) : (currentShift?.opening_balance || 0);

    setLoading(true);
    try {
      await shiftService.closeShift(currentShift?.id, balanceNum, notes);
      setCurrentShift(null);
      setShowEndModal(false);
      setClosingBalance('');
      setNotes('');
      toast.success('Shift ended for this terminal. Other devices remain active.');
    } catch (err: any) {
      toast.error('Failed to end shift: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <>
      {/* Top Shift Ribbon on POS screen */}
      <div className="bg-slate-900 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 shadow-inner">
        <div className="flex items-center gap-3">
          {currentShift ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Shift Active
                </span>
              </div>
              <div className="h-4 w-px bg-slate-700 hidden sm:block" />
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <span>Cashier: <strong className="text-white">{currentShift.cashier_name}</strong></span>
                <span className="text-slate-500">•</span>
                <span>Started: <strong className="text-white">{formatTime(currentShift.start_time)}</strong></span>
                <span className="text-slate-500">•</span>
                <span>Opening: <strong className="text-emerald-400">Rs. {Number(currentShift.opening_balance).toLocaleString()}</strong></span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-amber-400 font-bold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>No shift open on this terminal. Start shift to begin billing.</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentShift ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEndModal(true)}
              className="h-7 px-3 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 border-red-500/30 text-[11px] font-black uppercase tracking-wider transition-all"
            >
              <Square className="h-3 w-3 mr-1 fill-current" />
              End Shift
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setShowStartModal(true)}
              className="h-7 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-wider shadow-sm shadow-emerald-600/30 transition-all"
            >
              <Play className="h-3 w-3 mr-1 fill-current" />
              Start Shift
            </Button>
          )}
        </div>
      </div>

      {/* Start Shift Dialog */}
      <Dialog open={showStartModal} onOpenChange={setShowStartModal}>
        <DialogContent className="max-w-md bg-white text-slate-900 rounded-2xl p-6">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
              <Play className="h-6 w-6 fill-current" />
            </div>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">
              Start Cashier Shift
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium">
              Start an independent register shift for this terminal. Admin start day is not required.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleStartShift} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="openingCash" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Opening Balance / Drawer Cash (Rs.)
              </Label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="openingCash"
                  type="number"
                  min="0"
                  step="any"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0"
                  required
                  autoFocus
                  className="pl-10 h-11 text-lg font-black border-2 border-slate-200 focus:border-emerald-600 rounded-xl"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowStartModal(false)}
                className="font-bold text-xs uppercase"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider px-6 rounded-xl shadow-md"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-3.5 w-3.5 mr-1 fill-current" />}
                Confirm & Start Shift
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* End Shift Dialog */}
      <Dialog open={showEndModal} onOpenChange={setShowEndModal}>
        <DialogContent className="max-w-md bg-white text-slate-900 rounded-2xl p-6">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2">
              <Square className="h-6 w-6 fill-current" />
            </div>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">
              End Current Shift
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium">
              Closing this shift will only close this device terminal. Any other active devices will remain logged in and running.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEndShift} className="space-y-4 mt-2">
            <div className="bg-slate-50 p-3 rounded-xl border space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold uppercase">Opening Balance:</span>
                <span className="font-black">Rs. {Number(currentShift?.opening_balance || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold uppercase">Started At:</span>
                <span className="font-black">{formatTime(currentShift?.start_time)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="closingCash" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Closing Cash Balance (Rs.)
              </Label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="closingCash"
                  type="number"
                  min="0"
                  step="any"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(e.target.value)}
                  placeholder={String(currentShift?.opening_balance || 0)}
                  className="pl-10 h-11 text-lg font-black border-2 border-slate-200 focus:border-red-600 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="shiftNotes" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Notes (Optional)
              </Label>
              <Input
                id="shiftNotes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., handover notes, cash discrepancy..."
                className="h-10 text-xs border-slate-200 rounded-xl"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowEndModal(false)}
                className="font-bold text-xs uppercase"
              >
                Keep Shift Open
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider px-6 rounded-xl shadow-md"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Square className="h-3.5 w-3.5 mr-1 fill-current" />}
                Close Shift
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PosShiftBar;
