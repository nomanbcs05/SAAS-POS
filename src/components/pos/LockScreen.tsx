
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock, ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const LockScreen = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const checkLockState = () => {
    const locked = localStorage.getItem('pos_is_locked') === 'true';
    setIsLocked(locked);
  };

  useEffect(() => {
    checkLockState();
    window.addEventListener('pos-lock-state-change', checkLockState);
    return () => window.removeEventListener('pos-lock-state-change', checkLockState);
  }, []);

  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const savedPassword = localStorage.getItem('pos_lock_password') || "1234"; // Default 1234 if not set
    
    if (password === savedPassword) {
      localStorage.setItem('pos_is_locked', 'false');
      setIsLocked(false);
      setPassword("");
      setError(false);
      toast.success("Terminal Unlocked");
    } else {
      setError(true);
      setTimeout(() => setError(false), 500);
      toast.error("Incorrect Password");
    }
  };

  if (!isLocked) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ 
            scale: 1, 
            opacity: 1,
            x: error ? [0, -10, 10, -10, 10, 0] : 0
          }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl text-center space-y-8"
        >
          <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lock className="w-10 h-10 text-primary" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-black font-heading uppercase tracking-tight text-slate-900">Terminal Locked</h1>
            <p className="text-slate-500 font-medium">Enter your PIN/Password to continue</p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-6">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Enter PIN"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="text-center text-2xl h-16 rounded-2xl bg-slate-50 border-slate-200 focus:ring-primary focus:border-primary font-black tracking-[0.5em]"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black font-heading uppercase tracking-widest text-sm shadow-xl"
            >
              Unlock Terminal
              <Unlock className="ml-2 w-5 h-5" />
            </Button>
          </form>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
              © 2026 GENX CLOUD POS
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
