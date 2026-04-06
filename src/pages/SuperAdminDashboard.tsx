import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Store, 
  TrendingUp, 
  CreditCard, 
  ShieldCheck, 
  Settings, 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Plus, 
  Download,
  BarChart3,
  LayoutDashboard,
  Server,
  Globe,
  Bell,
  LogOut,
  Key,
  Copy,
  Calendar,
  AlertCircle,
  Activity
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { licenseService, LicenseData } from '@/services/licenseService';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Mock data for the premium look until real data is wired up
const revenueData = [
  { name: 'Jan', revenue: 4500, users: 120 },
  { name: 'Feb', revenue: 5200, users: 145 },
  { name: 'Mar', revenue: 4800, users: 160 },
  { name: 'Apr', revenue: 6100, users: 190 },
  { name: 'May', revenue: 5900, users: 210 },
  { name: 'Jun', revenue: 7200, users: 240 },
  { name: 'Jul', revenue: 8500, users: 280 },
];

const SuperAdminDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // License Generator State
  const [licenseStoreName, setLicenseStoreName] = useState("");
  const [licenseMonths, setLicenseMonths] = useState("1");
  const [generatedKey, setGeneratedKey] = useState("");

  // Fetch all tenants
  const { data: tenants = [], isLoading: loadingTenants } = useQuery({
    queryKey: ['all-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // KPI calculations
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter(t => t.billing_status === 'active').length;
  const premiumTenants = tenants.filter(t => t.plan_type === 'premium' || t.plan_type === 'enterprise').length;

  const handleGenerateLicense = () => {
    if (!licenseStoreName) {
      toast.error("Store name is required");
      return;
    }

    const expiryDate = new Date();
    if (licenseMonths === "7d") {
      expiryDate.setDate(expiryDate.getDate() + 7);
    } else {
      expiryDate.setMonth(expiryDate.getMonth() + parseInt(licenseMonths));
    }

    const data: LicenseData = {
      storeName: licenseStoreName,
      expiryDate: expiryDate.toISOString(),
      type: licenseMonths === "7d" ? 'weekly' : 'monthly'
    };

    const key = licenseService.generateLicense(data);
    setGeneratedKey(key);
    toast.success("License key generated!");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedKey);
    toast.success("Copied to clipboard");
  };

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, plan }: { id: string, plan: string }) => {
      const { error } = await supabase
        .from('tenants')
        .update({ plan_type: plan })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tenant plan updated successfully');
      queryClient.invalidateQueries({ queryKey: ['all-tenants'] });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase
        .from('tenants')
        .update({ billing_status: status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tenant status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['all-tenants'] });
    }
  });

  const filteredTenants = tenants.filter(t => 
    t.restaurant_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 selection:bg-indigo-500/30 font-sans">
      {/* Sidebar - Desktop */}
      <aside className="fixed left-0 top-0 hidden h-full w-72 border-r border-slate-800/50 bg-[#020617]/80 backdrop-blur-2xl lg:block z-50">
        <div className="flex h-full flex-col p-8">
          <div className="mb-12 flex items-center gap-4 px-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-xl shadow-indigo-500/20 ring-1 ring-white/20">
              <Globe className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tighter text-white uppercase">Gen XCloud</h2>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Admin Console</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-2">
            {[
              { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
              { id: 'tenants', icon: Store, label: 'Restaurants' },
              { id: 'licenses', icon: Key, label: 'License Keys' },
              { id: 'analytics', icon: BarChart3, label: 'Market Analytics' },
              { id: 'security', icon: ShieldCheck, label: 'Security Center' },
              { id: 'settings', icon: Settings, label: 'Global Config' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300",
                  activeTab === item.id 
                    ? "bg-indigo-500/10 text-indigo-400 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.2)]" 
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                )}
              >
                {activeTab === item.id && (
                  <motion.div 
                    layoutId="activeNav"
                    className="absolute left-0 h-6 w-1 rounded-full bg-indigo-500"
                  />
                )}
                <item.icon className={cn(
                  "h-5 w-5 transition-all duration-300",
                  activeTab === item.id ? "text-indigo-400 scale-110" : "group-hover:scale-110"
                )} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-8 border-t border-slate-800/50">
            <button 
              onClick={() => navigate('/')}
              className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all duration-300"
            >
              <LogOut className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
              Return to POS
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 p-6 lg:p-12">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="mx-auto max-w-[1600px]"
        >
          {/* Header */}
          <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <motion.div variants={itemVariants}>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 px-2 py-0 text-[10px] uppercase tracking-tighter font-bold">
                  v2.4.0 stable
                </Badge>
                <span className="text-slate-500 text-xs font-medium">•</span>
                <span className="text-slate-500 text-xs font-medium flex items-center gap-1">
                  <Activity className="h-3 w-3" /> System Latency: 24ms
                </span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                Global <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Operations</span>
              </h1>
              <p className="text-slate-400 text-lg font-medium mt-1">Orchestrating the Gen XCloud ecosystem</p>
            </motion.div>
            
            <motion.div variants={itemVariants} className="flex items-center gap-4">
              <Button variant="outline" className="h-12 border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-slate-100 rounded-xl px-6 transition-all duration-300">
                <Download className="mr-2 h-4 w-4" /> Snapshot
              </Button>
              <Button className="h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-8 shadow-2xl shadow-indigo-600/20 border-t border-indigo-400/20 transition-all duration-300">
                <Plus className="mr-2 h-5 w-5" /> Provision Tenant
              </Button>
            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* KPI Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: 'Total Footprint', value: totalTenants, sub: 'Restaurants onboarded', icon: Store, color: 'from-blue-500/20 to-indigo-500/20', iconColor: 'text-blue-400' },
                    { label: 'Active Sessions', value: activeTenants, sub: 'Currently online', icon: Activity, color: 'from-emerald-500/20 to-teal-500/20', iconColor: 'text-emerald-400' },
                    { label: 'MRR Growth', value: `$${revenueData[revenueData.length - 1].revenue}`, sub: '+18.2% this month', icon: CreditCard, color: 'from-purple-500/20 to-pink-500/20', iconColor: 'text-purple-400' },
                    { label: 'Enterprise Tier', value: premiumTenants, sub: 'Premium subscribers', icon: ShieldCheck, color: 'from-amber-500/20 to-orange-500/20', iconColor: 'text-amber-400' },
                  ].map((kpi, i) => (
                    <motion.div key={i} variants={itemVariants}>
                      <Card className="relative group overflow-hidden border-slate-800/50 bg-slate-900/40 backdrop-blur-xl transition-all duration-500 hover:bg-slate-900/60 hover:-translate-y-1">
                        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500", kpi.color)} />
                        <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">{kpi.label}</CardTitle>
                          <div className={cn("rounded-xl p-2.5 bg-slate-800/50 shadow-inner", kpi.iconColor)}>
                            <kpi.icon className="h-5 w-5" />
                          </div>
                        </CardHeader>
                        <CardContent className="relative">
                          <div className="text-4xl font-black tracking-tighter text-white">{kpi.value}</div>
                          <p className="text-sm font-bold text-slate-500 mt-2 flex items-center gap-1.5">
                            {kpi.sub}
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                <div className="grid gap-8 lg:grid-cols-3">
                  <motion.div variants={itemVariants} className="lg:col-span-2">
                    <Card className="border-slate-800/50 bg-slate-900/40 backdrop-blur-xl overflow-hidden h-full">
                      <CardHeader className="pb-0 sm:pb-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-2xl font-black tracking-tight">Financial Velocity</CardTitle>
                            <CardDescription className="text-slate-400 text-sm font-medium">Consolidated ecosystem revenue</CardDescription>
                          </div>
                          <Select defaultValue="7d">
                            <SelectTrigger className="w-32 bg-slate-800/50 border-slate-700/50 text-slate-100 rounded-lg h-9 text-xs">
                              <SelectValue placeholder="Period" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                              <SelectItem value="24h">Last 24h</SelectItem>
                              <SelectItem value="7d">Last 7 days</SelectItem>
                              <SelectItem value="30d">Last 30 days</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardHeader>
                      <CardContent className="p-2 sm:p-6">
                        <div className="h-[450px] w-full mt-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueData}>
                              <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                              <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} 
                                dy={15}
                              />
                              <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} 
                                tickFormatter={(v) => `$${v}`}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: '#0f172a', 
                                  borderColor: 'rgba(255,255,255,0.1)', 
                                  borderRadius: '16px',
                                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                  padding: '12px'
                                }}
                                itemStyle={{ color: '#818cf8', fontWeight: 800 }}
                                labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="revenue" 
                                stroke="#6366f1" 
                                strokeWidth={4}
                                fillOpacity={1} 
                                fill="url(#colorRevenue)" 
                                animationDuration={2000}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div variants={itemVariants} className="space-y-8">
                    <Card className="border-slate-800/50 bg-slate-900/40 backdrop-blur-xl">
                      <CardHeader>
                        <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                          <Server className="h-6 w-6 text-indigo-400" /> Infrastructure
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {[
                          { label: 'Cloud Gateway', status: 'Operational', color: 'emerald', load: '14%' },
                          { label: 'Postgres Cluster', status: 'Optimal', color: 'indigo', load: '32%' },
                          { label: 'Realtime Engine', status: 'Healthy', color: 'emerald', load: '8%' },
                          { label: 'Edge Auth', status: 'Online', color: 'emerald', load: '4%' },
                        ].map((service, i) => (
                          <div key={i} className="group flex flex-col p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50 hover:border-indigo-500/30 transition-all duration-300">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold text-slate-100">{service.label}</span>
                              <Badge className={cn("text-[10px] uppercase font-black tracking-tighter px-2 py-0.5", `bg-${service.color}-500/10 text-${service.color}-400 border-${service.color}-500/20`)}>
                                {service.status}
                              </Badge>
                            </div>
                            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: service.load }}
                                transition={{ duration: 1, delay: i * 0.2 }}
                                className={cn("h-full rounded-full", `bg-${service.color}-500`)}
                              />
                            </div>
                            <div className="flex justify-between mt-1.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Load</span>
                              <span className="text-[10px] font-black text-slate-300">{service.load}</span>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="border-slate-800/50 bg-slate-900/40 backdrop-blur-xl">
                      <CardHeader>
                        <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                          <Bell className="h-6 w-6 text-indigo-400" /> Event Stream
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {[
                          { user: 'Security', action: 'DDoS mitigation active', time: '12s ago', type: 'alert' },
                          { user: 'Admin', action: 'Upgraded "Spice Route"', time: '8m ago', type: 'info' },
                          { user: 'System', action: 'Elastic scale up complete', time: '1h ago', type: 'info' },
                          { user: 'Admin', action: 'New tenant provisioned', time: '3h ago', type: 'info' },
                        ].map((log, i) => (
                          <div key={i} className="flex items-start gap-4">
                            <div className={cn(
                              "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg",
                              log.type === 'alert' ? "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20" : "bg-slate-800 text-slate-400 ring-1 ring-slate-700"
                            )}>
                              {log.type === 'alert' ? <AlertCircle className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                            </div>
                            <div className="flex-1">
                              <p className={cn("font-bold text-sm", log.type === 'alert' ? "text-rose-100" : "text-slate-100")}>{log.action}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{log.user}</span>
                                <span className="text-[8px] text-slate-700">•</span>
                                <span className="text-[10px] font-bold text-slate-600">{log.time}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        <Button variant="ghost" className="w-full text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 h-10 rounded-xl">
                          Access Audit Vault
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {activeTab === 'tenants' && (
              <motion.div 
                key="tenants"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <Card className="border-slate-800/50 bg-slate-900/40 backdrop-blur-xl">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-8">
                    <div>
                      <CardTitle className="text-3xl font-black tracking-tight text-white">Partner Network</CardTitle>
                      <CardDescription className="text-slate-400 font-medium">Manage and audit all provisioned restaurant tenants</CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative w-80">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <Input 
                          placeholder="Filter ecosystem..." 
                          className="h-12 pl-11 pr-4 border-slate-800 bg-slate-900/50 text-white rounded-xl placeholder:text-slate-600 focus:ring-indigo-500/20 transition-all"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <Button variant="outline" className="h-12 w-12 p-0 border-slate-800 bg-slate-900/50 rounded-xl text-slate-400 hover:text-white">
                        <Filter className="h-5 w-5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 sm:px-8 sm:pb-8">
                    <div className="rounded-2xl border border-slate-800/50 overflow-hidden bg-slate-950/20 backdrop-blur-sm">
                      <Table>
                        <TableHeader className="bg-slate-900/50">
                          <TableRow className="hover:bg-transparent border-slate-800/50 h-14">
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-6">Entity Profile</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Service Plan</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Node Status</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Deployment Date</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500 pr-6">Management</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <AnimatePresence>
                            {filteredTenants.map((tenant) => (
                              <motion.tr 
                                key={tenant.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="group border-slate-800/50 hover:bg-white/[0.03] transition-all duration-300 h-20"
                              >
                                <TableCell className="pl-6">
                                  <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center border border-slate-800 group-hover:border-indigo-500/30 group-hover:scale-105 transition-all duration-500">
                                      <Store className="h-6 w-6 text-indigo-400" />
                                    </div>
                                    <div>
                                      <p className="font-black text-slate-100 group-hover:text-indigo-400 transition-colors">{tenant.restaurant_name}</p>
                                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{tenant.id.slice(0, 18)}...</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "capitalize font-black tracking-tighter px-3 py-1 rounded-lg border-0 ring-1 ring-inset",
                                      tenant.plan_type === 'premium' ? "text-amber-400 bg-amber-400/10 ring-amber-400/20" : 
                                      tenant.plan_type === 'basic' ? "text-indigo-400 bg-indigo-400/10 ring-indigo-400/20" : "text-slate-400 bg-slate-400/10 ring-slate-400/20"
                                    )}
                                  >
                                    {tenant.plan_type}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2.5">
                                    <div className={cn(
                                      "h-2 w-2 rounded-full",
                                      tenant.billing_status === 'active' ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]" : "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                                    )} />
                                    <span className="text-xs font-black uppercase tracking-tighter text-slate-300">{tenant.billing_status}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-slate-500 font-bold text-xs">
                                  {new Date(tenant.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-400 rounded-xl transition-all">
                                        <MoreVertical className="h-5 w-5" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-64 p-2 border-slate-800 bg-slate-900/95 backdrop-blur-2xl text-slate-100 rounded-2xl shadow-2xl">
                                      <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 mb-2">Service Actions</div>
                                      <DropdownMenuItem className="rounded-xl h-11 font-semibold cursor-pointer focus:bg-indigo-500/10 focus:text-indigo-400" onClick={() => updatePlanMutation.mutate({ id: tenant.id, plan: 'premium' })}>
                                        <TrendingUp className="mr-3 h-4 w-4" /> Upgrade to Premium
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="rounded-xl h-11 font-semibold cursor-pointer focus:bg-indigo-500/10 focus:text-indigo-400" onClick={() => updatePlanMutation.mutate({ id: tenant.id, plan: 'basic' })}>
                                        <Activity className="mr-3 h-4 w-4" /> Downgrade to Basic
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="rounded-xl h-11 font-semibold cursor-pointer focus:bg-rose-500/10 focus:text-rose-400" onClick={() => updateStatusMutation.mutate({ id: tenant.id, status: tenant.billing_status === 'active' ? 'canceled' : 'active' })}>
                                        {tenant.billing_status === 'active' ? <XCircle className="mr-3 h-4 w-4" /> : <CheckCircle2 className="mr-3 h-4 w-4" />}
                                        {tenant.billing_status === 'active' ? 'Deactivate Node' : 'Activate Node'}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === 'licenses' && (
              <motion.div 
                key="licenses"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-2xl mx-auto"
              >
                <Card className="border-slate-800/50 bg-slate-900/40 backdrop-blur-xl overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                  <CardHeader className="p-10 text-center">
                    <div className="mx-auto h-20 w-20 rounded-3xl bg-indigo-500/10 flex items-center justify-center mb-6 ring-1 ring-indigo-500/20 shadow-2xl shadow-indigo-500/10">
                      <Key className="h-10 w-10 text-indigo-400" />
                    </div>
                    <CardTitle className="text-4xl font-black tracking-tight">Vault Cryptography</CardTitle>
                    <CardDescription className="text-slate-400 text-lg font-medium mt-2">Generate cryptographically secure rental keys</CardDescription>
                  </CardHeader>
                  <CardContent className="p-10 pt-0 space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Target Entity Name</label>
                      <Input
                        value={licenseStoreName}
                        onChange={(e) => setLicenseStoreName(e.target.value)}
                        placeholder="e.g. Royal Spice Garden"
                        className="h-14 px-6 border-slate-800 bg-slate-950/50 text-white rounded-2xl placeholder:text-slate-700 text-lg font-semibold focus:ring-indigo-500/20"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Validation Period</label>
                      <Select value={licenseMonths} onValueChange={setLicenseMonths}>
                        <SelectTrigger className="h-14 px-6 border-slate-800 bg-slate-950/50 text-white rounded-2xl text-lg font-semibold focus:ring-indigo-500/20">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 rounded-2xl p-2">
                          <SelectItem value="7d" className="rounded-xl h-11 font-semibold">7 Day Trial</SelectItem>
                          <SelectItem value="1" className="rounded-xl h-11 font-semibold">30 Day Cycle</SelectItem>
                          <SelectItem value="3" className="rounded-xl h-11 font-semibold">90 Day Cycle</SelectItem>
                          <SelectItem value="6" className="rounded-xl h-11 font-semibold">180 Day Cycle</SelectItem>
                          <SelectItem value="12" className="rounded-xl h-11 font-semibold">365 Day Cycle</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button onClick={handleGenerateLicense} className="w-full h-16 bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-black rounded-2xl shadow-2xl shadow-indigo-600/20 border-t border-indigo-400/20 transition-all active:scale-[0.98]">
                      Forge License Key
                    </Button>

                    <AnimatePresence>
                      {generatedKey && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-10 p-8 bg-slate-950 border border-slate-800 rounded-3xl relative overflow-hidden group shadow-inner"
                        >
                          <div className="absolute top-0 right-0 p-3 flex gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-10 w-10 text-slate-500 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                              onClick={copyToClipboard}
                            >
                              <Copy className="h-5 w-5" />
                            </Button>
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-4">Generated Manifest</div>
                          <code className="text-emerald-400 text-lg font-mono break-all block leading-relaxed pr-12">
                            {generatedKey}
                          </code>
                          <div className="mt-6 pt-6 border-t border-slate-900 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-slate-600" />
                              <span className="text-xs font-bold text-slate-500">Expires: {new Date(JSON.parse(atob(generatedKey)).expiryDate).toLocaleDateString()}</span>
                            </div>
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-black tracking-tighter uppercase text-[10px]">Active</Badge>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
};

export default SuperAdminDashboard;
