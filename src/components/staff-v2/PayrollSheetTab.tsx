import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffV2Api, PayrollItemV2 } from '@/services/staffV2Api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Wallet,
  Calendar,
  Plus,
  Loader2,
  RefreshCw,
  FileText,
  ExternalLink,
  TrendingDown,
  Users,
  CheckCircle2
} from 'lucide-react';

interface PayrollSheetTabProps {
  tenantId?: string;
  restaurantName?: string;
}

export const PayrollSheetTab: React.FC<PayrollSheetTabProps> = ({ tenantId, restaurantName }) => {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Local bonus/deduction adjustments (before save)
  const [adjustments, setAdjustments] = useState<Record<string, { bonus: number; deductions: number }>>({});

  // Add Advance Modal state
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceEmployeeId, setAdvanceEmployeeId] = useState('');
  const [advanceEmployeeName, setAdvanceEmployeeName] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [advanceMonth, setAdvanceMonth] = useState(selectedMonth);

  // Voucher generation loading per employee
  const [generatingVoucherFor, setGeneratingVoucherFor] = useState<string | null>(null);

  // Fetch payroll calculation (API B.4)
  const { data: payrollList = [], isLoading, refetch } = useQuery<PayrollItemV2[]>({
    queryKey: ['payroll-v2-calc', selectedMonth, tenantId],
    queryFn: () => staffV2Api.payroll.calculate(selectedMonth, tenantId),
    staleTime: 2 * 60 * 1000,
  });

  // Merge local adjustments into payroll
  const finalPayrolls: PayrollItemV2[] = useMemo(() => {
    return payrollList.map(p => {
      const adj = adjustments[p.employee_id];
      if (!adj) return p;

      const bonus = adj.bonus ?? p.bonus;
      const deductions = adj.deductions ?? p.deductions;
      const perDayRate = p.base_salary / 30;
      const absentDeduction = p.absent_days * perDayRate;
      const totalDeductions = deductions + absentDeduction;

      let netSalary = 0;
      if (p.salary_type === 'daily') {
        netSalary = (p.present_days * p.base_salary) + bonus - p.advances;
      } else {
        netSalary = p.base_salary + bonus - p.advances - totalDeductions;
      }

      netSalary = Math.max(0, Math.round(netSalary * 100) / 100);

      return { ...p, bonus, deductions, net_salary: netSalary };
    });
  }, [payrollList, adjustments]);

  const handleAdjustmentChange = (employeeId: string, field: 'bonus' | 'deductions', value: string) => {
    const val = Number(value) || 0;
    setAdjustments(prev => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] || { bonus: 0, deductions: 0 }),
        [field]: val
      }
    }));
  };

  // Add Advance Mutation (API B.3)
  const addAdvanceMutation = useMutation({
    mutationFn: (data: { employee_id: string; amount: number; reason: string; date: string; deducted_in_month: string }) =>
      staffV2Api.advances.add({ ...data }, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-v2-calc'] });
      toast.success('Salary advance recorded and will reflect in payroll');
      setIsAdvanceModalOpen(false);
      setAdvanceAmount('');
      setAdvanceReason('');
      setAdvanceEmployeeId('');
      setAdvanceEmployeeName('');
    },
    onError: (err: any) => toast.error('Failed to add advance: ' + err.message)
  });

  const handleAddAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(advanceAmount);
    if (!advanceEmployeeId) { toast.error('Select an employee'); return; }
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }

    addAdvanceMutation.mutate({
      employee_id: advanceEmployeeId,
      amount: amt,
      reason: advanceReason.trim() || 'Salary Advance',
      date: advanceDate,
      deducted_in_month: advanceMonth,
    });
  };

  // Generate Voucher Mutation (API B.5)
  const handleGenerateVoucher = async (payroll: PayrollItemV2) => {
    if (payroll.is_voucher_generated) {
      if (payroll.pdf_url) window.open(payroll.pdf_url, '_blank');
      return;
    }

    setGeneratingVoucherFor(payroll.employee_id);
    try {
      const result = await staffV2Api.vouchers.generate({
        employee_id: payroll.employee_id,
        month: selectedMonth,
        base_salary: payroll.base_salary,
        present_days: payroll.present_days,
        absent_days: payroll.absent_days,
        bonus: payroll.bonus,
        advances: payroll.advances,
        deductions: payroll.deductions,
        net_salary: payroll.net_salary,
      }, tenantId);

      queryClient.invalidateQueries({ queryKey: ['payroll-v2-calc'] });
      queryClient.invalidateQueries({ queryKey: ['vouchers-v2-list'] });

      toast.success('Salary voucher generated successfully!', {
        description: result.voucher_no,
        action: result.pdf_url ? {
          label: 'View PDF',
          onClick: () => window.open(result.pdf_url, '_blank')
        } : undefined
      });

      if (result.pdf_url) {
        window.open(result.pdf_url, '_blank');
      }
    } catch (err: any) {
      toast.error('Voucher generation failed: ' + err.message);
    } finally {
      setGeneratingVoucherFor(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" /> Payroll Sheet (PRO V2)
              </CardTitle>
              <CardDescription>
                Net Salary = Base + Bonus − Advances − (Absent × Base/30)
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md border text-sm">
                <Calendar className="h-4 w-4 text-slate-500" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setAdjustments({});
                  }}
                  className="bg-transparent border-none outline-none font-bold text-slate-800"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => { setAdjustments({}); refetch(); }}
                className="font-semibold text-slate-600 gap-1.5"
              >
                <RefreshCw className="h-4 w-4" /> Recalculate
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : finalPayrolls.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 border rounded-lg border-dashed">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">No Active Employees Found</h3>
              <p className="text-xs text-slate-400">Add active employees in the Staff Directory tab first.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[900px]">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Base Salary</th>
                    <th className="px-4 py-3 text-center">Present / Absent</th>
                    <th className="px-4 py-3 w-28 text-right">Bonus (Rs)</th>
                    <th className="px-4 py-3 w-28 text-right">Deductions (Rs)</th>
                    <th className="px-4 py-3 text-right">Advances</th>
                    <th className="px-4 py-3 text-right font-black">Net Salary</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-medium">
                  {finalPayrolls.map((payroll) => {
                    const adj = adjustments[payroll.employee_id] || { bonus: payroll.bonus, deductions: payroll.deductions };
                    const isGenerating = generatingVoucherFor === payroll.employee_id;
                    const locked = !!payroll.is_voucher_generated;

                    return (
                      <tr key={payroll.employee_id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{payroll.name}</div>
                          <div className="text-slate-400 text-[11px] capitalize">{payroll.role}</div>
                          {payroll.cnic && <div className="text-[10px] font-mono text-slate-400">ID: {payroll.cnic}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="capitalize font-semibold text-xs">
                            {payroll.salary_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                          <div>Rs {payroll.base_salary.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-400">Rate: Rs {payroll.per_day_rate}/day</div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold">
                          <span className="text-emerald-600">{payroll.present_days}P</span>
                          <span className="text-slate-300 px-1">/</span>
                          <span className="text-rose-600">{payroll.absent_days}A</span>
                        </td>
                        {/* Part C.3: Bonus input */}
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            className="h-8 text-right bg-slate-50 font-bold w-24"
                            value={adj.bonus || ''}
                            onChange={(e) => handleAdjustmentChange(payroll.employee_id, 'bonus', e.target.value)}
                            disabled={locked}
                            placeholder="0"
                          />
                        </td>
                        {/* Part C.3: Deductions input */}
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            className="h-8 text-right bg-slate-50 font-bold w-24"
                            value={adj.deductions || ''}
                            onChange={(e) => handleAdjustmentChange(payroll.employee_id, 'deductions', e.target.value)}
                            disabled={locked}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-rose-700 font-bold">
                          - Rs {payroll.advances.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-900 text-base">
                          Rs {payroll.net_salary.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col gap-1.5 items-end">
                            {/* Part C.3: Add Advance Button */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="font-bold text-xs text-amber-700 border-amber-300 hover:bg-amber-50 gap-1"
                              onClick={() => {
                                setAdvanceEmployeeId(payroll.employee_id);
                                setAdvanceEmployeeName(payroll.name);
                                setAdvanceMonth(selectedMonth);
                                setIsAdvanceModalOpen(true);
                              }}
                            >
                              <TrendingDown className="h-3.5 w-3.5" /> Add Advance
                            </Button>

                            {/* Part C.3: Generate Voucher Button */}
                            {locked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="font-bold text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1"
                                onClick={() => payroll.pdf_url && window.open(payroll.pdf_url, '_blank')}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {payroll.voucher_no || 'Generated'}
                                {payroll.pdf_url && <ExternalLink className="h-3 w-3" />}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="font-bold text-xs gap-1 shadow-sm"
                                onClick={() => handleGenerateVoucher(payroll)}
                                disabled={isGenerating}
                              >
                                {isGenerating ? (
                                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                                ) : (
                                  <><FileText className="h-3.5 w-3.5" /> Generate Voucher</>
                                )}
                              </Button>
                            )}
                          </div>
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

      {/* ADD ADVANCE MODAL */}
      <Dialog open={isAdvanceModalOpen} onOpenChange={setIsAdvanceModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-amber-600" /> Add Salary Advance
            </DialogTitle>
            <DialogDescription>
              Record an advance for <strong className="text-slate-900">{advanceEmployeeName}</strong>.
              It will be deducted from the selected month's payroll.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddAdvance} className="space-y-4 py-2 font-medium">
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
    </div>
  );
};
