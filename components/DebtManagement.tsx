
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, where, updateDoc, doc, serverTimestamp, Timestamp, arrayUnion, writeBatch, increment, getDocs, orderBy, runTransaction } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { Sale, GoodsReceipt, PaymentMethod, Customer, Supplier, Shipper, Product, Warehouse } from '../types';
import { Loader, Search, ArrowUpRight, ArrowDownLeft, Wallet, Package, Users, Building, Eye, X, Calendar, CheckCircle, AlertTriangle, Clock, CreditCard, CheckCheck, Square, CheckSquare, User, Edit, ChevronDown, ChevronRight, ArrowLeftRight, Repeat, Building2 } from 'lucide-react';
import { formatNumber, parseNumber } from '../utils/formatting';
import Pagination from './Pagination';
import SaleDetailModal from './SaleDetailModal';
import GoodsReceiptDetailModal from './GoodsReceiptDetailModal';
import SaleEditModal from './SaleEditModal';
import GoodsReceiptEditModal from './GoodsReceiptEditModal';

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


const SupplierBankSelector: React.FC<{
    supplier?: Supplier;
    selectedBankAccountId: string;
    onSelect: (id: string) => void;
    newBankDetails: { bankName: string; accountNumber: string; accountName: string };
    onNewBankChange: (field: string, value: string) => void;
    isCreatingNew: boolean;
    setIsCreatingNew: (val: boolean) => void;
}> = ({ supplier, selectedBankAccountId, onSelect, newBankDetails, onNewBankChange, isCreatingNew, setIsCreatingNew }) => {
    if (!supplier) return null;
    const accounts = supplier.bankAccounts || [];

    return (
        <div className="mt-4 border-t-2 border-slate-200 pt-4">
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Thanh toán vào ngân hàng của nhà cung cấp</label>
            {!isCreatingNew ? (
                <div className="flex gap-2">
                    <select
                        value={selectedBankAccountId}
                        onChange={(e) => {
                            if (e.target.value === 'new') {
                                setIsCreatingNew(true);
                                onSelect('');
                            } else {
                                onSelect(e.target.value);
                            }
                        }}
                        className="flex-1 px-3 py-3 border-2 border-slate-800 rounded-xl font-black focus:ring-2 focus:ring-primary outline-none bg-white text-black"
                    >
                        <option value="">-- Chọn tài khoản thụ hưởng --</option>
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                                {acc.bankName} - {acc.accountNumber} - {acc.accountName}
                            </option>
                        ))}
                        <option value="new">+ Thêm tài khoản mới</option>
                    </select>
                </div>
            ) : (
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border-2 border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase">Thêm tài khoản mới</span>
                        <button onClick={() => setIsCreatingNew(false)} className="text-red-500 hover:bg-red-50 p-1 rounded"><X size={14}/></button>
                    </div>
                    <input type="text" placeholder="Tên Ngân hàng (vd: VCB, TCB...)" value={newBankDetails.bankName} onChange={e => onNewBankChange('bankName', e.target.value)} className="w-full px-3 py-2 border-2 border-slate-800 rounded-lg text-sm font-bold"/>
                    <input type="text" placeholder="Số tài khoản" value={newBankDetails.accountNumber} onChange={e => onNewBankChange('accountNumber', e.target.value)} className="w-full px-3 py-2 border-2 border-slate-800 rounded-lg text-sm font-bold"/>
                    <input type="text" placeholder="Tên chủ tài khoản" value={newBankDetails.accountName} onChange={e => onNewBankChange('accountName', e.target.value)} className="w-full px-3 py-2 border-2 border-slate-800 rounded-lg text-sm font-bold"/>
                </div>
            )}
        </div>
    );
};

const PayBulkModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (date: string, amount: number, note: string, paymentMethodId: string, bankDetails?: any) => void;
    totalAmount: number;
    count: number;
    debtorName: string;
    isProcessing: boolean;
    type: 'receivables' | 'payables';
    paymentMethods: PaymentMethod[];
    supplier?: Supplier;
}> = ({ isOpen, onClose, onConfirm, totalAmount, count, debtorName, isProcessing, type, paymentMethods, supplier }) => {
    const [paymentDate, setPaymentDate] = useState(getTodayString());
    const [selectedMethodId, setSelectedMethodId] = useState('');
    const [note, setNote] = useState('');

    const [payAmount, setPayAmount] = useState(0);

    const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
    const [isCreatingNewBank, setIsCreatingNewBank] = useState(false);
    const [newBankDetails, setNewBankDetails] = useState({ bankName: '', accountNumber: '', accountName: '' });

    const handleConfirm = () => {
        let bankData = undefined;
        if (type === 'payables') {
            if (isCreatingNewBank && newBankDetails.bankName && newBankDetails.accountNumber) {
                bankData = { isNew: true, ...newBankDetails };
            } else if (selectedBankAccountId) {
                bankData = { isNew: false, id: selectedBankAccountId };
            }
        }
        onConfirm(paymentDate, payAmount, note, selectedMethodId, bankData);
    };


    useEffect(() => {
        if (isOpen) {
            setPaymentDate(getTodayString());
            setSelectedMethodId('');
            setPayAmount(totalAmount);
            setSelectedBankAccountId('');
            setIsCreatingNewBank(false);
            setNewBankDetails({ bankName: '', accountNumber: '', accountName: '' });
            setNote(type === 'receivables' ? `Thu hồi nợ các đơn đã chọn từ ${debtorName}` : `Thanh toán nợ các phiếu đã chọn cho ${debtorName}`);
        }
    }, [isOpen, type, debtorName, totalAmount]);

    if (!isOpen) return null;

    const isReceivable = type === 'receivables';
    const selectedMethod = paymentMethods.find(m => m.id === selectedMethodId);
    const isInsufficientBalance = !isReceivable && !!selectedMethod && payAmount > (selectedMethod.balance || 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] p-4 animate-fade-in">
            <div className="bg-white p-0 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-down overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                <div className={`flex justify-between items-center p-4 border-b border-slate-200 ${isReceivable ? 'bg-green-100' : 'bg-orange-100'}`}>
                    <h3 className="text-sm font-black text-black uppercase flex items-center">
                        <CheckCheck className="mr-2" size={18} />
                        {isReceivable ? 'Xác nhận thu hồi nợ gộp' : 'Xác nhận trả nợ gộp'}
                    </h3>
                    <button onClick={onClose} className="text-black hover:text-red-500 transition-colors"><X size={24} /></button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200 mb-6 text-center shadow-inner">
                        <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Đối tác: {debtorName}</p>
                        <p className="text-[10px] text-slate-500 font-black uppercase">Đang chọn {count} mục</p>
                        <div className={`text-3xl font-black mt-2 ${isReceivable ? 'text-blue-700' : 'text-red-600'}`}>
                            {formatNumber(totalAmount)} ₫
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Phương thức thanh toán</label>
                            <select 
                                value={selectedMethodId}
                                onChange={(e) => setSelectedMethodId(e.target.value)}
                                className={`w-full px-3 py-3 border-2 rounded-xl font-black focus:ring-2 focus:ring-primary outline-none bg-white text-black ${isInsufficientBalance ? 'border-red-500' : 'border-slate-800'}`}
                            >
                                <option value="">-- Chọn tài khoản --</option>
                                {paymentMethods.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} (Số dư: {formatNumber(m.balance || 0)} ₫)
                                    </option>
                                ))}
                            </select>
                            {selectedMethod && (
                                <div className="mt-1 flex justify-between items-center text-xs px-1">
                                    <span className="font-bold text-slate-500">Số dư trong tài khoản:</span>
                                    <span className={`font-black ${!isReceivable && (selectedMethod.balance || 0) < payAmount ? 'text-red-600' : 'text-emerald-700'}`}>
                                        {formatNumber(selectedMethod.balance || 0)} ₫
                                    </span>
                                </div>
                            )}
                        </div>
                        {isInsufficientBalance && (
                            <div className="p-3 bg-red-50 border-2 border-red-500 rounded-xl text-red-700 text-xs flex items-start gap-2">
                                <AlertTriangle size={18} className="shrink-0 text-red-600 mt-0.5" />
                                <div>
                                    <p className="font-black uppercase text-red-800">Không đủ tiền trong tài khoản để trả!</p>
                                    <p className="font-bold mt-0.5">
                                        Số tiền trả (<strong>{formatNumber(payAmount)} ₫</strong>) lớn hơn số dư hiện có trong tài khoản <strong>{selectedMethod?.name}</strong> (<strong>{formatNumber(selectedMethod?.balance || 0)} ₫</strong>). Vui lòng chọn tài khoản khác hoặc giảm số tiền trả.
                                    </p>
                                </div>
                            </div>
                        )}
                        {type === 'payables' && (
                            <SupplierBankSelector 
                                supplier={supplier}
                                selectedBankAccountId={selectedBankAccountId}
                                onSelect={setSelectedBankAccountId}
                                isCreatingNew={isCreatingNewBank}
                                setIsCreatingNew={setIsCreatingNewBank}
                                newBankDetails={newBankDetails}
                                onNewBankChange={(field, val) => setNewBankDetails(prev => ({...prev, [field]: val}))}
                            />
                        )}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Số tiền thanh toán</label>
                            <NumericInput 
                                value={payAmount} 
                                onChange={(val) => setPayAmount(Math.min(val, totalAmount))}
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
                <div className="p-4 bg-slate-50 flex gap-3 shrink-0">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-3 bg-white border-2 border-slate-800 text-black rounded-xl font-black text-xs uppercase hover:bg-slate-100 transition active:scale-95"
                        disabled={isProcessing}
                    >
                        Hủy
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        className={`flex-1 py-3 text-white rounded-xl font-black text-xs uppercase shadow-lg transition active:scale-95 flex items-center justify-center ${isReceivable ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'} disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed`}
                        disabled={isProcessing || !selectedMethodId || payAmount <= 0 || isInsufficientBalance}
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
    onConfirm: (date: string, amount: number, note: string, paymentMethodId: string, bankDetails?: any) => void;
    data: { item: Sale | GoodsReceipt, type: 'sale' | 'receipt' } | null;
    isProcessing: boolean;
    paymentMethods: PaymentMethod[];
    suppliers: Supplier[];
}> = ({ isOpen, onClose, onConfirm, data, isProcessing, paymentMethods, suppliers }) => {
    const [paymentDate, setPaymentDate] = useState(getTodayString());
    const [payAmount, setPayAmount] = useState(0);
    const [selectedMethodId, setSelectedMethodId] = useState('');
    const [note, setNote] = useState('');
    const [selectedBankAccountId, setSelectedBankAccountId] = useState(""); 
    const [isCreatingNewBank, setIsCreatingNewBank] = useState(false); 
    const [newBankDetails, setNewBankDetails] = useState({ bankName: "", accountNumber: "", accountName: "" }); 
    const handleConfirm = () => { 
        let bankData = undefined; 
        if (data?.type === "receipt") { 
            if (isCreatingNewBank && newBankDetails.bankName && newBankDetails.accountNumber) { 
                bankData = { isNew: true, ...newBankDetails }; 
            } else if (selectedBankAccountId) { 
                bankData = { isNew: false, id: selectedBankAccountId }; 
            } 
        } 
        onConfirm(paymentDate, payAmount, note, selectedMethodId, bankData); 
    };

    useEffect(() => {
        if (isOpen && data) {
            setPaymentDate(getTodayString());
            setSelectedMethodId('');
            const item = data.item as any;
            const remaining = (item.total || 0) - (item.amountPaid || 0);
            setPayAmount(remaining > 0 ? remaining : 0);
            setNote('');
            setSelectedBankAccountId('');
            setIsCreatingNewBank(false);
            setNewBankDetails({ bankName: '', accountNumber: '', accountName: '' });
        }
    }, [isOpen, data]);

    if (!isOpen || !data) return null;

    const { item, type } = data;
    const isSale = type === 'sale';
    const anyItem = item as any;
    const remainingDebt = (item.total || 0) - (anyItem.amountPaid || 0);
    const supplier = type === 'receipt' ? suppliers.find(s => s.id === anyItem.supplierId) : undefined;
    const selectedMethod = paymentMethods.find(m => m.id === selectedMethodId);
    const isInsufficientBalance = !isSale && !!selectedMethod && payAmount > (selectedMethod.balance || 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] p-4 animate-fade-in">
            <div className="bg-white p-0 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in-down overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-100">
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
                                className={`w-full px-3 py-3 border-2 rounded-xl font-black focus:ring-2 focus:ring-primary outline-none bg-white text-black ${isInsufficientBalance ? 'border-red-500' : 'border-slate-300'}`}
                            >
                                <option value="">-- Chọn tài khoản --</option>
                                {paymentMethods.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} (Số dư: {formatNumber(m.balance || 0)} ₫)
                                    </option>
                                ))}
                            </select>
                            {selectedMethod && (
                                <div className="mt-1 flex justify-between items-center text-xs px-1">
                                    <span className="font-bold text-slate-500">Số dư trong tài khoản:</span>
                                    <span className={`font-black ${!isSale && (selectedMethod.balance || 0) < payAmount ? 'text-red-600' : 'text-emerald-700'}`}>
                                        {formatNumber(selectedMethod.balance || 0)} ₫
                                    </span>
                                </div>
                            )}
                        </div>
                        {isInsufficientBalance && (
                            <div className="p-3 bg-red-50 border-2 border-red-500 rounded-xl text-red-700 text-xs flex items-start gap-2">
                                <AlertTriangle size={18} className="shrink-0 text-red-600 mt-0.5" />
                                <div>
                                    <p className="font-black uppercase text-red-800">Không đủ tiền trong tài khoản để trả!</p>
                                    <p className="font-bold mt-0.5">
                                        Số tiền trả (<strong>{formatNumber(payAmount)} ₫</strong>) lớn hơn số dư hiện có trong tài khoản <strong>{selectedMethod?.name}</strong> (<strong>{formatNumber(selectedMethod?.balance || 0)} ₫</strong>). Vui lòng chọn tài khoản khác hoặc giảm số tiền trả.
                                    </p>
                                </div>
                            </div>
                        )}
                        {type === 'receipt' && (
                            <>
                            {!supplier && <div className="text-red-500 text-xs">Không tìm thấy nhà cung cấp (ID: {anyItem.supplierId})</div>}
                            <SupplierBankSelector 
                                supplier={supplier}
                                selectedBankAccountId={selectedBankAccountId}
                                onSelect={setSelectedBankAccountId}
                                isCreatingNew={isCreatingNewBank}
                                setIsCreatingNew={setIsCreatingNewBank}
                                newBankDetails={newBankDetails}
                                onNewBankChange={(field, val) => setNewBankDetails(prev => ({...prev, [field]: val}))}
                            />
                            </>
                        )}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Số tiền thanh toán</label>
                            <NumericInput 
                                value={payAmount} 
                                onChange={(val) => setPayAmount(Math.min(val, remainingDebt))}
                                className="w-full px-4 py-3 bg-slate-900 text-white border-2 border-slate-800 rounded-xl font-black text-2xl text-right focus:border-primary outline-none shadow-inner"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Ngày ghi nhận</label>
                            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg font-bold outline-none focus:border-primary" style={{ colorScheme: 'light' }}/>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t-2 border-slate-800 flex gap-2 shrink-0">
                    <button onClick={onClose} className="flex-1 py-3 bg-white border-2 border-slate-800 rounded-xl font-black text-xs uppercase text-black" disabled={isProcessing}>Hủy</button>
                    <button onClick={handleConfirm} className="flex-1 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed" disabled={isProcessing || payAmount <= 0 || !selectedMethodId || isInsufficientBalance}>
                        {isProcessing ? <Loader size={18} className="animate-spin" /> : 'Xác nhận'}
                    </button>
                </div>
            </div>
        </div>
    );
};


const NumericInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    className?: string;
    placeholder?: string;
    onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
    onBlur?: () => void;
    isCurrency?: boolean;
    autoFocus?: boolean;
}> = ({ value, onChange, className, placeholder, onFocus, onBlur, isCurrency = true, autoFocus = false }) => {
    const [localValue, setLocalValue] = useState(isCurrency ? formatNumber(value) : value.toString());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    useEffect(() => {
        const parsedLocal = parseNumber(localValue);
        if (value !== parsedLocal) {
             setLocalValue(isCurrency ? formatNumber(value) : value.toString());
        }
    }, [value, isCurrency, localValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setLocalValue(raw);
        onChange(parseNumber(raw));
    };

    const handleBlur = (e?: React.FocusEvent<HTMLInputElement>) => {
        const parsed = parseNumber(localValue);
        setLocalValue(isCurrency ? formatNumber(parsed) : parsed.toString());
        if (onBlur) onBlur();
    };

    return (
        <input
            ref={inputRef}
            type="text"
            inputMode={isCurrency ? "numeric" : "decimal"}
            value={localValue}
            placeholder={placeholder}
            className={className}
            onFocus={(e) => {
                if (value === 0) setLocalValue("");
                onFocus?.(e);
            }}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={(e) => {
                if (e.key === 'Enter') handleBlur();
            }}
        />
    );
};

const DebtOffsetModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    dualInfo: {
        partnerName: string;
        receivableSales: Sale[];
        payableReceipts: GoodsReceipt[];
        receivableTotal: number;
        payableTotal: number;
    } | null;
    isProcessing: boolean;
    onConfirmOffset: (
        partnerName: string,
        offsetAmount: number,
        dateString: string,
        note: string,
        receivableSales: Sale[],
        payableReceipts: GoodsReceipt[]
    ) => void;
}> = ({ isOpen, onClose, dualInfo, isProcessing, onConfirmOffset }) => {
    const [offsetAmount, setOffsetAmount] = useState(0);
    const [offsetDate, setOffsetDate] = useState(getTodayString());
    const [note, setNote] = useState('');

    const receivableTotal = dualInfo?.receivableTotal || 0;
    const payableTotal = dualInfo?.payableTotal || 0;
    const maxOffset = Math.min(receivableTotal, payableTotal);

    useEffect(() => {
        if (isOpen && dualInfo) {
            const maxAmt = Math.min(dualInfo.receivableTotal, dualInfo.payableTotal);
            setOffsetAmount(maxAmt);
            setOffsetDate(getTodayString());
            setNote(`Khấu trừ công nợ đôi bên cho đối tác ${dualInfo.partnerName}`);
        }
    }, [isOpen, dualInfo]);

    if (!isOpen || !dualInfo) return null;

    const remainingReceivable = Math.max(0, receivableTotal - offsetAmount);
    const remainingPayable = Math.max(0, payableTotal - offsetAmount);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] p-4 animate-fade-in">
            <div className="bg-white p-0 rounded-2xl shadow-2xl w-full max-w-xl animate-fade-in-down overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-amber-200 bg-amber-100">
                    <h3 className="text-sm font-black text-amber-900 uppercase flex items-center">
                        <ArrowLeftRight className="mr-2 text-amber-700" size={20} />
                        Khấu trừ công nợ đôi bên (Khách & NCC)
                    </h3>
                    <button onClick={onClose} className="text-black hover:text-red-500 transition-colors"><X size={24} /></button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    {/* Partner Header Info */}
                    <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200 text-center shadow-inner">
                        <p className="text-[10px] font-black text-slate-500 uppercase">Tên Đối Tác</p>
                        <p className="text-2xl font-black text-slate-900 uppercase mt-0.5">{dualInfo.partnerName}</p>
                        <p className="text-xs font-bold text-amber-700 mt-1 flex items-center justify-center gap-1">
                            <Repeat size={14} />
                            Vừa là Khách hàng vừa là Nhà cung cấp
                        </p>
                    </div>

                    {/* Comparison Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-blue-50/80 border-2 border-blue-200 p-3.5 rounded-xl">
                            <span className="text-[10px] font-black uppercase text-blue-600 block mb-1">1. Phải thu (Khách nợ mình)</span>
                            <div className="text-xl font-black text-blue-800">{formatNumber(receivableTotal)} ₫</div>
                            <div className="text-[10px] text-slate-500 font-bold mt-1">{dualInfo.receivableSales.length} đơn hàng nợ</div>
                        </div>
                        <div className="bg-red-50/80 border-2 border-red-200 p-3.5 rounded-xl">
                            <span className="text-[10px] font-black uppercase text-red-600 block mb-1">2. Phải trả (Mình nợ NCC)</span>
                            <div className="text-xl font-black text-red-800">{formatNumber(payableTotal)} ₫</div>
                            <div className="text-[10px] text-slate-500 font-bold mt-1">{dualInfo.payableReceipts.length} phiếu nhập nợ</div>
                        </div>
                    </div>

                    {/* Offset Amount Input */}
                    <div className="bg-amber-50/80 p-4 rounded-xl border-2 border-amber-300 space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-black text-amber-900 uppercase">Số tiền khấu trừ đối ứng</label>
                            <span className="text-[10px] font-black text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-lg border border-amber-300">
                                Tối đa: {formatNumber(maxOffset)} ₫
                            </span>
                        </div>
                        <NumericInput
                            value={offsetAmount}
                            onChange={(val) => setOffsetAmount(Math.min(val, maxOffset))}
                            className="w-full px-4 py-3 bg-slate-900 text-amber-400 border-2 border-slate-800 rounded-xl font-black text-2xl text-right focus:border-amber-500 outline-none shadow-inner"
                        />
                        <div className="flex gap-2">
                            <button 
                                type="button"
                                onClick={() => setOffsetAmount(maxOffset)} 
                                className="px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 text-[11px] font-black rounded-lg transition"
                            >
                                Khấu trừ tối đa ({formatNumber(maxOffset)}₫)
                            </button>
                            {maxOffset >= 1000000 && (
                                <button 
                                    type="button"
                                    onClick={() => setOffsetAmount(Math.floor(maxOffset / 2))} 
                                    className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[11px] font-bold rounded-lg transition"
                                >
                                    50% ({formatNumber(Math.floor(maxOffset / 2))}₫)
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Result Preview */}
                    <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                        <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Dự kiến công nợ sau khấu trừ:</div>
                        <div className="flex justify-between font-bold">
                            <span className="text-slate-600">Nợ Phải Thu còn lại (Khách):</span>
                            <span className={remainingReceivable > 0 ? "text-blue-700 font-black" : "text-slate-400 font-bold"}>
                                {formatNumber(remainingReceivable)} ₫
                            </span>
                        </div>
                        <div className="flex justify-between font-bold">
                            <span className="text-slate-600">Nợ Phải Trả còn lại (NCC):</span>
                            <span className={remainingPayable > 0 ? "text-red-600 font-black" : "text-slate-400 font-bold"}>
                                {formatNumber(remainingPayable)} ₫
                            </span>
                        </div>
                    </div>

                    {/* Date and Note */}
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Ngày ghi nhận khấu trừ</label>
                            <input 
                                type="date" 
                                value={offsetDate} 
                                onChange={(e) => setOffsetDate(e.target.value)}
                                className="w-full px-3 py-2.5 border-2 border-slate-800 rounded-xl font-black text-sm outline-none focus:border-amber-500"
                                style={{ colorScheme: 'light' }}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Ghi chú khấu trừ</label>
                            <input 
                                type="text" 
                                value={note} 
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Nhập ghi chú..."
                                className="w-full px-3 py-2.5 border-2 border-slate-800 rounded-xl font-bold text-sm outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t-2 border-slate-800 flex gap-3 shrink-0">
                    <button 
                        type="button"
                        onClick={onClose} 
                        className="flex-1 py-3 bg-white border-2 border-slate-800 text-black rounded-xl font-black text-xs uppercase hover:bg-slate-100 transition active:scale-95"
                        disabled={isProcessing}
                    >
                        Hủy
                    </button>
                    <button 
                        type="button"
                        onClick={() => onConfirmOffset(dualInfo.partnerName, offsetAmount, offsetDate, note, dualInfo.receivableSales, dualInfo.payableReceipts)}
                        className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs uppercase shadow-lg transition active:scale-95 disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center gap-2"
                        disabled={isProcessing || offsetAmount <= 0}
                    >
                        {isProcessing ? <Loader size={18} className="animate-spin" /> : <ArrowLeftRight size={18} />}
                        Xác nhận khấu trừ ({formatNumber(offsetAmount)} ₫)
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
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [shippers, setShippers] = useState<Shipper[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
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

    const [selectedDualInfo, setSelectedDualInfo] = useState<{
        partnerName: string;
        receivableSales: Sale[];
        payableReceipts: GoodsReceipt[];
        receivableTotal: number;
        payableTotal: number;
    } | null>(null);
    const [isOffsetModalOpen, setIsOffsetModalOpen] = useState(false);
    const [isProcessingOffset, setIsProcessingOffset] = useState(false);
    const [showDualOnly, setShowDualOnly] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

    const toggleRowExpansion = (id: string) => {
        setExpandedRowIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const [pageSize, setPageSize] = useState(10);

    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [isSaleDetailOpen, setIsSaleDetailOpen] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceipt | null>(null);
    const [isReceiptDetailOpen, setIsReceiptDetailOpen] = useState(false);
    const [isSaleEditOpen, setIsSaleEditOpen] = useState(false);
    const [isReceiptEditOpen, setIsReceiptEditOpen] = useState(false);

    useEffect(() => {
        setLoading(true);
        const qSales = query(collection(db, 'sales'), where('status', '==', 'debt'));
        const unsubSales = onSnapshot(qSales, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
            data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setSalesDebt(data);
            setLoading(false);
        });

        const qReceipts = query(collection(db, 'goodsReceipts'), where('paymentStatus', '==', 'debt'));
        const unsubReceipts = onSnapshot(qReceipts, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GoodsReceipt));
            data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setReceiptsDebt(data);
            setLoading(false);
        });

        const unsubMethods = onSnapshot(query(collection(db, "paymentMethods"), orderBy("name")), (snap) => {
            setPaymentMethods(snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod)));
        });

        const unsubCustomers = onSnapshot(query(collection(db, "customers"), orderBy("name")), (snap) => {
            setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
        });

        const unsubSuppliers = onSnapshot(query(collection(db, "suppliers"), orderBy("name")), (snap) => {
            setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
        });

        const unsubShippers = onSnapshot(query(collection(db, "shippers"), orderBy("name")), (snap) => {
            setShippers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Shipper)));
        });

        const unsubProducts = onSnapshot(query(collection(db, "products"), orderBy("name")), (snap) => {
            setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
        });

        const unsubWarehouses = onSnapshot(query(collection(db, "warehouses"), orderBy("name")), (snap) => {
            setWarehouses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse)));
        });

        const handleClickOutside = (e: MouseEvent) => {
            if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
                setIsSearchDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => { 
            unsubSales(); 
            unsubReceipts(); 
            unsubMethods(); 
            unsubCustomers();
            unsubSuppliers();
            unsubShippers();
            unsubProducts();
            unsubWarehouses();
            document.removeEventListener('mousedown', handleClickOutside); 
        };
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
            
            let id: string;
            let name: string;
            
            if (activeTab === 'receivables') {
                const sale = item as Sale;
                id = sale.customerId || 'guest';
                name = sale.customerName || 'Khách vãng lai';
                if (!sale.customerName || sale.customerName === 'Khách vãng lai') {
                    const customer = customers.find(c => c.id === sale.customerId);
                    if (customer) name = customer.name;
                }
            } else {
                const receipt = item as GoodsReceipt;
                id = receipt.supplierId;
                name = receipt.supplierName || 'Nhà cung cấp không tên';
                if (!receipt.supplierName || receipt.supplierName === 'Nhà cung cấp không tên') {
                    const supplier = suppliers.find(s => s.id === receipt.supplierId);
                    if (supplier) name = supplier.name;
                }
            }
            
            if (!summaryMap.has(id)) {
                summaryMap.set(id, { id, name, totalDebt: 0, count: 0, items: [] });
            }
            const current = summaryMap.get(id)!;
            const remaining = (item.total || 0) - (anyItem.amountPaid || 0);
            if (remaining > 0) {
                current.totalDebt += remaining;
                current.count += 1;
                current.items.push(item);
            }
        });

        return Array.from(summaryMap.values())
            .filter(item => item.totalDebt > 0);
    }, [salesDebt, receiptsDebt, activeTab]);

    const normalizeName = (str?: string) => {
        if (!str) return '';
        return str.trim().toLowerCase().replace(/\s+/g, ' ');
    };

    const dualDebtorsMap = useMemo(() => {
        const map = new Map<string, {
            partnerName: string;
            receivableSales: Sale[];
            payableReceipts: GoodsReceipt[];
            receivableTotal: number;
            payableTotal: number;
        }>();

        salesDebt.forEach(sale => {
            const remaining = (sale.total || 0) - (sale.amountPaid || 0);
            if (remaining <= 0) return;
            let name = sale.customerName || 'Khách vãng lai';
            if (!sale.customerName || sale.customerName === 'Khách vãng lai') {
                const cust = customers.find(c => c.id === sale.customerId);
                if (cust) name = cust.name;
            }
            const key = normalizeName(name);
            if (!key || key === 'khach vang lai' || key === 'khách vãng lai') return;

            if (!map.has(key)) {
                map.set(key, { partnerName: name, receivableSales: [], payableReceipts: [], receivableTotal: 0, payableTotal: 0 });
            }
            const entry = map.get(key)!;
            entry.receivableSales.push(sale);
            entry.receivableTotal += remaining;
        });

        receiptsDebt.forEach(receipt => {
            const remaining = (receipt.total || 0) - (receipt.amountPaid || 0);
            if (remaining <= 0) return;
            let name = receipt.supplierName || 'Nhà cung cấp';
            if (!receipt.supplierName || receipt.supplierName === 'Nhà cung cấp không tên') {
                const supp = suppliers.find(s => s.id === receipt.supplierId);
                if (supp) name = supp.name;
            }
            const key = normalizeName(name);
            if (!key) return;

            if (!map.has(key)) {
                map.set(key, { partnerName: name, receivableSales: [], payableReceipts: [], receivableTotal: 0, payableTotal: 0 });
            }
            const entry = map.get(key)!;
            entry.payableReceipts.push(receipt);
            entry.payableTotal += remaining;
        });

        const dual = new Map<string, {
            partnerName: string;
            receivableSales: Sale[];
            payableReceipts: GoodsReceipt[];
            receivableTotal: number;
            payableTotal: number;
        }>();

        map.forEach((value, key) => {
            if (value.receivableTotal > 0 && value.payableTotal > 0) {
                dual.set(key, value);
            }
        });

        return dual;
    }, [salesDebt, receiptsDebt, customers, suppliers]);

    const filteredSummary = useMemo(() => {
        return currentSummary.filter(item => {
            const matchesSearch = (item.name || '').toLowerCase().includes((searchTerm || '').toLowerCase());
            if (!matchesSearch) return false;
            if (showDualOnly) {
                const norm = normalizeName(item.name);
                return dualDebtorsMap.has(norm);
            }
            return true;
        });
    }, [currentSummary, searchTerm, showDualOnly, dualDebtorsMap]);

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
        let debtorId = '';
        const dataList = activeTab === 'receivables' ? salesDebt : receiptsDebt;
        
        dataList.forEach(item => {
            if (selectedIds.has(item.id)) {
                list.push(item);
                const anyItem = item as any;
                total += ((item.total || 0) - (anyItem.amountPaid || 0));
                if (!debtorName) { debtorName = anyItem.customerName || anyItem.supplierName; debtorId = anyItem.customerId || anyItem.supplierId; }
            }
        });

        return { items: list, total, debtorName, debtorId, count: list.length };
    }, [selectedIds, activeTab, salesDebt, receiptsDebt]);

    const handleConfirmPayment = async (dateString: string, amount: number, note: string, paymentMethodId: string, bankDetails?: any) => {
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

                let finalBankDetails = null;
                let finalBankAccountId = null;
                if (!isSale && bankDetails) {
                    const supplierRef = doc(db, 'suppliers', (item as any).supplierId);
                    const supplierSnap = await transaction.get(supplierRef);
                    if (supplierSnap.exists()) {
                        let supplierData = supplierSnap.data();
                        let accounts = supplierData.bankAccounts || [];
                        if (bankDetails.isNew) {
                            const newId = Date.now().toString();
                            const newAccount = {
                                id: newId,
                                bankName: bankDetails.bankName,
                                accountNumber: bankDetails.accountNumber,
                                accountName: bankDetails.accountName
                            };
                            accounts.push(newAccount);
                            transaction.update(supplierRef, { bankAccounts: accounts });
                            finalBankAccountId = newId;
                            finalBankDetails = newAccount;
                        } else {
                            finalBankAccountId = bankDetails.id;
                            finalBankDetails = accounts.find((a: any) => a.id === bankDetails.id) || null;
                        }
                    }
                }

                const currentBal = accSnap.data().balance || 0;
                if (!isSale && currentBal < amount) {
                    throw new Error(`Số dư tài khoản "${method?.name || 'đã chọn'}" (${formatNumber(currentBal)} ₫) không đủ để thanh toán ${formatNumber(amount)} ₫!`);
                }
                const finalBal = isSale ? currentBal + amount : currentBal - amount;

                const ref = doc(db, isSale ? 'sales' : 'goodsReceipts', item.id);
                const anyItem = item as any;
                const newPaid = (anyItem.amountPaid || 0) + amount;
                const isFull = newPaid >= (item.total || 0);

                transaction.update(ref, {
                    [isSale ? 'status' : 'paymentStatus']: isFull ? 'paid' : 'debt',
                    amountPaid: newPaid,
                    paidAt: isFull ? ts : (anyItem.paidAt || null),
                    paymentHistory: arrayUnion({ 
                        
                        date: ts, 
                        amount: amount, 
                        note: note || (isSale ? 'Khách trả nợ' : 'Trả nợ NCC'),
                        paymentMethodId: paymentMethodId,
                        paymentMethodName: method?.name || 'N/A',
                        supplierBankAccountId: finalBankAccountId || null,
                        supplierBankDetails: finalBankDetails || null

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
                    creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'N/A',
                    supplierBankAccountId: finalBankAccountId || null,
                    supplierBankDetails: finalBankDetails || null
                });
            });

            setIsPaymentModalOpen(false);
            setPaymentItem(null);
        } catch (err: any) { 
            console.error(err);
            alert(err?.message || (typeof err === 'string' ? err : "Lỗi cập nhật.")); 
        } finally { 
            setIsProcessingPayment(false); 
        }
    };

    const handleConfirmBulkPayment = async (dateString: string, amount: number, note: string, paymentMethodId: string, bankDetails?: any) => {
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

                let finalBankDetails = null;
                let finalBankAccountId = null;
                if (!isReceivable && bankDetails) {
                    const firstItem = selectedItemsData.items[0];
                    if (firstItem) {
                        const supplierRef = doc(db, 'suppliers', (firstItem as any).supplierId);
                        const supplierSnap = await transaction.get(supplierRef);
                        if (supplierSnap.exists()) {
                            let supplierData = supplierSnap.data();
                            let accounts = supplierData.bankAccounts || [];
                            if (bankDetails.isNew) {
                                const newId = Date.now().toString();
                                const newAccount = {
                                    id: newId,
                                    bankName: bankDetails.bankName,
                                    accountNumber: bankDetails.accountNumber,
                                    accountName: bankDetails.accountName
                                };
                                accounts.push(newAccount);
                                transaction.update(supplierRef, { bankAccounts: accounts });
                                finalBankAccountId = newId;
                                finalBankDetails = newAccount;
                            } else {
                                finalBankAccountId = bankDetails.id;
                                finalBankDetails = accounts.find((a: any) => a.id === bankDetails.id) || null;
                            }
                        }
                    }
                }

                const currentBal = accSnap.data().balance || 0;
                if (!isReceivable && currentBal < amount) {
                    throw new Error(`Số dư tài khoản "${method?.name || 'đã chọn'}" (${formatNumber(currentBal)} ₫) không đủ để thanh toán ${formatNumber(amount)} ₫!`);
                }
                let remainingToPay = amount;
                const partnerName = selectedItemsData.debtorName;

                // Sort items by date (oldest first) to apply payment
                const sortedItems = [...selectedItemsData.items].sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));

                for (const item of sortedItems) {
                    if (remainingToPay <= 0) break;

                    const anyItem = item as any;
                    const remainingDebt = (item.total || 0) - (anyItem.amountPaid || 0);
                    const paymentForThisItem = Math.min(remainingToPay, remainingDebt);
                    
                    if (paymentForThisItem <= 0) continue;

                    const ref = doc(db, isReceivable ? 'sales' : 'goodsReceipts', item.id);
                    const newPaid = (anyItem.amountPaid || 0) + paymentForThisItem;
                    const isFull = newPaid >= (item.total || 0);

                    transaction.update(ref, {
                        [isReceivable ? 'status' : 'paymentStatus']: isFull ? 'paid' : 'debt',
                        amountPaid: newPaid,
                        paidAt: isFull ? ts : (anyItem.paidAt || null),
                        paymentHistory: arrayUnion({ 
                                                        date: ts, 
                            amount: paymentForThisItem, 
                            note: note,
                            paymentMethodId: paymentMethodId,
                            paymentMethodName: method?.name || 'N/A',
                            supplierBankAccountId: finalBankAccountId || null,
                            supplierBankDetails: finalBankDetails || null
                        })
                    });

                    remainingToPay -= paymentForThisItem;
                }

                const finalBal = isReceivable ? currentBal + amount : currentBal - amount;
                transaction.update(accRef, { balance: finalBal });

                const logRef = doc(collection(db, 'paymentLogs'));
                const formattedDate = dateObj.toLocaleDateString('vi-VN');
                const bulkAutoNote = isReceivable 
                    ? `Khách hàng ${partnerName} thanh toán nợ GỘP (${selectedIds.size} đơn)_ ${formattedDate}`
                    : `Thanh toán nợ GỘP (${selectedIds.size} phiếu) cho nhà cung cấp ${partnerName}_ ${formattedDate}`;

                const bulkItemIds = sortedItems.map(i => i.id);

                transaction.set(logRef, {
                    paymentMethodId,
                    paymentMethodName: method?.name || 'N/A',
                    type: isReceivable ? 'deposit' : 'withdraw',
                    amount: amount,
                    balanceAfter: finalBal,
                    note: bulkAutoNote,
                    relatedId: bulkItemIds[0] || null,
                    relatedIds: bulkItemIds,
                    relatedType: isReceivable ? 'sale' : 'receipt',
                    createdAt: ts,
                    createdBy: auth.currentUser?.uid || null,
                    creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'N/A',
                    supplierBankAccountId: finalBankAccountId || null,
                    supplierBankDetails: finalBankDetails || null
                });
            });

            setSelectedIds(new Set());
            setIsPayBulkModalOpen(false);
            alert("Đã thanh toán thành công!");
        } catch (err: any) { 
            console.error(err);
            alert(err?.message || (typeof err === 'string' ? err : "Lỗi thanh toán hàng loạt.")); 
        } finally { 
            setIsProcessingBulk(false); 
        }
    };

    const handleConfirmOffset = async (
        partnerName: string, 
        offsetAmount: number, 
        dateString: string, 
        note: string, 
        receivableSales: Sale[], 
        payableReceipts: GoodsReceipt[]
    ) => {
        if (offsetAmount <= 0) return;
        setIsProcessingOffset(true);
        try {
            const dateObj = new Date(dateString);
            const now = new Date();
            dateObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
            const ts = Timestamp.fromDate(dateObj);

            await runTransaction(db, async (transaction) => {
                const sortedSales = [...receivableSales].sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
                const sortedReceipts = [...payableReceipts].sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));

                let remainingSalesOffset = offsetAmount;
                let remainingReceiptsOffset = offsetAmount;

                // Apply offset to Sales (Receivables)
                for (const sale of sortedSales) {
                    if (remainingSalesOffset <= 0) break;
                    const remainingDebt = (sale.total || 0) - (sale.amountPaid || 0);
                    const paymentForThisSale = Math.min(remainingSalesOffset, remainingDebt);
                    if (paymentForThisSale <= 0) continue;

                    const saleRef = doc(db, 'sales', sale.id);
                    const newPaid = (sale.amountPaid || 0) + paymentForThisSale;
                    const isFull = newPaid >= (sale.total || 0);

                    transaction.update(saleRef, {
                        status: isFull ? 'paid' : 'debt',
                        amountPaid: newPaid,
                        paidAt: isFull ? ts : (sale.paidAt || null),
                        paymentHistory: arrayUnion({
                            date: ts,
                            amount: paymentForThisSale,
                            note: note || `Khấu trừ công nợ đôi bên với NCC ${partnerName}`,
                            paymentMethodId: 'offset',
                            paymentMethodName: 'Khấu trừ công nợ'
                        })
                    });

                    remainingSalesOffset -= paymentForThisSale;
                }

                // Apply offset to GoodsReceipts (Payables)
                for (const receipt of sortedReceipts) {
                    if (remainingReceiptsOffset <= 0) break;
                    const remainingDebt = (receipt.total || 0) - (receipt.amountPaid || 0);
                    const paymentForThisReceipt = Math.min(remainingReceiptsOffset, remainingDebt);
                    if (paymentForThisReceipt <= 0) continue;

                    const receiptRef = doc(db, 'goodsReceipts', receipt.id);
                    const newPaid = (receipt.amountPaid || 0) + paymentForThisReceipt;
                    const isFull = newPaid >= (receipt.total || 0);

                    transaction.update(receiptRef, {
                        paymentStatus: isFull ? 'paid' : 'debt',
                        amountPaid: newPaid,
                        paidAt: isFull ? ts : (receipt.paidAt || null),
                        paymentHistory: arrayUnion({
                            date: ts,
                            amount: paymentForThisReceipt,
                            note: note || `Khấu trừ công nợ đôi bên với KH ${partnerName}`,
                            paymentMethodId: 'offset',
                            paymentMethodName: 'Khấu trừ công nợ'
                        })
                    });

                    remainingReceiptsOffset -= paymentForThisReceipt;
                }

                // Log entry
                const logRef = doc(collection(db, 'paymentLogs'));
                const formattedDate = dateObj.toLocaleDateString('vi-VN');
                const offsetAutoNote = note || `Khấu trừ công nợ đôi bên cho ${partnerName} - ${formattedDate}`;

                transaction.set(logRef, {
                    paymentMethodId: 'offset',
                    paymentMethodName: 'Khấu trừ công nợ',
                    type: 'offset',
                    amount: offsetAmount,
                    balanceAfter: 0,
                    note: offsetAutoNote,
                    createdAt: ts,
                    createdBy: auth.currentUser?.uid || null,
                    creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'N/A'
                });
            });

            setIsOffsetModalOpen(false);
            setSelectedDualInfo(null);
            alert(`Đã khấu trừ thành công ${formatNumber(offsetAmount)} ₫ công nợ đối ứng cho ${partnerName}!`);
        } catch (err) {
            console.error(err);
            alert("Lỗi khi thực hiện khấu trừ công nợ.");
        } finally {
            setIsProcessingOffset(false);
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
            <SaleEditModal 
                isOpen={isSaleEditOpen} 
                onClose={() => setIsSaleEditOpen(false)} 
                sale={selectedSale} 
                customers={customers}
                paymentMethods={paymentMethods}
                shippers={shippers}
                products={products}
            />
            <GoodsReceiptEditModal 
                isOpen={isReceiptEditOpen} 
                onClose={() => setIsReceiptEditOpen(false)} 
                receipt={selectedReceipt} 
                suppliers={suppliers}
                paymentMethods={paymentMethods}
                warehouses={warehouses}
                products={products}
            />
            
            <DebtOffsetModal 
                isOpen={isOffsetModalOpen}
                onClose={() => {
                    setIsOffsetModalOpen(false);
                    setSelectedDualInfo(null);
                }}
                dualInfo={selectedDualInfo}
                isProcessing={isProcessingOffset}
                onConfirmOffset={handleConfirmOffset}
            />

            <PartialPaymentModal 
                isOpen={isPaymentModalOpen} 
                onClose={() => setIsPaymentModalOpen(false)} 
                onConfirm={handleConfirmPayment} 
                data={paymentItem} 
                isProcessing={isProcessingPayment}
                paymentMethods={paymentMethods}
                suppliers={suppliers}
            />
            
            <PayBulkModal 
                supplier={activeTab === 'payables' ? suppliers.find(s => s.id === selectedItemsData.debtorId) : undefined}
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

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                <h1 className="text-3xl font-black text-dark flex items-center uppercase tracking-tighter">
                    <Wallet className="mr-3 text-primary" size={32}/> Quản Lý Công Nợ
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                    {dualDebtorsMap.size > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowDualOnly(!showDualOnly)}
                            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all border-2 ${
                                showDualOnly 
                                    ? 'bg-amber-500 text-white border-amber-600 shadow-md' 
                                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                            }`}
                        >
                            <Repeat size={16} />
                            {showDualOnly ? 'Đang lọc: Nợ Khách & NCC' : `Nợ 2 chiều (${dualDebtorsMap.size})`}
                        </button>
                    )}
                    <div className="flex items-center gap-2 p-1 bg-white rounded-xl border-2 border-slate-200">
                        <button onClick={() => setActiveTab('receivables')} className={`px-4 py-2 rounded-lg font-black text-xs uppercase transition-all ${activeTab === 'receivables' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Phải Thu (Khách)</button>
                        <button onClick={() => setActiveTab('payables')} className={`px-4 py-2 rounded-lg font-black text-xs uppercase transition-all ${activeTab === 'payables' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Phải Trả (NCC)</button>
                    </div>
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
                            className="w-full pl-10 pr-10 py-3 border-2 border-slate-100 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none font-black text-sm uppercase" 
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm('');
                                    setIsSearchDropdownOpen(false);
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Xóa tìm kiếm"
                            >
                                <X size={18} />
                            </button>
                        )}
                        {isSearchDropdownOpen && searchTerm && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-800 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto overflow-x-hidden">
                                {currentSummary.filter(d => (d.name || '').toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                                    <div className="p-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">Không có dữ liệu</div>
                                ) : (
                                    currentSummary.filter(d => (d.name || '').toLowerCase().includes(searchTerm.toLowerCase())).map(d => (
                                        <button 
                                            key={d.id} 
                                            onClick={() => {setSearchTerm(d.name); setIsSearchDropdownOpen(false);}}
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
                            
                            {(() => {
                                const dualInfo = dualDebtorsMap.get(normalizeName(debtor.name));
                                if (!dualInfo) return null;
                                return (
                                    <div className="bg-amber-50 border-b-2 border-amber-300 p-3.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0 shadow-sm">
                                                <Repeat size={18} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black uppercase text-amber-900">Đối tác vừa là Khách vừa là Nhà cung cấp</span>
                                                    <span className="px-2 py-0.5 bg-amber-200 text-amber-900 font-black text-[10px] rounded-md uppercase">Nợ 2 chiều</span>
                                                </div>
                                                <div className="text-xs font-bold text-amber-800 mt-0.5">
                                                    Khách nợ mình: <strong className="text-blue-700 font-black">{formatNumber(dualInfo.receivableTotal)} ₫</strong>
                                                    <span className="mx-2 text-slate-300">|</span>
                                                    Mình nợ NCC: <strong className="text-red-600 font-black">{formatNumber(dualInfo.payableTotal)} ₫</strong>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedDualInfo(dualInfo);
                                                setIsOffsetModalOpen(true);
                                            }}
                                            className="w-full md:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 shrink-0 active:scale-95"
                                        >
                                            <ArrowLeftRight size={16} />
                                            Khấu trừ công nợ ({formatNumber(Math.min(dualInfo.receivableTotal, dualInfo.payableTotal))} ₫)
                                        </button>
                                    </div>
                                );
                            })()}
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b-2 border-slate-100">
                                        <tr className="text-[10px] font-black text-slate-500 uppercase">
                                            <th className="px-4 py-3 w-10"></th>
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
                                            const remaining = (item.total || 0) - (item.amountPaid || 0);
                                            const isSelected = selectedIds.has(item.id);
                                            const isExpanded = expandedRowIds.has(item.id);
                                            return (
                                                <React.Fragment key={item.id}>
                                                    <tr className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                                        <td className="px-4 py-3">
                                                            <button onClick={() => toggleSelection(item.id)} className="hover:scale-110 transition-transform">
                                                                {isSelected ? <CheckSquare size={20} className="text-primary"/> : <Square size={20} className="text-slate-300"/>}
                                                            </button>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <button onClick={() => toggleRowExpansion(item.id)} className="text-slate-400 hover:text-black transition">
                                                                {isExpanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                                                            </button>
                                                        </td>
                                                        <td className="px-4 py-3 font-bold text-black uppercase">#{item.id.substring(0, 8)}</td>
                                                    <td className="px-4 py-3 text-slate-500 font-medium">{item.createdAt?.toDate().toLocaleDateString('vi-VN')}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-slate-400">{formatNumber(item.total || 0)}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-blue-600">{formatNumber(item.amountPaid || 0)}</td>
                                                    <td className="px-4 py-3 text-right font-black text-red-600">{formatNumber(remaining)}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={() => handleViewDetail(item)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-primary hover:text-white rounded-lg transition" title="Xem chi tiết"><Eye size={16} /></button>
                                                            <button onClick={() => handleOpenPaymentModal(item, activeTab === 'receivables' ? 'sale' : 'receipt')} className="p-1.5 bg-slate-100 hover:bg-green-600 hover:text-white rounded-lg transition text-green-600" title="Trả tiền phiếu này"><CreditCard size={16}/></button>
                                                            {activeTab === 'receivables' ? (
                                                                <button onClick={() => { setSelectedSale(item as Sale); setIsSaleEditOpen(true); }} className="p-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-lg transition text-blue-600" title="Điều chỉnh đơn"><Edit size={16}/></button>
                                                            ) : (
                                                                <button onClick={() => { setSelectedReceipt(item as GoodsReceipt); setIsReceiptEditOpen(true); }} className="p-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-lg transition text-blue-600" title="Điều chỉnh phiếu"><Edit size={16}/></button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isExpanded && item.items && (
                                                    <tr className="bg-slate-50">
                                                        <td colSpan={8} className="p-0">
                                                            <div className="bg-slate-100 p-4 border-b-2 border-slate-200 shadow-inner">
                                                                <h4 className="text-xs font-black uppercase text-slate-500 mb-2">Chi tiết sản phẩm</h4>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                    {item.items.map((prod: any, idx: number) => (
                                                                        <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 flex justify-between items-center shadow-sm">
                                                                            <span className="text-[11px] font-bold text-slate-800 line-clamp-1 flex-1 pr-2" title={prod.productName}>{prod.productName}</span>
                                                                            <span className="text-[11px] font-black text-primary shrink-0">
                                                                                {prod.quantity} x {formatNumber(prod.price || prod.importPrice)} ₫
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                </React.Fragment>
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
                    <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
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
