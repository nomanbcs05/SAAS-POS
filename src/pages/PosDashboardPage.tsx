import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { shiftService, getCurrentCashierName } from "@/services/shiftService";
import { cashierApi } from "@/services/cashierApi";
import { supabase } from "@/integrations/supabase/client";
import { isDesktop } from "@/lib/env";
import { toast } from "sonner";
import { format } from "date-fns";
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
  Power,
  AlertTriangle,
  Wallet,
} from "lucide-react";

interface EndShiftModalProps {
  drawerStart: number;
  cashierName: string;
  netSales: number;
  onConfirm: (closingCash: number) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const EndShiftModal = ({
  drawerStart,
  cashierName,
  netSales,
  onConfirm,
  onCancel,
  isLoading,
}: EndShiftModalProps) => {
  const [closingCash, setClosingCash] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const expectedCash = drawerStart + netSales;
  const closingNum = parseFloat(closingCash) || 0;
  const difference = closingNum - expectedCash;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingCash || isNaN(closingNum) || closingNum < 0) {
      toast.error("Please enter a valid closing cash amount");
      return;
    }
    onConfirm(closingNum);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/60">
        <div className="bg-[#062c43] px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-500/20 flex items-center justify-center border border-red-400/30">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-white font-black text-base tracking-tight">
              End Shift & Sign Out
            </h2>
            <p className="text-cyan-300 text-[11px] font-semibold uppercase tracking-widest mt-0.5">
              {cashierName}
            </p>
          </div>
          <button
            onClick={onCancel}
            type="button"
            className="ml-auto w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  Start Day Cash
                </span>
              </div>
              <span className="text-base font-black text-slate-900">
                Rs. {drawerStart.toFixed(0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  Net Sales (Shift)
                </span>
              </div>
              <span className="text-base font-black text-emerald-700">
                + Rs. {netSales.toFixed(0)}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
              <span className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Expected in Drawer
              </span>
              <span className="text-lg font-black text-slate-900">
                Rs. {expectedCash.toFixed(0)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              Cash in Drawer (Actual Count)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                Rs.
              </span>
              <input
                ref={inputRef}
                type="number"
                min="0"
                step="1"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder="0"
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-200 focus:border-indigo-500 focus:outline-none text-xl font-black text-slate-900 bg-white transition-colors"
              />
            </div>
          </div>

          {closingCash !== "" && (
            <div
              className={`rounded-2xl p-3 flex items-center justify-between border ${
                difference >= 0
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <span
                className={`text-xs font-black uppercase tracking-wider ${
                  difference >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {difference >= 0 ? "Surplus" : "Shortage"}
              </span>
              <span
                className={`text-base font-black ${
                  difference >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {difference >= 0 ? "+" : ""}Rs. {difference.toFixed(0)}
              </span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              onClick={onCancel}
              variant="outline"
              className="flex-1 h-12 rounded-2xl font-bold border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !closingCash}
              className="flex-1 h-12 rounded-2xl font-black bg-red-500 hover:bg-red-600 text-white gap-2 shadow-lg shadow-red-500/20 transition-all"
            >
              <Power className="w-4 h-4" />
              {isLoading ? "Ending Shift..." : "End & Sign Out"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PosDashboardPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);
  const [isEndingShift, setIsEndingShift] = useState(false);
  const cashierName = getCurrentCashierName();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentShift = useMemo(
    () => shiftService.getCurrentCashierOpenShift(),
    []
  );

  const drawerStart = currentShift?.starting_amount ?? 0;

  const startedAtFormatted = useMemo(() => {
    if (!currentShift?.opened_at) return "--";
    try {
      return format(new Date(currentShift.opened_at), "hh:mm a");
    } catch {
      return "--";
    }
  }, [currentShift]);

  const shiftStartedAt = useMemo(() => {
    if (!currentShift?.opened_at) return null;
    try {
      return new Date(currentShift.opened_at);
    } catch {
      return null;
    }
  }, [currentShift]);

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: api.orders.getAll,
    refetchInterval: 5000,
  });

  const stats = useMemo(() => {
    const cutoff =
      shiftStartedAt ??
      (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      })();

    const shiftOrders = orders.filter((o: any) => {
      if (!o.created_at) return false;
      try {
        const d = new Date(o.created_at);
        if (
          currentShift?.id &&
          o.register_id &&
          o.register_id === currentShift.id
        )
          return true;
        return !isNaN(d.getTime()) && d >= cutoff;
      } catch {
        return false;
      }
    });

    const completed = shiftOrders.filter((o: any) => o.status === "completed");
    const cancelled = shiftOrders.filter((o: any) =>
      ["cancelled", "canceled", "refunded"].includes(o.status)
    );

    const netSales = completed.reduce(
      (s: number, o: any) => s + (Number(o.total_amount) || 0),
      0
    );
    const gstTax = completed.reduce(
      (s: number, o: any) => s + (Number(o.tax_amount) || 0),
      0
    );
    const serviceCharges = completed.reduce(
      (s: number, o: any) => s + (Number(o.service_fee) || 0),
      0
    );
    const deliveryFees = completed
      .filter((o: any) => o.order_type === "delivery")
      .reduce((s: number, o: any) => s + (Number(o.delivery_fee) || 0), 0);
    const discounts = shiftOrders.reduce(
      (s: number, o: any) => s + (Number(o.discount) || 0),
      0
    );
    const creditOrders = shiftOrders.filter(
      (o: any) => o.payment_method === "credit"
    );
    const finalUdhaar = creditOrders
      .filter((o: any) => o.status === "completed")
      .reduce((s: number, o: any) => s + (Number(o.total_amount) || 0), 0);
    const pendingUdhaarCount = creditOrders.filter(
      (o: any) => o.status !== "completed"
    ).length;

    return {
      netSales,
      gstTax,
      serviceCharges,
      deliveryFees,
      discounts,
      finalUdhaar,
      pendingUdhaarCount,
      cancelledCount: cancelled.length,
    };
  }, [orders, shiftStartedAt, currentShift]);

  const handleConfirmEndShift = async (closingCash: number) => {
    setIsEndingShift(true);
    try {
      if (currentShift?.id) {
        await shiftService.closeShift(
          currentShift.id,
          closingCash,
          `Closing count: Rs.${closingCash}`
        );
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
      toast.success("Shift ended & signed out");
      navigate("/auth");
    } catch {
      toast.error("Error ending shift. Please try again.");
      setIsEndingShift(false);
    }
  };

  const formattedDate = format(currentTime, "EEEE, dd MMMM yyyy");
  const formattedTime = format(currentTime, "hh:mm:ss a");
  const cashierInitial = (cashierName.charAt(0) || "W").toUpperCase();

  const cards = [
    {
      label: "NET SALES",
      value: `Rs. ${stats.netSales.toFixed(0)}`,
      icon: Banknote,
      color: "text-emerald-500",
    },
    {
      label: "GST / TAX",
      value: `Rs. ${stats.gstTax.toFixed(0)}`,
      icon: Scale,
      color: "text-indigo-500",
    },
    {
      label: "SERVICE",
      value: `Rs. ${stats.serviceCharges.toFixed(0)}`,
      icon: UtensilsCrossed,
      color: "text-sky-500",
    },
    {
      label: "DELIVERY",
      value: `Rs. ${stats.deliveryFees.toFixed(0)}`,
      icon: Bike,
      color: "text-emerald-500",
    },
    {
      label: "DISCOUNTS",
      value: `Rs. ${stats.discounts.toFixed(0)}`,
      icon: Percent,
      color: "text-rose-500",
    },
    {
      label: "FINAL UDHAAR",
      value: `Rs. ${stats.finalUdhaar.toFixed(0)}`,
      icon: CheckCheck,
      color: "text-amber-500",
    },
    {
      label: "PENDING UDHAAR",
      value: `${stats.pendingUdhaarCount}`,
      icon: FileText,
      color: "text-amber-500",
    },
    {
      label: "CANCELLED",
      value: `${stats.cancelledCount}`,
      icon: X,
      color: "text-rose-500",
    },
  ];

  return (
    <MainLayout>
      <div className="min-h-full bg-slate-50/60 p-6 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
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
              {formattedDate}&nbsp;&middot;&nbsp;
              <span className="font-mono">{formattedTime}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white border border-slate-200/80 rounded-2xl px-4 py-2 shadow-sm w-fit shrink-0">
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
        <div className="bg-[#062c43] text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-blue-900/30">
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
              {!currentShift && (
                <div className="text-[11px] text-yellow-300 font-semibold mt-1">
                  No active shift found
                </div>
              )}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-3 border border-white/15 text-left md:text-right min-w-[170px] shrink-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-cyan-200">
              DRAWER START
            </div>
            <div className="text-2xl font-black text-white mt-0.5">
              Rs. {drawerStart.toFixed(0)}
            </div>
          </div>
        </div>

        {/* Performance Overview */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-black text-slate-700 tracking-widest uppercase">
              PERFORMANCE OVERVIEW
            </h2>
            <span className="text-[10px] text-slate-400 font-semibold">
              (This Shift Only)
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-32"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {label}
                  </span>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* End Shift Button */}
        <div className="flex justify-center pt-6 pb-4">
          <Button
            onClick={() => setShowEndShiftModal(true)}
            className="bg-[#EF4444] hover:bg-[#DC2626] text-white font-black text-sm uppercase tracking-wider rounded-2xl h-14 px-10 shadow-xl shadow-red-500/20 gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="w-6 h-6 rounded-full border-2 border-white/80 flex items-center justify-center">
              <Power className="w-3.5 h-3.5 text-white" />
            </div>
            END SHIFT & SIGN OUT
          </Button>
        </div>
      </div>

      {showEndShiftModal && (
        <EndShiftModal
          drawerStart={drawerStart}
          cashierName={cashierName}
          netSales={stats.netSales}
          onConfirm={handleConfirmEndShift}
          onCancel={() => setShowEndShiftModal(false)}
          isLoading={isEndingShift}
        />
      )}
    </MainLayout>
  );
};

export default PosDashboardPage;
