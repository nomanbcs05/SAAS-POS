import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cartStore';
import { toast } from 'sonner';
import { User } from 'lucide-react';
import { motion } from 'framer-motion';

interface RiderSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RiderSelectionModal = ({ isOpen, onClose }: RiderSelectionModalProps) => {
  const { setRider } = useCartStore();
  const [selectedRider, setSelectedRider] = useState<any>(null);
  const [riderList, setRiderList] = useState<string[]>(['Ayaz', 'Mumtaz', 'Abuzar', 'Zafar']);

  useEffect(() => {
    const saved = localStorage.getItem('pos_rider_names');
    if (saved) {
      setRiderList(JSON.parse(saved));
    }
  }, [isOpen]);

  const handleSelectRider = (name: string) => {
    setSelectedRider(name);
    setRider({ name });
    toast.success(`Rider ${name} assigned to delivery`);
    onClose();
    setTimeout(() => {
      setSelectedRider(null);
    }, 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setSelectedRider(null);
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[500px] p-6 bg-background" aria-describedby="rider-selection-description">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-bold text-center">
            Select Rider
          </DialogTitle>
          <DialogDescription id="rider-selection-description" className="text-center">
            Choose a rider to assign this delivery order.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {riderList.map((name) => (
            <motion.button
              key={name}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelectRider(name)}
              className="p-6 rounded-xl border-2 border-muted hover:border-primary hover:bg-primary/5 bg-card transition-all flex flex-col items-center justify-center gap-2 h-32"
            >
              <User className="h-8 w-8 text-muted-foreground" />
              <h3 className="font-bold text-lg">{name}</h3>
            </motion.button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RiderSelectionModal;
