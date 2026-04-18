import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Loader, Package, FileText, Calendar, Search } from 'lucide-react';
import Pagination from './Pagination';
import * as XLSX from 'xlsx';

interface TransferRecord {
  id: string;
  productId: string;
  productName: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  quantity: number;
  stockBeforeFrom?: number;
  stockAfterFrom?: number;
  stockBeforeTo?: number;
  stockAfterTo?: number;
  createdAt: Timestamp | null;
  creatorName: string;
}

const TransferHistory: React.FC = () => {
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    const q = query(
      collection(db, 'warehouseTransfers'),
      orderBy('createdAt', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TransferRecord));
      setTransfers(results);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching transfer history:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => 
      t.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.fromWarehouseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.toWarehouseName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [transfers, searchTerm]);

  const totalPages = Math.ceil(filteredTransfers.length / pageSize);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredTransfers.slice(startIndex, startIndex + pageSize);
  }, [filteredTransfers, currentPage]);

  const exportToExcel = () => {
    if (filteredTransfers.length === 0) {
      alert("Không có dữ liệu để xuất!");
      return;
    }
    const dataToExport = filteredTransfers.map((t, index) => ({
      STT: index + 1,
      "Sản phẩm": t.productName,
      "Số lượng": t.quantity,
      "Từ kho": t.fromWarehouseName,
      "Từ kho (SL cũ)": t.stockBeforeFrom !== undefined ? t.stockBeforeFrom : 'N/A',
      "Từ kho (SL mới)": t.stockAfterFrom !== undefined ? t.stockAfterFrom : 'N/A',
      "Đến kho": t.toWarehouseName,
      "Đến kho (SL cũ)": t.stockBeforeTo !== undefined ? t.stockBeforeTo : 'N/A',
      "Đến kho (SL mới)": t.stockAfterTo !== undefined ? t.stockAfterTo : 'N/A',
      "Ngày chuyển": t.createdAt?.toDate().toLocaleString('vi-VN') || 'N/A',
      "Người thực hiện": t.creatorName
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LichSuChuyenKho");
    XLSX.writeFile(wb, `Lich_Su_Chuyen_Kho_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Tìm theo sản phẩm, kho..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm font-bold"
          />
        </div>
        <button 
            onClick={exportToExcel} 
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md transition flex items-center w-full md:w-auto justify-center"
        >
            <FileText size={16} className="mr-2" />
            Xuất Excel
        </button>
      </div>

      <div className="overflow-x-auto border-2 border-slate-100 rounded-xl">
        {loading ? (
          <div className="p-20 flex justify-center items-center"><Loader className="animate-spin text-primary" size={40} /></div>
        ) : paginatedData.length === 0 ? (
          <div className="p-20 text-center text-neutral flex flex-col items-center">
            <Package size={64} className="mb-4 text-slate-200"/>
            <h3 className="text-xl font-bold text-slate-400 uppercase">Không có lịch sử chuyển kho</h3>
          </div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr className="text-xs font-black text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Ngày chuyển</th>
                <th className="px-4 py-3">Sản phẩm</th>
                <th className="px-4 py-3 text-center">Số lượng</th>
                <th className="px-4 py-3">Từ kho</th>
                <th className="px-4 py-3">Đến kho</th>
                <th className="px-4 py-3">Người chuyển</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 flex justify-start items-center">
                      <Calendar size={14} className="mr-2 text-slate-400" />
                      <span className="font-bold text-slate-700">{t.createdAt?.toDate().toLocaleString('vi-VN') || 'N/A'}</span>
                  </td>
                  <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 line-clamp-1" title={t.productName}>{t.productName}</div>
                  </td>
                  <td className="px-4 py-3 text-center font-black text-primary text-base">
                      {t.quantity}
                  </td>
                  <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{t.fromWarehouseName}</div>
                      {t.stockBeforeFrom !== undefined && t.stockAfterFrom !== undefined && (
                        <div className="text-xs text-slate-500 font-medium">SL: {t.stockBeforeFrom} &rarr; {t.stockAfterFrom}</div>
                      )}
                  </td>
                  <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{t.toWarehouseName}</div>
                      {t.stockBeforeTo !== undefined && t.stockAfterTo !== undefined && (
                        <div className="text-xs text-slate-500 font-medium">SL: {t.stockBeforeTo} &rarr; {t.stockAfterTo}</div>
                      )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-medium">
                      {t.creatorName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filteredTransfers.length > pageSize && (
        <Pagination 
          currentPage={currentPage} 
          pageSize={pageSize}
          totalItems={filteredTransfers.length} 
          onPageChange={setCurrentPage} 
          onPageSizeChange={() => {}} 
        />
      )}
    </div>
  );
};

export default TransferHistory;
