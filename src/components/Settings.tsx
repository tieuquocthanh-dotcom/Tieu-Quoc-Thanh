
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Warehouse, PaymentMethod, Shipper, Manufacturer } from '../types';
import { Settings as SettingsIcon, Warehouse as WarehouseIcon, CreditCard, Truck, Factory, Plus, Edit2, Trash2, Save, X, Loader, CheckCircle, Info, Users } from 'lucide-react';
import UserManagement from './UserManagement';
import { notifyError, notifySuccess } from '../utils/errorHandler';

const Settings: React.FC = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  
  const [activeTab, setActiveTab] = useState<'warehouse' | 'payment' | 'shipper' | 'manufacturer' | 'users'>('warehouse');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({ name: '', description: '', phone: '', address: '' });

  useEffect(() => {
    const unsubWarehouses = onSnapshot(query(collection(db, 'warehouses'), orderBy('name')), (snapshot) => {
      setWarehouses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse)));
    });

    const unsubPayments = onSnapshot(query(collection(db, 'paymentMethods'), orderBy('name')), (snapshot) => {
      setPaymentMethods(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod)));
    });

    const unsubShippers = onSnapshot(query(collection(db, 'shippers'), orderBy('name')), (snapshot) => {
      setShippers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shipper)));
    });

    const unsubManufacturers = onSnapshot(query(collection(db, 'manufacturers'), orderBy('name')), (snapshot) => {
      setManufacturers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Manufacturer)));
    });

    setLoading(false);
    return () => {
      unsubWarehouses();
      unsubPayments();
      unsubShippers();
      unsubManufacturers();
    };
  }, []);

  const getCollectionName = () => {
    switch (activeTab) {
      case 'warehouse': return 'warehouses';
      case 'payment': return 'paymentMethods';
      case 'shipper': return 'shippers';
      case 'manufacturer': return 'manufacturers';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setIsSubmitting(true);
    try {
      const collectionName = getCollectionName();
      if (editingItem) {
        await updateDoc(doc(db, collectionName, editingItem.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        notifySuccess("Cập nhật thành công!");
      } else {
        await addDoc(collection(db, collectionName), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        notifySuccess("Thêm mới thành công!");
      }
      setShowModal(false);
      setFormData({ name: '', description: '', phone: '', address: '' });
      setEditingItem(null);
    } catch (err) {
      notifyError("Lỗi khi lưu cài đặt.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa mục này?")) return;
    try {
      await deleteDoc(doc(db, getCollectionName(), id));
      notifySuccess("Đã xóa.");
    } catch (err) {
      notifyError("Lỗi khi xóa.");
    }
  };

  const renderList = (items: any[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map(item => (
        <div key={item.id} className="bg-white p-6 rounded-3xl border-4 border-slate-800 shadow-xl group hover:scale-[1.02] transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-slate-100 text-slate-800 rounded-2xl">
              {activeTab === 'warehouse' && <WarehouseIcon size={24} />}
              {activeTab === 'payment' && <CreditCard size={24} />}
              {activeTab === 'shipper' && <Truck size={24} />}
              {activeTab === 'manufacturer' && <Factory size={24} />}
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => { setEditingItem(item); setFormData(item); setShowModal(true); }}
                className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
              >
                <Edit2 size={18} />
              </button>
              <button 
                onClick={() => handleDelete(item.id)}
                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">{item.name}</h3>
          {item.description && <p className="text-xs font-bold text-slate-400 mb-2">{item.description}</p>}
          {item.phone && <p className="text-xs font-bold text-slate-500 flex items-center"><span className="w-4 h-4 mr-2">📞</span> {item.phone}</p>}
          {item.address && <p className="text-xs font-bold text-slate-500 flex items-center mt-1"><span className="w-4 h-4 mr-2">📍</span> {item.address}</p>}
        </div>
      ))}
      <button 
        onClick={() => { setEditingItem(null); setFormData({ name: '', description: '', phone: '', address: '' }); setShowModal(true); }}
        className="bg-slate-50 border-4 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-all group"
      >
        <Plus size={40} className="mb-2 group-hover:scale-110 transition-transform" />
        <span className="font-black uppercase tracking-widest text-xs">Thêm Mới</span>
      </button>
    </div>
  );

  return (
    <div className="h-full bg-slate-50 p-6 overflow-y-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center">
          <SettingsIcon className="mr-3 text-primary" size={32} />
          Cài Đặt Hệ Thống
        </h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">
          Cấu hình danh mục & Thông tin vận hành
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center bg-white p-2 rounded-3xl border-4 border-slate-800 shadow-xl mb-8 gap-2">
        <button
          onClick={() => setActiveTab('warehouse')}
          className={`flex-1 min-w-[120px] px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center ${activeTab === 'warehouse' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <WarehouseIcon size={14} className="mr-2" /> Kho Hàng
        </button>
        <button
          onClick={() => setActiveTab('payment')}
          className={`flex-1 min-w-[120px] px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center ${activeTab === 'payment' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <CreditCard size={14} className="mr-2" /> Thanh Toán
        </button>
        <button
          onClick={() => setActiveTab('shipper')}
          className={`flex-1 min-w-[120px] px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center ${activeTab === 'shipper' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Truck size={14} className="mr-2" /> Vận Chuyển
        </button>
        <button
          onClick={() => setActiveTab('manufacturer')}
          className={`flex-1 min-w-[120px] px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center ${activeTab === 'manufacturer' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Factory size={14} className="mr-2" /> Hãng Sản Xuất
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 min-w-[120px] px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center ${activeTab === 'users' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Users size={14} className="mr-2" /> Người Dùng
        </button>
      </div>

      {/* Content */}
      <div className="pb-10">
        {activeTab === 'warehouse' && renderList(warehouses)}
        {activeTab === 'payment' && renderList(paymentMethods)}
        {activeTab === 'shipper' && renderList(shippers)}
        {activeTab === 'manufacturer' && renderList(manufacturers)}
        {activeTab === 'users' && <UserManagement />}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border-4 border-slate-800 shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest">
                {editingItem ? 'Cập Nhật' : 'Thêm Mới'} {activeTab === 'warehouse' ? 'Kho' : activeTab === 'payment' ? 'Thanh Toán' : activeTab === 'shipper' ? 'Vận Chuyển' : 'Hãng'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên Gọi *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                />
              </div>

              {(activeTab === 'warehouse' || activeTab === 'shipper') && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Số Điện Thoại</label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Địa Chỉ</label>
                    <input
                      type="text"
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mô Tả / Ghi Chú</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0 h-24 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl flex items-center justify-center disabled:opacity-50"
              >
                {isSubmitting ? <Loader className="animate-spin mr-2" size={20} /> : <Save className="mr-2" size={20} />}
                Lưu Thay Đổi
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
