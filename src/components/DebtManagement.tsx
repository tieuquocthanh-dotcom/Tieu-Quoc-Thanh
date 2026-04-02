import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, increment, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Customer, Supplier, Sale, GoodsReceipt, PaymentMethod } from '../types';
import { Wallet, Search, Users, Truck, DollarSign, History, X, CheckCircle, Loader, ArrowUpRight, ArrowDownLeft, CreditCard, Calendar } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import { notifyError, notifySuccess } from '../utils/errorHandler';
import SearchableSelect from './SearchableSelect';

const DebtManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState({
    customers: true,
    suppliers: true,
    sales: true,
    receipts: true,
    paymentMethods: true
  });
  const [selectedFilterEntityId, setSelectedFilterEntityId] = useState('all');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6); // Default to 6 months ago for better visibility
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'debt'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{ 
    id: string, 
    name: string, 
    type: 'customer' | 'supplier', 
    currentDebt: number,
    transactionId?: string,
    transactionTotal?: number
  } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubCustomers = onSnapshot(query(collection(db, 'customers'), orderBy('name')), 
      (snapshot) => {
        setCustomers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
        setLoading(prev => ({ ...prev, customers: false }));
      },
      (error) => {
        console.error("Error fetching customers:", error);
        setLoading(prev => ({ ...prev, customers: false }));
      }
    );

    const unsubSuppliers = onSnapshot(query(collection(db, 'suppliers'), orderBy('name')), 
      (snapshot) => {
        setSuppliers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
        setLoading(prev => ({ ...prev, suppliers: false }));
      },
      (error) => {
        console.error("Error fetching suppliers:", error);
        setLoading(prev => ({ ...prev, suppliers: false }));
      }
    );

    const unsubSales = onSnapshot(collection(db, 'sales'), 
      (snapshot) => {
        setSales(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Sale)));
        setLoading(prev => ({ ...prev, sales: false }));
      },
      (error) => {
        console.error("Error fetching sales:", error);
        setLoading(prev => ({ ...prev, sales: false }));
      }
    );

    const unsubReceipts = onSnapshot(collection(db, 'goodsReceipts'), 
      (snapshot) => {
        setReceipts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GoodsReceipt)));
        setLoading(prev => ({ ...prev, receipts: false }));
      },
      (error) => {
        console.error("Error fetching receipts:", error);
        setLoading(prev => ({ ...prev, receipts: false }));
      }
    );

    const unsubPayments = onSnapshot(query(collection(db, 'paymentMethods'), orderBy('name')), 
      (snapshot) => {
        const ps = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod));
        setPaymentMethods(ps);
        if (ps.length > 0) setSelectedPaymentMethodId(ps[0].id);
        setLoading(prev => ({ ...prev, paymentMethods: false }));
      },
      (error) => {
        console.error("Error fetching payment methods:", error);
        setLoading(prev => ({ ...prev, paymentMethods: false }));
      }
    );

    return () => {
      unsubCustomers();
      unsubSuppliers();
      unsubSales();
      unsubReceipts();
      unsubPayments();
    };
  }, []);

  const isLoading = Object.values(loading).some(v => v);

  const getTransactionStatus = (item: any): 'paid' | 'debt' => {
    if (activeTab === 'customers') {
      const s = item as Sale;
      if (s.status) return s.status;
      return (s.total > (s.amountPaid || 0)) ? 'debt' : 'paid';
    } else {
      const r = item as GoodsReceipt;
      if (r.paymentStatus) return r.paymentStatus;
      return (r.total > (r.amountPaid || 0)) ? 'debt' : 'paid';
    }
  };

  const parseDate = (date: any) => {
    if (!date) return new Date();
    if (typeof date.toDate === 'function') return date.toDate();
    if (date.seconds) return new Date(date.seconds * 1000);
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const filteredTransactions = useMemo(() => {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const data = activeTab === 'customers' ? sales : receipts;

    return data.filter(item => {
      // 1. Date Filter
      const itemDate = parseDate(item.createdAt);
      if (itemDate < from || itemDate > to) return false;

      // 2. Entity Filter (Dropdown)
      if (selectedFilterEntityId !== 'all') {
        const entityId = activeTab === 'customers' ? (item as Sale).customerId : (item as GoodsReceipt).supplierId;
        if (entityId !== selectedFilterEntityId) return false;
      }

      // 3. Search Query (Name, ID, Phone)
      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase().trim();
        const name = activeTab === 'customers' ? (item as Sale).customerName : (item as GoodsReceipt).supplierName;
        const id = item.id;
        
        // Look up phone from entity list since it's not on the transaction
        let phone = '';
        if (activeTab === 'customers') {
          phone = customers.find(c => c.id === (item as Sale).customerId)?.phone || '';
        } else {
          phone = suppliers.find(s => s.id === (item as GoodsReceipt).supplierId)?.phone || '';
        }

        const matchesName = name ? name.toLowerCase().includes(searchLower) : false;
        const matchesId = id ? id.toLowerCase().includes(searchLower) : false;
        const matchesPhone = phone ? phone.includes(searchQuery.trim()) : false;

        if (!matchesName && !matchesId && !matchesPhone) return false;
      }

      // 4. Status Filter
      const status = getTransactionStatus(item);
      if (statusFilter !== 'all' && status !== statusFilter) return false;

      // 5. Payment Method Filter
      if (paymentMethodFilter !== 'all' && item.paymentMethodId !== paymentMethodFilter) return false;

      return true;
    }).sort((a, b) => {
      const dateA = parseDate(a.createdAt).getTime();
      const dateB = parseDate(b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [activeTab, sales, receipts, customers, suppliers, fromDate, toDate, selectedFilterEntityId, statusFilter, paymentMethodFilter, searchQuery]);

  const totalDebt = useMemo(() => {
    return filteredTransactions.reduce((sum, item) => {
      const status = getTransactionStatus(item);
      const remaining = item.total - (item.amountPaid || 0);
      return sum + (status === 'debt' ? remaining : 0);
    }, 0);
  }, [filteredTransactions, activeTab]);

  const handleOpenPayment = (transaction: any) => {
    const type = activeTab === 'customers' ? 'customer' : 'supplier';
    const entityId = type === 'customer' ? transaction.customerId : transaction.supplierId;
    const entityName = type === 'customer' ? transaction.customerName : transaction.supplierName;
    
    // Find current total debt of this entity
    const entity = type === 'customer' 
      ? customers.find(c => c.id === entityId)
      : suppliers.find(s => s.id === entityId);

    setSelectedEntity({
      id: entityId,
      name: entityName,
      type,
      currentDebt: entity?.debt || 0,
      transactionId: transaction.id,
      transactionTotal: transaction.total
    });
    setPaymentAmount(transaction.total); // Default to paying the full amount of this transaction
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntity || paymentAmount <= 0) return;
    if (!selectedPaymentMethodId) {
      notifyError("Vui lòng chọn phương thức thanh toán.");
      return;
    }

    setIsSubmitting(true);
    try {
      const paymentMethod = paymentMethods.find(p => p.id === selectedPaymentMethodId);
      
      // 1. Update Debt in Customer/Supplier
      const entityRef = doc(db, selectedEntity.type === 'customer' ? 'customers' : 'suppliers', selectedEntity.id);
      await updateDoc(entityRef, {
        debt: increment(-paymentAmount),
        updatedAt: serverTimestamp()
      });

      // 2. Update Transaction Status if full payment
      if (selectedEntity.transactionId && paymentAmount >= (selectedEntity.transactionTotal || 0)) {
        const transRef = doc(db, selectedEntity.type === 'customer' ? 'sales' : 'goodsReceipts', selectedEntity.transactionId);
        const updateData: any = { updatedAt: serverTimestamp() };
        if (selectedEntity.type === 'customer') {
          updateData.status = 'paid';
        } else {
          updateData.paymentStatus = 'paid';
        }
        await updateDoc(transRef, updateData);
      }

      // 3. Update Payment Method Balance
      const pmRef = doc(db, 'paymentMethods', selectedPaymentMethodId);
      await updateDoc(pmRef, {
        balance: increment(selectedEntity.type === 'customer' ? paymentAmount : -paymentAmount)
      });

      // 3. Create Payment Log
      await addDoc(collection(db, 'paymentLogs'), {
        paymentMethodId: selectedPaymentMethodId,
        paymentMethodName: paymentMethod?.name || '',
        type: selectedEntity.type === 'customer' ? 'deposit' : 'withdraw',
        amount: paymentAmount,
        relatedId: selectedEntity.id,
        relatedType: selectedEntity.type === 'customer' ? 'sale' : 'receipt',
        debtorId: selectedEntity.id,
        debtorName: selectedEntity.name,
        note: paymentNote || `Thu nợ ${selectedEntity.type === 'customer' ? 'khách hàng' : 'nhà cung cấp'}: ${selectedEntity.name}`,
        createdAt: serverTimestamp()
      });

      notifySuccess("Đã ghi nhận thanh toán thành công!");
      setShowPaymentModal(false);
      setPaymentNote('');
    } catch (err) {
      console.error("Payment error:", err);
      notifyError("Lỗi khi ghi nhận thanh toán.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-blue-800 tracking-tight flex items-center">
            <Wallet className="mr-3 text-blue-600" size={32} />
            Quản Lý Công Nợ
          </h1>
          <p className="text-slate-500 font-bold text-sm mt-1">Theo dõi chi tiết hóa đơn & Thu hồi nợ</p>
        </div>

        <div className="bg-blue-50 px-6 py-3 rounded-2xl border border-blue-100 flex items-center shadow-sm">
          <div className="mr-4 p-2 bg-blue-100 text-blue-600 rounded-lg">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Tổng nợ (Theo bộ lọc)</p>
            <p className={`text-2xl font-black ${activeTab === 'customers' ? 'text-blue-700' : 'text-red-600'}`}>
              {formatNumber(totalDebt)} ₫
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-2xl mb-6 w-full md:w-fit">
        <button
          onClick={() => { setActiveTab('customers'); setStatusFilter('all'); setSelectedFilterEntityId('all'); }}
          className={`flex items-center px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'customers' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Users size={18} className="mr-2" />
          Nợ Khách Hàng
        </button>
        <button
          onClick={() => { setActiveTab('suppliers'); setStatusFilter('all'); setSelectedFilterEntityId('all'); }}
          className={`flex items-center px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'suppliers' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Truck size={18} className="mr-2" />
          Nợ Nhà Cung Cấp
        </button>
      </div>

      {/* Filters Panel */}
      <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 mb-8 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Row 1: Entity Search and Dates */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
              Chọn {activeTab === 'customers' ? 'Khách Hàng' : 'Nhà Cung Cấp'}
            </label>
            <SearchableSelect
              options={[
                { id: 'all', name: `Tất cả ${activeTab === 'customers' ? 'khách hàng' : 'nhà cung cấp'}` },
                ...(activeTab === 'customers' ? customers : suppliers).map(item => ({
                  id: item.id,
                  name: item.name || 'Không tên',
                  phone: item.phone,
                  debt: item.debt
                }))
              ]}
              value={selectedFilterEntityId}
              onChange={setSelectedFilterEntityId}
              placeholder={`Tìm ${activeTab === 'customers' ? 'khách hàng' : 'nhà cung cấp'}...`}
              icon={activeTab === 'customers' ? <Users size={14} /> : <Truck size={14} />}
            />
          </div>

          <div className="lg:col-span-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
              Tìm theo tên/ID
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nhập tên..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 lg:col-span-2">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-blue-500 transition-all">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2 whitespace-nowrap">Từ:</label>
              <input 
                type="date" 
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none"
              />
            </div>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-blue-500 transition-all">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2 whitespace-nowrap">Đến:</label>
              <input 
                type="date" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none"
              />
            </div>
          </div>

          {/* Row 2: Status and Payment Method */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Trạng thái thanh toán</label>
            <div className="flex space-x-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setStatusFilter('debt')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === 'debt' ? 'bg-red-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                Còn nợ
              </button>
              <button
                onClick={() => setStatusFilter('paid')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === 'paid' ? 'bg-green-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                Đã trả
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tài khoản thanh toán</label>
            <div className="flex gap-2">
              <select 
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:border-blue-500 outline-none"
              >
                <option value="all">Tất cả tài khoản</option>
                {paymentMethods.map(pm => (
                  <option key={pm.id} value={pm.id}>{pm.name}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  setSelectedFilterEntityId('all');
                  setFromDate(() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - 6);
                    return d.toISOString().split('T')[0];
                  });
                  setToDate(new Date().toISOString().split('T')[0]);
                  setStatusFilter('all');
                  setPaymentMethodFilter('all');
                  setSearchQuery('');
                }}
                className="px-6 py-2.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl text-xs font-black transition-all border-2 border-transparent hover:border-red-100 flex items-center"
                title="Đặt lại tất cả bộ lọc về mặc định"
              >
                <X size={16} className="mr-2" />
                LÀM MỚI BỘ LỌC
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="card-traditional overflow-hidden flex flex-col flex-1">
        <div className="overflow-x-auto">
          <table className="table-traditional">
            <thead>
              <tr>
                <th>Thời Gian</th>
                <th>Đối Tượng</th>
                <th>Tài Khoản</th>
                <th className="text-right">Tổng Tiền</th>
                <th className="text-center">Trạng Thái</th>
                <th className="text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <Loader className="animate-spin mx-auto text-blue-600 mb-2" size={24} />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Đang tải...</p>
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Search size={40} className="mb-3 opacity-20" />
                      <p className="font-bold text-sm italic">Không tìm thấy dữ liệu công nợ nào</p>
                      <p className="text-[10px] uppercase tracking-widest mt-1">Thử thay đổi bộ lọc hoặc khoảng thời gian</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(item => {
                  const status = getTransactionStatus(item);
                  const name = activeTab === 'customers' ? (item as Sale).customerName : (item as GoodsReceipt).supplierName;
                  const itemDate = parseDate(item.createdAt);
                  const displayDate = itemDate.toLocaleString('vi-VN');

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td>
                        <p className="font-bold text-slate-700 text-xs">
                          {displayDate}
                        </p>
                      </td>
                      <td>
                        <div className="flex items-center">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center mr-3 ${activeTab === 'customers' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                            {activeTab === 'customers' ? <Users size={14} /> : <Truck size={14} />}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{name || 'N/A'}</p>
                            <p className="text-[10px] text-slate-400 font-bold">
                              {activeTab === 'customers' 
                                ? customers.find(c => c.id === (item as Sale).customerId)?.phone 
                                : suppliers.find(s => s.id === (item as GoodsReceipt).supplierId)?.phone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center text-xs font-bold text-slate-500">
                          <CreditCard size={12} className="mr-1.5" />
                          {item.paymentMethodName || 'N/A'}
                        </div>
                      </td>
                      <td className="text-right font-black text-slate-800">
                        {formatNumber(item.total)} ₫
                      </td>
                      <td className="text-center">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {status === 'paid' ? 'Đã trả' : 'Còn nợ'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleOpenPayment(item)}
                            className={`p-2 rounded-xl transition-all ${status === 'debt' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                            disabled={status === 'paid'}
                            title="Thu/Trả nợ"
                          >
                            <DollarSign size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border-4 border-slate-800 shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
              <div className="flex items-center">
                <CreditCard className="mr-3" size={24} />
                <h3 className="font-black uppercase tracking-widest">
                  {selectedEntity.type === 'customer' ? 'Thu Nợ Khách Hàng' : 'Trả Nợ Nhà Cung Cấp'}
                </h3>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-8 space-y-6">
              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Đối tượng</p>
                <p className="text-lg font-black text-slate-800">{selectedEntity.name}</p>
                <div className="flex justify-between mt-2 pt-2 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-500">Nợ hiện tại:</span>
                  <span className="text-xs font-black text-red-500">{formatNumber(selectedEntity.currentDebt)} ₫</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Số tiền thanh toán</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={20} />
                  <input
                    type="number"
                    required
                    max={selectedEntity.currentDebt}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseInt(e.target.value) || 0)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-2xl text-blue-700 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Phương thức thanh toán</label>
                <SearchableSelect
                  options={paymentMethods.map(p => ({ id: p.id, name: p.name }))}
                  value={selectedPaymentMethodId}
                  onChange={setSelectedPaymentMethodId}
                  placeholder="Chọn phương thức..."
                  icon={<CreditCard size={14} />}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Ghi chú</label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Nhập ghi chú thanh toán..."
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 focus:border-blue-500 outline-none h-24 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || paymentAmount <= 0}
                className={`w-full py-4 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center disabled:opacity-50 ${selectedEntity.type === 'customer' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {isSubmitting ? <Loader className="animate-spin mr-2" size={20} /> : <CheckCircle className="mr-2" size={20} />}
                XÁC NHẬN THANH TOÁN
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scale-in {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default DebtManagement;
