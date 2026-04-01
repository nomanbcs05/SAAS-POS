import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { User, Shield, Users, LogIn, Globe, Plus, Check, X, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { Input } from "@/components/ui/input";

type Role = "admin" | "cashier" | "cashier2";

const Welcome = () => {
  const navigate = useNavigate();
  const { tenant } = useMultiTenant();
  const [cashierName, setCashierName] = useState('CASHIER');
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (tenant?.id) {
      const saved = localStorage.getItem(`cashier_name_${tenant.id}`);
      if (saved) {
        setCashierName(saved);
      } else {
        setCashierName('Ali Hyder'); // Default
      }
    }
  }, [tenant]);

  const handleRoleSelect = (role: Role) => {
    if (isEditing) return; // Don't navigate while editing
    
    // If it's cashier, we might want to store the custom name for the session
    if (role === 'cashier') {
      localStorage.setItem('active_staff_name', cashierName);
    }
    
    navigate("/login", { state: { role } });
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

      <div className="relative z-10 w-full max-w-4xl space-y-8 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Admin Card */}
          <RoleCard
            title="Administrator"
            icon={Shield}
            description="Manage your restaurant"
            onSelect={() => handleRoleSelect("admin")}
          />

          {/* Cashier Card */}
          <div className="relative group">
            <RoleCard
              title={cashierName}
              icon={User}
              description="Start serving customers"
              onSelect={() => handleRoleSelect("cashier")}
            />
            
            <div className="absolute top-4 right-4 z-20">
              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-1 bg-white rounded-lg shadow-xl border p-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Input 
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Name..."
                      className="h-8 w-32 text-xs"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveName(e as any)}
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleSaveName}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ) : (
                  <Button 
                    size="icon" 
                    variant="secondary" 
                    className="h-8 w-8 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    onClick={startEditing}
                    title="Change Cashier Name"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-10 text-white/80 text-sm">
        © 2026 GENX CLOUD. All rights reserved.
      </div>
    </div>
  );
};

interface RoleCardProps {
  title: string;
  icon: any;
  description: string;
  onSelect: () => void;
}

const RoleCard = ({ title, icon: Icon, description, onSelect }: RoleCardProps) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="cursor-pointer relative overflow-hidden rounded-xl border-2 border-slate-200 bg-white transition-all duration-200 hover:border-primary/50 hover:shadow-md h-full w-full"
      onClick={onSelect}
    >
      <div className="p-6 flex flex-col items-center text-center space-y-4">
        <div className="p-4 rounded-full bg-slate-100 text-slate-600 group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="w-8 h-8" />
        </div>
        <div>
          <h3 className="font-black text-xl text-slate-900 font-heading uppercase tracking-tight truncate max-w-[250px]">{title}</h3>
          <p className="text-sm text-slate-500 mt-1 font-medium">{description}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default Welcome;
