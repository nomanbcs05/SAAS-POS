import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/services/api';
import { useCartStore } from '@/stores/cartStore';
import { toast } from 'sonner';
import { Users, X, UserCircle2, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TableSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
type TableSection = 'indoor' | 'outdoor' | 'vip';

const TableSelectionModal = ({ isOpen, onClose }: TableSelectionModalProps) => {
  const [step, setStep] = useState<'server' | 'table'>('server');
  const [activeFilter, setActiveFilter] = useState<TableSection | 'all'>('all');
  const [serverList, setServerList] = useState<string[]>(['Babar', 'Touheed', 'Nasrullah']);
  const { setTableId, setOrderType, serverName, setServerName } = useCartStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOpen) {
      setStep('server');
    }
    const savedServers = localStorage.getItem('pos_server_names');
    if (savedServers) {
      setServerList(JSON.parse(savedServers));
    }
  }, [isOpen]);

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: api.tables.getAll,
    enabled: isOpen,
  });

  const { data: ongoingOrders = [] } = useQuery({
    queryKey: ['ongoing-orders'],
    queryFn: api.orders.getOngoing,
    enabled: isOpen,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TableStatus }) => {
      return api.tables.updateStatus(id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (error) => {
      toast.error('Failed to update table status');
      console.error(error);
      setTableId(null);
      setOrderType('take_away');
    }
  });

  const handleServerSelect = (name: string) => {
    setServerName(name);
    setStep('table');
  };

  const handleTableSelect = (table: any) => {
    const tableIdVal = table.id || table.table_id;
    const isOccupied = ongoingOrders.some((o: any) => o.table_id === tableIdVal);
    
    if (isOccupied) {
      setTableId(tableIdVal);
      setOrderType('dine_in');
      onClose();
      toast.success(`Table ${table.table_number} loaded`);
      return;
    }

    if (table.status !== 'available' && table.status !== 'occupied') return;

    setTableId(tableIdVal);
    setOrderType('dine_in');
    
    onClose();
    toast.success(`Table ${table.table_number} selected`);

    if (table.status === 'available') {
      updateStatusMutation.mutate({ 
        id: tableIdVal, 
        status: 'occupied' 
      });
    }
  };

  const handleSkipTable = () => {
    setTableId(null);
    setOrderType('dine_in');
    onClose();
    toast.success('Proceeding with Dine-In (No Table)');
  };

  const handleClearTable = (e: React.MouseEvent, table: any) => {
    e.stopPropagation();
    updateStatusMutation.mutate({ 
      id: table.id || table.table_id, 
      status: 'available' 
    });
    toast.success(`Table ${table.table_number} is now available`);
  };

  const filteredTables = tables.filter((table: any) => 
    activeFilter === 'all' ? true : table.section === activeFilter
  );

  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'available': return 'border-emerald-500 bg-emerald-50 hover:bg-emerald-100 text-emerald-700';
      case 'occupied': return 'border-red-500 bg-red-50 text-red-700';
      case 'reserved': return 'border-amber-500 bg-amber-50 text-amber-700';
      case 'cleaning': return 'border-gray-400 bg-gray-50 text-gray-500';
      default: return 'border-gray-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-[750px] w-[95vw] max-h-[90vh] p-0 overflow-hidden bg-background rounded-[2.5rem] shadow-2xl border-none"
        aria-describedby="table-selection-description"
      >
        <div className="flex flex-col h-full max-h-[90vh]">
          {/* Header Section */}
          <div className="p-8 pb-4 bg-slate-50/50 relative">
            <div className="flex justify-between items-start">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-3xl font-black font-heading uppercase tracking-tight text-slate-900">
                  {step === 'server' ? 'Select Server' : 'Choose Table'}
                </DialogTitle>
                <DialogDescription id="table-selection-description" className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                  {step === 'server' ? 'Step 1 of 2: Assign a server' : `Step 2 of 2: Select a table (${activeFilter})`}
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3">
                {step === 'table' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setStep('server')}
                    className="text-[10px] h-9 px-4 font-black font-heading uppercase tracking-widest border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl"
                  >
                    Back to Servers
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onClose} 
                  className="h-9 w-9 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </Button>
              </div>
            </div>
          </div>

          <div className="px-8 pb-8 pt-4 overflow-y-auto">
            {step === 'server' ? (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {serverList.map((name) => (
                    <Button
                      key={name}
                      variant={serverName === name ? "default" : "outline"}
                      onClick={() => handleServerSelect(name)}
                      className={cn(
                        "rounded-3xl text-sm font-black font-heading uppercase tracking-wider transition-all h-24 border-2 flex flex-col gap-2 shadow-sm",
                        serverName === name 
                          ? "bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.05] z-10" 
                          : "border-slate-100 bg-white text-slate-600 hover:border-slate-300 hover:shadow-md"
                      )}
                    >
                      <UserCircle2 className={cn("w-6 h-6", serverName === name ? "text-blue-400" : "text-slate-300")} />
                      {name}
                    </Button>
                  ))}
                </div>
                <div className="pt-4 flex justify-center">
                  <Button 
                    variant="ghost" 
                    onClick={() => setStep('table')}
                    className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900"
                  >
                    Skip to table selection →
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Category Tabs */}
                <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl sticky top-0 z-20">
                  {(['all', 'indoor', 'outdoor', 'vip'] as const).map((section) => (
                    <Button
                      key={section}
                      variant={activeFilter === section ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setActiveFilter(section)}
                      className={cn(
                        "flex-1 rounded-xl text-[10px] font-black font-heading uppercase tracking-widest h-10 transition-all",
                        activeFilter === section 
                          ? "bg-white text-slate-900 shadow-md ring-1 ring-slate-200" 
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
                      )}
                    >
                      {section}
                    </Button>
                  ))}
                </div>

                <div className="min-h-[350px]">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                      <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                      <span className="text-xs font-black uppercase tracking-widest">Loading tables...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-6">
                      {filteredTables.map((table: any) => {
                        const tableIdVal = table.id || table.table_id;
                        const isOccupied = ongoingOrders.some((o: any) => o.table_id === tableIdVal);
                        const status = isOccupied ? 'occupied' : table.status;
                        
                        return (
                          <div
                            key={tableIdVal}
                            onClick={() => handleTableSelect(table)}
                            className={cn(
                              "relative border-2 rounded-[2rem] p-6 flex flex-col items-center justify-center gap-1 transition-all duration-300 group",
                              "h-32 shadow-sm cursor-pointer",
                              getStatusColor(status),
                              "hover:-translate-y-1.5 hover:shadow-2xl hover:border-blue-400"
                            )}
                          >
                            <span className="text-3xl font-black font-heading tracking-tighter">{table.table_number}</span>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-60">
                              <Users className="w-3.5 h-3.5" />
                              <span>{table.capacity} Seats</span>
                            </div>
                            <div className={cn(
                              "text-[8px] uppercase tracking-[0.2em] font-black px-2.5 py-1 rounded-full mt-2",
                              status === 'available' ? "bg-emerald-500/10 text-emerald-600" : 
                              status === 'occupied' ? "bg-red-500/10 text-red-600" : "bg-slate-900/10"
                            )}>
                              {status}
                            </div>
                            
                            {status !== 'available' && (
                              <Button 
                                size="icon" 
                                variant="destructive" 
                                className="absolute -top-2 -right-2 h-8 w-8 rounded-full shadow-lg z-10 scale-0 group-hover:scale-100 transition-all duration-200"
                                onClick={(e) => handleClearTable(e, table)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {filteredTables.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                      <LayoutGrid className="h-16 w-16 mb-4 opacity-10" />
                      <p className="text-sm font-black uppercase tracking-widest opacity-40">No tables in this section</p>
                    </div>
                  )}
                </div>

                {/* Footer Section */}
                <div className="flex flex-col gap-4 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-center gap-10 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                      <span>Available</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />
                      <span>Occupied</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-300 shadow-sm" />
                      <span>Cleaning</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      onClick={handleSkipTable}
                      className="flex-1 h-14 rounded-2xl text-[11px] font-black uppercase tracking-widest border-2 border-slate-100 text-slate-400 hover:text-slate-900 hover:border-slate-200"
                    >
                      Skip Table Selection
                    </Button>
                    {serverName && (
                      <div className="flex-1 bg-slate-900 rounded-2xl px-6 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Selected Server</span>
                        <span className="text-white font-black uppercase tracking-widest text-xs">{serverName}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TableSelectionModal;
