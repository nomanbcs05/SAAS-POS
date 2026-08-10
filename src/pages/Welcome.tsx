import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { User, Shield, Users, LogIn, Globe, Plus, Check, X, Edit2, KeyRound, Crown, BadgeCheck, ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { Input } from "@/components/ui/input";
import { isDesktop } from "@/lib/env";
import * as offline from "@/services/offlineStore";
import { staffManagementApi, Staff } from "@/services/staffManagementApi";
import { cashierApi, CashierWithPermissions } from "@/services/cashierApi";

type Role = "admin" | "cashier" | "cashier2";

const Welcome = () => {
  const navigate = useNavigate();
  const { tenant } = useMultiTenant();
  const [cashierName, setCashierName] = useState('CASHIER');
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [staffCashiers, setStaffCashiers] = useState<Staff[]>([]);
  const [secureCashiers, setSecureCashiers] = useState<CashierWithPermissions[]>([]);

  useEffect(() => {
    if (tenant?.id) {
      const saved = localStorage.getItem(`cashier_name_${tenant.id}`);
      if (saved) {
        setCashierName(saved);
      } else {
        setCashierName('Ali Hyder');
      }
    }

    const fetchCashiers = async () => {
      try {
        const staff = await staffManagementApi.staff.getAll(tenant?.id);
        const cashiers = staff.filter(
          (s) => s.is_active && (s.role === 'cashier' || s.role === 'manager')
        );
        setStaffCashiers(cashiers);
      } catch (err) {
        console.warn('Could not load cashiers for Welcome page:', err);
      }

      try {
        const secured = await cashierApi.account.getAll(tenant?.id);
        setSecureCashiers(secured.filter(c => c.is_active));
      } catch (err) {
        console.warn('Could not load secure cashiers:', err);
      }
    };
    fetchCashiers();
  }, [tenant]);

  const handleRoleSelect = (role: Role, customStaffName?: string) => {
    if (isEditing) return;

    const selectedName = customStaffName || cashierName;
    if (role === 'cashier') {
      localStorage.setItem('active_staff_name', selectedName);
    }

    navigate("/login", { state: { role } });
  };

  const handleSecureCashierLogin = (cashier: CashierWithPermissions) => {
    localStorage.setItem('pending_cashier_id', cashier.id);
    navigate("/login", { state: { role: 'cashier2', cashierName: cashier.name } });
  };

  const handleSaveName = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!newName.trim()) {
      setIsEditing(false);
      return;
    }
    if (tenant?.id) {
      localStorage.setItem(`cashier_name_${tenant.id}`, newName.trim());
      setCashierName(newName.trim());
      toast.success("Cashier name updated");
    }
    setIsEditing(false);
    setNewName('');
  };

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNewName(cashierName);
    setIsEditing(true);
  };

  const handleWorkOffline = () => {
    const dummySession = {
      user: {
        id: 'offline-user',
        email: 'offline@bakewise.pos',
      },
      expires_at: 9999999999,
    };

    offline.cacheSession(dummySession);
    offline.cacheProfile({
      id: 'offline-user',
      full_name: cashierName || 'Offline Cashier',
      role: 'cashier',
      tenant_id: tenant?.id || 'offline-tenant'
    });

    toast.success("Starting in Offline Mode");
    navigate("/");
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 font-sans overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/restaurant-hero.jpg?v=1'), url('/restaurant-luxury.png?v=2')" }}
      />
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 mb-8 text-center space-y-2 text-white"
      >
        <div className="mx-auto inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/85 mb-4 shadow-lg ring-2 ring-white/30 overflow-hidden backdrop-blur">
          <img
            src="/gx.png"
            alt="Logo"
            className="object-contain w-16 h-16"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/logo.jpeg';
            }}
          />
        </div>
        <h1 className="text-5xl font-black tracking-tighter font-heading uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">GENX CLOUD</h1>
        <p className="text-white/80 text-lg font-medium">{tenant?.restaurant_name || 'Modern Point of Sale System'}</p>
      </motion.div>

      <div className="relative z-10 w-full max-w-5xl space-y-8 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative group">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="cursor-pointer relative overflow-hidden rounded-xl border-2 border-slate-200 bg-white transition-all duration-200 hover:border-primary/50 hover:shadow-md h-full w-full"
              onClick={() => handleRoleSelect("admin")}
            >
              <div className="absolute top-3 right-3 z-20">
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-2 py-1 rounded-full border border-amber-200">
                  <Crown className="h-3 w-3" /> Admin Only
                </span>
              </div>
              <div className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="p-4 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Shield className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-black text-xl text-slate-900 font-heading uppercase tracking-tight">Administrator</h3>
                  <p className="text-sm text-slate-500 mt-1 font-medium">Sign in with email / Google account</p>
                  <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                    <Lock className="h-3 w-3" /> Full System Access
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="relative group">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="cursor-pointer relative overflow-hidden rounded-xl border-2 border-slate-200 bg-white transition-all duration-200 hover:border-primary/50 hover:shadow-md h-full w-full"
              onClick={() => navigate("/login", { state: { role: 'cashier2', cashierLoginMode: true } })}
            >
              <div className="absolute top-3 right-3 z-20">
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full border border-emerald-200">
                  <BadgeCheck className="h-3 w-3" /> PIN Protected
                </span>
              </div>
              <div className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="p-4 rounded-full bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Users className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-black text-xl text-slate-900 font-heading uppercase tracking-tight">Cashier Login</h3>
                  <p className="text-sm text-slate-500 mt-1 font-medium">Enter name + 4-digit PIN</p>
                  <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                    <KeyRound className="h-3 w-3" /> Secure Permissions
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {secureCashiers.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-white/20">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/90 text-center">
              Quick Cashier Sign-in ({secureCashiers.length})
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {secureCashiers.map((cashier) => (
                <motion.div
                  key={cashier.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleSecureCashierLogin(cashier)}
                  className="cursor-pointer bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/40 hover:border-primary flex flex-col items-center text-center transition-all group relative overflow-hidden"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-lg mb-2 group-hover:bg-primary group-hover:text-white transition-colors">
                    {cashier.name.charAt(0).toUpperCase()}
                  </div>

                  <h4 className="font-extrabold text-sm text-slate-900 truncate w-full group-hover:text-primary">
                    {cashier.name}
                  </h4>

                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                    Cashier
                  </span>

                  <div className="mt-2 flex flex-wrap justify-center gap-1">
                    {cashier.full_access ? (
                      <div className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <Crown className="h-3 w-3" /> Full Access
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <KeyRound className="h-3 w-3" /> Limited Access
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {staffCashiers.length > 0 && secureCashiers.length === 0 && (
          <div className="space-y-4 pt-4 border-t border-white/20">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/90 text-center">
              Cashier Profiles ({staffCashiers.length})
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {staffCashiers.map((cashier) => (
                <motion.div
                  key={cashier.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleRoleSelect("cashier", cashier.name)}
                  className="cursor-pointer bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/40 hover:border-primary flex flex-col items-center text-center transition-all group relative overflow-hidden"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-lg mb-2 group-hover:bg-primary group-hover:text-white transition-colors">
                    {cashier.name.charAt(0).toUpperCase()}
                  </div>

                  <h4 className="font-extrabold text-sm text-slate-900 truncate w-full group-hover:text-primary">
                    {cashier.name}
                  </h4>

                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                    {cashier.role}
                  </span>

                  {cashier.pin && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      <KeyRound className="h-3 w-3" /> PIN Required
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <div className="relative group max-w-md mx-auto">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="cursor-pointer relative overflow-hidden rounded-xl border-2 border-dashed border-white/40 bg-white/10 backdrop-blur transition-all duration-200 hover:border-white/60 hover:shadow-md w-full"
            onClick={() => handleRoleSelect("cashier", cashierName)}
          >
            <div className="p-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-white/90 text-slate-700 flex items-center justify-center font-black shrink-0 shadow-sm">
                  <User className="w-5 h-5" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-0.5">Quick Workstation</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <h4 className="font-black text-base text-white truncate">{cashierName}</h4>
                    {isEditing ? null : (
                      <button
                        onClick={startEditing}
                        className="text-white/60 hover:text-white opacity-80 hover:opacity-100 transition-opacity shrink-0"
                        title="Change Cashier Name"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-white/70 shrink-0" />
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {isEditing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-2 bg-white rounded-xl shadow-2xl border p-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Cashier Name..."
                    className="h-9 text-sm"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName(e as any)}
                  />
                  <Button size="sm" variant="default" className="h-9" onClick={handleSaveName}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-9 text-red-600" onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isDesktop() && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center mt-4"
          >
            <Button
              variant="outline"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 rounded-full px-8 py-6 font-bold uppercase tracking-widest text-xs"
              onClick={handleWorkOffline}
            >
              <Globe className="mr-2 h-4 w-4" />
              Work Completely Offline
            </Button>
          </motion.div>
        )}
      </div>

      <div className="absolute bottom-6 right-6 z-10 text-white/80 text-sm">
        © 2026 GENX CLOUD. All rights reserved.
      </div>
    </div>
  );
};

export default Welcome;
