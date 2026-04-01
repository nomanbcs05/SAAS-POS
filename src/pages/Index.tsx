import { useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import ProductGrid from '@/components/pos/ProductGrid';
import CartPanel from '@/components/pos/CartPanel';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { useCartStore } from '@/stores/cartStore';

const Index = () => {
  const { tenant } = useMultiTenant();
  const setTaxRate = useCartStore((state) => state.setTaxRate);

  useEffect(() => {
    if (tenant?.tax_rate !== undefined) {
      setTaxRate(Number(tenant.tax_rate));
    }
  }, [tenant, setTaxRate]);

  return (
    <MainLayout>
      <div className="flex h-full">
        {/* Product Grid - Main Area */}
        <div className="flex-1 min-w-0">
          <ProductGrid />
        </div>
        
        {/* Cart Panel - Right Side */}
        <div className="w-[340px] flex-shrink-0">
          <CartPanel />
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
