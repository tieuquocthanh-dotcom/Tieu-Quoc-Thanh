import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, Timestamp, collectionGroup } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Sale, Product, Manufacturer } from '../types';
import { 
    Loader, BarChart3, TrendingUp, Award, Calendar, Search, 
    ArrowUp, ArrowDown, ArrowUpDown, Package, DollarSign, Filter, 
    Info, ShoppingCart, AlertTriangle, CheckCircle2, Zap, Tag, RefreshCw, X, Percent
} from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import Pagination from './Pagination';

interface ProductStats {
    productId: string;
    productName: string;
    manufacturerId: string;
    manufacturerName: string;
    importPrice: number;
    sellingPrice: number;
    unitProfit: number;      // Selling Price - Import Price
    totalQuantity: number;   // Sold quantity in selected date range
    totalRevenue: number;    // Total revenue in selected date range
    totalProfit: number;     // Total profit in selected date range
    profitMargin: number;    // Profit margin percentage (%)
    saleCount: number;       // Number of sale orders
    currentStock: number;    // Current inventory across all warehouses
    warningThreshold: number;
    isRestockRecommended: boolean; // High profit / sales & low stock
}

const getInitialStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
};
const getInitialEndDate = () => new Date().toISOString().split('T')[0];

type SortKey = 'totalProfit' | 'profitMargin' | 'unitProfit' | 'totalQuantity' | 'totalRevenue' | 'productName' | 'currentStock';
type SortDirection = 'asc' | 'desc';

