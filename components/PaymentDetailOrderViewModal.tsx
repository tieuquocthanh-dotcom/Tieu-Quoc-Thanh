import React, { useState, useEffect } from 'react';
import { GoodsReceipt } from '../types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { FileText, Loader, ExternalLink, Calendar, Warehouse, Users, CreditCard, ChevronRight, X, AlertCircle } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import GoodsReceiptDetailModal from './GoodsReceiptDetailModal';

interface PaymentDetailOrderViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    log: any | null;
    allReceipts?: GoodsReceipt[];
    userRole?: 'admin' | 'staff' | null;
}

export const PaymentDetailOrderViewModal: React.FC<PaymentDetailOrderViewModalProps> = ({
    isOpen,
    onClose,
    log,
    allReceipts = [],
    userRole = 'admin'
}) => {
    const [loading, setLoading] = useState(false);
    const [linkedReceipts, setLinkedReceipts] = useState<GoodsReceipt[]>([]);
    const [activeReceiptForDetail, setActiveReceiptForDetail] = useState<GoodsReceipt | null>(null);
    const [isGoodsReceiptDetailOpen, setIsGoodsReceiptDetailOpen] = useState(false);

    useEffect(() => {
        if (!isOpen || !log) {
            setLinkedReceipts([]);
            return;
        }

        const fetchRelated = async () => {
            setLoading(true);
            try {
                // Collect possible receipt IDs
                const idsToFetch = new Set<string>();

                if (log.relatedId && (!log.relatedType || log.relatedType === 'receipt')) {
                    idsToFetch.add(log.relatedId);
                }
                if (Array.isArray(log.relatedIds)) {
                    log.relatedIds.forEach((id: string) => idsToFetch.add(id));
                }

                // If note contains codes or pattern, check allReceipts
                const results: GoodsReceipt[] = [];

                for (const id of idsToFetch) {
                    // Check if already in allReceipts
                    const found = allReceipts.find(r => r.id === id);
                    if (found) {
                        results.push(found);
                    } else {
                        // Fetch from Firestore
                        const snap = await getDoc(doc(db, 'goodsReceipts', id));
                        if (snap.exists()) {
                            results.push({ id: snap.id, ...snap.data() } as GoodsReceipt);
                        }
                    }
                }

                // If still empty, try to match by short ID from note if present
                if (results.length === 0 && log.note) {
                    const noteText = log.note.toLowerCase();
                    // Match any receipt in allReceipts whose ID (first 8 chars) appears in note
                    const matched = allReceipts.filter(r => {
                        const shortId = r.id.substring(0, 8).toLowerCase();
                        return noteText.includes(shortId);
                    });
                    results.push(...matched);
                }

                // If still empty and note has supplier name, find receipts for this supplier with payments around that time
                if (results.length === 0 && allReceipts.length > 0) {
                    const logTime = log.createdAt?.toMillis ? log.createdAt.toMillis() : null;
                    const matchedByPayment = allReceipts.filter(r => {
                        if (!r.paymentHistory) return false;
                        return r.paymentHistory.some(p => {
                            const pTime = (p as any).createdAt?.toMillis?.() || (p as any).date?.toMillis?.();
                            const pAmount = p.amount;
                            if (pAmount === log.amount) {
                                if (logTime && pTime) {
                                    return Math.abs(logTime - pTime) < 1000 * 60 * 60 * 24; // within 24 hours
                                }
                                return true;
                            }
                            return false;
                        });
                    });
                    results.push(...matchedByPayment);
                }

                setLinkedReceipts(results);
            } catch (err) {
                console.error("Lỗi khi tải thông tin đơn nhập:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchRelated();
    }, [isOpen, log, allReceipts]);

    if (!isOpen || !log) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[150] p-4 animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-down overflow-hidden border-4 border-slate-800">
                    {/* Header */}
                    <div className="flex justify-between items-center p-4 border-b-2 border-slate-800 bg-indigo-50">
                        <div className="flex items-center space-x-2">
                            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                                <FileText size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                                    Đơn hàng ứng với giao dịch chi tiền
                                </h3>
                                <p className="text-xs text-slate-500 font-bold">
                                    Mã GD: <span className="font-mono text-slate-700">{log.id}</span>
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <X size={22} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 overflow-y-auto space-y-4 flex-1">
                        {/* Transaction Summary Card */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Số tiền đã trả</span>
                                <span className="text-base font-black text-red-600">-{formatNumber(log.amount)} ₫</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Thời gian</span>
                                <span className="font-bold text-slate-700">
                                    {log.createdAt?.toDate?.()?.toLocaleString('vi-VN') || 'N/A'}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Tài khoản trả</span>
                                <span className="font-bold text-slate-800">{log.paymentMethodName || 'Tiền mặt'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Người thực hiện</span>
                                <span className="font-bold text-slate-800">{log.creatorName || 'Hệ thống'}</span>
                            </div>
                            <div className="col-span-2 pt-2 border-t border-slate-200">
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Nội dung chi</span>
                                <span className="font-bold text-slate-800">{log.note || 'Không có ghi chú'}</span>
                            </div>
                            {log.supplierBankDetails && (
                                <div className="col-span-2 bg-white p-2.5 rounded-lg border border-slate-200">
                                    <span className="text-[10px] font-black uppercase text-indigo-600 block mb-1">
                                        Ngân hàng nhà cung cấp nhận tiền:
                                    </span>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                        <span className="font-black text-slate-800">{log.supplierBankDetails.bankName}</span>
                                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                            {log.supplierBankDetails.accountNumber}
                                        </span>
                                        <span className="font-bold uppercase text-slate-500">{log.supplierBankDetails.accountName}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Linked Receipts Section */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-black uppercase tracking-tight text-slate-700 flex items-center">
                                    <FileText size={15} className="mr-1.5 text-indigo-600" />
                                    Danh sách phiếu nhập được thanh toán ({linkedReceipts.length})
                                </h4>
                                <span className="text-[10px] text-slate-400 font-bold italic">
                                    Bấm vào phiếu để xem chi tiết đầy đủ
                                </span>
                            </div>

                            {loading ? (
                                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                                    <Loader className="animate-spin text-indigo-600 mx-auto mb-2" size={24} />
                                    <span className="text-xs font-bold text-slate-500">Đang truy vấn thông tin phiếu nhập...</span>
                                </div>
                            ) : linkedReceipts.length === 0 ? (
                                <div className="p-6 text-center bg-amber-50 rounded-xl border border-amber-200">
                                    <AlertCircle className="text-amber-500 mx-auto mb-2" size={24} />
                                    <p className="text-xs font-bold text-amber-800">
                                        Không tìm thấy phiếu nhập liên kết trực tiếp với mã này.
                                    </p>
                                    <p className="text-[11px] text-amber-600 mt-1">
                                        Giao dịch này có thể là thanh toán chi phí ngoài, hoàn tiền hoặc phiếu nhập đã bị xoá.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {linkedReceipts.map((receipt) => {
                                        const amountPaid = receipt.amountPaid !== undefined ? receipt.amountPaid : (receipt.paymentStatus === 'paid' ? receipt.total : 0);
                                        const remaining = Math.max(0, (receipt.total || 0) - amountPaid);
                                        const isFullyPaid = receipt.paymentStatus === 'paid' || remaining <= 0;

                                        return (
                                            <div 
                                                key={receipt.id}
                                                onClick={() => {
                                                    setActiveReceiptForDetail(receipt);
                                                    setIsGoodsReceiptDetailOpen(true);
                                                }}
                                                className="group bg-white p-3.5 rounded-xl border-2 border-slate-200 hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                                            >
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-black text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                            #{receipt.id.substring(0, 8).toUpperCase()}
                                                        </span>
                                                        <span className="font-black text-sm text-slate-800">
                                                            {receipt.supplierName}
                                                        </span>
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                            isFullyPaid 
                                                                ? 'bg-emerald-100 text-emerald-800' 
                                                                : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            {isFullyPaid ? 'Đã đủ' : 'Còn nợ'}
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                                                        <span className="flex items-center">
                                                            <Calendar size={12} className="mr-1 text-slate-400" />
                                                            {receipt.createdAt?.toDate?.()?.toLocaleDateString('vi-VN') || 'N/A'}
                                                        </span>
                                                        <span className="flex items-center">
                                                            <Warehouse size={12} className="mr-1 text-slate-400" />
                                                            {receipt.warehouseName}
                                                        </span>
                                                        <span>
                                                            {receipt.items?.length || 0} mặt hàng ({receipt.items?.reduce((s, i) => s + i.quantity, 0) || 0} sp)
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                                    <div className="text-left sm:text-right">
                                                        <div className="text-[10px] font-black uppercase text-slate-400">Tổng tiền phiếu</div>
                                                        <div className="text-sm font-black text-slate-900">{formatNumber(receipt.total || 0)} ₫</div>
                                                        {remaining > 0 && (
                                                            <div className="text-[10px] font-bold text-red-500">
                                                                Còn nợ: {formatNumber(remaining)} ₫
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="p-2 bg-slate-50 group-hover:bg-indigo-50 rounded-lg text-slate-400 group-hover:text-indigo-600 transition-colors">
                                                        <ChevronRight size={18} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black uppercase rounded-xl transition-all shadow-sm"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>

            {/* Nested Goods Receipt Detail Modal */}
            {isGoodsReceiptDetailOpen && activeReceiptForDetail && (
                <GoodsReceiptDetailModal
                    isOpen={isGoodsReceiptDetailOpen}
                    onClose={() => {
                        setIsGoodsReceiptDetailOpen(false);
                        setActiveReceiptForDetail(null);
                    }}
                    receipt={activeReceiptForDetail}
                    userRole={userRole}
                />
            )}
        </>
    );
};
