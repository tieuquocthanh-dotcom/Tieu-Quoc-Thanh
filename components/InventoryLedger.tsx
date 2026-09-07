
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, GoodsReceipt, Sale } from '../types';
import { History as HistoryIcon, Search, Filter, Loader, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Edit3, Calendar, Eye, X, User, Package, Warehouse } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import SaleDetailModal from './SaleDetailModal';
import GoodsReceiptDetailModal from './GoodsReceiptDetailModal';

const toDateSafe = (val: any): Date | null => {
  if (!val) return null;
  if (typeof val.toDate === 'function') {
    try { return val.toDate(); } catch (e) { /* ignore */ }
  }
  if (val instanceof Date) return val;
  if (typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000));
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const formatDateSafe = (val: any): string => {
  const d = toDateSafe(val);
  return d ? d.toLocaleString('vi-VN') : 'N/A';
};

const toMillis = (val: any): number => {
  const d = toDateSafe(val);
  return d ? d.getTime() : 0;
};

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
    createdAt: any;
    creatorName?: string;
}

const InventoryLedger: React.FC<{ 
    userRole?: 'admin' | 'staff' | null; 
    initialProductId?: string;
    initialWarehouseId?: string;
}> = ({ userRole, initialProductId, initialWarehouseId }) => {
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProductId, setSelectedProductId] = useState(initialProductId || 'all');
    const [products, setProducts] = useState<Product[]>([]);
    // If a specific product is targeted, show all-time history by default so past transfers/receipts aren't hidden
    const [dateRange, setDateRange] = useState(() => {
        if (initialProductId && initialProductId !== 'all') {
            return { start: '', end: '' };
        }
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return { start: d.toISOString().split('T')[0], end: '' };
    });
    const [selectedWarehouseId, setSelectedWarehouseId] = useState(initialWarehouseId || 'all');
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [productCurrentStocks, setProductCurrentStocks] = useState<Record<string, number>>({});
    
    // Detail Modal States
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceipt | null>(null);
    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

    useEffect(() => {
        if (initialProductId) {
            setSelectedProductId(initialProductId);
            // Switch to all-time for specific product so all historical transfers are visible
            setDateRange({ start: '', end: '' });
        }
    }, [initialProductId]);

    useEffect(() => {
        if (initialWarehouseId) {
            setSelectedWarehouseId(initialWarehouseId);
        }
    }, [initialWarehouseId]);

    // Listen to current warehouse stocks when a product is selected
    useEffect(() => {
        if (selectedProductId && selectedProductId !== 'all') {
            const unsub = onSnapshot(collection(db, 'products', selectedProductId, 'inventory'), (snap) => {
                const stocks: Record<string, number> = {};
                snap.forEach(d => {
                    stocks[d.id] = d.data().stock || 0;
                });
                setProductCurrentStocks(stocks);
            });
            return () => unsub();
        } else {
            setProductCurrentStocks({});
        }
    }, [selectedProductId]);

    useEffect(() => {
        const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snap) => {
            setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        });
        const unsubWarehouses = onSnapshot(query(collection(db, 'warehouses'), orderBy('name')), (snap) => {
            setWarehouses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => {
            unsubProducts();
            unsubWarehouses();
        };
    }, []);

    useEffect(() => {
        setLoading(true);
        
        const fetchData = async () => {
            try {
                const movementsList: InventoryMovement[] = [];
                const LIMIT = 500;

                // 1. Fetch Goods Receipts
                let constraints: any[] = [orderBy('createdAt', 'desc')];
                if (dateRange.start) {
                    const startDate = new Date(dateRange.start);
                    startDate.setHours(0, 0, 0, 0);
                    constraints.push(where('createdAt', '>=', startDate));
                }
                if (dateRange.end && selectedProductId === 'all') {
                    const endDate = new Date(dateRange.end);
                    endDate.setHours(23, 59, 59, 999);
                    constraints.push(where('createdAt', '<=', endDate));
                }
                constraints.push(limit(3000));
                
                let receiptQuery = query(collection(db, 'goodsReceipts'), ...constraints);
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
                let saleQuery = query(collection(db, 'sales'), ...constraints);
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
                let transferQuery = query(collection(db, 'warehouseTransfers'), ...constraints);
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
                let adjustmentQuery = query(collection(db, 'inventoryAdjustments'), ...constraints);
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
                movementsList.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

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
    }, [selectedProductId, dateRange.start, dateRange.end, selectedWarehouseId]);

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
            const itemTime = toMillis(m.createdAt);
            if (dateRange.start) {
                const startDate = new Date(dateRange.start);
                startDate.setHours(0, 0, 0, 0);
                matchesDate = matchesDate && itemTime >= startDate.getTime();
            }
            if (dateRange.end) {
                const endDate = new Date(dateRange.end);
                endDate.setHours(23, 59, 59, 999);
                matchesDate = matchesDate && itemTime <= endDate.getTime();
            }

            let matchesWarehouse = true;
            if (selectedWarehouseId !== 'all') {
                matchesWarehouse = m.warehouseId === selectedWarehouseId;
            }
            return matchesSearch && matchesDate && matchesWarehouse;
        });
    }, [movements, searchTerm, dateRange, selectedWarehouseId]);

    const selectedProductObj = useMemo(() => {
        return products.find(p => p.id === selectedProductId);
    }, [products, selectedProductId]);

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
                <div>
                    <h1 className="text-2xl font-black text-dark flex items-center uppercase tracking-tighter">
                        <HistoryIcon className="mr-3 text-primary" size={28} />
                        Truy Vết Tồn Kho
                    </h1>
                    {selectedProductObj && (
                        <p className="text-xs text-slate-500 font-bold mt-1">
                            Sản phẩm: <span className="text-primary font-black uppercase">{selectedProductObj.name}</span>
                        </p>
                    )}
                </div>
                
                <div className="flex flex-wrap gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                        <input 
                            type="text"
                            placeholder="Tìm kiếm..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm font-bold w-56"
                        />
                    </div>
                    <select 
                        value={selectedWarehouseId}
                        onChange={e => setSelectedWarehouseId(e.target.value)}
                        className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm font-bold bg-white"
                    >
                        <option value="all">Tất cả các kho</option>
                        {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                    <select
                        value={selectedProductId}
                        onChange={e => {
                            const newPid = e.target.value;
                            setSelectedProductId(newPid);
                            if (newPid !== 'all') {
                                setDateRange({ start: '', end: '' });
                            }
                        }}
                        className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm font-bold bg-white max-w-[240px]"
                    >
                        <option value="all">Tất cả sản phẩm</option>
                        {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Current Stock Breakdown per Warehouse when a product is chosen */}
            {selectedProductId !== 'all' && selectedProductObj && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                        <Package size={18} className="text-primary" />
                        <span className="text-xs font-black uppercase text-slate-600">Tồn kho hiện tại:</span>
                        <span className="text-xs font-black text-dark uppercase">{selectedProductObj.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {warehouses.map(w => {
                            const stock = productCurrentStocks[w.id] ?? 0;
                            const isSelected = selectedWarehouseId === w.id;
                            return (
                                <button
                                    key={w.id}
                                    type="button"
                                    onClick={() => setSelectedWarehouseId(isSelected ? 'all' : w.id)}
                                    className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition ${
                                        isSelected 
                                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-primary/20' 
                                            : stock > 0
                                                ? 'bg-white text-slate-800 border-slate-300 hover:border-slate-400'
                                                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                    }`}
                                    title={`Bấm để ${isSelected ? 'xem tất cả kho' : `lọc riêng kho ${w.name}`}`}
                                >
                                    <span>{w.name}:</span>
                                    <span className={`font-black ${isSelected ? 'text-amber-300' : stock > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{stock}</span>
                                </button>
                            );
                        })}
                        <div className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800">
                            <span>Tổng tồn:</span>
                            <span className="font-black text-emerald-700">
                                {Object.values(productCurrentStocks).reduce((a, b) => a + b, 0)}
                            </span>
                        </div>
                        {selectedWarehouseId !== 'all' && (
                            <button
                                type="button"
                                onClick={() => setSelectedWarehouseId('all')}
                                className="text-[11px] font-bold text-primary hover:underline ml-1"
                            >
                                (Xem tất cả kho)
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Date Filters with Quick Presets */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center space-x-2">
                        <Calendar size={18} className="text-slate-400" />
                        <span className="text-xs font-black uppercase text-slate-500">Từ ngày:</span>
                        <input 
                            type="date" 
                            value={dateRange.start}
                            onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-primary bg-white"
                        />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Calendar size={18} className="text-slate-400" />
                        <span className="text-xs font-black uppercase text-slate-500">Đến ngày:</span>
                        <input 
                            type="date" 
                            value={dateRange.end}
                            onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-primary bg-white"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400 mr-1">Bộ lọc nhanh:</span>
                    <button
                        type="button"
                        onClick={() => setDateRange({ start: '', end: '' })}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${
                            !dateRange.start && !dateRange.end 
                                ? 'bg-slate-800 text-white border-slate-800 shadow-sm' 
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                        Toàn bộ lịch sử
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() - 30);
                            setDateRange({ start: d.toISOString().split('T')[0], end: '' });
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition border bg-white text-slate-600 border-slate-200 hover:bg-slate-100`}
                    >
                        30 ngày
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() - 7);
                            setDateRange({ start: d.toISOString().split('T')[0], end: '' });
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition border bg-white text-slate-600 border-slate-200 hover:bg-slate-100`}
                    >
                        7 ngày
                    </button>
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
                    <p className="text-slate-500 font-bold">Không tìm thấy dữ liệu biến động kho nào trong khoảng thời gian này.</p>
                    {(dateRange.start || dateRange.end) && (
                        <button
                            type="button"
                            onClick={() => setDateRange({ start: '', end: '' })}
                            className="mt-3 px-4 py-2 bg-primary text-white text-xs font-black uppercase rounded-lg hover:bg-primary/90 transition shadow-sm"
                        >
                            Xem toàn bộ lịch sử
                        </button>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-800 text-white text-[10px] uppercase font-black tracking-widest">
                            <tr>
                                <th className="p-4">Thời gian</th>
                                <th className="p-4">Loại biến động</th>
                                <th className="p-4">Sản phẩm</th>
                                <th className="p-4">Kho phát sinh</th>
                                <th className="p-4 text-right">Tồn đầu kho</th>
                                <th className="p-4 text-right">Thay đổi</th>
                                <th className="p-4 text-right">Tồn cuối kho</th>
                                <th className="p-4">Ghi chú / Tham chiếu</th>
                                {userRole === 'admin' && <th className="p-4">Người thực hiện</th>}
                                <th className="p-4 text-center">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredMovements.map((m) => (
                                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-xs font-bold text-slate-600 whitespace-nowrap">
                                        {formatDateSafe(m.createdAt)}
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
                                    <td className="p-4">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded text-[11px] font-black uppercase border ${
                                            m.warehouseName?.toLowerCase().includes('lầu') 
                                                ? 'bg-amber-50 text-amber-900 border-amber-300 font-black'
                                                : m.warehouseName?.toLowerCase().includes('trong')
                                                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                        }`}>
                                            {m.warehouseName}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-bold text-slate-400 text-sm">
                                        {m.balanceBefore !== undefined ? m.balanceBefore : '-'}
                                    </td>
                                    <td className={`p-4 text-right font-black text-sm ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                                    </td>
                                    <td className="p-4 text-right font-black text-dark text-sm">
                                        {m.balanceAfter !== undefined ? (
                                            <span className={m.balanceAfter > 0 ? 'text-primary font-black' : 'text-slate-500'}>
                                                {m.balanceAfter}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="p-4">
                                        <div className="text-xs font-medium text-slate-600">{m.note}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">ID: {m.referenceId}</div>
                                    </td>
                                    {userRole === 'admin' && (
                                        <td className="p-4 text-center">
                                            <span className="inline-flex items-center text-[10px] font-black bg-emerald-50 text-emerald-800 px-2 py-1 rounded-full border border-emerald-200 uppercase">
                                                <User size={12} className="mr-1"/> {m.creatorName || 'Hệ thống'}
                                            </span>
                                        </td>
                                    )}
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
