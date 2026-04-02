import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Manufacturer } from '../types';
import { Factory, Plus, Search, Edit2, Trash2, X, Save, Loader } from 'lucide-react';
import { notifyError, notifySuccess } from '../utils/errorHandler';

const ManufacturerManagement: React.FC = () => {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'manufacturers'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setManufacturers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Manufacturer)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredManufacturers = manufacturers.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (manufacturer?: Manufacturer) => {
    if (manufacturer) {
      setEditingManufacturer(manufacturer);
      setName(manufacturer.name);
    } else {
      setEditingManufacturer(null);
      setName('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      notifyError("Vui lòng nhập tên hãng sản xuất.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingManufacturer) {
        await updateDoc(doc(db, 'manufacturers', editingManufacturer.id), {
          name: name.trim(),
          updatedAt: serverTimestamp()
        });
        notifySuccess("Cập nhật hãng thành công!");
      } else {
        await addDoc(collection(db, 'manufacturers'), {
          name: name.trim(),
          createdAt: serverTimestamp()
        });
        notifySuccess("Thêm hãng mới thành công!");
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving manufacturer:", err);
      notifyError("Có lỗi xảy ra khi lưu thông tin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa hãng này?")) {
      try {
        await deleteDoc(doc(db, 'manufacturers', id));
        notifySuccess("Đã xóa hãng sản xuất.");
      } catch (err) {
        notifyError("Không thể xóa hãng sản xuất.");
      }
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Factory className="mr-3 text-blue-600" size={28} />
            Quản Lý Hãng Sản Xuất
          </h1>
          <p className="text-slate-500 text-sm mt-1">Danh sách các thương hiệu và nhà sản xuất</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-200 flex items-center active:scale-95"
        >
          <Plus size={20} className="mr-2" />
          Thêm Hãng Mới
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 bg-slate-50/50 border-b border-slate-200">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm hãng sản xuất..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium text-slate-800 transition-all outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4">Tên Hãng</th>
                <th className="px-6 py-4">ID Hệ Thống</th>
                <th className="px-6 py-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredManufacturers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-20 text-center text-slate-400 font-medium text-sm italic">
                    Không tìm thấy hãng sản xuất nào
                  </td>
                </tr>
              ) : (
                filteredManufacturers.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl mr-3">
                          <Factory size={18} />
                        </div>
                        <span className="font-semibold text-slate-900 text-sm">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[11px] text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded">
                        {m.id}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-1">
                        <button
                          onClick={() => handleOpenModal(m)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Chỉnh sửa"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Xóa"
                        >
                          <Trash2 size={18} />
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingManufacturer ? 'Chỉnh Sửa Hãng' : 'Thêm Hãng Mới'}
                </h2>
                <p className="text-slate-500 text-xs mt-1">Thông tin thương hiệu sản phẩm</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Tên Hãng Sản Xuất *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium text-slate-800 transition-all outline-none"
                    placeholder="Nhập tên hãng..."
                  />
                </div>
              </div>

              <div className="mt-10 flex space-x-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200 transition-all active:scale-95"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-200 flex items-center justify-center active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader className="animate-spin mr-2" size={20} /> : <Save size={20} className="mr-2" />}
                  Lưu Thông Tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManufacturerManagement;
