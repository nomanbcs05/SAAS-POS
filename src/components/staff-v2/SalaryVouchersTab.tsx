import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffV2Api, SalaryVoucherV2 } from '@/services/staffV2Api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  FileText,
  Calendar,
  Loader2,
  Download,
  ExternalLink,
  CheckCircle2,
  Clock,
  CreditCard,
  Landmark
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface SalaryVouchersTabProps {
  tenantId?: string;
}

export const SalaryVouchersTab: React.FC<SalaryVouchersTabProps> = ({ tenantId }) => {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Fetch vouchers from API B.6
  const { data: vouchers = [], isLoading } = useQuery<SalaryVoucherV2[]>({
    queryKey: ['vouchers-v2-list', selectedMonth, tenantId],
    queryFn: () => staffV2Api.vouchers.getByMonth(selectedMonth, tenantId),
    staleTime: 60 * 1000,
  });

  // Update voucher status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'paid' | 'generated' }) =>
      staffV2Api.vouchers.updateStatus(id, status, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vouchers-v2-list'] });
      toast.success('Voucher payment status updated');
    },
    onError: (err: any) => toast.error('Failed to update status: ' + err.message)
  });

  const totalNetSalary = vouchers.reduce((sum, v) => sum + Number(v.net_salary || 0), 0);
  const paidCount = vouchers.filter(v => v.status === 'paid').length;
  const pendingCount = vouchers.filter(v => v.status !== 'paid').length;

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      {vouchers.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-black text-slate-900">Rs {totalNetSalary.toLocaleString()}</div>
              <div className="text-xs text-slate-500 font-semibold mt-1 uppercase tracking-wide">Total Payroll Outflow</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-emerald-200 bg-emerald-50/40">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-black text-emerald-700">{paidCount}</div>
              <div className="text-xs text-emerald-600 font-semibold mt-1 uppercase tracking-wide">Paid Vouchers</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-amber-200 bg-amber-50/40">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-black text-amber-700">{pendingCount}</div>
              <div className="text-xs text-amber-600 font-semibold mt-1 uppercase tracking-wide">Pending Payment</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Salary Vouchers (PRO V2)
              </CardTitle>
              <CardDescription>
                Generated salary vouchers with PDF download and payment tracking
              </CardDescription>
            </div>
            {/* Part C.4: Date / Month Filter */}
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md border text-sm w-fit">
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
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : vouchers.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg bg-slate-50">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-700">No Vouchers Generated</h3>
              <p className="text-sm text-slate-500">
                Go to the <strong>Payroll Sheet</strong> tab to generate salary vouchers for {selectedMonth}.
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[800px]">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Voucher No</th>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">CNIC / Bank</th>
                    <th className="px-4 py-3 text-right">Net Salary</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Paid On</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-700">
                  {vouchers.map((voucher) => (
                    <tr key={voucher.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-slate-900 text-xs">{voucher.voucher_no}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {voucher.created_at ? format(parseISO(voucher.created_at), 'dd MMM yyyy, hh:mm a') : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{voucher.employee_name}</div>
                        <div className="text-xs text-slate-400 capitalize">{voucher.employee_role}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {voucher.cnic ? (
                          <div className="flex items-center gap-1 text-slate-600 font-mono">
                            <CreditCard className="h-3 w-3 text-slate-400" /> {voucher.cnic}
                          </div>
                        ) : null}
                        {voucher.bank_account ? (
                          <div className="flex items-center gap-1 text-slate-600 font-mono mt-0.5">
                            <Landmark className="h-3 w-3 text-slate-400" /> {voucher.bank_account}
                          </div>
                        ) : null}
                        {!voucher.cnic && !voucher.bank_account && (
                          <span className="text-slate-400 italic">Cash payout</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-900 text-base">
                        Rs {Number(voucher.net_salary).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {voucher.status === 'paid' ? (
                          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-50 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Paid
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-50 gap-1">
                            <Clock className="h-3 w-3" /> Pending
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {voucher.paid_date
                          ? format(parseISO(voucher.paid_date), 'dd MMM yyyy')
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {/* Part C.4: Mark Paid / Pending Toggle */}
                          {voucher.status !== 'paid' ? (
                            <Button
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({ id: voucher.id, status: 'paid' })}
                              disabled={updateStatusMutation.isPending}
                              className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs gap-1"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Mark Paid
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatusMutation.mutate({ id: voucher.id, status: 'generated' })}
                              disabled={updateStatusMutation.isPending}
                              className="font-bold text-xs border-slate-300 text-slate-600"
                            >
                              Mark Pending
                            </Button>
                          )}

                          {/* Part C.4: PDF Download / View Button */}
                          {voucher.pdf_url ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="font-bold text-xs border-blue-300 text-blue-700 hover:bg-blue-50 gap-1"
                              onClick={() => window.open(voucher.pdf_url!, '_blank')}
                              title="View / Download Salary Voucher PDF"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> View PDF
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="font-bold text-xs border-slate-200 text-slate-400 gap-1"
                              disabled
                              title="PDF not available"
                            >
                              <Download className="h-3.5 w-3.5" /> PDF N/A
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 font-bold text-slate-700 uppercase text-xs tracking-wider">
                      Total ({vouchers.length} voucher{vouchers.length !== 1 ? 's' : ''})
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-900 text-base">
                      Rs {totalNetSalary.toLocaleString()}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
