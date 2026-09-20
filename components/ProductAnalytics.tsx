import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, Timestamp, collectionGroup, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Sale, Product, ProductCategory, Manufacturer, Supplier, GoodsReceipt } from '../types';
import { 
    Loader, BarChart3, TrendingUp, Award, Calendar, Search, 
    ArrowUp, ArrowDown, ArrowUpDown, Package, DollarSign, Filter, 
    Info, ShoppingCart, AlertTriangle, CheckCircle2, Zap, Tag, Tags, RefreshCw, 
    X, Percent, Users, Download, ChevronRight, SlidersHorizontal, Flame, Sparkles
} from 'lucide-react';
import { formatNumber, parseNumber, getLocalYYYYMMDD } from '../utils/formatting';
import { searchVietnameseMatch } from '../utils/vietnameseSearch';
import Pagination from './Pagination';

interface ProductStats {
    productId: string;
    productName: string;
    shortName?: string;
    categoryId?: string;
    categoryName?: string;
    manufacturerId: string;
    manufacturerName: string;
    supplierIds: string[];
    supplierNames: string[];
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
    date.setDate(date.getDate() - 29);
    return getLocalYYYYMMDD(date);
};
const getInitialEndDate = () => getLocalYYYYMMDD(new Date());

type SortKey = 'totalProfit' | 'profitMargin' | 'unitProfit' | 'totalQuantity' | 'totalRevenue' | 'productName' | 'currentStock' | 'sellingPrice' | 'importPrice';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'top_profit' | 'top_sellers' | 'top_margin' | 'need_restock' | 'all';
type DatePreset = 'today' | 'yesterday' | '7days' | '30days' | 'this_month' | 'last_month' | 'this_year' | 'all' | 'custom';
type PricePreset = 'all' | 'under100k' | '100k_500k' | '500k_2m' | '2m_5m' | 'above5m' | 'custom';

