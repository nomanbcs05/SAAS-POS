import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import { useCartStore } from '@/stores/cartStore';
import { toast } from 'sonner';
import { Users, X, UserCircle2, TreePine, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TableSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
type TableSection = 'indoor' | 'outdoor';

// Layout definition: Indoor = 16 tables × 6 seats, Outdoor = 8 tables × 8 seats
const SECTION_CONFIG: Record<TableSection, { count: number; capacity: number; label: string }> = {
  indoor:  { count: 16, capacity: 6, label: 'Indoor'  },
  outdoor: { count: 8,  capacity: 8, label: 'Outdoor' },
};

const TableSelectionModal = ({ isOpen, onClose }: TableSelectionModalProps) => {
  const [step, setStep] = useState<'server' | 'table'>('server');
  const [activeFilter, setActiveFilter] = useState<TableSection | 'all'>('all');
  const [serverList, setServerList] = useState<string[]>(['Babar', 'Touheed', 'Nasrullah']);
  const { setTableId, setOrderType, serverName, setServerName } = useCartStore();
  const queryClient = useQueryClient();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('server');
      setActiveFilter('all');
    }
    const savedServers = localStorage.getItem('pos_server_names');
    if (savedServers) {
      try { setServerList(JSON.parse(savedServers)); } catch { /* ignore */ }
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

  // Build the full table list from config, merging DB records
  const displayTables = useMemo(() => {
    const allTables: any[] = [];

    const sections: TableSection[] = activeFilter === 'all' ? ['indoor', 'outdoor'] : [activeFilter];

    for (const section of sections) {
      const { count, capacity } = SECTION_CONFIG[section];
      // Number tables per section: Indoor → T1–T16, Outdoor → O1–O8
      const prefix = section === 'indoor' ? 'T' : 'O';
      for (let i = 1; i <= count; i++) {
        const tableNum = `${prefix}${i}`;
        const existing = tables.find(
          (t: any) => t.table_number === tableNum && t.section === section
        );
        allTables.push(
          existing || {
            table_number: tableNum,
            section,
            capacity,
            status: 'available' as TableStatus,
            isVirtual: true,
          }
        );
      }
    }
    return allTables;
  }, [tables, activeFilter]);

  /* ── mutations ── */
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TableStatus }) =>
      api.tables.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tables'] }),
    onError: () => toast.error('Failed to update table status'),
  });

  const createTableMutation = useMutation({
    mutationFn: async (table: any) =>
      api.tables.create({
        table_number: table.table_number,
        section: table.section,
        capacity: table.capacity,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tables'] }),
  });

  /* ── handlers ── */
  const handleServerSelect = (name: string) => {
    setServerName(name);
    setStep('table');
  };

  const handleTableSelect = async (table: any) => {
    let tableToSelect = table;

    if (table.isVirtual) {
      try {
        tableToSelect = await createTableMutation.mutateAsync(table);
      } catch {
        toast.error('Failed to initialize table');
        return;
      }
    }

    const tableIdVal = tableToSelect.id || tableToSelect.table_id;
    const isOccupied = ongoingOrders.some((o: any) => o.table_id === tableIdVal);

    if (isOccupied) {
      setTableId(tableIdVal);
      setOrderType('dine_in');
      onClose();
      toast.success(`Table ${tableToSelect.table_number} loaded`);
      return;
    }

    if (tableToSelect.status !== 'available' && tableToSelect.status !== 'occupied') return;

    setTableId(tableIdVal);
    setOrderType('dine_in');
    onClose();
    toast.success(`Table ${tableToSelect.table_number} selected`);

    if (tableToSelect.status === 'available') {
      updateStatusMutation.mutate({ id: tableIdVal, status: 'occupied' });
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
    if (table.isVirtual) return;
    updateStatusMutation.mutate({ id: table.id || table.table_id, status: 'available' });
    toast.success(`Table ${table.table_number} is now available`);
  };

  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'available': return 'border-emerald-500 bg-emerald-50 hover:bg-emerald-100 text-emerald-700';
      case 'occupied':  return 'border-red-500 bg-red-50 text-red-700';
      case 'reserved':  return 'border-amber-500 bg-amber-50 text-amber-700';
      case 'cleaning':  return 'border-gray-400 bg-gray-50 text-gray-500';
      default:          return 'border-gray-200';
    }
  };

  /* ── filter tabs ── */
  const filterTabs: { key: TableSection | 'all'; label: string; icon: React.ReactNode }[] = [
    { key: 'all',     label: 'All Tables', icon: null },
    { key: 'indoor',  label: 'Indoor',     icon: <Home className="w-3.5 h-3.5" /> },
    { key: 'outdoor', label: 'Outdoor',    icon: <TreePine className="w-3.5 h-3.5" /> },
  ];

  /* ── counts for badges ── */
  const sectionCounts = useMemo(() => {
    const countFor = (section: TableSection) => {
      const { count } = SECTION_CONFIG[section];
      return count;
    };
    return {
      all:     SECTION_CONFIG.indoor.count + SECTION_CONFIG.outdoor.count,
      indoor:  countFor('indoor'),
      outdoor: countFor('outdoor'),
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[900px] w-[96vw] max-h-[92vh] p-0 overflow-hidden bg-background rounded-[2.5rem] shadow-2xl border-none"
        aria-describedby="table-selection-description"
      >
        <div className="flex flex-col h-full max-h-[92vh]">

          {/* ── Header ── */}
          <div className="p-7 pb-4 bg-slate-50/60 border-b border-slate-100 relative">
            <div className="flex justify-between items-start">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-3xl font-black font-heading uppercase tracking-tight text-slate-900">
                  {step === 'server' ? 'Select Server' : 'Choose Table'}
                </DialogTitle>
                <DialogDescription
                  id="table-selection-description"
                  className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]"
                >
                  {step === 'server'
                    ? 'Step 1 of 2 · Assign a server'
                    : `Step 2 of 2 · Indoor: 16 tables (6 chairs) · Outdoor: 8 tables (8 chairs)`}
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
                    ← Back
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

            {/* Step progress dots */}
            <div className="flex items-center gap-2 mt-4">
              <div className={cn('h-1.5 rounded-full transition-all duration-300', step === 'server' ? 'w-8 bg-slate-900' : 'w-4 bg-slate-300')} />
              <div className={cn('h-1.5 rounded-full transition-all duration-300', step === 'table'  ? 'w-8 bg-slate-900' : 'w-4 bg-slate-300')} />
            </div>
          </div>

          {/* ── Body ── */}
          <div className="px-7 pb-7 pt-5 overflow-y-auto flex-1">

            {/* ══ STEP 1: Server Selection ══ */}
            {step === 'server' && (
              <div className="space-y-5 py-2">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">
                  Tap a server to continue
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {serverList.map((name) => (
                    <Button
                      key={name}
                      variant={serverName === name ? 'default' : 'outline'}
                      onClick={() => handleServerSelect(name)}
                      className={cn(
                        'rounded-3xl text-sm font-black font-heading uppercase tracking-wider transition-all h-28 border-2 flex flex-col gap-3 shadow-sm',
                        serverName === name
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.04] z-10'
                          : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300 hover:shadow-md hover:scale-[1.02]'
                      )}
                    >
                      <UserCircle2 className={cn('w-7 h-7', serverName === name ? 'text-blue-400' : 'text-slate-300')} />
                      {name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* ══ STEP 2: Table Selection ══ */}
            {step === 'table' && (
              <div className="space-y-5">

                {/* Filter Tabs */}
                <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl sticky top-0 z-20">
                  {filterTabs.map(({ key, label, icon }) => (
                    <Button
                      key={key}
                      variant={activeFilter === key ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveFilter(key as TableSection | 'all')}
                      className={cn(
                        'flex-1 rounded-xl text-[10px] font-black font-heading uppercase tracking-widest h-10 transition-all gap-1.5',
                        activeFilter === key
                          ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/50'
                      )}
                    >
                      {icon}
                      {label}
                      <span className={cn(
                        'ml-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold',
                        activeFilter === key ? 'bg-slate-100 text-slate-600' : 'bg-slate-200/50 text-slate-400'
                      )}>
                        {key === 'all' ? sectionCounts.all : sectionCounts[key as TableSection]}
                      </span>
                    </Button>
                  ))}
                </div>

                {/* Section headers + grids */}
                <div className="min-h-[300px]">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                      <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                      <span className="text-xs font-black uppercase tracking-widest">Loading tables...</span>
                    </div>
                  ) : (
                    <>
                      {/* When "all" is selected, render each section with its own header */}
                      {activeFilter === 'all' ? (
                        <div className="space-y-7">
                          {(['indoor', 'outdoor'] as TableSection[]).map((section) => {
                            const { label, capacity } = SECTION_CONFIG[section];
                            const Icon = section === 'indoor' ? Home : TreePine;
                            const sectionTables = displayTables.filter((t) => t.section === section);
                            return (
                              <div key={section}>
                                {/* Section header */}
                                <div className="flex items-center gap-2 mb-3">
                                  <div className={cn(
                                    'flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest',
                                    section === 'indoor' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                                  )}>
                                    <Icon className="w-3 h-3" />
                                    {label}
                                  </div>
                                  <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">
                                    {SECTION_CONFIG[section].count} tables · {capacity} chairs each
                                  </span>
                                </div>
                                <TableGrid
                                  tables={sectionTables}
                                  ongoingOrders={ongoingOrders}
                                  getStatusColor={getStatusColor}
                                  onSelect={handleTableSelect}
                                  onClear={handleClearTable}
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Single-section view */
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className={cn(
                              'flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest',
                              activeFilter === 'indoor' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                            )}>
                              {activeFilter === 'indoor' ? <Home className="w-3 h-3" /> : <TreePine className="w-3 h-3" />}
                              {SECTION_CONFIG[activeFilter].label}
                            </div>
                            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">
                              {SECTION_CONFIG[activeFilter].count} tables · {SECTION_CONFIG[activeFilter].capacity} chairs each
                            </span>
                          </div>
                          <TableGrid
                            tables={displayTables}
                            ongoingOrders={ongoingOrders}
                            getStatusColor={getStatusColor}
                            onSelect={handleTableSelect}
                            onClear={handleClearTable}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="flex flex-col gap-4 pt-5 border-t border-slate-100">
                  {/* Legend */}
                  <div className="flex items-center justify-center gap-8 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Available
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" /> Occupied
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Reserved
                    </div>
                  </div>

                  {/* Actions */}
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
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Server</span>
                        <div className="flex items-center gap-2">
                          <UserCircle2 className="w-4 h-4 text-blue-400" />
                          <span className="text-white font-black uppercase tracking-widest text-xs">{serverName}</span>
                        </div>
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

/* ── Reusable Table Grid Sub-Component ── */
interface TableGridProps {
  tables: any[];
  ongoingOrders: any[];
  getStatusColor: (status: TableStatus) => string;
  onSelect: (table: any) => void;
  onClear: (e: React.MouseEvent, table: any) => void;
}

type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';

const TableGrid = ({ tables, ongoingOrders, getStatusColor, onSelect, onClear }: TableGridProps) => (
  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 pb-2">
    {tables.map((table: any) => {
      const tableIdVal = table.id || table.table_id;
      const isOccupied = tableIdVal
        ? ongoingOrders.some((o: any) => o.table_id === tableIdVal)
        : false;
      const status: TableStatus = isOccupied ? 'occupied' : table.status;

      return (
        <div
          key={`${table.section}-${table.table_number}`}
          onClick={() => onSelect(table)}
          className={cn(
            'relative border-2 rounded-2xl p-3 flex flex-col items-center justify-center gap-1 transition-all duration-200 group cursor-pointer',
            'h-24 shadow-sm',
            getStatusColor(status),
            'hover:-translate-y-1 hover:shadow-xl hover:border-blue-400'
          )}
        >
          <span className="text-xl font-black font-heading tracking-tighter">{table.table_number}</span>
          <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider opacity-60">
            <Users className="w-2.5 h-2.5" />
            <span>{table.capacity}</span>
          </div>
          <div className={cn(
            'text-[7px] uppercase tracking-[0.15em] font-black px-2 py-0.5 rounded-full mt-0.5',
            status === 'available' ? 'bg-emerald-500/10 text-emerald-600' :
            status === 'occupied'  ? 'bg-red-500/10 text-red-600'         :
            status === 'reserved'  ? 'bg-amber-500/10 text-amber-600'     :
                                     'bg-slate-900/10 text-slate-500'
          )}>
            {status}
          </div>

          {status !== 'available' && !table.isVirtual && (
            <Button
              size="icon"
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg z-10 scale-0 group-hover:scale-100 transition-all duration-200"
              onClick={(e) => onClear(e, table)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      );
    })}
  </div>
);

export default TableSelectionModal;
