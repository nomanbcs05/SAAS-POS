import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffV2Api, EmployeeV2, AttendanceLogV2 } from '@/services/staffV2Api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  History,
  Check
} from 'lucide-react';

interface AttendanceTabProps {
  tenantId?: string;
}

export const AttendanceTab: React.FC<AttendanceTabProps> = ({ tenantId }) => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Employee history modal state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyEmployeeId, setHistoryEmployeeId] = useState<string>('');

  // 1. Fetch active employees
  const { data: staffList = [], isLoading: isLoadingStaff } = useQuery({
    queryKey: ['staff-v2-list', tenantId],
    queryFn: () => staffV2Api.staff.getAll(tenantId),
  });

  const activeStaff = staffList.filter(s => s.is_active);

  // 2. Fetch daily attendance for the selected month
  const selectedMonth = selectedDate.slice(0, 7);
  const { data: monthlyData, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['attendance-v2-month', selectedMonth, tenantId],
    queryFn: () => staffV2Api.attendance.getMonthly(selectedMonth, tenantId),
  });

  const logsForDate = (monthlyData?.logs || []).filter((l: any) => l.date === selectedDate);
  const attendanceMap = new Map(logsForDate.map((l: any) => [l.employee_id, l]));

  // 3. Mark attendance mutation (calling API B.1)
  const markMutation = useMutation({
    mutationFn: (data: { 
      employee_id: string; 
      date: string; 
      status: 'present' | 'absent' | 'halfday' | 'leave';
      empRef?: EmployeeV2;
    }) =>
      staffV2Api.attendance.mark(
        { employee_id: data.employee_id, date: data.date, status: data.status },
        tenantId,
        data.empRef
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-v2-month'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-v2-history'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-v2-calc'] });
      toast.success('Attendance recorded');
    },
    onError: (err: any) => toast.error('Error marking attendance: ' + (err?.message || 'Failed to save'))
  });

  const handleMarkStatus = (emp: EmployeeV2, status: 'present' | 'absent' | 'halfday' | 'leave') => {
    markMutation.mutate({
      employee_id: emp.id,
      date: selectedDate,
      status,
      empRef: emp,
    });
  };

  const handleMarkAllPresent = () => {
    if (activeStaff.length === 0) return;
    activeStaff.forEach(emp => {
      markMutation.mutate({
        employee_id: emp.id,
        date: selectedDate,
        status: 'present',
        empRef: emp,
      });
    });
    toast.success(`Marked all ${activeStaff.length} employees present for ${selectedDate}`);
  };

  // Date Navigation Helpers
  const shiftDate = (days: number) => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const setToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Formatted date string (e.g. "Sunday, Sep 20, 2026")
  const formattedSelectedDate = (() => {
    try {
      const d = new Date(selectedDate + 'T00:00:00');
      return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return selectedDate;
    }
  })();

  const markedCount = activeStaff.filter(emp => attendanceMap.has(emp.id)).length;

  // 4. Monthly Report Query (calling API B.2)
  const { data: reportData, isLoading: isLoadingReport } = useQuery({
    queryKey: ['attendance-v2-report', reportMonth, tenantId],
    queryFn: () => staffV2Api.attendance.getMonthly(reportMonth, tenantId),
    enabled: isReportModalOpen,
  });

  // 5. Employee History Query (for checking previous days across years)
  const { data: employeeHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['attendance-v2-history', historyEmployeeId, tenantId],
    queryFn: () => staffV2Api.attendance.getEmployeeHistory(historyEmployeeId, tenantId),
    enabled: isHistoryModalOpen && !!historyEmployeeId,
  });

  const selectedHistoryEmployee = activeStaff.find(e => e.id === historyEmployeeId);

  const historyStats = React.useMemo(() => {
    let present = 0, absent = 0, halfday = 0, leave = 0;
    employeeHistory.forEach(h => {
      if (h.status === 'present') present += 1;
      else if (h.status === 'absent') absent += 1;
      else if (h.status === 'halfday') halfday += 1;
      else if (h.status === 'leave') leave += 1;
    });
    return { present, absent, halfday, leave, total: employeeHistory.length };
  }, [employeeHistory]);

  const openHistoryForEmployee = (empId: string) => {
    setHistoryEmployeeId(empId);
    setIsHistoryModalOpen(true);
  };

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
                Record live daily check-ins — saved permanently for years with historical tracking
              </CardDescription>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Date navigator */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border text-sm">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => shiftDate(-1)} 
                  className="h-7 w-7 p-0 text-slate-600 hover:text-slate-900"
                  title="Previous Day"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent border-none outline-none font-bold text-slate-800 text-xs px-1 cursor-pointer"
                />

                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => shiftDate(1)} 
                  className="h-7 w-7 p-0 text-slate-600 hover:text-slate-900"
                  title="Next Day"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={setToday}
                  className="h-7 px-2 text-[11px] font-bold text-primary hover:bg-slate-200"
                >
                  Today
                </Button>
              </div>

              <Button 
                variant="outline" 
                size="sm"
                onClick={handleMarkAllPresent} 
                disabled={activeStaff.length === 0 || markMutation.isPending}
                className="font-bold text-xs text-emerald-700 hover:text-emerald-800 border-emerald-300 hover:bg-emerald-50 h-9"
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Mark All Present
              </Button>

              {/* History Button */}
              <Button 
                variant="outline"
                size="sm"
                onClick={() => {
                  if (activeStaff.length > 0 && !historyEmployeeId) {
                    setHistoryEmployeeId(activeStaff[0].id);
                  }
                  setIsHistoryModalOpen(true);
                }}
                className="gap-1.5 font-bold text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 h-9"
              >
                <History className="h-3.5 w-3.5" /> Previous Days History
              </Button>

              {/* Monthly Report Button */}
              <Button 
                size="sm"
                onClick={() => setIsReportModalOpen(true)}
                className="gap-1.5 font-bold text-xs shadow-sm h-9"
              >
                <BarChart3 className="h-3.5 w-3.5" /> Monthly Summary
              </Button>
            </div>
          </div>

          {/* Date info & counter bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t mt-2 text-xs text-slate-500">
            <div className="font-semibold text-slate-700 flex items-center gap-2">
              <span>Date: <strong className="text-slate-900">{formattedSelectedDate}</strong></span>
              <span className="text-slate-300">|</span>
              <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {markedCount} of {activeStaff.length} Marked
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Attendance records persist across months & years in cloud storage.
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
                    <th className="px-4 py-3 text-right">Status on {selectedDate}</th>
                    <th className="px-4 py-3 text-center">Action</th>
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
                          {emp.cnic && <div className="text-[11px] font-mono text-slate-400">CNIC: {emp.cnic}</div>}
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
                              onClick={() => handleMarkStatus(emp, 'present')}
                              disabled={markMutation.isPending}
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
                              onClick={() => handleMarkStatus(emp, 'absent')}
                              disabled={markMutation.isPending}
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
                              onClick={() => handleMarkStatus(emp, 'halfday')}
                              disabled={markMutation.isPending}
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
                              onClick={() => handleMarkStatus(emp, 'leave')}
                              disabled={markMutation.isPending}
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
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openHistoryForEmployee(emp.id)}
                            className="text-xs text-slate-600 hover:text-indigo-600 gap-1 h-7"
                            title="Check attendance in previous days"
                          >
                            <History className="h-3.5 w-3.5" /> History
                          </Button>
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

      {/* PREVIOUS DAYS ATTENDANCE HISTORY MODAL */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-6">
              <div>
                <DialogTitle className="font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                  <History className="h-5 w-5 text-indigo-600" />
                  Attendance Records History
                </DialogTitle>
                <DialogDescription>
                  View permanent past attendance logs across previous days, months, and years.
                </DialogDescription>
              </div>

              {/* Employee selector */}
              <div className="w-60">
                <Select value={historyEmployeeId} onValueChange={setHistoryEmployeeId}>
                  <SelectTrigger className="font-bold text-xs bg-slate-50">
                    <SelectValue placeholder="Select Employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeStaff.map(emp => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.name} ({emp.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>

          {selectedHistoryEmployee && (
            <div className="bg-slate-50 p-3 rounded-md border text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 text-sm">{selectedHistoryEmployee.name}</span>
                  <span className="ml-2 text-slate-500 capitalize">({selectedHistoryEmployee.role})</span>
                  {selectedHistoryEmployee.cnic && (
                    <span className="ml-2 text-slate-400 font-mono">CNIC: {selectedHistoryEmployee.cnic}</span>
                  )}
                </div>
                <div className="font-semibold text-slate-600">
                  Total Logged: <strong>{historyStats.total}</strong> days
                </div>
              </div>

              {/* Summary Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  Present: {historyStats.present}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                  Absent: {historyStats.absent}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                  Half Day: {historyStats.halfday}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
                  Leave: {historyStats.leave}
                </span>
              </div>
            </div>
          )}

          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : employeeHistory.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg bg-slate-50">
              <CalendarDays className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">No Past Records Found</h4>
              <p className="text-xs text-slate-400">Mark attendance on any date to start building previous days history.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden max-h-[50vh] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Day</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Recorded Check-In</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-medium text-xs">
                  {employeeHistory.map((h: AttendanceLogV2, idx: number) => {
                    const d = new Date(h.date + 'T00:00:00');
                    const dayName = d.toLocaleDateString(undefined, { weekday: 'long' });
                    return (
                      <tr key={h.id || idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-800">{h.date}</td>
                        <td className="px-4 py-2.5 text-slate-500">{dayName}</td>
                        <td className="px-4 py-2.5">
                          <Badge className={
                            h.status === 'present' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 uppercase' :
                            h.status === 'absent' ? 'bg-rose-100 text-rose-800 border-rose-300 uppercase' :
                            h.status === 'halfday' ? 'bg-amber-100 text-amber-800 border-amber-300 uppercase' :
                            'bg-blue-100 text-blue-800 border-blue-300 uppercase'
                          }>
                            {h.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-[11px] font-mono">
                          {h.check_in ? new Date(h.check_in).toLocaleTimeString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter className="border-t pt-3">
            <Button onClick={() => setIsHistoryModalOpen(false)} className="font-bold">
              Close History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
