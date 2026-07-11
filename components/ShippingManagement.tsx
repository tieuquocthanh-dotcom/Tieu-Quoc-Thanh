import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Shipper } from '../types';
import { PlusCircle, Edit, Trash2, Truck, Search, X } from 'lucide-react';
import Pagination from './Pagination';
import ConfirmationModal from './ConfirmationModal';

export const ShipperModal: React.FC<{
  shipper: Shipper | null;
  onClose: () => void;
  onSave: (data: any) => void;
  existingNames?: string[];
}> = ({ shipper, onClose, onSave, existingNames }) => {
  const [name, setName] = useState(shipper?.name || '');
  const [phone, setPhone] = useState(shipper?.phone || '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (existingNames && existingNames.some(n => n.toLowerCase() === name.trim().toLowerCase() && n !== shipper?.name)) {
        setError(`Đơn vị "${name}" đã tồn tại.`); return;
    }
    onSave({ name: name.trim(), phone: phone.trim() });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border-4 border-slate-800 overflow-hidden animate-fade-in-down">
        <div className="bg-primary p-4 text-white flex justify-between items-center">
          <h3 className="font-black uppercase text-sm flex items-center"><Truck className="mr-2" size={20}/> {shipper ? 'Sửa đơn vị vận chuyển' : 'Thêm đơn vị vận chuyển'}</h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Tên đơn vị vận chuyển</label>
            <input type="text" value={name} onChange={e => {setName(e.target.value); setError('');}} required className="w-full p-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-primary" />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Số điện thoại</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-primary" />
          </div>
          <div className="pt-4 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-white border-2 border-slate-800 rounded-xl font-black text-xs uppercase text-black transition hover:bg-slate-100">Hủy</button>
            <button type="submit" className="flex-1 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg transition active:scale-95 hover:bg-primary-hover">Lưu</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ShippingManagement: React.FC = () => {
    const [data, setData] = useState<Shipper[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Shipper | null>(null);
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

    useEffect(() => {
        const q = query(collection(db, "shippers"), orderBy("name"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shipper)));
        });
        return () => unsubscribe();
    }, []);

    const openModal = (item: Shipper | null = null) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleSave = async (shipperData: any) => {
        try {
            if (editingItem?.id) {
                await updateDoc(doc(db, "shippers", editingItem.id), shipperData);
            } else {
                await addDoc(collection(db, "shippers"), { ...shipperData, createdAt: serverTimestamp() });
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving shipper:", error);
            alert("Có lỗi xảy ra khi lưu.");
        }
    };

    const confirmDelete = async () => {
        if (itemToDelete) {
            try {
                await deleteDoc(doc(db, "shippers", itemToDelete.id));
                setIsConfirmOpen(false);
                setItemToDelete(null);
            } catch (error) {
                console.error("Error deleting shipper:", error);
                alert("Có lỗi xảy ra khi xóa.");
            }
        }
    };

    const filteredData = useMemo(() => data.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())), [data, searchTerm]);
    const paginatedData = useMemo(() => filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredData, currentPage, pageSize]);

    return (
        <div className="p-6 max-w-5xl mx-auto animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-black text-dark flex items-center"><Truck className="mr-3 text-primary" size={32} /> Quản Lý Đơn Vị Vận Chuyển</h1>
                <button onClick={() => openModal()} className="flex items-center px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover transition shadow"><PlusCircle size={20} className="mr-2" /> Thêm ĐVVC</button>
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
                                <th className="p-4 border-b tracking-wider">Tên đơn vị</th>
                                <th className="p-4 border-b tracking-wider min-w-[150px]">Số điện thoại</th>
                                <th className="p-4 border-b text-right tracking-wider">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedData.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-bold text-dark">{item.name}</td>
                                    <td className="p-4 text-slate-600">{item.phone || '-'}</td>
                                    <td className="p-4 text-right space-x-2">
                                        <button onClick={() => openModal(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit size={18} /></button>
                                        <button onClick={() => { setItemToDelete({ id: item.id, name: item.name }); setIsConfirmOpen(true); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={18} /></button>
                                    </td>
                                </tr>
                            ))}
                            {paginatedData.length === 0 && (
                                <tr><td colSpan={3} className="p-8 text-center text-slate-500">Không tìm thấy dữ liệu.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination currentPage={currentPage} totalPages={Math.ceil(filteredData.length / pageSize)} onPageChange={setCurrentPage} />
            </div>

            {isModalOpen && (
                <ShipperModal
                    shipper={editingItem}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    existingNames={data.map(d => d.name)}
                />
            )}

            <ConfirmationModal
                isOpen={isConfirmOpen}
                title="Xóa Đơn Vị Vận Chuyển"
                message={`Bạn có chắc chắn muốn xóa "${itemToDelete?.name}"?`}
                onConfirm={confirmDelete}
                onCancel={() => { setIsConfirmOpen(false); setItemToDelete(null); }}
            />
        </div>
    );
};

export default ShippingManagement;