import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import OngoingOrdersPage from "./pages/OngoingOrdersPage";
import CompletedOrdersPage from "./pages/CompletedOrdersPage";
import OrdersPage from "./pages/OrdersPage";
import ProductsPage from "./pages/ProductsPage";
import CustomersPage from "./pages/CustomersPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";

import Welcome from "./pages/Welcome";
import DiningPage from "./pages/DiningPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import LicenseGenerator from "./pages/LicenseGenerator";
import CreateRestaurantPage from "./pages/CreateRestaurantPage";
import SelectRestaurantPage from "./pages/SelectRestaurantPage";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import { LicenseGate } from "./components/LicenseGate";
import { useMultiTenant } from "./hooks/useMultiTenant";
import { useOfflineSync } from "./hooks/useOfflineSync";
import { useSyncEngine } from "./hooks/useSyncEngine";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

persistQueryClient({
  queryClient,
  persister,
});

const AppContent = () => {
  useOfflineSync();
  useSyncEngine();
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
          <Route path="/license-manager" element={<LicenseGenerator />} />
          <Route path="/auth" element={<Welcome />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/create-restaurant" element={
            <ProtectedRoute>
              <CreateRestaurantPage />
            </ProtectedRoute>
          } />
          <Route path="/select-restaurant" element={
            <ProtectedRoute>
              <SelectRestaurantPage />
            </ProtectedRoute>
          } />
          <Route path="/saas-admin" element={
            <ProtectedRoute superAdminOnly={true}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="/" element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          } />
          <Route path="/dining" element={
            <ProtectedRoute>
              <DiningPage />
            </ProtectedRoute>
          } />
          <Route path="/ongoing-orders" element={
            <ProtectedRoute>
              <OngoingOrdersPage />
            </ProtectedRoute>
          } />
          <Route path="/completed-orders" element={
            <ProtectedRoute>
              <CompletedOrdersPage />
            </ProtectedRoute>
          } />
          <Route path="/orders" element={
            <ProtectedRoute>
              <OrdersPage />
            </ProtectedRoute>
          } />
          <Route path="/products" element={
            <ProtectedRoute adminOnly={true}>
              <ProductsPage />
            </ProtectedRoute>
          } />
          <Route path="/customers" element={
            <ProtectedRoute adminOnly={true}>
              <CustomersPage />
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute adminOnly={true}>
              <ReportsPage />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute adminOnly={true}>
              <SettingsPage />
            </ProtectedRoute>
          } />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
      </Routes>
    </HashRouter>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
