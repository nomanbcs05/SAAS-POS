import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Delete, ShoppingCart, Percent, DollarSign, RefreshCw } from 'lucide-react';
import { Product } from '@/stores/cartStore';
import { cn } from '@/lib/utils';

interface ProductAmountCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onAdd: (
    product: Product,
    quantity: number,
    calcDetails: {
      desiredAmount: number;
      receivedCash?: number;
      remainingCash?: number;
      qtyMeasureLabel?: string;
    }
  ) => void;
}

export default function ProductAmountCalculatorModal({
  isOpen,
  onClose,
  product,
  onAdd,
}: ProductAmountCalculatorModalProps) {
  const [rate, setRate] = useState<number>(0);
  const [quantity, setQuantity] = useState<string>('1');
  const [desiredAmount, setDesiredAmount] = useState<string>('0');
  const [receivedCash, setReceivedCash] = useState<string>('');
  const [remainingCash, setRemainingCash] = useState<number>(0);
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>(undefined);
  const [focusedField, setFocusedField] = useState<'desiredAmount' | 'quantity' | 'receivedCash'>('desiredAmount');

  // Quantity Pricing measures loaded from localStorage
  const [qtyPricing, setQtyPricing] = useState<{
    enabled: boolean;
    unit: string;
    measures: Array<{ label: string; qty: number; price: number }>;
  } | null>(null);

  useEffect(() => {
    if (isOpen && product) {
      setRate(product.price);
      setQuantity('1');
      setDesiredAmount(product.price.toString());
      setReceivedCash('');
      setRemainingCash(0);
      setSelectedLabel(undefined);
      setFocusedField('desiredAmount');

      // Load pricing from localStorage
      const saved = localStorage.getItem(`qty_measure_pricing_${product.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setQtyPricing(parsed.enabled ? parsed : null);
      } else {
        setQtyPricing(null);
      }
    }
  }, [isOpen, product]);

  // Recalculations
  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    const qtyVal = parseFloat(quantity) || 0;
    const newAmt = qtyVal * newRate;
    setDesiredAmount(newAmt.toFixed(2));
    recalcChange(newAmt, receivedCash);
  };

  const handleQtyChange = (qtyStr: string) => {
    setQuantity(qtyStr);
    const qtyVal = parseFloat(qtyStr) || 0;
    const newAmt = qtyVal * rate;
    setDesiredAmount(newAmt.toFixed(2));
    recalcChange(newAmt, receivedCash);
    setSelectedLabel(undefined);
  };

  const handleAmountChange = (amtStr: string) => {
    setDesiredAmount(amtStr);
    const amtVal = parseFloat(amtStr) || 0;
    if (rate > 0) {
      const computedQty = amtVal / rate;
      setQuantity(computedQty.toFixed(4));
    }
    recalcChange(amtVal, receivedCash);
    setSelectedLabel(undefined);
  };

  const handleReceivedCashChange = (cashStr: string) => {
    setReceivedCash(cashStr);
    const amtVal = parseFloat(desiredAmount) || 0;
    recalcChange(amtVal, cashStr);
  };

  const recalcChange = (amt: number, cashStr: string) => {
    const cashVal = parseFloat(cashStr) || 0;
    if (cashVal > 0) {
      setRemainingCash(Math.max(0, cashVal - amt));
    } else {
      setRemainingCash(0);
    }
  };

  // Quick measure selection
  const handleSelectMeasure = (label: string, qty: number, price: number) => {
    setSelectedLabel(label);
    setQuantity(qty.toString());
    setDesiredAmount(price.toString());
    recalcChange(price, receivedCash);
  };

  // Numerical Keypad handlers
  const handleKeyPress = (key: string) => {
    let currentVal = '';
    let setVal: (val: string) => void = () => {};

    if (focusedField === 'desiredAmount') {
      currentVal = desiredAmount;
      setVal = handleAmountChange;
    } else if (focusedField === 'quantity') {
      currentVal = quantity;
      setVal = handleQtyChange;
    } else if (focusedField === 'receivedCash') {
      currentVal = receivedCash;
      setVal = handleReceivedCashChange;
    }

    if (key === 'C') {
      setVal('');
    } else if (key === 'backspace') {
      setVal(currentVal.slice(0, -1));
    } else {
      // Prevent multiple decimals
      if (key === '.' && currentVal.includes('.')) return;
      
      // Auto-replace initial zero or blank
      if (currentVal === '0' && key !== '.') {
        setVal(key);
      } else {
        setVal(currentVal + key);
      }
    }
  };

  // Handle Quick Cash notes
  const handleQuickCash = (note: number) => {
    const amtVal = parseFloat(desiredAmount) || 0;
    let newCash = note.toString();
    
    // If double clicking/adding notes, append or set
    if (receivedCash) {
      const prev = parseFloat(receivedCash) || 0;
      // If note is smaller than amount, we might add it, but normally POS sets it
      newCash = note.toString();
    }
    
    setReceivedCash(newCash);
    recalcChange(amtVal, newCash);
  };

  const handleSubmit = () => {
    if (!product) return;
    const finalQty = parseFloat(quantity) || 1;
    const finalAmt = parseFloat(desiredAmount) || (product.price * finalQty);
    const finalRecv = parseFloat(receivedCash) || undefined;
    const finalChange = finalRecv !== undefined ? remainingCash : undefined;

    onAdd(product, finalQty, {
      desiredAmount: finalAmt,
      receivedCash: finalRecv,
      remainingCash: finalChange,
      qtyMeasureLabel: selectedLabel,
    });
    onClose();
  };

  if (!product) return null;

  const quickNotes = [50, 100, 500, 1000, 5000];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl rounded-3xl p-0 overflow-hidden bg-slate-900 border border-slate-800 text-white shadow-2xl flex flex-col md:flex-row max-h-[90vh]">
        {/* Left Section: Inputs, Config, and Details */}
        <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto space-y-4">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                  {product.category}
                </span>
                <DialogTitle className="text-2xl font-black font-heading uppercase tracking-tight text-white mt-0.5">
                  {product.name}
                </DialogTitle>
                <div className="text-xs text-slate-400 font-bold mt-1">
                  Base Rate: <span className="text-white font-black">Rs {product.price.toLocaleString()}</span>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full h-8 w-8"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Quick Quantity Measure Buttons (If Configured) */}
            {qtyPricing && qtyPricing.measures.length > 0 && (
              <div className="mt-4 p-3 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Select Predefined Quantity Measure
                </span>
                <div className="flex flex-wrap gap-2">
                  {qtyPricing.measures.map((m, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      variant="outline"
                      onClick={() => handleSelectMeasure(m.label, m.qty, m.price)}
                      className={cn(
                        "h-10 px-3 text-xs font-black rounded-xl border-slate-700 bg-slate-900 hover:bg-emerald-600 hover:text-white transition-all uppercase",
                        selectedLabel === m.label ? "border-emerald-500 bg-emerald-600/20 text-emerald-400" : "text-slate-200"
                      )}
                    >
                      {m.label} ({m.qty}{qtyPricing.unit}) • Rs {m.price}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Main Form Fields */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-1">
                  Desired Amount (Rs)
                </Label>
                <div 
                  onClick={() => setFocusedField('desiredAmount')}
                  className={cn(
                    "flex items-center bg-slate-950 border rounded-2xl px-3 h-12 transition-all cursor-pointer",
                    focusedField === 'desiredAmount' ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-800 hover:border-slate-700"
                  )}
                >
                  <span className="text-slate-400 font-bold mr-1.5 text-sm">Rs</span>
                  <input
                    type="text"
                    value={desiredAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="w-full bg-transparent border-none text-white font-black text-lg focus:outline-none placeholder-slate-600"
                    placeholder="0.00"
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-1">
                  Quantity ({qtyPricing?.unit || 'units'})
                </Label>
                <div 
                  onClick={() => setFocusedField('quantity')}
                  className={cn(
                    "flex items-center bg-slate-950 border rounded-2xl px-3 h-12 transition-all cursor-pointer",
                    focusedField === 'quantity' ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-800 hover:border-slate-700"
                  )}
                >
                  <input
                    type="text"
                    value={quantity}
                    onChange={(e) => handleQtyChange(e.target.value)}
                    className="w-full bg-transparent border-none text-white font-black text-lg focus:outline-none placeholder-slate-600 text-right"
                    placeholder="1.0"
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-1">
                  Received Cash (Rs)
                </Label>
                <div 
                  onClick={() => setFocusedField('receivedCash')}
                  className={cn(
                    "flex items-center bg-slate-950 border rounded-2xl px-3 h-12 transition-all cursor-pointer",
                    focusedField === 'receivedCash' ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-800 hover:border-slate-700"
                  )}
                >
                  <span className="text-slate-400 font-bold mr-1.5 text-sm">Rs</span>
                  <input
                    type="text"
                    value={receivedCash}
                    onChange={(e) => handleReceivedCashChange(e.target.value)}
                    className="w-full bg-transparent border-none text-white font-black text-lg focus:outline-none placeholder-slate-600"
                    placeholder="Enter cash received"
                    readOnly
                  />
                </div>
              </div>
            </div>

            {/* Quick Cash Notes */}
            <div className="mt-3 space-y-1.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                Quick Cash Select
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {quickNotes.map((note) => (
                  <Button
                    key={note}
                    type="button"
                    variant="outline"
                    onClick={() => handleQuickCash(note)}
                    className="h-10 flex-1 min-w-[60px] text-xs font-black rounded-xl border-slate-800 bg-slate-950 hover:bg-slate-800 hover:text-white text-slate-300"
                  >
                    Rs {note}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Change Display Panel */}
          <div className="bg-slate-950/80 rounded-3xl p-5 border border-slate-800/80 flex items-center justify-between shadow-inner">
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                Remaining Change (Return)
              </span>
              <span className="text-2xl font-black tracking-tight text-emerald-400 mt-1 block">
                Rs {remainingCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-emerald-500/10 text-emerald-400 rounded-full h-12 w-12 flex items-center justify-center border border-emerald-500/20 font-black">
              Rs
            </div>
          </div>
        </div>

        {/* Right Section: Numerical Touch Keypad */}
        <div className="w-full md:w-80 bg-slate-950 p-6 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col justify-between shrink-0">
          <div className="space-y-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 text-center md:text-left">
              POS Calculator Input Keyboard
            </span>

            {/* Keyboard Layout */}
            <div className="grid grid-cols-3 gap-2.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.', 'C'].map((key) => (
                <Button
                  key={key}
                  type="button"
                  onClick={() => handleKeyPress(key)}
                  className={cn(
                    "h-14 font-black text-lg rounded-2xl transition-all shadow-sm border border-slate-850",
                    key === 'C' 
                      ? "bg-red-500/15 border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white" 
                      : "bg-slate-900 border-slate-800 text-white hover:bg-slate-800 active:scale-95"
                  )}
                >
                  {key}
                </Button>
              ))}
              <Button
                type="button"
                onClick={() => handleKeyPress('backspace')}
                className="col-span-3 h-12 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl font-black text-xs uppercase"
              >
                <Delete className="h-4 w-4 mr-2 inline" /> Backspace
              </Button>
            </div>
          </div>

          <div className="flex gap-2.5 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-14 font-bold border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-2xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-950/50"
            >
              <ShoppingCart className="h-4 w-4 mr-2" /> Add Cart
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
