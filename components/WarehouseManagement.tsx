import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Warehouse } from '../types';
import { PlusCircle, Edit, Trash2, Warehouse as WarehouseIcon, Search } from 'lucide-react';
import Pagination from './Pagination';
import ConfirmationModal from './ConfirmationModal';

export const WarehouseModal: React.FC<{
  warehouse: Partial<Warehouse> | null;
  onClose: () => void;
  onSave: (warehouse: Omit<Warehouse, 'id' | 'createdAt'>) => void;
  existingNames: string[];
}> = ({ warehouse, onClose, onSave, existingNames }) => {
  const [name, setName] = useState(warehouse?.name || '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (existingNames.some(n => n.toLowerCase() === name.trim().toLowerCase() && n !== warehouse?.name)) {
        setError(`Kho "${name}" đã tồn tại.`); return;
    }
    onSave({ name: name.trim() });
  };

  return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[110]">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">{warehouse ? 'Sửa kho' : 'Thêm kho mới'}</h2>
              <form onSubmit={handleSubmit}>
                  <input type="text" value={name} onChange={e => {setName(e.target.value); setError('');}} placeholder="Tên kho" className="w-full px-3 py-2 border rounded-lg focus:ring-primary focus:border-primary mb-2" required />
                  {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
                  <div className="flex justify-end space-x-2 mt-4">
                      <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-300">Hủy</button>
                      <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-hover shadow">Lưu</button>
                  </div>
              </form>
          </div>
      </div>
  );
};

const WarehouseManagement: React.FC = () => {
  const [data, setData] = useState<Warehouse[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<Warehouse> | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const q = query(collection(db, "warehouses"), orderBy("name"));
    return onSnapshot(q, (snapshot) => {
      setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
    });
  }, []);

  const openModal = (item: Warehouse | null = null) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSave = async (warehouseData: Omit<Warehouse, 'id' | 'createdAt'>) => {
    try {
      if (editingItem?.id) {
        await updateDoc(doc(db, "warehouses", editingItem.id), warehouseData);
      } else {
        await addDoc(collection(db, "warehouses"), { ...warehouseData, createdAt: serverTimestamp() });
      }
      setIsModalOpen(false);
    } catch { 
        alert('Có lỗi xảy ra khi lưu.'); 
    }
  };

  const confirmDelete = async () => {
      if (itemToDelete) {
          try {
              await deleteDoc(doc(db, "warehouses", itemToDelete.id));
              setIsConfirmOpen(false);
              setItemToDelete(null);
          } catch (error) {
              console.error("Error deleting warehouse:", error);
              alert("Có lỗi xảy ra khi xóa.");
          }
      }
  };

  const filteredData = useMemo(() => data.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())), [data, searchTerm]);
  const paginatedData = useMemo(() => filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredData, currentPage, pageSize]);

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-black text-dark flex items-center"><WarehouseIcon className="mr-3 text-primary" size={32} /> Quản Lý Kho</h1>
        <button onClick={() => openModal(null)} className="flex items-center px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover transition shadow"><PlusCircle size={20} className="mr-2" /> Thêm Kho</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Tìm kiếm..." value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-primary focus:border-primary" />
            </div>
            <select value={pageSize} onChange={e => {setPageSize(Number(e.target.value)); setCurrentPage(1);}} className="border rounded-lg px-3 py-2 text-sm text-dark focus:ring-primary focus:border-primary">
                <option value={10}>10 dòng / trang</option><option value={20}>20 dòng / trang</option><option value={50}>50 dòng / trang</option>
            </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold text-sm uppercase">
              <tr>
                <th className="p-4 border-b tracking-wider">Tên kho</th>
                <th className="p-4 border-b text-right tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-bold text-dark">{item.name}</td>
                  <td className="p-4 text-right space-x-2">
                    <button onClick={() => openModal(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit size={18} /></button>
                    <button onClick={() => { setItemToDelete({ id: item.id, name: item.name }); setIsConfirmOpen(true); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
              {paginatedData.length === 0 && (
                  <tr><td colSpan={2} className="p-8 text-center text-slate-500">Không tìm thấy dữ liệu.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={Math.ceil(filteredData.length / pageSize)} onPageChange={setCurrentPage} />
      </div>

      {isModalOpen && (
        <WarehouseModal
          warehouse={editingItem}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          existingNames={data.map(d => d.name)}
        />
      )}

      <ConfirmationModal
          isOpen={isConfirmOpen}
          title="Xóa Kho"
          message={`Bạn có chắc chắn muốn xóa "${itemToDelete?.name}"?`}
          onConfirm={confirmDelete}
          onCancel={() => { setIsConfirmOpen(false); setItemToDelete(null); }}
      />
    </div>
  );
};

export default WarehouseManagement;
