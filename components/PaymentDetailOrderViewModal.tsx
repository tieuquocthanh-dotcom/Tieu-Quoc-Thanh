import React, { useState, useEffect, useMemo } from 'react';
import { GoodsReceipt, Sale } from '../types';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { FileText, Loader, Calendar, Warehouse, Users, CreditCard, ChevronRight, X, AlertCircle, Search, ShoppingBag, Landmark, ArrowUpRight, CheckCircle2, HelpCircle } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import GoodsReceiptDetailModal from './GoodsReceiptDetailModal';
import SaleDetailModal from './SaleDetailModal';

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
    const [exactReceipts, setExactReceipts] = useState<GoodsReceipt[]>([]);
    const [exactSales, setExactSales] = useState<Sale[]>([]);
    const [candidateReceipts, setCandidateReceipts] = useState<GoodsReceipt[]>([]);
    const [candidateSales, setCandidateSales] = useState<Sale[]>([]);
    
    // For manual search in modal
    const [searchTerm, setSearchTerm] = useState('');
    const [allAvailableReceipts, setAllAvailableReceipts] = useState<GoodsReceipt[]>([]);
    const [allAvailableSales, setAllAvailableSales] = useState<Sale[]>([]);

    // Detail modals
    const [activeReceiptForDetail, setActiveReceiptForDetail] = useState<GoodsReceipt | null>(null);
    const [isGoodsReceiptDetailOpen, setIsGoodsReceiptDetailOpen] = useState(false);
    const [activeSaleForDetail, setActiveSaleForDetail] = useState<Sale | null>(null);
    const [isSaleDetailOpen, setIsSaleDetailOpen] = useState(false);

    useEffect(() => {
        if (!isOpen || !log) {
            setExactReceipts([]);
            setExactSales([]);
            setCandidateReceipts([]);
            setCandidateSales([]);
            setSearchTerm('');
            return;
        }

        const fetchAndMatch = async () => {
            setLoading(true);
            try {
                // 1. Fetch all goodsReceipts and sales from Firestore for robust matching
                let fetchedReceipts: GoodsReceipt[] = allReceipts && allReceipts.length > 0 ? [...allReceipts] : [];
                if (fetchedReceipts.length === 0) {
                    const snap = await getDocs(collection(db, 'goodsReceipts'));
                    fetchedReceipts = snap.docs.map(d => ({ id: d.id, ...d.data() } as GoodsReceipt));
                }
                setAllAvailableReceipts(fetchedReceipts);

                const salesSnap = await getDocs(collection(db, 'sales'));
                const fetchedSales: Sale[] = salesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
                setAllAvailableSales(fetchedSales);

                const exactR: GoodsReceipt[] = [];
                const exactS: Sale[] = [];
                const matchedReceiptIds = new Set<string>();
                const matchedSaleIds = new Set<string>();

                // --- PASS 1: Check log.relatedId / log.relatedIds ---
                const rawIds: string[] = [];
                if (log.relatedId) rawIds.push(log.relatedId);
                if (Array.isArray(log.relatedIds)) rawIds.push(...log.relatedIds);

                for (const id of rawIds) {
                    const foundR = fetchedReceipts.find(r => r.id === id);
                    if (foundR && !matchedReceiptIds.has(foundR.id)) {
                        exactR.push(foundR);
                        matchedReceiptIds.add(foundR.id);
                    } else {
                        const foundS = fetchedSales.find(s => s.id === id);
                        if (foundS && !matchedSaleIds.has(foundS.id)) {
                            exactS.push(foundS);
                            matchedSaleIds.add(foundS.id);
                        } else {
                            // Try fetching direct doc
                            try {
                                const rSnap = await getDoc(doc(db, 'goodsReceipts', id));
                                if (rSnap.exists() && !matchedReceiptIds.has(rSnap.id)) {
                                    const data = { id: rSnap.id, ...rSnap.data() } as GoodsReceipt;
                                    exactR.push(data);
                                    matchedReceiptIds.add(data.id);
                                } else {
                                    const sSnap = await getDoc(doc(db, 'sales', id));
                                    if (sSnap.exists() && !matchedSaleIds.has(sSnap.id)) {
                                        const data = { id: sSnap.id, ...sSnap.data() } as Sale;
                                        exactS.push(data);
                                        matchedSaleIds.add(data.id);
                                    }
                                }
                            } catch (e) {
                                console.error(e);
                            }
                        }
                    }
                }

                // --- PASS 2: Match from Note (Short IDs, keywords) ---
                const note = (log.note || '').trim();
                const noteLower = note.toLowerCase();

                if (note) {
                    // Look for 6-30 character alphanumeric tokens
                    const tokens = note.match(/[A-Za-z0-9_-]{6,30}/g) || [];
                    for (const token of tokens) {
                        const tLower = token.toLowerCase();
                        fetchedReceipts.forEach(r => {
                            if (r.id.toLowerCase().startsWith(tLower) || r.id.toLowerCase().includes(tLower)) {
                                if (!matchedReceiptIds.has(r.id)) {
                                    exactR.push(r);
                                    matchedReceiptIds.add(r.id);
                                }
                            }
                        });
                        fetchedSales.forEach(s => {
                            if (s.id.toLowerCase().startsWith(tLower) || s.id.toLowerCase().includes(tLower)) {
                                if (!matchedSaleIds.has(s.id)) {
                                    exactS.push(s);
                                    matchedSaleIds.add(s.id);
                                }
                            }
                        });
                    }
                }

                // --- PASS 3: Match via paymentHistory arrays in Receipts ---
                const logTime = log.createdAt?.toMillis ? log.createdAt.toMillis() : (log.createdAt?.seconds ? log.createdAt.seconds * 1000 : null);
                const logAmount = Number(log.amount) || 0;

                fetchedReceipts.forEach(r => {
                    if (matchedReceiptIds.has(r.id)) return;
                    if (r.paymentHistory && Array.isArray(r.paymentHistory)) {
                        const hasMatchingPayment = r.paymentHistory.some((p: any) => {
                            const pAmount = Number(p.amount) || 0;
                            if (pAmount !== logAmount) return false;
                            
                            const pTime = p.date?.toMillis ? p.date.toMillis() : (p.createdAt?.toMillis ? p.createdAt.toMillis() : null);
                            if (logTime && pTime) {
                                // within 48 hours
                                return Math.abs(logTime - pTime) <= 1000 * 60 * 60 * 48;
                            }
                            return true;
                        });
                        if (hasMatchingPayment) {
                            exactR.push(r);
                            matchedReceiptIds.add(r.id);
                        }
                    }
                });

                // Also check sales paymentHistory
                fetchedSales.forEach(s => {
                    if (matchedSaleIds.has(s.id)) return;
                    if (s.paymentHistory && Array.isArray(s.paymentHistory)) {
                        const hasMatchingPayment = s.paymentHistory.some((p: any) => {
                            const pAmount = Number(p.amount) || 0;
                            if (pAmount !== logAmount) return false;
                            const pTime = p.date?.toMillis ? p.date.toMillis() : null;
                            if (logTime && pTime) {
                                return Math.abs(logTime - pTime) <= 1000 * 60 * 60 * 48;
                            }
                            return true;
                        });
                        if (hasMatchingPayment) {
                            exactS.push(s);
                            matchedSaleIds.add(s.id);
                        }
                    }
                });

                // --- PASS 4: Candidates from same supplier or matching total ---
                const candR: GoodsReceipt[] = [];
                const candS: Sale[] = [];

                // Extract potential supplier name in note (e.g. "nhà cung cấp [X]", "từ [X]", "cho [X]")
                let partnerNameFromNote = '';
                const supMatch = note.match(/(?:nhà cung cấp|ncc|từ|cho nhà cung cấp|cho ncc)\s+([^_\n,]+)/i);
                if (supMatch && supMatch[1]) {
                    partnerNameFromNote = supMatch[1].trim().toLowerCase();
                }

                fetchedReceipts.forEach(r => {
                    if (matchedReceiptIds.has(r.id)) return;
                    const supName = (r.supplierName || '').toLowerCase();
                    const isSameSupplier = partnerNameFromNote && supName.includes(partnerNameFromNote);
                    const isExactTotal = (r.total || 0) === logAmount;
                    const rTime = r.createdAt?.toMillis ? r.createdAt.toMillis() : null;
                    const isCloseDate = logTime && rTime ? Math.abs(logTime - rTime) <= 1000 * 60 * 60 * 72 : false;

                    if (isSameSupplier || (isExactTotal && isCloseDate)) {
                        candR.push(r);
                    }
                });

                fetchedSales.forEach(s => {
                    if (matchedSaleIds.has(s.id)) return;
                    const custName = (s.customerName || '').toLowerCase();
                    const isSameCustomer = partnerNameFromNote && custName.includes(partnerNameFromNote);
                    const isExactTotal = (s.total || 0) === logAmount;
                    const sTime = s.createdAt?.toMillis ? s.createdAt.toMillis() : null;
                    const isCloseDate = logTime && sTime ? Math.abs(logTime - sTime) <= 1000 * 60 * 60 * 72 : false;

                    if (isSameCustomer || (isExactTotal && isCloseDate)) {
                        candS.push(s);
                    }
                });

                setExactReceipts(exactR);
                setExactSales(exactS);
                setCandidateReceipts(candR.slice(0, 10));
                setCandidateSales(candS.slice(0, 10));
            } catch (err) {
                console.error("Lỗi khi tìm đơn hàng tương ứng:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAndMatch();
    }, [isOpen, log]);

    // Filtered search list
    const filteredSearchReceipts = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const term = searchTerm.toLowerCase();
        return allAvailableReceipts.filter(r => 
            r.id.toLowerCase().includes(term) ||
            (r.supplierName || '').toLowerCase().includes(term) ||
            (r.warehouseName || '').toLowerCase().includes(term) ||
            (r.items || []).some(i => (i.productName || '').toLowerCase().includes(term))
        ).slice(0, 8);
    }, [searchTerm, allAvailableReceipts]);

    const filteredSearchSales = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const term = searchTerm.toLowerCase();
        return allAvailableSales.filter(s => 
            s.id.toLowerCase().includes(term) ||
            (s.customerName || '').toLowerCase().includes(term) ||
            (s.warehouseName || '').toLowerCase().includes(term) ||
            (s.items || []).some(i => (i.name || (i as any).productName || '').toLowerCase().includes(term))
        ).slice(0, 8);
    }, [searchTerm, allAvailableSales]);

    if (!isOpen || !log) return null;

    const totalExactMatches = exactReceipts.length + exactSales.length;
    const totalCandidates = candidateReceipts.length + candidateSales.length;

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[150] p-3 sm:p-4 animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col animate-fade-in-down overflow-hidden border-4 border-slate-800">
                    {/* Header */}
                    <div className="flex justify-between items-center p-4 border-b-2 border-slate-800 bg-indigo-600 text-white">
                        <div className="flex items-center space-x-3">
                            <div className="p-2.5 bg-white/20 text-white rounded-xl shadow-xs backdrop-blur-xs">
                                <FileText size={22} />
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-black uppercase tracking-tight">
                                    Truy Vết Đơn Hàng & Phiếu Nhập
                                </h3>
                                <p className="text-xs text-indigo-100 font-bold">
                                    Giao dịch: <span className="font-mono text-white bg-indigo-800 px-1.5 py-0.5 rounded">#{log.id.substring(0, 8).toUpperCase()}</span>
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="p-1.5 rounded-lg text-white hover:bg-white/20 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                        {/* Transaction Summary Card */}
                        <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="col-span-2 sm:col-span-1">
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Số tiền đã trả</span>
                                <span className="text-base sm:text-lg font-black text-red-600">-{formatNumber(log.amount)} ₫</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Thời gian thực hiện</span>
                                <span className="font-bold text-slate-700 block text-[11px]">
                                    {log.createdAt?.toDate?.()?.toLocaleString('vi-VN') || 'N/A'}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Tài khoản trả</span>
                                <span className="inline-flex items-center font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                                    <Landmark size={12} className="mr-1" />
                                    {log.paymentMethodName || 'Tiền mặt'}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Người tạo</span>
                                <span className="font-bold text-slate-800 block text-[11px] truncate">{log.creatorName || 'Hệ thống'}</span>
                            </div>
                            <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-200">
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Nội dung chi / Ghi chú</span>
                                <span className="font-bold text-slate-900 bg-white p-2 rounded-lg border border-slate-200 block text-xs">
                                    {log.note || 'Không có ghi chú'}
                                </span>
                            </div>
                            {log.supplierBankDetails && (
                                <div className="col-span-2 sm:col-span-4 bg-indigo-50/60 p-3 rounded-lg border border-indigo-200">
                                    <span className="text-[10px] font-black uppercase text-indigo-700 block mb-1">
                                        Tài khoản ngân hàng nhận (Nhà cung cấp):
                                    </span>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                        <span className="font-black text-slate-800">{log.supplierBankDetails.bankName}</span>
                                        <span className="font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                                            {log.supplierBankDetails.accountNumber}
                                        </span>
                                        <span className="font-bold uppercase text-slate-600">{log.supplierBankDetails.accountName}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Search Bar for manual lookup */}
                        <div className="relative">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        placeholder="Tra cứu thủ công: nhập mã đơn, tên NCC, tên khách hàng hoặc sản phẩm..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-8 py-2 bg-slate-50 border-2 border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl text-xs font-bold outline-none transition-all"
                                    />
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Search Results if user is searching */}
                        {searchTerm.trim() !== '' && (
                            <div className="space-y-2 bg-indigo-50/40 p-3 rounded-xl border border-indigo-200">
                                <div className="text-xs font-black uppercase text-indigo-800 flex items-center">
                                    <Search size={14} className="mr-1.5" />
                                    Kết quả tìm kiếm cho "{searchTerm}"
                                </div>
                                {filteredSearchReceipts.length === 0 && filteredSearchSales.length === 0 ? (
                                    <p className="text-xs text-slate-500 italic p-2">Không tìm thấy đơn hoặc phiếu nhập nào phù hợp từ khóa.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {filteredSearchReceipts.map(receipt => (
                                            <ReceiptCard
                                                key={receipt.id}
                                                receipt={receipt}
                                                badgeLabel="Phiếu Nhập"
                                                onClick={() => {
                                                    setActiveReceiptForDetail(receipt);
                                                    setIsGoodsReceiptDetailOpen(true);
                                                }}
                                            />
                                        ))}
                                        {filteredSearchSales.map(sale => (
                                            <SaleCard
                                                key={sale.id}
                                                sale={sale}
                                                badgeLabel="Đơn Hàng"
                                                onClick={() => {
                                                    setActiveSaleForDetail(sale);
                                                    setIsSaleDetailOpen(true);
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Exact Matches Section */}
                        {loading ? (
                            <div className="p-8 text-center bg-slate-50 rounded-xl border-2 border-slate-200">
                                <Loader className="animate-spin text-indigo-600 mx-auto mb-2" size={26} />
                                <span className="text-xs font-bold text-slate-600">Đang phân tích và truy vết đơn hàng...</span>
                            </div>
                        ) : totalExactMatches > 0 ? (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-tight text-emerald-700 flex items-center bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                        <CheckCircle2 size={15} className="mr-1.5 text-emerald-600" />
                                        Đơn hàng / Phiếu nhập khớp chính xác ({totalExactMatches})
                                    </h4>
                                    <span className="text-[10px] text-slate-400 font-bold italic">
                                        Bấm vào để xem toàn bộ chi tiết
                                    </span>
                                </div>

                                <div className="space-y-2.5">
                                    {exactReceipts.map(receipt => (
                                        <ReceiptCard
                                            key={receipt.id}
                                            receipt={receipt}
                                            isExact
                                            onClick={() => {
                                                setActiveReceiptForDetail(receipt);
                                                setIsGoodsReceiptDetailOpen(true);
                                            }}
                                        />
                                    ))}
                                    {exactSales.map(sale => (
                                        <SaleCard
                                            key={sale.id}
                                            sale={sale}
                                            isExact
                                            onClick={() => {
                                                setActiveSaleForDetail(sale);
                                                setIsSaleDetailOpen(true);
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {/* Candidates / Suggestions Section */}
                        {!loading && totalCandidates > 0 && (
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-tight text-slate-700 flex items-center">
                                        <HelpCircle size={15} className="mr-1.5 text-indigo-600" />
                                        {totalExactMatches === 0 ? 'Các đơn hàng liên quan gợi ý' : 'Đơn hàng khác cùng nhà cung cấp / đối tác'} ({totalCandidates})
                                    </h4>
                                    <span className="text-[10px] text-slate-400 font-bold italic">
                                        Gợi ý theo nhà cung cấp & ngày giao dịch
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {candidateReceipts.map(receipt => (
                                        <ReceiptCard
                                            key={receipt.id}
                                            receipt={receipt}
                                            badgeLabel="Gợi ý phiếu nhập"
                                            onClick={() => {
                                                setActiveReceiptForDetail(receipt);
                                                setIsGoodsReceiptDetailOpen(true);
                                            }}
                                        />
                                    ))}
                                    {candidateSales.map(sale => (
                                        <SaleCard
                                            key={sale.id}
                                            sale={sale}
                                            badgeLabel="Gợi ý đơn bán"
                                            onClick={() => {
                                                setActiveSaleForDetail(sale);
                                                setIsSaleDetailOpen(true);
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Empty Fallback State */}
                        {!loading && totalExactMatches === 0 && totalCandidates === 0 && searchTerm.trim() === '' && (
                            <div className="p-6 text-center bg-amber-50 rounded-xl border-2 border-amber-200 space-y-2">
                                <AlertCircle className="text-amber-500 mx-auto" size={28} />
                                <p className="text-xs font-black text-amber-900 uppercase">
                                    Không tìm thấy phiếu nhập liên kết tự động với giao dịch này
                                </p>
                                <p className="text-[11px] text-amber-700 max-w-md mx-auto">
                                    Giao dịch này có thể được tạo từ thao tác rút tiền thủ công, chi phí phát sinh, hoặc thanh toán không lưu mã phiếu. Bạn có thể sử dụng thanh tìm kiếm phía trên để tra cứu trực tiếp phiếu nhập của nhà cung cấp.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3.5 border-t-2 border-slate-200 bg-slate-50 flex justify-between items-center">
                        <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                            💡 Mẹo: Bấm vào bất kỳ thẻ phiếu nào để xem toàn bộ danh mục sản phẩm và lịch sử thanh toán
                        </span>
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black uppercase rounded-xl transition-all shadow-md active:scale-95 ml-auto"
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

            {/* Nested Sale Detail Modal */}
            {isSaleDetailOpen && activeSaleForDetail && (
                <SaleDetailModal
                    isOpen={isSaleDetailOpen}
                    onClose={() => {
                        setIsSaleDetailOpen(false);
                        setActiveSaleForDetail(null);
                    }}
                    sale={activeSaleForDetail}
                    userRole={userRole}
                />
            )}
        </>
    );
};

// Sub-component for Receipt Card
const ReceiptCard: React.FC<{
    receipt: GoodsReceipt;
    isExact?: boolean;
    badgeLabel?: string;
    onClick: () => void;
}> = ({ receipt, isExact, badgeLabel, onClick }) => {
    const amountPaid = receipt.amountPaid !== undefined ? receipt.amountPaid : (receipt.paymentStatus === 'paid' ? (receipt.total || 0) : 0);
    const total = receipt.total || 0;
    const remaining = Math.max(0, total - amountPaid);
    const isFullyPaid = receipt.paymentStatus === 'paid' || remaining <= 0;

    return (
        <div
            onClick={onClick}
            className={`group bg-white p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                isExact 
                    ? 'border-indigo-300 hover:border-indigo-600 hover:shadow-md bg-indigo-50/20' 
                    : 'border-slate-200 hover:border-indigo-400 hover:shadow-sm'
            }`}
        >
            <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-black text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        #{receipt.id.substring(0, 8).toUpperCase()}
                    </span>
                    <span className="font-black text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {receipt.supplierName || 'Nhà cung cấp'}
                    </span>
                    {badgeLabel && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                            {badgeLabel}
                        </span>
                    )}
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        isFullyPaid 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                        {isFullyPaid ? 'Đã đủ' : 'Còn nợ'}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium pt-0.5">
                    <span className="flex items-center">
                        <Calendar size={12} className="mr-1 text-slate-400" />
                        {receipt.createdAt?.toDate?.()?.toLocaleDateString('vi-VN') || 'N/A'}
                    </span>
                    {receipt.warehouseName && (
                        <span className="flex items-center">
                            <Warehouse size={12} className="mr-1 text-slate-400" />
                            {receipt.warehouseName}
                        </span>
                    )}
                    <span className="text-slate-600 font-semibold">
                        {receipt.items?.length || 0} mặt hàng ({receipt.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0} sp)
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                <div className="text-left sm:text-right">
                    <div className="text-[10px] font-black uppercase text-slate-400">Tổng phiếu nhập</div>
                    <div className="text-sm font-black text-slate-900">{formatNumber(total)} ₫</div>
                    {remaining > 0 ? (
                        <div className="text-[10px] font-bold text-red-500">
                            Còn nợ: {formatNumber(remaining)} ₫
                        </div>
                    ) : (
                        <div className="text-[10px] font-bold text-emerald-600">
                            Đã thanh toán đủ
                        </div>
                    )}
                </div>

                <div className="p-2 bg-slate-50 group-hover:bg-indigo-600 group-hover:text-white rounded-lg text-slate-400 transition-colors">
                    <ChevronRight size={18} />
                </div>
            </div>
        </div>
    );
};

// Sub-component for Sale Card
const SaleCard: React.FC<{
    sale: Sale;
    isExact?: boolean;
    badgeLabel?: string;
    onClick: () => void;
}> = ({ sale, isExact, badgeLabel, onClick }) => {
    const amountPaid = sale.amountPaid !== undefined ? sale.amountPaid : (sale.status === 'paid' ? (sale.total || 0) : 0);
    const total = sale.total || 0;
    const remaining = Math.max(0, total - amountPaid);
    const isFullyPaid = sale.status === 'paid' || remaining <= 0;

    return (
        <div
            onClick={onClick}
            className={`group bg-white p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                isExact 
                    ? 'border-emerald-300 hover:border-emerald-600 hover:shadow-md bg-emerald-50/20' 
                    : 'border-slate-200 hover:border-emerald-400 hover:shadow-sm'
            }`}
        >
            <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-black text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        #{sale.id.substring(0, 8).toUpperCase()}
                    </span>
                    <span className="font-black text-sm text-slate-900 group-hover:text-emerald-600 transition-colors">
                        {sale.customerName || 'Khách hàng'}
                    </span>
                    {badgeLabel && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                            {badgeLabel}
                        </span>
                    )}
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        isFullyPaid 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                        {isFullyPaid ? 'Đã thanh toán' : 'Còn ghi nợ'}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium pt-0.5">
                    <span className="flex items-center">
                        <Calendar size={12} className="mr-1 text-slate-400" />
                        {sale.createdAt?.toDate?.()?.toLocaleDateString('vi-VN') || 'N/A'}
                    </span>
                    {sale.warehouseName && (
                        <span className="flex items-center">
                            <Warehouse size={12} className="mr-1 text-slate-400" />
                            {sale.warehouseName}
                        </span>
                    )}
                    <span className="text-slate-600 font-semibold">
                        {sale.items?.length || 0} mặt hàng
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                <div className="text-left sm:text-right">
                    <div className="text-[10px] font-black uppercase text-slate-400">Tổng đơn bán</div>
                    <div className="text-sm font-black text-slate-900">{formatNumber(total)} ₫</div>
                    {remaining > 0 ? (
                        <div className="text-[10px] font-bold text-red-500">
                            Còn nợ: {formatNumber(remaining)} ₫
                        </div>
                    ) : (
                        <div className="text-[10px] font-bold text-emerald-600">
                            Đã thanh toán đủ
                        </div>
                    )}
                </div>

                <div className="p-2 bg-slate-50 group-hover:bg-emerald-600 group-hover:text-white rounded-lg text-slate-400 transition-colors">
                    <ChevronRight size={18} />
                </div>
            </div>
        </div>
    );
};
