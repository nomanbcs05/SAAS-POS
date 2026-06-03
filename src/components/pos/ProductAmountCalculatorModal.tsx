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
  const [rateStr, setRateStr] = useState<string>('0');
  const [quantity, setQuantity] = useState<string>('1');
  const [desiredAmount, setDesiredAmount] = useState<string>('0');
  const [receivedCash, setReceivedCash] = useState<string>('');
  const [remainingCash, setRemainingCash] = useState<number>(0);
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>(undefined);
  const [focusedField, setFocusedField] = useState<'desiredAmount' | 'quantity' | 'receivedCash' | 'rate'>('desiredAmount');

  // Quantity Pricing measures loaded from localStorage
  const [qtyPricing, setQtyPricing] = useState<{
    enabled: boolean;
    unit: string;
    measures: Array<{ label: string; qty: number; price: number }>;
  } | null>(null);

  useEffect(() => {
    if (isOpen && product) {
      setRateStr(product.price.toString());
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
  const handleRateChange = (newRateStr: string) => {
    setRateStr(newRateStr);
    const rVal = parseFloat(newRateStr) || 0;
    const qVal = parseFloat(quantity) || 0;
    const newAmt = qVal * rVal;
    setDesiredAmount(newAmt.toFixed(2));
    recalcChange(newAmt, receivedCash);
  };

  const handleQtyChange = (qtyStr: string) => {
    setQuantity(qtyStr);
    const qVal = parseFloat(qtyStr) || 0;
    const rVal = parseFloat(rateStr) || 0;
    const newAmt = qVal * rVal;
    setDesiredAmount(newAmt.toFixed(2));
    recalcChange(newAmt, receivedCash);
    setSelectedLabel(undefined);
  };

  const handleAmountChange = (amtStr: string) => {
    setDesiredAmount(amtStr);
    const amtVal = parseFloat(amtStr) || 0;
    
    if (product && product.price === 0) {
      // For flexible price products (base price is 0), we keep quantity unchanged
      // and calculate the rate as desiredAmount / quantity.
      const qVal = parseFloat(quantity) || 1;
      const calculatedRate = qVal > 0 ? amtVal / qVal : amtVal;
      setRateStr(calculatedRate.toString());
    } else {
      // For fixed price products, we calculate quantity based on the product price
      const rVal = product ? product.price : 0;
      if (rVal > 0) {
        const computedQty = amtVal / rVal;
        setQuantity(computedQty.toFixed(4));
      } else {
        // Fallback
        setQuantity('1');
        setRateStr(amtVal.toString());
      }
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
    const computedRate = qty > 0 ? price / qty : price;
    setRateStr(computedRate.toString());
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
    } else if (focusedField === 'rate') {
      currentVal = rateStr;
      setVal = handleRateChange;
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
    const rateVal = parseFloat(rateStr) || 0;
    const amtVal = parseFloat(desiredAmount) || 0;
    const finalAmt = amtVal > 0 ? amtVal : (rateVal || product.price) * finalQty;
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
      <DialogContent className="max-w-4xl rounded-3xl p-0 overflow-hidden bg-white border border-gray-200 text-black shadow-2xl flex flex-col md:flex-row max-h-[90vh]">
        {/* Left Section: Inputs, Config, and Details */}
        <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto space-y-4 bg-white">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">
                  {product.category}
                </span>
                <DialogTitle className="text-2xl font-black font-heading uppercase tracking-tight text-black mt-0.5">
                  {product.name}
                </DialogTitle>
                <div className="text-xs text-gray-500 font-bold mt-1">
                  Base Rate: <span className="text-black font-black">Rs {product.price.toLocaleString()}</span>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="text-gray-400 hover:text-black hover:bg-gray-100 rounded-full h-8 w-8"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Quick Quantity Measure Buttons (If Configured) */}
            {qtyPricing && qtyPricing.measures.length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">
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
                        "h-10 px-3 text-xs font-black rounded-xl border-gray-300 bg-white hover:bg-emerald-600 hover:text-white transition-all uppercase",
                        selectedLabel === m.label ? "border-emerald-500 bg-emerald-100 text-emerald-700" : "text-gray-700"
                      )}
                    >
                      {m.label} ({m.qty}{qtyPricing.unit}) • Rs {m.price}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Main Form Fields */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block ml-1">
                  Rate / Unit (Rs)
                </Label>
                <div 
                  onClick={() => setFocusedField('rate')}
                  className={cn(
                    "flex items-center bg-gray-50 border rounded-2xl px-2.5 h-12 transition-all cursor-pointer",
                    focusedField === 'rate' ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-gray-300 hover:border-gray-400"
                  )}
                >
                  <span className="text-gray-400 font-bold mr-1 text-xs">Rs</span>
                  <input
                    type="text"
                    value={rateStr}
                    className="w-full bg-transparent border-none text-black font-black text-sm focus:outline-none placeholder-gray-400"
                    placeholder="0.00"
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block ml-1">
                  Quantity ({qtyPricing?.unit || 'units'})
                </Label>
                <div 
                  onClick={() => setFocusedField('quantity')}
                  className={cn(
                    "flex items-center bg-gray-50 border rounded-2xl px-2.5 h-12 transition-all cursor-pointer",
                    focusedField === 'quantity' ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-gray-300 hover:border-gray-400"
                  )}
                >
                  <input
                    type="text"
                    value={quantity}
                    className="w-full bg-transparent border-none text-black font-black text-sm focus:outline-none placeholder-gray-400 text-right"
                    placeholder="1.0"
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block ml-1">
                  Desired Amt (Rs)
                </Label>
                <div 
                  onClick={() => setFocusedField('desiredAmount')}
                  className={cn(
                    "flex items-center bg-gray-50 border rounded-2xl px-2.5 h-12 transition-all cursor-pointer",
                    focusedField === 'desiredAmount' ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-gray-300 hover:border-gray-400"
                  )}
                >
                  <span className="text-gray-400 font-bold mr-1 text-xs">Rs</span>
                  <input
                    type="text"
                    value={desiredAmount}
                    className="w-full bg-transparent border-none text-black font-black text-sm focus:outline-none placeholder-gray-400"
                    placeholder="0.00"
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-1.5 col-span-3">
                <Label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block ml-1">
                  Received Cash (Rs)
                </Label>
                <div 
                  onClick={() => setFocusedField('receivedCash')}
                  className={cn(
                    "flex items-center bg-gray-50 border rounded-2xl px-3 h-12 transition-all cursor-pointer",
                    focusedField === 'receivedCash' ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-gray-300 hover:border-gray-400"
                  )}
                >
                  <span className="text-gray-400 font-bold mr-1.5 text-sm">Rs</span>
                  <input
                    type="text"
                    value={receivedCash}
                    className="w-full bg-transparent border-none text-black font-black text-lg focus:outline-none placeholder-gray-400"
                    placeholder="Enter cash received"
                    readOnly
                  />
                </div>
              </div>
            </div>

            {/* Quick Cash Notes */}
            <div className="mt-3 space-y-1.5">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block ml-1">
                Quick Cash Select
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {quickNotes.map((note) => (
                  <Button
                    key={note}
                    type="button"
                    variant="outline"
                    onClick={() => handleQuickCash(note)}
                    className="h-10 flex-1 min-w-[60px] text-xs font-black rounded-xl border-gray-300 bg-gray-50 hover:bg-emerald-600 hover:text-white text-gray-700"
                  >
                    Rs {note}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Change Display Panel */}
          <div className="bg-gray-50 rounded-3xl p-5 border border-gray-200 flex items-center justify-between shadow-inner">
            <div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">
                Remaining Change (Return)
              </span>
              <span className="text-2xl font-black tracking-tight text-emerald-600 mt-1 block">
                Rs {remainingCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-emerald-100 text-emerald-600 rounded-full h-12 w-12 flex items-center justify-center border border-emerald-200 font-black">
              Rs
            </div>
          </div>
        </div>

        {/* Right Section: Numerical Touch Keypad */}
        <div className="w-full md:w-80 bg-gray-100 p-6 border-t md:border-t-0 md:border-l border-gray-200 flex flex-col justify-between shrink-0">
          <div className="space-y-4">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block ml-1 text-center md:text-left">
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
                    "h-14 font-black text-lg rounded-2xl transition-all shadow-sm",
                    key === 'C' 
                      ? "bg-red-50 border border-red-200 text-red-500 hover:bg-red-500 hover:text-white" 
                      : "bg-white border border-gray-300 text-black hover:bg-gray-200 active:scale-95"
                  )}
                >
                  {key}
                </Button>
              ))}
              <Button
                type="button"
                onClick={() => handleKeyPress('backspace')}
                className="col-span-3 h-12 bg-white border border-gray-300 text-gray-500 hover:text-black hover:bg-gray-200 rounded-2xl font-black text-xs uppercase"
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
              className="flex-1 h-14 font-bold border-gray-300 bg-white hover:bg-gray-100 text-gray-600 rounded-2xl"
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
