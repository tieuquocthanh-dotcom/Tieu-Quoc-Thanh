
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, where, updateDoc, doc, serverTimestamp, Timestamp, arrayUnion, writeBatch, increment, getDocs, orderBy, runTransaction } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { Sale, GoodsReceipt, PaymentMethod } from '../types';
import { Loader, Search, ArrowUpRight, ArrowDownLeft, Wallet, Package, Users, Building, Eye, X, Calendar, CheckCircle, AlertTriangle, Clock, CreditCard, CheckCheck, Square, CheckSquare, User } from 'lucide-react';
import { formatNumber, parseNumber } from '../utils/formatting';
import Pagination from './Pagination';
import SaleDetailModal from './SaleDetailModal';
import GoodsReceiptDetailModal from './GoodsReceiptDetailModal';

type DebtTab = 'receivables' | 'payables';

interface DebtorSummary {
    id: string;
    name: string;
    phone?: string; 
    contactPerson?: string; 
    totalDebt: number;
    count: number;
    items: (Sale | GoodsReceipt)[];
}

const getTodayString = () => new Date().toISOString().split('T')[0];

const PayBulkModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (date: string, amount: number, note: string, paymentMethodId: string) => void;
    totalAmount: number;
    count: number;
    debtorName: string;
    isProcessing: boolean;
    type: 'receivables' | 'payables';
    paymentMethods: PaymentMethod[];
}> = ({ isOpen, onClose, onConfirm, totalAmount, count, debtorName, isProcessing, type, paymentMethods }) => {
    const [paymentDate, setPaymentDate] = useState(getTodayString());
    const [payAmount, setPayAmount] = useState(0);
    const [selectedMethodId, setSelectedMethodId] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (isOpen) {
            setPaymentDate(getTodayString());
            setPayAmount(totalAmount);
            setSelectedMethodId('');
            setNote(type === 'receivables' ? `Thu hồi nợ các đơn đã chọn từ ${debtorName}` : `Thanh toán nợ các phiếu đã chọn cho ${debtorName}`);
        }
    }, [isOpen, type, debtorName, totalAmount]);

    if (!isOpen) return null;

    const isReceivable = type === 'receivables';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] p-4 animate-fade-in">
            <div className="bg-white p-0 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-down overflow-hidden border-4 border-slate-800">
                <div className={`flex justify-between items-center p-4 border-b-2 border-slate-800 ${isReceivable ? 'bg-green-100' : 'bg-orange-100'}`}>
                    <h3 className="text-sm font-black text-black uppercase flex items-center">
                        <CheckCheck className="mr-2" size={18} />
                        {isReceivable ? 'Xác nhận thu hồi nợ gộp' : 'Xác nhận trả nợ gộp'}
                    </h3>
                    <button onClick={onClose} className="text-black hover:text-red-500 transition-colors"><X size={24} /></button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200 mb-6 text-center shadow-inner">
                        <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Đối tác: {debtorName}</p>
                        <p className="text-[10px] text-slate-500 font-black uppercase">Đang chọn {count} mục</p>
                        <div className="flex justify-between items-center mt-2 border-t-2 border-slate-200 pt-2">
                            <span className="text-xs font-black text-slate-500 uppercase">Tổng nợ:</span>
                            <span className={`text-xl font-black ${isReceivable ? 'text-blue-700' : 'text-red-600'}`}>
                                {formatNumber(totalAmount)} ₫
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Phương thức thanh toán</label>
                            <select 
                                value={selectedMethodId}
                                onChange={(e) => setSelectedMethodId(e.target.value)}
                                className="w-full px-3 py-3 border-2 border-slate-800 rounded-xl font-black focus:ring-2 focus:ring-primary outline-none bg-white text-black"
                            >
                                <option value="">-- Chọn tài khoản --</option>
                                {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Số tiền thanh toán</label>
                            <input 
                                type="text" inputMode="numeric"
                                value={formatNumber(payAmount)} 
                                onChange={(e) => setPayAmount(Math.min(parseNumber(e.target.value), totalAmount))} 
                                onFocus={(e) => e.target.select()}
                                className="w-full px-4 py-3 bg-slate-900 text-white border-2 border-slate-800 rounded-xl font-black text-2xl text-right focus:border-primary outline-none shadow-inner"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Ngày thanh toán</label>
                            <input 
                                type="date" 
                                value={paymentDate} 
                                onChange={(e) => setPaymentDate(e.target.value)} 
                                className="w-full px-3 py-3 border-2 border-slate-800 rounded-xl font-black focus:ring-2 focus:ring-primary outline-none"
                                style={{ colorScheme: 'light' }}
                            />
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-slate-50 flex gap-3 border-t-2 border-slate-800">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-3 bg-white border-2 border-slate-800 text-black rounded-xl font-black text-xs uppercase hover:bg-slate-100 transition active:scale-95"
                        disabled={isProcessing}
                    >
                        Hủy
                    </button>
                    <button 
                        onClick={() => onConfirm(paymentDate, payAmount, note, selectedMethodId)} 
                        className={`flex-1 py-3 text-white rounded-xl font-black text-xs uppercase shadow-lg transition active:scale-95 flex items-center justify-center ${isReceivable ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'} disabled:bg-slate-300 disabled:shadow-none`}
                        disabled={isProcessing || !selectedMethodId || payAmount <= 0}
                    >
                        {isProcessing ? <Loader size={18} className="animate-spin mr-2"/> : <CheckCheck size={18} className="mr-2"/>}
                        {isReceivable ? 'Xác nhận thu' : 'Xác nhận trả'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PartialPaymentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (date: string, amount: number, note: string, paymentMethodId: string) => void;
    data: { item: Sale | GoodsReceipt, type: 'sale' | 'receipt' } | null;
    isProcessing: boolean;
    paymentMethods: PaymentMethod[];
}> = ({ isOpen, onClose, onConfirm, data, isProcessing, paymentMethods }) => {
    const [paymentDate, setPaymentDate] = useState(getTodayString());
    const [payAmount, setPayAmount] = useState(0);
    const [selectedMethodId, setSelectedMethodId] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (isOpen && data) {
            setPaymentDate(getTodayString());
            setSelectedMethodId('');
            const item = data.item as any;
            const remaining = item.total - (item.amountPaid || 0);
            setPayAmount(remaining > 0 ? remaining : 0);
            setNote('');
        }
    }, [isOpen, data]);

    if (!isOpen || !data) return null;

    const { item, type } = data;
    const isSale = type === 'sale';
    const anyItem = item as any;
    const remainingDebt = item.total - (anyItem.amountPaid || 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] p-4 animate-fade-in">
            <div className="bg-white p-0 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in-down overflow-hidden border-4 border-slate-800 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b-2 border-slate-800 bg-slate-100">
                    <h3 className="text-sm font-black text-black uppercase flex items-center">
                        <CreditCard className="mr-2 text-primary" size={18} />
                        Thanh toán nợ phiếu
                    </h3>
                    <button onClick={onClose} className="text-black hover:text-red-500"><X size={24} /></button>
                </div>

                <div className="p-5 overflow-y-auto">
                    <div className="bg-slate-50 p-3 rounded-xl border-2 border-slate-200 mb-4 text-xs">
                        <div className="flex justify-between mb-1"><span className="text-slate-500 font-black uppercase">Mã phiếu:</span><span className="font-black">#{item.id.substring(0,8)}</span></div>
                        <div className="flex justify-between mb-1"><span className="text-slate-500 font-black uppercase">{isSale ? 'Khách hàng:' : 'Nhà cung cấp:'}</span><span className="font-black">{anyItem.customerName || anyItem.supplierName}</span></div>
                        <div className="border-t-2 border-slate-200 my-2 pt-2 space-y-1">
                            <div className="flex justify-between"><span className="text-slate-500 font-black uppercase">Tổng giá trị:</span><span className="font-bold">{formatNumber(item.total)} ₫</span></div>
                            <div className="flex justify-between font-black text-red-600 pt-1"><span>CÒN NỢ:</span><span className="text-lg">{formatNumber(remainingDebt)} ₫</span></div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Phương thức thanh toán</label>
                            <select 
                                value={selectedMethodId}
                                onChange={(e) => setSelectedMethodId(e.target.value)}
                                className="w-full px-3 py-3 border-2 border-slate-300 rounded-xl font-black focus:ring-2 focus:ring-primary outline-none bg-white text-black"
                            >
                                <option value="">-- Chọn tài khoản --</option>
                                {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Số tiền thanh toán</label>
                            <input 
                                type="text" inputMode="numeric"
                                value={formatNumber(payAmount)} 
                                onChange={(e) => setPayAmount(Math.min(parseNumber(e.target.value), remainingDebt))} 
                                onFocus={(e) => e.target.select()}
                                className="w-full px-4 py-3 bg-slate-900 text-white border-2 border-slate-800 rounded-xl font-black text-2xl text-right focus:border-primary outline-none shadow-inner"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Ngày ghi nhận</label>
                            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg font-bold outline-none focus:border-primary" style={{ colorScheme: 'light' }}/>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t-2 border-slate-800 flex gap-2">
                    <button onClick={onClose} className="flex-1 py-3 bg-white border-2 border-slate-800 rounded-xl font-black text-xs uppercase text-black" disabled={isProcessing}>Hủy</button>
                    <button onClick={() => onConfirm(paymentDate, payAmount, note, selectedMethodId)} className="flex-1 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg disabled:bg-slate-300 disabled:shadow-none" disabled={isProcessing || payAmount <= 0 || !selectedMethodId}>
                        {isProcessing ? <Loader size={18} className="animate-spin" /> : 'Xác nhận'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const DebtManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<DebtTab>('receivables');
    const [salesDebt, setSalesDebt] = useState<Sale[]>([]);
    const [receiptsDebt, setReceiptsDebt] = useState<GoodsReceipt[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
    const searchDropdownRef = useRef<HTMLDivElement>(null);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentItem, setPaymentItem] = useState<{ item: Sale | GoodsReceipt, type: 'sale' | 'receipt' } | null>(null);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [isPayBulkModalOpen, setIsPayBulkModalOpen] = useState(false);
    const [isProcessingBulk, setIsProcessingBulk] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [isSaleDetailOpen, setIsSaleDetailOpen] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceipt | null>(null);
    const [isReceiptDetailOpen, setIsReceiptDetailOpen] = useState(false);

    useEffect(() => {
        setLoading(true);
        let salesLoaded = false;
        let receiptsLoaded = false;

        const checkLoading = () => {
            if (salesLoaded && receiptsLoaded) {
                setLoading(false);
            }
        };

        const qSales = query(collection(db, 'sales'), where('status', '==', 'debt'));
        const unsubSales = onSnapshot(qSales, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
            data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setSalesDebt(data);
            salesLoaded = true;
            checkLoading();
        }, (err) => {
            console.error("Error fetching sales debt:", err);
            salesLoaded = true;
            checkLoading();
        });

        const qReceipts = query(collection(db, 'goodsReceipts'), where('paymentStatus', '==', 'debt'));
        const unsubReceipts = onSnapshot(qReceipts, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GoodsReceipt));
            data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setReceiptsDebt(data);
            receiptsLoaded = true;
            checkLoading();
        }, (err) => {
            console.error("Error fetching receipts debt:", err);
            receiptsLoaded = true;
            checkLoading();
        });

        const unsubMethods = onSnapshot(query(collection(db, "paymentMethods"), orderBy("name")), (snap) => {
            setPaymentMethods(snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod)));
        });

        const handleClickOutside = (e: MouseEvent) => {
            if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
                setIsSearchDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => { unsubSales(); unsubReceipts(); unsubMethods(); document.removeEventListener('mousedown', handleClickOutside); };
    }, []);

    useEffect(() => {
        setSelectedIds(new Set());
        setCurrentPage(1);
    }, [activeTab, searchTerm]);

    const currentSummary = useMemo(() => {
        const summaryMap = new Map<string, DebtorSummary>();
        const dataList = activeTab === 'receivables' ? salesDebt : receiptsDebt;
        
        dataList.forEach(item => {
            const anyItem = item as any;
            const id = activeTab === 'receivables' ? (anyItem.customerId || 'guest') : (anyItem.supplierId || 'unknown');
            const name = activeTab === 'receivables' ? (anyItem.customerName || 'Khách vãng lai') : (anyItem.supplierName || 'Nhà cung cấp không tên');
            
            if (!summaryMap.has(id)) {
                summaryMap.set(id, { id, name, totalDebt: 0, count: 0, items: [] });
            }
            const current = summaryMap.get(id)!;
            const remaining = item.total - (anyItem.amountPaid || 0);
            if (remaining > 0) {
                current.totalDebt += remaining;
                current.count += 1;
                current.items.push(item);
            }
        });

        return Array.from(summaryMap.values())
            .filter(item => item.totalDebt > 0);
    }, [salesDebt, receiptsDebt, activeTab]);

    const filteredSummary = useMemo(() => {
        return currentSummary.filter(item => (item.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()));
    }, [currentSummary, searchTerm]);

    const paginatedList = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredSummary.slice(startIndex, startIndex + pageSize);
    }, [filteredSummary, currentPage, pageSize]);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectDebtor = (debtor: DebtorSummary) => {
        const itemIds = debtor.items.map(i => i.id);
        const allSelected = itemIds.every(id => selectedIds.has(id));
        const newSet = new Set(selectedIds);
        if (allSelected) itemIds.forEach(id => newSet.delete(id));
        else itemIds.forEach(id => newSet.add(id));
        setSelectedIds(newSet);
    };

    const selectedItemsData = useMemo(() => {
        const list: (Sale | GoodsReceipt)[] = [];
        let total = 0;
        let debtorName = '';
        const dataList = activeTab === 'receivables' ? salesDebt : receiptsDebt;
        
        dataList.forEach(item => {
            if (selectedIds.has(item.id)) {
                list.push(item);
                const anyItem = item as any;
                total += (item.total - (anyItem.amountPaid || 0));
                if (!debtorName) debtorName = anyItem.customerName || anyItem.supplierName;
            }
        });

        return { items: list, total, debtorName, count: list.length };
    }, [selectedIds, activeTab, salesDebt, receiptsDebt]);

    const handleConfirmPayment = async (dateString: string, amount: number, note: string, paymentMethodId: string) => {
        if (!paymentItem) return;
        setIsProcessingPayment(true);
        try {
            const dateObj = new Date(dateString);
            const now = new Date();
            dateObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
            const ts = Timestamp.fromDate(dateObj);

            const { item, type } = paymentItem;
            const isSale = type === 'sale';
            const method = paymentMethods.find(m => m.id === paymentMethodId);

            await runTransaction(db, async (transaction) => {
                const accRef = doc(db, 'paymentMethods', paymentMethodId);
                const accSnap = await transaction.get(accRef);
                if (!accSnap.exists()) throw "Account not found";

                const currentBal = accSnap.data().balance || 0;
                const finalBal = isSale ? currentBal + amount : currentBal - amount;

                const ref = doc(db, isSale ? 'sales' : 'goodsReceipts', item.id);
                const anyItem = item as any;
                const newPaid = (anyItem.amountPaid || 0) + amount;
                const isFull = newPaid >= item.total;

                transaction.update(ref, {
                    [isSale ? 'status' : 'paymentStatus']: isFull ? 'paid' : 'debt',
                    amountPaid: newPaid,
                    paidAt: isFull ? ts : (anyItem.paidAt || null),
                    paymentHistory: arrayUnion({ 
                        date: ts, 
                        amount: amount, 
                        note: note || (isSale ? 'Khách trả nợ' : 'Trả nợ NCC'),
                        paymentMethodId: paymentMethodId,
                        paymentMethodName: method?.name || 'N/A'
                    })
                });

                transaction.update(accRef, { balance: finalBal });

                const logRef = doc(collection(db, 'paymentLogs'));
                const partnerName = anyItem.customerName || anyItem.supplierName;
                const formattedDate = dateObj.toLocaleDateString('vi-VN');
                const shortId = item.id.substring(0, 8).toUpperCase();
                
                const autoNote = isSale 
                    ? `Khách hàng ${partnerName} thanh toán đơn hàng_ ${shortId}_ ${formattedDate}`
                    : `Thanh toán nợ cho nhà cung cấp ${partnerName}_ theo mã ${shortId}_ ${formattedDate}`;

                transaction.set(logRef, {
                    paymentMethodId,
                    paymentMethodName: method?.name || 'N/A',
                    type: isSale ? 'deposit' : 'withdraw',
                    amount: amount,
                    balanceAfter: finalBal,
                    note: autoNote,
                    relatedId: item.id,
                    relatedType: isSale ? 'sale' : 'receipt',
                    createdAt: ts,
                    createdBy: auth.currentUser?.uid || null,
                    creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'N/A'
                });
            });

            setIsPaymentModalOpen(false);
            setPaymentItem(null);
        } catch (err) { 
            console.error(err);
            alert("Lỗi cập nhật."); 
        } finally { 
            setIsProcessingPayment(false); 
        }
    };

    const handleConfirmBulkPayment = async (dateString: string, amount: number, note: string, paymentMethodId: string) => {
        if (selectedIds.size === 0 || !paymentMethodId || amount <= 0) return;
        setIsProcessingBulk(true);
        try {
            const dateObj = new Date(dateString);
            const now = new Date();
            dateObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
            const ts = Timestamp.fromDate(dateObj);
            const isReceivable = activeTab === 'receivables';
            const method = paymentMethods.find(m => m.id === paymentMethodId);

            await runTransaction(db, async (transaction) => {
                const accRef = doc(db, 'paymentMethods', paymentMethodId);
                const accSnap = await transaction.get(accRef);
                if (!accSnap.exists()) throw "Account not found";

                const currentBal = accSnap.data().balance || 0;
                const partnerName = selectedItemsData.debtorName;

                const sortedItems = [...selectedItemsData.items].sort((a, b) => {
                    const timeA = a.createdAt?.toMillis() || 0;
                    const timeB = b.createdAt?.toMillis() || 0;
                    return timeA - timeB;
                });

                let remainingAmountToDistribute = amount;
                let actuallyPaidTotal = 0;

                for (const item of sortedItems) {
                    if (remainingAmountToDistribute <= 0) break;

                    const anyItem = item as any;
                    const itemRemainingDebt = item.total - (anyItem.amountPaid || 0);
                    
                    if (itemRemainingDebt <= 0) continue;

                    const payForThisItem = Math.min(itemRemainingDebt, remainingAmountToDistribute);
                    
                    const ref = doc(db, isReceivable ? 'sales' : 'goodsReceipts', item.id);
                    const newPaid = (anyItem.amountPaid || 0) + payForThisItem;
                    const isFull = newPaid >= item.total;

                    transaction.update(ref, {
                        [isReceivable ? 'status' : 'paymentStatus']: isFull ? 'paid' : 'debt',
                        amountPaid: newPaid,
                        paidAt: isFull ? ts : (anyItem.paidAt || null),
                        paymentHistory: arrayUnion({ 
                            date: ts, 
                            amount: payForThisItem, 
                            note: note,
                            paymentMethodId: paymentMethodId,
                            paymentMethodName: method?.name || 'N/A'
                        })
                    });

                    remainingAmountToDistribute -= payForThisItem;
                    actuallyPaidTotal += payForThisItem;
                }

                const finalBal = isReceivable ? currentBal + actuallyPaidTotal : currentBal - actuallyPaidTotal;
                transaction.update(accRef, { balance: finalBal });

                const logRef = doc(collection(db, 'paymentLogs'));
                const formattedDate = dateObj.toLocaleDateString('vi-VN');
                const bulkAutoNote = isReceivable 
                    ? `Khách hàng ${partnerName} thanh toán nợ GỘP (${selectedIds.size} đơn)_ ${formattedDate}`
                    : `Thanh toán nợ GỘP (${selectedIds.size} phiếu) cho nhà cung cấp ${partnerName}_ ${formattedDate}`;

                transaction.set(logRef, {
                    paymentMethodId,
                    paymentMethodName: method?.name || 'N/A',
                    type: isReceivable ? 'deposit' : 'withdraw',
                    amount: actuallyPaidTotal,
                    balanceAfter: finalBal,
                    note: bulkAutoNote,
                    createdAt: ts,
                    createdBy: auth.currentUser?.uid || null,
                    creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'N/A'
                });
            });

            setSelectedIds(new Set());
            setIsPayBulkModalOpen(false);
            alert("Đã thanh toán thành công!");
        } catch (err) { 
            console.error(err);
            alert("Lỗi thanh toán hàng loạt."); 
        } finally { 
            setIsProcessingBulk(false); 
        }
    };

    const handleViewDetail = (item: any) => {
        if (activeTab === 'receivables') {
            setSelectedSale(item as Sale);
            setIsSaleDetailOpen(true);
        } else {
            setSelectedReceipt(item as GoodsReceipt);
            setIsReceiptDetailOpen(true);
        }
    };

    const handleOpenPaymentModal = (item: any, type: 'sale' | 'receipt') => {
        setPaymentItem({ item, type });
        setIsPaymentModalOpen(true);
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setCurrentPage(1);
    };

    return (
        <div className="pb-24 animate-fade-in">
            <SaleDetailModal isOpen={isSaleDetailOpen} onClose={() => setIsSaleDetailOpen(false)} sale={selectedSale} userRole="admin" />
            <GoodsReceiptDetailModal isOpen={isReceiptDetailOpen} onClose={() => setIsReceiptDetailOpen(false)} receipt={selectedReceipt} userRole="admin" />
            
            <PartialPaymentModal 
                isOpen={isPaymentModalOpen} 
                onClose={() => setIsPaymentModalOpen(false)} 
                onConfirm={handleConfirmPayment} 
                data={paymentItem} 
                isProcessing={isProcessingPayment}
                paymentMethods={paymentMethods}
            />
            
            <PayBulkModal 
                isOpen={isPayBulkModalOpen} 
                onClose={() => setIsPayBulkModalOpen(false)} 
                onConfirm={handleConfirmBulkPayment} 
                totalAmount={selectedItemsData.total} 
                count={selectedItemsData.count} 
                debtorName={selectedItemsData.debtorName} 
                isProcessing={isProcessingBulk}
                type={activeTab}
                paymentMethods={paymentMethods}
            />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-black text-dark flex items-center uppercase tracking-tighter">
                    <Wallet className="mr-3 text-primary" size={32}/> Quản Lý Công Nợ
                </h1>
                <div className="flex items-center gap-2 p-1 bg-white rounded-xl border-2 border-slate-200">
                    <button onClick={() => setActiveTab('receivables')} className={`px-4 py-2 rounded-lg font-black text-xs uppercase transition-all ${activeTab === 'receivables' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Phải Thu (Khách)</button>
                    <button onClick={() => setActiveTab('payables')} className={`px-4 py-2 rounded-lg font-black text-xs uppercase transition-all ${activeTab === 'payables' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Phải Trả (NCC)</button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-md border-2 border-slate-200 mb-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="relative flex-1 w-full" ref={searchDropdownRef}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                        <input 
                            type="text" 
                            placeholder={activeTab === 'receivables' ? "Tìm kiếm khách hàng..." : "Tìm kiếm nhà cung cấp..."} 
                            value={searchTerm} 
                            onChange={e => {setSearchTerm(e.target.value); setIsSearchDropdownOpen(true);}} 
                            onFocus={() => setIsSearchDropdownOpen(true)}
                            className="w-full pl-10 pr-4 py-3 border-2 border-slate-100 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none font-black text-sm uppercase" 
                        />
                        {isSearchDropdownOpen && searchTerm && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-800 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto overflow-x-hidden">
                                {currentSummary.filter(d => (d.name || '').toLowerCase().includes((searchTerm || '').toLowerCase())).length === 0 ? (
                                    <div className="p-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">Không có dữ liệu</div>
                                ) : (
                                    currentSummary.filter(d => (d.name || '').toLowerCase().includes((searchTerm || '').toLowerCase())).map(d => (
                                        <button 
                                            key={d.id} 
                                            onClick={() => {setSearchTerm(d.name || ''); setIsSearchDropdownOpen(false);}}
                                            className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 flex justify-between items-center group transition-colors"
                                        >
                                            <div className="flex items-center">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3 group-hover:bg-primary transition-colors">
                                                    {activeTab === 'receivables' ? <User size={16} className="text-slate-500 group-hover:text-white"/> : <Building size={16} className="text-slate-500 group-hover:text-white"/>}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-black text-black uppercase">{d.name}</div>
                                                    <div className="text-[10px] font-bold text-slate-400">{d.count} phiếu nợ</div>
                                                </div>
                                            </div>
                                            <div className="text-sm font-black text-primary">{formatNumber(d.totalDebt)} ₫</div>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                    <div className={`p-4 rounded-xl border-2 flex flex-col items-end min-w-[220px] ${activeTab === 'receivables' ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
                        <p className="text-[10px] font-black text-slate-500 uppercase">{activeTab === 'receivables' ? 'Tổng khách nợ' : 'Tổng nợ nhà CC'}</p>
                        <p className={`text-2xl font-black ${activeTab === 'receivables' ? 'text-blue-700' : 'text-red-600'}`}>{formatNumber(currentSummary.reduce((a,c)=>a+c.totalDebt,0))} ₫</p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {loading ? (
                    <div className="flex justify-center items-center py-20"><Loader className="animate-spin text-primary" size={40} /></div>
                ) : filteredSummary.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border-4 border-dashed border-slate-100">
                        <Package size={60} className="mx-auto mb-4 text-slate-200"/>
                        <p className="font-black text-slate-300 uppercase tracking-widest">Không có dữ liệu công nợ</p>
                    </div>
                ) : (
                    paginatedList.map(debtor => (
                        <div key={debtor.id} className="bg-white border-2 border-slate-800 rounded-2xl overflow-hidden shadow-[4px_4px_0px_#0f172a]">
                            <div className="bg-slate-800 p-4 flex flex-col md:flex-row justify-between items-start md:items-center text-white">
                                <div className="flex items-center">
                                    <button onClick={() => toggleSelectDebtor(debtor)} className="mr-3 hover:scale-110 transition-transform">
                                        {debtor.items.every(i => selectedIds.has(i.id)) ? <CheckSquare size={24} className="text-primary"/> : <Square size={24} className="text-white/30"/>}
                                    </button>
                                    <div>
                                        <h3 className="font-black text-lg uppercase tracking-tight leading-none">{debtor.name}</h3>
                                        <p className="text-[10px] font-bold text-white/50 uppercase mt-1">{debtor.count} phiếu nợ {debtor.phone && `• SĐT: ${debtor.phone}`}</p>
                                    </div>
                                </div>
                                <div className="text-right mt-2 md:mt-0">
                                    <div className="text-[10px] font-bold text-white/50 uppercase">Tổng nợ đối tác</div>
                                    <div className="text-xl font-black text-yellow-400 leading-none">{formatNumber(debtor.totalDebt)} ₫</div>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b-2 border-slate-100">
                                        <tr className="text-[10px] font-black text-slate-500 uppercase">
                                            <th className="px-4 py-3 w-10"></th>
                                            <th className="px-4 py-3">Mã phiếu</th>
                                            <th className="px-4 py-3">Ngày tạo</th>
                                            <th className="px-4 py-3 text-right">Tổng tiền</th>
                                            <th className="px-4 py-3 text-right text-blue-600">Đã trả</th>
                                            <th className="px-4 py-3 text-right text-red-600">CÒN NỢ</th>
                                            <th className="px-4 py-3 text-center">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {debtor.items.map((item: any) => {
                                            const remaining = item.total - (item.amountPaid || 0);
                                            const isSelected = selectedIds.has(item.id);
                                            return (
                                                <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                                    <td className="px-4 py-3">
                                                        <button onClick={() => toggleSelection(item.id)} className="hover:scale-110 transition-transform">
                                                            {isSelected ? <CheckSquare size={20} className="text-primary"/> : <Square size={20} className="text-slate-300"/>}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-black uppercase">#{item.id.substring(0, 8)}</td>
                                                    <td className="px-4 py-3 text-slate-500 font-medium">{item.createdAt?.toDate().toLocaleDateString('vi-VN')}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-slate-400">{formatNumber(item.total)}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-blue-600">{formatNumber(item.amountPaid || 0)}</td>
                                                    <td className="px-4 py-3 text-right font-black text-red-600">{formatNumber(remaining)}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={() => handleViewDetail(item)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-primary hover:text-white rounded-lg transition" title="Xem chi tiết"><Eye size={16} /></button>
                                                            <button onClick={() => handleOpenPaymentModal(item, activeTab === 'receivables' ? 'sale' : 'receipt')} className="p-1.5 bg-slate-100 hover:bg-green-600 hover:text-white rounded-lg transition text-green-600" title="Trả tiền phiếu này"><CreditCard size={16}/></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-6">
                <Pagination currentPage={currentPage} pageSize={pageSize} totalItems={filteredSummary.length} onPageChange={setCurrentPage} onPageSizeChange={handlePageSizeChange} />
            </div>

            {/* SELECTION SUMMARY BAR (FLOATING) */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-40 animate-fade-in-up">
                    <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border-4 border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-primary/20 p-2 rounded-xl">
                                <CheckSquare size={32} className="text-primary" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">Đang chọn {selectedIds.size} đơn hàng</p>
                                <p className="text-2xl font-black text-white">{formatNumber(selectedItemsData.total)} <span className="text-xs font-black text-primary">₫</span></p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button onClick={() => setSelectedIds(new Set())} className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-xs uppercase transition">Hủy chọn</button>
                            <button 
                                onClick={() => setIsPayBulkModalOpen(true)}
                                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20 transition active:scale-95 flex items-center justify-center gap-2 ${activeTab === 'receivables' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                            >
                                <CheckCheck size={18}/>
                                {activeTab === 'receivables' ? 'Khách trả nợ' : 'Trả nợ NCC'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fade-in-up {
                    0% { opacity: 0; transform: translate(-50%, 20px); }
                    100% { opacity: 1; transform: translate(-50%, 0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default DebtManagement;
