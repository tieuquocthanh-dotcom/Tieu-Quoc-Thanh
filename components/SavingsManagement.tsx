import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { PiggyBank, PlusCircle, Edit, Trash2, Search, Calendar, Landmark, CheckCircle2, TrendingUp, X, Archive } from 'lucide-react';
import Pagination from './Pagination';
import ConfirmationModal from './ConfirmationModal';
import { User } from 'firebase/auth';
import { formatNumber, parseNumber } from '../utils/formatting';

interface SavingsAccount {
    id: string;
    bankName: string;
    accountName: string;
    amount: number;
    interestRate: number;
    termMonths: number;
    startDate: any;
    maturityDate: any;
    note: string;
    status: 'active' | 'closed';
    createdAt: any;
    updatedAt: any;
}

const SavingsManagement: React.FC<{ user: User | null }> = ({ user }) => {
    const [data, setData] = useState<SavingsAccount[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<SavingsAccount> | null>(null);
    
    const [bankName, setBankName] = useState('');
    const [accountName, setAccountName] = useState('');
    const [amountStr, setAmountStr] = useState('');
    const [interestRateStr, setInterestRateStr] = useState('');
    const [termMonthsStr, setTermMonthsStr] = useState('');
    const [startDateStr, setStartDateStr] = useState('');
    const [maturityDateStr, setMaturityDateStr] = useState('');
    const [note, setNote] = useState('');
    const [status, setStatus] = useState<'active' | 'closed'>('active');

    const [error, setError] = useState('');
    const [pageSize, setPageSize] = useState(12);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string; title: string } | null>(null);

    useEffect(() => {
        const q = query(collection(db, "savings"), orderBy("createdAt", "desc"));
        return onSnapshot(q, (snapshot) => {
            setData(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as SavingsAccount)));
        });
    }, []);

    const toJSDate = (d: any): Date | null => {
        if (!d) return null;
        if (typeof d.toDate === 'function') return d.toDate();
        if (d instanceof Date) return d;
        try { return new Date(d); } catch { return null; }
    };

    const openModal = (item: SavingsAccount | null = null) => {
        setEditingItem(item);
        if (item) {
            setBankName(item.bankName || '');
            setAccountName(item.accountName || '');
            setAmountStr(item.amount ? item.amount.toString() : '');
            setInterestRateStr(item.interestRate !== undefined ? item.interestRate.toString() : '');
            setTermMonthsStr(item.termMonths !== undefined ? item.termMonths.toString() : '');
            
            const sDate = toJSDate(item.startDate);
            setStartDateStr(sDate ? `${sDate.getFullYear()}-${String(sDate.getMonth()+1).padStart(2,'0')}-${String(sDate.getDate()).padStart(2,'0')}` : '');
            
            const mDate = toJSDate(item.maturityDate);
            setMaturityDateStr(mDate ? `${mDate.getFullYear()}-${String(mDate.getMonth()+1).padStart(2,'0')}-${String(mDate.getDate()).padStart(2,'0')}` : '');
            
            setNote(item.note || '');
            setStatus(item.status || 'active');
        } else {
            setBankName('');
            setAccountName('');
            setAmountStr('');
            setInterestRateStr('');
            setTermMonthsStr('');
            setStartDateStr(new Date().toISOString().split('T')[0]);
            setMaturityDateStr('');
            setNote('');
            setStatus('active');
        }
        setError('');
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const amountNum = parseNumber(amountStr);
        if (amountNum <= 0) {
            setError('Vui lòng nhập số tiền hợp lệ lớn hơn 0.');
            return;
        }

        const payload: Omit<SavingsAccount, 'id' | 'createdAt' | 'updatedAt'> = {
            bankName: bankName.trim(),
            accountName: accountName.trim(),
            amount: amountNum,
            interestRate: parseNumber(interestRateStr),
            termMonths: parseNumber(termMonthsStr),
            startDate: startDateStr ? new Date(startDateStr) : new Date(),
            maturityDate: maturityDateStr ? new Date(maturityDateStr) : null,
            note: note.trim(),
            status
        };

        try {
            if (editingItem?.id) {
                await updateDoc(doc(db, "savings", editingItem.id), { 
                    ...payload,
                    updatedAt: serverTimestamp() 
                });
            } else {
                await addDoc(collection(db, "savings"), { 
                    ...payload,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }
            setIsModalOpen(false);
        } catch (e: any) { 
            console.error(e);
            setError('Có lỗi xảy ra: ' + (e.message || String(e))); 
        }
    };

    const filteredData = useMemo(() => data.filter(d => 
        (d.bankName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (d.accountName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.note || '').toLowerCase().includes(searchTerm.toLowerCase())
    ), [data, searchTerm]);
    
    const paginatedData = useMemo(() => filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredData, currentPage, pageSize]);

    const totalActiveSavings = data.filter(d => d.status === 'active').reduce((acc, curr) => acc + (curr.amount || 0), 0);

    const renderRemainingDays = (maturityDate: any) => {
        const maturity = toJSDate(maturityDate);
        if (!maturity) return null;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        maturity.setHours(0, 0, 0, 0);
        const diffTime = maturity.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            return <span className="text-xs font-black text-red-600 block mt-1">Đã quá hạn {-diffDays} ngày</span>;
        } else if (diffDays === 0) {
            return <span className="text-xs font-black text-red-600 block mt-1">Đáo hạn hôm nay</span>;
        } else {
            return <span className="text-xs font-black text-red-600 block mt-1">Còn {diffDays} ngày</span>;
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-3xl font-black text-dark flex items-center"><PiggyBank className="mr-3 text-primary" size={32} /> Quản Lý Sổ Tiết Kiệm</h1>
                
                <div className="bg-white p-2 rounded-xl flex shadow-sm border border-slate-200">
                    <div className="px-4 py-2 text-center border-r border-slate-100">
                        <p className="text-[10px] text-slate-400 font-black uppercase">Đang gửi</p>
                        <p className="text-sm font-black text-slate-700">{data.filter(d => d.status === 'active').length} Sổ</p>
                    </div>
                    <div className="px-4 py-2 text-center">
                        <p className="text-[10px] text-slate-400 font-black uppercase">Tổng Tiết Kiệm (Active)</p>
                        <p className="text-sm font-black text-green-600">
                            {formatNumber(totalActiveSavings)} ₫
                        </p>
                    </div>
                </div>

                <button onClick={() => openModal(null)} className="flex items-center px-4 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover transition shadow w-full md:w-auto justify-center"><PlusCircle size={20} className="mr-2" /> Thêm Sổ Mới</button>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="flex flex-col sm:flex-row p-4 border-b border-slate-200 bg-slate-50 items-center justify-between gap-4">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" placeholder="Tìm tên sổ, ngân hàng..." value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm font-medium" />
                    </div>
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-slate-100">
                    {paginatedData.map(d => (
                        <div key={d.id} className={`bg-white p-5 rounded-2xl shadow-sm border-2 transition-all relative flex flex-col ${d.status === 'active' ? 'border-green-400 hover:shadow-md' : 'border-slate-200 grayscale-[0.5] hover:shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Landmark size={20}/></div>
                                    <div>
                                        <h3 className="font-black text-lg text-dark uppercase line-clamp-1" title={d.bankName}>{d.bankName || 'Ngân hàng'}</h3>
                                        <p className="text-xs font-bold text-slate-500 line-clamp-1">{d.accountName}</p>
                                    </div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {d.status === 'active' ? 'Đang gửi' : 'Đã tất toán'}
                                </span>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-100">
                                <div className="text-xs text-slate-500 font-bold uppercase mb-1">Số tiền gốc</div>
                                <div className="text-2xl font-black text-dark mb-3">{formatNumber(d.amount)} <span className="text-sm">₫</span></div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center"><TrendingUp size={10} className="mr-1"/> Lãi suất</div>
                                        <div className="text-sm font-bold text-orange-600">{d.interestRate}% <span className="text-xs text-slate-400">/ năm</span></div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center"><Calendar size={10} className="mr-1"/> Kỳ hạn</div>
                                        <div className="text-sm font-bold text-slate-700">{d.termMonths} tháng</div>
                                    </div>
                                </div>
                            </div>

                            <div className="text-xs text-slate-500 flex flex-col gap-1.5 mb-4 px-2">
                                <div className="flex justify-between">
                                    <span className="font-medium">Ngày gửi:</span>
                                    <span className="font-bold text-dark text-right">{toJSDate(d.startDate) ? toJSDate(d.startDate)!.toLocaleDateString('vi-VN') : ''}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium">Ngày đến hạn:</span>
                                    <div className="text-right">
                                        <span className="font-bold text-dark">{toJSDate(d.maturityDate) ? toJSDate(d.maturityDate)!.toLocaleDateString('vi-VN') : 'Không có'}</span>
                                        {d.status === 'active' && d.maturityDate && renderRemainingDays(d.maturityDate)}
                                    </div>
                                </div>
                            </div>
                            
                            {d.note && (
                                <p className="text-[11px] text-slate-500 italic mb-4 px-2 line-clamp-2">{d.note}</p>
                            )}

                            <div className="flex items-center justify-end mt-auto pt-4 border-t border-slate-100">
                                <div className="flex space-x-2">
                                    <button onClick={() => openModal(d)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"><Edit size={16} /></button>
                                    <button onClick={() => { setItemToDelete({id: d.id, title: d.accountName}); setIsConfirmOpen(true); }} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {paginatedData.length === 0 && (
                        <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400">
                            <PiggyBank size={64} className="mb-4 opacity-20" />
                            <p className="text-lg font-bold">Chưa có sổ tiết kiệm nào.</p>
                        </div>
                    )}
                </div>
                {filteredData.length > pageSize && <div className="p-4 border-t border-slate-200"><Pagination currentPage={currentPage} totalPages={Math.ceil(filteredData.length / pageSize)} onPageChange={setCurrentPage} /></div>}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-2xl animate-fade-in-down max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black uppercase text-dark flex items-center">
                                {editingItem ? 'Sửa Sổ Tiết Kiệm' : 'Thêm Sổ Tiết Kiệm Mới'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Tên ngân hàng / Tổ chức</label>
                                <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="VD: Vietcombank, Momo..." className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary font-bold text-dark" required />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Tên sổ / Mục đích</label>
                                <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="VD: Quỹ dự phòng, Tiền học..." className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary font-bold text-dark" required />
                            </div>
                            
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Số tiền gốc (VNĐ)</label>
                                <input type="text" value={amountStr} onChange={e => setAmountStr(e.target.value.replace(/[^0-9]/g, ''))} onBlur={() => setAmountStr(formatNumber(parseNumber(amountStr)))} placeholder="Nhập số tiền gửi" className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary font-black text-lg text-dark" required />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Lãi suất (% / năm)</label>
                                <input type="number" step="0.01" value={interestRateStr} onChange={e => setInterestRateStr(e.target.value)} placeholder="VD: 5.5" className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary font-bold text-dark" />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Kỳ hạn (Tháng)</label>
                                <input type="number" value={termMonthsStr} onChange={e => setTermMonthsStr(e.target.value)} placeholder="VD: 6" className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary font-bold text-dark" />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Ngày gửi</label>
                                <input type="date" value={startDateStr} onChange={e => setStartDateStr(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary font-bold text-dark" required />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Ngày đến hạn</label>
                                <input type="date" value={maturityDateStr} onChange={e => setMaturityDateStr(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary font-bold text-dark" />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Ghi chú thêm</label>
                                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Nhập ghi chú cho sổ này..." rows={2} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-dark resize-y leading-relaxed" />
                            </div>

                            <div className="sm:col-span-2 mt-2">
                                <label className="block text-xs font-black text-slate-500 uppercase mb-2">Trạng thái Sổ</label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 flex items-center justify-center py-3 rounded-xl border-2 cursor-pointer transition-colors ${status === 'active' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                                        <input type="radio" name="status" value="active" checked={status === 'active'} onChange={() => setStatus('active')} className="sr-only" />
                                        <CheckCircle2 size={18} className="mr-2" />
                                        <span className="font-black uppercase text-sm">Đang Gửi</span>
                                    </label>
                                    <label className={`flex-1 flex items-center justify-center py-3 rounded-xl border-2 cursor-pointer transition-colors ${status === 'closed' ? 'bg-slate-200 border-slate-400 text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                                        <input type="radio" name="status" value="closed" checked={status === 'closed'} onChange={() => setStatus('closed')} className="sr-only" />
                                        <Archive size={18} className="mr-2" />
                                        <span className="font-black uppercase text-sm">Đã Tất Toán</span>
                                    </label>
                                </div>
                            </div>

                            {error && <div className="sm:col-span-2 text-red-500 text-sm font-bold bg-red-50 p-3 rounded-lg mt-2">{error}</div>}
                            
                            <div className="sm:col-span-2 flex justify-end space-x-3 mt-6 pt-6 border-t border-slate-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Hủy Bỏ</button>
                                <button type="submit" className="px-8 py-3 bg-primary text-white font-black uppercase tracking-wider rounded-xl hover:bg-primary-hover shadow-lg transition-all flex items-center">
                                    <PiggyBank size={18} className="mr-2" /> Lưu Thay Đổi
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <ConfirmationModal isOpen={isConfirmOpen} title="Xóa Sổ Tiết Kiệm" message={`Bạn có chắc muốn xóa sổ "${itemToDelete?.title}"? Dữ liệu này sẽ không thể khôi phục.`} onConfirm={async () => { if(itemToDelete) await deleteDoc(doc(db, "savings", itemToDelete.id)); setIsConfirmOpen(false); }} onCancel={() => setIsConfirmOpen(false)} confirmText="Xóa Sổ" cancelText="Hủy" />
        </div>
    );
};
export default SavingsManagement;
