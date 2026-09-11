import { useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import ProductGrid from '@/components/pos/ProductGrid';
import CartPanel from '@/components/pos/CartPanel';
import PosShiftBar from '@/components/pos/PosShiftBar';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { useCartStore } from '@/stores/cartStore';

const Index = () => {
  const { tenant } = useMultiTenant();
  const setTaxRate = useCartStore((state) => state.setTaxRate);

  useEffect(() => {
    const taxRateVal = tenant?.tax_rate !== undefined && tenant?.tax_rate !== null ? Number(tenant.tax_rate) : 0;
    setTaxRate(taxRateVal);
  }, [tenant, setTaxRate]);

  return (
    <MainLayout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Independent Shift Management Bar on POS Screen */}
        <PosShiftBar />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Product Grid - Main Area */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <ProductGrid />
          </div>
          
          {/* Cart Panel - Right Side */}
          <div className="w-[340px] flex-shrink-0 border-l border-slate-200">
            <CartPanel />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
