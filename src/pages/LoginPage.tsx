import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, ArrowRight, User, Shield, Users, KeyRound, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isDesktop } from '@/lib/env';
import * as offline from '@/services/offlineStore';
import { cashierApi } from '@/services/cashierApi';

type Role = "admin" | "cashier" | "cashier2";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const role = (location.state?.role as Role) || "cashier";
  const cashierLoginMode = role === 'cashier2' || !!location.state?.cashierLoginMode;
  const prefillCashierName = location.state?.cashierName || '';
  const pendingCashierId = localStorage.getItem('pending_cashier_id');

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState("");
  const [savedUsers, setSavedUsers] = useState<Record<string, string>>({});
  const [staffDisplayName, setStaffDisplayName] = useState("");

  const [cashierName, setCashierName] = useState(prefillCashierName || "");
  const [pin, setPin] = useState("");

  useEffect(() => {
    localStorage.removeItem('pending_cashier_id');
  }, []);

  useEffect(() => {
    const savedStaff = localStorage.getItem('pos_staff_names');
    if (savedStaff) {
      const parsed = JSON.parse(savedStaff);
      const staff = parsed.find((s: any) => s.id === role);
      if (staff) {
        setStaffDisplayName(staff.name);
      } else {
        setStaffDisplayName(role === 'admin' ? 'Admin' : (role === 'cashier' ? 'CASHIER' : 'Cashier 2'));
      }
    } else {
      setStaffDisplayName(role === 'admin' ? 'Admin' : (role === 'cashier' ? 'CASHIER' : 'Cashier 2'));
    }

    localStorage.setItem('active_role', role);

    const saved = localStorage.getItem("pos_saved_users");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedUsers(parsed);
        if (parsed[role]) {
          setEmail(parsed[role]);
        }
      } catch (e) {
        console.error("Failed to parse saved users", e);
      }
    }
  }, [role]);

  const resolveTenantId = async (): Promise<string> => {
    const cached = offline.getCachedTenant();
    if (cached) return (cached as any).id;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
      if (profile?.tenant_id) return profile.tenant_id;
    }
    throw new Error('Restaurant not initialized. Please login as Admin first.');
  };

  const handleCashierLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierName.trim()) {
      toast.error('Please enter cashier name');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      toast.error('PIN must be exactly 4 numeric digits');
      return;
    }

    setLoading(true);
    try {
      let tenantId: string;
      try {
        tenantId = await resolveTenantId();
      } catch (err: any) {
        const cached = localStorage.getItem('pos_offline_tenant');
        if (cached) {
          tenantId = (JSON.parse(cached) as any).id;
        } else {
          throw new Error('Please start the restaurant once with an Admin account before cashier login.');
        }
      }

      const { cashier, permissions, token } = await cashierApi.auth.login(tenantId, cashierName.trim(), pin);

      const existingTenant = offline.getCachedTenant();
      if (!existingTenant) {
        toast.error('Restaurant configuration missing. Please login as Admin first.');
        setLoading(false);
        return;
      }

      cashierApi.auth.setSession(cashier, permissions, token);
      localStorage.setItem('active_staff_name', cashier.name);
      toast.success(`Welcome ${cashier.name}!`);
      navigate('/');
    } catch (err: any) {
      console.error('Cashier login failed:', err);
      toast.error(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isDesktop()) {
        const usersRaw = localStorage.getItem('pos_local_users');
        let users: Array<{email: string; password: string; full_name: string; role: string}> = usersRaw ? JSON.parse(usersRaw) : [];

        if (users.length === 0) {
          users = [{ email: 'admin@pos.com', password: 'admin123', full_name: 'Administrator', role: 'admin' }];
          localStorage.setItem('pos_local_users', JSON.stringify(users));
        }

        if (isRegistering) {
          if (!fullName.trim()) {
            toast.error('Please enter your full name');
            setLoading(false);
            return;
          }
          if (users.some(u => u.email === email)) {
            toast.error('An account with this email already exists');
            setLoading(false);
            return;
          }
          users.push({ email, password, full_name: fullName, role: 'cashier' });
          localStorage.setItem('pos_local_users', JSON.stringify(users));
          toast.success('Account created! Please log in.');
          setIsRegistering(false);
          setLoading(false);
          return;
        }

        const user = users.find(u => u.email === email && u.password === password);
        if (!user) {
          toast.error('Invalid email or password. Please try again.');
          setLoading(false);
          return;
        }

        const fakeUserId = 'local-' + btoa(email).replace(/[^a-zA-Z0-9]/g, '');
        const fakeSession = { user: { id: fakeUserId, email }, expires_at: 9999999999 };
        const fakeProfile = { id: fakeUserId, full_name: user.full_name, role: user.role as any, email, tenant_id: 'offline-tenant' };

        offline.cacheSession(fakeSession);
        offline.cacheProfile(fakeProfile);

        const existingTenant = offline.getCachedTenant();
        if (!existingTenant) {
          offline.cacheTenant({
            id: 'offline-tenant',
            restaurant_name: 'My Restaurant',
            plan_type: 'offline',
            billing_status: 'active',
            default_cashier_name: user.full_name
          });
        }

        const newSavedUsers = { ...savedUsers, [role]: email };
        localStorage.setItem('pos_saved_users', JSON.stringify(newSavedUsers));
        localStorage.setItem('active_staff_name', staffDisplayName);

        toast.success(`Welcome, ${user.full_name}!`);
        navigate('/');
        setLoading(false);
        return;
      }

      if (isRegistering) {
        if (!fullName.trim()) {
          toast.error("Please enter your full name");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: 'admin'
            }
          }
        });

        if (error) throw error;

        if (data.user) {
          toast.success("Account created! Please log in.");
          setIsRegistering(false);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error("Login error:", error);
          if (error.message.includes("Invalid login credentials")) {
            toast.error("Invalid email or password. Please try again.");
          } else {
            toast.error(error.message || "An unexpected error occurred. Please try again later.");
          }
          throw error;
        }

        const newSavedUsers = { ...savedUsers, [role]: email };
        localStorage.setItem("pos_saved_users", JSON.stringify(newSavedUsers));
        localStorage.setItem("active_staff_name", staffDisplayName);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profile?.role === 'admin' || profile?.role === 'super-admin') {
            toast.success(`Welcome back, ${profile.full_name || 'Admin'}!`);
            navigate("/");
          } else if (profile) {
            toast.success(`Welcome back, ${profile.full_name || staffDisplayName}!`);
            navigate("/");
          } else {
            navigate("/");
          }
        } else {
          navigate("/");
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      if (isRegistering) toast.error(error.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Failed to login with Google");
    }
  };

  const getRoleIcon = () => {
    if (cashierLoginMode) return BadgeCheck;
    switch (role) {
      case "admin": return Shield;
      case "cashier": return User;
      case "cashier2": return Users;
      default: return User;
    }
  };

  const RoleIcon = getRoleIcon();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 font-sans overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/restaurant-hero.jpg?v=1'), url('/restaurant-luxury.png?v=2')" }}
      />
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 w-full max-w-md"
      >
        <Button
          variant="ghost"
          className="mb-6 hover:bg-transparent hover:text-primary pl-0 font-bold font-heading uppercase tracking-wider text-xs"
          onClick={() => navigate("/auth")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Roles
        </Button>

        <Card className="border-none shadow-xl bg-white/85 backdrop-blur-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2.5 rounded-lg ${cashierLoginMode ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary'}`}>
                <RoleIcon className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black font-heading uppercase tracking-tight">
                  {cashierLoginMode ? 'Cashier Login' : (isRegistering ? "Create Account" : `Login as ${staffDisplayName}`)}
                </CardTitle>
                <CardDescription className="font-medium">
                  {cashierLoginMode
                    ? 'Enter your cashier name and 4-digit PIN'
                    : isRegistering ? "Register your restaurant management account" : "Enter your credentials"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {cashierLoginMode ? (
              <form onSubmit={handleCashierLogin} className="space-y-4" autoComplete="off">
                <div className="space-y-2">
                  <Label htmlFor="cashierName" className="font-bold font-heading uppercase tracking-wider text-[10px] text-slate-500 ml-1">Cashier Name</Label>
                  <Input
                    id="cashierName"
                    type="text"
                    placeholder="Enter your cashier name"
                    value={cashierName}
                    onChange={(e) => setCashierName(e.target.value)}
                    required
                    autoComplete="off"
                    className="bg-white/50 h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pin" className="font-bold font-heading uppercase tracking-wider text-[10px] text-slate-500 ml-1 flex items-center gap-1.5">
                    <KeyRound className="h-3 w-3" /> 4-Digit PIN
                  </Label>
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setPin(v);
                    }}
                    required
                    autoComplete="off"
                    className="bg-white/50 h-12 rounded-xl text-center tracking-[1em] text-xl"
                  />
                  <div className="flex justify-between px-1">
                    {[0,1,2,3].map(i => (
                      <div key={i} className={`w-8 h-1 rounded-full transition-colors ${pin.length > i ? 'bg-primary' : 'bg-slate-200'}`} />
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 rounded-xl font-black font-heading uppercase tracking-[0.15em] text-sm shadow-lg shadow-emerald-600/20" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Unlock POS Terminal
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                <p className="text-center text-[11px] text-slate-500 font-medium">
                  Secured with PIN • Permissions are managed by Admin
                </p>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
                {isRegistering && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="font-bold font-heading uppercase tracking-wider text-[10px] text-slate-500 ml-1">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="bg-white/50 h-12 rounded-xl"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-bold font-heading uppercase tracking-wider text-[10px] text-slate-500 ml-1">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white/50 h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="font-bold font-heading uppercase tracking-wider text-[10px] text-slate-500 ml-1">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-white/50 h-12 rounded-xl"
                  />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 h-12 rounded-xl font-black font-heading uppercase tracking-[0.15em] text-sm shadow-lg shadow-primary/20" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isRegistering ? "Creating account..." : "Signing in..."}
                    </>
                  ) : (
                    <>
                      {isRegistering ? "Create Account" : "Access Dashboard"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                {!isDesktop() && !isRegistering && (
                  <>
                    <div className="relative my-2">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-slate-200" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-white/85 backdrop-blur px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Or continue with</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-12 rounded-xl font-bold bg-white/70 hover:bg-white text-slate-800 border-slate-200"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Sign in with Google
                    </Button>
                  </>
                )}

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setIsRegistering(!isRegistering)}
                    className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
                  >
                    {isRegistering ? "← Back to Login" : "Need an account? Sign up"}
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default LoginPage;
