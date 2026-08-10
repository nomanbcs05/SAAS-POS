import { useState, useMemo } from 'react';
import {
  Shield, Users, Plus, Trash2, Edit3, KeyRound, Crown, CheckCircle2, XCircle, Save,
  X, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, BadgeCheck, Lock, Unlock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  cashierApi, ALL_MODULES, ModuleKey, CashierWithPermissions,
} from '@/services/cashierApi';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { cn } from '@/lib/utils';

interface CashierManagerProps {
  tenant?: { id: string };
}

type FormMode = 'create' | 'edit';

const moduleCategoryLabels: Record<'pos' | 'management', string> = {
  pos: 'Point of Sale',
  management: 'Management & Back Office',
};

const CashierManager = ({ tenant }: CashierManagerProps) => {
  const { tenant: currentTenant } = useMultiTenant();
  const activeTenantId = tenant?.id || currentTenant?.id;
  const queryClient = useQueryClient();

  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingCashier, setEditingCashier] = useState<CashierWithPermissions | null>(null);

  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [fullAccess, setFullAccess] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [permissions, setPermissions] = useState<Record<ModuleKey, boolean>>(() => {
    const init: Record<string, boolean> = {};
    ALL_MODULES.forEach(m => { init[m.key] = m.category === 'pos'; });
    return init as Record<ModuleKey, boolean>;
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CashierWithPermissions | null>(null);

  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState<CashierWithPermissions | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);

  const [permsEditorOpen, setPermsEditorOpen] = useState(false);
  const [permsTarget, setPermsTarget] = useState<CashierWithPermissions | null>(null);
  const [permsFullAccess, setPermsFullAccess] = useState(false);
  const [permsMap, setPermsMap] = useState<Record<ModuleKey, boolean>>(() => {
    const init: Record<string, boolean> = {};
    ALL_MODULES.forEach(m => { init[m.key] = false; });
    return init as Record<ModuleKey, boolean>;
  });

  const { data: cashiers = [], isLoading: cashiersLoading } = useQuery({
    queryKey: ['cashiers', activeTenantId],
    queryFn: () => cashierApi.account.getAll(activeTenantId),
    enabled: !!activeTenantId,
    staleTime: 5_000,
  });

  const resetCreateForm = () => {
    setName('');
    setPin('');
    setConfirmPin('');
    setIsActive(true);
    setFullAccess(false);
    setShowPin(false);
    setPermissions(() => {
      const init: Record<string, boolean> = {};
      ALL_MODULES.forEach(m => { init[m.key] = m.category === 'pos'; });
      return init as Record<ModuleKey, boolean>;
    });
    setEditingCashier(null);
  };

  const openCreate = () => {
    resetCreateForm();
    setFormMode('create');
    setAccountDialogOpen(true);
  };

  const openEdit = (c: CashierWithPermissions) => {
    setEditingCashier(c);
    setFormMode('edit');
    setName(c.name);
    setPin('');
    setConfirmPin('');
    setIsActive(c.is_active);
    setFullAccess(c.full_access);
    setPermissions(c.permissions);
    setShowPin(false);
    setAccountDialogOpen(true);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (formMode === 'create') {
        if (!name.trim()) throw new Error('Cashier name is required');
        if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 numeric digits');
        if (pin !== confirmPin) throw new Error('PINs do not match');
        return cashierApi.account.create({
          tenant_id: activeTenantId!,
          name: name.trim(),
          pin,
          is_active: isActive,
          full_access: fullAccess,
          permissions,
        });
      } else {
        if (!editingCashier) throw new Error('No cashier to edit');
        if (!name.trim()) throw new Error('Cashier name is required');
        const payload: any = {
          name: name.trim(),
          is_active: isActive,
          full_access: fullAccess,
          permissions,
        };
        if (pin.trim() || confirmPin.trim()) {
          if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 numeric digits');
          if (pin !== confirmPin) throw new Error('PINs do not match');
          await cashierApi.account.changePin(editingCashier.id, pin);
        }
        return cashierApi.account.update(editingCashier.id, payload);
      }
    },
    onSuccess: async () => {
      toast.success(formMode === 'create' ? 'Cashier created successfully' : 'Cashier updated successfully');
      setAccountDialogOpen(false);
      resetCreateForm();
      await queryClient.invalidateQueries({ queryKey: ['cashiers'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Operation failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cashierApi.account.delete(id),
    onSuccess: async () => {
      toast.success('Cashier deleted');
      setDeleteOpen(false);
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['cashiers'] });
    },
    onError: (err: any) => toast.error(err.message || 'Delete failed'),
  });

  const pinChangeMutation = useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: string }) => cashierApi.account.changePin(id, pin),
    onSuccess: () => {
      toast.success('PIN changed successfully');
      setPinDialogOpen(false);
      setPinTarget(null);
      setNewPin('');
      setConfirmNewPin('');
      setShowNewPin(false);
    },
    onError: (err: any) => toast.error(err.message || 'PIN change failed'),
  });

  const permsSaveMutation = useMutation({
    mutationFn: async () => {
      if (!permsTarget) throw new Error('No cashier selected');
      return cashierApi.account.update(permsTarget.id, {
        full_access: permsFullAccess,
        permissions: permsMap,
      });
    },
    onSuccess: async (updated) => {
      toast.success('Permissions saved');
      if (permsTarget && cashierApi.auth.getSession()?.cashier_id === permsTarget.id) {
        await cashierApi.auth.refreshPermissions(activeTenantId!, permsTarget.id);
      }
      setPermsEditorOpen(false);
      setPermsTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['cashiers'] });
    },
    onError: (err: any) => toast.error(err.message || 'Save failed'),
  });

  const openPermsEditor = (c: CashierWithPermissions) => {
    setPermsTarget(c);
    setPermsFullAccess(c.full_access);
    setPermsMap({ ...c.permissions });
    setPermsEditorOpen(true);
  };

  const togglePerm = (k: ModuleKey) => {
    setPermsMap(prev => ({ ...prev, [k]: !prev[k] }));
  };

  const posModules = useMemo(() => ALL_MODULES.filter(m => m.category === 'pos'), []);
  const mgmtModules = useMemo(() => ALL_MODULES.filter(m => m.category === 'management'), []);

  const countAllowed = (p: Record<ModuleKey, boolean>) =>
    ALL_MODULES.filter(m => p[m.key]).length;

  const accessLevelLabel = (c: CashierWithPermissions) => {
    if (c.full_access) return { label: 'Full Access', cls: 'bg-amber-100 text-amber-800 border-amber-200' };
    const count = countAllowed(c.permissions);
    if (count >= ALL_MODULES.length * 0.8) return { label: 'Most Access', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    if (count >= ALL_MODULES.length * 0.4) return { label: 'Limited Access', cls: 'bg-blue-100 text-blue-800 border-blue-200' };
    return { label: 'Restricted Access', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  const validatePinChange = () => {
    if (!/^\d{4}$/.test(newPin)) {
      toast.error('PIN must be exactly 4 numeric digits');
      return false;
    }
    if (newPin !== confirmNewPin) {
      toast.error('PINs do not match');
      return false;
    }
    return true;
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* Cashier Accounts Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-black font-heading uppercase tracking-tight flex items-center gap-2">
                  Cashier Accounts
                </CardTitle>
                <CardDescription className="mt-1">
                  Manage staff accounts with name + 4-digit PIN authentication and custom permissions.
                </CardDescription>
              </div>
            </div>
            <Button onClick={openCreate} className="font-black uppercase tracking-wider text-xs h-10 px-4 bg-primary shadow-sm">
              <Plus className="h-4 w-4 mr-1.5" /> Create Cashier
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-black uppercase tracking-wider text-[10px] text-slate-500">Name</TableHead>
                    <TableHead className="font-black uppercase tracking-wider text-[10px] text-slate-500">Status</TableHead>
                    <TableHead className="font-black uppercase tracking-wider text-[10px] text-slate-500">Access Level</TableHead>
                    <TableHead className="font-black uppercase tracking-wider text-[10px] text-slate-500">Permissions</TableHead>
                    <TableHead className="font-black uppercase tracking-wider text-[10px] text-slate-500 text-right w-[180px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashiersLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-28 text-center">
                        <div className="flex items-center justify-center gap-2 text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading cashiers...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : cashiers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-28 text-center">
                        <div className="space-y-3 py-2">
                          <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                            <Users className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-700">No cashier accounts yet</p>
                            <p className="text-xs text-slate-500 mt-0.5">Create your first cashier to enable PIN login and access control.</p>
                          </div>
                          <Button onClick={openCreate} size="sm" className="font-bold uppercase tracking-widest text-[10px] bg-primary">
                            <Plus className="h-3.5 w-3.5 mr-1" /> Create First Cashier
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    cashiers.map(c => {
                      const al = accessLevelLabel(c);
                      const count = countAllowed(c.permissions);
                      return (
                        <TableRow key={c.id} className="hover:bg-slate-50/70">
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-black text-sm flex items-center justify-center shrink-0">
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-black text-slate-800 truncate max-w-[180px]">{c.name}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                  Cashier
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {c.is_active ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-black uppercase tracking-wider text-[10px] flex items-center gap-1 w-fit">
                                <Unlock className="h-3 w-3" /> Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 font-black uppercase tracking-wider text-[10px] flex items-center gap-1 w-fit">
                                <Lock className="h-3 w-3" /> Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`font-black uppercase tracking-wider text-[10px] border ${al.cls} flex items-center gap-1 w-fit`}>
                              {c.full_access && <Crown className="h-3 w-3" />}
                              {al.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 w-[160px]">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Modules</span>
                                <span className="text-[10px] font-bold text-slate-700">
                                  {c.full_access ? `${ALL_MODULES.length}/${ALL_MODULES.length}` : `${count}/${ALL_MODULES.length}`}
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${c.full_access ? 'bg-amber-500' : count >= ALL_MODULES.length * 0.6 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                  style={{ width: `${c.full_access ? 100 : Math.round((count / ALL_MODULES.length) * 100)}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 border-slate-200 hover:bg-primary hover:border-primary hover:text-primary-foreground"
                                    onClick={() => openPermsEditor(c)}
                                  >
                                    <Shield className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="font-bold uppercase text-[10px] tracking-widest">Permissions</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 border-slate-200 hover:bg-blue-500 hover:border-blue-500 hover:text-white"
                                    onClick={() => { setPinTarget(c); setPinDialogOpen(true); }}
                                  >
                                    <KeyRound className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="font-bold uppercase text-[10px] tracking-widest">Reset PIN</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 border-slate-200 hover:bg-slate-800 hover:border-slate-800 hover:text-white"
                                    onClick={() => openEdit(c)}
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="font-bold uppercase text-[10px] tracking-widest">Edit</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 border-slate-200 hover:bg-red-500 hover:border-red-500 hover:text-white"
                                    onClick={() => { setDeleteTarget(c); setDeleteOpen(true); }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="font-bold uppercase text-[10px] tracking-widest">Delete</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Permissions Overview */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-black font-heading uppercase tracking-tight flex items-center gap-2">
                  Cashier Permissions Overview
                </CardTitle>
                <CardDescription className="mt-1">
                  All sidebar modules with their current access count across cashiers. Click the Permissions (shield) icon on any cashier to customize.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['pos', 'management'] as const).map(cat => (
                <div key={cat} className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      {moduleCategoryLabels[cat]}
                    </h4>
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-slate-50">
                      {(cat === 'pos' ? posModules : mgmtModules).length} modules
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    {(cat === 'pos' ? posModules : mgmtModules).map(m => {
                      const enabledCount = cashiers.filter(c => c.permissions[m.key] || c.full_access).length;
                      const pct = cashiers.length ? Math.round((enabledCount / cashiers.length) * 100) : 0;
                      return (
                        <div key={m.key} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50/70">
                          <div className="flex items-center gap-2 min-w-0">
                            <BadgeCheck className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-xs font-bold text-slate-700 truncate">{m.label}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] font-black text-slate-500 w-10 text-right tabular-nums">{enabledCount}/{cashiers.length}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Create / Edit Cashier Dialog */}
        <Dialog open={accountDialogOpen} onOpenChange={(v) => { setAccountDialogOpen(v); if (!v) resetCreateForm(); }}>
          <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-black font-heading uppercase tracking-tight">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  {formMode === 'create' ? <Plus className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                </div>
                {formMode === 'create' ? 'Create Cashier Account' : 'Edit Cashier Account'}
              </DialogTitle>
              <DialogDescription>
                {formMode === 'create'
                  ? 'Cashiers log in with their name + 4-digit PIN. Permissions are saved to the database.'
                  : 'Update cashier profile, PIN, and access permissions.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-black uppercase tracking-wider text-[10px] text-slate-500 ml-1">Cashier Name *</Label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Ahmed Khan"
                    autoFocus
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-black uppercase tracking-wider text-[10px] text-slate-500 ml-1">Status</Label>
                  <div className="h-11 rounded-lg border border-slate-200 px-3 flex items-center justify-between bg-slate-50/50">
                    <span className="text-sm font-bold text-slate-700">{isActive ? 'Active' : 'Inactive'}</span>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-black uppercase tracking-wider text-[10px] text-slate-500 ml-1">
                    {formMode === 'create' ? '4-Digit PIN *' : 'New PIN (leave blank to keep current)'}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={4}
                      value={pin}
                      onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="••••"
                      className="h-11 rounded-lg pr-10 tracking-[1em] text-center text-lg"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setShowPin(v => !v)}
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-black uppercase tracking-wider text-[10px] text-slate-500 ml-1">
                    {formMode === 'create' ? 'Confirm PIN *' : 'Confirm New PIN'}
                  </Label>
                  <Input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={4}
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="h-11 rounded-lg tracking-[1em] text-center text-lg"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-200/70 text-amber-800 flex items-center justify-center shrink-0">
                      <Crown className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-sm text-amber-900">Allow Full Access</p>
                      <p className="text-[11px] text-amber-700/90 font-medium">Trusted cashier with complete access to every module (overrides individual permissions).</p>
                    </div>
                  </div>
                  <Switch checked={fullAccess} onCheckedChange={setFullAccess} />
                </div>

                <div className={cn(
                  'space-y-4 p-4 rounded-xl border transition-all',
                  fullAccess ? 'bg-slate-50 border-slate-200 opacity-60 pointer-events-none' : 'bg-white border-slate-200'
                )}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Module Permissions</h4>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] font-black uppercase tracking-widest rounded-md"
                        onClick={() => {
                          const all: Record<string, boolean> = {};
                          ALL_MODULES.forEach(m => { all[m.key] = true; });
                          setPermissions(all as Record<ModuleKey, boolean>);
                        }}
                      >Select All</Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] font-black uppercase tracking-widest rounded-md"
                        onClick={() => {
                          const pos: Record<string, boolean> = {};
                          ALL_MODULES.forEach(m => { pos[m.key] = m.category === 'pos'; });
                          setPermissions(pos as Record<ModuleKey, boolean>);
                        }}
                      >POS Only</Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] font-black uppercase tracking-widest rounded-md"
                        onClick={() => {
                          const none: Record<string, boolean> = {};
                          ALL_MODULES.forEach(m => { none[m.key] = false; });
                          setPermissions(none as Record<ModuleKey, boolean>);
                        }}
                      >None</Button>
                    </div>
                  </div>

                  {(['pos', 'management'] as const).map(cat => (
                    <div key={cat} className="space-y-2">
                      <h5 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">{moduleCategoryLabels[cat]}</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(cat === 'pos' ? posModules : mgmtModules).map(m => (
                          <div
                            key={m.key}
                            className={cn(
                              'flex items-center justify-between p-2.5 rounded-lg border transition-all',
                              permissions[m.key] ? 'bg-primary/5 border-primary/20' : 'bg-white border-slate-200 hover:border-slate-300'
                            )}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-xs text-slate-700 truncate">{m.label}</p>
                              <p className="text-[10px] text-slate-400 truncate">{m.route}</p>
                            </div>
                            <Switch
                              checked={permissions[m.key]}
                              onCheckedChange={(v) => setPermissions(prev => ({ ...prev, [m.key]: v }))}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setAccountDialogOpen(false); resetCreateForm(); }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="bg-primary font-black uppercase tracking-widest text-xs"
              >
                {submitMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" /> {formMode === 'create' ? 'Create Cashier' : 'Update Cashier'}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
                  <Trash2 className="h-4 w-4" />
                </div>
                Delete Cashier Account
              </DialogTitle>
              <DialogDescription>
                This will permanently remove the cashier account. Are you sure?
              </DialogDescription>
            </DialogHeader>
            {deleteTarget && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200">
                <div className="w-10 h-10 rounded-full bg-red-200/70 text-red-800 font-black flex items-center justify-center shrink-0">
                  {deleteTarget.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-red-900 truncate">{deleteTarget.name}</p>
                  <p className="text-[11px] text-red-700 font-medium">Cashier account will be deleted permanently.</p>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteTarget(null); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="font-black uppercase tracking-widest text-xs"
              >
                {deleteMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</>
                ) : (
                  <><Trash2 className="h-4 w-4 mr-2" /> Yes, Delete</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PIN Change Dialog */}
        <Dialog open={pinDialogOpen} onOpenChange={(v) => { setPinDialogOpen(v); if (!v) { setPinTarget(null); setNewPin(''); setConfirmNewPin(''); setShowNewPin(false); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <KeyRound className="h-4 w-4" />
                </div>
                Reset Cashier PIN
              </DialogTitle>
              <DialogDescription>
                Enter a new 4-digit numeric PIN for {pinTarget?.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="font-black uppercase tracking-wider text-[10px] text-slate-500 ml-1">New 4-Digit PIN *</Label>
                <div className="relative">
                  <Input
                    type={showNewPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={4}
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="h-11 rounded-lg pr-10 tracking-[1em] text-center text-lg"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowNewPin(v => !v)}>
                    {showNewPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-black uppercase tracking-wider text-[10px] text-slate-500 ml-1">Confirm New PIN *</Label>
                <Input
                  type={showNewPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmNewPin}
                  onChange={e => setConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="h-11 rounded-lg tracking-[1em] text-center text-lg"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => { setPinDialogOpen(false); setPinTarget(null); }}>
                Cancel
              </Button>
              <Button
                onClick={() => { if (validatePinChange() && pinTarget) pinChangeMutation.mutate({ id: pinTarget.id, pin: newPin }); }}
                disabled={pinChangeMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 font-black uppercase tracking-widest text-xs"
              >
                {pinChangeMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
                ) : (
                  <><KeyRound className="h-4 w-4 mr-2" /> Change PIN</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Permissions Editor Dialog */}
        <Dialog open={permsEditorOpen} onOpenChange={(v) => { setPermsEditorOpen(v); if (!v) setPermsTarget(null); }}>
          <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-black font-heading uppercase tracking-tight">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Shield className="h-4 w-4" />
                </div>
                Cashier Permissions
              </DialogTitle>
              <DialogDescription>
                {permsTarget ? (
                  <>Customize module access for <span className="font-bold text-slate-700">{permsTarget.name}</span>. Changes take effect on next session refresh.</>
                ) : 'Choose modules this cashier may access.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-200/70 text-amber-800 flex items-center justify-center shrink-0">
                    <Crown className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-sm text-amber-900">Full Access</p>
                    <p className="text-[11px] text-amber-700/90 font-medium">Allow all modules & features instantly.</p>
                  </div>
                </div>
                <Switch checked={permsFullAccess} onCheckedChange={setPermsFullAccess} />
              </div>

              <div className={cn(
                'space-y-4 p-4 rounded-xl border transition-all',
                permsFullAccess ? 'bg-slate-50 border-slate-200 opacity-60 pointer-events-none' : 'bg-white border-slate-200'
              )}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Toggle Individual Modules</h4>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] font-black uppercase tracking-widest rounded-md"
                      onClick={() => {
                        const all: Record<string, boolean> = {};
                        ALL_MODULES.forEach(m => { all[m.key] = true; });
                        setPermsMap(all as Record<ModuleKey, boolean>);
                      }}
                    >All On</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] font-black uppercase tracking-widest rounded-md"
                      onClick={() => {
                        const pos: Record<string, boolean> = {};
                        ALL_MODULES.forEach(m => { pos[m.key] = m.category === 'pos'; });
                        setPermsMap(pos as Record<ModuleKey, boolean>);
                      }}
                    >POS Only</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] font-black uppercase tracking-widest rounded-md"
                      onClick={() => {
                        const none: Record<string, boolean> = {};
                        ALL_MODULES.forEach(m => { none[m.key] = false; });
                        setPermsMap(none as Record<ModuleKey, boolean>);
                      }}
                    >All Off</Button>
                  </div>
                </div>

                {(['pos', 'management'] as const).map(cat => (
                  <div key={cat} className="space-y-2">
                    <div className="flex items-center gap-2 px-0.5">
                      <h5 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{moduleCategoryLabels[cat]}</h5>
                      <div className="flex-1 h-px bg-slate-100" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(cat === 'pos' ? posModules : mgmtModules).map(m => (
                        <div
                          key={m.key}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer',
                            permsMap[m.key] ? 'bg-primary/5 border-primary/20' : 'bg-white border-slate-200 hover:border-slate-300'
                          )}
                          onClick={() => togglePerm(m.key)}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            {permsMap[m.key] ? (
                              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-slate-300 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-700 truncate">{m.label}</p>
                              <p className="text-[10px] text-slate-400 truncate">Route: {m.route}</p>
                            </div>
                          </div>
                          <Switch checked={permsMap[m.key]} onCheckedChange={() => togglePerm(m.key)} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-1">
              <Button variant="outline" onClick={() => { setPermsEditorOpen(false); setPermsTarget(null); }}>
                Cancel
              </Button>
              <Button
                onClick={() => permsSaveMutation.mutate()}
                disabled={permsSaveMutation.isPending}
                className="bg-primary font-black uppercase tracking-widest text-xs"
              >
                {permsSaveMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" /> Save Permissions</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default CashierManager;