const ProductAnalytics: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState<Sale[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
    const [inventoryMap, setInventoryMap] = useState<Record<string, number>>({});

    // Filters
    const [startDate, setStartDate] = useState(getInitialStartDate());
    const [endDate, setEndDate] = useState(getInitialEndDate());
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedManufacturerId, setSelectedManufacturerId] = useState('all');
    const [minQuantitySoldInput, setMinQuantitySoldInput] = useState<string>('');
    const [quantityPreset, setQuantityPreset] = useState<'all' | 'sold' | 'popular' | 'super' | 'unsold'>('all');
    const [focusFilter, setFocusFilter] = useState<'all' | 'high_profit' | 'high_margin' | 'need_restock'>('all');
    const [showUnsoldProducts, setShowUnsoldProducts] = useState(false);

    // Sorting & Pagination
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
        key: 'totalProfit',
        direction: 'desc'
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Fetch products & manufacturers
    useEffect(() => {
        const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
            setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        });
        const unsubManufacturers = onSnapshot(collection(db, "manufacturers"), (snapshot) => {
            setManufacturers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Manufacturer)));
        });

        // Listen to all warehouse inventory subcollections
        const unsubInventory = onSnapshot(query(collectionGroup(db, 'inventory')), (snapshot) => {
            const map: Record<string, number> = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const productId = doc.ref.parent.parent?.id;
                if (productId) {
                    map[productId] = (map[productId] || 0) + (Number(data.stock) || 0);
                }
            });
            setInventoryMap(map);
        });

        return () => { unsubProducts(); unsubManufacturers(); unsubInventory(); };
    }, []);

    // Fetch sales based on date range
    useEffect(() => {
        setLoading(true);
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const q = query(
            collection(db, "sales"),
            where("createdAt", ">=", Timestamp.fromDate(start)),
            where("createdAt", "<=", Timestamp.fromDate(end))
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
            setLoading(false);
        }, (err) => {
            console.error("Error loading sales analytics:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [startDate, endDate]);

    // Aggregate Data
    const aggregatedData = useMemo(() => {
        const statsMap = new Map<string, ProductStats>();
        const manuMap = new Map<string, string>(manufacturers.map(m => [m.id, m.name]));

        // First populate from products list
        products.forEach(p => {
            const currentStock = inventoryMap[p.id] ?? 0;
            const unitProfit = (p.sellingPrice || 0) - (p.importPrice || 0);
            const baseMargin = p.sellingPrice > 0 ? (unitProfit / p.sellingPrice) * 100 : 0;
            const manufacturerName = manuMap.get(p.manufacturerId) || 'Chưa phân hãng';

            statsMap.set(p.id, {
                productId: p.id,
                productName: p.name,
                manufacturerId: p.manufacturerId || '',
                manufacturerName,
                importPrice: p.importPrice || 0,
                sellingPrice: p.sellingPrice || 0,
                unitProfit,
                totalQuantity: 0,
                totalRevenue: 0,
                totalProfit: 0,
                profitMargin: Math.max(0, baseMargin),
                saleCount: 0,
                currentStock,
                warningThreshold: p.warningThreshold || 5,
                isRestockRecommended: false
            });
        });

        // Now aggregate actual sales data
        sales.forEach(sale => {
            if (!sale.items) return;
            sale.items.forEach(item => {
                let stat = statsMap.get(item.productId);
                
                if (!stat) {
                    const product = products.find(p => p.id === item.productId);
                    const currentStock = inventoryMap[item.productId] ?? 0;
                    const manufacturerName = product ? (manuMap.get(product.manufacturerId) || 'Chưa phân hãng') : 'Chưa phân hãng';
                    const unitProfit = (item.price || 0) - (item.importPrice || 0);

                    stat = {
                        productId: item.productId,
                        productName: item.productName || (product?.name || 'Sản phẩm khác'),
                        manufacturerId: product?.manufacturerId || '',
                        manufacturerName,
                        importPrice: item.importPrice || (product?.importPrice || 0),
                        sellingPrice: item.price || (product?.sellingPrice || 0),
                        unitProfit,
                        totalQuantity: 0,
                        totalRevenue: 0,
                        totalProfit: 0,
                        profitMargin: 0,
                        saleCount: 0,
                        currentStock,
                        warningThreshold: product?.warningThreshold || 5,
                        isRestockRecommended: false
                    };
                    statsMap.set(item.productId, stat);
                }

                const cost = item.importPrice || 0;
                const profit = (item.price - cost) * item.quantity;

                stat.totalQuantity += item.quantity;
                stat.totalRevenue += item.quantity * item.price;
                stat.totalProfit += profit;
                stat.saleCount += 1;
            });
        });

        // Recalculate profit margins & restock recommendations
        const list = Array.from(statsMap.values());
        list.forEach(stat => {
            if (stat.totalRevenue > 0) {
                stat.profitMargin = (stat.totalProfit / stat.totalRevenue) * 100;
            } else if (stat.sellingPrice > 0) {
                stat.profitMargin = ((stat.sellingPrice - stat.importPrice) / stat.sellingPrice) * 100;
            }
            if (stat.profitMargin < 0) stat.profitMargin = 0;

            // Restock recommendation condition: High total profit OR high unit profit OR high quantity sold AND stock is low
            const isGoodSellerOrProfitable = stat.totalProfit >= 100000 || stat.unitProfit >= 20000 || stat.totalQuantity >= 3;
            const isLowStock = stat.currentStock <= stat.warningThreshold;
            stat.isRestockRecommended = isGoodSellerOrProfitable && isLowStock;
        });

        return list;
    }, [sales, products, manufacturers, inventoryMap]);

    // Filter and Sort Data
    const processedData = useMemo(() => {
        let result = aggregatedData;

        // Filter unsold items unless toggle or search requires it
        if (!showUnsoldProducts && quantityPreset !== 'unsold' && !minQuantitySoldInput) {
            result = result.filter(item => item.totalQuantity > 0 || item.saleCount > 0);
        }

        // Filter by Search term (Product name OR Manufacturer name)
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            result = result.filter(item => 
                item.productName.toLowerCase().includes(term) ||
                item.manufacturerName.toLowerCase().includes(term)
            );
        }

        // Filter by Manufacturer Dropdown
        if (selectedManufacturerId !== 'all') {
            result = result.filter(item => item.manufacturerId === selectedManufacturerId);
        }

        // Filter by Quantity Sold Presets & Inputs
        if (minQuantitySoldInput !== '') {
            const minQty = parseInt(minQuantitySoldInput, 10) || 0;
            result = result.filter(item => item.totalQuantity >= minQty);
        } else {
            if (quantityPreset === 'sold') {
                result = result.filter(item => item.totalQuantity > 0);
            } else if (quantityPreset === 'popular') {
                result = result.filter(item => item.totalQuantity >= 10);
            } else if (quantityPreset === 'super') {
                result = result.filter(item => item.totalQuantity >= 50);
            } else if (quantityPreset === 'unsold') {
                result = result.filter(item => item.totalQuantity === 0);
            }
        }

        // Filter by Focus Pills
        if (focusFilter === 'high_profit') {
            result = result.filter(item => item.totalProfit > 0);
        } else if (focusFilter === 'high_margin') {
            result = result.filter(item => item.profitMargin >= 30);
        } else if (focusFilter === 'need_restock') {
            result = result.filter(item => item.isRestockRecommended || (item.totalQuantity > 0 && item.currentStock <= item.warningThreshold));
        }

        // Sorting
        result.sort((a, b) => {
            let valA: any = a[sortConfig.key];
            let valB: any = b[sortConfig.key];

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortConfig.direction === 'asc' 
                    ? valA.localeCompare(valB, 'vi') 
                    : valB.localeCompare(valA, 'vi');
            }

            return sortConfig.direction === 'asc' 
                ? (valA as number) - (valB as number) 
                : (valB as number) - (valA as number);
        });

        return result;
    }, [
        aggregatedData, searchTerm, selectedManufacturerId, 
        minQuantitySoldInput, quantityPreset, focusFilter, 
        showUnsoldProducts, sortConfig
    ]);

    // Top 3 Profit Products
    const top3ProfitProducts = useMemo(() => {
        return [...aggregatedData]
            .filter(p => p.totalProfit > 0)
            .sort((a, b) => b.totalProfit - a.totalProfit)
            .slice(0, 3);
    }, [aggregatedData]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return processedData.slice(start, start + pageSize);
    }, [processedData, currentPage, pageSize]);

    const handleSort = (key: SortKey) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
        setCurrentPage(1);
    };

    const setQuickSort = (key: SortKey) => {
        setSortConfig({ key, direction: 'desc' });
        setCurrentPage(1);
    };

    const renderSortIcon = (key: SortKey) => {
        if (sortConfig.key !== key) return <ArrowUpDown size={14} className="ml-1 opacity-30 inline" />;
        return sortConfig.direction === 'asc' 
            ? <ArrowUp size={14} className="ml-1 text-emerald-600 inline font-bold" /> 
            : <ArrowDown size={14} className="ml-1 text-emerald-600 inline font-bold" />;
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        setSelectedManufacturerId('all');
        setMinQuantitySoldInput('');
        setQuantityPreset('all');
        setFocusFilter('all');
        setShowUnsoldProducts(false);
        setSortConfig({ key: 'totalProfit', direction: 'desc' });
        setCurrentPage(1);
    };

    const hasActiveFilters = searchTerm !== '' || selectedManufacturerId !== 'all' || minQuantitySoldInput !== '' || quantityPreset !== 'all' || focusFilter !== 'all' || showUnsoldProducts;

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in space-y-6">
            {/* Title & Date Selector Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                        <BarChart3 className="text-emerald-600" size={32}/>
                        Phân Tích Hiệu Quả & Lợi Nhuận Sản Phẩm
                    </h1>
                    <p className="text-slate-500 text-xs md:text-sm mt-1">
                        So sánh lợi nhuận, tỷ suất sinh lời % và số lượng bán để quyết định sản phẩm cần nhập thêm.
                    </p>
                </div>

                <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200 w-full md:w-auto justify-between md:justify-start">
                    <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-emerald-600 flex-shrink-0"/>
                        <div className="flex items-center gap-1.5">
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }} 
                                className="px-2.5 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs md:text-sm font-black focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                                style={{ colorScheme: 'light' }}
                            />
                            <span className="text-slate-400 text-xs font-black uppercase">Đến</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }} 
                                className="px-2.5 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs md:text-sm font-black focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                                style={{ colorScheme: 'light' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-5 rounded-2xl shadow-md text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-blue-100 text-[11px] font-black uppercase tracking-wider mb-1">Doanh Thu Kỳ Này</p>
                            <h3 className="text-2xl font-black">{formatNumber(sales.reduce((a, b) => a + b.total, 0))} ₫</h3>
                            <p className="text-blue-200 text-[11px] mt-1 font-medium">{sales.length} đơn hàng đã bán</p>
                        </div>
                        <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
                            <DollarSign size={22} />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-5 rounded-2xl shadow-md text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-emerald-100 text-[11px] font-black uppercase tracking-wider mb-1">Lợi Nhuận Gộp Tổng</p>
                            <h3 className="text-2xl font-black">
                                {formatNumber(aggregatedData.reduce((a, b) => a + b.totalProfit, 0))} ₫
                            </h3>
                            <p className="text-emerald-200 text-[11px] mt-1 font-medium">
                                Tỷ suất lãi TB: {
                                    sales.reduce((a, b) => a + b.total, 0) > 0 
                                        ? ((aggregatedData.reduce((a, b) => a + b.totalProfit, 0) / sales.reduce((a, b) => a + b.total, 0)) * 100).toFixed(1)
                                        : '0'
                                }%
                            </p>
                        </div>
                        <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
                            <TrendingUp size={22} />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-5 rounded-2xl shadow-md text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-purple-100 text-[11px] font-black uppercase tracking-wider mb-1">Tổng SL Đã Bán</p>
                            <h3 className="text-2xl font-black">
                                {formatNumber(aggregatedData.reduce((a, b) => a + b.totalQuantity, 0))} sp
                            </h3>
                            <p className="text-purple-200 text-[11px] mt-1 font-medium">
                                {aggregatedData.filter(p => p.totalQuantity > 0).length} mã sản phẩm có giao dịch
                            </p>
                        </div>
                        <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
                            <ShoppingCart size={22} />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-5 rounded-2xl shadow-md text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-amber-100 text-[11px] font-black uppercase tracking-wider mb-1">Cần Nhập Thêm</p>
                            <h3 className="text-2xl font-black">
                                {aggregatedData.filter(p => p.isRestockRecommended).length} mã SP
                            </h3>
                            <p className="text-amber-100 text-[11px] mt-1 font-medium">
                                Lợi nhuận tốt & Kho sắp hết
                            </p>
                        </div>
                        <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
                            <AlertTriangle size={22} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Top 3 High-Profit Products Banner */}
            {top3ProfitProducts.length > 0 && (
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-5 rounded-2xl text-white shadow-xl border border-slate-800">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
                        <div className="flex items-center gap-2">
                            <Award className="text-yellow-400" size={20} />
                            <h2 className="text-sm font-black uppercase tracking-wider text-yellow-400">
                                Top 3 Sản Phẩm Lợi Nhuận Cao Nhất Kỳ Này
                            </h2>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                            Gợi ý ưu tiên nhập hàng kinh doanh
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {top3ProfitProducts.map((p, idx) => (
                            <div key={p.productId} className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80 hover:border-emerald-500/50 transition-all flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase">
                                            #{idx + 1} Lợi Nhuận
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 truncate">
                                            {p.manufacturerName}
                                        </span>
                                    </div>
                                    <h3 className="font-black text-sm text-white line-clamp-1 mb-2" title={p.productName}>
                                        {p.productName}
                                    </h3>
                                </div>

                                <div className="space-y-1.5 text-xs pt-2 border-t border-slate-700/60">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 text-[11px]">Lợi nhuận tổng:</span>
                                        <span className="font-black text-emerald-400 text-sm">{formatNumber(p.totalProfit)} ₫</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-400">Đã bán / Tỷ suất:</span>
                                        <span className="font-bold text-slate-200">
                                            {p.totalQuantity} sp <span className="text-emerald-400">({p.profitMargin.toFixed(1)}%)</span>
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-400">Tồn kho hiện tại:</span>
                                        <span className={`font-black ${p.currentStock <= p.warningThreshold ? 'text-rose-400' : 'text-emerald-300'}`}>
                                            {p.currentStock} sp {p.currentStock <= p.warningThreshold ? '⚠️ (Ít)' : '✓'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filter & Search Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
                <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
                    {/* Search by Name or Manufacturer */}
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                        <input 
                            type="text" 
                            placeholder="Tìm tên sản phẩm hoặc tên Hãng..." 
                            value={searchTerm} 
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none text-sm text-slate-900 font-bold placeholder:font-normal placeholder:text-slate-400 transition-all"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Filter by Manufacturer */}
                    <div className="flex items-center gap-2">
                        <Tag size={16} className="text-slate-400 hidden sm:inline" />
                        <select 
                            value={selectedManufacturerId} 
                            onChange={e => { setSelectedManufacturerId(e.target.value); setCurrentPage(1); }}
                            className="px-3 py-2 bg-slate-900 text-white border border-slate-800 rounded-xl text-xs md:text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer w-full sm:w-auto"
                        >
                            <option value="all">Tất cả hãng sản xuất ({manufacturers.length})</option>
                            {manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>

                    {/* Filter by Quantity Sold */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-500 whitespace-nowrap hidden sm:inline">SL bán ≥</span>
                        <input 
                            type="number" 
                            placeholder="SL bán tối thiểu..." 
                            value={minQuantitySoldInput} 
                            onChange={e => { setMinQuantitySoldInput(e.target.value); setCurrentPage(1); }}
                            className="w-full sm:w-36 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs md:text-sm font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                </div>

                {/* Filter Presets & Quick Sort Buttons */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center gap-3">
                    {/* Quantity Preset Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                        <span className="text-slate-400 text-[11px] uppercase tracking-wider font-black mr-1">Lọc SL bán:</span>
                        {[
                            { id: 'all', label: 'Tất cả' },
                            { id: 'sold', label: 'Đã bán (>0)' },
                            { id: 'popular', label: 'Bán chạy (≥10)' },
                            { id: 'super', label: 'Bán nhiều (≥50)' },
                            { id: 'unsold', label: 'Chưa bán (0)' },
                        ].map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => { setQuantityPreset(preset.id as any); setMinQuantitySoldInput(''); setCurrentPage(1); }}
                                className={`px-2.5 py-1 rounded-lg transition-all ${
                                    quantityPreset === preset.id && !minQuantitySoldInput 
                                        ? 'bg-slate-900 text-white font-black shadow-sm' 
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* Focus Filter Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                        <span className="text-slate-400 text-[11px] uppercase tracking-wider font-black mr-1">Tiêu chí:</span>
                        <button
                            onClick={() => { setFocusFilter('all'); setCurrentPage(1); }}
                            className={`px-2.5 py-1 rounded-lg transition-all ${focusFilter === 'all' ? 'bg-emerald-600 text-white font-black' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            Tất cả
                        </button>
                        <button
                            onClick={() => { setFocusFilter('high_profit'); setQuickSort('totalProfit'); }}
                            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${focusFilter === 'high_profit' ? 'bg-emerald-700 text-white font-black shadow-sm' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}
                        >
                            <DollarSign size={13}/> Lợi Nhuận Cao
                        </button>
                        <button
                            onClick={() => { setFocusFilter('high_margin'); setQuickSort('profitMargin'); }}
                            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${focusFilter === 'high_margin' ? 'bg-blue-700 text-white font-black shadow-sm' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'}`}
                        >
                            <Percent size={13}/> Tỷ Suất Lãi % (≥30%)
                        </button>
                        <button
                            onClick={() => { setFocusFilter('need_restock'); setQuickSort('totalProfit'); }}
                            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${focusFilter === 'need_restock' ? 'bg-rose-600 text-white font-black shadow-sm' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`}
                        >
                            <AlertTriangle size={13}/> 🔥 Cần Nhập Hàng (Tồn thấp)
                        </button>
                    </div>
                </div>

                {/* Additional controls & reset */}
                <div className="pt-2 flex flex-wrap justify-between items-center text-xs gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-bold select-none">
                        <input 
                            type="checkbox" 
                            checked={showUnsoldProducts} 
                            onChange={e => { setShowUnsoldProducts(e.target.checked); setCurrentPage(1); }}
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                        />
                        <span>Hiện cả các sản phẩm chưa bán được trong kỳ (Để xem giá nhập & tỷ suất lãi)</span>
                    </label>

                    {hasActiveFilters && (
                        <button 
                            onClick={clearAllFilters}
                            className="text-rose-600 font-bold hover:underline flex items-center gap-1 text-xs ml-auto"
                        >
                            <RefreshCw size={12}/> Xóa tất cả bộ lọc
                        </button>
                    )}
                </div>
            </div>

            {/* Main Data Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Table Header Controls */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="text-xs font-black text-slate-700 flex items-center gap-2">
                        <span>Danh sách phân tích: <strong className="text-emerald-700 text-sm">{processedData.length}</strong> sản phẩm</span>
                        {focusFilter !== 'all' && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-black uppercase">
                                Đã lọc tiêu chí
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Info size={14} className="text-slate-400" />
                        <span>Bấm vào tiêu đề cột để sắp xếp tăng / giảm.</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader className="animate-spin text-emerald-600 mr-2" size={32} />
                            <span className="text-sm font-bold text-slate-600">Đang tải dữ liệu kinh doanh...</span>
                        </div>
                    ) : processedData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Package size={56} className="mb-3 opacity-30" />
                            <p className="text-base font-bold text-slate-700">Không tìm thấy sản phẩm nào phù hợp bộ lọc.</p>
                            <p className="text-xs text-slate-400 mt-1">Hãy thử xóa từ khóa tìm kiếm hoặc đổi khoảng thời gian.</p>
                            {hasActiveFilters && (
                                <button onClick={clearAllFilters} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition">
                                    Xóa Bộ Lọc
                                </button>
                            )}
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                                <tr>
                                    <th className="p-3.5 cursor-pointer hover:bg-slate-200 transition" onClick={() => handleSort('productName')}>
                                        Tên Sản Phẩm & Hãng {renderSortIcon('productName')}
                                    </th>
                                    <th className="p-3.5 text-center cursor-pointer hover:bg-slate-200 transition" onClick={() => handleSort('currentStock')}>
                                        Tồn Kho {renderSortIcon('currentStock')}
                                    </th>
                                    <th className="p-3.5 text-right cursor-pointer hover:bg-slate-200 transition" onClick={() => handleSort('unitProfit')}>
                                        Giá Nhập / Giá Bán (Lãi/SP) {renderSortIcon('unitProfit')}
                                    </th>
                                    <th className="p-3.5 text-center cursor-pointer hover:bg-slate-200 transition" onClick={() => handleSort('totalQuantity')}>
                                        SL Bán {renderSortIcon('totalQuantity')}
                                    </th>
                                    <th className="p-3.5 text-right cursor-pointer hover:bg-slate-200 transition" onClick={() => handleSort('totalRevenue')}>
                                        Doanh Thu {renderSortIcon('totalRevenue')}
                                    </th>
                                    <th className="p-3.5 text-right cursor-pointer bg-emerald-100/70 hover:bg-emerald-200 transition text-emerald-950 font-black" onClick={() => handleSort('totalProfit')}>
                                        Lợi Nhuận Tổng {renderSortIcon('totalProfit')}
                                    </th>
                                    <th className="p-3.5 text-center cursor-pointer bg-blue-100/70 hover:bg-blue-200 transition text-blue-950 font-black" onClick={() => handleSort('profitMargin')}>
                                        Tỷ Suất Lãi (%) {renderSortIcon('profitMargin')}
                                    </th>
                                    <th className="p-3.5 text-center">Gợi Ý Nhập</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {paginatedData.map((stat) => {
                                    const isTopSold = stat.totalQuantity > 0 && stat.totalQuantity === Math.max(...processedData.map(d => d.totalQuantity));
                                    const isTopProfit = stat.totalProfit > 0 && stat.totalProfit === Math.max(...processedData.map(d => d.totalProfit));
                                    const isLowStock = stat.currentStock <= stat.warningThreshold;

                                    return (
                                        <tr key={stat.productId} className="hover:bg-slate-50/80 transition-colors group">
                                            {/* Product Name & Brand */}
                                            <td className="p-3.5 font-bold text-slate-900">
                                                <div className="flex flex-col">
                                                    <span className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                                                        {stat.productName}
                                                        {isTopProfit && (
                                                            <span className="inline-flex items-center text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800" title="Sản phẩm có lợi nhuận cao nhất">
                                                                🏆 LN Cao
                                                            </span>
                                                        )}
                                                        {isTopSold && (
                                                            <span className="inline-flex items-center text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800" title="Sản phẩm bán chạy nhất">
                                                                🔥 Bán Chạy
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-[11px] font-medium text-slate-400 mt-0.5">
                                                        Hãng: <strong className="text-slate-600">{stat.manufacturerName}</strong>
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Current Stock */}
                                            <td className="p-3.5 text-center">
                                                <span className={`inline-block px-2.5 py-1 rounded-lg font-black text-xs ${
                                                    isLowStock 
                                                        ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse' 
                                                        : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {stat.currentStock} sp
                                                </span>
                                            </td>

                                            {/* Prices & Unit Profit */}
                                            <td className="p-3.5 text-right font-medium text-slate-700">
                                                <div>
                                                    <span className="text-[11px] text-slate-400 block">
                                                        Nhập: {formatNumber(stat.importPrice)}₫ | Bán: {formatNumber(stat.sellingPrice)}₫
                                                    </span>
                                                    <span className="font-black text-emerald-700 text-xs">
                                                        Lãi/SP: +{formatNumber(stat.unitProfit)} ₫
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Sold Quantity */}
                                            <td className="p-3.5 text-center">
                                                <span className={`inline-block px-3 py-1 rounded-full font-black text-xs ${
                                                    stat.totalQuantity >= 10 
                                                        ? 'bg-amber-100 text-amber-800' 
                                                        : stat.totalQuantity > 0 
                                                            ? 'bg-blue-50 text-blue-700' 
                                                            : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                    {stat.totalQuantity}
                                                </span>
                                            </td>

                                            {/* Revenue */}
                                            <td className="p-3.5 text-right font-bold text-slate-600">
                                                {formatNumber(stat.totalRevenue)} ₫
                                            </td>

                                            {/* Total Profit */}
                                            <td className="p-3.5 text-right font-black text-emerald-700 bg-emerald-50/40 text-sm group-hover:bg-emerald-50 transition-colors">
                                                {formatNumber(stat.totalProfit)} ₫
                                            </td>

                                            {/* Margin % */}
                                            <td className="p-3.5 text-center font-black bg-blue-50/40 group-hover:bg-blue-50 transition-colors">
                                                <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                                                    stat.profitMargin >= 40 
                                                        ? 'bg-emerald-600 text-white' 
                                                        : stat.profitMargin >= 20 
                                                            ? 'bg-blue-600 text-white' 
                                                            : 'bg-slate-200 text-slate-700'
                                                }`}>
                                                    {stat.profitMargin.toFixed(1)}%
                                                </span>
                                            </td>

                                            {/* Restock Recommendation Badge */}
                                            <td className="p-3.5 text-center">
                                                {stat.isRestockRecommended ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg bg-rose-600 text-white shadow-sm animate-bounce">
                                                        <AlertTriangle size={12}/> NÊN NHẬP
                                                    </span>
                                                ) : isLowStock ? (
                                                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                                        Cần theo dõi
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-400">
                                                        Đủ hàng
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <Pagination 
                    currentPage={currentPage} 
                    pageSize={pageSize} 
                    totalItems={processedData.length} 
                    onPageChange={setCurrentPage} 
                    onPageSizeChange={setPageSize} 
                />
            </div>

            <style>{`
                @keyframes fade-in { 
                    0% { opacity: 0; transform: translateY(10px); } 
                    100% { opacity: 1; transform: translateY(0); } 
                }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default ProductAnalytics;
