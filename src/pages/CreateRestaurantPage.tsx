
import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Building2, Loader2, Rocket, Store } from "lucide-react";
import { toast } from "sonner";
import { useMultiTenant } from "@/hooks/useMultiTenant";

const CreateRestaurantPage = () => {
  const navigate = useNavigate();
  const { session, profile, isLoading } = useMultiTenant();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);

  console.log("CreateRestaurantPage Rendering", { isLoading, profileId: profile?.id, hasTenantId: !!profile?.tenant_id });

  // If user already has a tenant, redirect them
  if (profile?.tenant_id || profile?.restaurant_id) {
    console.log("CreateRestaurantPage: User already has a restaurant, redirecting");
    return <Navigate to="/" replace />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      if (!session?.user?.id) {
        toast.error("You must be logged in to create a restaurant.");
        setLoading(false);
        return;
      }

      console.log("Creating tenant for user:", session.user.id);

      // 1. Create the tenant
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert([{
          restaurant_name: name,
          owner_id: session.user.id,
          plan_type: 'free',
          billing_status: 'active'
        }])
        .select()
        .single();

      if (tenantError) {
        console.error("Tenant Creation Error Details:", tenantError);
        throw tenantError;
      }

      console.log("Tenant created successfully:", tenant.id);

      // 2. Also create in legacy restaurants table if it exists (for backward compatibility)
      try {
        await supabase
          .from('restaurants')
          .insert([{
            id: tenant.id,
            name,
            slug: slug.toLowerCase().replace(/\s+/g, '-'),
            owner_id: session.user.id,
            subscription_status: 'trial',
            license_expiry: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
          }]);
      } catch (err) {
        console.warn("Legacy restaurant creation failed (table might not exist yet)", err);
      }

      // 3. Update the user's profile to link to this tenant
      console.log("Updating profile with tenant_id:", tenant.id);
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ 
          id: session.user.id,
          tenant_id: tenant.id, 
          restaurant_id: tenant.id, // Keep both for safety
          role: 'admin',
          full_name: session.user.user_metadata?.full_name || name,
          email: session.user.email
        });

      if (profileError) {
        console.error("Profile Update Error Details:", profileError);
        throw profileError;
      }

      toast.success("Restaurant created successfully! Welcome aboard.");
      
      // Small delay to ensure DB propagation before redirect
      setTimeout(() => {
        navigate("/");
      }, 500);
    } catch (error: any) {
      console.error("Creation process failed:", error);
      toast.error(error.message || "Failed to create restaurant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-none shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-slate-900 text-white p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mb-4 rotate-3 shadow-lg shadow-blue-500/20">
            <Store className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-black font-heading uppercase tracking-tight">Set Up Your Store</CardTitle>
          <CardDescription className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">
            Give your restaurant a name to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-black font-heading uppercase tracking-widest text-slate-500">Restaurant Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="e.g., Sultan Libas POS"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 h-12 rounded-xl border-slate-200 focus:border-blue-500 transition-all font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black font-heading uppercase tracking-widest text-slate-500">Store ID (URL Slug)</Label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</div>
                <Input
                  placeholder="sultan-libas"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="pl-10 h-12 rounded-xl border-slate-200 focus:border-blue-500 transition-all font-bold"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">This will be your unique store identifier.</p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black font-heading uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <>
                  <Rocket className="h-5 w-5" />
                  Launch My Store
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateRestaurantPage;
