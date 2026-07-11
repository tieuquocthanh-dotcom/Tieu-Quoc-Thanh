import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, collectionGroup, orderBy, Timestamp, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, Manufacturer, Sale } from '../types';
import { Loader, PackageSearch, AlertTriangle, TrendingUp, TrendingDown, Package, Clock, Filter } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import Pagination from './Pagination';

interface PredictionConfig {
    daysToAnalyze: number;
    daysToStock: number; // Goal for how many days of stock to hold
}

interface ProductPrediction extends Product {
    totalStock: number;
    soldInPeriod: number;
    salesVelocity: number; // parts per day
    daysRemaining: number;
    suggestedRestockQty: number;
    status: 'out_of_stock' | 'critical' | 'low_stock' | 'healthy' | 'overstocked' | 'no_sales';
}

const RestockPredictions: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [inventoryData, setInventoryData] = useState<{[productId: string]: number}>({});
    const [salesVelocity, setSalesVelocity] = useState<{[productId: string]: number}>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [config, setConfig] = useState<PredictionConfig>({ daysToAnalyze: 30, daysToStock: 30 });
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    useEffect(() => {
        setLoading(true);
        let unsubProducts: () => void;
        let unsubInventory: () => void;
        let unsubSales: () => void;

        try {
            unsubProducts = onSnapshot(query(collection(db, "products")), (snapshot) => {
                setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
            });

            unsubInventory = onSnapshot(query(collectionGroup(db, 'inventory')), (snapshot) => {
                const stockAcc: {[productId: string]: number} = {};
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const productId = doc.ref.parent.parent?.id;
                    if (productId && typeof data.stock === 'number') {
                        stockAcc[productId] = (stockAcc[productId] || 0) + data.stock;
                    }
                });
                setInventoryData(stockAcc);
            });

            // Sales from last N days
            const d = new Date();
            d.setDate(d.getDate() - config.daysToAnalyze);
            
            const salesQ = query(
                collection(db, 'sales'),
                where('createdAt', '>=', Timestamp.fromDate(d))
            );

            unsubSales = onSnapshot(salesQ, (snapshot) => {
                const salesAcc: {[productId: string]: number} = {};
                snapshot.forEach(doc => {
                    const sale = doc.data() as Sale;
                    if (sale.status !== 'cancelled' && sale.items) {
                        sale.items.forEach(item => {
                            salesAcc[item.productId] = (salesAcc[item.productId] || 0) + item.quantity;
                        });
                    }
                });
                setSalesVelocity(salesAcc);
                setLoading(false);
            }, (err) => {
                console.error("Lỗi kéo dữ liệu bán hàng có thể do thiếu Index:", err);
                // Fallback: fetch all sales or just ignore if error? We will fetch all and filter in memory as a fallback.
                const allSalesQ = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
                unsubSales = onSnapshot(allSalesQ, (snapFallback) => {
                    const salesAcc: {[productId: string]: number} = {};
                    snapFallback.forEach(doc => {
                        const sale = doc.data() as Sale;
                        const t = sale.createdAt?.toDate();
                        if (t && t.getTime() >= d.getTime() && sale.status !== 'cancelled' && sale.items) {
                            sale.items.forEach(item => {
                                salesAcc[item.productId] = (salesAcc[item.productId] || 0) + item.quantity;
                            });
                        }
                    });
                    setSalesVelocity(salesAcc);
                    setLoading(false);
                });
            });

        } catch (err) {
            console.error(err);
            setError("Có lỗi tải dữ liệu.");
            setLoading(false);
        }

        return () => {
            if (unsubProducts) unsubProducts();
            if (unsubInventory) unsubInventory();
            if (unsubSales) unsubSales();
        };
    }, [config.daysToAnalyze]);

    const predictions = useMemo(() => {
        return products.map(p => {
            const stock = inventoryData[p.id] || 0;
            const sold = salesVelocity[p.id] || 0;
            const velocity = sold / config.daysToAnalyze; // sold per day
            const daysRem = velocity > 0 ? stock / velocity : Infinity;
            
            // Goal: we want to have `daysToStock` worth of inventory
            const targetStock = velocity * config.daysToStock;
            const suggestedQty = targetStock > stock ? Math.ceil(targetStock - stock) : 0;

            let status: ProductPrediction['status'] = 'healthy';
            if (velocity === 0) {
                status = 'no_sales';
            } else if (stock <= 0) {
                status = 'out_of_stock';
            } else if (daysRem <= 7) {
                status = 'critical';
            } else if (daysRem <= 15) {
                status = 'low_stock';
            } else if (daysRem > config.daysToStock + 15) {
                status = 'overstocked';
            }

            return {
                ...p,
                totalStock: stock,
                soldInPeriod: sold,
                salesVelocity: velocity,
                daysRemaining: daysRem,
                suggestedRestockQty: suggestedQty,
                status
            } as ProductPrediction;
        }).sort((a, b) => {
            // Sort by status severity: out_of_stock > critical > low_stock > healthy > overstocked > no_sales
            const severity = { out_of_stock: 0, critical: 1, low_stock: 2, healthy: 3, overstocked: 4, no_sales: 5 };
            if (severity[a.status] !== severity[b.status]) {
                return severity[a.status] - severity[b.status];
            }
            // then by velocity (highest first)
            return b.salesVelocity - a.salesVelocity;
        });
    }, [products, inventoryData, salesVelocity, config]);

    const filteredPredictions = useMemo(() => {
        return predictions.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
            
            // By default, if 'all', don't show healthy/overstocked/no_sales unless searched? Let's show all but paginate.
            return matchesSearch && matchesStatus;
        });
    }, [predictions, searchTerm, filterStatus]);

    const paginated = useMemo(() => filteredPredictions.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredPredictions, currentPage, pageSize]);

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'out_of_stock': return { label: 'Hết Hàng & Đang Bán Mất Khách', color: 'bg-red-100 text-red-700 border-red-200' };
            case 'critical': return { label: 'Rất Ít (Dưới 7 ngày)', color: 'bg-orange-100 text-orange-700 border-orange-200' };
            case 'low_stock': return { label: 'Sắp Hết (Dưới 15 ngày)', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
            case 'healthy': return { label: 'An Toàn', color: 'bg-green-100 text-green-700 border-green-200' };
            case 'overstocked': return { label: 'Tồn Kho Nhiều', color: 'bg-blue-100 text-blue-700 border-blue-200' };
            case 'no_sales': return { label: 'Chưa Bán Được', color: 'bg-slate-100 text-slate-500 border-slate-200' };
            default: return { label: 'Bình Thường', color: 'bg-slate-100 text-slate-700 border-slate-200' };
        }
    };

    return (
        <div className="pb-24 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-3xl font-black text-dark flex items-center uppercase tracking-tighter">
                    <PackageSearch className="mr-3 text-primary" size={32}/> Dự Đoán Nhập Hàng
                </h1>

                <div className="flex gap-2">
                    <div className="bg-white p-2 rounded-xl flex shadow-sm border border-slate-200 font-bold text-sm">
                        <div className="flex items-center px-3 border-r border-slate-100">
                            <span className="text-slate-400 mr-2 text-xs">Đánh giá</span>
                            <select 
                                value={config.daysToAnalyze}
                                onChange={(e) => setConfig(prev => ({...prev, daysToAnalyze: parseInt(e.target.value)}))}
                                className="bg-transparent text-primary outline-none focus:ring-0"
                            >
                                <option value={7}>7 ngày qua</option>
                                <option value={15}>15 ngày qua</option>
                                <option value={30}>30 ngày qua</option>
                                <option value={60}>60 ngày qua</option>
                            </select>
                        </div>
                        <div className="flex items-center px-3">
                            <span className="text-slate-400 mr-2 text-xs">Mục tiêu tồn kho</span>
                            <select 
                                value={config.daysToStock}
                                onChange={(e) => setConfig(prev => ({...prev, daysToStock: parseInt(e.target.value)}))}
                                className="bg-transparent text-primary outline-none focus:ring-0"
                            >
                                <option value={15}>15 ngày bán</option>
                                <option value={30}>30 ngày bán</option>
                                <option value={60}>60 ngày bán</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-red-300 transition-colors" onClick={() => { setFilterStatus('out_of_stock'); setCurrentPage(1); }}>
                    <AlertTriangle size={24} className="text-red-500 mb-2"/>
                    <span className="text-2xl font-black text-red-600">{predictions.filter(p => p.status === 'out_of_stock').length}</span>
                    <span className="text-[10px] font-black uppercase text-slate-500">Đã hết hàng</span>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-orange-300 transition-colors" onClick={() => { setFilterStatus('critical'); setCurrentPage(1); }}>
                    <TrendingDown size={24} className="text-orange-500 mb-2"/>
                    <span className="text-2xl font-black text-orange-600">{predictions.filter(p => p.status === 'critical').length}</span>
                    <span className="text-[10px] font-black uppercase text-slate-500">Rất Ít (Dưới 7 Ngày)</span>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-yellow-300 transition-colors" onClick={() => { setFilterStatus('low_stock'); setCurrentPage(1); }}>
                    <Clock size={24} className="text-yellow-500 mb-2"/>
                    <span className="text-2xl font-black text-yellow-600">{predictions.filter(p => p.status === 'low_stock').length}</span>
                    <span className="text-[10px] font-black uppercase text-slate-500">Sắp hết (Dưới {config.daysToStock} ngày)</span>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-green-300 transition-colors" onClick={() => { setFilterStatus('healthy'); setCurrentPage(1); }}>
                    <Package size={24} className="text-green-500 mb-2"/>
                    <span className="text-2xl font-black text-green-600">{predictions.filter(p => p.status === 'healthy').length}</span>
                    <span className="text-[10px] font-black uppercase text-slate-500">An Toàn</span>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <input 
                            type="text" 
                            placeholder="Tìm tên sản phẩm..." 
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none text-sm font-medium"
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select 
                            value={filterStatus}
                            onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                            className="pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none text-sm font-bold text-slate-700 bg-white appearance-none"
                        >
                            <option value="all">Tất cả trạng thái</option>
                            <option value="out_of_stock">Đã Hết Hàng (Cần nhập)</option>
                            <option value="critical">Rất Ít</option>
                            <option value="low_stock">Sắp Hết</option>
                            <option value="healthy">An Toàn</option>
                            <option value="overstocked">Tồn Kho Nhiều</option>
                            <option value="no_sales">Chưa Bán Được</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100">
                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                <th className="px-4 py-3">Sản phẩm</th>
                                <th className="px-4 py-3 text-right">Tồn Kho</th>
                                <th className="px-4 py-3 text-right">Tốc độ bán<br/>({config.daysToAnalyze} ngày)</th>
                                <th className="px-4 py-3 text-center">Tình Trạng</th>
                                <th className="px-4 py-3 text-right">Còn Bán Được</th>
                                <th className="px-4 py-3 text-right bg-primary/5 text-primary">SL Cần Nhập<br/>(Cho {config.daysToStock} ngày)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center"><Loader className="animate-spin text-primary mx-auto" size={24}/></td></tr>
                            ) : paginated.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-medium">Không tìm thấy sản phẩm nào.</td></tr>
                            ) : (
                                paginated.map(p => {
                                    const statusInfo = getStatusInfo(p.status);
                                    return (
                                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="font-bold text-dark max-w-[200px] sm:max-w-xs">{p.name}</div>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <span className={`font-black ${p.totalStock <= 0 ? 'text-red-500' : 'text-slate-700'}`}>
                                                    {formatNumber(p.totalStock)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="font-black text-blue-600">{formatNumber(p.soldInPeriod)}</div>
                                                <div className="text-[10px] font-bold text-slate-400">~{p.salesVelocity.toFixed(1)} / ngày</div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusInfo.color}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {p.daysRemaining === Infinity ? (
                                                    <span className="text-slate-400 font-medium">-</span>
                                                ) : (
                                                    <span className={`font-black ${p.daysRemaining <= 7 ? 'text-red-500' : p.daysRemaining <= 15 ? 'text-orange-500' : 'text-slate-700'}`}>
                                                        {formatNumber(Math.floor(p.daysRemaining))} ngày
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right bg-primary/5">
                                                {p.suggestedRestockQty > 0 ? (
                                                    <span className="font-black text-primary text-base">
                                                        +{formatNumber(p.suggestedRestockQty)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-bold">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-slate-100">
                    <Pagination 
                        currentPage={currentPage}
                        totalItems={filteredPredictions.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
                    />
                </div>
            </div>
        </div>
    );
};

export default RestockPredictions;
