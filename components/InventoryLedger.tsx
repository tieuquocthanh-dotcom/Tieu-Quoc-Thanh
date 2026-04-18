
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, GoodsReceipt, Sale } from '../types';
import { History as HistoryIcon, Search, Filter, Loader, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Edit3, Calendar, Eye, X } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import SaleDetailModal from './SaleDetailModal';
import GoodsReceiptDetailModal from './GoodsReceiptDetailModal';

interface InventoryMovement {
    id: string;
    type: 'receipt' | 'sale' | 'transfer' | 'adjustment';
    productId: string;
    productName: string;
    warehouseId: string;
    warehouseName: string;
    quantity: number; // Positive for in, negative for out
    balanceBefore?: number;
    balanceAfter?: number;
    referenceId: string;
    note?: string;
    createdAt: Timestamp;
    creatorName?: string;
}

const InventoryLedger: React.FC<{ userRole?: 'admin' | 'staff' | null, initialProductId?: string }> = ({ userRole, initialProductId }) => {
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProductId, setSelectedProductId] = useState(initialProductId || 'all');
    const [products, setProducts] = useState<Product[]>([]);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    
    // Detail Modal States
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceipt | null>(null);
    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

    useEffect(() => {
        const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snap) => {
            setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        });
        return () => unsubProducts();
    }, []);

    useEffect(() => {
        setLoading(true);
        
        const fetchData = async () => {
            try {
                const movementsList: InventoryMovement[] = [];
                const LIMIT = 500;

                // 1. Fetch Goods Receipts
                let receiptQuery = query(collection(db, 'goodsReceipts'), orderBy('createdAt', 'desc'), limit(LIMIT));
                const receiptSnap = await getDocs(receiptQuery);
                receiptSnap.forEach(doc => {
                    const data = doc.data() as any;
                    const items = data.items || [];
                    items.forEach((item: any) => {
                        if (selectedProductId === 'all' || item.productId === selectedProductId) {
                            movementsList.push({
                                id: `${doc.id}-${item.productId}`,
                                type: 'receipt',
                                productId: item.productId,
                                productName: item.productName,
                                warehouseId: data.warehouseId,
                                warehouseName: data.warehouseName || 'N/A',
                                quantity: item.quantity,
                                referenceId: doc.id,
                                note: data.notes || 'Nhập hàng',
                                createdAt: data.createdAt,
                                creatorName: data.creatorName
                            });
                        }
                    });
                });

                // 2. Fetch Sales
                let saleQuery = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(LIMIT));
                const saleSnap = await getDocs(saleQuery);
                saleSnap.forEach(doc => {
                    const data = doc.data() as any;
                    const items = data.items || [];
                    items.forEach((item: any) => {
                        if (selectedProductId === 'all' || item.productId === selectedProductId) {
                            movementsList.push({
                                id: `${doc.id}-${item.productId}`,
                                type: 'sale',
                                productId: item.productId,
                                productName: item.productName,
                                warehouseId: data.warehouseId,
                                warehouseName: data.warehouseName || 'N/A',
                                quantity: -item.quantity,
                                referenceId: doc.id,
                                note: data.notes || 'Bán hàng',
                                createdAt: data.createdAt,
                                creatorName: data.creatorName
                            });
                        }
                    });
                });

                // 3. Fetch Transfers
                let transferQuery = query(collection(db, 'warehouseTransfers'), orderBy('createdAt', 'desc'), limit(LIMIT));
                const transferSnap = await getDocs(transferQuery);
                transferSnap.forEach(doc => {
                    const data = doc.data();
                    if (selectedProductId === 'all' || data.productId === selectedProductId) {
                        // Out from source
                        movementsList.push({
                            id: `${doc.id}-out`,
                            type: 'transfer',
                            productId: data.productId,
                            productName: data.productName,
                            warehouseId: data.fromWarehouseId,
                            warehouseName: data.fromWarehouseName,
                            quantity: -data.quantity,
                            referenceId: doc.id,
                            note: `Chuyển đến ${data.toWarehouseName}`,
                            createdAt: data.createdAt,
                            creatorName: data.creatorName
                        });
                        // In to destination
                        movementsList.push({
                            id: `${doc.id}-in`,
                            type: 'transfer',
                            productId: data.productId,
                            productName: data.productName,
                            warehouseId: data.toWarehouseId,
                            warehouseName: data.toWarehouseName,
                            quantity: data.quantity,
                            referenceId: doc.id,
                            note: `Nhận từ ${data.fromWarehouseName}`,
                            createdAt: data.createdAt,
                            creatorName: data.creatorName
                        });
                    }
                });

                // 4. Fetch Manual Adjustments
                let adjustmentQuery = query(collection(db, 'inventoryAdjustments'), orderBy('createdAt', 'desc'), limit(LIMIT));
                const adjustmentSnap = await getDocs(adjustmentQuery);
                adjustmentSnap.forEach(doc => {
                    const data = doc.data();
                    if (selectedProductId === 'all' || data.productId === selectedProductId) {
                        movementsList.push({
                            id: doc.id,
                            type: 'adjustment',
                            productId: data.productId,
                            productName: data.productName,
                            warehouseId: data.warehouseId,
                            warehouseName: data.warehouseName,
                            quantity: data.quantity,
                            referenceId: doc.id,
                            note: data.note || 'Điều chỉnh thủ công',
                            createdAt: data.createdAt,
                            creatorName: data.creatorName
                        });
                    }
                });

                // Sort by date desc
                movementsList.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

                // Calculate running balance if a single product is selected
                if (selectedProductId !== 'all') {
                    // Fetch current stock for each warehouse involved
                    const warehouseIds = Array.from(new Set(movementsList.map(m => m.warehouseId)));
                    const currentStocks: Record<string, number> = {};
                    
                    for (const wid of warehouseIds) {
                        const invDoc = await getDoc(doc(db, 'products', selectedProductId, 'inventory', wid));
                        currentStocks[wid] = invDoc.exists() ? invDoc.data().stock : 0;
                    }

                    // Work backwards from current stock
                    // movementsList is sorted desc (newest first)
                    const runningBalances: Record<string, number> = { ...currentStocks };
                    
                    for (let i = 0; i < movementsList.length; i++) {
                        const m = movementsList[i];
                        m.balanceAfter = runningBalances[m.warehouseId];
                        m.balanceBefore = m.balanceAfter - m.quantity;
                        // Update running balance for the next (older) item
                        runningBalances[m.warehouseId] = m.balanceBefore;
                    }
                }

                setMovements(movementsList);
            } catch (err) {
                console.error("Error fetching inventory movements:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedProductId]);

    const handleViewDetail = async (m: InventoryMovement) => {
        try {
            if (m.type === 'sale') {
                const saleDoc = await getDoc(doc(db, 'sales', m.referenceId));
                if (saleDoc.exists()) {
                    setSelectedSale({ id: saleDoc.id, ...saleDoc.data() } as Sale);
                    setIsSaleModalOpen(true);
                }
            } else if (m.type === 'receipt') {
                const receiptDoc = await getDoc(doc(db, 'goodsReceipts', m.referenceId));
                if (receiptDoc.exists()) {
                    setSelectedReceipt({ id: receiptDoc.id, ...receiptDoc.data() } as GoodsReceipt);
                    setIsReceiptModalOpen(true);
                }
            } else {
                alert(`Chi tiết cho loại "${m.type}" đang được cập nhật hoặc không có sẵn.`);
            }
        } catch (error) {
            console.error("Error fetching detail:", error);
            alert("Không thể tải chi tiết đơn hàng.");
        }
    };

    const filteredMovements = useMemo(() => {
        return movements.filter(m => {
            const matchesSearch = m.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                m.warehouseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                m.note?.toLowerCase().includes(searchTerm.toLowerCase());
            
            let matchesDate = true;
            if (dateRange.start) {
                matchesDate = matchesDate && m.createdAt.toMillis() >= new Date(dateRange.start).getTime();
            }
            if (dateRange.end) {
                const endDate = new Date(dateRange.end);
                endDate.setHours(23, 59, 59, 999);
                matchesDate = matchesDate && m.createdAt.toMillis() <= endDate.getTime();
            }

            return matchesSearch && matchesDate;
        });
    }, [movements, searchTerm, dateRange]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-md min-h-[600px]">
            {isSaleModalOpen && selectedSale && (
                <SaleDetailModal 
                    isOpen={isSaleModalOpen}
                    onClose={() => setIsSaleModalOpen(false)}
                    sale={selectedSale}
                    userRole={userRole || 'staff'}
                />
            )}
            {isReceiptModalOpen && selectedReceipt && (
                <GoodsReceiptDetailModal 
                    isOpen={isReceiptModalOpen}
                    onClose={() => setIsReceiptModalOpen(false)}
                    receipt={selectedReceipt}
                    userRole={userRole || 'staff'}
                />
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-2xl font-black text-dark flex items-center uppercase tracking-tighter">
                    <HistoryIcon className="mr-3 text-primary" size={28} />
                    Truy Vết Tồn Kho
                </h1>
                
                <div className="flex flex-wrap gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                        <input 
                            type="text"
                            placeholder="Tìm kiếm..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm font-bold w-64"
                        />
                    </div>
                    <select 
                        value={selectedProductId}
                        onChange={e => setSelectedProductId(e.target.value)}
                        className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm font-bold bg-white"
                    >
                        <option value="all">Tất cả sản phẩm</option>
                        {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center space-x-2">
                    <Calendar size={18} className="text-slate-400" />
                    <span className="text-xs font-black uppercase text-slate-500">Từ ngày:</span>
                    <input 
                        type="date" 
                        value={dateRange.start}
                        onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                <div className="flex items-center space-x-2">
                    <Calendar size={18} className="text-slate-400" />
                    <span className="text-xs font-black uppercase text-slate-500">Đến ngày:</span>
                    <input 
                        type="date" 
                        value={dateRange.end}
                        onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader className="animate-spin text-primary mb-4" size={40} />
                    <p className="text-slate-500 font-bold animate-pulse">Đang tải dữ liệu truy vết...</p>
                </div>
            ) : filteredMovements.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <HistoryIcon size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-bold">Không tìm thấy dữ liệu biến động kho nào.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-800 text-white text-[10px] uppercase font-black tracking-widest">
                            <tr>
                                <th className="p-4">Thời gian</th>
                                <th className="p-4">Loại</th>
                                <th className="p-4">Sản phẩm</th>
                                <th className="p-4">Kho</th>
                                <th className="p-4 text-right">Tồn đầu</th>
                                <th className="p-4 text-right">Thay đổi</th>
                                <th className="p-4 text-right">Tồn cuối</th>
                                <th className="p-4">Ghi chú / Tham chiếu</th>
                                <th className="p-4">Người thực hiện</th>
                                <th className="p-4 text-center">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredMovements.map((m) => (
                                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-xs font-bold text-slate-600 whitespace-nowrap">
                                        {m.createdAt.toDate().toLocaleString('vi-VN')}
                                    </td>
                                    <td className="p-4">
                                        {m.type === 'receipt' && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-100 text-green-700 text-[10px] font-black uppercase">
                                                <ArrowDownLeft size={12} className="mr-1" /> Nhập hàng
                                            </span>
                                        )}
                                        {m.type === 'sale' && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-[10px] font-black uppercase">
                                                <ArrowUpRight size={12} className="mr-1" /> Bán hàng
                                            </span>
                                        )}
                                        {m.type === 'transfer' && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-orange-100 text-orange-700 text-[10px] font-black uppercase">
                                                <ArrowRightLeft size={12} className="mr-1" /> Chuyển kho
                                            </span>
                                        )}
                                        {m.type === 'adjustment' && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-100 text-purple-700 text-[10px] font-black uppercase">
                                                <Edit3 size={12} className="mr-1" /> Điều chỉnh
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-xs font-black text-dark uppercase">{m.productName}</td>
                                    <td className="p-4 text-xs font-bold text-slate-500 uppercase">{m.warehouseName}</td>
                                    <td className="p-4 text-right font-bold text-slate-400 text-sm">
                                        {m.balanceBefore !== undefined ? m.balanceBefore : '-'}
                                    </td>
                                    <td className={`p-4 text-right font-black text-sm ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                                    </td>
                                    <td className="p-4 text-right font-black text-dark text-sm">
                                        {m.balanceAfter !== undefined ? m.balanceAfter : '-'}
                                    </td>
                                    <td className="p-4">
                                        <div className="text-xs font-medium text-slate-600">{m.note}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">ID: {m.referenceId}</div>
                                    </td>
                                    <td className="p-4 text-xs font-bold text-slate-500">{m.creatorName || 'Hệ thống'}</td>
                                    <td className="p-4 text-center">
                                        {(m.type === 'sale' || m.type === 'receipt') && (
                                            <button 
                                                onClick={() => handleViewDetail(m)}
                                                className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-primary hover:text-white transition shadow-sm"
                                                title="Xem chi tiết"
                                            >
                                                <Eye size={14} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default InventoryLedger;
