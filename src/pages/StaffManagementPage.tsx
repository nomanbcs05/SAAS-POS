import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffManagementApi, probeStaffSchema, syncLocalData, Staff, StaffAttendance, StaffPayroll, PayrollVoucher } from '@/services/staffManagementApi';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useReactToPrint } from 'react-to-print';
import { format, parseISO } from 'date-fns';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { toast } from 'sonner';
import { 
  Users, 
  Calendar, 
  Wallet, 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Check, 
  Printer, 
  Loader2, 
  DollarSign, 
  Search, 
  CheckCircle2, 
  XCircle,
  Clock,
  Briefcase,
  AlertCircle,
  Database,
  ExternalLink
} from 'lucide-react';

const MIGRATION_SQL_STRING = [
  "-- =============================================\n",
  "-- GENX CLOUD POS - Staff Management Tables Setup\n",
  "-- =============================================\n",
  "\n",
  "-- Ensure UUID extension exists\n",
  "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";\n",
  "\n",
  "-- Create 'staff' table if it does not exist\n",
  "CREATE TABLE IF NOT EXISTS public.staff (\n",
  "    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n",
  "    name TEXT NOT NULL,\n",
  "    role TEXT NOT NULL DEFAULT 'waiter',\n",
  "    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,\n",
  "    is_active BOOLEAN DEFAULT TRUE,\n",
  "    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL\n",
  ");\n",
  "\n",
  "-- Alter existing 'staff' table to add payroll and basic details columns safely\n",
  "ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS phone TEXT;\n",
  "ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS email TEXT;\n",
  "ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS salary_type TEXT DEFAULT 'monthly' CHECK (salary_type IN ('monthly', 'daily'));\n",
  "ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS salary_amount NUMERIC DEFAULT 0;\n",
  "ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS joining_date DATE DEFAULT CURRENT_DATE;\n",
  "\n",
  "-- Create 'staff_attendance' table\n",
  "CREATE TABLE IF NOT EXISTS public.staff_attendance (\n",
  "    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n",
  "    staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,\n",
  "    date DATE NOT NULL,\n",
  "    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'half_day', 'leave')),\n",
  "    check_in TIME,\n",
  "    check_out TIME,\n",
  "    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,\n",
  "    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,\n",
  "    UNIQUE(staff_id, date)\n",
  ");\n",
  "\n",
  "-- Create 'staff_payroll' table\n",
  "CREATE TABLE IF NOT EXISTS public.staff_payroll (\n",
  "    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n",
  "    staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,\n",
  "    month TEXT NOT NULL,\n",
  "    base_salary NUMERIC NOT NULL DEFAULT 0,\n",
  "    present_days INTEGER NOT NULL DEFAULT 0,\n",
  "    absent_days INTEGER NOT NULL DEFAULT 0,\n",
  "    bonus NUMERIC DEFAULT 0,\n",
  "    advances NUMERIC DEFAULT 0,\n",
  "    deductions NUMERIC DEFAULT 0,\n",
  "    net_salary NUMERIC NOT NULL,\n",
  "    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,\n",
  "    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,\n",
  "    UNIQUE(staff_id, month)\n",
  ");\n",
  "\n",
  "-- Create 'payroll_vouchers' table\n",
  "CREATE TABLE IF NOT EXISTS public.payroll_vouchers (\n",
  "    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n",
  "    voucher_id TEXT UNIQUE NOT NULL,\n",
  "    staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,\n",
  "    payroll_id UUID REFERENCES public.staff_payroll(id) ON DELETE CASCADE,\n",
  "    month TEXT NOT NULL,\n",
  "    net_salary NUMERIC NOT NULL,\n",
  "    payment_status TEXT NOT NULL CHECK (payment_status IN ('Paid', 'Pending')),\n",
  "    payment_date TIMESTAMP WITH TIME ZONE,\n",
  "    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,\n",
  "    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL\n",
  ");\n",
  "\n",
  "-- Enable RLS for all tables (including staff, just in case)\n",
  "ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;\n",
  "ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;\n",
  "ALTER TABLE public.staff_payroll ENABLE ROW LEVEL SECURITY;\n",
  "ALTER TABLE public.payroll_vouchers ENABLE ROW LEVEL SECURITY;\n",
  "\n",
  "-- Tenant Isolation policies\n",
  "DO $$ \n",
  "BEGIN \n",
  "    -- Staff Policies\n",
  "    DROP POLICY IF EXISTS \"Tenant Isolation\" ON public.staff;\n",
  "    CREATE POLICY \"Tenant Isolation\" ON public.staff FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL);\n",
  "\n",
  "    -- Staff Attendance Policies\n",
  "    DROP POLICY IF EXISTS \"Tenant Isolation\" ON public.staff_attendance;\n",
  "    CREATE POLICY \"Tenant Isolation\" ON public.staff_attendance FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL);\n",
  "    \n",
  "    -- Staff Payroll Policies\n",
  "    DROP POLICY IF EXISTS \"Tenant Isolation\" ON public.staff_payroll;\n",
  "    CREATE POLICY \"Tenant Isolation\" ON public.staff_payroll FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL);\n",
  "    \n",
  "    -- Payroll Vouchers Policies\n",
  "    DROP POLICY IF EXISTS \"Tenant Isolation\" ON public.payroll_vouchers;\n",
  "    CREATE POLICY \"Tenant Isolation\" ON public.payroll_vouchers FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL);\n",
  "END $$;\n",
  "\n",
  "-- Register tenant_id triggers to automatically assign tenant_id on insert\n",
  "DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.staff;\n",
  "CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.staff FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();\n",
  "\n",
  "DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.staff_attendance;\n",
  "CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.staff_attendance FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();\n",
  "\n",
  "DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.staff_payroll;\n",
  "CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.staff_payroll FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();\n",
  "\n",
  "DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.payroll_vouchers;\n",
  "CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.payroll_vouchers FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();\n",
  "\n",
  "-- Grant permissions\n",
  "GRANT ALL ON public.staff TO anon, authenticated, service_role;\n",
  "GRANT ALL ON public.staff_attendance TO anon, authenticated, service_role;\n",
  "GRANT ALL ON public.staff_payroll TO anon, authenticated, service_role;\n",
  "GRANT ALL ON public.payroll_vouchers TO anon, authenticated, service_role;\n"
].join("");



