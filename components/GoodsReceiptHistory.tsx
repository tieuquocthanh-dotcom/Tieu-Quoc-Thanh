
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, limit, doc, serverTimestamp, getDocs, runTransaction } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { GoodsReceipt, Supplier, PaymentMethod, Warehouse, Product } from '../types';
// Fixed: Added Users to the list of icons imported from lucide-react
import { Loader, XCircle, Search, ListFilter, Check, Minus, RefreshCw, Undo, DollarSign, ArrowUp, ArrowDown, ArrowUpDown, FileText as FileTextIcon, Edit, Calendar as CalendarIcon, Package, X, Eye, Tag, Users, CreditCard, History } from 'lucide-react';
import Pagination from './Pagination';
import GoodsReceiptDetailModal from './GoodsReceiptDetailModal';
import GoodsReceiptEditModal from './GoodsReceiptEditModal';
import InventoryLedger from './InventoryLedger';
import { formatNumber } from '../utils/formatting';
import * as XLSX from 'xlsx';

const getInitialEndDate = () => new Date().toISOString().split('T')[0];
const getInitialStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Mặc định xem 30 ngày
    return date.toISOString().split('T')[0];
};

type SortKey = 'createdAt' | 'supplierName' | 'total';
type SortDirection = 'asc' | 'desc';

