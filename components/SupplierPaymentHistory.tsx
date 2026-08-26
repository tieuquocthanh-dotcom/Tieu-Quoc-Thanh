import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Loader, Wallet, History, ArrowUpRight, ArrowDownLeft, Building, CreditCard, Clock, X, Eye, FileText, ChevronRight, Info } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import Pagination from './Pagination';
import { GoodsReceipt } from '../types';
import { PaymentDetailOrderViewModal } from './PaymentDetailOrderViewModal';

interface PaymentLog {
    id: string;
    paymentMethodId: string;
    paymentMethodName: string;
    type: 'deposit' | 'withdraw';
    amount: number;
    balanceAfter: number;
    note: string;
    relatedId?: string;
    relatedIds?: string[];
    relatedType?: string;
    createdAt: Timestamp;
    creatorName: string;
    supplierBankAccountId?: string;
    supplierBankDetails?: {
        bankName: string;
        accountNumber: string;
        accountName: string;
    };
}

const SupplierPaymentHistory: React.FC<{ userRole?: 'admin' | 'staff' | null }> = ({ userRole = 'admin' }) => {
    const [logs, setLogs] = useState<PaymentLog[]>([]);
    const [allReceipts, setAllReceipts] = useState<GoodsReceipt[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLogs, setSelectedLogs] = useState<string[]>([]);
    
    // Modal state for viewing corresponding order / receipts
    const [selectedLogForDetail, setSelectedLogForDetail] = useState<PaymentLog | null>(null);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

    useEffect(() => {
        // Fetch all goodsReceipts to quickly match orders for any payment
        const unsubReceipts = onSnapshot(collection(db, 'goodsReceipts'), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as GoodsReceipt));
            setAllReceipts(data);
        });

        // We fetch 'withdraw' logs which are usually payments to suppliers.
        const q = query(
            collection(db, 'paymentLogs'),
            orderBy('createdAt', 'desc')
        );

        const unsubLogs = onSnapshot(q, (snapshot) => {
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

        return () => {
            unsubReceipts();
            unsubLogs();
        };
    }, []);

    const filteredLogs = logs.filter(log => 
        (log.note || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.paymentMethodName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.creatorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.id || '').toLowerCase().includes(searchTerm.toLowerCase())
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

    const handleOpenOrderDetails = (log: PaymentLog, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedLogForDetail(log);
        setIsOrderModalOpen(true);
    };

    const selectedTotal = selectedLogs.reduce((acc, currentId) => {
        const log = logs.find(l => l.id === currentId);
        return acc + (log?.amount || 0);
    }, 0);

    return (
        <div className="pb-24 animate-fade-in relative h-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-dark flex items-center uppercase tracking-tighter">
                        <History className="mr-3 text-primary" size={32}/> Truy Vết Trả Tiền NCC
                    </h1>
                    <p className="text-xs text-slate-500 font-bold mt-1">
                        Tra cứu lịch sử chi tiền và nhấp vào giao dịch để xem chính xác đơn hàng / phiếu nhập đã thanh toán
                    </p>
                </div>
                
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
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-4 flex-wrap">
                    <div className="relative flex-1 max-w-md">
                        <input 
                            type="text" 
                            placeholder="Tìm theo nội dung, tài khoản, người tạo, mã GD..." 
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none text-sm font-medium"
                        />
                    </div>
                    <div className="flex items-center text-xs text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 font-bold">
                        <Info size={14} className="mr-1.5 text-indigo-600 shrink-0" />
                        Mẹo: Bấm trực tiếp vào dòng hoặc nút "Xem đơn hàng" để mở chi tiết phiếu nhập
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 border-b border-slate-200">
                            <tr className="text-[10px] font-black text-slate-500 uppercase tracking-tight">
                                <th className="px-4 py-3 w-10 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-slate-300 text-primary w-5 h-5 cursor-pointer focus:ring-primary"
                                        checked={paginatedLogs.length > 0 && paginatedLogs.every(log => selectedLogs.includes(log.id))}
                                        onChange={handleToggleSelectAll}
                                    />
                                </th>
                                <th className="px-4 py-3">Thời gian</th>
                                <th className="px-4 py-3">Tài khoản trả</th>
                                <th className="px-4 py-3">Ngân hàng nhận (NCC)</th>
                                <th className="px-4 py-3">Nội dung chi</th>
                                <th className="px-4 py-3">Người tạo</th>
                                <th className="px-4 py-3 text-right">Số tiền</th>
                                <th className="px-4 py-3 text-center">Đơn hàng</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={8} className="p-8 text-center"><Loader className="animate-spin text-primary mx-auto" size={24}/></td></tr>
                            ) : paginatedLogs.length === 0 ? (
                                <tr><td colSpan={8} className="p-8 text-center text-slate-400 font-medium">Không tìm thấy lịch sử thanh toán nào.</td></tr>
                            ) : (
                                paginatedLogs.map(log => (
                                    <tr 
                                        key={log.id} 
                                        className={`transition-colors cursor-pointer group ${selectedLogs.includes(log.id) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                                        onClick={() => handleOpenOrderDetails(log)}
                                        title="Bấm để xem chi tiết đơn hàng đã trả"
                                    >
                                        <td className="px-4 py-4 text-center" onClick={e => e.stopPropagation()}>
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-slate-300 text-primary w-5 h-5 cursor-pointer focus:ring-primary"
                                                checked={selectedLogs.includes(log.id)}
                                                onChange={() => handleToggleSelectRow(log.id)}
                                            />
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center text-slate-600 font-medium text-xs">
                                                <Clock size={14} className="mr-2 text-slate-400 shrink-0"/>
                                                {log.createdAt?.toDate?.()?.toLocaleString('vi-VN') || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="inline-flex items-center px-2 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-black uppercase tracking-tight shadow-xs">
                                                <CreditCard size={12} className="mr-1 text-sky-600 shrink-0"/> {log.paymentMethodName || 'Không xác định'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            {log.supplierBankDetails ? (
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 text-xs">{log.supplierBankDetails.bankName}</span>
                                                    <span className="text-[10px] text-slate-500 font-mono font-semibold">{log.supplierBankDetails.accountNumber}</span>
                                                    <span className="text-[9px] font-black uppercase text-slate-400">{log.supplierBankDetails.accountName}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] italic text-slate-400">Không có</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-4 max-w-xs">
                                            <p className="font-bold text-dark text-xs group-hover:text-indigo-600 transition-colors line-clamp-2">
                                                {log.note || 'Không có nội dung'}
                                            </p>
                                        </td>
                                        <td className="px-4 py-4 text-slate-500 font-medium text-xs whitespace-nowrap">{log.creatorName}</td>
                                        <td className="px-4 py-4 text-right whitespace-nowrap">
                                            <span className="font-black text-red-600 text-sm">
                                                -{formatNumber(log.amount)} ₫
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={(e) => handleOpenOrderDetails(log, e)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 rounded-xl text-xs font-black transition-all shadow-xs"
                                                title="Xem đơn hàng tương ứng"
                                            >
                                                <FileText size={13} />
                                                <span>Xem đơn</span>
                                                <ChevronRight size={12} className="opacity-70" />
                                            </button>
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

            {/* Modal for viewing order / receipt details */}
            <PaymentDetailOrderViewModal
                isOpen={isOrderModalOpen}
                onClose={() => {
                    setIsOrderModalOpen(false);
                    setSelectedLogForDetail(null);
                }}
                log={selectedLogForDetail}
                allReceipts={allReceipts}
                userRole={userRole}
            />
        </div>
    );
};

export default SupplierPaymentHistory;

