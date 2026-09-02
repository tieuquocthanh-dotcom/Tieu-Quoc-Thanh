import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Loader, Package, FileText, Calendar, Search, User, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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

const TransferHistory: React.FC<{ userRole?: 'admin' | 'staff' | null }> = ({ userRole }) => {
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Sorting state
  const [sortKey, setSortKey] = useState<keyof TransferRecord>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: keyof TransferRecord) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

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
      (t.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.fromWarehouseName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.toWarehouseName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.creatorName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [transfers, searchTerm]);

  const sortedTransfers = useMemo(() => {
    const list = [...filteredTransfers];
    list.sort((a, b) => {
      let aVal: any = a[sortKey];
      let bVal: any = b[sortKey];

      if (sortKey === 'createdAt') {
        const aTime = a.createdAt?.toMillis() || 0;
        const bTime = b.createdAt?.toMillis() || 0;
        return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
      }

      if (typeof aVal === 'string') {
        const cmp = (aVal || '').localeCompare(bVal || '', 'vi');
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      aVal = aVal ?? 0;
      bVal = bVal ?? 0;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return list;
  }, [filteredTransfers, sortKey, sortDirection]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedTransfers.slice(startIndex, startIndex + pageSize);
  }, [sortedTransfers, currentPage]);

  const exportToExcel = () => {
    if (sortedTransfers.length === 0) {
      alert("Không có dữ liệu để xuất!");
      return;
    }
    const dataToExport = sortedTransfers.map((t, index) => ({
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

  const renderSortIcon = (key: keyof TransferRecord) => {
    if (sortKey === key) {
      return sortDirection === 'asc' ? <ArrowUp size={13} className="text-primary inline ml-1 shrink-0" /> : <ArrowDown size={13} className="text-primary inline ml-1 shrink-0" />;
    }
    return <ArrowUpDown size={13} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity inline ml-1 shrink-0" />;
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Tìm theo sản phẩm, kho, người chuyển..."
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
                <th onClick={() => handleSort('createdAt')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group select-none">
                  <div className="flex items-center gap-1">
                    <span>Ngày chuyển</span>
                    {renderSortIcon('createdAt')}
                  </div>
                </th>
                <th onClick={() => handleSort('productName')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group select-none">
                  <div className="flex items-center gap-1">
                    <span>Sản phẩm</span>
                    {renderSortIcon('productName')}
                  </div>
                </th>
                <th onClick={() => handleSort('quantity')} className="px-4 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors group select-none">
                  <div className="flex items-center justify-center gap-1">
                    <span>Số lượng</span>
                    {renderSortIcon('quantity')}
                  </div>
                </th>
                <th onClick={() => handleSort('fromWarehouseName')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group select-none">
                  <div className="flex items-center gap-1">
                    <span>Từ kho</span>
                    {renderSortIcon('fromWarehouseName')}
                  </div>
                </th>
                <th onClick={() => handleSort('toWarehouseName')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group select-none">
                  <div className="flex items-center gap-1">
                    <span>Đến kho</span>
                    {renderSortIcon('toWarehouseName')}
                  </div>
                </th>
                {userRole === 'admin' && (
                  <th onClick={() => handleSort('creatorName')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group select-none">
                    <div className="flex items-center gap-1">
                      <span>Người chuyển</span>
                      {renderSortIcon('creatorName')}
                    </div>
                  </th>
                )}
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
                  {userRole === 'admin' && (
                  <td className="px-4 py-3">
                      <span className="inline-flex items-center text-[10px] font-black bg-emerald-50 text-emerald-800 px-2 py-1 rounded-full border border-emerald-200 uppercase">
                          <User size={12} className="mr-1"/> {t.creatorName}
                      </span>
                  </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {sortedTransfers.length > pageSize && (
        <Pagination 
          currentPage={currentPage} 
          pageSize={pageSize}
          totalItems={sortedTransfers.length} 
          onPageChange={setCurrentPage} 
          onPageSizeChange={() => {}} 
        />
      )}
    </div>
  );
};

export default TransferHistory;