const GoodsReceiptHistory: React.FC<{ userRole: 'admin' | 'staff' | null }> = ({ userRole }) => {
  const [allReceipts, setAllReceipts] = useState<GoodsReceipt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);

  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  const [startDate, setStartDate] = useState(getInitialStartDate);
  const [endDate, setEndDate] = useState(getInitialEndDate);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'debt'>('all');
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'yes' | 'no'>('all');
  
  // Pagination & Sorting
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
      key: 'createdAt',
      direction: 'desc'
  });
  
  const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceipt | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [receiptToEdit, setReceiptToEdit] = useState<GoodsReceipt | null>(null);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [selectedLedgerProductId, setSelectedLedgerProductId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
      const fetchAuxData = async () => {
          try {
              const [supSnap, paySnap, wareSnap, prodSnap] = await Promise.all([
                  getDocs(query(collection(db, "suppliers"), orderBy("name"))),
                  getDocs(query(collection(db, "paymentMethods"), orderBy("name"))),
                  getDocs(query(collection(db, "warehouses"), orderBy("name"))),
                  getDocs(query(collection(db, "products"), orderBy("name")))
              ]);
              setSuppliers(supSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
              setPaymentMethods(paySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod)));
              setWarehouses(wareSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
              setProducts(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
          } catch (e) { console.error(e); }
      };
      fetchAuxData();

      const handleClickOutside = (event: MouseEvent) => {
        if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
            setIsSupplierDropdownOpen(false);
        }
        if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
            setIsProductDropdownOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
        setLoading(true);
    }, 0);
    const q = query(collection(db, "goodsReceipts"), orderBy("createdAt", "desc"), limit(500));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GoodsReceipt)));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("Lỗi kết nối dữ liệu.");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredReceipts = useMemo(() => {
    let result = allReceipts.filter(receipt => {
        if (startDate || endDate) {
            if (!receipt.createdAt) return false;
            const receiptDate = receipt.createdAt.toDate();
            receiptDate.setHours(0, 0, 0, 0);

            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                if (receiptDate < start) return false;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (receiptDate > end) return false;
            }
        }

        if (supplierSearchTerm) {
            const lowerTerm = supplierSearchTerm.toLowerCase();
            const matchesName = (receipt.supplierName || '').toLowerCase().includes(lowerTerm);
            const matchesId = receipt.id.toLowerCase().includes(lowerTerm);
            if (!matchesName && !matchesId) return false;
        }

        if (productSearchTerm) {
            const lowerProduct = productSearchTerm.toLowerCase();
            const hasProduct = receipt.items?.some(item => 
                item.productName.toLowerCase().includes(lowerProduct)
            );
            if (!hasProduct) return false;
        }

        if (paymentFilter !== 'all' && receipt.paymentStatus !== paymentFilter) return false;

        if (invoiceFilter !== 'all') {
            const hasInv = receipt.hasInvoice === true;
            if (invoiceFilter === 'yes' && !hasInv) return false;
            if (invoiceFilter === 'no' && hasInv) return false;
        }

        return true;
    });

    result.sort((a, b) => {
        let valA: any = a[sortConfig.key];
        let valB: any = b[sortConfig.key];
        
        if (sortConfig.key === 'createdAt') {
            valA = a.createdAt?.toMillis() || 0;
            valB = b.createdAt?.toMillis() || 0;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    return result;
  }, [allReceipts, startDate, endDate, supplierSearchTerm, productSearchTerm, paymentFilter, invoiceFilter, sortConfig]);

  const suggestedProducts = useMemo(() => {
    if (!productSearchTerm.trim()) return [];
    const lower = productSearchTerm.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(lower)).slice(0, 10);
  }, [products, productSearchTerm]);

  const paginatedReceipts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredReceipts.slice(startIndex, startIndex + pageSize);
  }, [filteredReceipts, currentPage, pageSize]);

  const requestSort = (key: SortKey) => {
      setSortConfig(prev => ({
          key,
          direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
      setCurrentPage(1);
  };

  const getSortIcon = (key: SortKey) => {
      if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-slate-300 ml-1" />;
      return sortConfig.direction === 'asc' 
          ? <ArrowUp size={14} className="text-primary ml-1" /> 
          : <ArrowDown size={14} className="text-primary ml-1" />;
  };

  const togglePaymentStatus = async (receipt: GoodsReceipt) => {
    if (!receipt.paymentMethodId) {
        alert("Phiếu này chưa được chọn phương thức thanh toán. Vui lòng bấm 'Sửa' để thiết lập.");
        return;
    }
    setUpdatingId(receipt.id);
    try {
        await runTransaction(db, async (transaction) => {
            const receiptRef = doc(db, 'goodsReceipts', receipt.id);
            const accRef = doc(db, 'paymentMethods', receipt.paymentMethodId!);
            
            const accSnap = await transaction.get(accRef);
            if (!accSnap.exists()) throw "Tài khoản không tồn tại.";
            
            const currentBal = accSnap.data().balance || 0;
            const shortId = receipt.id.substring(0, 8).toUpperCase();

            if (receipt.paymentStatus === 'debt') {
                const newBal = currentBal - receipt.total;
                transaction.update(accRef, { balance: newBal });
                transaction.update(receiptRef, { paymentStatus: 'paid', paidAt: serverTimestamp(), amountPaid: receipt.total });

                const logRef = doc(collection(db, 'paymentLogs'));
                transaction.set(logRef, {
                    paymentMethodId: receipt.paymentMethodId,
                    paymentMethodName: receipt.paymentMethodName || 'N/A',
                    type: 'withdraw',
                    amount: receipt.total,
                    balanceAfter: newBal,
                    note: `Thanh toán nợ NCC: ${receipt.supplierName}_ mã ${shortId}`,
                    relatedId: receipt.id,
                    relatedType: 'receipt',
                    createdAt: serverTimestamp(),
                    creatorName: auth.currentUser?.displayName || 'Hệ thống'
                });
            } else {
                const newBal = currentBal + receipt.total;
                transaction.update(accRef, { balance: newBal });
                transaction.update(receiptRef, { paymentStatus: 'debt', paidAt: null, amountPaid: 0 });

                const logRef = doc(collection(db, 'paymentLogs'));
                transaction.set(logRef, {
                    paymentMethodId: receipt.paymentMethodId,
                    paymentMethodName: receipt.paymentMethodName || 'N/A',
                    type: 'deposit',
                    amount: receipt.total,
                    balanceAfter: newBal,
                    note: `Hoàn tiền phiếu nhập (Chuyển sang nợ): ${receipt.supplierName}_ mã ${shortId}`,
                    relatedId: receipt.id,
                    relatedType: 'receipt',
                    createdAt: serverTimestamp(),
                    creatorName: auth.currentUser?.displayName || 'Hệ thống'
                });
            }
        });
    } catch (err: any) {
        console.error(err);
        alert("Lỗi: " + (err.message || err));
    } finally {
        setUpdatingId(null);
    }
  };

  const openDetailModal = (receipt: GoodsReceipt) => {
    setSelectedReceipt(receipt);
    setIsDetailModalOpen(true);
  };

  const openEditModal = (receipt: GoodsReceipt) => {
    setReceiptToEdit(receipt);
    setIsEditModalOpen(true);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const totalAmountDisplayed = useMemo(() => filteredReceipts.reduce((acc, curr) => acc + (curr.total || 0), 0), [filteredReceipts]);

  const exportListToExcel = () => {
    if (filteredReceipts.length === 0) {
      alert("Không có dữ liệu để xuất!");
      return;
    }
    const dataToExport = filteredReceipts.map((receipt, index) => ({
      STT: index + 1,
      "Mã phiếu": receipt.id.substring(0, 8).toUpperCase(),
      "Thời gian": receipt.createdAt?.toDate().toLocaleString('vi-VN'),
      "Nhà cung cấp": receipt.supplierName || 'N/A',
      "Kho nhập": receipt.warehouseName || 'N/A',
      "Tổng tiền (VNĐ)": receipt.total || 0,
      "Trạng thái": receipt.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Công nợ',
      "Đã trả (VNĐ)": receipt.amountPaid || 0,
      "Hóa đơn đỏ": receipt.hasInvoice ? 'Có' : 'Không',
      "Ghi chú": receipt.paymentStatus === 'paid' && !receipt.amountPaid && receipt.total > 0 ? "Chuyển từ Nợ" : "",
      "Phương thức thanh toán": receipt.paymentMethodName || 'N/A',
      "Người tạo": receipt.creatorName || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LichSuNhapHang");
    XLSX.writeFile(wb, `Lich_Su_Nhap_Hang_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md space-y-6">
      <GoodsReceiptDetailModal receipt={selectedReceipt} isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} userRole={userRole} />
      <GoodsReceiptEditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} receipt={receiptToEdit} suppliers={suppliers} paymentMethods={paymentMethods} warehouses={warehouses} products={products} />

      {isLedgerModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border-4 border-slate-800">
                  <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
                      <h2 className="text-xl font-black uppercase tracking-tighter flex items-center">
                          <History className="mr-2" size={24} />
                          Truy vết biến động kho
                      </h2>
                      <button onClick={() => setIsLedgerModalOpen(false)} className="hover:bg-slate-700 p-2 rounded-full transition">
                          <X size={24} />
                      </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                      <InventoryLedger initialProductId={selectedLedgerProductId || 'all'} />
                  </div>
                  <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
                      <button 
                          onClick={() => setIsLedgerModalOpen(false)}
                          className="px-6 py-2 bg-slate-800 text-white rounded-xl font-black text-xs uppercase hover:bg-slate-700 transition shadow-lg"
                      >
                          Đóng
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* FILTER PANEL */}
      <div className="space-y-4">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="relative" ref={supplierDropdownRef}>
                 <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                 <input 
                    type="text" 
                    placeholder="Tìm nhà cung cấp..." 
                    value={supplierSearchTerm} 
                    onChange={(e) => { setSupplierSearchTerm(e.target.value); setIsSupplierDropdownOpen(true); setCurrentPage(1); }}
                    onFocus={() => setIsSupplierDropdownOpen(true)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-primary outline-none font-bold placeholder-slate-400"
                 />
                 {isSupplierDropdownOpen && supplierSearchTerm && (
                     <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                         {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase())).map(s => (
                             <button key={s.id} onClick={() => { setSupplierSearchTerm(s.name); setIsSupplierDropdownOpen(false); setCurrentPage(1); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 text-sm font-bold border-b last:border-0 text-slate-900">{s.name}</button>
                         ))}
                     </div>
                 )}
             </div>

             <div className="relative" ref={productDropdownRef}>
                 <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                 <input 
                    type="text" 
                    placeholder="Tìm sản phẩm..." 
                    value={productSearchTerm} 
                    onChange={(e) => { setProductSearchTerm(e.target.value); setIsProductDropdownOpen(true); setCurrentPage(1); }}
                    onFocus={() => setIsProductDropdownOpen(true)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none font-bold placeholder-slate-400"
                 />
                 {isProductDropdownOpen && productSearchTerm && (
                     <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                         {suggestedProducts.map(p => (
                             <button key={p.id} onClick={() => { setProductSearchTerm(p.name); setIsProductDropdownOpen(false); setCurrentPage(1); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 text-sm font-bold border-b last:border-0 text-slate-900">{p.name}</button>
                         ))}
                     </div>
                 )}
             </div>

             <div className="relative">
                <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                <select value={paymentFilter} onChange={e => { setPaymentFilter(e.target.value as any); setCurrentPage(1); }} className="w-full pl-10 pr-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-primary outline-none appearance-none font-bold">
                    <option value="all">Tất cả thanh toán</option>
                    <option value="debt">Công nợ (Chưa trả)</option>
                    <option value="paid">Đã trả tiền</option>
                </select>
             </div>
             <div className="relative">
                <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                <select value={invoiceFilter} onChange={e => { setInvoiceFilter(e.target.value as any); setCurrentPage(1); }} className="w-full pl-10 pr-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none appearance-none font-bold">
                    <option value="all">Tất cả hóa đơn</option>
                    <option value="yes">Có HĐ đỏ</option>
                    <option value="no">Chưa có HĐ</option>
                </select>
             </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="relative flex items-center">
                <CalendarIcon className="absolute left-3 text-slate-400" size={18}/>
                <span className="ml-10 mr-2 text-xs font-black uppercase text-slate-400">Từ:</span>
                <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }} className="flex-1 px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-primary outline-none font-bold [color-scheme:dark]"/>
             </div>
             <div className="relative flex items-center">
                <CalendarIcon className="absolute left-3 text-slate-400" size={18}/>
                <span className="ml-10 mr-2 text-xs font-black uppercase text-slate-400">Đến:</span>
                <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }} className="flex-1 px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-primary outline-none font-bold [color-scheme:dark]"/>
             </div>
         </div>
      </div>

      {isAdmin && filteredReceipts.length > 0 && (
          <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl flex items-center justify-between shadow-sm flex-wrap gap-4">
              <div className="flex items-center text-blue-800">
                  <DollarSign className="mr-2" size={24}/>
                  <span className="font-black uppercase text-sm tracking-tight">Tổng chi nhập hàng (Kỳ này):</span>
                  <span className="text-2xl font-black text-blue-700 ml-4">{formatNumber(totalAmountDisplayed)} ₫</span>
              </div>
              <button 
                  onClick={exportListToExcel} 
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md transition flex items-center"
              >
                  <FileTextIcon size={16} className="mr-2" />
                  Xuất Excel
              </button>
          </div>
      )}

      {/* TABLE */}
      <div className="overflow-x-auto border-2 border-slate-100 rounded-xl">
        {loading ? (
          <div className="p-20 flex justify-center items-center"><Loader className="animate-spin text-primary" size={40} /></div>
        ) : filteredReceipts.length === 0 ? (
          <div className="p-20 text-center text-neutral flex flex-col items-center">
            <Package size={64} className="mb-4 text-slate-200"/>
            <h3 className="text-xl font-bold text-slate-400 uppercase">Không tìm thấy phiếu nhập nào</h3>
            <p className="text-sm">Thử thay đổi bộ lọc hoặc thời gian tìm kiếm.</p>
          </div>
        ) : (
            <table className="w-full text-left">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="p-4 text-xs font-black uppercase tracking-widest cursor-pointer hover:bg-slate-700 transition" onClick={() => requestSort('createdAt')}>Ngày Nhập {getSortIcon('createdAt')}</th>
                    <th className="p-4 text-xs font-black uppercase tracking-widest">Ngày Thanh Toán</th>
                    <th className="p-4 text-xs font-black uppercase tracking-widest cursor-pointer hover:bg-slate-700 transition" onClick={() => requestSort('supplierName')}>Nhà Cung Cấp {getSortIcon('supplierName')}</th>
                    <th className="p-4 text-xs font-black uppercase tracking-widest">PT Thanh Toán</th>
                    {isAdmin && <th className="p-4 text-xs font-black uppercase tracking-widest text-right cursor-pointer hover:bg-slate-700 transition" onClick={() => requestSort('total')}>Tổng Tiền {getSortIcon('total')}</th>}
                    <th className="p-4 text-xs font-black uppercase tracking-widest text-center">Thanh Toán</th>
                    <th className="p-4 text-xs font-black uppercase tracking-widest text-center">Hóa Đơn</th>
                    <th className="p-4 text-xs font-black uppercase tracking-widest">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedReceipts.map((receipt) => (
                    <tr key={receipt.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4 text-sm font-bold text-slate-600">
                        {receipt.createdAt?.toDate().toLocaleDateString('vi-VN')}
                        <div className="text-[10px] font-normal text-slate-400">{receipt.createdAt?.toDate().toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</div>
                      </td>
                      <td className="p-4 text-sm font-bold text-slate-600">
                        {receipt.paidAt ? (
                            <>
                                {receipt.paidAt.toDate().toLocaleDateString('vi-VN')}
                                <div className="text-[10px] font-normal text-slate-400">{receipt.paidAt.toDate().toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</div>
                            </>
                        ) : (
                            <span className="text-slate-300 font-normal italic">-</span>
                        )}
                      </td>
                      <td className="p-4 font-black text-dark uppercase text-sm">{receipt.supplierName}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center text-xs font-bold text-slate-600">
                            {receipt.paymentMethodName ? (
                                <><CreditCard size={14} className="mr-1.5 text-slate-400"/> {receipt.paymentMethodName}</>
                            ) : (
                                <span className="text-slate-300 italic">Chưa chọn</span>
                            )}
                        </span>
                      </td>
                      {isAdmin && <td className="p-4 font-black text-green-600 text-right">{formatNumber(receipt.total)} ₫</td>}
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 text-[10px] font-black rounded-full uppercase ${receipt.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {receipt.paymentStatus === 'paid' ? 'Đã trả' : 'Ghi nợ'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                         <span className={`px-2 py-1 text-[10px] font-black rounded-full uppercase ${receipt.hasInvoice ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-400'}`}>
                            {receipt.hasInvoice ? 'Có HĐ' : 'Chưa HĐ'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-1">
                            {isAdmin && (receipt.paymentStatus === 'debt' ? (
                                <button onClick={() => togglePaymentStatus(receipt)} disabled={updatingId === receipt.id} className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition" title="Xác nhận đã trả tiền">
                                    {updatingId === receipt.id ? <RefreshCw size={16} className="animate-spin" /> : <Check size={18} />}
                                </button>
                            ) : (
                                <button onClick={() => togglePaymentStatus(receipt)} disabled={updatingId === receipt.id} className="p-2 text-orange-600 hover:bg-orange-100 rounded-lg transition" title="Hủy xác nhận trả (Chuyển về nợ)">
                                    {updatingId === receipt.id ? <RefreshCw size={16} className="animate-spin" /> : <Undo size={18} />}
                                </button>
                            ))}
                            <button onClick={() => openEditModal(receipt)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition" title="Chỉnh sửa"><Edit size={18} /></button>
                            <button onClick={() => openDetailModal(receipt)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition" title="Xem chi tiết"><Eye size={18} /></button>
                            <button 
                                onClick={() => {
                                    // If multiple products, we can't pre-filter easily without a specific product selection
                                    // But we can open the ledger and let the user choose
                                    setSelectedLedgerProductId('all');
                                    setIsLedgerModalOpen(true);
                                }} 
                                className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition" 
                                title="Truy vết tồn kho"
                            >
                                <History size={18} />
                            </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        )}
      </div>

      <Pagination 
        currentPage={currentPage} 
        pageSize={pageSize} 
        totalItems={filteredReceipts.length} 
        onPageChange={setCurrentPage} 
        onPageSizeChange={handlePageSizeChange} 
      />

      {isLedgerModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border-4 border-slate-800">
                  <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
                      <h2 className="text-xl font-black uppercase tracking-tighter flex items-center">
                          <History className="mr-2" size={24} />
                          Truy vết biến động kho
                      </h2>
                      <button onClick={() => setIsLedgerModalOpen(false)} className="hover:bg-slate-700 p-2 rounded-full transition">
                          <X size={24} />
                      </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                      <InventoryLedger initialProductId={selectedLedgerProductId || 'all'} />
                  </div>
                  <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
                      <button 
                          onClick={() => setIsLedgerModalOpen(false)}
                          className="px-6 py-2 bg-slate-800 text-white rounded-xl font-black text-xs uppercase hover:bg-slate-700 transition shadow-lg"
                      >
                          Đóng
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default GoodsReceiptHistory;
