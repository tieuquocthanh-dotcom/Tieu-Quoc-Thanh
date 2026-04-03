
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, updateDoc, doc, query, orderBy, addDoc, serverTimestamp, increment, where, limit, runTransaction, deleteDoc, getDoc, startAfter, limitToLast, endBefore, Timestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { PaymentMethod, PaymentLog, Sale, GoodsReceipt } from '../types';
import { Landmark, Save, Loader, Search, Wallet, Banknote, AlertCircle, PlusCircle, MinusCircle, X, History, User, Calendar, StickyNote, XCircle, ArrowUp, ArrowDown, ArrowUpDown, ArrowRightLeft, Trash2, Edit, Eye, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { formatNumber, parseNumber } from '../utils/formatting';
import SaleDetailModal from './SaleDetailModal';
import GoodsReceiptDetailModal from './GoodsReceiptDetailModal';
import ConfirmationModal from './ConfirmationModal';

type SortKey = 'name' | 'balance';
type SortDirection = 'asc' | 'desc';

// --- MODAL CHỈNH SỬA GIAO DỊCH NHẬT KÝ ---
const EditLogModal: React.FC<{
    isOpen: boolean;
    log: PaymentLog | null;
    onClose: () => void;
    onConfirm: (amount: number, note: string, date: string) => void;
    isSaving: boolean;
}> = ({ isOpen, log, onClose, onConfirm, isSaving }) => {
    const [amount, setAmount] = useState<number>(0);
    const [note, setNote] = useState<string>('');
    const [date, setDate] = useState<string>('');

    useEffect(() => {
        if (isOpen && log) {
            setAmount(log.amount);
            setNote(log.note || '');
            setDate(log.createdAt?.toDate().toISOString().split('T')[0] || '');
        }
    }, [isOpen, log]);

    if (!isOpen || !log) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[250] animate-fade-in p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-down border-4 border-slate-800 overflow-hidden">
                <div className="p-4 flex justify-between items-center text-white font-black uppercase text-sm bg-blue-600">
                    <div className="flex items-center">
                        <Edit className="mr-2" size={20}/>
                        Sửa giao dịch
                    </div>
                    <button onClick={onClose} className="hover:opacity-70 transition"><X size={24}/></button>
                </div>
                
                <div className="p-6 space-y-4 bg-slate-50">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Số tiền giao dịch</label>
                        <input 
                            type="text"
                            inputMode="numeric"
                            value={formatNumber(amount)} 
                            onChange={e => setAmount(parseNumber(e.target.value))}
                            className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl text-right font-black text-2xl focus:ring-2 focus:ring-primary outline-none bg-white text-black"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Ngày giao dịch</label>
                        <input 
                            type="date"
                            value={date} 
                            onChange={e => setDate(e.target.value)}
                            className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-primary outline-none bg-white text-black"
                            style={{ colorScheme: 'light' }}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Ghi chú</label>
                        <textarea 
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-primary outline-none bg-white text-black"
                        />
                    </div>
                </div>

                <div className="p-4 bg-white border-t border-slate-200 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition">Hủy</button>
                    <button 
                        onClick={() => onConfirm(amount, note, date)}
                        disabled={isSaving || amount < 0}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase shadow-lg transition active:scale-95 flex items-center justify-center"
                    >
                        {isSaving ? <Loader className="animate-spin mr-2" size={18}/> : <Check className="mr-2" size={18}/>}
                        Lưu thay đổi
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- MODAL CHỈNH SỬA SỐ DƯ TÀI KHOẢN ---
const EditBalanceModal: React.FC<{
    isOpen: boolean;
    account: PaymentMethod | null;
    onClose: () => void;
    onConfirm: (balance: number) => void;
    isSaving: boolean;
}> = ({ isOpen, account, onClose, onConfirm, isSaving }) => {
    const [balance, setBalance] = useState(0);

    useEffect(() => {
        if (isOpen && account) {
            setBalance(account.balance || 0);
        }
    }, [isOpen, account]);

    if (!isOpen || !account) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[250] animate-fade-in p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-down border-4 border-slate-800 overflow-hidden">
                <div className="p-4 flex justify-between items-center text-white font-black uppercase text-sm bg-slate-800">
                    <div className="flex items-center">
                        <Edit className="mr-2" size={20}/>
                        Sửa số dư tài khoản
                    </div>
                    <button onClick={onClose} className="hover:opacity-70 transition"><X size={24}/></button>
                </div>
                
                <div className="p-6 space-y-4 bg-slate-50">
                    <div className="p-3 bg-white rounded-xl border-2 border-slate-200">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Tài khoản</p>
                        <p className="text-lg font-black text-slate-800 uppercase">{account.name}</p>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Số dư mới</label>
                        <input 
                            type="text"
                            inputMode="numeric"
                            value={formatNumber(balance)} 
                            onChange={e => setBalance(parseNumber(e.target.value))}
                            className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl font-black text-2xl text-right focus:ring-2 focus:ring-primary outline-none bg-white text-black"
                        />
                    </div>
                </div>

                <div className="p-4 bg-white border-t border-slate-200 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition">Hủy</button>
                    <button 
                        onClick={() => onConfirm(balance)}
                        disabled={isSaving}
                        className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-black text-xs uppercase shadow-lg transition active:scale-95 flex items-center justify-center"
                    >
                        {isSaving ? <Loader className="animate-spin mr-2" size={18}/> : <Check className="mr-2" size={18}/>}
                        Lưu thay đổi
                    </button>
                </div>
            </div>
        </div>
    );
};

const TransactionModal: React.FC<{
    isOpen: boolean;
    type: 'deposit' | 'withdraw';
    account: PaymentMethod | null;
    onClose: () => void;
    onConfirm: (amount: number, note: string) => void;
    isSaving: boolean;
}> = ({ isOpen, type, account, onClose, onConfirm, isSaving }) => {
    const [amount, setAmount] = useState<number>(0);
    const [note, setNote] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            setAmount(0);
            setNote('');
        }
    }, [isOpen]);

    if (!isOpen || !account) return null;

    const isDeposit = type === 'deposit';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-down border-4 border-slate-800 flex flex-col overflow-hidden">
                <div className={`p-4 flex justify-between items-center text-white font-black uppercase text-sm ${isDeposit ? 'bg-green-600' : 'bg-red-600'}`}>
                    <div className="flex items-center">
                        {isDeposit ? <PlusCircle className="mr-2" size={20}/> : <MinusCircle className="mr-2" size={20}/>}
                        {isDeposit ? 'Nhập thêm tiền' : 'Rút tiền tài khoản'}
                    </div>
                    <button onClick={onClose} className="hover:opacity-70 transition"><X size={24}/></button>
                </div>
                
                <div className="p-6 space-y-4 bg-slate-50">
                    <div className="p-3 bg-white rounded-xl border-2 border-slate-200">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Tài khoản</p>
                        <p className="text-lg font-black text-slate-800 uppercase">{account.name}</p>
                        <div className="mt-2 flex justify-between items-center border-t pt-2">
                             <span className="text-[10px] font-black text-slate-400 uppercase">Số dư hiện tại:</span>
                             <span className="font-black text-primary">{formatNumber(account.balance || 0)} ₫</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Số tiền muốn {isDeposit ? 'nhập' : 'rút'}</label>
                        <input 
                            type="text"
                            inputMode="numeric"
                            autoFocus
                            value={formatNumber(amount)} 
                            onChange={e => setAmount(parseNumber(e.target.value))}
                            onFocus={e => e.target.select()}
                            className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl text-right font-black text-2xl focus:ring-2 focus:ring-primary outline-none shadow-inner bg-white text-black"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Ghi chú (Note)</label>
                        <textarea 
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={3}
                            placeholder="Nhập lý do nhập/rút tiền..."
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-primary outline-none bg-white shadow-sm text-black"
                        />
                    </div>
                </div>

                <div className="p-4 bg-white border-t border-slate-200 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition">Hủy</button>
                    <button 
                        onClick={() => onConfirm(amount, note)}
                        disabled={isSaving || amount <= 0}
                        className={`flex-1 py-3 text-white rounded-xl font-black text-xs uppercase shadow-lg transition active:scale-95 flex items-center justify-center ${isDeposit ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                        {isSaving ? <Loader className="animate-spin mr-2" size={18}/> : <Save className="mr-2" size={18}/>}
                        Xác nhận {isDeposit ? 'Nhập' : 'Rút'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const TransferModal: React.FC<{
    isOpen: boolean;
    accounts: PaymentMethod[];
    onClose: () => void;
    onConfirm: (fromId: string, toId: string, amount: number) => void;
    isSaving: boolean;
}> = ({ isOpen, accounts, onClose, onConfirm, isSaving }) => {
    const [fromId, setFromId] = useState('');
    const [toId, setToId] = useState('');
    const [amount, setAmount] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setFromId('');
            setToId('');
            setAmount(0);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const fromAccount = accounts.find(a => a.id === fromId);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-down border-4 border-slate-800 flex flex-col overflow-hidden">
                <div className="p-4 flex justify-between items-center text-white font-black uppercase text-sm bg-blue-600">
                    <div className="flex items-center">
                        <ArrowRightLeft className="mr-2" size={20}/>
                        Chuyển tiền nội bộ
                    </div>
                    <button onClick={onClose} className="hover:opacity-70 transition"><X size={24}/></button>
                </div>
                
                <div className="p-6 space-y-4 bg-slate-50">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Chuyển TỪ tài khoản</label>
                        <select 
                            value={fromId} 
                            onChange={e => setFromId(e.target.value)}
                            className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-primary bg-white text-black"
                        >
                            <option value="">-- Chọn tài khoản nguồn --</option>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (Dư: {formatNumber(a.balance || 0)} ₫)</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Chuyển ĐẾN tài khoản</label>
                        <select 
                            value={toId} 
                            onChange={e => setToId(e.target.value)}
                            className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-primary bg-white text-black"
                        >
                            <option value="">-- Chọn tài khoản đích --</option>
                            {accounts.filter(a => a.id !== fromId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Số tiền chuyển</label>
                        <input 
                            type="text" inputMode="numeric"
                            value={formatNumber(amount)} 
                            onChange={e => setAmount(Math.min(parseNumber(e.target.value), fromAccount?.balance || 9999999999))}
                            onFocus={e => e.target.select()}
                            className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl text-right font-black text-2xl focus:ring-2 focus:ring-primary outline-none shadow-inner bg-white text-black"
                        />
                        {fromAccount && (
                            <p className="text-[10px] font-bold text-orange-600 mt-1 uppercase">Tối đa có thể chuyển: {formatNumber(fromAccount.balance || 0)} ₫</p>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-white border-t border-slate-200 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition">Hủy</button>
                    <button 
                        onClick={() => onConfirm(fromId, toId, amount)}
                        disabled={isSaving || amount <= 0 || !fromId || !toId}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase shadow-lg transition active:scale-95 flex items-center justify-center disabled:bg-slate-300"
                    >
                        {isSaving ? <Loader className="animate-spin mr-2" size={18}/> : <ArrowRightLeft className="mr-2" size={18}/>}
                        Xác nhận chuyển
                    </button>
                </div>
            </div>
        </div>
    );
};

const HistoryModal: React.FC<{
    isOpen: boolean;
    account: PaymentMethod | null;
    onClose: () => void;
}> = ({ isOpen, account, onClose }) => {
    const [logs, setLogs] = useState<PaymentLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [indexErrorUrl, setIndexErrorUrl] = useState<string | null>(null);
    
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [firstDoc, setFirstDoc] = useState<any>(null);
    const [isAtEnd, setIsAtEnd] = useState(false);
    const [isAtStart, setIsAtStart] = useState(true);
    const [pageSize, setPageSize] = useState(10);

    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceipt | null>(null);
    const [isSaleDetailOpen, setIsSaleDetailOpen] = useState(false);
    const [isReceiptDetailOpen, setIsReceiptDetailOpen] = useState(false);
    const [isFetchingOrder, setIsFetchingOrder] = useState(false);

    // Edit/Delete States
    const [logToEdit, setLogToEdit] = useState<PaymentLog | null>(null);
    const [logToDelete, setLogToDelete] = useState<PaymentLog | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isProcessingAction, setIsProcessingAction] = useState(false);

    useEffect(() => {
        if (isOpen && account) {
            fetchLogs();
        } else {
            setLogs([]);
            setLastDoc(null);
            setFirstDoc(null);
            setIsAtStart(true);
            setIsAtEnd(false);
        }
    }, [isOpen, account, pageSize]);

    const fetchLogs = (direction: 'next' | 'prev' | 'initial' = 'initial') => {
        if (!account) return;
        setLoading(true);
        setError(null);

        let q = query(
            collection(db, "paymentLogs"), 
            where("paymentMethodId", "==", account.id),
            orderBy("createdAt", "desc")
        );

        if (direction === 'next' && lastDoc) {
            q = query(q, startAfter(lastDoc), limit(pageSize));
        } else if (direction === 'prev' && firstDoc) {
            q = query(q, endBefore(firstDoc), limitToLast(pageSize));
        } else {
            q = query(q, limit(pageSize));
        }

        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentLog));
                setLogs(data);
                setFirstDoc(snapshot.docs[0]);
                setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
                setIsAtStart(direction === 'initial' || !snapshot.docs[0]);
                setIsAtEnd(snapshot.docs.length < pageSize);
                setLoading(false);
            },
            (err: any) => {
                console.error("Lỗi tải nhật ký:", err);
                setLoading(false);
                if (err.code === 'failed-precondition') {
                    setError("Cần tạo chỉ mục (Index) trên Firebase để xem nhật ký.");
                    const urlRegex = /(https?:\/\/[^\s]+)/;
                    const match = err.message.match(urlRegex);
                    if (match) setIndexErrorUrl(match[0]);
                } else {
                    setError("Không thể tải dữ liệu nhật ký.");
                }
            }
        );
        return unsubscribe;
    };

    const handleViewOrder = async (log: PaymentLog) => {
        if (!log.relatedId || !log.relatedType) return;
        setIsFetchingOrder(true);
        try {
            const docRef = doc(db, log.relatedType === 'sale' ? 'sales' : 'goodsReceipts', log.relatedId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() };
                if (log.relatedType === 'sale') {
                    setSelectedSale(data as Sale);
                    setIsSaleDetailOpen(true);
                } else {
                    setSelectedReceipt(data as GoodsReceipt);
                    setIsReceiptDetailOpen(true);
                }
            } else {
                alert("Không tìm thấy dữ liệu đơn hàng/phiếu nhập gốc.");
            }
        } catch (err) {
            alert("Lỗi khi tải chi tiết.");
        } finally {
            setIsFetchingOrder(false);
        }
    };

    // LOGIC XỬ LÝ SỬA GIAO DỊCH
    const handleConfirmEditLog = async (newAmount: number, newNote: string, dateString: string) => {
        if (!logToEdit || !account) return;
        setIsProcessingAction(true);
        try {
            const dateObj = new Date(dateString);
            const now = new Date();
            dateObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
            const ts = Timestamp.fromDate(dateObj);

            await runTransaction(db, async (transaction) => {
                const accRef = doc(db, 'paymentMethods', account.id);
                const accSnap = await transaction.get(accRef);
                if (!accSnap.exists()) throw "Account not found";

                const currentBal = accSnap.data().balance || 0;
                
                // Tính toán hiệu ứng đảo ngược tiền cũ và áp dụng tiền mới
                // Nếu là deposit (thu), cũ (+) nên hoàn tác là (-), mới (+)
                // Nếu là withdraw (chi), cũ (-) nên hoàn tác là (+), mới (-)
                let delta = 0;
                if (logToEdit.type === 'deposit' || logToEdit.type === 'transfer_in') {
                    delta = -logToEdit.amount + newAmount;
                } else {
                    delta = logToEdit.amount - newAmount;
                }

                const finalBal = currentBal + delta;

                transaction.update(accRef, { balance: finalBal });
                transaction.update(doc(db, 'paymentLogs', logToEdit.id), {
                    amount: newAmount,
                    note: newNote,
                    createdAt: ts,
                    balanceAfter: finalBal // Lưu ý: Số dư sau GD của các log cũ hơn sẽ ko đổi (chấp nhận sai lệch thứ tự hiển thị để đảm bảo hiệu năng)
                });
            });

            setIsEditModalOpen(false);
            setLogToEdit(null);
            alert("Đã cập nhật giao dịch và số dư tài khoản.");
        } catch (err) {
            console.error(err);
            alert("Lỗi khi cập nhật giao dịch.");
        } finally {
            setIsProcessingAction(false);
        }
    };

    // LOGIC XỬ LÝ XÓA GIAO DỊCH
    const handleConfirmDeleteLog = async () => {
        if (!logToDelete || !account) return;
        setIsProcessingAction(true);
        try {
            await runTransaction(db, async (transaction) => {
                const accRef = doc(db, 'paymentMethods', account.id);
                const accSnap = await transaction.get(accRef);
                if (!accSnap.exists()) throw "Account not found";

                const currentBal = accSnap.data().balance || 0;
                
                // Đảo ngược hiệu ứng của log bị xóa
                let delta = 0;
                if (logToDelete.type === 'deposit' || logToDelete.type === 'transfer_in') {
                    delta = -logToDelete.amount;
                } else {
                    delta = logToDelete.amount;
                }

                transaction.update(accRef, { balance: currentBal + delta });
                transaction.delete(doc(db, 'paymentLogs', logToDelete.id));
            });

            setIsDeleteConfirmOpen(false);
            setLogToDelete(null);
            alert("Đã xóa giao dịch và hoàn tác số dư tài khoản.");
        } catch (err) {
            console.error(err);
            alert("Lỗi khi xóa giao dịch.");
        } finally {
            setIsProcessingAction(false);
        }
    };

    if (!isOpen || !account) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in p-4">
            <SaleDetailModal isOpen={isSaleDetailOpen} onClose={() => setIsSaleDetailOpen(false)} sale={selectedSale} userRole="admin" />
            <GoodsReceiptDetailModal isOpen={isReceiptDetailOpen} onClose={() => setIsReceiptDetailOpen(false)} receipt={selectedReceipt} userRole="admin" />
            
            <EditLogModal 
                isOpen={isEditModalOpen} 
                log={logToEdit} 
                onClose={() => setIsEditModalOpen(false)} 
                onConfirm={handleConfirmEditLog} 
                isSaving={isProcessingAction} 
            />

            <ConfirmationModal 
                isOpen={isDeleteConfirmOpen} 
                onClose={() => setIsDeleteConfirmOpen(false)} 
                onConfirm={handleConfirmDeleteLog} 
                title="Xác nhận xóa giao dịch" 
                message={<>Bạn có chắc chắn muốn xóa giao dịch này? <br/><span className="text-red-600 font-bold">Lưu ý: Số tiền sẽ được hoàn trả/trừ lại vào tài khoản tương ứng.</span></>} 
            />

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-fade-in-down border-4 border-slate-800 overflow-hidden">
                <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
                    <div className="flex items-center">
                        <History className="mr-2 text-primary" size={20}/>
                        <span className="font-black uppercase text-sm tracking-tighter">Nhật ký: {account.name}</span>
                    </div>
                    <button onClick={onClose} className="hover:text-red-400 transition"><X size={24}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 relative">
                    {isFetchingOrder && (
                        <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
                            <Loader className="animate-spin text-primary" size={40}/>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader className="animate-spin text-primary mb-4" size={40}/>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Đang tải dữ liệu...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                            <XCircle size={48} className="text-red-500 mb-4" />
                            <p className="text-sm font-bold text-red-600 mb-4">{error}</p>
                            {indexErrorUrl && (
                                <a 
                                    href={indexErrorUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="px-6 py-2 bg-red-600 text-white rounded-xl font-black text-xs uppercase shadow-lg hover:bg-red-700 transition"
                                >
                                    Bấm vào đây để tạo Index
                                </a>
                            )}
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                            <History size={64} className="mb-4 opacity-20"/>
                            <p className="font-black uppercase text-xs">Chưa có giao dịch nào</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {logs.map((log) => (
                                <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-4 group relative hover:border-primary transition-colors">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                                log.type === 'deposit' || log.type === 'transfer_in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {log.type === 'deposit' ? 'Thu/Nhập' : 
                                                 log.type === 'withdraw' ? 'Chi/Rút' : 
                                                 log.type === 'transfer_in' ? 'Nhận chuyển' : 'Chuyển đi'}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 flex items-center">
                                                <Calendar size={12} className="mr-1"/>
                                                {log.createdAt?.toDate().toLocaleString('vi-VN')}
                                            </span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <StickyNote size={14} className="text-slate-400 mt-0.5 shrink-0"/>
                                            <p className="text-sm font-bold text-slate-700 leading-tight">
                                                {log.note || <span className="italic font-normal opacity-50">Không có ghi chú</span>}
                                            </p>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between">
                                            <div className="text-[10px] font-black text-slate-400 uppercase flex items-center">
                                                <User size={12} className="mr-1"/> {log.creatorName}
                                            </div>
                                            <div className="flex gap-2">
                                                {log.relatedId && (
                                                    <button 
                                                        onClick={() => handleViewOrder(log)}
                                                        className="text-[10px] font-black text-blue-600 uppercase flex items-center hover:underline bg-blue-50 px-2 py-1 rounded"
                                                    >
                                                        <Eye size={12} className="mr-1"/> Xem đơn
                                                    </button>
                                                )}
                                                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => { setLogToEdit(log); setIsEditModalOpen(true); }}
                                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition"
                                                        title="Sửa giao dịch"
                                                    >
                                                        <Edit size={14}/>
                                                    </button>
                                                    <button 
                                                        onClick={() => { setLogToDelete(log); setIsDeleteConfirmOpen(true); }}
                                                        className="p-1 text-red-600 hover:bg-red-100 rounded transition"
                                                        title="Xóa giao dịch"
                                                    >
                                                        <Trash2 size={14}/>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col justify-center border-l-2 border-slate-100 pl-4 md:min-w-[180px]">
                                        <p className={`text-xl font-black leading-none ${
                                            log.type === 'deposit' || log.type === 'transfer_in' ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                            {log.type === 'deposit' || log.type === 'transfer_in' ? '+' : '-'}{formatNumber(log.amount)} ₫
                                        </p>
                                        <div className="mt-2 p-1.5 bg-slate-900 rounded-lg inline-block self-end">
                                            <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Số dư sau GD</p>
                                            <p className="text-xs font-black text-white leading-none">
                                                {log.balanceAfter !== undefined ? `${formatNumber(log.balanceAfter)} ₫` : '---'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2">
                            <span className="text-xs font-black text-slate-400 uppercase">Hiện:</span>
                            <select 
                                value={pageSize} 
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setLogs([]);
                                    setFirstDoc(null);
                                    setLastDoc(null);
                                }}
                                className="px-2 py-1 border-2 border-slate-200 rounded-lg text-xs font-black outline-none focus:border-primary"
                            >
                                <option value={10}>10</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => fetchLogs('prev')} 
                                disabled={loading || isAtStart}
                                className="p-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:bg-slate-200 disabled:opacity-30 transition shadow-sm active:scale-95"
                            >
                                <ChevronLeft size={20}/>
                            </button>
                            <button 
                                onClick={() => fetchLogs('next')} 
                                disabled={loading || isAtEnd}
                                className="p-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:bg-slate-200 disabled:opacity-30 transition shadow-sm active:scale-95"
                            >
                                <ChevronRight size={20}/>
                            </button>
                        </div>
                    </div>
                    <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-black text-xs uppercase shadow-md active:scale-95 transition">Đóng</button>
                </div>
            </div>
        </div>
    );
};

