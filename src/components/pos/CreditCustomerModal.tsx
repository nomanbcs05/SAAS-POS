import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, User, FileText, Printer } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Customer } from '@/stores/cartStore';
import Fuse from 'fuse.js';

interface CreditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  onPrintBill: () => void;
  onCompleteSale: () => void;
}

export const CreditCustomerModal = ({
  isOpen,
  onClose,
  customers,
  selectedCustomer,
  onSelectCustomer,
  onPrintBill,
  onCompleteSale
}: CreditCustomerModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const fuse = useMemo(() => new Fuse(customers, {
    keys: ['name', 'phone'],
    threshold: 0.3,
  }), [customers]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers.slice(0, 10);
    return fuse.search(searchQuery).slice(0, 10).map(r => r.item);
  }, [searchQuery, fuse, customers]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase text-center">Credit Payment</DialogTitle>
          <DialogDescription className="text-center font-bold">
            Select a customer for this credit transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              className="pl-10 h-12 text-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          <ScrollArea className="h-48 border rounded-md p-2">
            <div className="space-y-1">
              {filteredCustomers.map(customer => (
                <div
                  key={customer.id}
                  onClick={() => onSelectCustomer(customer)}
                  className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors ${selectedCustomer?.id === customer.id ? 'bg-blue-100 border-blue-500 border-2' : 'hover:bg-muted border-2 border-transparent'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-bold">{customer.name}</div>
                      <div className="text-sm text-muted-foreground">{customer.phone}</div>
                    </div>
                  </div>
                  {(customer.creditBalance || 0) > 0 && (
                    <div className="text-red-500 font-bold text-sm">
                      Due: Rs {(customer.creditBalance || 0).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
              {filteredCustomers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No customers found. (Add new from Customers screen)
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              className="h-14 font-black text-lg border-2"
              onClick={() => {
                onClose();
                onPrintBill();
              }}
              disabled={!selectedCustomer}
            >
              <FileText className="mr-2 h-6 w-6" /> Bill
            </Button>
            <Button
              className="h-14 font-black text-lg btn-success shadow-lg shadow-emerald-500/20"
              onClick={() => {
                onClose();
                onCompleteSale();
              }}
              disabled={!selectedCustomer}
            >
              <Printer className="mr-2 h-6 w-6" /> Complete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
