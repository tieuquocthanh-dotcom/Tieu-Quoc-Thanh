import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ProductCategory } from '../types';
import { PlusCircle, Edit, Trash2, Tags, Search, X, FolderTree, Sparkles } from 'lucide-react';
import Pagination from './Pagination';
import ConfirmationModal from './ConfirmationModal';

export const ProductCategoryModal: React.FC<{
  category: Partial<ProductCategory> | null;
  onClose: () => void;
  onSave: (categoryData: { name: string; description?: string }) => void;
  existingNames: string[];
}> = ({ category, onClose, onSave, existingNames }) => {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (existingNames.some(n => n.toLowerCase() === name.trim().toLowerCase() && n.toLowerCase() !== category?.name?.toLowerCase())) {
      setError(`Loại sản phẩm "${name.trim()}" đã tồn tại.`);
      return;
    }
    onSave({ name: name.trim(), description: description.trim() });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-fade-in-down">
        <div className="bg-primary p-4 text-white flex justify-between items-center">
          <h3 className="font-black uppercase text-sm flex items-center">
            <Tags className="mr-2" size={20} />
            {category?.id ? 'Chỉnh Sửa Loại Sản Phẩm' : 'Thêm Loại Sản Phẩm Mới'}
          </h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-black text-slate-600 uppercase mb-1">
              Tên loại sản phẩm <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="VD: Mặt vợt, Vợt, Giày, Banh, Phụ kiện..."
              value={name}
              onChange={e => {
                setName(e.target.value);
                setError('');
              }}
              required
              autoFocus
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {error && <p className="text-red-500 text-xs font-semibold mt-1">{error}</p>}
          </div>
          <div>
            <label className="block text-[11px] font-black text-slate-600 uppercase mb-1">
              Ghi chú / Mô tả (tùy chọn)
            </label>
            <input
              type="text"
              placeholder="Mô tả nhóm sản phẩm..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl font-medium text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-black text-xs uppercase text-slate-700 transition hover:bg-slate-200"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg transition active:scale-95 hover:bg-primary-hover"
            >
              {category?.id ? 'Lưu Thay Đổi' : 'Thêm Loại'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Initial default categories requested by user
export const INITIAL_PRODUCT_CATEGORIES = ['Mặt vợt', 'Vợt', 'Giày', 'Banh', 'Phụ kiện'];

const ProductCategoryManagement: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'product_categories'), orderBy('name'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        // Auto-seed initial categories if collection is currently completely empty
        seedInitialCategories();
      } else {
        const list: ProductCategory[] = snapshot.docs.map(
          doc => ({ id: doc.id, ...doc.data() } as ProductCategory)
        );
        setCategories(list);
      }
    });
    return () => unsubscribe();
  }, []);

  const seedInitialCategories = async () => {
    try {
      setIsSeeding(true);
      const snapshot = await getDocs(collection(db, 'product_categories'));
      if (snapshot.empty) {
        for (const catName of INITIAL_PRODUCT_CATEGORIES) {
          await addDoc(collection(db, 'product_categories'), {
            name: catName,
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      console.error('Error seeding initial categories:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleOpenModal = (category: ProductCategory | null = null) => {
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  const handleSave = async (categoryData: { name: string; description?: string }) => {
    try {
      if (editingCategory?.id) {
        await updateDoc(doc(db, 'product_categories', editingCategory.id), {
          ...categoryData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'product_categories'), {
          ...categoryData,
          createdAt: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
      setEditingCategory(null);
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Có lỗi xảy ra khi lưu loại sản phẩm.');
    }
  };

  const handleDelete = (item: { id: string; name: string }) => {
    setCategoryToDelete(item);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    try {
      await deleteDoc(doc(db, 'product_categories', categoryToDelete.id));
      setIsConfirmOpen(false);
      setCategoryToDelete(null);
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Có lỗi xảy ra khi xóa loại sản phẩm.');
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return categories;
    return categories.filter(c => c.name.toLowerCase().includes(term) || (c.description || '').toLowerCase().includes(term));
  }, [categories, searchTerm]);

  const paginated = useMemo(() => {
    return filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-dark flex items-center">
            <Tags className="mr-3 text-primary" size={32} />
            Quản Lý Loại Sản Phẩm
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Thiết lập danh mục phân loại (Mặt vợt, Vợt, Giày, Banh, Phụ kiện...) cho toàn bộ hệ thống
          </p>
        </div>
        <div className="flex items-center gap-2">
          {categories.length === 0 && (
            <button
              onClick={seedInitialCategories}
              disabled={isSeeding}
              className="flex items-center px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition shadow text-xs uppercase"
            >
              <Sparkles size={16} className="mr-1.5" />
              Khởi Tạo Mẫu Ban Đầu
            </button>
          )}
          <button
            onClick={() => handleOpenModal(null)}
            className="flex items-center px-4 py-2 bg-primary text-white font-black rounded-xl hover:bg-primary-hover transition shadow text-xs uppercase"
          >
            <PlusCircle size={18} className="mr-2" />
            Thêm Loại Sản Phẩm
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition ml-2"
              title="Đóng cửa sổ"
            >
              <X size={24} />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Tìm loại sản phẩm..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border rounded-xl font-bold text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-500">
            <span>Hiển thị:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border rounded-lg px-2.5 py-1.5 bg-white text-dark focus:ring-primary focus:border-primary font-bold"
            >
              <option value={10}>10 dòng</option>
              <option value={20}>20 dòng</option>
              <option value={50}>50 dòng</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider">
              <tr>
                <th className="p-4 w-12 text-center">#</th>
                <th className="p-4">Tên Loại Sản Phẩm</th>
                <th className="p-4">Mô Tả</th>
                <th className="p-4 text-center w-28">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400 font-bold text-sm">
                    {categories.length === 0 ? 'Đang tải dữ liệu...' : 'Không tìm thấy loại sản phẩm phù hợp.'}
                  </td>
                </tr>
              ) : (
                paginated.map((cat, idx) => (
                  <tr key={cat.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 text-center font-bold text-xs text-slate-400">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0"></span>
                        <span className="font-black text-slate-800 text-sm">{cat.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-500 font-medium text-xs">
                      {cat.description || <span className="text-slate-300 italic">—</span>}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center items-center space-x-2">
                        <button
                          onClick={() => handleOpenModal(cat)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Chỉnh sửa"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete({ id: cat.id, name: cat.name })}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Xóa loại này"
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

        {filtered.length > pageSize && (
          <div className="p-3 border-t border-slate-100">
            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      {isModalOpen && (
        <ProductCategoryModal
          category={editingCategory}
          onClose={() => {
            setIsModalOpen(false);
            setEditingCategory(null);
          }}
          onSave={handleSave}
          existingNames={categories.map(c => c.name)}
        />
      )}

      {isConfirmOpen && categoryToDelete && (
        <ConfirmationModal
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={confirmDelete}
          title="Xác nhận Xóa Loại Sản Phẩm"
          message={
            <span>
              Bạn có chắc chắn muốn xóa loại sản phẩm <strong>"{categoryToDelete.name}"</strong>?
            </span>
          }
        />
      )}
    </div>
  );
};

export default ProductCategoryManagement;
