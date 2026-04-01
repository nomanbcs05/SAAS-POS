import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/services/api';
import { useCartStore } from '@/stores/cartStore';
import { toast } from 'sonner';
import { Users, X, Trash2, UserCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const SERVERS = ['Babar', 'Touheed', 'Nasrullah'];

interface TableSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
type TableSection = 'indoor' | 'outdoor' | 'vip';

const TableSelectionModal = ({ isOpen, onClose }: TableSelectionModalProps) => {
  const [activeFilter, setActiveFilter] = useState<TableSection | 'all'>('all');
  const [serverList, setServerList] = useState<string[]>(['Babar', 'Touheed', 'Nasrullah']);
  const { setTableId, setOrderType, serverName, setServerName } = useCartStore();
  const queryClient = useQueryClient();

  useEffect(() => {
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
      // Rollback optimistic update
      setTableId(null);
      setOrderType('take_away');
    }
  });

  const clearReservedMutation = useMutation({
    mutationFn: api.tables.clearReserved,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast.success('All reserved tables cleared');
    },
    onError: (error) => {
      toast.error('Failed to clear reserved tables');
      console.error(error);
    }
  });

  const handleTableSelect = (table: any) => {
    if (table.status !== 'available') return;

    // Optimistically update UI
    setTableId(table.id || table.table_id);
    setOrderType('dine_in');
    
    // Check if server is selected, if not show reminder but allow proceeding
    if (!serverName) {
      toast.info('Note: No server selected for this table');
    }
    
    onClose();
    toast.success(`Table ${table.table_number} selected`);

    // Perform server update in background
    updateStatusMutation.mutate({ 
      id: table.id || table.table_id, 
      status: 'occupied' 
    });
  };

  const handleSkipTable = () => {
    setTableId(null);
    setOrderType('dine_in');
    onClose();
    toast.success('Proceeding with Dine-In (No Table)');
  };

  const handleClearTable = (e: React.MouseEvent, table: any) => {
    e.stopPropagation(); // Prevent selecting the table
    
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
        className="max-w-[700px] w-[95vw] max-h-[95vh] p-0 overflow-hidden bg-background rounded-2xl shadow-2xl border-none"
        aria-describedby="table-selection-description"
      >
        <div className="flex flex-col h-full max-h-[95vh]">
          {/* Header Section */}
          <div className="p-6 pb-4 border-b bg-slate-50/50">
            <div className="flex justify-between items-start">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-2xl font-black font-heading uppercase tracking-tight text-slate-900">
                  Dine-In Selection
                </DialogTitle>
                <DialogDescription id="table-selection-description" className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                  Assign server & table (Optional)
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => clearReservedMutation.mutate()}
                  className="text-[10px] h-8 font-bold font-heading uppercase tracking-widest border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                >
                  Clear Reserved
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onClose} 
                  className="h-8 w-8 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X className="h-4 w-4 text-slate-500" />
                </Button>
              </div>
            </div>
          </div>

          <div className="p-6 pt-4 overflow-y-auto">
            {/* Server Selection Section */}
            <div className="mb-8 space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black font-heading uppercase tracking-[0.15em] text-slate-400">
                <UserCircle2 className="w-3.5 h-3.5" />
                Select Server
              </div>
              <div className="grid grid-cols-3 gap-3">
                {serverList.map((name) => (
                  <Button
                    key={name}
                    variant={serverName === name ? "default" : "outline"}
                    onClick={() => setServerName(serverName === name ? null : name)}
                    className={cn(
                      "rounded-xl text-xs font-bold transition-all h-12 border-2",
                      serverName === name 
                        ? "bg-slate-900 border-slate-900 text-white shadow-lg scale-[1.02]" 
                        : "border-slate-100 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-white"
                    )}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-[10px] font-black font-heading uppercase tracking-[0.15em] text-slate-400">
                <Users className="w-3.5 h-3.5" />
                Select Table
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSkipTable}
                className="text-[10px] font-black font-heading uppercase tracking-widest text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 px-3 rounded-lg border border-emerald-100"
              >
                Skip Table Selection
              </Button>
            </div>

            <div className="flex gap-1.5 mb-6 bg-slate-100/80 p-1.5 rounded-xl">
              {(['all', 'indoor', 'outdoor', 'vip'] as const).map((section) => (
                <Button
                  key={section}
                  variant={activeFilter === section ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveFilter(section)}
                  className={cn(
                    "flex-1 rounded-lg text-[10px] font-black font-heading uppercase tracking-widest h-9 transition-all",
                    activeFilter === section 
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" 
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  {section}
                </Button>
              ))}
            </div>

            {/* Tables Grid */}
            <div className="min-h-[300px]">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
                  <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Loading tables...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-4">
                  {filteredTables.map((table: any) => (
                    <div
                      key={table.table_id}
                      onClick={() => handleTableSelect(table)}
                      className={cn(
                        "relative border-2 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 transition-all duration-300 group",
                        "h-28 shadow-sm",
                        getStatusColor(table.status),
                        table.status === 'available' 
                          ? "cursor-pointer hover:-translate-y-1.5 hover:shadow-xl hover:border-emerald-400" 
                          : "opacity-80"
                      )}
                    >
                      <span className="text-2xl font-black font-heading tracking-tight">{table.table_number}</span>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-70">
                        <Users className="w-3 h-3" />
                        <span>{table.capacity} Seats</span>
                      </div>
                      <div className={cn(
                        "text-[8px] uppercase tracking-[0.2em] font-black px-2 py-0.5 rounded-full mt-1",
                        table.status === 'available' ? "bg-emerald-500/10" : "bg-slate-900/10"
                      )}>
                        {table.status}
                      </div>
                      
                      {table.status !== 'available' && (
                        <Button 
                          size="icon" 
                          variant="destructive" 
                          className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-lg z-10 opacity-100 hover:scale-110 active:scale-95 transition-all"
                          onClick={(e) => handleClearTable(e, table)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-8 py-6 border-t border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-200" />
                <span>Occupied</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-200" />
                <span>Reserved</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TableSelectionModal;