// Trigger redeploy after fixing handlePrint duplicate

function StaffManagementPage() {
  const { tenant, isAdmin } = useMultiTenant();
  const queryClient = useQueryClient();

  // Navigation states
  const [activeTab, setActiveTab] = useState('staff-list');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Date and month states
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Modals state
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);

// Printing state moved to later section (printModalOpen and printingVoucher are defined below)
  // Form states for staff
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<'cashier' | 'waiter' | 'chef' | 'cleaner' | 'manager'>('cashier');
  const [formPhone, setFormPhone] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formSalaryType, setFormSalaryType] = useState<'monthly' | 'daily'>('monthly');
  const [formSalaryAmount, setFormSalaryAmount] = useState('');
  const [formJoiningDate, setFormJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [formIsActive, setFormIsActive] = useState(true);

  // Payroll local adjustment states (to hold changes before saving)
  const [payrollAdjustments, setPayrollAdjustments] = useState<Record<string, { bonus: number; advances: number; deductions: number }>>({});

  // Printing trigger
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    onAfterPrint: () => setPrintingVoucher(null),
  });

  // ---------------------------------------------------------------------------
  // Schema probe: runs ONCE on mount. Pre-marks all tables as missing if the
  // Supabase migration hasn't been run yet, so ZERO data queries hit the network.
  // ---------------------------------------------------------------------------
  const { data: schemaReady = false, isLoading: isCheckingSchema } = useQuery({
    queryKey: ['staff-schema-probe'],
    queryFn: probeStaffSchema,
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // re-probe every 5 min so it picks up new tables after migration
    gcTime: 10 * 60 * 1000,
  });

  // Auto-sync local data when schema becomes ready
  useEffect(() => {
    if (schemaReady && tenant?.id) {
      const localUsers = localStorage.getItem('pos_local_users');
      const localAttendance = localStorage.getItem('pos_offline_staff_attendance');
      
      const hasLocalStaff = localUsers && JSON.parse(localUsers).length > 0;
      const hasLocalAttendance = localAttendance && JSON.parse(localAttendance).length > 0;

      if (hasLocalStaff || hasLocalAttendance) {
        toast.promise(
          syncLocalData(tenant.id),
          {
            loading: 'Syncing local staff data to cloud database...',
            success: (res) => {
              // Invalidate queries so the page updates with cloud data
              queryClient.invalidateQueries({ queryKey: ['staff-mgmt'] });
              queryClient.invalidateQueries({ queryKey: ['staff-attendance'] });
              queryClient.invalidateQueries({ queryKey: ['staff-payroll'] });
              queryClient.invalidateQueries({ queryKey: ['staff-vouchers'] });
              return "Successfully synced " + (res?.staffCount || 0) + " staff members and " + (res?.attendanceCount || 0) + " attendance records to cloud!";
            },
            error: (err: any) => "Sync failed: " + err.message
          }
        );
      }
    }
  }, [schemaReady, tenant?.id, queryClient]);

  // Queries — all gated behind !isCheckingSchema so they only fire
  // after the probe has finished (and pre-set any missing-table flags).
  const { data: staffList = [], isLoading: isLoadingStaff } = useQuery({
    queryKey: ['staff-mgmt', tenant?.id],
    queryFn: () => staffManagementApi.staff.getAll(tenant?.id),
    enabled: !!tenant?.id && !isCheckingSchema,
    retry: 0,
    refetchOnWindowFocus: false,
  });

  const { data: attendanceList = [], isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['staff-attendance', selectedDate, tenant?.id],
    queryFn: () => staffManagementApi.attendance.getByDate(selectedDate, tenant?.id),
    enabled: !!tenant?.id && !isCheckingSchema && activeTab === 'attendance',
    retry: 0,
    refetchOnWindowFocus: false,
  });

  const { data: calculatedPayrolls = [], isLoading: isLoadingPayroll, refetch: refetchPayroll } = useQuery({
    queryKey: ['staff-payroll', selectedMonth, tenant?.id],
    queryFn: () => staffManagementApi.payroll.calculate(selectedMonth, tenant?.id),
    enabled: !!tenant?.id && !isCheckingSchema && activeTab === 'payroll',
    retry: 0,
    refetchOnWindowFocus: false,
  });

  const { data: vouchersList = [], isLoading: isLoadingVouchers } = useQuery({
    queryKey: ['staff-vouchers', selectedMonth, tenant?.id],
    queryFn: () => staffManagementApi.vouchers.getByMonth(selectedMonth, tenant?.id),
    enabled: !!tenant?.id && !isCheckingSchema && activeTab === 'vouchers',
    retry: 0,
    refetchOnWindowFocus: false,
  });

  // Mutations
  const createStaffMutation = useMutation({
    mutationFn: (newStaff: Omit<Staff, 'id' | 'created_at'>) => staffManagementApi.staff.create(newStaff),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-mgmt'] });
      toast.success('Staff member added successfully');
      setIsStaffModalOpen(false);
      resetStaffForm();
    },
    onError: (err: any) => toast.error('Error adding staff: ' + err.message)
  });

  const updateStaffMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Staff> }) => staffManagementApi.staff.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-mgmt'] });
      toast.success('Staff member updated successfully');
      setIsStaffModalOpen(false);
      setEditingStaff(null);
      resetStaffForm();
    },
    onError: (err: any) => toast.error('Error updating staff: ' + err.message)
  });

  const deleteStaffMutation = useMutation({
    mutationFn: (id: string) => staffManagementApi.staff.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-mgmt'] });
      toast.success('Staff member deleted successfully');
      setIsDeleteConfirmOpen(false);
      setStaffToDelete(null);
    },
    onError: (err: any) => toast.error('Error deleting staff: ' + err.message)
  });

  const saveAttendanceMutation = useMutation({
    mutationFn: (records: StaffAttendance[]) => staffManagementApi.attendance.saveDaily(records),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-attendance'] });
      toast.success('Daily attendance saved successfully');
    },
    onError: (err: any) => toast.error('Error saving attendance: ' + err.message)
  });

  const savePayrollMutation = useMutation({
    mutationFn: (records: StaffPayroll[]) => staffManagementApi.payroll.save(records),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-payroll'] });
      toast.success('Payroll calculations saved');
    },
    onError: (err: any) => toast.error('Error saving payroll: ' + err.message)
  });

  const generateVoucherMutation = useMutation({
    mutationFn: (vouchers: Omit<PayrollVoucher, 'id' | 'created_at' | 'staff_name' | 'staff_role'>[]) => 
      staffManagementApi.vouchers.createVouchers(vouchers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['staff-payroll'] });
      toast.success('Payroll voucher generated successfully');
    },
    onError: (err: any) => toast.error('Error generating voucher: ' + err.message)
  });

  const markVoucherPaidMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'Paid' | 'Pending' }) => 
      staffManagementApi.vouchers.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-vouchers'] });
      toast.success('Voucher status updated successfully');
    },
    onError: (err: any) => toast.error('Error updating status: ' + err.message)
  });

  // Handlers
  const handleOpenAddStaff = () => {
    setEditingStaff(null);
    resetStaffForm();
    setIsStaffModalOpen(true);
  };

  const handleOpenEditStaff = (staff: Staff) => {
    setEditingStaff(staff);
    setFormName(staff.name);
    setFormRole(staff.role);
    setFormPhone(staff.phone || '');
    setFormPin(staff.pin || '');
    setFormSalaryType(staff.salary_type);
    setFormSalaryAmount(staff.salary_amount.toString());
    setFormJoiningDate(staff.joining_date);
    setFormIsActive(staff.is_active);
    setIsStaffModalOpen(true);
  };

  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formPin.trim() || formPin.trim().length !== 4) {
      toast.error('Login PIN must be exactly 4 digits');
      return;
    }
    const amt = Number(formSalaryAmount);
    if (isNaN(amt) || amt < 0) {
      toast.error('Invalid salary amount');
      return;
    }

    const payload: Omit<Staff, 'id' | 'created_at'> = {
      name: formName,
      role: formRole,
      phone: formPhone || undefined,
      pin: formPin.trim(),
      email: `${formName.toLowerCase().replace(/\s+/g, '')}@genxpos.com`,
      salary_type: formSalaryType,
      salary_amount: amt,
      joining_date: formJoiningDate,
      is_active: formIsActive,
      tenant_id: tenant?.id || null
    };

    if (editingStaff) {
      updateStaffMutation.mutate({ id: editingStaff.id, data: payload });
    } else {
      createStaffMutation.mutate(payload);
    }
  };

  const handleDeleteStaffClick = (staff: Staff) => {
    setStaffToDelete(staff);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (staffToDelete) {
      deleteStaffMutation.mutate(staffToDelete.id);
    }
  };

  const resetStaffForm = () => {
    setFormName('');
    setFormRole('cashier');
    setFormPhone('');
    setFormPin('');
    setFormSalaryType('monthly');
    setFormSalaryAmount('');
    setFormJoiningDate(new Date().toISOString().split('T')[0]);
    setFormIsActive(true);
  };

  // Attendance Handlers
  const currentAttendanceMap = useMemo(() => {
    const map = new Map<string, StaffAttendance>();
    attendanceList.forEach(a => map.set(a.staff_id, a));
    return map;
  }, [attendanceList]);

  const handleAttendanceChange = (staffId: string, status: 'present' | 'absent' | 'half_day' | 'leave') => {
    const existing = currentAttendanceMap.get(staffId);
    const record: StaffAttendance = {
      id: existing?.id,
      staff_id: staffId,
      date: selectedDate,
      status,
      tenant_id: tenant?.id || null
    };
    saveAttendanceMutation.mutate([record]);
  };

  const handleMarkAllPresent = () => {
    const activeStaff = staffList.filter(s => s.is_active);
    if (activeStaff.length === 0) return;

    const records: StaffAttendance[] = activeStaff.map(s => {
      const existing = currentAttendanceMap.get(s.id);
      return {
        id: existing?.id,
        staff_id: s.id,
        date: selectedDate,
        status: 'present',
        tenant_id: tenant?.id || null
      };
    });
    saveAttendanceMutation.mutate(records);
  };

  // Payroll Handlers
  const handleAdjustmentChange = (staffId: string, field: 'bonus' | 'advances' | 'deductions', value: string) => {
    const val = Number(value) || 0;
    setPayrollAdjustments(prev => ({
      ...prev,
      [staffId]: {
        ...((prev[staffId]) || { bonus: 0, advances: 0, deductions: 0 }),
        [field]: val
      }
    }));
  };

  // Get final payroll records merging database calculations with local adjustments
  const finalPayrolls = useMemo((): StaffPayroll[] => {
    return calculatedPayrolls.map(p => {
      const adj = payrollAdjustments[p.staff_id];
      if (!adj) return p;

      // Merge and recalculate
      const bonus = adj.bonus;
      const advances = adj.advances;
      const deductions = adj.deductions; // Override or merge. Let's treat it as the final deductions.
      
      const staff = staffList.find(s => s.id === p.staff_id);
      let net_salary = 0;

      if (staff?.salary_type === 'monthly') {
        net_salary = p.base_salary - deductions + bonus - advances;
      } else {
        net_salary = (p.present_days * p.base_salary) + bonus - advances;
      }

      net_salary = Math.round(net_salary * 100) / 100;

      return {
        ...p,
        bonus,
        advances,
        deductions,
        net_salary
      };
    });
  }, [calculatedPayrolls, payrollAdjustments, staffList]);

  const handleSavePayroll = () => {
    if (finalPayrolls.length === 0) return;
    savePayrollMutation.mutate(finalPayrolls);
    setPayrollAdjustments({}); // clear adjustments after saving
  };

  const handleGenerateVoucher = async (payroll: StaffPayroll) => {
    // Generate unique Voucher ID: PV-YYYYMM-XXXX (last 4 chars of staff ID or random)
    const shortId = payroll.staff_id.slice(0, 4).toUpperCase();
    const cleanMonth = selectedMonth.replace('-', '');
    const voucher_id = `PV-${cleanMonth}-${shortId}`;

    const voucherPayload = {
      voucher_id,
      staff_id: payroll.staff_id,
      // payroll_id will be filled after ensuring payroll is persisted
      month: selectedMonth,
      net_salary: payroll.net_salary,
      payment_status: 'Pending' as const,
      tenant_id: tenant?.id || null
    } as const;

    // Ensure payroll record exists and has an ID
    const ensurePayroll = async () => {
      if (payroll.id) {
        return payroll.id;
      }
      // Save payroll first
      toast.info('Saving payroll before voucher...');
      const saved = await savePayrollMutation.mutateAsync([payroll]);
      // The mutation returns an array of saved payrolls
      const savedPayroll = saved[0];
      if (!savedPayroll?.id) {
        throw new Error('Failed to obtain payroll ID for voucher.');
      }
      // Update local state with the new payroll ID so UI reflects it
      setFinalPayrolls((prev) =>
        prev.map((p) => (p.staff_id === savedPayroll.staff_id ? savedPayroll : p))
      );
      return savedPayroll.id;
    };

    try {
      const payrollId = await ensurePayroll();
      generateVoucherMutation.mutate([
        {
          ...voucherPayload,
          payroll_id: payrollId
        }
      ]);
    } catch (e) {
      console.error(e);
      toast.error('Could not generate voucher.');
    }
  };

  // State for print modal
  const [printModalOpen, setPrintModalOpen] = React.useState(false);
  const [printingVoucher, setPrintingVoucher] = React.useState<PayrollVoucher | null>(null);

  const handlePrintVoucher = (voucher: PayrollVoucher) => {
    setPrintingVoucher(voucher);
    setPrintModalOpen(true);
  };



  // Filters
  const filteredStaff = staffList.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone?.includes(searchQuery)
  );

  return (
    <MainLayout>
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Staff Management
            </h1>
            <p className="text-sm text-muted-foreground font-medium">Manage employees, record daily attendance, calculate payroll & generate vouchers</p>
          </div>
          
          {activeTab === 'staff-list' && (
            <Button onClick={handleOpenAddStaff} className="gap-2 font-semibold">
              <Plus className="h-4 w-4" /> Add Employee
            </Button>
          )}
        </header>

        <main className="flex-1 overflow-auto p-6">
          {!isCheckingSchema && !schemaReady && (
            <Card className="border-amber-200 bg-amber-50/50 shadow-sm mb-6">
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-900 text-sm">Database Sync Disabled (Local Storage Mode)</h4>
                    <p className="text-xs text-amber-700 mt-1 max-w-2xl font-medium">
                      The staff database tables were not found in your Supabase project. The application is running in local storage mode. Staff data is saved locally on this browser and will not sync to other devices.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold gap-1.5"
                    onClick={() => setIsSetupDialogOpen(true)}
                  >
                    <Database className="h-3.5 w-3.5" /> Run One-Time Setup
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={(tab) => {
            setActiveTab(tab);
            setPayrollAdjustments({});
          }} className="space-y-6">
            <TabsList className="bg-white border shadow-sm grid grid-cols-4 max-w-2xl h-11 p-1">
              <TabsTrigger value="staff-list" className="font-bold flex gap-2 text-xs">
                <Users className="h-4 w-4" /> Staff Directory
              </TabsTrigger>
              <TabsTrigger value="attendance" className="font-bold flex gap-2 text-xs">
                <Calendar className="h-4 w-4" /> Attendance
              </TabsTrigger>
              <TabsTrigger value="payroll" className="font-bold flex gap-2 text-xs">
                <Wallet className="h-4 w-4" /> Payroll Sheet
              </TabsTrigger>
              <TabsTrigger value="vouchers" className="font-bold flex gap-2 text-xs">
                <FileText className="h-4 w-4" /> Salary Vouchers
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: STAFF DIRECTORY */}
            <TabsContent value="staff-list" className="m-0 space-y-4">
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Staff List</CardTitle>
                      <CardDescription>View and manage your restaurant staff members</CardDescription>
                    </div>
                    <div className="relative w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search by name, role, phone..." 
                        className="pl-9 bg-slate-50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingStaff ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : filteredStaff.length === 0 ? (
                    <div className="text-center py-12 border border-dashed rounded-lg bg-slate-50">
                      <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-slate-700">No Employees Found</h3>
                      <p className="text-sm text-slate-500">Create a new employee profile to get started.</p>
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Contact</th>
                            <th className="px-4 py-3">Salary Setting</th>
                            <th className="px-4 py-3">Joining Date</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-700">
                          {filteredStaff.map((staff) => (
                            <tr key={staff.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-bold text-slate-900">{staff.name}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="capitalize font-semibold border-slate-300">
                                  {staff.role}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-xs">
                                <div>{staff.phone || 'No phone'}</div>
                                <div className="text-emerald-700 font-bold">PIN: {staff.pin || 'N/A'}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <Badge className={
                                    staff.salary_type === 'monthly' 
                                      ? 'bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200' 
                                      : 'bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200'
                                  } variant="outline">
                                    {staff.salary_type === 'monthly' ? 'Monthly' : 'Daily'}
                                  </Badge>
                                  <span className="font-bold text-slate-900">₹{staff.salary_amount}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs">{staff.joining_date}</td>
                              <td className="px-4 py-3">
                                {staff.is_active ? (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">Active</Badge>
                                ) : (
                                  <Badge className="bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50">Inactive</Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-8 w-8 text-slate-600 hover:text-slate-900"
                                    onClick={() => handleOpenEditStaff(staff)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-8 w-8 text-rose-600 hover:text-rose-950 hover:bg-rose-50 border-rose-200"
                                    onClick={() => handleDeleteStaffClick(staff)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: ATTENDANCE */}
            <TabsContent value="attendance" className="m-0 space-y-4">
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle>Daily Attendance Sheet</CardTitle>
                      <CardDescription>Select a date and log employee attendance records</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md border text-sm">
                        <Calendar className="h-4 w-4 text-slate-500" />
                        <input 
                          type="date" 
                          value={selectedDate} 
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="bg-transparent border-none outline-none font-bold text-slate-800"
                        />
                      </div>
                      <Button variant="outline" onClick={handleMarkAllPresent} className="font-semibold text-slate-700">
                        Mark All Present
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingStaff || isLoadingAttendance ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : staffList.filter(s => s.is_active).length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 border rounded-lg">
                      <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                      <h3 className="text-base font-bold text-slate-700">No Active Employees</h3>
                      <p className="text-sm text-slate-400">Activate employees in the Directory first.</p>
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="px-4 py-3">Employee</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3 text-center">Attendance Status</th>
                            <th className="px-4 py-3 text-right">Last Updated</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {staffList.filter(s => s.is_active).map((staff) => {
                            const att = currentAttendanceMap.get(staff.id);
                            
                            return (
                              <tr key={staff.id} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-bold text-slate-900">{staff.name}</td>
                                <td className="px-4 py-3 text-xs capitalize text-slate-500 font-semibold">{staff.role}</td>
                                <td className="px-4 py-3">
                                  <div className="flex justify-center items-center gap-1">
                                    <button
                                      onClick={() => handleAttendanceChange(staff.id, 'present')}
                                      className={
                                        "px-3 py-1 rounded text-xs font-black uppercase transition " +
                                        (att?.status === 'present'
                                          ? 'bg-emerald-500 text-white shadow-sm'
                                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                                      }
                                    >
                                      Present
                                    </button>
                                    <button
                                      onClick={() => handleAttendanceChange(staff.id, 'absent')}
                                      className={
                                        "px-3 py-1 rounded text-xs font-black uppercase transition " +
                                        (att?.status === 'absent'
                                          ? 'bg-rose-500 text-white shadow-sm'
                                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                                      }
                                    >
                                      Absent
                                    </button>
                                    <button
                                      onClick={() => handleAttendanceChange(staff.id, 'half_day')}
                                      className={
                                        "px-3 py-1 rounded text-xs font-black uppercase transition " +
                                        (att?.status === 'half_day'
                                          ? 'bg-amber-500 text-white shadow-sm'
                                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                                      }
                                    >
                                      Half Day
                                    </button>
                                    <button
                                      onClick={() => handleAttendanceChange(staff.id, 'leave')}
                                      className={
                                        "px-3 py-1 rounded text-xs font-black uppercase transition " +
                                        (att?.status === 'leave'
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                                      }
                                    >
                                      Leave
                                    </button>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right text-xs text-slate-400">
                                  {att?.created_at ? format(parseISO(att.created_at), 'hh:mm a') : 'Not marked today'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: PAYROLL SHEET */}
            <TabsContent value="payroll" className="m-0 space-y-4">
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle>Payroll Calculations</CardTitle>
                      <CardDescription>Monthly salary adjustments, bonus, advances, and voucher generation</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md border text-sm">
                        <Calendar className="h-4 w-4 text-slate-500" />
                        <input 
                          type="month" 
                          value={selectedMonth} 
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="bg-transparent border-none outline-none font-bold text-slate-800"
                        />
                      </div>
                      <Button variant="outline" onClick={() => refetchPayroll()} className="font-semibold text-slate-600 gap-1.5">
                        Recalculate
                      </Button>
                      <Button 
                        onClick={handleSavePayroll} 
                        disabled={finalPayrolls.length === 0 || savePayrollMutation.isPending}
                        className="font-semibold shadow-sm"
                      >
                        {savePayrollMutation.isPending ? 'Saving...' : 'Save Adjustments'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingStaff || isLoadingPayroll ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : finalPayrolls.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 border rounded-lg">
                      <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                      <h3 className="text-base font-bold text-slate-700">No Active Employees</h3>
                      <p className="text-sm text-slate-400">Ensure active staff exist in the directory.</p>
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="px-4 py-3">Employee</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3 text-right">Base Salary / Rate</th>
                            <th className="px-4 py-3 text-center">Attendance (P / A)</th>
                            <th className="px-4 py-3 w-24 text-right">Bonus (₹)</th>
                            <th className="px-4 py-3 w-24 text-right">Advances (₹)</th>
                            <th className="px-4 py-3 w-24 text-right">Deductions (₹)</th>
                            <th className="px-4 py-3 text-right font-black">Net Salary (₹)</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {finalPayrolls.map((payroll) => {
                            const staff = staffList.find(s => s.id === payroll.staff_id);
                            if (!staff) return null;

                            const adj = payrollAdjustments[payroll.staff_id] || {
                              bonus: payroll.bonus,
                              advances: payroll.advances,
                              deductions: payroll.deductions
                            };

                            // Check if a voucher is already generated for this payroll month
                            const isVoucherGenerated = vouchersList.some(v => v.staff_id === payroll.staff_id);

                            return (
                              <tr key={payroll.staff_id} className="hover:bg-slate-50/50 font-medium">
                                <td className="px-4 py-3">
                                  <div className="font-bold text-slate-900">{staff.name}</div>
                                  <div className="text-slate-400 text-xs capitalize">{staff.role}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge variant="outline" className="capitalize font-semibold">
                                    {staff.salary_type === 'monthly' ? 'Monthly' : 'Daily'}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-slate-800">
                                  ₹{payroll.base_salary}
                                </td>
                                <td className="px-4 py-3 text-center font-bold">
                                  <span className="text-emerald-600">{payroll.present_days} P</span>
                                  <span className="text-slate-300 px-1">/</span>
                                  <span className="text-rose-600">{payroll.absent_days} A</span>
                                </td>
                                <td className="px-4 py-3">
                                  <Input
                                    type="number"
                                    min="0"
                                    className="h-8 text-right bg-slate-50 font-bold"
                                    value={adj.bonus || ''}
                                    onChange={(e) => handleAdjustmentChange(payroll.staff_id, 'bonus', e.target.value)}
                                    disabled={isVoucherGenerated}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <Input
                                    type="number"
                                    min="0"
                                    className="h-8 text-right bg-slate-50 font-bold"
                                    value={adj.advances || ''}
                                    onChange={(e) => handleAdjustmentChange(payroll.staff_id, 'advances', e.target.value)}
                                    disabled={isVoucherGenerated}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <Input
                                    type="number"
                                    min="0"
                                    className="h-8 text-right bg-slate-50 font-bold"
                                    value={adj.deductions || ''}
                                    onChange={(e) => handleAdjustmentChange(payroll.staff_id, 'deductions', e.target.value)}
                                    disabled={isVoucherGenerated}
                                  />
                                </td>
                                <td className="px-4 py-3 text-right font-black text-slate-900 text-base">
                                  ₹{payroll.net_salary}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {isVoucherGenerated ? (
                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Generated</Badge>
                                  ) : (
                                    <Button 
                                      onClick={() => handleGenerateVoucher(payroll)}
                                      size="sm"
                                      variant="secondary"
                                      className="font-bold text-xs"
                                    >
                                      Generate Voucher
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: SALARY VOUCHERS */}
            <TabsContent value="vouchers" className="m-0 space-y-4">
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle>Payroll Vouchers</CardTitle>
                      <CardDescription>View, update payment status, and print vouchers for the selected month</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md border text-sm w-fit self-end">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      <input 
                        type="month" 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent border-none outline-none font-bold text-slate-800"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingVouchers ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : vouchersList.length === 0 ? (
                    <div className="text-center py-12 border border-dashed rounded-lg bg-slate-50">
                      <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-slate-700">No Vouchers Generated</h3>
                      <p className="text-sm text-slate-500">Go to the Payroll Sheet to generate vouchers for {selectedMonth}.</p>
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="px-4 py-3">Voucher ID</th>
                            <th className="px-4 py-3">Employee Name</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3 text-right">Net Paid</th>
                            <th className="px-4 py-3">Payment Status</th>
                            <th className="px-4 py-3">Payment Date</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white font-medium">
                          {vouchersList.map((voucher) => (
                            <tr key={voucher.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-bold text-slate-900">{voucher.voucher_id}</td>
                              <td className="px-4 py-3 font-bold text-slate-800">{voucher.staff_name}</td>
                              <td className="px-4 py-3 capitalize text-slate-500 text-xs">{voucher.staff_role}</td>
                              <td className="px-4 py-3 text-right font-black text-slate-900 text-base">₹{voucher.net_salary}</td>
                              <td className="px-4 py-3">
                                {voucher.payment_status === 'Paid' ? (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">Paid</Badge>
                                ) : (
                                  <Badge className="bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50">Pending</Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-400">
                                {voucher.payment_date 
                                  ? format(parseISO(voucher.payment_date), 'dd MMM yyyy, hh:mm a') 
                                  : '-'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                  {voucher.payment_status === 'Pending' ? (
                                    <Button 
                                      onClick={() => markVoucherPaidMutation.mutate({ id: voucher.id, status: 'Paid' })}
                                      size="sm"
                                      className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs"
                                    >
                                      Mark Paid
                                    </Button>
                                  ) : (
                                    <Button 
                                      onClick={() => markVoucherPaidMutation.mutate({ id: voucher.id, status: 'Pending' })}
                                      size="sm"
                                      variant="outline"
                                      className="font-bold text-xs text-slate-600 border-slate-300"
                                    >
                                      Mark Pending
                                    </Button>
                                  )}
                                  <Button 
                                    onClick={() => handlePrintVoucher(voucher)}
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 text-slate-600 border-slate-300"
                                    title="Print slip"
                                  >
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        {/* MODAL: STAFF CREATION/EDIT */}
        <Dialog open={isStaffModalOpen} onOpenChange={setIsStaffModalOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="font-black uppercase tracking-tight text-slate-900">
                {editingStaff ? 'Edit Employee Details' : 'Add New Employee'}
              </DialogTitle>
              <DialogDescription>
                Fill in the basic and salary details for the employee profile.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveStaff} className="space-y-4 py-2 font-medium">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="staff-name" className="font-bold text-xs uppercase text-slate-600">Full Name</Label>
                  <Input 
                    id="staff-name" 
                    placeholder="Enter full name" 
                    value={formName} 
                    onChange={(e) => setFormName(e.target.value)} 
                    required 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-role" className="font-bold text-xs uppercase text-slate-600">Role</Label>
                  <Select value={formRole} onValueChange={(val: any) => setFormRole(val)}>
                    <SelectTrigger id="staff-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="waiter">Waiter / Server</SelectItem>
                      <SelectItem value="cashier">Cashier</SelectItem>
                      <SelectItem value="chef">Chef / Kitchen</SelectItem>
                      <SelectItem value="cleaner">Cleaner</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-joining" className="font-bold text-xs uppercase text-slate-600">Joining Date</Label>
                  <Input 
                    id="staff-joining" 
                    type="date" 
                    value={formJoiningDate} 
                    onChange={(e) => setFormJoiningDate(e.target.value)} 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-phone" className="font-bold text-xs uppercase text-slate-600">Phone</Label>
                  <Input 
                    id="staff-phone" 
                    placeholder="Phone number" 
                    value={formPhone} 
                    onChange={(e) => setFormPhone(e.target.value)} 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-pin" className="font-bold text-xs uppercase text-slate-600">Login PIN (4 Digits) *</Label>
                  <Input 
                    id="staff-pin" 
                    type="password"
                    maxLength={4}
                    placeholder="e.g. 1234" 
                    value={formPin} 
                    onChange={(e) => setFormPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    required 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-salary-type" className="font-bold text-xs uppercase text-slate-600">Salary Model</Label>
                  <Select value={formSalaryType} onValueChange={(val: any) => setFormSalaryType(val)}>
                    <SelectTrigger id="staff-salary-type">
                      <SelectValue placeholder="Select salary model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly Salary</SelectItem>
                      <SelectItem value="daily">Daily Wages</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-salary-amount" className="font-bold text-xs uppercase text-slate-600">
                    {formSalaryType === 'monthly' ? 'Monthly Salary (₹)' : 'Daily Rate (₹)'}
                  </Label>
                  <Input 
                    id="staff-salary-amount" 
                    type="number"
                    placeholder="e.g. 15000" 
                    value={formSalaryAmount} 
                    onChange={(e) => setFormSalaryAmount(e.target.value)} 
                    required
                  />
                </div>
                
                {editingStaff && (
                  <div className="col-span-2 flex items-center gap-2 pt-2">
                    <input
                      id="staff-active"
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <Label htmlFor="staff-active" className="font-bold text-slate-700 text-sm cursor-pointer select-none">
                      Is Active Employee
                    </Label>
                  </div>
                )}
              </div>
              <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setIsStaffModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createStaffMutation.isPending || updateStaffMutation.isPending}>
                  {createStaffMutation.isPending || updateStaffMutation.isPending ? 'Saving...' : 'Save Profile'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* MODAL: DELETE CONFIRMATION */}
        <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-600 font-black uppercase text-base">
                <AlertCircle className="h-5 w-5" /> Confirm Employee Removal
              </DialogTitle>
              <DialogDescription className="pt-2 font-medium">
                Are you sure you want to delete employee <strong className="text-slate-900">"{staffToDelete?.name}"</strong>? This will permanently delete their profile and cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleConfirmDelete}
                disabled={deleteStaffMutation.isPending}
              >
                {deleteStaffMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL: DATABASE SETUP GUIDE */}
        <Dialog open={isSetupDialogOpen} onOpenChange={setIsSetupDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-black uppercase text-lg text-slate-900">
                <Database className="h-5 w-5 text-primary" /> Setup Staff Management Tables
              </DialogTitle>
              <DialogDescription className="font-semibold text-slate-600">
                Follow these 2 simple steps to enable cloud database synchronization for staff members, attendance, and payroll.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 my-2 text-sm text-slate-700">
              <div className="border rounded-md p-4 bg-slate-50 space-y-2">
                <h5 className="font-bold text-slate-800 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-xs font-semibold">1</span>
                  Open Supabase SQL Editor
                </h5>
                <p className="text-xs text-slate-600 pl-7 font-medium">
                  Click the link below to open the SQL editor in your Supabase dashboard:
                </p>
                <div className="pl-7 pt-1">
                  <a
                    href="https://supabase.com/dashboard/project/jrzpsrmticjbpobloqej/sql/new"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-black uppercase"
                  >
                    Open Supabase SQL Editor <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <div className="border rounded-md p-4 bg-slate-50 space-y-2">
                <h5 className="font-bold text-slate-800 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-xs font-semibold">2</span>
                  Copy & Run SQL Migration Script
                </h5>
                <p className="text-xs text-slate-600 pl-7 font-medium">
                  Copy the SQL code block below, paste it into the Supabase editor window, and click <strong className="text-slate-800">Run</strong>.
                </p>
                <div className="pl-7 relative">
                  <pre className="text-[10px] bg-slate-900 text-slate-200 p-3 rounded-md overflow-x-auto max-h-60 font-mono">
                    {MIGRATION_SQL_STRING}
                  </pre>
                  <Button
                    size="sm"
                    className="absolute right-2 top-2 h-7 px-2.5 text-xs font-bold"
                    onClick={() => {
                      navigator.clipboard.writeText(MIGRATION_SQL_STRING);
                      toast.success("SQL script copied to clipboard!");
                    }}
                  >
                    Copy SQL
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
              <Button onClick={() => window.location.reload()} className="w-full sm:w-auto font-bold uppercase">
                I've run the SQL (Refresh Page)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PRINT SLIP CONTAINER - HIDDEN IN WEB VIEWS, VISIBLE DURING PRINT */}
        {printingVoucher && (
          <div className="hidden">
            <div ref={printRef} className="p-8 max-w-sm mx-auto text-slate-800 font-sans text-xs bg-white">
              {/* Header */}
              <div className="text-center border-b border-slate-300 pb-4 mb-4">
                <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
                  {tenant?.restaurant_name || 'GENX CLOUD POS'}
                </h2>
                {tenant?.address && <p className="text-[10px] text-slate-500">{tenant.address}</p>}
                {tenant?.phone && <p className="text-[10px] text-slate-500">Ph: {tenant.phone}</p>}
                <h3 className="text-xs font-bold uppercase mt-2 tracking-wide text-slate-700 bg-slate-100 py-1">
                  Salary Payment Voucher
                </h3>
              </div>

              {/* Info Details */}
              <div className="grid grid-cols-2 gap-y-1 mb-4 pb-3 border-b border-dotted border-slate-300">
                <div>Voucher ID:</div>
                <div className="font-bold text-right">{printingVoucher.voucher_id}</div>
                <div>Voucher Date:</div>
                <div className="text-right">
                  {printingVoucher.payment_date 
                    ? format(parseISO(printingVoucher.payment_date), 'dd MMM yyyy') 
                    : format(new Date(), 'dd MMM yyyy')}
                </div>
                <div>Payroll Month:</div>
                <div className="font-bold text-right">{printingVoucher.month}</div>
                <div>Payment Status:</div>
                <div className="font-bold text-right">{printingVoucher.payment_status}</div>
              </div>

              {/* Staff Details */}
              <div className="mb-4 pb-3 border-b border-slate-300">
                <h4 className="font-bold uppercase text-[10px] text-slate-500 mb-1">Employee Information</h4>
                <div className="grid grid-cols-2 gap-y-1">
                  <div>Employee Name:</div>
                  <div className="font-bold text-right">{printingVoucher.staff_name}</div>
                  <div>Job Designation:</div>
                  <div className="capitalize text-right">{printingVoucher.staff_role}</div>
                </div>
              </div>

              {/* Financial Breakdowns */}
              <div className="mb-6">
                <h4 className="font-bold uppercase text-[10px] text-slate-500 mb-1">Payment Breakdown</h4>
                <div className="space-y-1 border-b border-slate-200 pb-2">
                  <div className="flex justify-between">
                    <span>Base Salary / Rate:</span>
                    <span className="font-bold">₹{printingVoucher.net_salary}</span> 
                    {/* Simplified for printing breakdown. In a complete slip, individual breakdown fields would reside here */}
                  </div>
                </div>
                <div className="flex justify-between pt-3 text-sm font-black text-slate-900 uppercase">
                  <span>Net Paid Salary:</span>
                  <span>₹{printingVoucher.net_salary}</span>
                </div>
              </div>

              {/* Footer Signatures */}
              <div className="mt-12 grid grid-cols-2 gap-x-8 text-center pt-8 border-t border-slate-200">
                <div>
                  <div className="border-b border-slate-400 h-6"></div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Staff Signature</div>
                </div>
                <div>
                  <div className="border-b border-slate-400 h-6"></div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Manager Signature</div>
                </div>
              </div>

              <div className="text-center text-[8px] text-slate-400 mt-8">
                Generated via GenX Cloud POS System.
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default StaffManagementPage;
