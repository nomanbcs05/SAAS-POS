import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import { shiftService, getCurrentCashierName } from '@/services/shiftService';
import { cashierApi } from '@/services/cashierApi';
import { supabase } from '@/integrations/supabase/client';
import { isDesktop } from '@/lib/env';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Zap,
  Banknote,
  Scale,
  UtensilsCrossed,
  Bike,
  Percent,
  CheckCheck,
  FileText,
  X,
  Power
} from 'lucide-react';

const PosDashboardPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentTime, setCurrentTime] = useState(new Date());
  const cashierName = getCurrentCashierName();

  // Dynamic live clock updating every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch current open shift
  const currentShift = useMemo(() => {
    return shiftService.getCurrentCashierOpenShift();
  }, []);

  // Starting drawer cash
  const drawerStart = currentShift?.starting_amount ?? 1;

  // Format shift start time
  const startedAtFormatted = useMemo(() => {
    if (!currentShift?.opened_at) return '11:27 PM';
    try {
      return format(new Date(currentShift.opened_at), 'hh:mm a');
    } catch {
      return '11:27 PM';
    }
  }, [currentShift]);

  // Fetch orders to calculate live performance metrics
  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: api.orders.getAll,
    refetchInterval: 5000,
  });

  // Calculate live stats for performance overview
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = orders.filter((o: any) => {
      if (!o.created_at) return false;
      const d = new Date(o.created_at);
      return !isNaN(d.getTime()) && d >= today;
    });

    const completed = todayOrders.filter((o: any) => o.status === 'completed');
    const cancelled = todayOrders.filter((o: any) => o.status === 'cancelled' || o.status === 'canceled' || o.status === 'refunded');

    const netSales = completed.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);
    const gstTax = Math.round(netSales * 0.08); // 8% default GST
    const serviceCharges = completed.reduce((sum: number, o: any) => sum + (Number(o.service_fee) || 0), 0);
    const deliveryFees = completed
      .filter((o: any) => o.order_type === 'delivery')
      .reduce((sum: number, o: any) => sum + (Number(o.delivery_fee) || 0), 0);

    const discounts = todayOrders.reduce((sum: number, o: any) => sum + (Number(o.discount) || 0), 0);
    
    const creditOrders = todayOrders.filter((o: any) => o.payment_method === 'credit');
    const finalUdhaar = creditOrders.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);
    const pendingUdhaarCount = creditOrders.filter((o: any) => o.status !== 'completed').length;
    const cancelledCount = cancelled.length;

    return {
      netSales,
      gstTax,
      serviceCharges,
      deliveryFees,
      discounts,
      finalUdhaar,
      pendingUdhaarCount,
      cancelledCount,
    };
  }, [orders]);

  // Handle End Session & Sign Out
  const handleEndSession = async () => {
    if (window.confirm('Are you sure you want to end session and sign out?')) {
      try {
        if (currentShift?.id) {
          await shiftService.closeShift(currentShift.id, currentShift.starting_amount + stats.netSales);
        }
        localStorage.removeItem("pos_local_user");
        localStorage.removeItem("pos_hide_management");
        localStorage.removeItem("pos_daily_counter");
        localStorage.removeItem("pos_session_id");
        localStorage.removeItem("pos_offline_session");
        localStorage.removeItem("pos_offline_profile");
        cashierApi.auth.clearSession();
        if (!isDesktop()) {
          await supabase.auth.signOut();
        }
        queryClient.clear();
        toast.success("Signed out successfully");
        navigate("/auth");
      } catch {
        toast.error("Error ending session");
      }
    }
  };

  const formattedDateString = format(currentTime, 'EEEE, dd MMMM yyyy • hh:mm:ss a');
  const cashierInitial = (cashierName.charAt(0) || 'W').toUpperCase();

  return (
    <MainLayout>
      <div className="min-h-full bg-slate-50/60 p-6 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                Operations Hub
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100/90 text-emerald-700 border border-emerald-200/60">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            </div>
            <p className="text-xs md:text-sm font-semibold text-slate-400 mt-1">
              {formattedDateString}
            </p>
          </div>

          {/* Cashier Profile Pill */}
          <div className="flex items-center gap-3 bg-white border border-slate-200/80 rounded-2xl px-4 py-2 shadow-sm w-fit">
            <div className="w-9 h-9 rounded-full bg-indigo-900 text-white font-black flex items-center justify-center text-sm shadow-sm">
              {cashierInitial}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-900 leading-tight">
                {cashierName}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 leading-tight">
                Cashier
              </span>
            </div>
          </div>
        </div>

        {/* Operational Profile Banner */}
        <div className="bg-[#062c43] text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden border border-blue-900/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-400/30 shrink-0">
              <Zap className="w-6 h-6 fill-cyan-400/30" />
            </div>
            <div>
              <div className="text-[11px] font-black tracking-widest text-cyan-300 uppercase">
                OPERATIONAL PROFILE: {cashierName.toUpperCase()}
              </div>
              <div className="text-2xl md:text-3xl font-black text-white tracking-tight mt-0.5">
                Started at {startedAtFormatted}
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-3 border border-white/15 text-left md:text-right min-w-[150px] shrink-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-cyan-200">
              DRAWER START
            </div>
            <div className="text-xl md:text-2xl font-black text-white mt-0.5">
              Rs. {drawerStart}
            </div>
          </div>
        </div>

        {/* Performance Overview Section */}
        <div className="space-y-4">
          <h2 className="text-xs font-black text-slate-700 tracking-widest uppercase font-heading">
            PERFORMANCE OVERVIEW
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. NET SALES */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-36">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  NET SALES
                </span>
                <Banknote className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Rs. {stats.netSales}
              </div>
            </div>

            {/* 2. GST / TAX */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-36">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  GST / TAX
                </span>
                <Scale className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Rs. {stats.gstTax}
              </div>
            </div>

            {/* 3. SERVICE */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-36">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  SERVICE
                </span>
                <UtensilsCrossed className="w-4 h-4 text-sky-500" />
              </div>
              <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Rs. {stats.serviceCharges}
              </div>
            </div>

            {/* 4. DELIVERY */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-36">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  DELIVERY
                </span>
                <Bike className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Rs. {stats.deliveryFees}
              </div>
            </div>

            {/* 5. DISCOUNTS */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-36">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  DISCOUNTS
                </span>
                <Percent className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Rs. {stats.discounts}
              </div>
            </div>

            {/* 6. FINAL UDHAAR */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-36">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  FINAL UDHAAR
                </span>
                <CheckCheck className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Rs. {stats.finalUdhaar}
              </div>
            </div>

            {/* 7. PENDING UDHAAR */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-36">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  PENDING UDHAAR
                </span>
                <FileText className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {stats.pendingUdhaarCount}
              </div>
            </div>

            {/* 8. CANCELLED */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-36">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  CANCELLED
                </span>
                <X className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {stats.cancelledCount}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Red End Session Button */}
        <div className="flex justify-center pt-8 pb-4">
          <Button
            onClick={handleEndSession}
            className="bg-[#EF4444] hover:bg-[#DC2626] text-white font-black text-sm uppercase tracking-wider rounded-2xl h-14 px-8 shadow-xl shadow-red-500/20 gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="w-6 h-6 rounded-full border-2 border-white/80 flex items-center justify-center">
              <Power className="w-3.5 h-3.5 text-white" />
            </div>
            END SESSION & SIGN OUT
          </Button>
        </div>
      </div>
    </MainLayout>
  );
};

export default PosDashboardPage;
