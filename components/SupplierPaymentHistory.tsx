import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Loader, Wallet, History, ArrowUpRight, ArrowDownLeft, Building, CreditCard, Clock, X } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import Pagination from './Pagination';

interface PaymentLog {
    id: string;
    paymentMethodId: string;
    paymentMethodName: string;
    type: 'deposit' | 'withdraw';
    amount: number;
    balanceAfter: number;
    note: string;
    relatedId?: string;
    relatedType?: string;
    createdAt: Timestamp;
    creatorName: string;
}

const SupplierPaymentHistory: React.FC = () => {
    const [logs, setLogs] = useState<PaymentLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLogs, setSelectedLogs] = useState<string[]>([]);

    useEffect(() => {
        // We fetch 'withdraw' logs which are usually payments to suppliers.
        // We could also just fetch all logs and filter in memory if the index is missing.
        const q = query(
            collection(db, 'paymentLogs'),
            orderBy('createdAt', 'desc')
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentLog));
            // Filter only withdrawals (payments out) that mention NCC or supplier
            // Or just show all withdrawals as "Lịch sử chi tiền"
            const filtered = data.filter(d => 
                (d.type === 'withdraw' || (d.note && d.note.toLowerCase().includes('ncc')))
            );
            setLogs(filtered);
            setLoading(false);
        }, (err) => {
            console.error("Lỗi tải lịch sử dòng tiền NCC:", err);
            setLoading(false);
        });

        return () => unsub();
    }, []);

    const filteredLogs = logs.filter(log => 
        (log.note || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.paymentMethodName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.creatorName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handleToggleSelectAll = () => {
        if (selectedLogs.length === paginatedLogs.length && paginatedLogs.length > 0) {
            setSelectedLogs(prev => prev.filter(id => !paginatedLogs.find(l => l.id === id)));
        } else {
            const newSelected = [...selectedLogs];
            paginatedLogs.forEach(log => {
                if (!newSelected.includes(log.id)) {
                    newSelected.push(log.id);
                }
            });
            setSelectedLogs(newSelected);
        }
    };

    const handleToggleSelectRow = (id: string) => {
        setSelectedLogs(prev => 
            prev.includes(id) ? prev.filter(logId => logId !== id) : [...prev, id]
        );
    };

    const selectedTotal = selectedLogs.reduce((acc, currentId) => {
        const log = logs.find(l => l.id === currentId);
        return acc + (log?.amount || 0);
    }, 0);

    return (
        <div className="pb-24 animate-fade-in relative h-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-3xl font-black text-dark flex items-center uppercase tracking-tighter">
                    <History className="mr-3 text-primary" size={32}/> Truy Vết Trả Tiền NCC
                </h1>
                
                <div className="bg-white p-2 rounded-xl flex shadow-sm border border-slate-200">
                    <div className="px-4 py-2 text-center border-r border-slate-100">
                        <p className="text-[10px] text-slate-400 font-black uppercase">Tổng số GD</p>
                        <p className="text-sm font-black text-slate-700">{filteredLogs.length}</p>
                    </div>
                    <div className="px-4 py-2 text-center">
                        <p className="text-[10px] text-slate-400 font-black uppercase">Tổng tiền đã chi</p>
                        <p className="text-sm font-black text-red-600">
                            {formatNumber(filteredLogs.reduce((acc, curr) => acc + curr.amount, 0))} ₫
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center">
                    <div className="relative flex-1 max-w-md">
                        <input 
                            type="text" 
                            placeholder="Tìm theo nội dung, tài khoản, người tạo..." 
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none text-sm font-medium"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100">
                            <tr className="text-[10px] font-black text-slate-500 uppercase">
                                <th className="px-4 py-3 w-10 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-slate-300 text-primary w-5 h-5 cursor-pointer focus:ring-primary"
                                        checked={paginatedLogs.length > 0 && paginatedLogs.every(log => selectedLogs.includes(log.id))}
                                        onChange={handleToggleSelectAll}
                                    />
                                </th>
                                <th className="px-4 py-3">Thời gian</th>
                                <th className="px-4 py-3">Tài khoản</th>
                                <th className="px-4 py-3">Nội dung</th>
                                <th className="px-4 py-3">Người tạo</th>
                                <th className="px-4 py-3 text-right">Số tiền</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center"><Loader className="animate-spin text-primary mx-auto" size={24}/></td></tr>
                            ) : paginatedLogs.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-medium">Không tìm thấy lịch sử thanh toán nào.</td></tr>
                            ) : (
                                paginatedLogs.map(log => (
                                    <tr 
                                        key={log.id} 
                                        className={`transition-colors cursor-pointer ${selectedLogs.includes(log.id) ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                                        onClick={() => handleToggleSelectRow(log.id)}
                                    >
                                        <td className="px-4 py-4 text-center">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-slate-300 text-primary w-5 h-5 cursor-pointer focus:ring-primary"
                                                checked={selectedLogs.includes(log.id)}
                                                onChange={() => handleToggleSelectRow(log.id)}
                                                onClick={e => e.stopPropagation()} 
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center text-slate-600 font-medium">
                                                <Clock size={14} className="mr-2 text-slate-400"/>
                                                {log.createdAt?.toDate().toLocaleString('vi-VN')}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-[10px] font-black uppercase text-slate-600">
                                                <CreditCard size={12} className="mr-1"/> {log.paymentMethodName || 'Không xác định'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="font-bold text-dark">{log.note || 'Không có nội dung'}</p>
                                        </td>
                                        <td className="px-4 py-4 text-slate-500 font-medium">{log.creatorName}</td>
                                        <td className="px-4 py-4 text-right">
                                            <span className="font-black text-red-600">
                                                -{formatNumber(log.amount)} ₫
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Pagination 
                currentPage={currentPage}
                totalItems={filteredLogs.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
            />

            {selectedLogs.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-50 animate-fade-in border border-slate-700">
                    <div>
                        <div className="text-[10px] font-black uppercase text-slate-400">Đã chọn ({selectedLogs.length})</div>
                        <div className="text-xl font-black text-white">{formatNumber(selectedTotal)} ₫</div>
                    </div>
                    <button 
                        onClick={() => setSelectedLogs([])}
                        className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
                        title="Bỏ chọn tất cả"
                    >
                        <X size={20} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default SupplierPaymentHistory;
