import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { creditApi } from '@/services/creditApi';
import { Sidebar } from '@/components/Sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Receipt as ReceiptIcon, Wallet, ArrowDownToLine, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useReactToPrint } from 'react-to-print';
import { format } from 'date-fns';
import { businessInfo } from '@/data/mockData';
import { useMultiTenant } from '@/hooks/useMultiTenant';

export default function CreditPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  const queryClient = useQueryClient();
  const receiptRef = useRef<HTMLDivElement>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['credit-customers'],
    queryFn: creditApi.getCustomersWithCredit,
  });

  const handlePrint = useReactToPrint({
    content: () => receiptRef.current,
    onAfterPrint: () => setReceiptData(null),
  });

  const paymentMutation = useMutation({
    mutationFn: async ({ customerId, amount }: { customerId: string, amount: number }) => {
      return creditApi.receivePayment(customerId, amount);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['credit-customers'] });
      toast.success('Payment received successfully');
      
      // Prepare receipt data
      setReceiptData({
        customerName: selectedCustomer.name,
        phone: selectedCustomer.phone,
        amountReceived: variables.amount,
        previousBalance: data.previousBalance,
        newBalance: data.newBalance,
        date: new Date()
      });

      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setSelectedCustomer(null);
      
      // Print immediately after state settles
      setTimeout(() => {
        handlePrint();
      }, 100);
    },
    onError: (error: any) => {
      toast.error('Failed to process payment: ' + error.message);
    }
  });

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone?.includes(searchQuery)
  );

  const openPaymentModal = (customer: any) => {
    setSelectedCustomer(customer);
    setPaymentAmount(customer.credit_balance.toString());
    setIsPaymentModalOpen(true);
  };

  const handleProcessPayment = () => {
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (amount > selectedCustomer.credit_balance) {
      toast.error('Payment amount cannot be greater than the outstanding balance');
      return;
    }

    paymentMutation.mutate({
      customerId: selectedCustomer.id,
      amount
    });
  };

  return (
    <MainLayout>
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <Wallet className="h-6 w-6 text-primary" />
              Credit Ledger
            </h1>
            <p className="text-sm text-muted-foreground font-medium">Manage and receive customer credit payments</p>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Credit Accounts</CardTitle>
                  <CardDescription>Customers with outstanding balances</CardDescription>
                </div>
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by name or phone..." 
                    className="pl-9 bg-slate-50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-slate-50">
                  <ReceiptIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-slate-700">No Credit Accounts Found</h3>
                  <p className="text-sm text-slate-500">All customer accounts are currently clear.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Customer Name</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3 text-right">Outstanding Balance</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredCustomers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-semibold">{customer.name}</td>
                          <td className="px-4 py-3 text-slate-600">{customer.phone || '-'}</td>
                          <td className="px-4 py-3 text-right font-black text-red-600 text-base">
                            Rs {Number(customer.credit_balance).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button 
                              size="sm" 
                              className="font-bold tracking-wider uppercase text-[10px] btn-success"
                              onClick={() => openPaymentModal(customer)}
                            >
                              <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5" />
                              Receive Pay
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase">Receive Payment</DialogTitle>
            <DialogDescription>
              Processing payment for <span className="font-bold text-slate-900">{selectedCustomer?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100">
              <span className="font-bold text-red-800">Total Due:</span>
              <span className="text-xl font-black text-red-600">Rs {Number(selectedCustomer?.credit_balance || 0).toLocaleString()}</span>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold">Amount Receiving (Rs)</label>
              <Input 
                type="number" 
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="h-12 text-lg font-bold"
                autoFocus
              />
            </div>
            <Button 
              className="w-full h-12 text-lg font-black uppercase tracking-widest btn-success"
              onClick={handleProcessPayment}
              disabled={paymentMutation.isPending}
            >
              {paymentMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirm & Print'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden print receipt */}
      <div className="hidden">
        {receiptData && <PaymentReceipt ref={receiptRef} data={receiptData} />}
      </div>
    </MainLayout>
  );
}

// Internal component for printing
const PaymentReceipt = React.forwardRef<HTMLDivElement, { data: any }>(({ data }, ref) => {
  const { tenant } = useMultiTenant();
  const name = tenant?.restaurant_name || businessInfo.name;
  
  return (
    <div ref={ref} className="receipt-print bg-white text-black p-2 font-mono text-[11px] leading-tight mx-auto" style={{ width: '80mm' }}>
      <div className="text-center mb-2">
        <h1 className="text-lg font-bold uppercase border-b-2 border-black pb-1 mb-1">{name}</h1>
        <h2 className="text-base font-black uppercase tracking-widest">Payment Receipt</h2>
      </div>
      
      <div className="border border-black p-1 text-[11px] mb-2">
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{format(data.date, 'dd-MMM-yy hh:mm a')}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Customer:</span>
          <span className="font-bold uppercase">{data.customerName}</span>
        </div>
        {data.phone && (
          <div className="flex justify-between">
            <span>Phone:</span>
            <span>{data.phone}</span>
          </div>
        )}
      </div>

      <div className="border-x border-t border-black p-1 text-[11px]">
        <div className="flex justify-between">
          <span>Previous Due:</span>
          <span>Rs {Number(data.previousBalance).toLocaleString()}</span>
        </div>
      </div>
      <div className="border border-black p-1 bg-gray-100">
        <div className="flex justify-between font-black text-sm">
          <span>Amount Paid:</span>
          <span>Rs {Number(data.amountReceived).toLocaleString()}</span>
        </div>
      </div>
      <div className="border-x border-b border-black p-1 text-[11px]">
        <div className="flex justify-between">
          <span>Remaining Balance:</span>
          <span className="font-bold">Rs {Number(data.newBalance).toLocaleString()}</span>
        </div>
      </div>

      <div className="text-center mt-4">
        <p className="text-[10px] font-bold uppercase">Thank you for your payment!</p>
        <p className="text-[9px] mt-1 border-t border-dotted border-black pt-1">POWERED BY GENX CLOUD</p>
      </div>
    </div>
  );
});
PaymentReceipt.displayName = 'PaymentReceipt';
