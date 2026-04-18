
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, limit, updateDoc, doc, Timestamp, arrayUnion, writeBatch, increment, getDocs, runTransaction } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { Sale, Customer, PaymentMethod, Shipper, Product, Manufacturer } from '../types';
import { Loader, XCircle, Search, Calendar, Package, RefreshCcw, Truck, DollarSign, CheckCircle, CreditCard, X, Clock, ArrowRight, Save, FileCheck2, TrendingUp, ArrowUp, ArrowDown, ArrowUpDown, Edit, Hash, User, Tag, Wallet, Building, Eye, ChevronLeft, ChevronRight, Filter, ShoppingBag, Receipt, Trash2, Home } from 'lucide-react';
import Pagination from './Pagination';
import SaleDetailModal from './SaleDetailModal';
import SaleEditModal from './SaleEditModal';
import { formatNumber, parseNumber } from '../utils/formatting';
import * as XLSX from 'xlsx';

const getInitialEndDate = () => new Date().toISOString().split('T')[0];
const getInitialStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 7); 
    return date.toISOString().split('T')[0];
};
const getTodayString = () => new Date().toISOString().split('T')[0];

const UpdateShippingModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (shipperId: string, date: string) => void;
    sale: Sale | null;
    shippers: Shipper[];
}> = ({ isOpen, onClose, onConfirm, sale, shippers }) => {
    const [shipperId, setShipperId] = useState('');
    const [shippedDate, setShippedDate] = useState(getTodayString());

    useEffect(() => {
        if (isOpen && sale) {
            setShipperId(sale.shipperId || '');
            setShippedDate(getTodayString());
        }
    }, [isOpen, sale]);

    if (!isOpen || !sale) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border-4 border-slate-800 overflow-hidden">
                <div className="bg-blue-100 p-4 flex justify-between items-center border-b border-slate-200">
                    <h3 className="font-black text-black uppercase text-sm flex items-center">
                        <Truck size={18} className="mr-2 text-blue-600"/> {sale.shippingStatus === 'order' ? 'Xuất Kho' : 'Giao Hàng'}
                    </h3>
                    <button onClick={onClose} className="text-black hover:text-red-500"><X size={24}/></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <p className="text-[10px] font-black text-slate-500 uppercase">Khách hàng</p>
                        <p className="text-sm font-black text-black truncate">{sale.customerName}</p>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Đơn vị vận chuyển</label>
                        <select 
                            value={shipperId} 
                            onChange={(e) => setShipperId(e.target.value)}
                            className="w-full p-2 border-2 border-slate-300 rounded-lg font-black text-sm outline-none focus:border-blue-500"
                        >
                            <option value="">-- Chọn ĐVVC --</option>
                            {shippers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Ngày gửi hàng</label>
                        <input 
                            type="date" 
                            value={shippedDate} 
                            onChange={(e) => setShippedDate(e.target.value)} 
                            className="w-full p-2 border-2 border-slate-300 rounded-lg font-black"
                            style={{ colorScheme: 'light' }}
                        />
                    </div>
                    <button 
                        onClick={() => onConfirm(shipperId, shippedDate)} 
                        disabled={!shipperId}
                        className="w-full py-3 bg-slate-800 text-white font-black rounded-xl text-xs uppercase disabled:bg-slate-300 shadow-lg active:scale-95 transition-all"
                    >
                        Xác nhận cập nhật
                    </button>
                </div>
            </div>
        </div>
    );
};

const DebtPaymentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (date: string, amount: number, paymentMethodId: string) => void;
    sale: Sale | null;
    paymentMethods: PaymentMethod[];
}> = ({ isOpen, onClose, onConfirm, sale, paymentMethods }) => {
    const [paymentDate, setPaymentDate] = useState(getTodayString());
    const [payAmount, setPayAmount] = useState(0);
    const [selectedMethodId, setSelectedMethodId] = useState('');

    useEffect(() => {
        if (isOpen && sale) {
            setPaymentDate(getTodayString());
            setSelectedMethodId('');
            const remaining = sale.total - (sale.amountPaid || 0);
            setPayAmount(remaining > 0 ? remaining : 0);
        }
    }, [isOpen, sale]);

    if (!isOpen || !sale) return null;

    const remaining = sale.total - (sale.amountPaid || 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border-4 border-slate-800 overflow-hidden">
                <div className="bg-orange-100 p-4 flex justify-between items-center border-b border-slate-200">
                    <h3 className="font-black text-black uppercase text-sm flex items-center">
                        <Wallet size={18} className="mr-2 text-orange-600"/> Thu nợ khách hàng
                    </h3>
                    <button onClick={onClose} className="text-black hover:text-red-500"><X size={24}/></button>
                </div>
                <div className="p-5">
                    <div className="bg-slate-50 p-3 rounded-xl mb-4 border border-slate-200 shadow-inner">
                        <p className="text-[10px] font-black text-slate-500 uppercase">Khách hàng</p>
                        <p className="text-sm font-black text-black">{sale.customerName}</p>
                        <div className="mt-2 flex justify-between items-center border-t pt-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase">Nợ hiện tại:</span>
                            <span className="text-lg font-black text-red-600">{formatNumber(remaining)} ₫</span>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Tài khoản thu tiền</label>
                            <select 
                                value={selectedMethodId}
                                onChange={(e) => setSelectedMethodId(e.target.value)}
                                className="w-full p-2.5 border-2 border-slate-800 rounded-xl font-black text-sm outline-none focus:ring-2 focus:ring-primary bg-white text-black"
                            >
                                <option value="">-- Chọn tài khoản thu --</option>
                                {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name} (Dư: {formatNumber(m.balance || 0)} ₫)</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Số tiền thu</label>
                            <input 
                                type="text" inputMode="numeric" 
                                value={formatNumber(payAmount)} 
                                onChange={e => setPayAmount(Math.min(parseNumber(e.target.value), remaining))} 
                                className="w-full p-3 border-2 border-slate-800 rounded-xl text-right font-black text-2xl focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 bg-white shadow-inner" 
                                onFocus={e => e.target.select()}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Ngày thu</label>
                            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="w-full p-2 border-2 border-slate-300 rounded-lg font-black outline-none" style={{ colorScheme: 'light' }} />
                        </div>
                    </div>
                    <button 
                        onClick={() => onConfirm(paymentDate, payAmount, selectedMethodId)} 
                        disabled={payAmount <= 0 || !selectedMethodId} 
                        className="w-full py-3 bg-orange-600 text-white font-black rounded-xl text-xs uppercase mt-6 disabled:bg-slate-300 shadow-lg active:scale-95 transition-all flex items-center justify-center"
                    >
                        <CheckCircle size={18} className="mr-2"/> Xác nhận thu nợ
                    </button>
                </div>
            </div>
        </div>
    );
};

