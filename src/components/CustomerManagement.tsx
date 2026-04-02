
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Customer, Sale, PaymentMethod } from '../types';
import { Users, Search, Plus, Edit2, Trash2, Phone, MapPin, Mail, Facebook, MessageCircle, History, DollarSign, X, CheckCircle, Loader, UserPlus, ChevronRight, CreditCard, Calendar, Filter } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import { notifyError, notifySuccess } from '../utils/errorHandler';

const CustomerManagement: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyDebt, setShowOnlyDebt] = useState(false);
  
  // History Filters
  const [historyFromDate, setHistoryFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [historyToDate, setHistoryToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [historyStatus, setHistoryStatus] = useState<'all' | 'paid' | 'debt'>('all');
  const [historyPaymentMethodId, setHistoryPaymentMethodId] = useState('all');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    phone: '',
    address: '',
    email: '',
    facebook: '',
    zalo: '',
    type: 'retail',
    debt: 0
  });

  useEffect(() => {
    const unsubCustomers = onSnapshot(query(collection(db, 'customers'), orderBy('name')), (snapshot) => {
      setCustomers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
      setLoading(false);
    });

    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      setSales(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Sale)));
    });

    const unsubPayments = onSnapshot(query(collection(db, 'paymentMethods'), orderBy('name')), (snapshot) => {
      setPaymentMethods(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod)));
    });

    return () => {
      unsubCustomers();
      unsubSales();
      unsubPayments();
    };
  }, []);

  const filteredHistorySales = useMemo(() => {
    if (!selectedCustomer) return [];
    
    return sales.filter(s => {
      if (s.customerId !== selectedCustomer.id) return false;
      
      const saleDate = s.createdAt instanceof Timestamp ? s.createdAt.toDate() : new Date();
      const from = new Date(historyFromDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(historyToDate);
      to.setHours(23, 59, 59, 999);
      
      const matchesDate = saleDate >= from && saleDate <= to;
      const matchesStatus = historyStatus === 'all' || s.status === historyStatus;
      const matchesPayment = historyPaymentMethodId === 'all' || s.paymentMethodId === historyPaymentMethodId;
      
      return matchesDate && matchesStatus && matchesPayment;
    }).sort((a, b) => {
      const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
      const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
      return dateB - dateA;
    });
  }, [sales, selectedCustomer, historyFromDate, historyToDate, historyStatus, historyPaymentMethodId]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           c.phone?.includes(searchTerm);
      const matchesDebt = showOnlyDebt ? (c.debt || 0) > 0 : true;
      return matchesSearch && matchesDebt;
    });
  }, [customers, searchTerm, showOnlyDebt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      notifyError("Vui lòng nhập tên và số điện thoại.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        notifySuccess("Cập nhật khách hàng thành công!");
      } else {
        await addDoc(collection(db, 'customers'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        notifySuccess("Thêm khách hàng thành công!");
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      notifyError("Lỗi khi lưu thông tin khách hàng.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa khách hàng này?")) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
      notifySuccess("Đã xóa khách hàng.");
    } catch (err) {
      notifyError("Lỗi khi xóa khách hàng.");
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      address: '',
      email: '',
      facebook: '',
      zalo: '',
      type: 'retail',
      debt: 0
    });
    setEditingCustomer(null);
  };

  const getCustomerStats = (customerId: string) => {
    const customerSales = sales.filter(s => s.customerId === customerId);
    const totalSpent = customerSales.reduce((sum, s) => sum + s.total, 0);
    const lastPurchase = customerSales[0]?.createdAt;
    return { totalSpent, orderCount: customerSales.length, lastPurchase };
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center uppercase tracking-tight">
            <Users className="mr-3 text-blue-700" size={28} />
            Quản Lý Khách Hàng
          </h1>
          <p className="text-slate-500 text-sm font-medium">Chăm sóc & Theo dõi lịch sử mua hàng</p>
        </div>

        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="btn-primary flex items-center shadow-md"
        >
          <UserPlus size={18} className="mr-2" />
          THÊM KHÁCH HÀNG
        </button>
      </div>

      {/* Search & Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Tìm khách hàng bằng tên hoặc số điện thoại..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-traditional pl-10"
          />
        </div>
        <button
          onClick={() => setShowOnlyDebt(!showOnlyDebt)}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center border-2 ${showOnlyDebt ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'}`}
        >
          <DollarSign size={16} className="mr-2" />
          {showOnlyDebt ? 'Đang hiện khách nợ' : 'Hiện tất cả khách'}
        </button>
      </div>

      {/* Customer List */}
      <div className="card-traditional overflow-hidden flex flex-col flex-1">
        <div className="overflow-x-auto">
          <table className="table-traditional">
            <thead>
              <tr>
                <th>Khách Hàng</th>
                <th>Liên Hệ</th>
                <th>Loại</th>
                <th className="text-right">Tổng Mua</th>
                <th className="text-right">Nợ</th>
                <th className="text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mx-auto mb-2"></div>
                    <p className="text-slate-500 font-bold text-xs uppercase">Đang tải...</p>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400 font-bold text-sm italic">
                    Không tìm thấy khách hàng nào
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(customer => {
                  const stats = getCustomerStats(customer.id);
                  return (
                    <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                      <td>
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center mr-3">
                            <Users size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{customer.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">ID: {customer.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-700 flex items-center">
                            <Phone size={12} className="mr-1.5 text-slate-400" /> {customer.phone}
                          </p>
                          {customer.address && (
                            <p className="text-xs text-slate-500 flex items-center">
                              <MapPin size={12} className="mr-1.5 text-slate-400" /> {customer.address}
                            </p>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${customer.type === 'wholesale' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {customer.type === 'wholesale' ? 'Sỉ' : 'Lẻ'}
                        </span>
                      </td>
                      <td className="text-right font-bold text-blue-700">
                        {formatNumber(stats.totalSpent)} ₫
                      </td>
                      <td className="text-right font-bold text-red-600">
                        {formatNumber(customer.debt || 0)} ₫
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => { setSelectedCustomer(customer); setShowHistoryModal(true); }}
                            className="p-1.5 text-slate-600 hover:bg-slate-50 rounded transition-all"
                            title="Lịch sử"
                          >
                            <History size={16} />
                          </button>
                          <button
                            onClick={() => { setEditingCustomer(customer); setFormData(customer); setShowModal(true); }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all"
                            title="Sửa"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(customer.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all"
                            title="Xóa"
                          >
                            <Trash2 size={16} />
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border-4 border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest">
                {editingCustomer ? 'Cập Nhật Khách Hàng' : 'Thêm Khách Hàng Mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Họ Tên *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Số Điện Thoại *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                    placeholder="090..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Địa Chỉ</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                    placeholder="Số nhà, tên đường..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Zalo</label>
                  <input
                    type="text"
                    value={formData.zalo}
                    onChange={(e) => setFormData({ ...formData, zalo: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Facebook</label>
                  <input
                    type="text"
                    value={formData.facebook}
                    onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Loại Khách Hàng</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                  >
                    <option value="retail">Khách Lẻ</option>
                    <option value="wholesale">Khách Sỉ</option>
                    <option value="vip">Khách VIP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Công Nợ Ban Đầu</label>
                  <input
                    type="number"
                    value={formData.debt}
                    onChange={(e) => setFormData({ ...formData, debt: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl flex items-center justify-center disabled:opacity-50"
              >
                {isSubmitting ? <Loader className="animate-spin mr-2" size={20} /> : <CheckCircle className="mr-2" size={20} />}
                {editingCustomer ? 'Cập Nhật Thông Tin' : 'Thêm Khách Hàng'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border-4 border-slate-800 shadow-2xl w-full max-w-4xl h-[80vh] overflow-hidden flex flex-col animate-scale-in">
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
              <div className="flex items-center">
                <History className="mr-3" size={24} />
                <div>
                  <h3 className="font-black uppercase tracking-widest">Lịch Sử Mua Hàng</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedCustomer.name}</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
              {/* Stats Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng đơn hàng</p>
                  <p className="text-2xl font-black text-slate-800">{filteredHistorySales.length}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng chi tiêu (Lọc)</p>
                  <p className="text-2xl font-black text-blue-600">{formatNumber(filteredHistorySales.reduce((sum, s) => sum + s.total, 0))} ₫</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nợ hiện tại</p>
                  <p className="text-2xl font-black text-red-500">{formatNumber(selectedCustomer.debt)} ₫</p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100 mb-8 space-y-4">
                <div className="flex items-center text-slate-800 font-bold text-sm mb-2">
                  <Filter size={16} className="mr-2 text-blue-600" />
                  BỘ LỌC LỊCH SỬ
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Từ ngày</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input 
                        type="date" 
                        value={historyFromDate}
                        onChange={(e) => setHistoryFromDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Đến ngày</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input 
                        type="date" 
                        value={historyToDate}
                        onChange={(e) => setHistoryToDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Trạng thái</label>
                    <select 
                      value={historyStatus}
                      onChange={(e) => setHistoryStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:border-blue-500 outline-none"
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="paid">Đã thanh toán</option>
                      <option value="debt">Còn nợ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tài khoản/PTTT</label>
                    <select 
                      value={historyPaymentMethodId}
                      onChange={(e) => setHistoryPaymentMethodId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:border-blue-500 outline-none"
                    >
                      <option value="all">Tất cả tài khoản</option>
                      {paymentMethods.map(pm => (
                        <option key={pm.id} value={pm.id}>{pm.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <h4 className="font-black text-slate-800 uppercase tracking-tighter text-sm mb-4">Danh sách đơn hàng</h4>
              <div className="space-y-4">
                {filteredHistorySales.length === 0 ? (
                  <p className="text-center text-slate-400 py-10 font-bold uppercase tracking-widest text-xs">Không tìm thấy đơn hàng nào khớp với bộ lọc</p>
                ) : (
                  filteredHistorySales.map(sale => (
                    <div key={sale.id} className="p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-blue-500 transition-colors shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center space-x-3">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {sale.createdAt instanceof Timestamp ? sale.createdAt.toDate().toLocaleString('vi-VN') : 'N/A'}
                          </span>
                          <div className="flex items-center text-[9px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded">
                            <CreditCard size={10} className="mr-1" />
                            {sale.paymentMethodName || 'N/A'}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${sale.status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {sale.status === 'paid' ? 'Đã thanh toán' : 'Ghi nợ'}
                        </span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs font-bold text-slate-600 mb-1">Sản phẩm: {sale.items.map(i => i.productName).join(', ')}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Kho: {sale.warehouseName}</p>
                        </div>
                        <p className="font-black text-slate-800">{formatNumber(sale.total)} ₫</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManagement;
