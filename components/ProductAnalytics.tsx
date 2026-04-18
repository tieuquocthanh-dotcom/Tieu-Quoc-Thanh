
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, Timestamp, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Sale, Product, Manufacturer } from '../types';
import { Loader, BarChart3, TrendingUp, Award, Calendar, Search, ArrowUp, ArrowDown, ArrowUpDown, Package, DollarSign, Filter, Info, ShoppingCart } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import Pagination from './Pagination';

interface ProductStats {
    productId: string;
    productName: string;
    manufacturerName: string;
    totalQuantity: number;
    totalRevenue: number;
    totalProfit: number;
    saleCount: number;
}

const getInitialStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
};
const getInitialEndDate = () => new Date().toISOString().split('T')[0];

type SortKey = 'totalQuantity' | 'totalRevenue' | 'totalProfit' | 'productName';
type SortDirection = 'asc' | 'desc';

const ProductAnalytics: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState<Sale[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);

    // Filters
    const [startDate, setStartDate] = useState(getInitialStartDate());
    const [endDate, setEndDate] = useState(getInitialEndDate());
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedManufacturerId, setSelectedManufacturerId] = useState('all');

    // Sorting & Pagination
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
        key: 'totalQuantity',
        direction: 'desc'
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Fetch initial data
    useEffect(() => {
        const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
            setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        });
        const unsubManufacturers = onSnapshot(collection(db, "manufacturers"), (snapshot) => {
            setManufacturers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Manufacturer)));
        });
        return () => { unsubProducts(); unsubManufacturers(); };
    }, []);

    // Fetch sales based on date range
    useEffect(() => {
        setTimeout(() => {
            setLoading(true);
        }, 0);
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
        });

        return () => unsubscribe();
    }, [startDate, endDate]);

    // Aggregate Data
    const aggregatedData = useMemo(() => {
        const statsMap = new Map<string, ProductStats>();
        const manuMap = new Map<string, string>(manufacturers.map(m => [m.id, m.name]));

        sales.forEach(sale => {
            if (!sale.items) return;
            sale.items.forEach(item => {
                const product = products.find(p => p.id === item.productId);
                const manufacturerName = product ? (manuMap.get(product.manufacturerId) || 'N/A') : 'N/A';

                if (!statsMap.has(item.productId)) {
                    statsMap.set(item.productId, {
                        productId: item.productId,
                        productName: item.productName,
                        manufacturerName,
                        totalQuantity: 0,
                        totalRevenue: 0,
                        totalProfit: 0,
                        saleCount: 0
                    });
                }

                const current = statsMap.get(item.productId)!;
                const cost = item.importPrice || 0;
                const profit = (item.price - cost) * item.quantity;

                current.totalQuantity += item.quantity;
                current.totalRevenue += item.quantity * item.price;
                current.totalProfit += profit;
                current.saleCount += 1;
            });
        });

        return Array.from(statsMap.values());
    }, [sales, products, manufacturers]);

    // Filter and Sort
    const processedData = useMemo(() => {
        let result = aggregatedData.filter(item => {
            const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase());
            const product = products.find(p => p.id === item.productId);
            const matchesManu = selectedManufacturerId === 'all' || (product && product.manufacturerId === selectedManufacturerId);
            return matchesSearch && matchesManu;
        });

        result.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return sortConfig.direction === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
        });

        return result;
    }, [aggregatedData, searchTerm, selectedManufacturerId, sortConfig, products]);

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
        if (sortConfig.key !== key) return <ArrowUpDown size={14} className="ml-1 opacity-30" />;
        return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-primary" /> : <ArrowDown size={14} className="ml-1 text-primary" />;
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-dark flex items-center">
                        <BarChart3 className="mr-3 text-primary" size={32}/>
                        Phân Tích Hiệu Quả Kinh Doanh
                    </h1>
                    <p className="text-neutral text-sm mt-1">Tìm kiếm sản phẩm bán chạy nhất và mang lại lợi nhuận tốt nhất cho bạn.</p>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-md border border-slate-200">
                    <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-primary"/>
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)} 
                                className="px-3 py-1.5 bg-slate-100 text-dark border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer hover:bg-slate-200 transition-colors"
                                style={{ colorScheme: 'light' }}
                            />
                            <span className="text-neutral text-xs font-black uppercase">Đến</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)} 
                                className="px-3 py-1.5 bg-slate-100 text-dark border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer hover:bg-slate-200 transition-colors"
                                style={{ colorScheme: 'light' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-2xl shadow-lg text-white transform transition hover:scale-[1.02]">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-blue-100 text-xs font-black uppercase tracking-wider mb-1">Doanh thu kỳ này</p>
                            <h3 className="text-3xl font-black">{formatNumber(sales.reduce((a, b) => a + b.total, 0))} ₫</h3>
                        </div>
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                            <DollarSign size={24} />
                        </div>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-6 rounded-2xl shadow-lg text-white transform transition hover:scale-[1.02]">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-green-100 text-xs font-black uppercase tracking-wider mb-1">Lợi nhuận gộp (Est)</p>
                            <h3 className="text-3xl font-black">
                                {formatNumber(aggregatedData.reduce((a, b) => a + b.totalProfit, 0))} ₫
                            </h3>
                        </div>
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                            <TrendingUp size={24} />
                        </div>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-6 rounded-2xl shadow-lg text-white transform transition hover:scale-[1.02]">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-purple-100 text-xs font-black uppercase tracking-wider mb-1">Tổng sản phẩm đã bán</p>
                            <h3 className="text-3xl font-black">
                                {formatNumber(aggregatedData.reduce((a, b) => a + b.totalQuantity, 0))}
                            </h3>
                        </div>
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                            <ShoppingCart size={24} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden mb-10">
                {/* Table Header / Filters */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                            <input 
                                type="text" 
                                placeholder="Tìm tên sản phẩm..." 
                                value={searchTerm} 
                                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-sm text-black"
                            />
                        </div>
                        <select 
                            value={selectedManufacturerId} 
                            onChange={e => { setSelectedManufacturerId(e.target.value); setCurrentPage(1); }}
                            className="px-3 py-2 bg-black text-white border border-slate-300 rounded-lg text-sm font-medium"
                        >
                            <option value="all">Tất cả hãng</option>
                            {manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                    
                    <div className="flex items-center text-xs text-neutral italic">
                        <Info size={14} className="mr-1" /> Lợi nhuận được tính dựa trên giá nhập tại thời điểm bán.
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center items-center py-20"><Loader className="animate-spin text-primary" size={40} /></div>
                    ) : processedData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-neutral">
                            <Package size={64} className="mb-4 opacity-20" />
                            <p className="text-lg font-bold">Không có dữ liệu bán hàng trong khoảng thời gian này.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-neutral uppercase tracking-wider">
                                <tr>
                                    <th className="p-4 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('productName')}>
                                        <div className="flex items-center">Sản phẩm {renderSortIcon('productName')}</div>
                                    </th>
                                    <th className="p-4">Hãng</th>
                                    <th className="p-4 text-center cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('totalQuantity')}>
                                        <div className="flex items-center justify-center">SL Bán {renderSortIcon('totalQuantity')}</div>
                                    </th>
                                    <th className="p-4 text-right cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('totalRevenue')}>
                                        <div className="flex items-center justify-end">Doanh thu {renderSortIcon('totalRevenue')}</div>
                                    </th>
                                    <th className="p-4 text-right cursor-pointer bg-green-50 hover:bg-green-100 transition text-green-800" onClick={() => handleSort('totalProfit')}>
                                        <div className="flex items-center justify-end">Lợi nhuận {renderSortIcon('totalProfit')}</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedData.map((stat) => {
                                    const isTopSold = stat.totalQuantity === processedData[0].totalQuantity && stat.totalQuantity > 0;
                                    const isTopProfit = stat.totalProfit === [...processedData].sort((a,b) => b.totalProfit - a.totalProfit)[0].totalProfit && stat.totalProfit > 0;

                                    return (
                                        <tr key={stat.productId} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 font-bold text-dark flex items-center">
                                                {stat.productName}
                                                {isTopSold && <Award size={16} className="ml-2 text-orange-500" title="Bán chạy nhất" />}
                                                {isTopProfit && <TrendingUp size={16} className="ml-1 text-green-600" title="Lợi nhuận cao nhất" />}
                                            </td>
                                            <td className="p-4 text-sm text-neutral">{stat.manufacturerName}</td>
                                            <td className="p-4 text-center">
                                                <span className={`inline-block px-3 py-1 rounded-full font-black text-sm ${isTopSold ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                                                    {stat.totalQuantity}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-medium text-slate-600">{formatNumber(stat.totalRevenue)} ₫</td>
                                            <td className="p-4 text-right font-black text-green-700 bg-green-50/50 group-hover:bg-green-50 transition-colors">
                                                {formatNumber(stat.totalProfit)} ₫
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
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default ProductAnalytics;
