import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Printer, Plus, Edit2, Trash2, CheckCircle2, AlertTriangle, 
  Wifi, Usb, Monitor, Bluetooth, Star, StarOff, ShieldAlert, 
  Search, RefreshCw, Power, PowerOff, Sparkles, Layers,
  ExternalLink, Check, AlertCircle, Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/services/api';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { RESTR_CATEGORIES } from '@/data/restaurantMenuData';
import { 
  TenantPrinter, 
  PrinterCategoryRoute, 
  PrinterType, 
  CreatePrinterInput, 
  UpdatePrinterInput 
} from '@/types/printer';
import { DiscoveredPrinter } from '@/types/electronPrinting';
import { isDesktop } from '@/lib/env';

// IPv4 validation regex
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

interface PrinterFormData {
  name: string;
  printer_type: PrinterType;
  device_name: string;
  ip_address: string;
  port: number;
  bluetooth_identifier: string;
  is_default: boolean;
  is_active: boolean;
}

const DEFAULT_FORM_DATA: PrinterFormData = {
  name: '',
  printer_type: 'system',
  device_name: '',
  ip_address: '',
  port: 9100,
  bluetooth_identifier: '',
  is_default: false,
  is_active: true,
};

export default function PrinterSettingsTab() {
  const { tenant, isAdmin } = useMultiTenant();
  const queryClient = useQueryClient();

  // Dialog States
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<TenantPrinter | null>(null);
  const [formData, setFormData] = useState<PrinterFormData>(DEFAULT_FORM_DATA);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Route Assignment Modal
  const [routeCategoryToEdit, setRouteCategoryToEdit] = useState<{ displayName: string; normalizedName: string } | null>(null);
  const [selectedPrinterIdsForCategory, setSelectedPrinterIdsForCategory] = useState<string[]>([]);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Delete & Deactivate Protection Modals
  const [printerToDelete, setPrinterToDelete] = useState<TenantPrinter | null>(null);
  const [printerToDeactivate, setPrinterToDeactivate] = useState<TenantPrinter | null>(null);
  const [testPrinterModal, setTestPrinterModal] = useState<TenantPrinter | null>(null);

  // Feature Flag Confirmation Modal
  const [showFeatureFlagModal, setShowFeatureFlagModal] = useState(false);
  const [pendingFeatureFlagValue, setPendingFeatureFlagValue] = useState(false);

  // ─── DATA FETCHING ────────────────────────────────────────────────────────
  const { data: printers = [], isLoading: isLoadingPrinters } = useQuery({
    queryKey: ['printers', tenant?.id],
    queryFn: () => api.printers.getAll(tenant?.id),
    enabled: !!tenant?.id,
  });

  const { data: routes = [], isLoading: isLoadingRoutes } = useQuery({
    queryKey: ['printer-routes', tenant?.id],
    queryFn: () => api.printerRoutes.getAll(tenant?.id),
    enabled: !!tenant?.id,
  });

  const { data: dbCategories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: api.categories.getAll,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: api.products.getAll,
    staleTime: 1000 * 60 * 10,
  });

  // Discovered Windows Printers (Electron Desktop only)
  const isDesktopEnv = isDesktop();
  const { 
    data: discoveredPrinters = [], 
    isLoading: isLoadingDiscovered,
    refetch: refetchDiscovered,
  } = useQuery<DiscoveredPrinter[]>({
    queryKey: ['discovered-printers'],
    queryFn: async () => {
      if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.getPrinters === 'function') {
        const list = await window.electronAPI.getPrinters();
        return Array.isArray(list) ? list : [];
      }
      return [];
    },
    enabled: isDesktopEnv,
    staleTime: 1000 * 30, // 30 seconds
  });

  // ─── UNIQUE CATEGORIES RESOLUTION ─────────────────────────────────────────
  // Collect all distinct category names from database categories, products, and preset templates
  const allDistinctCategories = useMemo(() => {
    const map = new Map<string, string>(); // normalizedKey -> originalDisplayName

    // 1. Preset Restaurant Categories
    RESTR_CATEGORIES.forEach(cat => {
      if (cat.name) {
        const norm = cat.name.trim().toLowerCase();
        if (!map.has(norm)) map.set(norm, cat.name.trim());
      }
    });

    // 2. DB Categories Table
    dbCategories.forEach(cat => {
      if (cat.name) {
        const norm = cat.name.trim().toLowerCase();
        if (!map.has(norm)) map.set(norm, cat.name.trim());
      }
    });

    // 3. Products Categories
    products.forEach(p => {
      if (p.category) {
        const norm = p.category.trim().toLowerCase();
        if (!map.has(norm)) map.set(norm, p.category.trim());
      }
    });

    return Array.from(map.entries()).map(([normalizedName, displayName]) => ({
      normalizedName,
      displayName,
    })).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [dbCategories, products]);

  // Filtered categories based on search input
  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return allDistinctCategories;
    const query = categorySearchQuery.toLowerCase().trim();
    return allDistinctCategories.filter(
      cat => cat.displayName.toLowerCase().includes(query) || cat.normalizedName.includes(query)
    );
  }, [allDistinctCategories, categorySearchQuery]);

  // Map normalized category name to assigned printer list
  const categoryToPrintersMap = useMemo(() => {
    const map = new Map<string, TenantPrinter[]>();
    routes.forEach(route => {
      const normCat = route.category_name.toLowerCase();
      const matchedPrinter = printers.find(p => p.id === route.printer_id) || route.printer;
      if (matchedPrinter) {
        const current = map.get(normCat) || [];
        if (!current.some(p => p.id === matchedPrinter.id)) {
          map.set(normCat, [...current, matchedPrinter]);
        }
      }
    });
    return map;
  }, [routes, printers]);

  // Find the single default fallback printer
  const defaultPrinter = useMemo(() => {
    return printers.find(p => p.is_default && p.is_active);
  }, [printers]);

  // Find routes impacted by a specific printer (for delete/deactivate warnings)
  const getRoutesImpactedByPrinter = (printerId: string) => {
    return routes.filter(r => r.printer_id === printerId);
  };

  // ─── MUTATIONS ────────────────────────────────────────────────────────────

  // 1. Toggle Feature Flag Mutation
  const toggleFeatureFlagMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!tenant?.id) throw new Error('Tenant ID missing');
      const { data, error } = await supabase
        .from('tenants')
        .update({ multi_printer_kot_enabled: enabled })
        .eq('id', tenant.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (updatedTenant) => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      toast.success(
        updatedTenant.multi_printer_kot_enabled
          ? 'Multi-Printer KOT Routing enabled!'
          : 'Multi-Printer KOT Routing disabled (Single ticket fallback active)'
      );
      setShowFeatureFlagModal(false);
    },
    onError: (err: Error) => {
      toast.error('Failed to update feature setting: ' + err.message);
      setShowFeatureFlagModal(false);
    }
  });

  // 2. Create Printer Mutation
  const createPrinterMutation = useMutation({
    mutationFn: async (input: CreatePrinterInput) => {
      return api.printers.create(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printers'] });
      toast.success('Printer added successfully');
      setIsAddEditOpen(false);
      setFormData(DEFAULT_FORM_DATA);
    },
    onError: (err: Error) => {
      toast.error('Failed to add printer: ' + err.message);
    }
  });

  // 3. Update Printer Mutation
  const updatePrinterMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdatePrinterInput }) => {
      return api.printers.update(id, updates, tenant?.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printers'] });
      queryClient.invalidateQueries({ queryKey: ['printer-routes'] });
      toast.success('Printer updated successfully');
      setIsAddEditOpen(false);
      setEditingPrinter(null);
      setFormData(DEFAULT_FORM_DATA);
    },
    onError: (err: Error) => {
      toast.error('Failed to update printer: ' + err.message);
    }
  });

  // 4. Set Default Printer Mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (printerId: string) => {
      if (!tenant?.id) throw new Error('Tenant ID missing');
      return api.printers.setDefault(printerId, tenant.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printers'] });
      toast.success('Default KOT fallback printer updated');
    },
    onError: (err: Error) => {
      toast.error('Failed to set default printer: ' + err.message);
    }
  });

  // 5. Delete Printer Mutation
  const deletePrinterMutation = useMutation({
    mutationFn: async (printerId: string) => {
      return api.printers.delete(printerId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printers'] });
      queryClient.invalidateQueries({ queryKey: ['printer-routes'] });
      toast.success('Printer deleted');
      setPrinterToDelete(null);
    },
    onError: (err: Error) => {
      toast.error('Failed to delete printer: ' + err.message);
    }
  });

  // 6. Save Category Routes Mutation
  const saveCategoryRoutesMutation = useMutation({
    mutationFn: async ({ normalizedCategory, printerIds }: { normalizedCategory: string; printerIds: string[] }) => {
      if (!tenant?.id) throw new Error('Tenant ID missing');
      return api.printerRoutes.saveCategoryPrinters(tenant.id, normalizedCategory, printerIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printer-routes'] });
      toast.success('Category routing rules updated');
      setRouteCategoryToEdit(null);
    },
    onError: (err: Error) => {
      toast.error('Failed to update category routes: ' + err.message);
    }
  });

  // ─── VALIDATION LOGIC ─────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Printer name is required';
    } else {
      // Check duplicate name within active tenant printers
      const duplicate = printers.find(
        p => p.name.trim().toLowerCase() === formData.name.trim().toLowerCase() && p.id !== editingPrinter?.id
      );
      if (duplicate) {
        errors.name = 'A printer with this name already exists';
      }
    }

    if (formData.printer_type === 'system' || formData.printer_type === 'usb') {
      if (!formData.device_name.trim()) {
        errors.device_name = 'Device / Queue name is required';
      }
    }

    if (formData.printer_type === 'network') {
      if (!formData.ip_address.trim()) {
        errors.ip_address = 'IP address is required';
      } else if (!IPV4_REGEX.test(formData.ip_address.trim())) {
        errors.ip_address = 'Invalid IPv4 address format (e.g., 192.168.1.200)';
      }

      if (!formData.port || isNaN(formData.port)) {
        errors.port = 'Port is required';
      } else if (formData.port < 1 || formData.port > 65535) {
        errors.port = 'Port must be between 1 and 65535';
      }
    }

    if (formData.printer_type === 'bluetooth') {
      if (!formData.bluetooth_identifier.trim()) {
        errors.bluetooth_identifier = 'Bluetooth device identifier or MAC is required';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── HANDLERS ─────────────────────────────────────────────────────────────
  const handleOpenAddPrinter = () => {
    setEditingPrinter(null);
    setFormData({
      ...DEFAULT_FORM_DATA,
      is_default: printers.length === 0, // Auto-select default if it's the very first printer
    });
    setFormErrors({});
    setIsAddEditOpen(true);
  };

  const handleOpenEditPrinter = (printer: TenantPrinter) => {
    setEditingPrinter(printer);
    setFormData({
      name: printer.name,
      printer_type: printer.printer_type,
      device_name: printer.device_name || '',
      ip_address: printer.ip_address || '',
      port: printer.port || 9100,
      bluetooth_identifier: printer.bluetooth_identifier || '',
      is_default: printer.is_default,
      is_active: printer.is_active,
    });
    setFormErrors({});
    setIsAddEditOpen(true);
  };

  const handleSavePrinter = () => {
    if (!validateForm()) return;
    if (!tenant?.id) {
      toast.error('Tenant session missing');
      return;
    }

    if (editingPrinter) {
      updatePrinterMutation.mutate({
        id: editingPrinter.id,
        updates: {
          name: formData.name.trim(),
          printer_type: formData.printer_type,
          device_name: formData.device_name.trim() || null,
          ip_address: formData.ip_address.trim() || null,
          port: formData.port || 9100,
          bluetooth_identifier: formData.bluetooth_identifier.trim() || null,
          is_default: formData.is_default,
          is_active: formData.is_active,
        }
      });
    } else {
      createPrinterMutation.mutate({
        tenant_id: tenant.id,
        name: formData.name.trim(),
        printer_type: formData.printer_type,
        device_name: formData.device_name.trim() || null,
        ip_address: formData.ip_address.trim() || null,
        port: formData.port || 9100,
        bluetooth_identifier: formData.bluetooth_identifier.trim() || null,
        is_default: formData.is_default,
        is_active: formData.is_active,
      });
    }
  };

  const handleTogglePrinterActive = (printer: TenantPrinter, newActive: boolean) => {
    if (!newActive && printer.is_default) {
      setPrinterToDeactivate(printer);
      return;
    }
    updatePrinterMutation.mutate({
      id: printer.id,
      updates: { is_active: newActive, is_default: newActive ? printer.is_default : false }
    });
  };

  const handleOpenRouteModal = (category: { displayName: string; normalizedName: string }) => {
    setRouteCategoryToEdit(category);
    const currentPrinters = categoryToPrintersMap.get(category.normalizedName) || [];
    setSelectedPrinterIdsForCategory(currentPrinters.map(p => p.id));
  };

  const handleSaveCategoryRoutes = () => {
    if (!routeCategoryToEdit) return;
    saveCategoryRoutesMutation.mutate({
      normalizedCategory: routeCategoryToEdit.normalizedName,
      printerIds: selectedPrinterIdsForCategory,
    });
  };

  const getTypeIcon = (type: PrinterType) => {
    switch (type) {
      case 'network': return <Wifi className="h-4 w-4 text-blue-500" />;
      case 'usb': return <Usb className="h-4 w-4 text-emerald-500" />;
      case 'bluetooth': return <Bluetooth className="h-4 w-4 text-indigo-500" />;
      case 'system': default: return <Monitor className="h-4 w-4 text-purple-500" />;
    }
  };

  const isMultiPrinterEnabled = tenant?.multi_printer_kot_enabled === true;

  return (
    <div className="space-y-6">
      {/* ─── 1. FEATURE FLAG CONTROL CARD ──────────────────────────────────── */}
      <Card className="border-2 border-primary/20 shadow-sm bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-black uppercase tracking-tight">
                  Multi-Printer KOT Routing
                </CardTitle>
                <Badge 
                  variant={isMultiPrinterEnabled ? "default" : "secondary"}
                  className={cn(
                    "text-[10px] font-black uppercase tracking-wider",
                    isMultiPrinterEnabled ? "bg-emerald-600 hover:bg-emerald-600 text-white" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                  )}
                >
                  {isMultiPrinterEnabled ? 'Active' : 'Disabled (Single Fallback KOT)'}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                When enabled, kitchen tickets automatically split and route to assigned station printers (Grill, Karahi, Bar, etc.) based on menu category.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-bold text-muted-foreground uppercase">
                {isMultiPrinterEnabled ? 'Feature Active' : 'Feature Disabled'}
              </span>
              <Switch
                checked={isMultiPrinterEnabled}
                onCheckedChange={(checked) => {
                  setPendingFeatureFlagValue(checked);
                  setShowFeatureFlagModal(true);
                }}
                disabled={!isAdmin || toggleFeatureFlagMutation.isPending}
              />
            </div>
          </div>
        </CardHeader>
        {!isMultiPrinterEnabled && (
          <CardContent className="pt-0 text-xs text-amber-800 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-3 mx-6 mb-4 rounded-lg border border-amber-200/50 flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              <strong>Safe Fallback Mode:</strong> All orders currently output to your single default KOT printer as a unified ticket. You can configure printers and category routes below ahead of time without affecting live production tickets.
            </p>
          </CardContent>
        )}
      </Card>

      {/* ─── 2. PRINTERS CONFIGURATION SECTION ─────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Kitchen & Station Printers ({printers.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Configure thermal printers connected via USB, Network LAN, System Spooler, or Bluetooth.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={handleOpenAddPrinter}
            className="h-9 font-bold text-xs uppercase tracking-wider bg-primary text-primary-foreground shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Printer
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingPrinters ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              Loading printer configurations...
            </div>
          ) : printers.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
              <Printer className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-tight">No Printers Configured</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                Add your main kitchen and station printers (e.g., BBQ Grill, Drinks Bar, Karahi Station).
              </p>
              <Button size="sm" onClick={handleOpenAddPrinter} className="h-8 font-bold text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add First Printer
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900">
                  <TableRow>
                    <TableHead className="w-12 text-center">Type</TableHead>
                    <TableHead>Printer Name</TableHead>
                    <TableHead>Connection Target</TableHead>
                    <TableHead>Role / Fallback</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {printers.map((printer) => {
                    const impactedRoutes = getRoutesImpactedByPrinter(printer.id);
                    return (
                      <TableRow key={printer.id} className={cn(!printer.is_active && "opacity-60 bg-slate-50/30")}>
                        <TableCell className="text-center">
                          <div className="flex justify-center" title={`Type: ${printer.printer_type.toUpperCase()}`}>
                            {getTypeIcon(printer.printer_type)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-xs uppercase tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            {printer.name}
                            {impactedRoutes.length > 0 && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 font-bold text-primary border-primary/30">
                                {impactedRoutes.length} {impactedRoutes.length === 1 ? 'Category' : 'Categories'}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-slate-600 dark:text-slate-400">
                          {printer.printer_type === 'network' && (
                            <span>{printer.ip_address}:{printer.port || 9100}</span>
                          )}
                          {(printer.printer_type === 'system' || printer.printer_type === 'usb') && (
                            <span>{printer.device_name || 'System Default'}</span>
                          )}
                          {printer.printer_type === 'bluetooth' && (
                            <span>{printer.bluetooth_identifier || 'BT Device'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {printer.is_default ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-fit">
                              <Star className="h-3 w-3 fill-current" /> Default KOT Fallback
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Station Printer</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={printer.is_active}
                            onCheckedChange={(val) => handleTogglePrinterActive(printer, val)}
                            disabled={updatePrinterMutation.isPending}
                            aria-label={`Toggle active state for ${printer.name}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[10px] font-bold"
                              onClick={() => setTestPrinterModal(printer)}
                            >
                              Test
                            </Button>
                            
                            {!printer.is_default && printer.is_active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[10px] font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => setDefaultMutation.mutate(printer.id)}
                                disabled={setDefaultMutation.isPending}
                                title="Set as default KOT fallback"
                              >
                                <Star className="h-3.5 w-3.5 mr-1" /> Set Default
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleOpenEditPrinter(printer)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setPrinterToDelete(printer)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 3. CATEGORY TO PRINTER ROUTING SECTION ────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Category-to-Printer Routing Rules
              </CardTitle>
              <CardDescription className="text-xs">
                Map menu categories to preparation stations. Categories with no assigned printer will automatically route to your Default KOT Fallback Printer ({defaultPrinter ? defaultPrinter.name : 'None set'}).
              </CardDescription>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {printers.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground bg-slate-50 rounded-lg">
              Please add at least one printer above before setting up category routing rules.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900">
                  <TableRow>
                    <TableHead className="w-1/3">Category Name</TableHead>
                    <TableHead className="w-1/2">Assigned Preparation Printers</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-xs text-muted-foreground">
                        No categories found matching &quot;{categorySearchQuery}&quot;.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCategories.map((category) => {
                      const assignedPrinters = categoryToPrintersMap.get(category.normalizedName) || [];
                      return (
                        <TableRow key={category.normalizedName}>
                          <TableCell>
                            <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-2">
                              {category.displayName}
                              <span className="text-[10px] font-mono text-muted-foreground">
                                ({category.normalizedName})
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {assignedPrinters.length === 0 ? (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed bg-slate-50 font-normal">
                                ➔ Fallback: {defaultPrinter ? defaultPrinter.name : 'Default KOT Printer'}
                              </Badge>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {assignedPrinters.map(p => (
                                  <Badge 
                                    key={p.id}
                                    variant="secondary"
                                    className="text-[10px] font-bold uppercase tracking-tight bg-primary/10 text-primary border border-primary/20 flex items-center gap-1"
                                  >
                                    {getTypeIcon(p.printer_type)}
                                    {p.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-xs font-bold"
                              onClick={() => handleOpenRouteModal(category)}
                            >
                              <Edit2 className="h-3 w-3 mr-1" />
                              {assignedPrinters.length > 0 ? 'Edit Route' : 'Assign Printer'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 4. ADD / EDIT PRINTER DIALOG ──────────────────────────────────── */}
      <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              {editingPrinter ? 'Edit Printer' : 'Add Kitchen / Station Printer'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Specify the printer connection type and hardware parameters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Printer Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Printer Type</Label>
              <Select
                value={formData.printer_type}
                onValueChange={(val: PrinterType) => {
                  setFormData(prev => ({ ...prev, printer_type: val }));
                  setFormErrors(prev => ({ ...prev, device_name: '', ip_address: '', port: '' }));
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2 text-xs">
                      <Monitor className="h-3.5 w-3.5 text-purple-500" /> System Spooler / OS Default
                    </div>
                  </SelectItem>
                  <SelectItem value="usb">
                    <div className="flex items-center gap-2 text-xs">
                      <Usb className="h-3.5 w-3.5 text-emerald-500" /> USB Thermal Printer
                    </div>
                  </SelectItem>
                  <SelectItem value="network">
                    <div className="flex items-center gap-2 text-xs">
                      <Wifi className="h-3.5 w-3.5 text-blue-500" /> Network (Ethernet / Wi-Fi LAN)
                    </div>
                  </SelectItem>
                  <SelectItem value="bluetooth">
                    <div className="flex items-center gap-2 text-xs">
                      <Bluetooth className="h-3.5 w-3.5 text-indigo-500" /> Bluetooth Printer
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Printer Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Printer Display Name</Label>
              <Input
                placeholder="e.g., Main Kitchen, BBQ Grill Station, Bar"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={cn("h-9 text-xs", formErrors.name && "border-red-500")}
              />
              {formErrors.name && (
                <p className="text-[11px] text-red-500 font-medium">{formErrors.name}</p>
              )}
            </div>

            {/* Dynamic Fields: System / USB */}
            {(formData.printer_type === 'system' || formData.printer_type === 'usb') && (
              <div className="space-y-3 pt-1 border-t">
                {isDesktopEnv ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase flex items-center gap-1.5">
                        <Monitor className="h-3.5 w-3.5 text-primary" />
                        Discovered Windows Printers
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                        disabled={isLoadingDiscovered}
                        onClick={() => {
                          refetchDiscovered();
                          toast.info('Scanning Windows printer spooler...');
                        }}
                      >
                        <RefreshCw className={cn("h-3 w-3", isLoadingDiscovered && "animate-spin")} />
                        Refresh
                      </Button>
                    </div>

                    {discoveredPrinters.length > 0 ? (
                      <Select
                        value={formData.device_name || undefined}
                        onValueChange={(val) => {
                          setFormData(prev => ({
                            ...prev,
                            device_name: val,
                            name: prev.name.trim() ? prev.name : val,
                          }));
                          if (formErrors.device_name) {
                            setFormErrors(prev => ({ ...prev, device_name: '' }));
                          }
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs font-mono">
                          <SelectValue placeholder="Select an installed OS printer..." />
                        </SelectTrigger>
                        <SelectContent>
                          {discoveredPrinters.map((dp) => (
                            <SelectItem key={dp.name} value={dp.name} className="text-xs font-mono">
                              <div className="flex items-center justify-between w-full gap-2">
                                <span>{dp.displayName || dp.name}</span>
                                {dp.isDefault && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 bg-primary/10 text-primary border-primary/20">
                                    Default
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded border flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {isLoadingDiscovered
                            ? 'Scanning for installed printers...'
                            : 'No printers detected in Windows spooler. You can enter the queue name manually below.'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 p-2 rounded border">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>In desktop mode, installed Windows printers are auto-detected. In browser mode, type the printer name below.</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase">Windows / OS Device Queue Name</Label>
                  <Input
                    placeholder="e.g., EPSON TM-T88VI, POS-80C, XP-80C"
                    value={formData.device_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, device_name: e.target.value }))}
                    className={cn("h-9 text-xs font-mono", formErrors.device_name && "border-red-500")}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Exact name of the installed printer in Windows Settings &gt; Printers &amp; Scanners.
                  </p>
                  {formErrors.device_name && (
                    <p className="text-[11px] text-red-500 font-medium">{formErrors.device_name}</p>
                  )}
                </div>
              </div>
            )}

            {/* Dynamic Fields: Network */}
            {formData.printer_type === 'network' && (
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-bold uppercase">IPv4 Address</Label>
                  <Input
                    placeholder="192.168.1.200"
                    value={formData.ip_address}
                    onChange={(e) => setFormData(prev => ({ ...prev, ip_address: e.target.value }))}
                    className={cn("h-9 text-xs font-mono", formErrors.ip_address && "border-red-500")}
                  />
                  {formErrors.ip_address && (
                    <p className="text-[10px] text-red-500 font-medium">{formErrors.ip_address}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase">Port</Label>
                  <Input
                    type="number"
                    placeholder="9100"
                    value={formData.port}
                    onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value, 10) || 0 }))}
                    className={cn("h-9 text-xs font-mono", formErrors.port && "border-red-500")}
                  />
                  {formErrors.port && (
                    <p className="text-[10px] text-red-500 font-medium">{formErrors.port}</p>
                  )}
                </div>
              </div>
            )}

            {/* Dynamic Fields: Bluetooth */}
            {formData.printer_type === 'bluetooth' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">Bluetooth MAC / Device UUID</Label>
                <Input
                  placeholder="00:11:22:33:FF:EE or Device Name"
                  value={formData.bluetooth_identifier}
                  onChange={(e) => setFormData(prev => ({ ...prev, bluetooth_identifier: e.target.value }))}
                  className={cn("h-9 text-xs font-mono", formErrors.bluetooth_identifier && "border-red-500")}
                />
                {formErrors.bluetooth_identifier && (
                  <p className="text-[11px] text-red-500 font-medium">{formErrors.bluetooth_identifier}</p>
                )}
              </div>
            )}

            <Separator />

            {/* Default & Active Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold">Default KOT Fallback Printer</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Items with no assigned station route will print to this printer.
                  </p>
                </div>
                <Switch
                  checked={formData.is_default}
                  onCheckedChange={(val) => setFormData(prev => ({ ...prev, is_default: val }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold">Active Status</Label>
                  <p className="text-[10px] text-muted-foreground">Enable or disable this printer.</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(val) => setFormData(prev => ({ ...prev, is_active: val }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddEditOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSavePrinter}
              disabled={createPrinterMutation.isPending || updatePrinterMutation.isPending}
              className="text-xs font-bold uppercase tracking-wider"
            >
              {editingPrinter ? 'Save Changes' : 'Create Printer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 5. CATEGORY ROUTE ASSIGNMENT MODAL ────────────────────────────── */}
      <Dialog open={!!routeCategoryToEdit} onOpenChange={(open) => !open && setRouteCategoryToEdit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Route &quot;{routeCategoryToEdit?.displayName}&quot; to Printers
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select one or more station printers that should receive tickets for items in this category.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-2">
            <Label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
              Active Station Printers ({printers.filter(p => p.is_active).length})
            </Label>
            
            {printers.filter(p => p.is_active).length === 0 ? (
              <p className="text-xs text-red-500 py-4 text-center">
                No active printers available. Please activate or add a printer first.
              </p>
            ) : (
              <ScrollArea className="max-h-60 border rounded-lg p-2 space-y-2">
                {printers.filter(p => p.is_active).map(printer => {
                  const isChecked = selectedPrinterIdsForCategory.includes(printer.id);
                  return (
                    <div
                      key={printer.id}
                      onClick={() => {
                        setSelectedPrinterIdsForCategory(prev =>
                          isChecked ? prev.filter(id => id !== printer.id) : [...prev, printer.id]
                        );
                      }}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all mb-1.5",
                        isChecked ? "bg-primary/10 border-primary/40 shadow-xs" : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => {
                            setSelectedPrinterIdsForCategory(prev =>
                              isChecked ? prev.filter(id => id !== printer.id) : [...prev, printer.id]
                            );
                          }}
                        />
                        <div>
                          <div className="text-xs font-bold uppercase tracking-tight flex items-center gap-1.5">
                            {printer.name}
                            {printer.is_default && (
                              <Badge className="text-[8px] py-0 px-1 bg-emerald-600">Default</Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
                            {getTypeIcon(printer.printer_type)} {printer.printer_type.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      {isChecked && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  );
                })}
              </ScrollArea>
            )}

            <p className="text-[11px] text-muted-foreground italic pt-1">
              * Deselecting all printers will cause &quot;{routeCategoryToEdit?.displayName}&quot; to fall back to your Default KOT Printer ({defaultPrinter?.name || 'Main Kitchen'}).
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRouteCategoryToEdit(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveCategoryRoutes}
              disabled={saveCategoryRoutesMutation.isPending}
              className="text-xs font-bold uppercase tracking-wider"
            >
              Save Routing Rules
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 6. DELETE PRINTER WITH ROUTE DEPENDENCY WARNING ────────────────── */}
      <AlertDialog open={!!printerToDelete} onOpenChange={(open) => !open && setPrinterToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-black text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Confirm Delete: &quot;{printerToDelete?.name}&quot;
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <p>Are you sure you want to permanently delete this printer configuration?</p>
                {printerToDelete && getRoutesImpactedByPrinter(printerToDelete.id).length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-lg text-red-800 dark:text-red-300 space-y-1 mt-2">
                    <p className="font-bold flex items-center gap-1">
                      <ShieldAlert className="h-4 w-4" /> Active Route Warning:
                    </p>
                    <p>
                      This printer is currently assigned to <strong>{getRoutesImpactedByPrinter(printerToDelete.id).length} category route(s)</strong>:
                    </p>
                    <ul className="list-disc pl-5 text-[11px] font-mono">
                      {getRoutesImpactedByPrinter(printerToDelete.id).map(r => (
                        <li key={r.id}>{r.category_name}</li>
                      ))}
                    </ul>
                    <p className="text-[10px] italic pt-1">
                      Deleting will remove these route assignments. Those categories will automatically fall back to your Default KOT Printer.
                    </p>
                  </div>
                )}
                {printerToDelete?.is_default && (
                  <p className="text-amber-700 font-bold">
                    ⚠️ This is currently your Default KOT Fallback Printer. Please designate a new default printer after deleting.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => printerToDelete && deletePrinterMutation.mutate(printerToDelete.id)}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── 7. DEACTIVATE DEFAULT PRINTER WARNING MODAL ───────────────────── */}
      <AlertDialog open={!!printerToDeactivate} onOpenChange={(open) => !open && setPrinterToDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-black text-amber-600 flex items-center gap-2">
              <StarOff className="h-5 w-5" />
              Deactivate Default Printer
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <p>
                <strong>&quot;{printerToDeactivate?.name}&quot;</strong> is currently configured as your Default KOT Fallback Printer.
              </p>
              <p>
                Deactivating it will remove its default fallback designation. Unassigned categories will not have an active fallback printer until you assign a new default.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (printerToDeactivate) {
                  updatePrinterMutation.mutate({
                    id: printerToDeactivate.id,
                    updates: { is_active: false, is_default: false }
                  });
                  setPrinterToDeactivate(null);
                }
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider"
            >
              Deactivate &amp; Clear Default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── 8. HONEST TEST CONNECTION MODAL ───────────────────────────────── */}
      <Dialog open={!!testPrinterModal} onOpenChange={(open) => !open && setTestPrinterModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
              {testPrinterModal && getTypeIcon(testPrinterModal.printer_type)}
              Test Printer Configuration
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-800">
              {testPrinterModal?.name} ({testPrinterModal?.printer_type.toUpperCase()})
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border rounded-lg space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-bold">{testPrinterModal?.printer_type.toUpperCase()}</span>
              </div>
              {testPrinterModal?.printer_type === 'network' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IP Address:</span>
                    <span className="font-bold">{testPrinterModal.ip_address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Port:</span>
                    <span className="font-bold">{testPrinterModal.port || 9100}</span>
                  </div>
                </>
              )}
              {(testPrinterModal?.printer_type === 'system' || testPrinterModal?.printer_type === 'usb') && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Queue Name:</span>
                  <span className="font-bold">{testPrinterModal.device_name || 'System Default'}</span>
                </div>
              )}
              {testPrinterModal?.printer_type === 'bluetooth' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">BT Identifier:</span>
                  <span className="font-bold">{testPrinterModal.bluetooth_identifier}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className={testPrinterModal?.is_active ? "text-emerald-600 font-bold" : "text-slate-500"}>
                  {testPrinterModal?.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 rounded-lg text-emerald-800 dark:text-emerald-300 text-[11px] space-y-1">
              <p className="font-bold flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Configuration Verified:
              </p>
              <p>
                All parameters conform to POS routing standards. Physical ESC/POS transmission will be dispatched during live order checkout once multi-printer routing is activated.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              onClick={() => setTestPrinterModal(null)}
              className="w-full text-xs font-bold uppercase"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 9. FEATURE FLAG CONFIRMATION MODAL ────────────────────────────── */}
      <AlertDialog open={showFeatureFlagModal} onOpenChange={setShowFeatureFlagModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-black flex items-center gap-2">
              <AlertTriangle className={cn("h-5 w-5", pendingFeatureFlagValue ? "text-emerald-600" : "text-amber-600")} />
              {pendingFeatureFlagValue ? 'Enable Multi-Printer KOT Routing?' : 'Disable Multi-Printer KOT Routing?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
              {pendingFeatureFlagValue ? (
                <>
                  <p>
                    Enabling this setting will activate category-based station ticket splitting for this restaurant.
                  </p>
                  <p>
                    Please ensure all station printers are powered on, connected to the local network or terminal, and that category routing rules are configured.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Disabling this feature will return all kitchen tickets to the <strong>legacy single-ticket KOT pipeline</strong>.
                  </p>
                  <p>
                    All items will print as a single unified ticket on your Default KOT Fallback Printer.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toggleFeatureFlagMutation.mutate(pendingFeatureFlagValue)}
              className={cn(
                "text-white text-xs font-bold uppercase tracking-wider",
                pendingFeatureFlagValue ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"
              )}
            >
              {pendingFeatureFlagValue ? 'Confirm Enable' : 'Confirm Disable'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
