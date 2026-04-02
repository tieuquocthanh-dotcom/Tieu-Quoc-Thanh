import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Sale } from '../types';
import { formatNumber } from '../utils/formatting';
import { FileText, Search, Eye } from 'lucide-react';

const SalesHistory: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(100)), (snapshot) => {
      setSales(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Sale)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredSales = sales.filter(s => 
    s.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedSale) {
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedSale(null)} className="text-blue-600 font-bold text-sm hover:underline">
          &larr; Quay lại danh sách
        </button>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold mb-4">Chi tiết đơn hàng: {selectedSale.id}</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div><p className="text-slate-500 text-sm">Khách hàng</p><p className="font-bold">{selectedSale.customerName || 'Khách vãng lai'}</p></div>
            <div><p className="text-slate-500 text-sm">Thời gian</p><p className="font-bold">{selectedSale.createdAt?.toDate().toLocaleString('vi-VN')}</p></div>
            <div><p className="text-slate-500 text-sm">Trạng thái</p><p className="font-bold">{selectedSale.status === 'paid' ? 'Đã thanh toán' : 'Ghi nợ'}</p></div>
            <div><p className="text-slate-500 text-sm">Kho</p><p className="font-bold">{selectedSale.warehouseName}</p></div>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="p-3">Sản phẩm</th>
                <th className="p-3 text-center">SL</th>
                <th className="p-3 text-right">Đơn giá</th>
                <th className="p-3 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {selectedSale.items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="p-3 font-medium">{item.productName}</td>
                  <td className="p-3 text-center">{item.quantity}</td>
                  <td className="p-3 text-right">{formatNumber(item.price)}</td>
                  <td className="p-3 text-right font-bold">{formatNumber(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 text-right space-y-2">
            <p className="text-slate-500">Phí ship: {formatNumber(selectedSale.shippingFee || 0)}</p>
            <p className="text-slate-500">Giảm giá: {formatNumber(selectedSale.discount || 0)}</p>
            <p className="text-xl font-bold text-blue-600">Tổng cộng: {formatNumber(selectedSale.total)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Tìm theo mã đơn hoặc tên khách hàng..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-none"
        />
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
              <th className="p-4">Mã đơn</th>
              <th className="p-4">Thời gian</th>
              <th className="p-4">Khách hàng</th>
              <th className="p-4 text-right">Tổng tiền</th>
              <th className="p-4 text-center">Trạng thái</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map(sale => (
              <tr key={sale.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-4 text-sm font-medium">{sale.id?.slice(0, 8)}</td>
                <td className="p-4 text-sm text-slate-500">{sale.createdAt?.toDate().toLocaleString('vi-VN')}</td>
                <td className="p-4 text-sm">{sale.customerName || 'Khách vãng lai'}</td>
                <td className="p-4 text-sm text-right font-bold text-blue-600">{formatNumber(sale.total)}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${sale.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {sale.status === 'paid' ? 'Đã thanh toán' : 'Ghi nợ'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => setSelectedSale(sale)} className="text-blue-500 hover:text-blue-700">
                    <Eye size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalesHistory;
