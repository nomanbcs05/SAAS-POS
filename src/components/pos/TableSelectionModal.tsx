import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { api } from '@/services/api';
import { useCartStore } from '@/stores/cartStore';
import { toast } from 'sonner';
import { Users, X, UserCircle2, TreePine, Home, Plus, Trash2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMultiTenant } from '@/hooks/useMultiTenant';

interface TableSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
type TableSection = 'indoor' | 'outdoor' | 'vip';

const SECTION_CONFIG: Record<TableSection, { count: number; capacity: number; label: string }> = {
  indoor:  { count: 16, capacity: 6, label: 'Indoor'  },
  outdoor: { count: 8,  capacity: 8, label: 'Outdoor' },
  vip:     { count: 4,  capacity: 10, label: 'VIP'    },
};

const TableSelectionModal = ({ isOpen, onClose }: TableSelectionModalProps) => {
  const { tenant, isAdmin } = useMultiTenant();
  const [step, setStep] = useState<'server' | 'table'>('server');
  const [activeFilter, setActiveFilter] = useState<TableSection | 'all'>('all');
  const [serverList, setServerList] = useState<string[]>([]);
  const { setTableId, setOrderType, serverName, setServerName } = useCartStore();
  const queryClient = useQueryClient();

  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [newTableSection, setNewTableSection] = useState<TableSection>('indoor');
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('6');
  const [newServerName, setNewServerName] = useState('');
  const [isAddingServer, setIsAddingServer] = useState(false);

  const { data: dbWaiters = [] } = useQuery({
    queryKey: ['waiters'],
    queryFn: api.staff.getWaiters,
    enabled: isOpen,
  });

  const displayServers = useMemo(() => {
    return dbWaiters.map((w: any) => (w.name || '').toUpperCase()).filter(Boolean);
  }, [dbWaiters]);

  useEffect(() => {
    if (isOpen) {
      setStep('server');
      setActiveFilter('all');
    }
  }, [isOpen]);

  const handleAddServer = async () => {
    const trimmed = newServerName.trim();
    if (!trimmed) return;
    if (displayServers.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Server already exists');
      return;
    }
    try {
      await api.staff.create({ name: trimmed, role: 'waiter' });
      queryClient.invalidateQueries({ queryKey: ['waiters'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff-db'] });
      setNewServerName('');
      setIsAddingServer(false);
      toast.success(`${trimmed} added as server`);
    } catch {
      toast.error('Failed to add server');
    }
  };

  const handleRemoveServer = async (name: string) => {
    const matched = dbWaiters.find((w: any) => (w.name || '').toLowerCase() === name.toLowerCase());
    if (matched && matched.id) {
      try {
        await api.staff.delete(matched.id);
        queryClient.invalidateQueries({ queryKey: ['waiters'] });
        queryClient.invalidateQueries({ queryKey: ['staff'] });
        queryClient.invalidateQueries({ queryKey: ['staff-db'] });
        toast.success(`${name} removed`);
      } catch {
        toast.error(`Failed to remove ${name}`);
      }
    }
  };

  const { data: dbTables = [], isLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: api.tables.getAll,
    enabled: isOpen,
  });

  const { data: ongoingOrders = [] } = useQuery({
    queryKey: ['ongoing-orders'],
    queryFn: api.orders.getOngoing,
    enabled: isOpen,
  });

  const displayTables = useMemo(() => {
    let list = [...dbTables];
    if (activeFilter !== 'all') {
      list = list.filter((t: any) => (t.section || 'indoor').toLowerCase() === activeFilter);
    }
    // Sort tables logically by number
    list.sort((a: any, b: any) => {
      const numA = parseInt(String(a.table_number).replace(/\D/g, '') || '0', 10);
      const numB = parseInt(String(b.table_number).replace(/\D/g, '') || '0', 10);
      if (numA !== numB) return numA - numB;
      return String(a.table_number).localeCompare(String(b.table_number));
    });
    return list;
  }, [dbTables, activeFilter]);

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
        capacity: Number(table.capacity) || 6,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast.success('Table added successfully');
      setIsAddTableOpen(false);
      setNewTableNumber('');
    },
    onError: () => toast.error('Failed to create table'),
  });

  const deleteTableMutation = useMutation({
    mutationFn: async (id: string) => api.tables.delete(id),
    onSuccess: (_, targetId) => {
      queryClient.setQueryData(['tables'], (old: any[]) =>
        (old || []).filter((t: any) =>
          t.id !== targetId &&
          t.table_number !== targetId &&
          String(t.id) !== String(targetId) &&
          String(t.table_number) !== String(targetId)
        )
      );
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast.success('Table removed successfully');
    },
    onError: () => toast.error('Failed to delete table'),
  });

  const deleteAllTablesMutation = useMutation({
    mutationFn: async () => api.tables.deleteAll(),
    onSuccess: () => {
      queryClient.setQueryData(['tables'], []);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast.success('All tables removed successfully');
    },
    onError: () => toast.error('Failed to remove tables'),
  });

  const handleClearAllTables = () => {
    if (window.confirm('Are you sure you want to remove ALL tables from Dine In?')) {
      deleteAllTablesMutation.mutate();
    }
  };

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

    const tableIdVal = tableToSelect.id || tableToSelect.table_id || tableToSelect.table_number;
    const isOccupied = ongoingOrders.some((o: any) => o.table_id === tableIdVal || o.table_id === tableToSelect.table_number);

    if (isOccupied) {
      setTableId(tableIdVal);
      setOrderType('dine_in');
      onClose();
      toast.success(`Table ${tableToSelect.table_number} loaded`);
      return;
    }

    setTableId(tableIdVal);
    setOrderType('dine_in');
    onClose();
    toast.success(`Table ${tableToSelect.table_number} selected`);
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

  const handleDeleteTable = (e: React.MouseEvent, table: any) => {
    e.stopPropagation();
    const tableId = table.id || table.table_id || table.table_number;
    if (window.confirm(`Delete table ${table.table_number} from ${String(table.section || 'indoor').toUpperCase()}?`)) {
      deleteTableMutation.mutate(tableId);
    }
  };

  const handleOpenAddModal = () => {
    if (activeFilter !== 'all') {
      setNewTableSection(activeFilter);
    }
    const maxNum = displayTables.reduce((max, t) => {
      const n = parseInt(String(t.table_number).replace(/\D/g, ''), 10);
      return !isNaN(n) && n > max ? n : max;
    }, 0);
    setNewTableNumber((maxNum + 1).toString());
    setIsAddTableOpen(true);
  };

  const handleCreateNewTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber.trim()) {
      toast.error('Table number is required');
      return;
    }
    createTableMutation.mutate({
      table_number: newTableNumber.trim(),
      section: newTableSection,
      capacity: Number(newTableCapacity) || 6,
    });
  };

  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'available': return 'border-emerald-500 bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-800';
      case 'occupied':  return 'border-red-500 bg-red-50/90 text-red-800';
      case 'reserved':  return 'border-amber-500 bg-amber-50 text-amber-800';
      case 'cleaning':  return 'border-gray-400 bg-gray-50 text-gray-600';
      default:          return 'border-gray-200';
    }
  };

  const filterTabs: { key: TableSection | 'all'; label: string; icon: React.ReactNode }[] = [
    { key: 'all',     label: 'All Tables', icon: null },
    { key: 'indoor',  label: 'Indoor',     icon: <Home className="w-3.5 h-3.5" /> },
    { key: 'outdoor', label: 'Outdoor',    icon: <TreePine className="w-3.5 h-3.5" /> },
    { key: 'vip',     label: 'VIP',        icon: <Users className="w-3.5 h-3.5" /> },
  ];

  const sectionCounts = useMemo(() => {
    const countSec = (sec: TableSection) => displayTables.filter(t => t.section === sec).length;
    return {
      all: displayTables.length,
      indoor: countSec('indoor'),
      outdoor: countSec('outdoor'),
      vip: countSec('vip'),
    };
  }, [displayTables]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="max-w-[950px] w-[96vw] max-h-[94vh] p-0 overflow-hidden bg-background rounded-[2.5rem] shadow-2xl border-none"
          aria-describedby={undefined}
        >
          <div className="flex flex-col h-full max-h-[94vh]">
            <div className="p-6 pb-4 bg-slate-50 border-b border-slate-100 relative">
              <div className="flex justify-between items-start">
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-3xl font-black font-heading uppercase tracking-tight text-slate-900">
                    {step === 'server' ? 'Select Server' : 'Choose Table'}
                  </DialogTitle>
                  <DialogDescription
                    id="table-selection-description"
                    className="text-[11px] font-bold text-slate-500 uppercase tracking-widest"
                  >
                    {step === 'server'
                      ? 'Step 1 of 2 · Select assigned server'
                      : `Indoor: 1-16 · Outdoor: 17-24 (Sequential) · VIP: 25-28`}
                  </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-2">
                  {step === 'table' && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleOpenAddModal}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl h-9 px-3 gap-1 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Table
                      </Button>
                      {dbTables.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearAllTables}
                          className="text-red-600 border-red-200 hover:bg-red-50 text-[10px] font-black uppercase tracking-wider rounded-xl h-9 px-3 gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove All
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStep('server')}
                        className="text-[10px] h-9 px-3 font-black font-heading uppercase tracking-widest border-slate-200 bg-white text-slate-700 rounded-xl"
                      >
                        ← Back
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-9 w-9 rounded-full hover:bg-slate-200"
                  >
                    <X className="h-5 w-5 text-slate-500" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <div className={cn('h-1.5 rounded-full transition-all duration-300', step === 'server' ? 'w-8 bg-slate-900' : 'w-4 bg-slate-300')} />
                <div className={cn('h-1.5 rounded-full transition-all duration-300', step === 'table'  ? 'w-8 bg-slate-900' : 'w-4 bg-slate-300')} />
              </div>
            </div>

            <div className="px-6 pb-6 pt-4 overflow-y-auto flex-1">
              {step === 'server' && (
                <div className="space-y-5 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">
                      Select a server to continue
                    </p>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsAddingServer(v => !v)}
                        className="h-8 px-3 text-[10px] font-black uppercase tracking-wider rounded-xl border-dashed border-slate-300 text-slate-500 hover:text-slate-900 hover:border-slate-400 gap-1.5"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Manage Servers
                      </Button>
                    )}
                  </div>

                  {/* Add server inline form */}
                  {isAddingServer && isAdmin && (
                    <div className="flex gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                      <Input
                        value={newServerName}
                        onChange={e => setNewServerName(e.target.value)}
                        placeholder="Server name (e.g. Ahmed)"
                        className="flex-1 h-10 text-sm font-semibold rounded-xl border-slate-200"
                        onKeyDown={e => e.key === 'Enter' && handleAddServer()}
                        autoFocus
                      />
                      <Button
                        onClick={handleAddServer}
                        className="h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase rounded-xl"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {displayServers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                      <UserCircle2 className="w-12 h-12 text-slate-200" />
                      <p className="text-xs font-black uppercase tracking-widest">No servers added yet</p>
                      {isAdmin && (
                        <p className="text-[11px] text-slate-400">Click "Manage Servers" above to add servers</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {displayServers.map((name) => (
                        <div key={name} className="relative group">
                          <Button
                            variant={serverName === name ? 'default' : 'outline'}
                            onClick={() => handleServerSelect(name)}
                            className={cn(
                              'w-full rounded-3xl text-sm font-black font-heading uppercase tracking-wider transition-all h-28 border-2 flex flex-col gap-3 shadow-sm',
                              serverName === name
                                ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.04] z-10'
                                : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300 hover:shadow-md hover:scale-[1.02]'
                            )}
                          >
                            <UserCircle2 className={cn('w-7 h-7', serverName === name ? 'text-blue-400' : 'text-slate-300')} />
                            {name}
                          </Button>
                          {isAdmin && isAddingServer && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveServer(name); }}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg z-20 transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {step === 'table' && (
                <div className="space-y-5">
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
                          {sectionCounts[key as TableSection]}
                        </span>
                      </Button>
                    ))}
                  </div>

                  <div className="min-h-[300px]">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                        <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                        <span className="text-xs font-black uppercase tracking-widest">Loading tables...</span>
                      </div>
                    ) : (
                      <TableGrid
                        tables={displayTables}
                        ongoingOrders={ongoingOrders}
                        getStatusColor={getStatusColor}
                        onSelect={handleTableSelect}
                        onClear={handleClearTable}
                        onDelete={handleDeleteTable}
                        onAddTable={handleOpenAddModal}
                      />
                    )}
                  </div>

                  <div className="flex flex-col gap-4 pt-4 border-t border-slate-100">
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

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={handleSkipTable}
                        className="flex-1 h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest border-2 border-slate-100 text-slate-400 hover:text-slate-900"
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

      <Dialog open={isAddTableOpen} onOpenChange={setIsAddTableOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase">Add New Table</DialogTitle>
            <DialogDescription>Create a new table for Indoor, Outdoor, or VIP section.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateNewTable} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase">Section</Label>
              <Select value={newTableSection} onValueChange={(val: any) => setNewTableSection(val)}>
                <SelectTrigger className="h-11 font-bold">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="indoor">Indoor (Main Hall)</SelectItem>
                  <SelectItem value="outdoor">Outdoor (Lawn / Terrace)</SelectItem>
                  <SelectItem value="vip">VIP Lounge</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase">Table Number / Name</Label>
              <Input
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
                placeholder="e.g. 25 or T25"
                className="h-11 font-bold"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase">Seating Capacity (Chairs)</Label>
              <Input
                type="number"
                value={newTableCapacity}
                onChange={(e) => setNewTableCapacity(e.target.value)}
                placeholder="6"
                className="h-11 font-bold"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddTableOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 font-bold uppercase">Save Table</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface TableGridProps {
  tables: any[];
  ongoingOrders: any[];
  getStatusColor: (status: TableStatus) => string;
  onSelect: (table: any) => void;
  onClear: (e: React.MouseEvent, table: any) => void;
  onDelete: (e: React.MouseEvent, table: any) => void;
  onAddTable: () => void;
}

const TableGrid = ({ tables, ongoingOrders, getStatusColor, onSelect, onClear, onDelete, onAddTable }: TableGridProps) => (
  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 pb-2">
    {tables.map((table: any) => {
      const tableIdVal = table.id || table.table_id || table.table_number;
      const isOccupied = ongoingOrders.some(
        (o: any) => o.table_id === tableIdVal || o.table_id === table.table_number
      );
      const status: TableStatus = isOccupied ? 'occupied' : table.status;
      const sec = (table.section || 'indoor').toLowerCase();

      return (
        <div
          key={`${table.section}-${table.table_number}`}
          onClick={() => onSelect(table)}
          className={cn(
            'relative border-2 rounded-2xl p-2.5 flex flex-col items-center justify-between transition-all duration-200 group cursor-pointer',
            'h-28 shadow-sm',
            getStatusColor(status),
            'hover:-translate-y-1 hover:shadow-xl hover:border-blue-500'
          )}
        >
          <div className={cn(
            'text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1',
            sec === 'indoor' ? 'bg-blue-600 text-white' :
            sec === 'outdoor' ? 'bg-emerald-600 text-white' :
            'bg-purple-600 text-white'
          )}>
            {sec === 'indoor' ? <Home className="w-2.5 h-2.5" /> : (sec === 'outdoor' ? <TreePine className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />)}
            {sec}
          </div>

          <span className="text-xl font-black font-heading tracking-tight text-slate-900 mt-1">
            {table.table_number.startsWith('T') || table.table_number.startsWith('O') || table.table_number.startsWith('V')
              ? table.table_number
              : `Table ${table.table_number}`}
          </span>

          <div className="flex items-center justify-between w-full mt-1">
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-slate-600">
              <Users className="w-2.5 h-2.5" />
              <span>{table.capacity} Seats</span>
            </div>

            <div className={cn(
              'text-[7px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-md',
              status === 'available' ? 'bg-emerald-500/20 text-emerald-700' :
              status === 'occupied'  ? 'bg-red-500/20 text-red-700 font-extrabold' :
              status === 'reserved'  ? 'bg-amber-500/20 text-amber-700' :
                                       'bg-slate-900/20 text-slate-700'
            )}>
              {status}
            </div>
          </div>

          <div className="absolute -top-2 -right-2 flex gap-1 scale-0 group-hover:scale-100 transition-all duration-200 z-20">
            {status !== 'available' && !table.isVirtual && (
              <Button
                size="icon"
                variant="destructive"
                className="h-6 w-6 rounded-full shadow-lg"
                title="Clear Status"
                onClick={(e) => onClear(e, table)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            <Button
              size="icon"
              variant="outline"
              className="h-6 w-6 rounded-full bg-red-600 hover:bg-red-700 text-white border-none shadow-lg"
              title="Delete Table"
              onClick={(e) => onDelete(e, table)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      );
    })}

    {/* + Add Table Card */}
    <div
      onClick={onAddTable}
      className={cn(
        'border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/50',
        'rounded-2xl p-2.5 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer',
        'h-28 shadow-sm hover:-translate-y-1 hover:shadow-lg group'
      )}
    >
      <div className="w-9 h-9 rounded-full bg-slate-200 group-hover:bg-emerald-600 flex items-center justify-center transition-colors">
        <Plus className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
      </div>
      <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 group-hover:text-emerald-700 mt-2">
        + Add Table
      </span>
    </div>
  </div>
);

export default TableSelectionModal;
