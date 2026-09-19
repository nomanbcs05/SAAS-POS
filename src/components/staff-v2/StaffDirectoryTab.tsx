import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffV2Api, EmployeeV2 } from '@/services/staffV2Api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Loader2, 
  CreditCard, 
  Landmark, 
  Briefcase, 
  AlertCircle,
  TrendingDown
} from 'lucide-react';

interface StaffDirectoryTabProps {
  tenantId?: string;
}

export const StaffDirectoryTab: React.FC<StaffDirectoryTabProps> = ({ tenantId }) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeV2 | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeV2 | null>(null);

  // Salary Advance modal state
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceEmp, setAdvanceEmp] = useState<EmployeeV2 | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [advanceMonth, setAdvanceMonth] = useState(new Date().toISOString().slice(0, 7));

  // Form states
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('waiter');
  const [formPhone, setFormPhone] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formCnic, setFormCnic] = useState('');
  const [formBankAccount, setFormBankAccount] = useState('');
  const [formSalaryType, setFormSalaryType] = useState<'monthly' | 'daily' | 'hourly'>('monthly');
  const [formSalaryAmount, setFormSalaryAmount] = useState('');
  const [formJoiningDate, setFormJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [formIsActive, setFormIsActive] = useState(true);

  // Fetch employees
  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ['staff-v2-list', tenantId],
    queryFn: () => staffV2Api.staff.getAll(tenantId),
    staleTime: 60 * 1000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newEmp: Omit<EmployeeV2, 'id' | 'created_at'>) => staffV2Api.staff.create(newEmp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-v2-list'] });
      queryClient.invalidateQueries({ queryKey: ['staff-mgmt'] });
      toast.success('Employee profile created successfully');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      const msg = err?.message || '';
      if (msg.includes('naam par add hai')) {
        toast.error(msg, { duration: 6000, style: { background: '#fee2e2', color: '#991b1b', fontWeight: '600' } });
      } else {
        toast.error('Failed to create employee: ' + msg);
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EmployeeV2> }) => staffV2Api.staff.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-v2-list'] });
      queryClient.invalidateQueries({ queryKey: ['staff-mgmt'] });
      toast.success('Employee profile updated successfully');
      setIsModalOpen(false);
      setEditingEmployee(null);
      resetForm();
    },
    onError: (err: any) => toast.error('Failed to update employee: ' + err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => staffV2Api.staff.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-v2-list'] });
      queryClient.invalidateQueries({ queryKey: ['staff-mgmt'] });
      toast.success('Employee removed successfully');
      setIsDeleteOpen(false);
      setEmployeeToDelete(null);
    },
    onError: (err: any) => toast.error('Failed to delete employee: ' + err.message)
  });

  // Advance mutation
  const addAdvanceMutation = useMutation({
    mutationFn: (data: { employee_id: string; amount: number; reason: string; date: string; deducted_in_month: string }) =>
      staffV2Api.advances.add({ ...data }, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-v2-calc'] });
      toast.success('Salary advance recorded successfully and will reflect in payroll');
      setIsAdvanceModalOpen(false);
      setAdvanceAmount('');
      setAdvanceReason('');
      setAdvanceEmp(null);
    },
    onError: (err: any) => toast.error('Failed to record advance: ' + (err?.message || 'Error'))
  });

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: EmployeeV2) => {
    setEditingEmployee(emp);
    setFormName(emp.name);
    setFormRole(emp.role);
    setFormPhone(emp.phone || '');
    setFormPin(emp.pin || '');
    setFormCnic(emp.cnic || '');
    setFormBankAccount(emp.bank_account || '');
    setFormSalaryType(emp.salary_type || 'monthly');
    setFormSalaryAmount(String(emp.salary_amount || ''));
    setFormJoiningDate(emp.joining_date || new Date().toISOString().split('T')[0]);
    setFormIsActive(emp.is_active !== false);
    setIsModalOpen(true);
  };

  const handleOpenAdvance = (emp: EmployeeV2) => {
    setAdvanceEmp(emp);
    setAdvanceAmount('');
    setAdvanceReason('');
    setAdvanceDate(new Date().toISOString().split('T')[0]);
    setAdvanceMonth(new Date().toISOString().slice(0, 7));
    setIsAdvanceModalOpen(true);
  };

  const handleRecordAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceEmp) return;
    const amt = Number(advanceAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid advance amount');
      return;
    }
    addAdvanceMutation.mutate({
      employee_id: advanceEmp.id,
      amount: amt,
      reason: advanceReason.trim() || 'Salary Advance',
      date: advanceDate,
      deducted_in_month: advanceMonth,
    });
  };

  const resetForm = () => {
    setFormName('');
    setFormRole('waiter');
    setFormPhone('');
    setFormPin('');
    setFormCnic('');
    setFormBankAccount('');
    setFormSalaryType('monthly');
    setFormSalaryAmount('');
    setFormJoiningDate(new Date().toISOString().split('T')[0]);
    setFormIsActive(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Employee name is required');
      return;
    }
    const salaryVal = Number(formSalaryAmount);
    if (isNaN(salaryVal) || salaryVal < 0) {
      toast.error('Please enter a valid salary amount');
      return;
    }

    const payload: Omit<EmployeeV2, 'id' | 'created_at'> = {
      name: formName.trim(),
      role: formRole,
      phone: formPhone.trim() || undefined,
      email: `${formName.toLowerCase().replace(/\s+/g, '')}@genxpos.com`,
      pin: formPin.trim() || '1234',
      cnic: formCnic.trim() || undefined,
      bank_account: formBankAccount.trim() || undefined,
      salary_type: formSalaryType,
      salary_amount: salaryVal,
      joining_date: formJoiningDate,
      is_active: formIsActive,
      restaurant_id: tenantId || null,
    };

    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredStaff = staffList.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.phone && s.phone.includes(searchQuery)) ||
    (s.cnic && s.cnic.includes(searchQuery)) ||
    (s.bank_account && s.bank_account.includes(searchQuery))
  );

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Staff Directory (PRO V2)
              </CardTitle>
              <CardDescription>
                Manage employee personal data, CNIC, bank accounts, and compensation structures
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name, CNIC, phone, bank..." 
                  className="pl-9 bg-slate-50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button onClick={handleOpenAdd} className="gap-2 font-bold shadow-sm">
                <Plus className="h-4 w-4" /> Add Employee
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg bg-slate-50">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">No Employees Found</h3>
              <p className="text-xs text-slate-500">Click "Add Employee" to register staff members with CNIC and Bank details.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">CNIC / ID</th>
                    <th className="px-4 py-3">Bank Account</th>
                    <th className="px-4 py-3">Salary Model</th>
                    <th className="px-4 py-3">Joining Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-700">
                  {filteredStaff.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <div>{emp.name}</div>
                        <div className="text-xs font-normal text-slate-500">{emp.phone || 'No phone'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="capitalize font-semibold border-slate-300">
                          {emp.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                        {emp.cnic ? (
                          <span className="flex items-center gap-1">
                            <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                            {emp.cnic}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                        {emp.bank_account ? (
                          <span className="flex items-center gap-1">
                            <Landmark className="h-3.5 w-3.5 text-slate-400" />
                            {emp.bank_account}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Cash payout</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Badge className={
                            emp.salary_type === 'monthly'
                              ? 'bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200 capitalize'
                              : emp.salary_type === 'hourly'
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200 capitalize'
                              : 'bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200 capitalize'
                          } variant="outline">
                            {emp.salary_type || 'monthly'}
                          </Badge>
                          <span className="font-bold text-slate-900">Rs {Number(emp.salary_amount || 0).toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{emp.joining_date || '-'}</td>
                      <td className="px-4 py-3">
                        {emp.is_active ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">Active</Badge>
                        ) : (
                          <Badge className="bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-bold text-amber-700 border-amber-300 hover:bg-amber-50 gap-1"
                            onClick={() => handleOpenAdvance(emp)}
                            title="Record Salary Advance"
                          >
                            <TrendingDown className="h-3.5 w-3.5" /> Advance
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8 text-slate-600 hover:text-slate-900"
                            onClick={() => handleOpenEdit(emp)}
                            title="Edit Employee"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8 text-rose-600 hover:text-rose-950 hover:bg-rose-50 border-rose-200"
                            onClick={() => {
                              setEmployeeToDelete(emp);
                              setIsDeleteOpen(true);
                            }}
                            title="Delete Employee"
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

      {/* EDIT / CREATE MODAL WITH CNIC, BANK ACCOUNT, SALARY TYPE */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              {editingEmployee ? 'Edit Employee Details (PRO)' : 'Add New Employee (PRO)'}
            </DialogTitle>
            <DialogDescription>
              Enter employee profile, National CNIC, Bank Account, and Salary structure.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2 font-medium">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="v2-name" className="font-bold text-xs uppercase text-slate-600">Full Name *</Label>
                <Input 
                  id="v2-name" 
                  placeholder="e.g. Muhammad Ali" 
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)} 
                  required 
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="v2-role" className="font-bold text-xs uppercase text-slate-600">Role / Job *</Label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger id="v2-role" className="bg-slate-50 font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashier">Cashier</SelectItem>
                    <SelectItem value="waiter">Waiter</SelectItem>
                    <SelectItem value="chef">Chef / Kitchen</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="cleaner">Cleaner</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="v2-phone" className="font-bold text-xs uppercase text-slate-600">Mobile Phone</Label>
                <Input 
                  id="v2-phone" 
                  placeholder="0300-1234567" 
                  value={formPhone} 
                  onChange={(e) => setFormPhone(e.target.value)} 
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="v2-cnic" className="font-bold text-xs uppercase text-slate-600 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-primary" />
                  National CNIC / ID Card No (Unique)
                </Label>
                <Input 
                  id="v2-cnic" 
                  placeholder="e.g. 35201-1234567-1" 
                  value={formCnic} 
                  onChange={(e) => setFormCnic(e.target.value)} 
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">Ensures complete identity validation & zero duplicate records.</p>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="v2-bank" className="font-bold text-xs uppercase text-slate-600 flex items-center gap-1.5">
                  <Landmark className="h-3.5 w-3.5 text-primary" />
                  Bank Account / IBAN / Raast
                </Label>
                <Input 
                  id="v2-bank" 
                  placeholder="e.g. PK36 HABB 0001 2345 6789 01" 
                  value={formBankAccount} 
                  onChange={(e) => setFormBankAccount(e.target.value)} 
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="v2-sal-type" className="font-bold text-xs uppercase text-slate-600">Salary Model</Label>
                <Select value={formSalaryType} onValueChange={(val: any) => setFormSalaryType(val)}>
                  <SelectTrigger id="v2-sal-type" className="bg-slate-50 font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly Fixed</SelectItem>
                    <SelectItem value="daily">Daily Wage</SelectItem>
                    <SelectItem value="hourly">Hourly Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="v2-sal-amt" className="font-bold text-xs uppercase text-slate-600">Base Salary / Rate (Rs) *</Label>
                <Input 
                  id="v2-sal-amt" 
                  type="number" 
                  placeholder="30000" 
                  value={formSalaryAmount} 
                  onChange={(e) => setFormSalaryAmount(e.target.value)} 
                  required 
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="v2-join" className="font-bold text-xs uppercase text-slate-600">Joining Date</Label>
                <Input 
                  id="v2-join" 
                  type="date" 
                  value={formJoiningDate} 
                  onChange={(e) => setFormJoiningDate(e.target.value)} 
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="v2-pin" className="font-bold text-xs uppercase text-slate-600">POS Login PIN</Label>
                <Input 
                  id="v2-pin" 
                  placeholder="1234" 
                  maxLength={6} 
                  value={formPin} 
                  onChange={(e) => setFormPin(e.target.value)} 
                />
              </div>

              <div className="col-span-2 pt-2 flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="v2-active" 
                  checked={formIsActive} 
                  onChange={(e) => setFormIsActive(e.target.checked)} 
                  className="rounded border-slate-300 h-4 w-4 text-primary"
                />
                <Label htmlFor="v2-active" className="text-xs font-semibold cursor-pointer">
                  Active Employee (Included in Live Attendance & Monthly Payroll)
                </Label>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="font-bold">
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Profile'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* RECORD SALARY ADVANCE MODAL FROM STAFF DIRECTORY */}
      <Dialog open={isAdvanceModalOpen} onOpenChange={setIsAdvanceModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-amber-600" /> Add Salary Advance
            </DialogTitle>
            <DialogDescription>
              Record an advance for <strong className="text-slate-900">{advanceEmp?.name}</strong>.
              It will be automatically deducted from the specified month's payroll.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRecordAdvance} className="space-y-4 py-2 font-medium">
            <div className="space-y-1.5">
              <Label className="font-bold text-xs uppercase text-slate-600">Advance Amount (Rs) *</Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 5000"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold text-xs uppercase text-slate-600">Reason / Note</Label>
              <Input
                placeholder="e.g. Emergency advance, Medical expenses"
                value={advanceReason}
                onChange={(e) => setAdvanceReason(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-bold text-xs uppercase text-slate-600">Advance Date *</Label>
                <Input
                  type="date"
                  value={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-xs uppercase text-slate-600">Deduct in Month *</Label>
                <Input
                  type="month"
                  value={advanceMonth}
                  onChange={(e) => setAdvanceMonth(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsAdvanceModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addAdvanceMutation.isPending} className="font-bold bg-amber-600 hover:bg-amber-700">
                {addAdvanceMutation.isPending ? 'Recording...' : 'Record Advance'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM DIALOG */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 font-bold uppercase">
              <AlertCircle className="h-5 w-5" /> Confirm Employee Removal
            </DialogTitle>
            <DialogDescription className="pt-2 font-medium">
              Are you sure you want to remove <strong className="text-slate-900">"{employeeToDelete?.name}"</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => employeeToDelete && deleteMutation.mutate(employeeToDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
