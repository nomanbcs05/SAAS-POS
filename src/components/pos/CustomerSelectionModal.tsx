import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCartStore } from '@/stores/cartStore';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, User, Phone } from 'lucide-react';

interface CustomerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const CustomerSelectionModal = ({ isOpen, onClose, onSaved }: CustomerSelectionModalProps) => {
  const { setCustomer, setCustomerAddress, orderType, customerAddress } = useCartStore();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhone('');
      setName('');
      setAddress(customerAddress || '');
    }
  }, [isOpen, customerAddress]);

  const handlePhoneSearch = async () => {
    if (!phone.trim()) return;
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', phone)
        .single();

      if (data) {
        setName(data.name);
        toast.success("Customer found!");
      } else if (error && error.code !== 'PGRST116') {
        // PGRST116 is "Row not found" which is fine
        console.error(error);
      }
    } catch (error) {
      console.error("Error searching customer:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !phone.trim()) {
      toast.error("Please enter both Name and Phone Number");
      return;
    }

    if (orderType === 'delivery' && !address.trim()) {
      toast.error("Please enter delivery address");
      return;
    }

    setIsLoading(true);

    try {
      // Check if customer exists first
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', phone)
        .single();

      let customerData;

      if (existingCustomer) {
        // Update name if changed
        if (existingCustomer.name !== name) {
          const idToUpdate = (existingCustomer as any).customer_id || existingCustomer.id;
          const { data, error } = await (supabase
            .from('customers') as any)
            .update({ name })
            .eq('customer_id', idToUpdate)
            .select()
            .single();
            
          if (error) throw error;
          customerData = data;
        } else {
          customerData = existingCustomer;
        }
      } else {
        // Create new customer
        const { data, error } = await supabase
          .from('customers')
          .insert({
            name,
            phone,
            loyalty_points: 0,
            total_spent: 0,
            total_orders: 1
          } as any)
          .select()
          .single();

        if (error) throw error;
        customerData = data;
      }

      // Map to Store Customer type (camelCase)
      const storeCustomer = {
        id: customerData.id || (customerData as any).customer_id?.toString(),
        name: customerData.name,
        phone: customerData.phone || '',
        email: customerData.email || '',
        loyaltyPoints: customerData.loyalty_points || 0,
        totalSpent: customerData.total_spent || 0,
        visitCount: (customerData as any).total_orders || (customerData as any).visit_count || 0
      };

      setCustomer(storeCustomer);
      if (orderType === 'delivery') {
        setCustomerAddress(address);
      }
      toast.success(`Customer ${name} attached to order`);
      if (onSaved) {
        onSaved();
      }
      onClose();
      
    } catch (error: any) {
      console.error("Error saving customer:", error);
      toast.error(error.message || "Failed to save customer");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideCloseButton className="max-w-md p-0 overflow-hidden bg-white border-none rounded-3xl shadow-2xl">
        <DialogHeader className="relative bg-slate-900 px-6 py-6 text-white">
          <DialogClose asChild>
            <button
              aria-label="Close"
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <span className="sr-only">Close</span>
              {/* X icon via CSS to avoid extra import, using two lines */}
              <span className="relative block h-4 w-4">
                <span className="absolute left-1/2 top-1/2 h-[2px] w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white"></span>
                <span className="absolute left-1/2 top-1/2 h-[2px] w-4 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-white"></span>
              </span>
            </button>
          </DialogClose>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <User className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black font-heading uppercase tracking-tight">Customer Details</DialogTitle>
              <DialogDescription className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                Enter name & phone for loyalty tracking
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black font-heading uppercase tracking-widest text-slate-500">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={handlePhoneSearch}
                  placeholder="Enter phone number"
                  className="pl-10 h-11 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all font-bold"
                  type="tel"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black font-heading uppercase tracking-widest text-slate-500">Customer Name</Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter customer name"
                  className="pl-10 h-11 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all font-bold"
                />
              </div>
            </div>

            {orderType === 'delivery' && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black font-heading uppercase tracking-widest text-slate-500">Delivery Address</Label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter complete customer address..."
                  className="w-full min-h-[80px] p-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all font-medium text-sm resize-none"
                />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="flex-1 h-11 rounded-xl text-[11px] font-black font-heading uppercase tracking-widest border-slate-200 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-[2] h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black font-heading uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Customer'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerSelectionModal;
