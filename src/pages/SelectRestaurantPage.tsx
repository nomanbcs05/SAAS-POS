
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2, Plus, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useMultiTenant } from "@/hooks/useMultiTenant";

const SelectRestaurantPage = () => {
  const navigate = useNavigate();
  const { session, ownedTenants, isLoading } = useMultiTenant();

  const handleSelect = async (tenantId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: session?.user?.id,
          tenant_id: tenantId,
          restaurant_id: tenantId,
          role: 'admin', // Owner is admin
          full_name: session?.user?.user_metadata?.full_name,
          email: session?.user?.email
        });

      if (error) throw error;
      toast.success("Restaurant selected!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to select restaurant");
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black font-heading uppercase tracking-tight text-slate-900">Your Restaurants</h1>
          <p className="text-slate-500 font-medium text-lg">Select a restaurant to manage or create a new one</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ownedTenants.map((tenant) => (
            <Card key={tenant.id} className="border-none shadow-lg hover:shadow-xl transition-all group overflow-hidden rounded-2xl">
              <CardHeader className="bg-white border-b border-slate-100">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl font-bold truncate">{tenant.restaurant_name}</CardTitle>
                <CardDescription className="truncate">{tenant.city || 'No city set'}</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <Button 
                  onClick={() => handleSelect(tenant.id)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 rounded-xl flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Manage Store
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* Create New Card */}
          <Card 
            className="border-2 border-dashed border-slate-200 shadow-none hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer rounded-2xl flex flex-col items-center justify-center p-8 text-center"
            onClick={() => navigate("/create-restaurant")}
          >
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Add New Restaurant</h3>
            <p className="text-sm text-slate-500 mt-1">Set up another branch or business</p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SelectRestaurantPage;
