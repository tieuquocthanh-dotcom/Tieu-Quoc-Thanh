import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Warehouse } from '../types';
import { Warehouse as WarehouseIcon, Plus, Edit2, Trash2, MapPin, Phone, X, CheckCircle, Loader, Search } from 'lucide-react';
import { notifyError, notifySuccess } from '../utils/errorHandler';

const WarehouseManagement: React.FC = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState<Partial<Warehouse>>({
    name: '',
    address: '',
    phone: '',
    description: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'warehouses'), orderBy('name')), (snapshot) => {
      setWarehouses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse)));
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filteredWarehouses = warehouses.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    w.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      notifyError("Vui lòng nhập tên kho.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingWarehouse) {
        await updateDoc(doc(db, 'warehouses', editingWarehouse.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        notifySuccess("Cập nhật kho thành công!");
      } else {
        await addDoc(collection(db, 'warehouses'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        notifySuccess("Thêm kho mới thành công!");
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      notifyError("Lỗi khi lưu thông tin kho.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa kho này?")) return;
    try {
      await deleteDoc(doc(db, 'warehouses', id));
      notifySuccess("Đã xóa kho.");
    } catch (err) {
      notifyError("Lỗi khi xóa kho.");
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      phone: '',
      description: ''
    });
    setEditingWarehouse(null);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center uppercase tracking-tight">
            <WarehouseIcon className="mr-3 text-blue-700" size={28} />
            Quản Lý Kho Hàng
          </h1>
          <p className="text-slate-500 text-sm font-medium">Danh sách các kho hàng trong hệ thống</p>
        </div>

        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="btn-primary flex items-center shadow-md"
        >
          <Plus size={18} className="mr-2" />
          THÊM KHO MỚI
        </button>
      </div>

      {/* Search */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          placeholder="Tìm kiếm kho bằng tên hoặc địa chỉ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-traditional pl-10"
        />
      </div>

      {/* Warehouse List */}
      <div className="card-traditional overflow-hidden flex flex-col flex-1">
        <div className="overflow-x-auto">
          <table className="table-traditional">
            <thead>
              <tr>
                <th>Tên Kho</th>
                <th>Địa Chỉ</th>
                <th>Liên Hệ</th>
                <th>Mô Tả</th>
                <th className="text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredWarehouses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400 font-bold text-sm italic">
                    Không tìm thấy kho nào
                  </td>
                </tr>
              ) : (
                filteredWarehouses.map(warehouse => (
                  <tr key={warehouse.id} className="hover:bg-slate-50 transition-colors">
                    <td>
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center mr-3">
                          <WarehouseIcon size={16} />
                        </div>
                        <span className="font-bold text-slate-900">{warehouse.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center text-slate-600 text-sm">
                        <MapPin size={14} className="mr-1.5 text-slate-400" /> {warehouse.address || 'N/A'}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center text-slate-600 text-sm">
                        <Phone size={14} className="mr-1.5 text-slate-400" /> {warehouse.phone || 'N/A'}
                      </div>
                    </td>
                    <td>
                      <span className="text-slate-500 text-xs italic">{warehouse.description || 'Không có mô tả'}</span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => { setEditingWarehouse(warehouse); setFormData(warehouse); setShowModal(true); }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all"
                          title="Sửa"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(warehouse.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all"
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border-4 border-slate-800 shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest">
                {editingWarehouse ? 'Cập Nhật Kho' : 'Thêm Kho Mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8">
              <div className="space-y-6 mb-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên Kho *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                    placeholder="Kho trung tâm..."
                  />
                </div>
                <div>
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
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Số Điện Thoại</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
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
                {editingWarehouse ? 'Cập Nhật Kho' : 'Tạo Kho Mới'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseManagement;