const SalesHistory: React.FC<{ userRole: 'admin' | 'staff' | null }> = ({ userRole }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [shippers, setShippers] = useState<Shipper[]>([]);

  const [startDate, setStartDate] = useState(getInitialStartDate);
  const [endDate, setEndDate] = useState(getInitialEndDate);
  const [shippingFilter, setShippingFilter] = useState<'all' | 'shipped' | 'pending' | 'order'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'debt'>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'all' | 'wholesale' | 'retail'>('all');
  const [manufacturerFilter, setManufacturerFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [shipperFilterVal, setShipperFilterVal] = useState<string>('all');
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [shippingPayerFilter, setShippingPayerFilter] = useState<'all' | 'shop' | 'customer'>('all');

  const [customerSearch, setCustomerSearch] = useState('');
  const [orderIdSearch, setOrderIdSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [saleToPay, setSaleToPay] = useState<Sale | null>(null);
  const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
  const [saleToShip, setSaleToShip] = useState<Sale | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    const fetchAuxData = async () => {
        try {
            const [custSnap, paySnap, shipSnap, prodSnap, manuSnap] = await Promise.all([
                getDocs(query(collection(db, "customers"), orderBy("name"))),
                getDocs(query(collection(db, "paymentMethods"), orderBy("name"))),
                getDocs(query(collection(db, "shippers"), orderBy("name"))),
                getDocs(query(collection(db, "products"), orderBy("name"))),
                getDocs(query(collection(db, "manufacturers"), orderBy("name")))
            ]);
            setCustomers(custSnap.docs.map(d => ({id: d.id, ...d.data()} as Customer)));
            setPaymentMethods(paySnap.docs.map(d => ({id: d.id, ...d.data()} as PaymentMethod)));
            setShippers(shipSnap.docs.map(d => ({id: d.id, ...d.data()} as Shipper)));
            setProducts(prodSnap.docs.map(d => ({id: d.id, ...d.data()} as Product)));
            setManufacturers(manuSnap.docs.map(d => ({id: d.id, ...d.data()} as Manufacturer)));
        } catch (e) { console.error(e); }
    };
    fetchAuxData();

    const handleClickOutside = (event: MouseEvent) => {
        if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) setIsCustomerDropdownOpen(false);
        if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) setIsProductDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setTimeout(() => {
        setLoading(true);
    }, 0);
    const unsubscribe = onSnapshot(query(collection(db, "sales"), orderBy("createdAt", "desc"), limit(500)), (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
      setLoading(false);
    }, (err) => { setError("Lỗi kết nối."); setLoading(false); });
    return () => unsubscribe();
  }, []);

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
        if (startDate || endDate) {
            if (!sale.createdAt) return false;
            const saleDate = sale.createdAt.toDate();
            saleDate.setHours(0, 0, 0, 0);
            if (startDate && saleDate < new Date(startDate)) return false;
            if (endDate) { const ed = new Date(endDate); ed.setHours(23, 59, 59, 999); if (saleDate > ed) return false; }
        }
        if (customerSearch) {
            const lowerSearch = customerSearch.toLowerCase();
            const nameMatch = (sale.customerName || '').toLowerCase().includes(lowerSearch);
            const customer = customers.find(c => c.id === sale.customerId);
            const phoneMatch = customer && customer.phone && customer.phone.includes(lowerSearch);
            if (!nameMatch && !phoneMatch) return false;
        }
        if (orderIdSearch && !(sale.id || '').toLowerCase().includes(orderIdSearch.toLowerCase())) return false;
        if (productSearch) { if (!sale.items?.some(item => item.productName.toLowerCase().includes(productSearch.toLowerCase()))) return false; }
        if (shippingFilter !== 'all') {
            if (shippingFilter === 'shipped') {
                if (sale.shippingStatus !== 'shipped' && sale.shippingStatus !== 'none' && sale.shippingStatus !== undefined) return false;
            } else {
                if (sale.shippingStatus !== shippingFilter) return false;
            }
        }
        if (paymentStatusFilter !== 'all' && sale.status !== paymentStatusFilter) return false;
        if (manufacturerFilter !== 'all') { if (!sale.items?.some(item => products.find(p => p.id === item.productId)?.manufacturerId === manufacturerFilter)) return false; }
        if (paymentMethodFilter !== 'all' && sale.paymentMethodId !== paymentMethodFilter) return false;
        if (shipperFilterVal !== 'all' && sale.shipperId !== shipperFilterVal) return false;
        if (invoiceFilter !== 'all') { const hasInv = sale.issueInvoice === true; if (invoiceFilter === 'yes' && !hasInv) return false; if (invoiceFilter === 'no' && hasInv) return false; }
        if (shippingPayerFilter !== 'all' && sale.shippingPayer !== shippingPayerFilter) return false;
        return true;
    });
  }, [sales, customerSearch, orderIdSearch, productSearch, shippingFilter, paymentStatusFilter, manufacturerFilter, paymentMethodFilter, shipperFilterVal, invoiceFilter, shippingPayerFilter, startDate, endDate, customers, products]);

  const suggestedCustomers = useMemo(() => {
      if (!customerSearch.trim()) return [];
      const lower = customerSearch.toLowerCase();
      return customers.filter(c => c.name.toLowerCase().includes(lower) || (c.phone && c.phone.includes(lower))).slice(0, 10);
  }, [customers, customerSearch]);

  const suggestedProducts = useMemo(() => {
      if (!productSearch.trim()) return [];
      const lower = productSearch.toLowerCase();
      return products.filter(p => p.name.toLowerCase().includes(lower)).slice(0, 10);
  }, [products, productSearch]);

  const stats = useMemo(() => ({
    total: filteredSales.reduce((a, b) => a + b.total, 0),
    profit: filteredSales.reduce((a, b) => a + b.items.reduce((sum, i) => sum + (i.price - (i.importPrice || 0)) * i.quantity, 0), 0)
  }), [filteredSales]);

  const paginatedSales = useMemo(() => filteredSales.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredSales, currentPage, pageSize]);

  const handleConfirmDebtPayment = async (dateString: string, amount: number, paymentMethodId: string) => {
      if (!saleToPay || !paymentMethodId) return;
      try {
          await runTransaction(db, async (transaction) => {
              const saleRef = doc(db, 'sales', saleToPay.id);
              const accRef = doc(db, 'paymentMethods', paymentMethodId);
              
              const accSnap = await transaction.get(accRef);
              if (!accSnap.exists()) throw "Tài khoản không tồn tại.";

              const dateObj = new Date(dateString);
              const now = new Date();
              dateObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
              const ts = Timestamp.fromDate(dateObj);

              const currentBal = accSnap.data().balance || 0;
              const newBal = currentBal + amount;
              const newPaid = (saleToPay.amountPaid || 0) + amount;
              const isFull = newPaid >= saleToPay.total;
              const method = paymentMethods.find(m => m.id === paymentMethodId);

              // Cập nhật đơn hàng
              transaction.update(saleRef, { 
                  status: isFull ? 'paid' : 'debt', 
                  amountPaid: newPaid, 
                  paidAt: isFull ? ts : (saleToPay.paidAt || null), 
                  paymentHistory: arrayUnion({ 
                      date: ts, 
                      amount: amount, 
                      note: `Thu hồi nợ qua ${method?.name || 'N/A'}` 
                  }) 
              });

              // Cập nhật số dư tài khoản
              transaction.update(accRef, { balance: newBal });

              // Lưu nhật ký giao dịch
              const logRef = doc(collection(db, 'paymentLogs'));
              transaction.set(logRef, {
                  paymentMethodId,
                  paymentMethodName: method?.name || 'N/A',
                  type: 'deposit',
                  amount: amount,
                  balanceAfter: newBal,
                  note: `Thu nợ đơn hàng #${saleToPay.id.substring(0,8)} - Khách: ${saleToPay.customerName}`,
                  relatedId: saleToPay.id,
                  relatedType: 'sale',
                  createdAt: ts,
                  creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Hệ thống'
              });
          });
          
          setIsDebtModalOpen(false);
          setSaleToPay(null);
          alert("Thu hồi nợ và cập nhật tài khoản thành công!");
      } catch (err) { 
          console.error(err);
          alert("Đã xảy ra lỗi khi thực hiện giao dịch.");
      }
  };
  
  const handleConfirmShipping = async (shipperId: string, dateString: string) => {
      if (!saleToShip) return;
      try {
          const batch = writeBatch(db); const saleRef = doc(db, 'sales', saleToShip.id);
          const shipper = shippers.find(s => s.id === shipperId); const sName = shipper ? shipper.name : (saleToShip.shipperName || 'N/A');
          const dObj = new Date(dateString); const now = new Date(); dObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
          const ts = Timestamp.fromDate(dObj);
          if (saleToShip.shippingStatus === 'order') { saleToShip.items.forEach(item => batch.set(doc(db, 'products', item.productId, 'inventory', saleToShip.warehouseId), { stock: increment(-item.quantity), warehouseId: saleToShip.warehouseId, warehouseName: saleToShip.warehouseName }, { merge: true })); }
          batch.update(saleRef, { shippingStatus: 'shipped', shipperId, shipperName: sName, shippedAt: ts });
          await batch.commit(); setIsShippingModalOpen(false); setSaleToShip(null); alert("Thành công!");
      } catch (err) { alert("Lỗi."); }
  };

  const openEditModal = (sale: Sale) => { setSaleToEdit(sale); setIsEditModalOpen(true); };
  const openDebtModal = (sale: Sale) => { setSaleToPay(sale); setIsDebtModalOpen(true); };
  const openShippingModal = (sale: Sale) => { setSaleToShip(sale); setIsShippingModalOpen(true); };

  const exportListToExcel = () => {
    if (filteredSales.length === 0) {
      alert("Không có dữ liệu để xuất!");
      return;
    }
    const dataToExport = filteredSales.map((sale, index) => ({
      STT: index + 1,
      "Mã đơn": sale.id.substring(0, 8).toUpperCase(),
      "Khách hàng": sale.customerName,
      "SĐT": (sale as any).customerPhone || '',
      "Thời gian": sale.createdAt?.toDate().toLocaleString('vi-VN') || 'N/A',
      "Tổng tiền (VNĐ)": sale.total || 0,
      "Đã thu (VNĐ)": sale.amountPaid || 0,
      "Giao hàng": sale.shippingStatus === 'shipped' ? 'Đã giao' : sale.shippingStatus === 'pending' ? 'Chưa gởi' : 'Đặt hàng',
      "Thanh toán": sale.status === 'paid' ? 'Đã thanh toán' : 'Công nợ',
      "Phương thức thanh toán": sale.paymentMethodName || 'N/A',
      "Đơn vị vận chuyển": sale.shipperName || 'N/A',
      "Người bán": sale.creatorName || (sale as any).createdBy || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LichSuBanHang");
    XLSX.writeFile(wb, `Lich_Su_Ban_Hang_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      <SaleDetailModal sale={selectedSale} isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} userRole={userRole} />
      <DebtPaymentModal isOpen={isDebtModalOpen} onClose={() => setIsDebtModalOpen(false)} onConfirm={handleConfirmDebtPayment} sale={saleToPay} paymentMethods={paymentMethods} />
      <UpdateShippingModal isOpen={isShippingModalOpen} onClose={() => setIsShippingModalOpen(false)} onConfirm={handleConfirmShipping} sale={saleToShip} shippers={shippers} />
      <SaleEditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} sale={saleToEdit} customers={customers} paymentMethods={paymentMethods} shippers={shippers} products={products} />

      {/* FILTER PANEL - POS STYLE */}
      <div className="bg-white p-4 rounded-2xl shadow-md border-2 border-slate-200 space-y-3 shrink-0">
          <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-black uppercase flex items-center text-primary"><Filter size={16} className="mr-1.5"/> Bộ lọc tìm kiếm</h3>
              <div className="flex gap-2">
                  <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg border border-blue-200 text-xs font-black">DOANH THU: {formatNumber(stats.total)} ₫</div>
                  {isAdmin && <div className="bg-green-50 text-green-700 px-3 py-1 rounded-lg border border-green-200 text-xs font-black">LỢI NHUẬN: {formatNumber(stats.profit)} ₫</div>}
                  <button 
                      onClick={exportListToExcel}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg font-bold text-xs shadow-md transition flex items-center ml-2"
                      title="Xuất danh sách ra file Excel"
                  >
                      <FileCheck2 size={14} className="mr-1" />
                      Xuất Excel
                  </button>
              </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
              <div className="relative" ref={customerDropdownRef}>
                  <User className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                  <input 
                      type="text" 
                      placeholder="Tìm tên/SĐT khách..." 
                      value={customerSearch} 
                      onChange={e => { setCustomerSearch(e.target.value); setIsCustomerDropdownOpen(true); }} 
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      className="w-full pl-8 pr-2 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary outline-none" 
                  />
                  {isCustomerDropdownOpen && suggestedCustomers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-800 rounded-xl shadow-xl z-[100] max-h-48 overflow-y-auto">
                          {suggestedCustomers.map(c => (
                              <button key={c.id} onClick={() => { setCustomerSearch(c.name); setIsCustomerDropdownOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 flex justify-between items-center transition-colors">
                                  <span className="text-xs font-black text-black">{c.name}</span>
                                  <span className="text-[10px] font-bold text-slate-400">{c.phone}</span>
                              </button>
                          ))}
                      </div>
                  )}
              </div>
              <div className="relative"><Hash className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input type="text" placeholder="Tìm mã đơn..." value={orderIdSearch} onChange={e => setOrderIdSearch(e.target.value)} className="w-full pl-8 pr-2 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary outline-none" /></div>
              <div className="relative" ref={productDropdownRef}>
                  <Tag className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                  <input 
                      type="text" 
                      placeholder="Tìm tên sản phẩm..." 
                      value={productSearch} 
                      onChange={e => { setProductSearch(e.target.value); setIsProductDropdownOpen(true); }} 
                      onFocus={() => setIsProductDropdownOpen(true)}
                      className="w-full pl-8 pr-2 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary outline-none" 
                  />
                  {isProductDropdownOpen && suggestedProducts.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-800 rounded-xl shadow-xl z-[100] max-h-48 overflow-y-auto">
                          {suggestedProducts.map(p => (
                              <button key={p.id} onClick={() => { setProductSearch(p.name); setIsProductDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-slate-100 transition-colors">
                                  <div className="text-xs font-black text-black">{p.name}</div>
                              </button>
                          ))}
                      </div>
                  )}
              </div>
              <div className="grid grid-cols-2 gap-1">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-1 py-2 border rounded-lg text-xs font-black outline-none" />
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-1 py-2 border rounded-lg text-xs font-black outline-none" />
              </div>
              <select value={shippingFilter} onChange={e => setShippingFilter(e.target.value as any)} className="w-full px-2 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary focus:outline-none appearance-none"><option value="all">Tất cả giao hàng</option><option value="shipped">Đã giao hàng</option><option value="pending">Chưa gởi</option><option value="order">Đặt hàng</option></select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2">
              <select value={paymentStatusFilter} onChange={e => setPaymentStatusFilter(e.target.value as any)} className="w-full px-2 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary focus:outline-none"><option value="all">Công nợ: Tất cả</option><option value="paid">Đã trả</option><option value="debt">Còn nợ</option></select>
              <select value={invoiceFilter} onChange={e => setInvoiceFilter(e.target.value as any)} className="w-full px-2 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary focus:outline-none"><option value="all">HĐ: Tất cả</option><option value="yes">Có HĐ</option><option value="no">K.Hóa Đơn</option></select>
              <select value={shippingPayerFilter} onChange={e => setShippingPayerFilter(e.target.value as any)} className="w-full px-2 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary focus:outline-none"><option value="all">Ship: Tất cả</option><option value="customer">Khách trả</option><option value="shop">Shop trả</option></select>
              <select value={paymentMethodFilter} onChange={e => setPaymentMethodFilter(e.target.value)} className="w-full px-2 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary focus:outline-none"><option value="all">PTTT: Tất cả</option>{paymentMethods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <select value={shipperFilterVal} onChange={e => setShipperFilterVal(e.target.value)} className="w-full px-2 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary outline-none"><option value="all">ĐVVC: Tất cả</option>{shippers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <select value={manufacturerFilter} onChange={e => setManufacturerFilter(e.target.value)} className="w-full px-2 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary outline-none"><option value="all">Hãng: Tất cả</option>{manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </div>
      </div>

      {/* CONTENT AREA - GRID CARDS */}
      <div className="flex-1">
        {loading ? (
            <div className="flex justify-center items-center h-40"><Loader className="animate-spin text-primary" size={32}/></div>
        ) : paginatedSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 text-slate-300 opacity-50"><ShoppingBag size={80} className="mb-4"/><p className="font-black uppercase tracking-widest text-sm">Không có dữ liệu phù hợp</p></div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {paginatedSales.map(sale => {
                    const ln = sale.items.reduce((acc, i) => acc + (i.price - (i.importPrice || 0)) * i.quantity, 0);
                    
                    // Logic xác định trạng thái giao hàng chuẩn
                    let statusLabel = "Đã giao hàng";
                    let statusColor = "bg-blue-50 text-blue-700 border-blue-200";
                    let StatusIcon = CheckCircle;
                    
                    if (sale.shippingStatus === 'order') {
                        statusLabel = "Đặt hàng";
                        statusColor = "bg-purple-50 text-purple-700 border-purple-200 animate-pulse";
                        StatusIcon = Package;
                    } else if (sale.shippingStatus === 'pending') {
                        statusLabel = "Chưa gởi";
                        statusColor = "bg-yellow-50 text-yellow-700 border-yellow-200";
                        StatusIcon = Truck;
                    }

                    return (
                        <div key={sale.id} className="bg-white border-2 border-slate-800 rounded-2xl overflow-hidden shadow-[4px_4px_0px_#0f172a] hover:-translate-y-1 transition-all">
                            <div className="bg-slate-800 p-2.5 flex justify-between items-center text-white">
                                <div className="flex items-center truncate mr-2">
                                    <span className="text-[10px] font-black uppercase truncate bg-white/20 px-1.5 py-0.5 rounded mr-1.5">{sale.customerName}</span>
                                    {sale.status === 'debt' && <span className="bg-red-600 text-[8px] px-1.5 rounded font-black animate-pulse">NỢ</span>}
                                    {sale.issueInvoice && <span className="ml-1 bg-purple-600 text-[8px] px-1.5 rounded font-black uppercase">HĐ</span>}
                                </div>
                                <div className="flex gap-1">
                                    {isAdmin && <button onClick={() => openEditModal(sale)} className="p-1 bg-white/10 hover:bg-blue-500 rounded text-blue-400 hover:text-white transition"><Edit size={14}/></button>}
                                    <button onClick={() => { setSelectedSale(sale); setIsDetailModalOpen(true); }} className="p-1 bg-white/10 hover:bg-primary rounded transition"><Eye size={14}/></button>
                                </div>
                            </div>
                            <div className="p-3 bg-white space-y-3">
                                <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                                    <div>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">#{sale.id.substring(0,8)}</div>
                                        <div className="text-[10px] font-black text-black">{sale.createdAt?.toDate().toLocaleDateString('vi-VN')} {sale.createdAt?.toDate().toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-black text-primary">{formatNumber(sale.total)} ₫</div>
                                        {isAdmin && <div className="text-[9px] font-black text-green-600 uppercase">LN: {formatNumber(ln)} ₫</div>}
                                    </div>
                                </div>
                                <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                                    {sale.items.map((it, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-[11px] font-bold border-b border-slate-50 last:border-0 pb-1 gap-2">
                                            <span className="truncate flex-1 text-slate-700" title={it.productName}>{idx+1}. {it.productName}</span>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className="text-slate-400 font-black tracking-tighter">{formatNumber(it.price)}</span>
                                                <span className="font-black text-primary min-w-[24px] text-right">x{it.quantity}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                                    {/* TRẠNG THÁI GIAO HÀNG - ĐƠN VỊ VẬN CHUYỂN _ PHƯƠNG THỨC THANH TOÁN */}
                                    <div className="w-full flex flex-wrap items-center gap-1">
                                        <div className={`flex items-center text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${statusColor}`}>
                                            <StatusIcon size={10} className="mr-1"/> {statusLabel}
                                        </div>

                                        {sale.shipperName && (
                                            <div className="flex items-center text-[8px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 uppercase">
                                                - {sale.shipperName}
                                            </div>
                                        )}

                                        <div className="flex items-center text-[8px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded border border-blue-700 uppercase">
                                            _ {sale.paymentMethodName || 'Tiền mặt'}
                                        </div>
                                    </div>

                                    {/* CÔNG NỢ PHỤ */}
                                    {sale.status === 'debt' && <div className="text-[8px] font-black bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-200 uppercase">Còn nợ: {formatNumber(sale.total - (sale.amountPaid || 0))}</div>}
                                </div>
                                <div className="flex gap-2 mt-2">
                                    {sale.status === 'debt' && (
                                        <button onClick={() => openDebtModal(sale)} className="flex-1 py-1.5 bg-orange-600 text-white rounded-lg font-black text-[10px] uppercase shadow-md flex items-center justify-center hover:bg-orange-700"><Wallet size={12} className="mr-1"/> Thu nợ</button>
                                    )}
                                    {(sale.shippingStatus === 'pending' || sale.shippingStatus === 'order') && (
                                        <button onClick={() => openShippingModal(sale)} className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg font-black text-[10px] uppercase shadow-md flex items-center justify-center hover:bg-blue-700"><Truck size={12} className="mr-1"/> {sale.shippingStatus === 'order' ? 'Xuất kho' : 'Gửi hàng'}</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      {/* PAGINATION */}
      <div className="bg-white p-3 rounded-2xl shadow-lg border-2 border-slate-800 flex justify-between items-center shrink-0">
          <div className="text-xs font-black text-black uppercase tracking-widest">Trang {currentPage} / {Math.ceil(filteredSales.length / pageSize)}</div>
          <div className="flex space-x-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-primary text-white rounded-xl hover:bg-primary-hover transition shadow-md disabled:bg-slate-200 disabled:text-slate-400 disabled:opacity-50"><ChevronLeft size={20}/></button>
              <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= Math.ceil(filteredSales.length / pageSize)} className="p-2 bg-primary text-white rounded-xl hover:bg-primary-hover transition shadow-md disabled:bg-slate-200 disabled:text-slate-400 disabled:opacity-50"><ChevronRight size={20}/></button>
          </div>
      </div>
    </div>
  );
};

export default SalesHistory;
