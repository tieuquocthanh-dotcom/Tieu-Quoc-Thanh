
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Supplier, GoodsReceipt, PaymentMethod } from '../types';
import { Truck, Search, Plus, Edit2, Trash2, Phone, MapPin, Mail, History, DollarSign, X, CheckCircle, Loader, UserPlus, ChevronRight, FileText, Calendar, Filter, CreditCard } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import { notifyError, notifySuccess } from '../utils/errorHandler';

const SupplierManagement: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
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
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '',
    phone: '',
    address: '',
    email: '',
    debt: 0,
    note: ''
  });

  useEffect(() => {
    const unsubSuppliers = onSnapshot(query(collection(db, 'suppliers'), orderBy('name')), (snapshot) => {
      setSuppliers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
      setLoading(false);
    });

    const unsubReceipts = onSnapshot(collection(db, 'goodsReceipts'), (snapshot) => {
      setReceipts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GoodsReceipt)));
    });

    const unsubPayments = onSnapshot(query(collection(db, 'paymentMethods'), orderBy('name')), (snapshot) => {
      setPaymentMethods(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod)));
    });

    return () => {
      unsubSuppliers();
      unsubReceipts();
      unsubPayments();
    };
  }, []);

  const filteredHistoryReceipts = useMemo(() => {
    if (!selectedSupplier) return [];
    
    return receipts.filter(r => {
      if (r.supplierId !== selectedSupplier.id) return false;
      
      const receiptDate = r.createdAt instanceof Timestamp ? r.createdAt.toDate() : new Date();
      const from = new Date(historyFromDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(historyToDate);
      to.setHours(23, 59, 59, 999);
      
      const matchesDate = receiptDate >= from && receiptDate <= to;
      const matchesStatus = historyStatus === 'all' || r.paymentStatus === historyStatus;
      const matchesPayment = historyPaymentMethodId === 'all' || r.paymentMethodId === historyPaymentMethodId;
      
      return matchesDate && matchesStatus && matchesPayment;
    }).sort((a, b) => {
      const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
      const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
      return dateB - dateA;
    });
  }, [receipts, selectedSupplier, historyFromDate, historyToDate, historyStatus, historyPaymentMethodId]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           s.phone?.includes(searchTerm);
      const matchesDebt = showOnlyDebt ? (s.debt || 0) > 0 : true;
      return matchesSearch && matchesDebt;
    });
  }, [suppliers, searchTerm, showOnlyDebt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      notifyError("Vui lòng nhập tên và số điện thoại.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingSupplier) {
        await updateDoc(doc(db, 'suppliers', editingSupplier.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        notifySuccess("Cập nhật nhà cung cấp thành công!");
      } else {
        await addDoc(collection(db, 'suppliers'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        notifySuccess("Thêm nhà cung cấp thành công!");
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      notifyError("Lỗi khi lưu thông tin nhà cung cấp.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa nhà cung cấp này?")) return;
    try {
      await deleteDoc(doc(db, 'suppliers', id));
      notifySuccess("Đã xóa nhà cung cấp.");
    } catch (err) {
      notifyError("Lỗi khi xóa nhà cung cấp.");
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      address: '',
      email: '',
      debt: 0,
      note: ''
    });
    setEditingSupplier(null);
  };

  const getSupplierStats = (supplierId: string) => {
    const supplierReceipts = receipts.filter(r => r.supplierId === supplierId);
    const totalImported = supplierReceipts.reduce((sum, r) => sum + r.total, 0);
    const lastReceipt = supplierReceipts[0]?.createdAt;
    return { totalImported, receiptCount: supplierReceipts.length, lastReceipt };
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center uppercase tracking-tight">
            <Truck className="mr-3 text-blue-700" size={28} />
            Quản Lý Nhà Cung Cấp
          </h1>
          <p className="text-slate-500 text-sm font-medium">Quản lý nguồn hàng & Công nợ đầu vào</p>
        </div>

        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="btn-primary flex items-center shadow-md"
        >
          <Plus size={18} className="mr-2" />
          THÊM NHÀ CUNG CẤP
        </button>
      </div>

      {/* Search & Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Tìm nhà cung cấp bằng tên hoặc số điện thoại..."
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
          {showOnlyDebt ? 'Đang hiện NCC nợ' : 'Hiện tất cả NCC'}
        </button>
      </div>

      {/* Supplier List */}
      <div className="card-traditional overflow-hidden flex flex-col flex-1">
        <div className="overflow-x-auto">
          <table className="table-traditional">
            <thead>
              <tr>
                <th>Nhà Cung Cấp</th>
                <th>Liên Hệ</th>
                <th className="text-right">Tổng Nhập</th>
                <th className="text-right">Nợ</th>
                <th className="text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mx-auto mb-2"></div>
                    <p className="text-slate-500 font-bold text-xs uppercase">Đang tải...</p>
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400 font-bold text-sm italic">
                    Không tìm thấy nhà cung cấp nào
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map(supplier => {
                  const stats = getSupplierStats(supplier.id);
                  return (
                    <tr key={supplier.id} className="hover:bg-slate-50 transition-colors">
                      <td>
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center mr-3">
                            <Truck size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{supplier.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">ID: {supplier.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-700 flex items-center">
                            <Phone size={12} className="mr-1.5 text-slate-400" /> {supplier.phone}
                          </p>
                          {supplier.address && (
                            <p className="text-xs text-slate-500 flex items-center">
                              <MapPin size={12} className="mr-1.5 text-slate-400" /> {supplier.address}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="text-right font-bold text-blue-700">
                        {formatNumber(stats.totalImported)} ₫
                      </td>
                      <td className="text-right font-bold text-red-600">
                        {formatNumber(supplier.debt || 0)} ₫
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => { setSelectedSupplier(supplier); setShowHistoryModal(true); }}
                            className="p-1.5 text-slate-600 hover:bg-slate-50 rounded transition-all"
                            title="Lịch sử"
                          >
                            <History size={16} />
                          </button>
                          <button
                            onClick={() => { setEditingSupplier(supplier); setFormData(supplier); setShowModal(true); }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all"
                            title="Sửa"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(supplier.id)}
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
                {editingSupplier ? 'Cập Nhật Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp Mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên Nhà Cung Cấp *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                    placeholder="Công ty A..."
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
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Công Nợ Hiện Tại</label>
                  <input
                    type="number"
                    value={formData.debt}
                    onChange={(e) => setFormData({ ...formData, debt: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ghi Chú</label>
                  <textarea
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0 h-24 resize-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl flex items-center justify-center disabled:opacity-50"
              >
                {isSubmitting ? <Loader className="animate-spin mr-2" size={20} /> : <CheckCircle className="mr-2" size={20} />}
                {editingSupplier ? 'Cập Nhật Thông Tin' : 'Thêm Nhà Cung Cấp'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border-4 border-slate-800 shadow-2xl w-full max-w-4xl h-[80vh] overflow-hidden flex flex-col animate-scale-in">
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
              <div className="flex items-center">
                <FileText className="mr-3" size={24} />
                <div>
                  <h3 className="font-black uppercase tracking-widest">Lịch Sử Nhập Hàng</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedSupplier.name}</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
              {/* Stats Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng phiếu nhập</p>
                  <p className="text-2xl font-black text-slate-800">{filteredHistoryReceipts.length}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng tiền nhập (Lọc)</p>
                  <p className="text-2xl font-black text-orange-600">{formatNumber(filteredHistoryReceipts.reduce((sum, r) => sum + r.total, 0))} ₫</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nợ hiện tại</p>
                  <p className="text-2xl font-black text-red-500">{formatNumber(selectedSupplier.debt)} ₫</p>
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

              <h4 className="font-black text-slate-800 uppercase tracking-tighter text-sm mb-4">Danh sách phiếu nhập</h4>
              <div className="space-y-4">
                {filteredHistoryReceipts.length === 0 ? (
                  <p className="text-center text-slate-400 py-10 font-bold uppercase tracking-widest text-xs">Không tìm thấy phiếu nhập nào khớp với bộ lọc</p>
                ) : (
                  filteredHistoryReceipts.map(receipt => (
                    <div key={receipt.id} className="p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-blue-500 transition-colors shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center space-x-3">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {receipt.createdAt instanceof Timestamp ? receipt.createdAt.toDate().toLocaleString('vi-VN') : 'N/A'}
                          </span>
                          <div className="flex items-center text-[9px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded">
                            <CreditCard size={10} className="mr-1" />
                            {receipt.paymentMethodName || 'N/A'}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${receipt.paymentStatus === 'paid' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {receipt.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Ghi nợ'}
                        </span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs font-bold text-slate-600 mb-1">Mặt hàng: {receipt.items.map(i => i.productName).join(', ')}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Kho nhập: {receipt.warehouseName}</p>
                        </div>
                        <p className="font-black text-slate-800">{formatNumber(receipt.total)} ₫</p>
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

export default SupplierManagement;
