import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { GoodsReceipt as IGoodsReceipt } from '../types';
import { formatNumber } from '../utils/formatting';
import { Search, Eye } from 'lucide-react';

const GoodsReceiptHistory: React.FC = () => {
  const [receipts, setReceipts] = useState<IGoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<IGoodsReceipt | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'goodsReceipts'), orderBy('createdAt', 'desc'), limit(100)), (snapshot) => {
      setReceipts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as IGoodsReceipt)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredReceipts = receipts.filter(r => 
    r.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.supplierName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedReceipt) {
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedReceipt(null)} className="text-blue-600 font-bold text-sm hover:underline">
          &larr; Quay lại danh sách
        </button>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold mb-4">Chi tiết phiếu nhập: {selectedReceipt.id}</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div><p className="text-slate-500 text-sm">Nhà cung cấp</p><p className="font-bold">{selectedReceipt.supplierName}</p></div>
            <div><p className="text-slate-500 text-sm">Thời gian</p><p className="font-bold">{selectedReceipt.createdAt?.toDate().toLocaleString('vi-VN')}</p></div>
            <div><p className="text-slate-500 text-sm">Trạng thái thanh toán</p><p className="font-bold">{selectedReceipt.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Ghi nợ'}</p></div>
            <div><p className="text-slate-500 text-sm">Kho nhập</p><p className="font-bold">{selectedReceipt.warehouseName}</p></div>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="p-3">Sản phẩm</th>
                <th className="p-3 text-center">SL</th>
                <th className="p-3 text-right">Giá nhập</th>
                <th className="p-3 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {selectedReceipt.items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="p-3 font-medium">{item.productName}</td>
                  <td className="p-3 text-center">{item.quantity}</td>
                  <td className="p-3 text-right">{formatNumber(item.importPrice)}</td>
                  <td className="p-3 text-right font-bold">{formatNumber(item.importPrice * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 text-right space-y-2">
            <p className="text-xl font-bold text-blue-600">Tổng cộng: {formatNumber(selectedReceipt.total)}</p>
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
          placeholder="Tìm theo mã phiếu hoặc tên nhà cung cấp..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-none"
        />
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
              <th className="p-4">Mã phiếu</th>
              <th className="p-4">Thời gian</th>
              <th className="p-4">Nhà cung cấp</th>
              <th className="p-4 text-right">Tổng tiền</th>
              <th className="p-4 text-center">Trạng thái</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {filteredReceipts.map(receipt => (
              <tr key={receipt.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-4 text-sm font-medium">{receipt.id?.slice(0, 8)}</td>
                <td className="p-4 text-sm text-slate-500">{receipt.createdAt?.toDate().toLocaleString('vi-VN')}</td>
                <td className="p-4 text-sm">{receipt.supplierName}</td>
                <td className="p-4 text-sm text-right font-bold text-blue-600">{formatNumber(receipt.total)}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${receipt.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {receipt.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Ghi nợ'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => setSelectedReceipt(receipt)} className="text-blue-500 hover:text-blue-700">
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

export default GoodsReceiptHistory;
