import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffV2Api, EmployeeV2 } from '@/services/staffV2Api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Users, 
  BarChart3, 
  Loader2, 
  CalendarDays,
  FileSpreadsheet
} from 'lucide-react';

interface AttendanceTabProps {
  tenantId?: string;
}

export const AttendanceTab: React.FC<AttendanceTabProps> = ({ tenantId }) => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // 1. Fetch active employees
  const { data: staffList = [], isLoading: isLoadingStaff } = useQuery({
    queryKey: ['staff-v2-list', tenantId],
    queryFn: () => staffV2Api.staff.getAll(tenantId),
  });

  const activeStaff = staffList.filter(s => s.is_active);

  // 2. Fetch daily attendance
  const { data: monthlyData, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['attendance-v2-month', selectedDate.slice(0, 7), tenantId],
    queryFn: () => staffV2Api.attendance.getMonthly(selectedDate.slice(0, 7), tenantId),
  });

  const logsForDate = (monthlyData?.logs || []).filter((l: any) => l.date === selectedDate);
  const attendanceMap = new Map(logsForDate.map((l: any) => [l.employee_id, l]));

  // 3. Mark attendance mutation (calling API B.1)
  const markMutation = useMutation({
    mutationFn: (data: { employee_id: string; date: string; status: 'present' | 'absent' | 'halfday' | 'leave' }) =>
      staffV2Api.attendance.mark(data, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-v2-month'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-v2-calc'] });
      toast.success('Attendance recorded');
    },
    onError: (err: any) => toast.error('Error marking attendance: ' + err.message)
  });

  const handleMarkStatus = (employeeId: string, status: 'present' | 'absent' | 'halfday' | 'leave') => {
    markMutation.mutate({
      employee_id: employeeId,
      date: selectedDate,
      status
    });
  };

  const handleMarkAllPresent = () => {
    if (activeStaff.length === 0) return;
    activeStaff.forEach(emp => {
      markMutation.mutate({
        employee_id: emp.id,
        date: selectedDate,
        status: 'present'
      });
    });
    toast.success(`Marked all ${activeStaff.length} employees present for ${selectedDate}`);
  };

  // 4. Monthly Report Query (calling API B.2)
  const { data: reportData, isLoading: isLoadingReport } = useQuery({
    queryKey: ['attendance-v2-report', reportMonth, tenantId],
    queryFn: () => staffV2Api.attendance.getMonthly(reportMonth, tenantId),
    enabled: isReportModalOpen,
  });

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" /> Daily Attendance Log (PRO V2)
              </CardTitle>
              <CardDescription>
                Record live daily check-ins and generate monthly attendance metrics
              </CardDescription>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md border text-sm">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent border-none outline-none font-bold text-slate-800"
                />
              </div>

              <Button 
                variant="outline" 
                onClick={handleMarkAllPresent} 
                disabled={activeStaff.length === 0 || markMutation.isPending}
                className="font-bold text-emerald-700 hover:text-emerald-800 border-emerald-300 hover:bg-emerald-50"
              >
                Mark All Present
              </Button>

              {/* Part C.2: Monthly Report Button */}
              <Button 
                onClick={() => setIsReportModalOpen(true)}
                className="gap-2 font-bold shadow-sm"
              >
                <BarChart3 className="h-4 w-4" /> Monthly Report
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingStaff || isLoadingAttendance ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : activeStaff.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg bg-slate-50">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">No Active Employees</h3>
              <p className="text-xs text-slate-500">Add or activate employees in the Staff Directory first.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Employee Name</th>
                    <th className="px-4 py-3">Designation</th>
                    <th className="px-4 py-3 text-center">Mark Attendance Status</th>
                    <th className="px-4 py-3 text-right">Current Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-700">
                  {activeStaff.map((emp) => {
                    const log = attendanceMap.get(emp.id);
                    const currentStatus = log?.status;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-bold text-slate-900">
                          <div>{emp.name}</div>
                          {emp.cnic && <div className="text-[11px] font-mono text-slate-400">ID: {emp.cnic}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs capitalize text-slate-500 font-semibold">
                          <Badge variant="outline" className="capitalize">
                            {emp.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleMarkStatus(emp.id, 'present')}
                              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 ${
                                currentStatus === 'present'
                                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300'
                                  : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'
                              }`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Present
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMarkStatus(emp.id, 'absent')}
                              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 ${
                                currentStatus === 'absent'
                                  ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-300'
                                  : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700 border border-slate-200'
                              }`}
                            >
                              <XCircle className="h-3.5 w-3.5" /> Absent
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMarkStatus(emp.id, 'halfday')}
                              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 ${
                                currentStatus === 'halfday'
                                  ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                                  : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700 border border-slate-200'
                              }`}
                            >
                              <Clock className="h-3.5 w-3.5" /> Half Day
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMarkStatus(emp.id, 'leave')}
                              className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                                currentStatus === 'leave'
                                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                                  : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200'
                              }`}
                            >
                              Paid Leave
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {currentStatus ? (
                            <Badge className={
                              currentStatus === 'present' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 uppercase' :
                              currentStatus === 'absent' ? 'bg-rose-100 text-rose-800 border-rose-300 uppercase' :
                              currentStatus === 'halfday' ? 'bg-amber-100 text-amber-800 border-amber-300 uppercase' :
                              'bg-blue-100 text-blue-800 border-blue-300 uppercase'
                            }>
                              {currentStatus}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Not marked</span>
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

      {/* MONTHLY REPORT MODAL */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-6">
              <div>
                <DialogTitle className="font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Monthly Attendance Summary
                </DialogTitle>
                <DialogDescription>
                  Consolidated attendance metrics per staff member for payroll review.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-md border text-sm">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                <input 
                  type="month" 
                  value={reportMonth} 
                  onChange={(e) => setReportMonth(e.target.value)}
                  className="bg-transparent border-none outline-none font-bold text-slate-800 text-xs"
                />
              </div>
            </div>
          </DialogHeader>

          {isLoadingReport ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4 my-2">
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3 text-center text-emerald-700">Present (P)</th>
                      <th className="px-4 py-3 text-center text-rose-700">Absent (A)</th>
                      <th className="px-4 py-3 text-center text-amber-700">Half Day (HD)</th>
                      <th className="px-4 py-3 text-center text-blue-700">Leave (L)</th>
                      <th className="px-4 py-3 text-right">Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white font-medium">
                    {activeStaff.map((emp) => {
                      const sum = reportData?.summary ? (reportData.summary[emp.id] || { present: 0, absent: 0, halfday: 0, leave: 0, total: 0 }) : { present: 0, absent: 0, halfday: 0, leave: 0, total: 0 };
                      const totalMarked = sum.total || 0;
                      const effectivePresent = sum.present + sum.leave + (sum.halfday * 0.5);
                      const rate = totalMarked > 0 ? Math.round((effectivePresent / totalMarked) * 100) : 0;

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-bold text-slate-900">{emp.name}</td>
                          <td className="px-4 py-3 text-xs capitalize text-slate-500">{emp.role}</td>
                          <td className="px-4 py-3 text-center font-bold text-emerald-700 bg-emerald-50/30">{sum.present}</td>
                          <td className="px-4 py-3 text-center font-bold text-rose-700 bg-rose-50/30">{sum.absent}</td>
                          <td className="px-4 py-3 text-center font-bold text-amber-700 bg-amber-50/30">{sum.halfday}</td>
                          <td className="px-4 py-3 text-center font-bold text-blue-700 bg-blue-50/30">{sum.leave}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {totalMarked > 0 ? `${rate}% (${effectivePresent}/${totalMarked}d)` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-3">
            <Button onClick={() => setIsReportModalOpen(false)} className="font-bold">
              Close Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
