import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { PlusCircle, Edit, Trash2, StickyNote, Search, Pin } from 'lucide-react';
import Pagination from './Pagination';
import ConfirmationModal from './ConfirmationModal';
import { User } from 'firebase/auth';

interface SystemNote {
  id: string;
  title: string;
  content: string;
  authorEmail: string;
  createdAt: any;
  updatedAt: any;
  isPinned: boolean;
}

const NoteManagement: React.FC<{ user: User | null }> = ({ user }) => {
  const [data, setData] = useState<SystemNote[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<SystemNote> | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    const q = query(collection(db, "notes"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      setData(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as SystemNote)));
    });
  }, []);

  const openModal = (item: SystemNote | null = null) => {
    setEditingItem(item);
    setTitle(item ? item.title : '');
    setContent(item ? item.content : '');
    setIsPinned(item ? !!item.isPinned : false);
    setError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
        setError('Vui lòng nhập đủ tiêu đề và nội dung.');
        return;
    }
    try {
      if (editingItem?.id) {
        await updateDoc(doc(db, "notes", editingItem.id), { 
            title: title.trim(), 
            content: content.trim(),
            isPinned,
            updatedAt: serverTimestamp() 
        });
      } else {
        await addDoc(collection(db, "notes"), { 
            title: title.trim(), 
            content: content.trim(),
            isPinned,
            authorEmail: user?.email || 'Unknown',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
    } catch { setError('Có lỗi xảy ra.'); }
  };

  const handleTogglePin = async (id: string, currentPinStatus: boolean) => {
      try {
          await updateDoc(doc(db, "notes", id), { isPinned: !currentPinStatus });
      } catch (e) {
          console.error(e);
      }
  }

  // Sort pinned first, then by date (already sorted by date from firestore)
  const sortedData = useMemo(() => {
      const pinned = data.filter(d => d.isPinned);
      const unpinned = data.filter(d => !d.isPinned);
      return [...pinned, ...unpinned];
  }, [data]);

  const filteredData = useMemo(() => sortedData.filter(d => 
      (d.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (d.content || '').toLowerCase().includes(searchTerm.toLowerCase())
  ), [sortedData, searchTerm]);
  
  const paginatedData = useMemo(() => filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredData, currentPage, pageSize]);

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-black text-dark flex items-center"><StickyNote className="mr-3 text-primary" size={32} /> Ghi Chú Hệ Thống</h1>
        <button onClick={() => openModal(null)} className="flex items-center px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover transition shadow"><PlusCircle size={20} className="mr-2" /> Thêm Ghi Chú</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Tìm tiêu đề hoặc nội dung..." value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-primary focus:border-primary" />
            </div>
            <select value={pageSize} onChange={e => {setPageSize(Number(e.target.value)); setCurrentPage(1);}} className="border rounded-lg px-3 py-2 text-sm text-dark focus:ring-primary focus:border-primary">
                <option value={12}>12 mục / trang</option><option value={24}>24 mục / trang</option><option value={60}>60 mục / trang</option>
            </select>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6 bg-slate-100">
            {paginatedData.map(d => (
                <div key={d.id} className={`bg-white p-5 rounded-2xl shadow-sm border-2 transition-all relative group flex flex-col ${d.isPinned ? 'border-yellow-400 shadow-yellow-100' : 'border-slate-200 hover:border-primary hover:shadow-md'}`}>
                    <button 
                        onClick={() => handleTogglePin(d.id, d.isPinned)} 
                        className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${d.isPinned ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'}`}
                        title={d.isPinned ? "Bỏ ghim" : "Ghim lên đầu"}
                    >
                        <Pin size={18} className={d.isPinned ? "fill-yellow-500" : ""} />
                    </button>
                    <h3 className="font-black text-lg text-dark mb-2 pr-8 line-clamp-2" title={d.title}>{d.title}</h3>
                    <p className="text-sm text-slate-600 mb-4 line-clamp-6 flex-1 whitespace-pre-wrap">{d.content}</p>
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                        <div className="flex flex-col gap-0.5">
                            <div className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[150px]" title={d.authorEmail}>
                                {d.authorEmail}
                            </div>
                            {d.createdAt && (
                                <div className="text-[10px] text-slate-500 font-medium">
                                    {d.createdAt.toDate().toLocaleDateString('vi-VN')} {d.createdAt.toDate().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                                </div>
                            )}
                        </div>
                        <div className="flex space-x-2">
                            <button onClick={() => openModal(d)} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"><Edit size={14} /></button>
                            <button onClick={() => { setItemToDelete({id: d.id, title: d.title}); setIsConfirmOpen(true); }} className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"><Trash2 size={14} /></button>
                        </div>
                    </div>
                </div>
            ))}
            {paginatedData.length === 0 && (
                <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400">
                    <StickyNote size={64} className="mb-4 opacity-20" />
                    <p className="text-lg font-bold">Chưa có ghi chú nào.</p>
                </div>
            )}
        </div>
        {filteredData.length > pageSize && <div className="p-4 border-t border-slate-200"><Pagination currentPage={currentPage} totalPages={Math.ceil(filteredData.length / pageSize)} onPageChange={setCurrentPage} /></div>}
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
              <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-2xl animate-fade-in-down">
                  <h2 className="text-2xl font-black mb-6 uppercase text-dark">{editingItem ? 'Sửa Ghi Chú' : 'Thêm Ghi Chú Mới'}</h2>
                  <form onSubmit={handleSave}>
                      <div className="mb-4">
                        <label className="block text-sm font-black text-slate-500 uppercase mb-2">Tiêu đề</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Nhập tiêu đề ghi chú..." className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary font-bold text-dark" required />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-black text-slate-500 uppercase mb-2">Nội dung</label>
                        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Nhập chi tiết nội dung..." rows={8} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-dark resize-y leading-relaxed" required />
                      </div>
                      <div className="mb-6 flex items-center">
                          <label className="flex items-center cursor-pointer">
                              <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer" />
                              <span className="ml-2 text-sm font-bold text-slate-700">Ghim lên đầu trang</span>
                          </label>
                      </div>
                      {error && <p className="text-red-500 text-sm font-bold mb-4">{error}</p>}
                      <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-100">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Hủy</button>
                          <button type="submit" className="px-8 py-2.5 bg-primary text-white font-black uppercase tracking-wider rounded-xl hover:bg-primary-hover shadow-lg transition-all">Lưu Ghi Chú</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
      <ConfirmationModal isOpen={isConfirmOpen} title="Xóa Ghi Chú" message={`Bạn có chắc muốn xóa ghi chú "${itemToDelete?.title}"?`} onConfirm={async () => { if(itemToDelete) await deleteDoc(doc(db, "notes", itemToDelete.id)); setIsConfirmOpen(false); }} onCancel={() => setIsConfirmOpen(false)} confirmText="Xóa" cancelText="Hủy" />
    </div>
  );
};
export default NoteManagement;