const AccountManagement: React.FC = () => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'name',
    direction: 'asc'
  });

  const [modalType, setModalType] = useState<'deposit' | 'withdraw'>('deposit');
  const [selectedAccount, setSelectedAccount] = useState<PaymentMethod | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditBalanceModalOpen, setIsEditBalanceModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "paymentMethods"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod));
      setPaymentMethods(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const sortedAndFilteredAccounts = useMemo(() => {
    let result = paymentMethods.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    result.sort((a, b) => {
      const valA = a[sortConfig.key] || 0;
      const valB = b[sortConfig.key] || 0;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortConfig.direction === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }

      return sortConfig.direction === 'asc' 
        ? (valA as number) - (valB as number) 
        : (valB as number) - (valA as number);
    });

    return result;
  }, [paymentMethods, searchTerm, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} className="ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="ml-1 text-primary" /> 
      : <ArrowDown size={14} className="ml-1 text-primary" />;
  };

  const handleOpenModal = (type: 'deposit' | 'withdraw', account: PaymentMethod) => {
      setModalType(type);
      setSelectedAccount(account);
      setIsModalOpen(true);
  };

  const handleOpenHistory = (account: PaymentMethod) => {
      setSelectedAccount(account);
      setIsHistoryModalOpen(true);
  };

  const handleOpenEditBalance = (account: PaymentMethod) => {
      setSelectedAccount(account);
      setIsEditBalanceModalOpen(true);
  };

  const handleEditBalanceConfirm = async (newBalance: number) => {
      if (!selectedAccount) return;
      setIsSaving(true);
      try {
          await updateDoc(doc(db, 'paymentMethods', selectedAccount.id), {
              balance: newBalance
          });
          setIsEditBalanceModalOpen(false);
      } catch (err) {
          console.error(err);
          alert("Lỗi khi cập nhật số dư tài khoản.");
      } finally {
          setIsSaving(false);
      }
  };

  const handleTransactionConfirm = async (amount: number, note: string) => {
    if (!selectedAccount) return;
    setIsSaving(true);
    try {
        await runTransaction(db, async (transaction) => {
            const accRef = doc(db, 'paymentMethods', selectedAccount.id);
            const accSnap = await transaction.get(accRef);
            if (!accSnap.exists()) throw "Account not found";

            const currentBalance = accSnap.data().balance || 0;
            const isDeposit = modalType === 'deposit';
            const finalBalance = isDeposit ? currentBalance + amount : currentBalance - amount;

            transaction.update(accRef, { balance: finalBalance });

            const logRef = doc(collection(db, 'paymentLogs'));
            transaction.set(logRef, {
                paymentMethodId: selectedAccount.id,
                paymentMethodName: selectedAccount.name,
                type: modalType,
                amount: amount,
                balanceAfter: finalBalance,
                note: note,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser?.uid || null,
                creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'N/A'
            });
        });

        setIsModalOpen(false);
    } catch (err) {
      console.error("Lỗi giao dịch:", err);
      alert("Đã xảy ra lỗi khi thực hiện giao dịch.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTransferConfirm = async (fromId: string, toId: string, amount: number) => {
      setIsSaving(true);
      try {
          await runTransaction(db, async (transaction) => {
              const fromRef = doc(db, 'paymentMethods', fromId);
              const toRef = doc(db, 'paymentMethods', toId);
              const fromSnap = await transaction.get(fromRef);
              const toSnap = await transaction.get(toRef);

              if (!fromSnap.exists() || !toSnap.exists()) throw "One or more accounts not found";

              const fromBal = fromSnap.data().balance || 0;
              const toBal = toSnap.data().balance || 0;
              const fromName = fromSnap.data().name;
              const toName = toSnap.data().name;

              if (fromBal < amount) throw "Insufficient balance";

              const newFromBal = fromBal - amount;
              const newToBal = toBal + amount;
              const today = new Date().toLocaleDateString('vi-VN');
              const transferNote = `chuyển từ tài khoản ${fromName} qua tài khoản ${toName}_ ${today}`;

              transaction.update(fromRef, { balance: newFromBal });
              transaction.update(toRef, { balance: newToBal });

              const logFromRef = doc(collection(db, 'paymentLogs'));
              transaction.set(logFromRef, {
                  paymentMethodId: fromId,
                  paymentMethodName: fromName,
                  type: 'transfer_out',
                  amount: amount,
                  balanceAfter: newFromBal,
                  note: transferNote,
                  createdAt: serverTimestamp(),
                  createdBy: auth.currentUser?.uid || null,
                  creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'N/A'
              });

              const logToRef = doc(collection(db, 'paymentLogs'));
              transaction.set(logToRef, {
                  paymentMethodId: toId,
                  paymentMethodName: toName,
                  type: 'transfer_in',
                  amount: amount,
                  balanceAfter: newToBal,
                  note: transferNote,
                  createdAt: serverTimestamp(),
                  createdBy: auth.currentUser?.uid || null,
                  creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'N/A'
              });
          });

          setIsTransferModalOpen(false);
      } catch (err) {
          console.error("Lỗi chuyển tiền:", err);
          alert("Lỗi: " + err);
      } finally {
          setIsSaving(false);
      }
  };

  const totalBalance = useMemo(() => {
    return paymentMethods.reduce((sum, item) => sum + (item.balance || 0), 0);
  }, [paymentMethods]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto animate-fade-in">
      <TransactionModal 
        isOpen={isModalOpen}
        type={modalType}
        account={selectedAccount}
        isSaving={isSaving}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleTransactionConfirm}
      />

      <TransferModal 
        isOpen={isTransferModalOpen}
        accounts={paymentMethods}
        isSaving={isSaving}
        onClose={() => setIsTransferModalOpen(false)}
        onConfirm={handleTransferConfirm}
      />

      <HistoryModal 
        isOpen={isHistoryModalOpen}
        account={selectedAccount}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      {isEditBalanceModalOpen && (
        <EditBalanceModal 
          isOpen={isEditBalanceModalOpen} 
          account={selectedAccount} 
          onClose={() => setIsEditBalanceModalOpen(false)} 
          onConfirm={handleEditBalanceConfirm} 
          isSaving={isSaving} 
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div>
          <h1 className="text-3xl font-black text-dark flex items-center uppercase tracking-tighter">
            <Landmark className="mr-3 text-primary" size={32}/> Quản Lý Tài Khoản
          </h1>
          <p className="text-neutral text-sm mt-1">Quản lý dòng tiền, số dư và chuyển khoản nội bộ.</p>
        </div>
        
        <div className="bg-slate-900 p-6 rounded-3xl shadow-2xl border-4 border-slate-800 flex items-center space-x-6 min-w-[320px] transform hover:scale-105 transition-transform">
          <div className="p-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/30">
            <Wallet size={32}/>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Tổng Số Tiền Hệ Thống</p>
            <p className="text-3xl font-black text-white tracking-tighter">{formatNumber(totalBalance)} <span className="text-primary text-sm font-black italic">₫</span></p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border-2 border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                <input 
                    type="text" 
                    placeholder="Tìm tên tài khoản..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none font-black text-sm text-black"
                />
            </div>
            <button 
                onClick={() => setIsTransferModalOpen(true)}
                className="px-4 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase hover:bg-blue-700 transition flex items-center shadow-lg active:scale-95"
            >
                <ArrowRightLeft size={16} className="mr-2"/> Chuyển khoản
            </button>
          </div>
          <div className="flex items-center text-[10px] text-blue-600 font-black uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-full border border-blue-100">
            <History size={14} className="mr-2" />
            Nhật ký giao dịch tự động lưu vết
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-20 flex justify-center items-center"><Loader className="animate-spin text-primary" size={40} /></div>
          ) : sortedAndFilteredAccounts.length === 0 ? (
            <div className="p-20 text-center text-neutral flex flex-col items-center">
              <Banknote size={64} className="mb-4 text-slate-200"/>
              <h3 className="text-xl font-black text-slate-400 uppercase">Không tìm thấy tài khoản nào</h3>
              <p className="text-sm">Vui lòng kiểm tra lại danh sách Phương thức thanh toán.</p>
            </div>
          ) : (
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th 
                    className="p-5 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-700 transition"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">Tài khoản {renderSortIcon('name')}</div>
                  </th>
                  <th 
                    className="p-5 text-[10px] font-black uppercase tracking-widest text-right cursor-pointer hover:bg-slate-700 transition"
                    onClick={() => handleSort('balance')}
                  >
                    <div className="flex items-center justify-end">Số dư {renderSortIcon('balance')}</div>
                  </th>
                  <th className="p-5 text-[10px] font-black uppercase tracking-widest text-center">Hành động nhanh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedAndFilteredAccounts.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-5">
                      <div className="flex items-center">
                        <div className="w-12 h-12 rounded-2xl bg-white border-2 border-slate-100 flex items-center justify-center mr-4 text-slate-500 font-black shadow-sm group-hover:border-primary transition-colors">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-black text-slate-800 uppercase text-sm block">{item.name}</span>
                                <button 
                                    onClick={() => handleOpenEditBalance(item)}
                                    className="p-1 text-slate-400 hover:text-primary transition-colors"
                                    title="Sửa số dư tài khoản"
                                >
                                    <Edit size={14} />
                                </button>
                            </div>
                            <button 
                                onClick={() => handleOpenHistory(item)}
                                className="text-[10px] font-black text-primary uppercase flex items-center mt-1 hover:underline"
                            >
                                <History size={12} className="mr-1"/> Xem nhật ký
                            </button>
                        </div>
                      </div>
                    </td>
                    <td className="p-5 text-right">
                        <span className="text-2xl font-black text-slate-900 tracking-tighter">{formatNumber(item.balance || 0)} ₫</span>
                    </td>
                    <td className="p-5 text-center">
                        <div className="flex justify-center space-x-3">
                          <button 
                            onClick={() => handleOpenModal('deposit', item)}
                            className="px-4 py-2 bg-green-50 text-green-600 border-2 border-green-600 rounded-xl font-black text-[10px] uppercase hover:bg-green-600 hover:text-white transition flex items-center shadow-sm active:scale-95"
                          >
                            <PlusCircle size={14} className="mr-1.5" />
                            Nhập tiền
                          </button>
                          <button 
                            onClick={() => handleOpenModal('withdraw', item)}
                            className="px-4 py-2 bg-red-50 text-red-600 border-2 border-red-600 rounded-xl font-black text-[10px] uppercase hover:bg-red-600 hover:text-white transition flex items-center shadow-sm active:scale-95"
                          >
                            <MinusCircle size={14} className="mr-1.5" />
                            Rút tiền
                          </button>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      {/* Thông tin trợ giúp */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-orange-50 border-l-4 border-orange-400 rounded-2xl flex items-start text-sm text-orange-800 shadow-sm animate-fade-in">
            <AlertCircle size={20} className="mr-3 mt-1 flex-shrink-0" />
            <div>
                <p className="font-black uppercase text-[10px] mb-2 tracking-widest">Quy định giao dịch:</p>
                <ul className="list-disc list-inside space-y-1 text-xs font-bold">
                    <li>Dòng tiền bán hàng & nhập hàng được tự động hạch toán nếu chọn PTTT.</li>
                    <li>Chuyển tiền nội bộ dùng khi điều chuyển tiền giữa các ví/tài khoản ngân hàng.</li>
                    <li>Số dư tài khoản sẽ thay đổi trực tiếp sau mỗi giao dịch thành công.</li>
                </ul>
            </div>
        </div>
        <div className="p-5 bg-blue-50 border-l-4 border-blue-400 rounded-2xl flex items-start text-sm text-blue-800 shadow-sm animate-fade-in">
            <History size={20} className="mr-3 mt-1 flex-shrink-0" />
            <div>
                <p className="font-black uppercase text-[10px] mb-2 tracking-widest">Đối soát & Truy vết:</p>
                <p className="text-xs font-bold leading-relaxed">
                    Hệ thống lưu lại số dư lũy kế sau mỗi lần biến động. Bạn có thể bấm vào "Xem đơn" trong nhật ký để đối soát trực tiếp với hóa đơn bán hàng hoặc phiếu nhập kho liên quan.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AccountManagement;
