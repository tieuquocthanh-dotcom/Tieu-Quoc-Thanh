import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Truck, Plus, Edit2, Trash2, Phone, MapPin, X, CheckCircle, Loader, Search, Globe } from 'lucide-react';
import { notifyError, notifySuccess } from '../utils/errorHandler';

interface Shipper {
  id: string;
  name: string;
  phone: string;
  address?: string;
  website?: string;
  description?: string;
  createdAt: any;
  updatedAt: any;
}

const ShippingManagement: React.FC = () => {
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingShipper, setEditingShipper] = useState<Shipper | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState<Partial<Shipper>>({
    name: '',
    phone: '',
    address: '',
    website: '',
    description: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'shippers'), orderBy('name')), (snapshot) => {
      setShippers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shipper)));
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filteredShippers = shippers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.phone.includes(searchTerm)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      notifyError("Vui lòng nhập tên và số điện thoại đơn vị vận chuyển.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingShipper) {
        await updateDoc(doc(db, 'shippers', editingShipper.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        notifySuccess("Cập nhật đơn vị vận chuyển thành công!");
      } else {
        await addDoc(collection(db, 'shippers'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        notifySuccess("Thêm đơn vị vận chuyển mới thành công!");
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      notifyError("Lỗi khi lưu thông tin đơn vị vận chuyển.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa đơn vị vận chuyển này?")) return;
    try {
      await deleteDoc(doc(db, 'shippers', id));
      notifySuccess("Đã xóa đơn vị vận chuyển.");
    } catch (err) {
      notifyError("Lỗi khi xóa đơn vị vận chuyển.");
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      address: '',
      website: '',
      description: ''
    });
    setEditingShipper(null);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 p-6 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center">
            <Truck className="mr-3 text-primary" size={32} />
            Quản Lý Vận Chuyển
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">
            Đối tác giao nhận & Đơn vị vận chuyển
          </p>
        </div>

        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="px-6 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center hover:bg-black transition-all shadow-xl active:scale-95"
        >
          <Plus size={18} className="mr-2" />
          Thêm Đơn Vị Mới
        </button>
      </div>

      {/* Search */}
      <div className="mb-8 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Tìm kiếm đơn vị vận chuyển bằng tên hoặc SĐT..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border-4 border-slate-800 rounded-3xl shadow-xl focus:ring-0 font-black text-slate-800 uppercase tracking-tight"
        />
      </div>

      {/* Shipper Grid */}
      <div className="flex-1 overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShippers.map(shipper => (
            <div key={shipper.id} className="bg-white rounded-3xl border-4 border-slate-800 shadow-xl overflow-hidden group hover:scale-[1.02] transition-all duration-300">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center">
                    <Truck size={24} />
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => { setEditingShipper(shipper); setFormData(shipper); setShowModal(true); }}
                      className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(shipper.id)}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">{shipper.name}</h3>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-slate-500 text-xs font-bold">
                    <Phone size={14} className="mr-2 text-slate-400" /> {shipper.phone}
                  </div>
                  {shipper.address && (
                    <div className="flex items-center text-slate-500 text-xs font-bold">
                      <MapPin size={14} className="mr-2 text-slate-400" /> {shipper.address}
                    </div>
                  )}
                  {shipper.website && (
                    <div className="flex items-center text-slate-500 text-xs font-bold">
                      <Globe size={14} className="mr-2 text-slate-400" /> {shipper.website}
                    </div>
                  )}
                </div>

                {shipper.description && (
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ghi chú</p>
                    <p className="text-xs text-slate-600 line-clamp-2">{shipper.description}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border-4 border-slate-800 shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest">
                {editingShipper ? 'Cập Nhật Đơn Vị' : 'Thêm Đơn Vị Mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8">
              <div className="space-y-6 mb-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên Đơn Vị Vận Chuyển *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                    placeholder="Giao Hàng Nhanh, Viettel Post..."
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
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Địa Chỉ</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Website</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mô Tả</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                {editingShipper ? 'Cập Nhật Đơn Vị' : 'Thêm Đơn Vị'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShippingManagement;
