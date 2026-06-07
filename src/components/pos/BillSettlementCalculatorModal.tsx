import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X, Delete, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BillSettlementCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  onSettle: (receivedCash: number, remainingCash: number) => void;
}

export default function BillSettlementCalculatorModal({
  isOpen,
  onClose,
  totalAmount,
  onSettle,
}: BillSettlementCalculatorModalProps) {
  const [receivedCash, setReceivedCash] = useState<string>('');
  const [remainingCash, setRemainingCash] = useState<number>(0);
  const [focusedField, setFocusedField] = useState<'receivedCash'>('receivedCash');

  useEffect(() => {
    if (isOpen) {
      setReceivedCash('');
      setRemainingCash(0);
      setFocusedField('receivedCash');
    }
  }, [isOpen, totalAmount]);

  const handleReceivedCashChange = (cashStr: string) => {
    setReceivedCash(cashStr);
    recalcChange(cashStr);
  };

  const recalcChange = (cashStr: string) => {
    const cashVal = parseFloat(cashStr) || 0;
    if (cashVal > 0) {
      setRemainingCash(Math.max(0, cashVal - totalAmount));
    } else {
      setRemainingCash(0);
    }
  };

  // Numerical Keypad handlers
  const handleKeyPress = (key: string) => {
    let currentVal = receivedCash;
    let setVal = handleReceivedCashChange;

    if (key === 'C') {
      setVal('');
    } else if (key === 'backspace') {
      setVal(currentVal.slice(0, -1));
    } else {
      // Prevent multiple decimals
      if (key === '.' && currentVal.includes('.')) return;
      
      // Auto-replace initial zero
      if (currentVal === '0' && key !== '.') {
        setVal(key);
      } else {
        setVal(currentVal + key);
      }
    }
  };

  // Handle Quick Cash notes
  const handleQuickCash = (note: number) => {
    const newCash = note.toString();
    setReceivedCash(newCash);
    recalcChange(newCash);
  };

  const handleSubmit = () => {
    const finalRecv = parseFloat(receivedCash) || 0;
    onSettle(finalRecv, remainingCash);
    onClose();
  };

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
                  Settlement
                </span>
                <DialogTitle className="text-2xl font-black font-heading uppercase tracking-tight text-black mt-0.5">
                  Payable Total
                </DialogTitle>
                <div className="text-xs text-gray-500 font-bold mt-1">
                  Total Bill: <span className="text-black font-black">Rs {totalAmount.toLocaleString()}</span>
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

            {/* Main Form Fields */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block ml-1">
                  Rate / Unit (Rs)
                </Label>
                <div className="flex items-center bg-gray-50 border rounded-2xl px-2.5 h-12 border-gray-300 opacity-60">
                  <span className="text-gray-400 font-bold mr-1 text-xs">Rs</span>
                  <input
                    type="text"
                    value={totalAmount.toFixed(2)}
                    className="w-full bg-transparent border-none text-black font-black text-sm focus:outline-none"
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block ml-1">
                  Quantity
                </Label>
                <div className="flex items-center bg-gray-50 border rounded-2xl px-2.5 h-12 border-gray-300 opacity-60">
                  <input
                    type="text"
                    value="1"
                    className="w-full bg-transparent border-none text-black font-black text-sm focus:outline-none text-right"
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block ml-1">
                  Desired Amt (Rs)
                </Label>
                <div className="flex items-center bg-gray-50 border rounded-2xl px-2.5 h-12 border-gray-300 opacity-60">
                  <span className="text-gray-400 font-bold mr-1 text-xs">Rs</span>
                  <input
                    type="text"
                    value={totalAmount.toFixed(2)}
                    className="w-full bg-transparent border-none text-black font-black text-sm focus:outline-none"
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
            <div className="mt-4 space-y-1.5">
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
              disabled={(parseFloat(receivedCash) || 0) < totalAmount}
              className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-950/50"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" /> Settle Bill
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
