import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/services/api';
import { useCartStore } from '@/stores/cartStore';
import { toast } from 'sonner';
import { Users, X, UserCircle2, Utensils, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
type TableSection = 'indoor' | 'outdoor' | 'vip';

const DiningPage = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<TableSection | 'all'>('all');
  const { setTableId, setOrderType, serverName, setServerName } = useCartStore();
  const queryClient = useQueryClient();

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: api.tables.getAll,
  });

  const { data: ongoingOrders = [] } = useQuery({
    queryKey: ['ongoing-orders'],
    queryFn: api.orders.getOngoing,
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
    }
  });

  const handleTableSelect = (table: any) => {
    // If table is occupied, we might want to view/edit that order
    const orderForTable = ongoingOrders.find((o: any) => o.table_id === (table.id || table.table_id));
    
    if (orderForTable) {
      // If table is occupied, go to ongoing orders with this order selected
      // Or just load it into cart directly? 
      // User says "editable in running", let's load it into cart if they click an occupied table?
      // Actually, usually you click an occupied table to add more items.
      toast.info(`Table ${table.table_number} is occupied. Loading order...`);
      // For now, let's just select it and go to POS
      setTableId(table.id || table.table_id);
      setOrderType('dine_in');
      navigate('/');
      return;
    }

    if (table.status !== 'available' && table.status !== 'occupied') return;

    setTableId(table.id || table.table_id);
    setOrderType('dine_in');
    
    navigate('/');
    toast.success(`Table ${table.table_number} selected`);

    if (table.status === 'available') {
      updateStatusMutation.mutate({ 
        id: table.id || table.table_id, 
        status: 'occupied' 
      });
    }
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
      case 'occupied': return 'border-red-500 bg-red-50 hover:bg-red-100 text-red-700';
      case 'reserved': return 'border-amber-500 bg-amber-50 text-amber-700';
      case 'cleaning': return 'border-gray-400 bg-gray-50 text-gray-500';
      default: return 'border-gray-200';
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-full bg-slate-50/30 p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black font-heading tracking-tight uppercase text-slate-900">Dining Area</h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">
              Real-time table management & status
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border shadow-sm">
            {(['all', 'indoor', 'outdoor', 'vip'] as const).map((section) => (
              <Button
                key={section}
                variant={activeFilter === section ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveFilter(section)}
                className={cn(
                  "rounded-lg text-[10px] font-black font-heading uppercase tracking-widest h-9 px-6 transition-all",
                  activeFilter === section 
                    ? "bg-slate-900 text-white shadow-md" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                )}
              >
                {section}
              </Button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 bg-white rounded-3xl border shadow-sm p-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
              <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest">Fetching tables...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {filteredTables.map((table: any) => {
                const isOccupied = ongoingOrders.some((o: any) => o.table_id === (table.id || table.table_id));
                const status = isOccupied ? 'occupied' : table.status;
                
                return (
                  <div
                    key={table.table_id || table.id}
                    onClick={() => handleTableSelect(table)}
                    className={cn(
                      "relative border-2 rounded-3xl p-6 flex flex-col items-center justify-center gap-2 transition-all duration-300 group",
                      "h-36 shadow-sm cursor-pointer",
                      getStatusColor(status),
                      "hover:-translate-y-2 hover:shadow-2xl"
                    )}
                  >
                    <span className="text-3xl font-black font-heading tracking-tighter">{table.table_number}</span>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-60">
                      <Users className="w-3.5 h-3.5" />
                      <span>{table.capacity} Seats</span>
                    </div>
                    <div className={cn(
                      "text-[9px] uppercase tracking-[0.2em] font-black px-3 py-1 rounded-full mt-2",
                      status === 'available' ? "bg-emerald-500/10" : 
                      status === 'occupied' ? "bg-red-500/10" : "bg-slate-900/10"
                    )}>
                      {status}
                    </div>
                    
                    {status !== 'available' && (
                      <Button 
                        size="icon" 
                        variant="destructive" 
                        className="absolute -top-3 -right-3 h-8 w-8 rounded-full shadow-lg z-10 scale-0 group-hover:scale-100 transition-all duration-200"
                        onClick={(e) => handleClearTable(e, table)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}

                    {status === 'occupied' && (
                      <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg animate-pulse">
                        <Utensils className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {filteredTables.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <LayoutGrid className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-black uppercase tracking-widest">No tables found</p>
              <p className="text-sm font-medium">Add tables in settings to see them here</p>
            </div>
          )}
        </ScrollArea>

        {/* Legend */}
        <div className="flex items-center justify-center gap-12 p-6 bg-white rounded-2xl border shadow-sm text-[10px] font-black font-heading uppercase tracking-[0.2em] text-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-200" />
            <span>Occupied</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-lg shadow-amber-200" />
            <span>Reserved</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-slate-300 shadow-lg shadow-slate-100" />
            <span>Cleaning</span>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DiningPage;
