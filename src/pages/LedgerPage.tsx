import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, Plus, User, Building2, Wallet, 
  MoreHorizontal, Edit, Trash2, Loader2,
  ArrowUpRight, ArrowDownLeft, Calendar,
  Filter, FileText, Download, TrendingUp,
  TrendingDown
} from 'lucide-react';
import Fuse from 'fuse.js';
import MainLayout from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useMultiTenant } from '@/hooks/useMultiTenant';

const LedgerPage = () => {
  const { tenant } = useMultiTenant();
  const [activeTab, setActiveTab] = useState('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  // Forms state
  const [vendorForm, setVendorForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [accountForm, setAccountForm] = useState({ name: '', type: 'expense', description: '' });
  const [entryForm, setEntryForm] = useState({ 
    entity_type: 'customer', 
    entity_id: '', 
    type: 'debit', 
    amount: 0, 
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries
  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: api.customers.getAll,
  });

  const { data: vendors = [], isLoading: isLoadingVendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: api.vendors.getAll,
  });

  const { data: accounts = [], isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.accounts.getAll,
  });

  const { data: entries = [], isLoading: isLoadingEntries } = useQuery({
    queryKey: ['ledger-entries', activeTab],
    queryFn: () => api.ledger.getAll(activeTab === 'general' ? 'account' : activeTab.slice(0, -1)),
  });

  // Mutations
  const createVendorMutation = useMutation({
    mutationFn: (data: any) => api.vendors.create({ ...data, tenant_id: tenant?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({ title: "Success", description: "Vendor added successfully" });
      setIsAddDialogOpen(false);
      setVendorForm({ name: '', phone: '', email: '', address: '' });
    }
  });

  const updateVendorMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => api.vendors.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({ title: "Success", description: "Vendor updated successfully" });
    }
  });

  const deleteVendorMutation = useMutation({
    mutationFn: api.vendors.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({ title: "Success", description: "Vendor deleted successfully" });
    }
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => api.customers.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: "Success", description: "Customer updated successfully" });
    }
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: api.customers.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: "Success", description: "Customer deleted successfully" });
    }
  });

  const createAccountMutation = useMutation({
    mutationFn: (data: any) => api.accounts.create({ ...data, tenant_id: tenant?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: "Success", description: "Account added successfully" });
      setIsAddDialogOpen(false);
      setAccountForm({ name: '', type: 'expense', description: '' });
    }
  });

  const createEntryMutation = useMutation({
    mutationFn: (data: any) => api.ledger.create({ ...data, tenant_id: tenant?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
      toast({ title: "Success", description: "Transaction recorded successfully" });
      setIsAddDialogOpen(false);
    }
  });

  // Filtering
  const filteredData = useMemo(() => {
    const list = activeTab === 'customers' ? customers : activeTab === 'vendors' ? vendors : accounts;
    if (!searchQuery.trim()) return list;
    const fuse = new Fuse(list, { keys: ['name', 'phone', 'email'], threshold: 0.3 });
    return fuse.search(searchQuery).map(r => r.item);
  }, [searchQuery, activeTab, customers, vendors, accounts]);

  return (
    <MainLayout>
      <div className="flex flex-col h-full bg-slate-50/50">
        {/* Header */}
        <div className="p-8 border-b bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black font-heading tracking-tight uppercase text-slate-900">Account Ledgers</h1>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">
                Manage financial records for customers, vendors, and business accounts
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" className="font-bold uppercase tracking-widest text-[10px] border-2">
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-slate-900 text-white font-bold uppercase tracking-widest text-[10px] px-6">
                    <Plus className="h-4 w-4 mr-2" />
                    New {activeTab === 'customers' ? 'Customer' : activeTab === 'vendors' ? 'Vendor' : 'Account'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">
                      Add New {activeTab === 'customers' ? 'Customer' : activeTab === 'vendors' ? 'Vendor' : 'Account'}
                    </DialogTitle>
                    <DialogDescription className="font-medium text-slate-500">
                      Fill in the details below to create a new record.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid gap-6 py-6">
                    {activeTab === 'vendors' ? (
                      <>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vendor Name</Label>
                          <Input 
                            value={vendorForm.name} 
                            onChange={e => setVendorForm({...vendorForm, name: e.target.value})}
                            placeholder="e.g. Fresh Produce Co."
                            className="font-bold"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Phone</Label>
                            <Input 
                              value={vendorForm.phone} 
                              onChange={e => setVendorForm({...vendorForm, phone: e.target.value})}
                              placeholder="+92..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email</Label>
                            <Input 
                              value={vendorForm.email} 
                              onChange={e => setVendorForm({...vendorForm, email: e.target.value})}
                              placeholder="vendor@email.com"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Address</Label>
                          <Input 
                            value={vendorForm.address} 
                            onChange={e => setVendorForm({...vendorForm, address: e.target.value})}
                          />
                        </div>
                      </>
                    ) : activeTab === 'general' ? (
                      <>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Account Name</Label>
                          <Input 
                            value={accountForm.name} 
                            onChange={e => setAccountForm({...accountForm, name: e.target.value})}
                            placeholder="e.g. Utility Bills"
                            className="font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Account Type</Label>
                          <select 
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={accountForm.type}
                            onChange={e => setAccountForm({...accountForm, type: e.target.value})}
                          >
                            <option value="asset">Asset</option>
                            <option value="liability">Liability</option>
                            <option value="equity">Equity</option>
                            <option value="revenue">Revenue</option>
                            <option value="expense">Expense</option>
                          </select>
                        </div>
                      </>
                    ) : (
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                        <p className="text-sm font-bold text-amber-800">To add a new customer, please use the Customers management page.</p>
                        <Button 
                          variant="link" 
                          className="p-0 h-auto text-amber-900 underline mt-2"
                          onClick={() => window.location.href = '#/customers'}
                        >
                          Go to Customers Page
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsAddDialogOpen(false)} className="font-bold uppercase tracking-widest text-[10px]">Cancel</Button>
                    <Button 
                      className="bg-slate-900 text-white font-bold uppercase tracking-widest text-[10px] px-8"
                      onClick={() => {
                        if (activeTab === 'vendors') createVendorMutation.mutate(vendorForm);
                        if (activeTab === 'general') createAccountMutation.mutate(accountForm);
                      }}
                    >
                      Save Record
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between">
              <TabsList className="bg-slate-100/50 p-1 rounded-2xl border-2">
                <TabsTrigger value="customers" className="rounded-xl px-8 font-bold uppercase tracking-widest text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Customer Ledgers
                </TabsTrigger>
                <TabsTrigger value="vendors" className="rounded-xl px-8 font-bold uppercase tracking-widest text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Vendor Ledgers
                </TabsTrigger>
                <TabsTrigger value="general" className="rounded-xl px-8 font-bold uppercase tracking-widest text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  General Accounts
                </TabsTrigger>
              </TabsList>
              
              <div className="relative w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 bg-slate-100/50 border-none rounded-2xl font-bold placeholder:text-slate-400"
                />
              </div>
            </div>
          </Tabs>
        </div>

        {/* Content Area */}
        <ScrollArea className="flex-1">
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {isLoadingCustomers || isLoadingVendors || isLoadingAccounts ? (
                <div className="col-span-full flex items-center justify-center py-20">
                  <Loader2 className="h-12 w-12 animate-spin text-slate-300" />
                </div>
              ) : filteredData.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                  <FileText className="h-16 w-16 text-slate-200 mb-4" />
                  <h3 className="text-xl font-black text-slate-400 uppercase tracking-tight">No Records Found</h3>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">Try adjusting your search or add a new entry</p>
                </div>
              ) : (
                filteredData.map((item: any) => (
                  <Card key={item.id} className="group overflow-hidden border-2 border-slate-100 hover:border-slate-900 transition-all duration-300 rounded-3xl bg-white shadow-sm hover:shadow-xl hover:-translate-y-1">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-slate-900 transition-colors duration-300">
                          {activeTab === 'customers' ? (
                            <User className="h-6 w-6 text-slate-400 group-hover:text-white" />
                          ) : activeTab === 'vendors' ? (
                            <Building2 className="h-6 w-6 text-slate-400 group-hover:text-white" />
                          ) : (
                            <Wallet className="h-6 w-6 text-slate-400 group-hover:text-white" />
                          )}
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <Dialog>
                              <DialogTrigger asChild>
                                <DropdownMenuItem onSelect={e => e.preventDefault()}>
                                  <Edit className="h-4 w-4 mr-2" /> Edit
                                </DropdownMenuItem>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Edit {item.name}</DialogTitle>
                                </DialogHeader>
                                {/* Edit form similar to add form */}
                                <div className="py-4 space-y-4">
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                      {activeTab === 'customers' ? 'Customer Name' : 'Vendor Name'}
                                    </Label>
                                    <Input defaultValue={item.name} onChange={e => item.name = e.target.value} className="font-bold" />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Phone</Label>
                                    <Input defaultValue={item.phone} onChange={e => item.phone = e.target.value} />
                                  </div>
                                  {activeTab === 'customers' ? (
                                    <div className="space-y-2">
                                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email</Label>
                                      <Input defaultValue={item.email} onChange={e => item.email = e.target.value} />
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Address</Label>
                                      <Input defaultValue={item.address} onChange={e => item.address = e.target.value} />
                                    </div>
                                  )}
                                </div>
                                <DialogFooter>
                                  <Button 
                                    className="bg-slate-900 text-white font-bold uppercase tracking-widest text-[10px] px-8"
                                    onClick={() => {
                                      if (activeTab === 'vendors') {
                                        updateVendorMutation.mutate({ 
                                          id: item.id, 
                                          data: { name: item.name, phone: item.phone, address: item.address } 
                                        });
                                      } else if (activeTab === 'customers') {
                                        updateCustomerMutation.mutate({
                                          id: item.id || item.customer_id,
                                          data: { name: item.name, phone: item.phone, email: item.email }
                                        });
                                      }
                                    }}
                                  >
                                    Save Changes
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <DropdownMenuItem 
                              className="text-destructive font-bold"
                              onClick={() => {
                                if (confirm(`Delete ${item.name}? This cannot be undone.`)) {
                                  if (activeTab === 'vendors') {
                                    deleteVendorMutation.mutate(item.id);
                                  } else if (activeTab === 'customers') {
                                    deleteCustomerMutation.mutate(item.id || item.customer_id);
                                  }
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <CardTitle className="mt-4 text-xl font-black uppercase tracking-tight truncate">{item.name}</CardTitle>
                      <CardDescription className="font-bold text-slate-400 uppercase text-[9px] tracking-widest truncate">
                        {activeTab === 'customers' ? item.phone || 'No phone' : activeTab === 'vendors' ? item.email || 'No email' : item.type}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="mt-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Current Balance</span>
                          <span className={cn(
                            "text-sm font-black tracking-tight",
                            (item.balance || 0) < 0 ? "text-rose-500" : "text-emerald-500"
                          )}>
                            Rs. {Math.abs(item.balance || 0).toLocaleString()}
                            <span className="text-[8px] ml-1 uppercase opacity-60">
                              {(item.balance || 0) < 0 ? 'Payable' : 'Receivable'}
                            </span>
                          </span>
                        </div>
                        
                        <Button 
                          variant="outline" 
                          className="w-full rounded-2xl border-2 font-bold uppercase tracking-widest text-[9px] h-10 hover:bg-slate-900 hover:text-white transition-all duration-300"
                        >
                          View Full Ledger
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Status Bar */}
        <div className="p-4 border-t bg-white flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
          <div className="flex gap-6">
            <span>Total Records: {filteredData.length}</span>
            <span className="text-emerald-500">Net Receivable: Rs. 124,500</span>
            <span className="text-rose-500">Net Payable: Rs. 45,200</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px] border-2">Last Updated: {format(new Date(), 'HH:mm:ss')}</Badge>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default LedgerPage;
