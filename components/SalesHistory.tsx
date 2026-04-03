import React from 'react';
import { Sale } from '../types';

interface SalesHistoryProps {
  sales: Sale[];
  onViewDetail: (sale: Sale) => void;
  onEdit: (sale: Sale) => void;
  isAdmin: boolean;
}

const SalesHistory: React.FC<SalesHistoryProps> = ({ sales, onViewDetail, onEdit, isAdmin }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h3 className="font-black text-lg mb-4">Lịch sử bán hàng</h3>
      <div className="space-y-2">
        {sales.map(sale => (
          <div key={sale.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div>
              <p className="font-bold text-sm">{sale.id}</p>
              <p className="text-xs text-slate-500">{new Date(sale.createdAt.seconds * 1000).toLocaleString('vi-VN')}</p>
            </div>
            <div className="flex space-x-2">
              <button onClick={() => onViewDetail(sale)} className="text-blue-600 hover:underline text-sm font-bold">Chi tiết</button>
              {isAdmin && <button onClick={() => onEdit(sale)} className="text-amber-600 hover:underline text-sm font-bold">Sửa</button>}
            </div>
          </div>
        ))}
        {sales.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Chưa có đơn hàng nào.</p>}
      </div>
    </div>
  );
};

export default SalesHistory;
