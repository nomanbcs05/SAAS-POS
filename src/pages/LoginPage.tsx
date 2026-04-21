import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, ArrowRight, User, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Role = "admin" | "cashier" | "cashier2";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const role = (location.state?.role as Role) || "cashier";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState("");
  const [savedUsers, setSavedUsers] = useState<Record<string, string>>({});
  const [staffDisplayName, setStaffDisplayName] = useState("");

  useEffect(() => {
    // Get display name from localStorage
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

    // Save current role to localStorage for other components to use
    localStorage.setItem('active_role', role);
    
    // Use saved users if available, otherwise leave empty for SaaS flexibility
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRegistering) {
        // Handle Registration
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
              role: 'admin' // First user is always admin
            }
          }
        });

        if (error) throw error;
        
        if (data.user) {
          toast.success("Account created! Please log in.");
          setIsRegistering(false);
        }
      } else {
        // Handle Login
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

        // Force a profile check to determine true role after login
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
            // New user with no profile yet
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
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <RoleIcon className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black font-heading uppercase tracking-tight">
                  {isRegistering ? "Create Account" : `Login as ${staffDisplayName}`}
                </CardTitle>
                <CardDescription className="font-medium">
                  {isRegistering ? "Register your restaurant management account" : "Enter your credentials"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default LoginPage;
