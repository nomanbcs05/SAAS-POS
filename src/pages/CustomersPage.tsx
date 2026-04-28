import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Mail, Phone, User, Star, MoreHorizontal, Edit, Trash2, Loader2 } from 'lucide-react';
import Fuse from 'fuse.js';
import MainLayout from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';

const CustomersPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading, isError, error } = useQuery({
    queryKey: ['customers'],
    queryFn: api.customers.getAll,
  });

  if (isError) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <p className="text-destructive font-medium">Failed to load customers</p>
            <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}>
              Retry
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const addCustomerMutation = useMutation({
    mutationFn: api.customers.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: "Success",
        description: "Customer added successfully",
      });
      setIsAddDialogOpen(false);
      setNewCustomer({
        name: '',
        phone: '',
        email: '',
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: api.customers.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: "Success",
        description: "Customer deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddCustomer = () => {
    if (!newCustomer.name) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    addCustomerMutation.mutate({
      name: newCustomer.name,
      phone: newCustomer.phone,
      email: newCustomer.email,
    });
  };

  const fuse = useMemo(() => new Fuse(customers, {
    keys: ['name', 'phone', 'email'],
    threshold: 0.3,
  }), [customers]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    return fuse.search(searchQuery).map(r => r.item);
  }, [searchQuery, fuse, customers]);

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b bg-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Customers</h1>
              <p className="text-muted-foreground">
                {customers.length} customers • Search across all records instantly
              </p>
            </div>
            
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Customer</DialogTitle>
                  <DialogDescription>
                    Enter the details of the new customer below.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddCustomer} disabled={addCustomerMutation.isPending}>
                    {addCustomerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Customer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Customer Grid */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredCustomers.slice(0, 100).map((customer, index) => (
                  <Card key={customer.id || customer.customer_id || index} className="card-hover">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{customer.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {customer.total_orders || 0} visits
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => deleteCustomerMutation.mutate(customer.id || customer.customer_id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{customer.phone || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate">{customer.email || 'N/A'}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-4 pt-3 border-t">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-warning fill-warning" />
                          <span className="text-sm font-medium">{customer.loyalty_points} pts</span>
                        </div>
                        <Badge variant="secondary">
                          ${Number(customer.total_spent || 0).toFixed(0)} spent
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            
            {!isLoading && filteredCustomers.length > 100 && (
              <div className="text-center py-4 text-muted-foreground">
                Showing 100 of {filteredCustomers.length} results. Refine your search for more.
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-card text-sm text-muted-foreground">
          {searchQuery ? `Found ${filteredCustomers.length} customers` : `Total: ${customers.length} customers`}
        </div>
      </div>
    </MainLayout>
  );
};

export default CustomersPage;
