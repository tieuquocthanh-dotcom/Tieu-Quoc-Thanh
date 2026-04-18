
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, GoodsReceipt } from '../types';
import { X, Loader, TrendingUp, TrendingDown, Calendar, User, DollarSign, Award, History, Info, AlertCircle } from 'lucide-react';
import { formatNumber } from '../utils/formatting';

interface PriceHistoryItem {
    receiptId: string;
    date: Date;
    supplierName: string;
    price: number;
    quantity: number;
}

interface SupplierStat {
    supplierName: string;
    lastPrice: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    importCount: number;
    lastImportDate: Date;
}

interface PriceComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
}

const PriceComparisonModal: React.FC<PriceComparisonModalProps> = ({ isOpen, onClose, product }) => {
    const [history, setHistory] = useState<PriceHistoryItem[]>([]);
    const [stats, setStats] = useState<{min: number, max: number, avg: number} | null>(null);
    const [supplierStats, setSupplierStats] = useState<SupplierStat[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && product) {
            setLoading(true);
            // Fetch recent receipts that contain this product
            // Note: We fetch all receipts and filter client-side because Firestore doesn't support 
            // array-contains on a field inside an array of objects easily without a specific index field.
            // However, we can use a query on goodsReceipts and filter the items array.
            const q = query(
                collection(db, "goodsReceipts"),
                orderBy("createdAt", "desc"),
                limit(100) // Limit to last 100 receipts for performance
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const rawHistory: PriceHistoryItem[] = [];
                const supplierMap = new Map<string, { 
                    prices: number[], 
                    lastDate: Date, 
                    lastPrice: number 
                }>();

                snapshot.docs.forEach(doc => {
                    const data = doc.data() as GoodsReceipt;
                    const item = data.items?.find(i => i.productId === product.id);
                    
                    if (item && data.createdAt) {
                        const date = data.createdAt.toDate();
                        const price = item.importPrice;
                        
                        rawHistory.push({
                            receiptId: doc.id,
                            date: date,
                            supplierName: data.supplierName,
                            price: price,
                            quantity: item.quantity
                        });

                        if (!supplierMap.has(data.supplierName)) {
                            supplierMap.set(data.supplierName, { prices: [], lastDate: date, lastPrice: price });
                        }
                        
                        const supEntry = supplierMap.get(data.supplierName)!;
                        supEntry.prices.push(price);
                        if (date > supEntry.lastDate) {
                            supEntry.lastDate = date;
                            supEntry.lastPrice = price;
                        }
                    }
                });

                if (rawHistory.length > 0) {
                    const prices = rawHistory.map(h => h.price);
                    const min = Math.min(...prices);
                    const max = Math.max(...prices);
                    const sum = prices.reduce((a, b) => a + b, 0);
                    setStats({ min, max, avg: sum / prices.length });
                } else {
                    setStats(null);
                }

                const processedSuppliers: SupplierStat[] = [];
                supplierMap.forEach((data, name) => {
                    const prices = data.prices;
                    const min = Math.min(...prices);
                    const max = Math.max(...prices);
                    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
                    
                    processedSuppliers.push({
                        supplierName: name,
                        lastPrice: data.lastPrice,
                        avgPrice: avg,
                        minPrice: min,
                        maxPrice: max,
                        importCount: prices.length,
                        lastImportDate: data.lastDate
                    });
                });

                processedSuppliers.sort((a, b) => a.avgPrice - b.avgPrice);
                setHistory(rawHistory);
                setSupplierStats(processedSuppliers);
                setLoading(false);
            }, (err) => {
                console.error("Error fetching price history:", err);
                setLoading(false);
            });

            return () => unsubscribe();
        }
    }, [isOpen, product]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200 border-4 border-slate-800">
                <div className="p-4 border-b-2 border-slate-800 flex justify-between items-center bg-slate-800 text-white">
                    <div>
                        <h3 className="text-lg font-black uppercase tracking-tighter flex items-center">
                            <TrendingUp className="mr-2 text-primary" size={20}/>
                            So Sánh Giá Nhập
                        </h3>
                        <p className="text-xs font-bold text-white/70 mt-1">{product?.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 text-white/50 hover:text-white rounded-full transition-colors">
                        <X size={28} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader className="animate-spin text-primary mb-4" size={40} />
                            <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Đang phân tích dữ liệu...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-xl border-2 border-dashed border-slate-200">
                            <AlertCircle size={48} className="mb-4 opacity-20" />
                            <p className="font-black uppercase tracking-widest text-slate-500">Chưa có lịch sử nhập hàng</p>
                            <p className="text-xs mt-2 font-bold">Hệ thống không tìm thấy phiếu nhập nào cho sản phẩm này.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            {stats && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white border-2 border-green-200 p-4 rounded-xl flex items-center shadow-sm">
                                        <div className="bg-green-100 p-3 rounded-full mr-3 text-green-600">
                                            <TrendingDown size={24} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-green-800 uppercase font-black tracking-widest">Giá Thấp Nhất</p>
                                            <p className="text-2xl font-black text-green-700">{formatNumber(stats.min)} ₫</p>
                                        </div>
                                    </div>
                                    <div className="bg-white border-2 border-blue-200 p-4 rounded-xl flex items-center shadow-sm">
                                        <div className="bg-blue-100 p-3 rounded-full mr-3 text-blue-600">
                                            <DollarSign size={24} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-blue-800 uppercase font-black tracking-widest">Giá Trung Bình</p>
                                            <p className="text-2xl font-black text-blue-700">{formatNumber(Math.round(stats.avg))} ₫</p>
                                        </div>
                                    </div>
                                    <div className="bg-white border-2 border-red-200 p-4 rounded-xl flex items-center shadow-sm">
                                        <div className="bg-red-100 p-3 rounded-full mr-3 text-red-600">
                                            <TrendingUp size={24} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-red-800 uppercase font-black tracking-widest">Giá Cao Nhất</p>
                                            <p className="text-2xl font-black text-red-700">{formatNumber(stats.max)} ₫</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Supplier Ranking */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center">
                                        <Award className="mr-2 text-orange-500" size={18}/>
                                        Xếp Hạng Nhà Cung Cấp
                                    </h4>
                                    <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-50 border-b-2 border-slate-200">
                                                <tr>
                                                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase">NCC</th>
                                                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase text-right">Giá TB</th>
                                                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase text-right">Gần Nhất</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {supplierStats.map((sup, idx) => (
                                                    <tr key={idx} className={`hover:bg-slate-50 transition-colors ${idx === 0 ? 'bg-yellow-50/50' : ''}`}>
                                                        <td className="p-3">
                                                            <div className="flex items-center">
                                                                {idx === 0 && <Award size={14} className="text-yellow-600 mr-1 flex-shrink-0" />}
                                                                <span className="text-xs font-black text-slate-800 truncate max-w-[150px]">{sup.supplierName}</span>
                                                            </div>
                                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                {sup.importCount} lần nhập
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <div className="text-xs font-black text-blue-700">{formatNumber(Math.round(sup.avgPrice))} ₫</div>
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <div className="text-xs font-bold text-slate-800">{formatNumber(sup.lastPrice)} ₫</div>
                                                            <div className="text-[9px] font-bold text-slate-400">{sup.lastImportDate.toLocaleDateString('vi-VN')}</div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Detailed History */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center">
                                        <History className="mr-2 text-blue-500" size={18}/>
                                        Lịch Sử Chi Tiết
                                    </h4>
                                    <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-sm max-h-[400px] overflow-y-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-50 border-b-2 border-slate-200 sticky top-0 z-10">
                                                <tr>
                                                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase">Ngày</th>
                                                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase">NCC</th>
                                                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase text-right">Giá</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {history.map((item, idx) => {
                                                    const diff = stats ? item.price - stats.avg : 0;
                                                    const isCheaper = diff < 0;
                                                    return (
                                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-3">
                                                                <div className="text-xs font-bold text-slate-600">{item.date.toLocaleDateString('vi-VN')}</div>
                                                                <div className="text-[9px] font-bold text-slate-400">{item.date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})}</div>
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="text-xs font-black text-slate-800 truncate max-w-[120px]">{item.supplierName}</div>
                                                                <div className="text-[9px] font-bold text-slate-400">SL: {item.quantity}</div>
                                                            </td>
                                                            <td className="p-3 text-right">
                                                                <div className={`text-xs font-black ${isCheaper ? 'text-green-600' : 'text-red-600'}`}>
                                                                    {formatNumber(item.price)} ₫
                                                                </div>
                                                                <div className={`text-[9px] font-bold flex items-center justify-end ${isCheaper ? 'text-green-500' : 'text-red-500'}`}>
                                                                    {isCheaper ? <TrendingDown size={10} className="mr-1"/> : <TrendingUp size={10} className="mr-1"/>}
                                                                    {Math.abs(((item.price - stats!.avg) / stats!.avg) * 100).toFixed(1)}%
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-100 border-t-2 border-slate-800 flex justify-between items-center">
                    <div className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <Info size={14} className="mr-2 text-blue-500"/>
                        Dữ liệu dựa trên 100 phiếu nhập gần nhất
                    </div>
                    <button onClick={onClose} className="px-8 py-3 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg active:scale-95">
                        ĐÓNG
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PriceComparisonModal;
