import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import React from 'react';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: () => void;
  title?: string;
  children: React.ReactNode;
}

const PrintPreviewModal = ({ isOpen, onClose, onPrint, title = "Print Preview", children }: PrintPreviewModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-white border-2 border-slate-200 shadow-2xl p-0 overflow-hidden flex flex-col h-[85vh]">
        
        {/* Header */}
        <DialogHeader className="p-4 border-b bg-slate-50 flex-shrink-0">
          <div className="flex justify-between items-center">
            <DialogTitle className="text-xl font-black font-heading flex items-center tracking-tight text-slate-800">
              <Printer className="h-5 w-5 mr-3 text-primary" />
              {title}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Scrollable Document Preview Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#f3f4f6]" style={{
          backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}>
          <div className="bg-white mx-auto shadow-sm border border-slate-200" 
               style={{ width: '80mm', minHeight: '100%', padding: '0', pointerEvents: 'none' }}>
            {children}
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 border-t bg-white flex-shrink-0">
          <div className="flex justify-between w-full gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1 h-12 font-bold uppercase tracking-wider text-slate-500">
              Cancel
            </Button>
            <Button onClick={() => {
              onPrint();
              onClose();
            }} className="flex-1 h-12 font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">
              <Printer className="h-5 w-5 mr-2" />
              Confirm Print
            </Button>
          </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};

export default PrintPreviewModal;
