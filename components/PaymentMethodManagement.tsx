import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { PaymentMethod } from '../types';
import { PlusCircle, Edit, Trash2, CreditCard, Search } from 'lucide-react';
import Pagination from './Pagination';
import ConfirmationModal from './ConfirmationModal';
import { formatNumber } from '../utils/formatting';

const PaymentMethodManagement: React.FC = () => {
  const [data, setData] = useState<PaymentMethod[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<PaymentMethod> | null>(null);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const q = query(collection(db, "paymentMethods"), orderBy("name"));
    return onSnapshot(q, (snapshot) => {
      setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod)));
    });
  }, []);

  const openModal = (item: PaymentMethod | null = null) => {
    setEditingItem(item);
    setName(item ? item.name : '');
    setBalance(item ? item.balance || 0 : 0);
    setError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (data.some(d => d.name.toLowerCase() === name.trim().toLowerCase() && d.id !== editingItem?.id)) {
        setError(`Phương thức "${name}" đã tồn tại.`); return;
    }
    try {
      if (editingItem?.id) {
        await updateDoc(doc(db, "paymentMethods", editingItem.id), { name: name.trim(), balance });
      } else {
        await addDoc(collection(db, "paymentMethods"), { name: name.trim(), balance, createdAt: serverTimestamp() });
      }
      setIsModalOpen(false);
    } catch { setError('Có lỗi xảy ra.'); }
  };

  const filteredData = useMemo(() => data.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())), [data, searchTerm]);
  const paginatedData = useMemo(() => filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredData, currentPage, pageSize]);

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-black text-dark flex items-center"><CreditCard className="mr-3 text-primary" size={32} /> Phương Thức Thanh Toán</h1>
        <button onClick={() => openModal(null)} className="flex items-center px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover transition shadow"><PlusCircle size={20} className="mr-2" /> Thêm PTTT</button>
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
        <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Tên PTTT</th>
                    <th className="px-6 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-wider">Số dư quỹ</th>
                    <th className="px-6 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-wider">Thao tác</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
                {paginatedData.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 font-bold text-dark">{d.name}</td>
                        <td className="px-6 py-4 text-right font-black text-blue-600">{formatNumber(d.balance || 0)} ₫</td>
                        <td className="px-6 py-4 text-right">
                            <button onClick={() => openModal(d)} className="text-blue-500 hover:text-blue-700 mr-3"><Edit size={18} /></button>
                            <button onClick={() => { setItemToDelete({id: d.id, name: d.name}); setIsConfirmOpen(true); }} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                        </td>
                    </tr>
                ))}
                {paginatedData.length === 0 && <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">Không tìm thấy dữ liệu.</td></tr>}
            </tbody>
        </table>
        {filteredData.length > pageSize && <div className="p-4 border-t border-slate-200"><Pagination currentPage={currentPage} totalPages={Math.ceil(filteredData.length / pageSize)} onPageChange={setCurrentPage} /></div>}
      </div>
      {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
              <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                  <h2 className="text-xl font-bold mb-4">{editingItem ? 'Sửa phương thức' : 'Thêm phương thức'}</h2>
                  <form onSubmit={handleSave}>
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-neutral mb-1">Tên phương thức</label>
                        <input type="text" value={name} onChange={e => {setName(e.target.value); setError('');}} className="w-full px-3 py-2 border rounded-lg focus:ring-primary focus:border-primary" required />
                      </div>
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-neutral mb-1">Số dư quỹ đầu kỳ</label>
                        <input type="number" value={balance} onChange={e => setBalance(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border rounded-lg focus:ring-primary focus:border-primary" />
                      </div>
                      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
                      <div className="flex justify-end space-x-2 mt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-200 rounded-lg text-slate-700">Hủy</button><button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg font-bold">Lưu</button></div>
                  </form>
              </div>
          </div>
      )}
      <ConfirmationModal isOpen={isConfirmOpen} title="Xóa phương thức thanh toán" message={`Bạn có chắc muốn xóa phương thức "${itemToDelete?.name}"?`} onConfirm={async () => { if(itemToDelete) await deleteDoc(doc(db, "paymentMethods", itemToDelete.id)); setIsConfirmOpen(false); }} onCancel={() => setIsConfirmOpen(false)} confirmText="Xóa" cancelText="Hủy" />
    </div>
  );
};
export default PaymentMethodManagement;
