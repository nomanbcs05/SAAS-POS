import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { Loader2, X, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import DailySummary from './DailySummary';
import ProductSalesSummary from './ProductSalesSummary';
import { parseISO, startOfDay } from 'date-fns';

interface StartDayModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose?: () => void;
  forceNewSession?: boolean;
}

const StartDayModal = ({ isOpen, onSuccess, onClose, forceNewSession = false }: StartDayModalProps) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [productOrdersWithItems, setProductOrdersWithItems] = useState<any[]>([]);
  const queryClient = useQueryClient();

  const summaryRef = useRef<HTMLDivElement>(null);
  const productSummaryRef = useRef<HTMLDivElement>(null);

  const { data: allOrders = [] } = useQuery({ 
    queryKey: ['orders'], 
    queryFn: api.orders.getAll,
    enabled: showPrintOptions
  });

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      setDate(`${yyyy}-${mm}-${dd}`); // Local date (YYYY-MM-DD) to avoid UTC shift
    }
  }, [isOpen]);

  const handlePrintDaily = useReactToPrint({
    contentRef: summaryRef,
    documentTitle: `Daily-Summary-${date}`,
  });

  const handlePrintProduct = useReactToPrint({
    contentRef: productSummaryRef,
    documentTitle: `Product-Summary-${date}`,
  });

  const prepareProductSummary = async () => {
    if (!allOrders || allOrders.length === 0) {
      toast.info('No orders found for product summary');
      return;
    }

    const toastId = toast.loading('Preparing product summary...');
    try {
      const fullOrders = await Promise.all(
        allOrders.map(async (o: any) => {
          try {
            return await api.orders.getByIdWithItems(o.id);
          } catch {
            return null;
          }
        })
      );
      const valid = fullOrders.filter(Boolean) as any[];
      setProductOrdersWithItems(valid);
      toast.dismiss(toastId);
      setTimeout(() => handlePrintProduct(), 100);
    } catch (e) {
      toast.dismiss(toastId);
      toast.error('Failed to prepare product summary');
    }
  };

  const startDayMutation = useMutation({
    mutationFn: async ({ amount, date }: { amount: number; date: string }) => {
      // If forcing a new session, we might want to close any existing open register first
      if (forceNewSession) {
        const openReg = await api.registers.getOpen();
        if (openReg) {
          await api.registers.close(openReg.id, 0, 'Automatically closed for new session');
        }
        // Clear history as requested
        await api.orders.deleteAllOrders();
      }
      
      // Convert date string to ISO string for the database
      const openedAt = new Date(date);
      openedAt.setHours(new Date().getHours(), new Date().getMinutes(), new Date().getSeconds());
      
      return api.registers.start(amount, openedAt.toISOString());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['open-register'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('New session started');
      onSuccess();
    },
    onError: (error) => {
      toast.error(`Failed to start day: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startAmount = parseFloat(amount);
    if (isNaN(startAmount)) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    startDayMutation.mutate({ amount: startAmount, date });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && onClose) onClose();
    }}>
      <DialogContent 
        className="sm:max-w-md" 
        hideCloseButton={!onClose}
        onPointerDownOutside={(e) => { if (!onClose) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (!onClose) e.preventDefault(); }}
        aria-describedby="start-day-description"
      >
        <div className="flex justify-between items-center mb-2">
          <DialogHeader className="flex-1">
            <DialogTitle className="text-2xl font-black font-heading uppercase tracking-tight text-slate-900">
              {forceNewSession ? 'Start New Session' : 'Start of Day'}
            </DialogTitle>
            <DialogDescription id="start-day-description" className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5 leading-relaxed">
              {forceNewSession 
                ? 'Starting a new session will clear existing order history.' 
                : 'Please enter details to begin the shift.'}
            </DialogDescription>
          </DialogHeader>
          {onClose && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose} 
              className="h-10 w-10 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5 text-slate-400" />
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 mt-8">
          <div className="space-y-3">
            <Label htmlFor="date" className="text-[11px] font-black font-heading uppercase tracking-[0.2em] text-slate-500 ml-1">Date</Label>
            <div className="relative">
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                disabled // Make the date field static
                className="h-14 rounded-2xl border-slate-200 bg-slate-50/50 px-5 font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-base"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="amount" className="text-[11px] font-black font-heading uppercase tracking-[0.2em] text-slate-500 ml-1">Opening Balance (Rs)</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="h-14 rounded-2xl border-slate-200 bg-slate-50/50 px-5 font-black text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-xl"
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black font-heading uppercase tracking-[0.15em] shadow-xl shadow-blue-500/25 transition-all active:scale-[0.97] text-sm"
            disabled={startDayMutation.isPending}
          >
            {startDayMutation.isPending ? (
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              forceNewSession ? 'Start New Session' : 'Start Day'
            )}
          </Button>
        </form>

        {/* Hidden Summary for Printing */}
        <div style={{ position: 'fixed', left: '-9999px', top: '0', width: '80mm', pointerEvents: 'none', zIndex: -1000 }}>
          <div ref={summaryRef} className="receipt-print" style={{ width: '80mm' }}>
            <DailySummary 
              orders={allOrders.filter((o: any) => o.status === 'completed')} 
              date={new Date(date)}
            />
          </div>
          <div ref={productSummaryRef} className="receipt-print" style={{ width: '80mm' }}>
            <ProductSalesSummary 
              orders={productOrdersWithItems} 
              date={new Date(date)}
              query=""
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StartDayModal;