const ProductAnalytics: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState<Sale[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [inventoryMap, setInventoryMap] = useState<Record<string, number>>({});
    const [productSuppliersMap, setProductSuppliersMap] = useState<Record<string, { supplierIds: string[]; supplierNames: string[] }>>({});

    // Main View Mode
    const [viewMode, setViewMode] = useState<ViewMode>('top_profit');

    // Date Filters
    const [startDate, setStartDate] = useState(getInitialStartDate());
    const [endDate, setEndDate] = useState(getInitialEndDate());
    const [datePreset, setDatePreset] = useState<DatePreset>('30days');

    // Search & Entity Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState('all');
    const [selectedManufacturerId, setSelectedManufacturerId] = useState('all');
    const [selectedSupplierId, setSelectedSupplierId] = useState('all');

    // Price Range Filter
    const [priceType, setPriceType] = useState<'selling' | 'import'>('selling');
    const [pricePreset, setPricePreset] = useState<PricePreset>('all');
    const [minPriceInput, setMinPriceInput] = useState<string>('');
    const [maxPriceInput, setMaxPriceInput] = useState<string>('');

    // Quantity sold filter
    const [minQuantitySoldInput, setMinQuantitySoldInput] = useState<string>('');
    const [showUnsoldProducts, setShowUnsoldProducts] = useState(false);

    // Sorting & Pagination
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
        key: 'totalProfit',
        direction: 'desc'
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Fetch Products, Manufacturers, Suppliers, GoodsReceipts (for supplier mapping), and Inventory
    useEffect(() => {
        const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
            setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        });

        const unsubManufacturers = onSnapshot(collection(db, "manufacturers"), (snapshot) => {
            setManufacturers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Manufacturer)));
        });

        const unsubCategories = onSnapshot(query(collection(db, "product_categories"), orderBy("name")), (snapshot) => {
            setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductCategory)));
        });

        const unsubSuppliers = onSnapshot(collection(db, "suppliers"), (snapshot) => {
            setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
        });

        // Track suppliers for each product through goodsReceipts
        const unsubGoodsReceipts = onSnapshot(collection(db, "goodsReceipts"), (snapshot) => {
            const supMap: Record<string, { ids: Set<string>; names: Set<string> }> = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data() as GoodsReceipt;
                if (data.items && Array.isArray(data.items)) {
                    data.items.forEach(item => {
                        if (!item.productId) return;
                        if (!supMap[item.productId]) {
                            supMap[item.productId] = { ids: new Set(), names: new Set() };
                        }
                        if (data.supplierId) supMap[item.productId].ids.add(data.supplierId);
                        if (data.supplierName) supMap[item.productId].names.add(data.supplierName);
                    });
                }
            });

            const finalMap: Record<string, { supplierIds: string[]; supplierNames: string[] }> = {};
            Object.keys(supMap).forEach(pId => {
                finalMap[pId] = {
                    supplierIds: Array.from(supMap[pId].ids),
                    supplierNames: Array.from(supMap[pId].names)
                };
            });
            setProductSuppliersMap(finalMap);
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

        return () => {
            unsubProducts();
            unsubManufacturers();
            unsubCategories();
            unsubSuppliers();
            unsubGoodsReceipts();
            unsubInventory();
        };
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

    // Handle Quick Date Presets
    const handleDatePreset = (preset: DatePreset) => {
        setDatePreset(preset);
        const now = new Date();
        let start = new Date();
        let end = new Date();

        if (preset === 'today') {
            // start & end are today
        } else if (preset === 'yesterday') {
            start.setDate(now.getDate() - 1);
            end.setDate(now.getDate() - 1);
        } else if (preset === '7days') {
            start.setDate(now.getDate() - 6);
        } else if (preset === '30days') {
            start.setDate(now.getDate() - 29);
        } else if (preset === 'this_month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (preset === 'last_month') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
        } else if (preset === 'this_year') {
            start = new Date(now.getFullYear(), 0, 1);
        } else if (preset === 'all') {
            start = new Date(2020, 0, 1);
        }

        setStartDate(getLocalYYYYMMDD(start));
        setEndDate(getLocalYYYYMMDD(end));
        setCurrentPage(1);
    };

    // Handle Quick Price Presets
    const handlePricePreset = (preset: PricePreset) => {
        setPricePreset(preset);
        if (preset === 'all') {
            setMinPriceInput('');
            setMaxPriceInput('');
        } else if (preset === 'under100k') {
            setMinPriceInput('');
            setMaxPriceInput('100000');
        } else if (preset === '100k_500k') {
            setMinPriceInput('100000');
            setMaxPriceInput('500000');
        } else if (preset === '500k_2m') {
            setMinPriceInput('500000');
            setMaxPriceInput('2000000');
        } else if (preset === '2m_5m') {
            setMinPriceInput('2000000');
            setMaxPriceInput('5000000');
        } else if (preset === 'above5m') {
            setMinPriceInput('5000000');
            setMaxPriceInput('');
        }
        setCurrentPage(1);
    };

    // Handle View Mode Tabs
    const handleViewModeChange = (mode: ViewMode) => {
        setViewMode(mode);
        setCurrentPage(1);
        if (mode === 'top_profit') {
            setSortConfig({ key: 'totalProfit', direction: 'desc' });
        } else if (mode === 'top_sellers') {
            setSortConfig({ key: 'totalQuantity', direction: 'desc' });
        } else if (mode === 'top_margin') {
            setSortConfig({ key: 'profitMargin', direction: 'desc' });
        } else if (mode === 'need_restock') {
            setSortConfig({ key: 'totalProfit', direction: 'desc' });
        }
    };

    // Aggregate Data
    const aggregatedData = useMemo(() => {
        const statsMap = new Map<string, ProductStats>();
        const manuMap = new Map<string, string>(manufacturers.map(m => [m.id, m.name]));
        const catMap = new Map<string, string>(categories.map(c => [c.id, c.name]));

        // First populate from products catalog
        products.forEach(p => {
            const currentStock = inventoryMap[p.id] ?? 0;
            const unitProfit = (p.sellingPrice || 0) - (p.importPrice || 0);
            const baseMargin = p.sellingPrice > 0 ? (unitProfit / p.sellingPrice) * 100 : 0;
            const manufacturerName = manuMap.get(p.manufacturerId) || 'Chưa phân hãng';
            const categoryName = (p.categoryId && catMap.get(p.categoryId)) || p.categoryName || undefined;
            const supInfo = productSuppliersMap[p.id] || { supplierIds: [], supplierNames: [] };

            statsMap.set(p.id, {
                productId: p.id,
                productName: p.name,
                shortName: p.shortName || '',
                categoryId: p.categoryId || '',
                categoryName,
                manufacturerId: p.manufacturerId || '',
                manufacturerName,
                supplierIds: supInfo.supplierIds,
                supplierNames: supInfo.supplierNames,
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
                    const categoryName = product ? ((product.categoryId && catMap.get(product.categoryId)) || product.categoryName || undefined) : undefined;
                    const supInfo = productSuppliersMap[item.productId] || { supplierIds: [], supplierNames: [] };
                    const unitProfit = (item.price || 0) - (item.importPrice || 0);

                    stat = {
                        productId: item.productId,
                        productName: item.productName || (product?.name || 'Sản phẩm khác'),
                        shortName: product?.shortName || '',
                        categoryId: product?.categoryId || '',
                        categoryName,
                        manufacturerId: product?.manufacturerId || '',
                        manufacturerName,
                        supplierIds: supInfo.supplierIds,
                        supplierNames: supInfo.supplierNames,
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

                const cost = item.importPrice || (stat.importPrice || 0);
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

            // Restock recommendation condition
            const isGoodSellerOrProfitable = stat.totalProfit >= 100000 || stat.unitProfit >= 20000 || stat.totalQuantity >= 3;
            const isLowStock = stat.currentStock <= stat.warningThreshold;
            stat.isRestockRecommended = isGoodSellerOrProfitable && isLowStock;
        });

        return list;
    }, [sales, products, manufacturers, categories, inventoryMap, productSuppliersMap]);

    // Filter and Sort Data
    const processedData = useMemo(() => {
        let result = [...aggregatedData];

        // Filter unsold items based on view mode or checkbox
        if (viewMode === 'top_profit' || viewMode === 'top_sellers' || viewMode === 'top_margin') {
            if (!showUnsoldProducts) {
                result = result.filter(item => item.totalQuantity > 0 || item.totalRevenue > 0);
            }
        } else if (viewMode === 'need_restock') {
            result = result.filter(item => item.isRestockRecommended || (item.totalQuantity > 0 && item.currentStock <= item.warningThreshold));
        } else if (viewMode === 'all') {
            if (!showUnsoldProducts && !searchTerm.trim() && selectedManufacturerId === 'all' && selectedSupplierId === 'all' && pricePreset === 'all' && !minPriceInput && !maxPriceInput) {
                result = result.filter(item => item.totalQuantity > 0 || item.saleCount > 0);
            }
        }

        // 1. Search term filter (Matches: Product Name, Short Name, Category, Brand/Manufacturer, Supplier Name)
        if (searchTerm.trim()) {
            const term = searchTerm.trim();
            result = result.filter(item => 
                searchVietnameseMatch(item.productName, term) ||
                (item.shortName && searchVietnameseMatch(item.shortName, term)) ||
                (item.categoryName && searchVietnameseMatch(item.categoryName, term)) ||
                (item.manufacturerName && searchVietnameseMatch(item.manufacturerName, term)) ||
                (item.supplierNames && item.supplierNames.some(s => searchVietnameseMatch(s, term)))
            );
        }

        // 2. Filter by Product Category (Loại Sản Phẩm)
        if (selectedCategoryId !== 'all') {
            if (selectedCategoryId === 'uncategorized') {
                result = result.filter(item => !item.categoryId && !item.categoryName);
            } else {
                const selectedCat = categories.find(c => c.id === selectedCategoryId);
                result = result.filter(item => 
                    item.categoryId === selectedCategoryId || 
                    (selectedCat && item.categoryName && selectedCat.name.toLowerCase() === item.categoryName.toLowerCase())
                );
            }
        }

        // 3. Filter by Manufacturer Dropdown
        if (selectedManufacturerId !== 'all') {
            result = result.filter(item => item.manufacturerId === selectedManufacturerId);
        }

        // 4. Filter by Supplier Dropdown
        if (selectedSupplierId !== 'all') {
            result = result.filter(item => item.supplierIds && item.supplierIds.includes(selectedSupplierId));
        }

        // 4. Filter by Price Range
        const parsedMinPrice = minPriceInput ? parseNumber(minPriceInput) : null;
        const parsedMaxPrice = maxPriceInput ? parseNumber(maxPriceInput) : null;

        if (parsedMinPrice !== null || parsedMaxPrice !== null) {
            result = result.filter(item => {
                const targetPrice = priceType === 'selling' ? item.sellingPrice : item.importPrice;
                if (parsedMinPrice !== null && targetPrice < parsedMinPrice) return false;
                if (parsedMaxPrice !== null && targetPrice > parsedMaxPrice) return false;
                return true;
            });
        }

        // 5. Filter by Min Quantity Sold input
        if (minQuantitySoldInput !== '') {
            const minQty = parseInt(minQuantitySoldInput, 10) || 0;
            result = result.filter(item => item.totalQuantity >= minQty);
        }

        // 6. Sorting
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
        aggregatedData, viewMode, showUnsoldProducts, searchTerm, 
        categories, selectedCategoryId, selectedManufacturerId, selectedSupplierId, priceType,
        minPriceInput, maxPriceInput, minQuantitySoldInput, sortConfig
    ]);

    // Top Performers for Highlight Banners
    const topProfitProducts = useMemo(() => {
        return [...aggregatedData]
            .filter(p => p.totalProfit > 0)
            .sort((a, b) => b.totalProfit - a.totalProfit)
            .slice(0, 3);
    }, [aggregatedData]);

    const topSoldProducts = useMemo(() => {
        return [...aggregatedData]
            .filter(p => p.totalQuantity > 0)
            .sort((a, b) => b.totalQuantity - a.totalQuantity)
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

    const renderSortIcon = (key: SortKey) => {
        if (sortConfig.key !== key) return <ArrowUpDown size={13} className="ml-1 opacity-30 inline" />;
        return sortConfig.direction === 'asc' 
            ? <ArrowUp size={13} className="ml-1 text-emerald-600 inline font-bold" /> 
            : <ArrowDown size={13} className="ml-1 text-emerald-600 inline font-bold" />;
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        setSelectedCategoryId('all');
        setSelectedManufacturerId('all');
        setSelectedSupplierId('all');
        setMinQuantitySoldInput('');
        setPricePreset('all');
        setMinPriceInput('');
        setMaxPriceInput('');
        setShowUnsoldProducts(false);
        handleDatePreset('30days');
        handleViewModeChange('top_profit');
        setCurrentPage(1);
    };

    const hasActiveFilters = searchTerm !== '' || 
        selectedCategoryId !== 'all' ||
        selectedManufacturerId !== 'all' || 
        selectedSupplierId !== 'all' || 
        minQuantitySoldInput !== '' || 
        pricePreset !== 'all' || 
        minPriceInput !== '' || 
        maxPriceInput !== '' || 
        showUnsoldProducts || 
        datePreset !== '30days' || 
        viewMode !== 'top_profit';

    // Export Table Data to CSV
    const handleExportCSV = () => {
        const headers = [
            'Hạng',
            'Tên Sản Phẩm',
            'Mã Viết Tắt',
            'Loại Sản Phẩm',
            'Hãng Sản Xuất',
            'Nhà Cung Cấp',
            'Tồn Kho',
            'Giá Nhập (VNĐ)',
            'Giá Bán (VNĐ)',
            'Lãi/SP (VNĐ)',
            'SL Đã Bán',
            'Doanh Thu (VNĐ)',
            'Lợi Nhuận Tổng (VNĐ)',
            'Tỷ Suất Lãi (%)',
            'Đề Xuất Nhập'
        ];

        const rows = processedData.map((stat, idx) => [
            idx + 1,
            `"${(stat.productName || '').replace(/"/g, '""')}"`,
            `"${(stat.shortName || '').replace(/"/g, '""')}"`,
            `"${(stat.categoryName || 'Chưa phân loại').replace(/"/g, '""')}"`,
            `"${(stat.manufacturerName || '').replace(/"/g, '""')}"`,
            `"${(stat.supplierNames?.join(', ') || 'Chưa có NCC').replace(/"/g, '""')}"`,
            stat.currentStock,
            stat.importPrice,
            stat.sellingPrice,
            stat.unitProfit,
            stat.totalQuantity,
            stat.totalRevenue,
            stat.totalProfit,
            `${stat.profitMargin.toFixed(1)}%`,
            stat.isRestockRecommended ? 'Nên Nhập Hàng' : stat.currentStock <= stat.warningThreshold ? 'Tồn Thấp' : 'Đủ Hàng'
        ]);

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Bao_Cao_Loi_Nhuan_Va_Ban_Chay_${startDate}_den_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Calculate Grand Totals
    const grandRevenue = useMemo(() => sales.reduce((a, b) => a + (b.total || 0), 0), [sales]);
    const grandProfit = useMemo(() => aggregatedData.reduce((a, b) => a + (b.totalProfit || 0), 0), [aggregatedData]);
    const grandSoldQty = useMemo(() => aggregatedData.reduce((a, b) => a + (b.totalQuantity || 0), 0), [aggregatedData]);

    return (
        <div className="p-3 sm:p-5 md:p-6 max-w-7xl mx-auto space-y-5 animate-fade-in font-sans">
            {/* 1. MAIN HEADER & DATE CONTROLS */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm">
                                <Award size={24} />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                    Tìm Sản Phẩm Lợi Nhuận Tốt Nhất & Bán Nhiều Nhất
                                </h1>
                                <p className="text-slate-500 text-xs sm:text-sm font-medium">
                                    Tra cứu hiệu quả kinh doanh theo Nhà cung cấp, Hãng sản xuất, Tầm giá & Khoảng thời gian
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Date Picker & Range Controls */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
                            <Calendar size={16} className="text-emerald-700 ml-1.5 flex-shrink-0"/>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => { 
                                    setStartDate(e.target.value); 
                                    setDatePreset('custom');
                                    setCurrentPage(1); 
                                }} 
                                className="px-2 py-1 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs font-black focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                                style={{ colorScheme: 'light' }}
                                title="Từ ngày"
                            />
                            <span className="text-slate-400 text-xs font-bold uppercase px-0.5">đến</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => { 
                                    setEndDate(e.target.value); 
                                    setDatePreset('custom');
                                    setCurrentPage(1); 
                                }} 
                                className="px-2 py-1 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs font-black focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                                style={{ colorScheme: 'light' }}
                                title="Đến ngày"
                            />
                        </div>

                        <button 
                            onClick={handleExportCSV}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition whitespace-nowrap"
                            title="Xuất bảng kết quả ra file Excel CSV"
                        >
                            <Download size={15} />
                            <span>Xuất Excel</span>
                        </button>
                    </div>
                </div>

                {/* Quick Date Presets Row */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-slate-400 font-bold uppercase text-[10px] mr-1">Thời gian nhanh:</span>
                    {[
                        { id: 'today', label: 'Hôm nay' },
                        { id: 'yesterday', label: 'Hôm qua' },
                        { id: '7days', label: '7 ngày qua' },
                        { id: '30days', label: '30 ngày qua' },
                        { id: 'this_month', label: 'Tháng này' },
                        { id: 'last_month', label: 'Tháng trước' },
                        { id: 'this_year', label: 'Năm nay' },
                        { id: 'all', label: 'Toàn thời gian' }
                    ].map(dp => (
                        <button
                            key={dp.id}
                            onClick={() => handleDatePreset(dp.id as DatePreset)}
                            className={`px-2.5 py-1 rounded-lg transition-all font-bold ${
                                datePreset === dp.id 
                                    ? 'bg-slate-900 text-white font-black shadow-xs' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {dp.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. KPI SUMMARY CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-4 rounded-2xl shadow-sm text-white flex flex-col justify-between">
                    <div>
                        <p className="text-blue-100 text-[11px] font-black uppercase tracking-wider mb-0.5">Doanh Thu Kỳ Này</p>
                        <h3 className="text-lg sm:text-xl font-black">{formatNumber(grandRevenue)} ₫</h3>
                    </div>
                    <p className="text-blue-200 text-[11px] mt-2 font-medium flex items-center gap-1">
                        <ShoppingCart size={13} /> {sales.length} đơn hàng
                    </p>
                </div>

                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-4 rounded-2xl shadow-sm text-white flex flex-col justify-between">
                    <div>
                        <p className="text-emerald-100 text-[11px] font-black uppercase tracking-wider mb-0.5">Lợi Nhuận Gộp Tổng</p>
                        <h3 className="text-lg sm:text-xl font-black">{formatNumber(grandProfit)} ₫</h3>
                    </div>
                    <p className="text-emerald-200 text-[11px] mt-2 font-medium flex items-center gap-1">
                        <TrendingUp size={13} /> Tỷ suất lãi: {grandRevenue > 0 ? ((grandProfit / grandRevenue) * 100).toFixed(1) : 0}%
                    </p>
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-4 rounded-2xl shadow-sm text-white flex flex-col justify-between">
                    <div>
                        <p className="text-purple-100 text-[11px] font-black uppercase tracking-wider mb-0.5">Tổng SL Đã Bán</p>
                        <h3 className="text-lg sm:text-xl font-black">{formatNumber(grandSoldQty)} cái</h3>
                    </div>
                    <p className="text-purple-200 text-[11px] mt-2 font-medium flex items-center gap-1">
                        <Package size={13} /> {aggregatedData.filter(p => p.totalQuantity > 0).length} mã SP đã bán
                    </p>
                </div>

                <div className="bg-gradient-to-br from-amber-600 to-amber-700 p-4 rounded-2xl shadow-sm text-white flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-1 text-amber-200 text-[11px] font-black uppercase tracking-wider mb-0.5">
                            <Award size={13} /> Top 1 Lợi Nhuận
                        </div>
                        <h3 className="text-sm font-black truncate text-white" title={topProfitProducts[0]?.productName || 'Chưa có'}>
                            {topProfitProducts[0]?.productName || 'Chưa có dữ liệu'}
                        </h3>
                    </div>
                    <p className="text-amber-100 text-xs font-black mt-2">
                        +{formatNumber(topProfitProducts[0]?.totalProfit || 0)} ₫ ({topProfitProducts[0]?.totalQuantity || 0} cái)
                    </p>
                </div>

                <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-rose-600 to-pink-700 p-4 rounded-2xl shadow-sm text-white flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-1 text-rose-200 text-[11px] font-black uppercase tracking-wider mb-0.5">
                            <Flame size={13} /> Top 1 Bán Chạy
                        </div>
                        <h3 className="text-sm font-black truncate text-white" title={topSoldProducts[0]?.productName || 'Chưa có'}>
                            {topSoldProducts[0]?.productName || 'Chưa có dữ liệu'}
                        </h3>
                    </div>
                    <p className="text-rose-100 text-xs font-black mt-2">
                        {formatNumber(topSoldProducts[0]?.totalQuantity || 0)} cái ({formatNumber(topSoldProducts[0]?.totalRevenue || 0)} ₫)
                    </p>
                </div>
            </div>

            {/* 3. SHOWCASE BANNER: TOP 3 LỢI NHUẬN CAO NHẤT & TOP 3 BÁN CHẠY NHẤT */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top 3 Profit Card */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-4 sm:p-5 rounded-2xl text-white shadow-sm border border-slate-800">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
                        <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-amber-400/20 text-amber-400">
                                <Award size={18} />
                            </span>
                            <h2 className="text-sm font-black uppercase tracking-wider text-amber-300">
                                Top 3 Sản Phẩm Lợi Nhuận Tốt Nhất
                            </h2>
                        </div>
                        <button 
                            onClick={() => handleViewModeChange('top_profit')}
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5"
                        >
                            Xem tất cả <ChevronRight size={13} />
                        </button>
                    </div>

                    <div className="space-y-2.5">
                        {topProfitProducts.length === 0 ? (
                            <p className="text-xs text-slate-400 py-3 text-center">Chưa có giao dịch bán phát sinh lợi nhuận trong kỳ.</p>
                        ) : (
                            topProfitProducts.map((p, idx) => (
                                <div key={p.productId} className="bg-slate-800/80 hover:bg-slate-800 p-3 rounded-xl border border-slate-700/70 transition flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0 ${
                                            idx === 0 ? 'bg-amber-400 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-950' : 'bg-amber-600 text-white'
                                        }`}>
                                            #{idx + 1}
                                        </span>
                                        <div className="min-w-0">
                                            <h4 className="font-black text-xs text-white truncate" title={p.productName}>
                                                {p.productName}
                                            </h4>
                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                                                {p.categoryName && (
                                                    <span className="px-1.5 py-0.2 rounded bg-indigo-900/70 text-indigo-300 font-bold text-[10px] border border-indigo-700/60">
                                                        {p.categoryName}
                                                    </span>
                                                )}
                                                <span>Hãng: <strong className="text-slate-200">{p.manufacturerName}</strong></span>
                                                {p.supplierNames && p.supplierNames.length > 0 && (
                                                    <span>• NCC: <strong className="text-slate-200">{p.supplierNames[0]}</strong></span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-xs font-black text-emerald-400">
                                            +{formatNumber(p.totalProfit)} ₫
                                        </div>
                                        <div className="text-[11px] text-slate-400 font-medium">
                                            Bán {p.totalQuantity} cái ({p.profitMargin.toFixed(1)}%)
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Top 3 Best-Sellers Card */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-rose-950 p-4 sm:p-5 rounded-2xl text-white shadow-sm border border-slate-800">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
                        <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-rose-400/20 text-rose-400">
                                <Flame size={18} />
                            </span>
                            <h2 className="text-sm font-black uppercase tracking-wider text-rose-300">
                                Top 3 Sản Phẩm Bán Nhiều Nhất (Bán Chạy)
                            </h2>
                        </div>
                        <button 
                            onClick={() => handleViewModeChange('top_sellers')}
                            className="text-[11px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-0.5"
                        >
                            Xem tất cả <ChevronRight size={13} />
                        </button>
                    </div>

                    <div className="space-y-2.5">
                        {topSoldProducts.length === 0 ? (
                            <p className="text-xs text-slate-400 py-3 text-center">Chưa có giao dịch bán hàng nào trong kỳ.</p>
                        ) : (
                            topSoldProducts.map((p, idx) => (
                                <div key={p.productId} className="bg-slate-800/80 hover:bg-slate-800 p-3 rounded-xl border border-slate-700/70 transition flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0 ${
                                            idx === 0 ? 'bg-rose-500 text-white' : idx === 1 ? 'bg-orange-500 text-white' : 'bg-slate-400 text-slate-950'
                                        }`}>
                                            #{idx + 1}
                                        </span>
                                        <div className="min-w-0">
                                            <h4 className="font-black text-xs text-white truncate" title={p.productName}>
                                                {p.productName}
                                            </h4>
                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                                                {p.categoryName && (
                                                    <span className="px-1.5 py-0.2 rounded bg-indigo-900/70 text-indigo-300 font-bold text-[10px] border border-indigo-700/60">
                                                        {p.categoryName}
                                                    </span>
                                                )}
                                                <span>Hãng: <strong className="text-slate-200">{p.manufacturerName}</strong></span>
                                                {p.supplierNames && p.supplierNames.length > 0 && (
                                                    <span>• NCC: <strong className="text-slate-200">{p.supplierNames[0]}</strong></span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-xs font-black text-rose-400">
                                            {formatNumber(p.totalQuantity)} cái
                                        </div>
                                        <div className="text-[11px] text-slate-400 font-medium">
                                            DT: {formatNumber(p.totalRevenue)} ₫
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* 4. COMPREHENSIVE FILTER ENGINE */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 text-slate-900 font-black text-sm uppercase tracking-wide">
                        <Filter size={16} className="text-emerald-600" />
                        <span>Bộ Lọc Tìm Kiếm Đa Chiều</span>
                    </div>
                    {hasActiveFilters && (
                        <button 
                            onClick={clearAllFilters}
                            className="text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 text-xs"
                        >
                            <RefreshCw size={13} />
                            <span>Xóa tất cả bộ lọc</span>
                        </button>
                    )}
                </div>

                {/* Primary Search Inputs: Text, Category, Manufacturer, Supplier */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Universal Keyword Search */}
                    <div className="relative">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">
                            Tìm Kiếm Từ Khóa
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Tên SP, Hãng, NCC..." 
                                value={searchTerm} 
                                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filter by Category (Loại Sản Phẩm) */}
                    <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Tags size={12} className="text-indigo-600"/> Lọc Theo Loại Sản Phẩm
                        </label>
                        <select 
                            value={selectedCategoryId} 
                            onChange={e => { setSelectedCategoryId(e.target.value); setCurrentPage(1); }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                        >
                            <option value="all">Tất cả loại sản phẩm ({categories.length})</option>
                            <option value="uncategorized">Chưa phân loại</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter by Manufacturer (Hãng) */}
                    <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Tag size={12} className="text-emerald-600"/> Lọc Theo Hãng Sản Xuất
                        </label>
                        <select 
                            value={selectedManufacturerId} 
                            onChange={e => { setSelectedManufacturerId(e.target.value); setCurrentPage(1); }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                        >
                            <option value="all">Tất cả hãng sản xuất ({manufacturers.length})</option>
                            {manufacturers.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter by Supplier (Nhà Cung Cấp) */}
                    <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Users size={12} className="text-blue-600"/> Lọc Theo Nhà Cung Cấp
                        </label>
                        <select 
                            value={selectedSupplierId} 
                            onChange={e => { setSelectedSupplierId(e.target.value); setCurrentPage(1); }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                        >
                            <option value="all">Tất cả nhà cung cấp ({suppliers.length})</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Price Range Filter Row */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                                <DollarSign size={13} className="text-amber-600"/> Lọc Theo Tầm Giá:
                            </span>
                            <div className="flex bg-white rounded-lg p-0.5 border border-slate-200 text-xs font-bold">
                                <button
                                    onClick={() => setPriceType('selling')}
                                    className={`px-2 py-0.5 rounded ${priceType === 'selling' ? 'bg-emerald-600 text-white font-black' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Giá Bán
                                </button>
                                <button
                                    onClick={() => setPriceType('import')}
                                    className={`px-2 py-0.5 rounded ${priceType === 'import' ? 'bg-emerald-600 text-white font-black' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Giá Nhập
                                </button>
                            </div>
                        </div>

                        {/* Custom Min & Max Inputs */}
                        <div className="flex items-center gap-2 text-xs">
                            <div className="flex items-center gap-1">
                                <span className="text-slate-400 font-bold">Từ:</span>
                                <input 
                                    type="text" 
                                    placeholder="Giá từ..." 
                                    value={minPriceInput ? formatNumber(parseNumber(minPriceInput)) : ''} 
                                    onChange={e => { 
                                        setMinPriceInput(e.target.value.replace(/\D/g, '')); 
                                        setPricePreset('custom');
                                        setCurrentPage(1); 
                                    }}
                                    className="w-24 sm:w-28 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-right"
                                />
                                <span className="text-slate-400">₫</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-slate-400 font-bold">Đến:</span>
                                <input 
                                    type="text" 
                                    placeholder="Giá đến..." 
                                    value={maxPriceInput ? formatNumber(parseNumber(maxPriceInput)) : ''} 
                                    onChange={e => { 
                                        setMaxPriceInput(e.target.value.replace(/\D/g, '')); 
                                        setPricePreset('custom');
                                        setCurrentPage(1); 
                                    }}
                                    className="w-24 sm:w-28 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-right"
                                />
                                <span className="text-slate-400">₫</span>
                            </div>
                            {(minPriceInput || maxPriceInput) && (
                                <button 
                                    onClick={() => { setMinPriceInput(''); setMaxPriceInput(''); setPricePreset('all'); }}
                                    className="p-1 text-slate-400 hover:text-rose-600"
                                    title="Xóa khoảng giá"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Price Range Preset Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-slate-400 font-bold uppercase text-[10px] mr-1">Khoảng giá nhanh:</span>
                        {[
                            { id: 'all', label: 'Tất cả' },
                            { id: 'under100k', label: 'Dưới 100k' },
                            { id: '100k_500k', label: '100k - 500k' },
                            { id: '500k_2m', label: '500k - 2 triệu' },
                            { id: '2m_5m', label: '2 - 5 triệu' },
                            { id: 'above5m', label: 'Trên 5 triệu' }
                        ].map(pr => (
                            <button
                                key={pr.id}
                                onClick={() => handlePricePreset(pr.id as PricePreset)}
                                className={`px-2.5 py-1 rounded-lg transition-all font-bold ${
                                    pricePreset === pr.id 
                                        ? 'bg-emerald-700 text-white font-black shadow-xs' 
                                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                {pr.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Additional Options */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-bold select-none">
                        <input 
                            type="checkbox" 
                            checked={showUnsoldProducts} 
                            onChange={e => { setShowUnsoldProducts(e.target.checked); setCurrentPage(1); }}
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span>Hiện cả các sản phẩm chưa bán trong kỳ (Để xem giá vốn, giá bán & tỷ suất lãi)</span>
                    </label>

                    {/* Min quantity sold */}
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-bold">Lọc SL bán tối thiểu ≥</span>
                        <input 
                            type="number" 
                            placeholder="VD: 5" 
                            value={minQuantitySoldInput} 
                            onChange={e => { setMinQuantitySoldInput(e.target.value); setCurrentPage(1); }}
                            className="w-20 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-center"
                        />
                    </div>
                </div>
            </div>

            {/* 5. VIEW MODE TABS & DATA TABLE */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* View Mode Navigation Tabs */}
                <div className="bg-slate-100/70 p-2 sm:p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            onClick={() => handleViewModeChange('top_profit')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition ${
                                viewMode === 'top_profit'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                        >
                            <Award size={15} />
                            <span>🏆 Lợi Nhuận Tốt Nhất</span>
                        </button>

                        <button
                            onClick={() => handleViewModeChange('top_sellers')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition ${
                                viewMode === 'top_sellers'
                                    ? 'bg-rose-600 text-white shadow-sm'
                                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                        >
                            <Flame size={15} />
                            <span>🔥 Bán Nhiều Nhất</span>
                        </button>

                        <button
                            onClick={() => handleViewModeChange('top_margin')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition ${
                                viewMode === 'top_margin'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                        >
                            <Percent size={15} />
                            <span>💎 Tỷ Suất Lãi Cao (%)</span>
                        </button>

                        <button
                            onClick={() => handleViewModeChange('need_restock')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition ${
                                viewMode === 'need_restock'
                                    ? 'bg-amber-600 text-white shadow-sm'
                                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                        >
                            <AlertTriangle size={15} />
                            <span>⚠️ Cần Nhập Thêm (Kho Thấp)</span>
                        </button>

                        <button
                            onClick={() => handleViewModeChange('all')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition ${
                                viewMode === 'all'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                        >
                            <Package size={15} />
                            <span>Tất Cả Sản Phẩm</span>
                        </button>
                    </div>

                    <div className="text-xs font-black text-slate-600 px-2 py-1 bg-white rounded-lg border border-slate-200">
                        Tìm thấy: <strong className="text-emerald-700 text-sm">{processedData.length}</strong> sản phẩm
                    </div>
                </div>

                {/* Main Data Table */}
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex flex-col justify-center items-center py-20 text-slate-500">
                            <Loader className="animate-spin text-emerald-600 mb-2" size={36} />
                            <span className="text-sm font-bold">Đang tổng hợp dữ liệu kinh doanh & tính toán lợi nhuận...</span>
                        </div>
                    ) : processedData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Package size={54} className="mb-3 opacity-30 text-slate-400" />
                            <p className="text-base font-bold text-slate-700">Không tìm thấy sản phẩm nào phù hợp với bộ lọc.</p>
                            <p className="text-xs text-slate-400 mt-1">Hãy thử xóa từ khóa tìm kiếm, đổi nhà cung cấp, hãng hoặc khoảng thời gian.</p>
                            {hasActiveFilters && (
                                <button 
                                    onClick={clearAllFilters} 
                                    className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition"
                                >
                                    Xóa Toàn Bộ Bộ Lọc
                                </button>
                            )}
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-900 text-white text-[11px] uppercase font-black tracking-wider">
                                <tr>
                                    <th className="py-3 px-3 w-14 text-center">Hạng</th>
                                    <th className="py-3 px-3 cursor-pointer hover:bg-slate-800 transition" onClick={() => handleSort('productName')}>
                                        Tên Sản Phẩm {renderSortIcon('productName')}
                                    </th>
                                    <th className="py-3 px-3">
                                        Loại, Hãng & NCC
                                    </th>
                                    <th className="py-3 px-3 text-center cursor-pointer hover:bg-slate-800 transition" onClick={() => handleSort('currentStock')}>
                                        Tồn Kho {renderSortIcon('currentStock')}
                                    </th>
                                    <th className="py-3 px-3 text-right cursor-pointer hover:bg-slate-800 transition" onClick={() => handleSort('sellingPrice')}>
                                        Giá Nhập / Bán (Lãi/SP) {renderSortIcon('sellingPrice')}
                                    </th>
                                    <th className="py-3 px-3 text-center cursor-pointer hover:bg-slate-800 transition bg-slate-800" onClick={() => handleSort('totalQuantity')}>
                                        SL Đã Bán {renderSortIcon('totalQuantity')}
                                    </th>
                                    <th className="py-3 px-3 text-right cursor-pointer hover:bg-slate-800 transition" onClick={() => handleSort('totalRevenue')}>
                                        Doanh Thu {renderSortIcon('totalRevenue')}
                                    </th>
                                    <th className="py-3 px-3 text-right cursor-pointer hover:bg-emerald-950 transition bg-emerald-900 text-emerald-100" onClick={() => handleSort('totalProfit')}>
                                        Lợi Nhuận Tổng {renderSortIcon('totalProfit')}
                                    </th>
                                    <th className="py-3 px-3 text-center cursor-pointer hover:bg-blue-950 transition bg-blue-950 text-blue-100" onClick={() => handleSort('profitMargin')}>
                                        Tỷ Suất Lãi {renderSortIcon('profitMargin')}
                                    </th>
                                    <th className="py-3 px-3 text-center">Đề Xuất Nhập</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {paginatedData.map((stat, idx) => {
                                    const rankNumber = (currentPage - 1) * pageSize + idx + 1;
                                    const isTop1 = rankNumber === 1;
                                    const isTop2 = rankNumber === 2;
                                    const isTop3 = rankNumber === 3;
                                    const isLowStock = stat.currentStock <= stat.warningThreshold;

                                    return (
                                        <tr key={stat.productId} className="hover:bg-slate-50/80 transition-colors group">
                                            {/* Rank badge */}
                                            <td className="py-3 px-3 text-center font-black">
                                                {isTop1 ? (
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-slate-950 shadow-xs font-black text-xs" title="Hạng 1">
                                                        🥇 1
                                                    </span>
                                                ) : isTop2 ? (
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-950 shadow-xs font-black text-xs" title="Hạng 2">
                                                        🥈 2
                                                    </span>
                                                ) : isTop3 ? (
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-600 text-white shadow-xs font-black text-xs" title="Hạng 3">
                                                        🥉 3
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-bold text-xs">
                                                        #{rankNumber}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Product Name & Badges */}
                                            <td className="py-3 px-3">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                                                        {stat.productName}
                                                        {stat.shortName && (
                                                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-black rounded border border-amber-300">
                                                                {stat.shortName}
                                                            </span>
                                                        )}
                                                        {stat.totalProfit > 0 && stat.totalProfit === Math.max(...processedData.map(d => d.totalProfit)) && (
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                                                <Award size={11} /> Top LN
                                                            </span>
                                                        )}
                                                        {stat.totalQuantity > 0 && stat.totalQuantity === Math.max(...processedData.map(d => d.totalQuantity)) && (
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                                                                <Flame size={11} /> Bán Chạy
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Category, Manufacturer & Supplier */}
                                            <td className="py-3 px-3">
                                                <div className="flex flex-col gap-1 text-[11px]">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {stat.categoryName ? (
                                                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-black text-[10px] border border-indigo-200">
                                                                {stat.categoryName}
                                                            </span>
                                                        ) : (
                                                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 font-bold text-[10px] border border-slate-200">
                                                                Chưa phân loại
                                                            </span>
                                                        )}
                                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-black text-[10px] border border-slate-200">
                                                            {stat.manufacturerName}
                                                        </span>
                                                    </div>
                                                    <div className="text-slate-500 font-medium">
                                                        {stat.supplierNames && stat.supplierNames.length > 0 ? (
                                                            <span className="text-blue-700 font-semibold truncate block max-w-xs" title={`NCC: ${stat.supplierNames.join(', ')}`}>
                                                                NCC: {stat.supplierNames.join(', ')}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 italic">Chưa nhập qua NCC</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Current Stock */}
                                            <td className="py-3 px-3 text-center">
                                                <span className={`inline-block px-2.5 py-1 rounded-lg font-black text-xs ${
                                                    isLowStock 
                                                        ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse' 
                                                        : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {stat.currentStock} cái
                                                </span>
                                            </td>

                                            {/* Price & Unit Profit */}
                                            <td className="py-3 px-3 text-right">
                                                <div className="text-[11px] text-slate-400 font-medium">
                                                    Vốn: {formatNumber(stat.importPrice)}₫ | Bán: {formatNumber(stat.sellingPrice)}₫
                                                </div>
                                                <div className="font-black text-emerald-700 text-xs">
                                                    Lãi/SP: +{formatNumber(stat.unitProfit)} ₫
                                                </div>
                                            </td>

                                            {/* Sold Quantity */}
                                            <td className="py-3 px-3 text-center bg-slate-50/50">
                                                <span className={`inline-block px-3 py-1 rounded-full font-black text-xs ${
                                                    stat.totalQuantity >= 20 
                                                        ? 'bg-rose-100 text-rose-800' 
                                                        : stat.totalQuantity >= 5 
                                                            ? 'bg-amber-100 text-amber-800' 
                                                            : stat.totalQuantity > 0 
                                                                ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                                                : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                    {formatNumber(stat.totalQuantity)}
                                                </span>
                                            </td>

                                            {/* Revenue */}
                                            <td className="py-3 px-3 text-right font-bold text-slate-700">
                                                {formatNumber(stat.totalRevenue)} ₫
                                            </td>

                                            {/* Total Profit */}
                                            <td className="py-3 px-3 text-right font-black text-emerald-700 bg-emerald-50/60 text-sm">
                                                {formatNumber(stat.totalProfit)} ₫
                                            </td>

                                            {/* Margin % */}
                                            <td className="py-3 px-3 text-center font-black bg-blue-50/40">
                                                <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                                                    stat.profitMargin >= 35 
                                                        ? 'bg-emerald-600 text-white' 
                                                        : stat.profitMargin >= 20 
                                                            ? 'bg-blue-600 text-white' 
                                                            : 'bg-slate-200 text-slate-700'
                                                }`}>
                                                    {stat.profitMargin.toFixed(1)}%
                                                </span>
                                            </td>

                                            {/* Restock Recommendation Badge */}
                                            <td className="py-3 px-3 text-center">
                                                {stat.isRestockRecommended ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg bg-rose-600 text-white shadow-xs animate-bounce">
                                                        <AlertTriangle size={12}/> NÊN NHẬP
                                                    </span>
                                                ) : isLowStock ? (
                                                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                                        Tồn thấp
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

                {/* Pagination */}
                {processedData.length > 0 && (
                    <Pagination 
                        currentPage={currentPage} 
                        pageSize={pageSize} 
                        totalItems={processedData.length} 
                        onPageChange={setCurrentPage} 
                        onPageSizeChange={setPageSize} 
                    />
                )}
            </div>

            <style>{`
                @keyframes fade-in { 
                    0% { opacity: 0; transform: translateY(8px); } 
                    100% { opacity: 1; transform: translateY(0); } 
                }
                .animate-fade-in { animation: fade-in 0.25s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default ProductAnalytics;
