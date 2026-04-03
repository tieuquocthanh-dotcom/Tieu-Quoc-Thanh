import React from 'react';
import { Sale } from '../types';

interface ProductSalesHistoryProps {
  productId: string;
  sales: Sale[];
}

const ProductSalesHistory: React.FC<ProductSalesHistoryProps> = ({ productId, sales }) => {
  const productSales = sales.filter(sale => sale.items.some(item => item.productId === productId));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h3 className="font-black text-lg mb-4">Lịch sử bán sản phẩm này</h3>
      <div className="space-y-2">
        {productSales.map(sale => {
          const item = sale.items.find(i => i.productId === productId);
          if (!item) return null;
          return (
            <div key={sale.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <p className="font-bold text-sm">{new Date(sale.createdAt.seconds * 1000).toLocaleString('vi-VN')}</p>
                <p className="text-xs text-slate-500">Đơn: {sale.id}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm text-primary">{item.quantity} x {item.price.toLocaleString('vi-VN')} ₫</p>
              </div>
            </div>
          );
        })}
        {productSales.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Chưa có lịch sử bán.</p>}
      </div>
    </div>
  );
};

export default ProductSalesHistory;
