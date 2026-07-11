import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Sale, Customer } from '../types';
import { Loader, PieChart, TrendingUp, Calendar, Search, ArrowUp, ArrowDown, ArrowUpDown, Users, DollarSign, Eye, X, Package } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import Pagination from './Pagination';

interface CustomerStats {
    customerId: string;
    customerName: string;
    customerPhone?: string;
    totalSalesAmount: number;
    totalAmountPaid: number;
    totalDebt: number;
    salesCount: number;
}

const getInitialStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
};
const getInitialEndDate = () => new Date().toISOString().split('T')[0];

type SortKey = 'totalSalesAmount' | 'totalAmountPaid' | 'totalDebt' | 'customerName';
type SortDirection = 'asc' | 'desc';

const CustomerAnalytics: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState<Sale[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);

    // Filters
    const [startDate, setStartDate] = useState(getInitialStartDate());
    const [endDate, setEndDate] = useState(getInitialEndDate());
    const [searchTerm, setSearchTerm] = useState('');

    // Sorting & Pagination
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
        key: 'totalSalesAmount',
        direction: 'desc'
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedCustomerForItems, setSelectedCustomerForItems] = useState<CustomerStats | null>(null);

    // Fetch initial data
    useEffect(() => {
        const unsubCustomers = onSnapshot(collection(db, "customers"), (snapshot) => {
            setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
        });
        return () => { unsubCustomers(); };
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
        const statsMap = new Map<string, CustomerStats>();
        const customerMap = new Map<string, string>(customers.map(c => [c.id, c.name]));

        // Initialize map with all customers
        customers.forEach(c => {
            statsMap.set(c.id, {
                customerId: c.id,
                customerName: c.name,
                customerPhone: c.phone || '',
                totalSalesAmount: 0,
                totalAmountPaid: 0,
                totalDebt: 0,
                salesCount: 0
            });
        });

        sales.forEach(sale => {
            if (!sale.customerId) return;
            const customerName = customerMap.get(sale.customerId) || sale.customerName || 'Khách lẻ / N/A';
            
            if (!statsMap.has(sale.customerId)) {
                statsMap.set(sale.customerId, {
                    customerId: sale.customerId,
                    customerName,
                    totalSalesAmount: 0,
                    totalAmountPaid: 0,
                    totalDebt: 0,
                    salesCount: 0
                });
            }

            const stats = statsMap.get(sale.customerId)!;
            
            const finalAmount = sale.finalAmount || sale.totalAmount || sale.total || 0;
            const amountPaid = sale.amountPaid !== undefined ? sale.amountPaid : (sale.paymentStatus === 'paid' ? finalAmount : 0);
            const debt = Math.max(0, finalAmount - amountPaid);

            stats.totalSalesAmount += finalAmount;
            stats.totalAmountPaid += amountPaid;
            stats.totalDebt += debt;
            stats.salesCount += 1;
        });

        return Array.from(statsMap.values()).filter(s => s.salesCount > 0);
    }, [sales, customers]);

    // Apply Sorting & Filtering
    const processedData = useMemo(() => {
        let result = [...aggregatedData];

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(s => 
                s.customerName.toLowerCase().includes(lowerSearch) || 
                (s.customerPhone && s.customerPhone.toLowerCase().includes(lowerSearch))
            );
        }

        result.sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];
            
            if (valA === undefined || valB === undefined) return 0;
            
            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortConfig.direction === 'asc' 
                    ? valA.localeCompare(valB) 
                    : valB.localeCompare(valA);
            }
            
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }
            return 0;
        });

        return result;
    }, [aggregatedData, searchTerm, sortConfig]);

    const handleSort = (key: SortKey) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const getSortIcon = (key: SortKey) => {
        if (sortConfig.key !== key) return <ArrowUpDown size={14} className="ml-1 text-slate-400" />;
        return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-primary" /> : <ArrowDown size={14} className="ml-1 text-primary" />;
    };

    // Calculate totals
    const grandTotalSales = aggregatedData.reduce((acc, curr) => acc + curr.totalSalesAmount, 0);
    const grandTotalDebt = aggregatedData.reduce((acc, curr) => acc + curr.totalDebt, 0);

    // Pagination
    const totalPages = Math.ceil(processedData.length / pageSize) || 1;
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(1);
    }, [totalPages, currentPage]);

    const currentData = processedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const selectedCustomerSales = useMemo(() => {
        if (!selectedCustomerForItems) return [];
        return sales
            .filter(s => s.customerId === selectedCustomerForItems.customerId)
            .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    }, [selectedCustomerForItems, sales]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-xl font-bold flex items-center text-slate-800">
                    <PieChart className="mr-2 text-primary" /> Bán Hàng Theo Khách Hàng
                </h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto text-sm">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border shadow-sm">
                        <Calendar size={16} className="text-slate-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent border-none outline-none text-slate-700 font-medium"
                        />
                        <span className="text-slate-400">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent border-none outline-none text-slate-700 font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 flex items-center">
                    <div className="bg-blue-100 p-3 rounded-lg text-blue-600 mr-4">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng KH Có GD</p>
                        <p className="text-2xl font-black text-slate-800">{aggregatedData.length}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-100 flex items-center">
                    <div className="bg-emerald-100 p-3 rounded-lg text-emerald-600 mr-4">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Giá Trị Bán</p>
                        <p className="text-2xl font-black text-emerald-600">{formatNumber(grandTotalSales)} ₫</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-red-100 flex items-center">
                    <div className="bg-red-100 p-3 rounded-lg text-red-600 mr-4">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Công Nợ Phải Thu</p>
                        <p className="text-2xl font-black text-red-600">{formatNumber(grandTotalDebt)} ₫</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-3 rounded-xl shadow-sm border flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm khách hàng..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-40 bg-white rounded-xl shadow-sm border">
                    <Loader className="animate-spin text-primary" size={32} />
                </div>
            ) : aggregatedData.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-xl shadow-sm border text-slate-500 text-sm font-medium">
                    Không có dữ liệu bán hàng trong khoảng thời gian này.
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold border-b">
                                <tr>
                                    <th className="px-4 py-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('customerName')}>
                                        <div className="flex items-center">Khách Hàng {getSortIcon('customerName')}</div>
                                    </th>
                                    <th className="px-4 py-3 text-center">Số điện thoại</th>
                                    <th className="px-4 py-3 text-center">Số hóa đơn</th>
                                    <th className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100" onClick={() => handleSort('totalSalesAmount')}>
                                        <div className="flex items-center justify-end">Tổng Mua {getSortIcon('totalSalesAmount')}</div>
                                    </th>
                                    <th className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100" onClick={() => handleSort('totalAmountPaid')}>
                                        <div className="flex items-center justify-end">Đã Thanh Toán {getSortIcon('totalAmountPaid')}</div>
                                    </th>
                                    <th className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100" onClick={() => handleSort('totalDebt')}>
                                        <div className="flex items-center justify-end text-red-600">Nợ Phải Thu {getSortIcon('totalDebt')}</div>
                                    </th>
                                    <th className="px-4 py-3 text-center w-24">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {currentData.length > 0 ? currentData.map((stats) => (
                                    <tr key={stats.customerId} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 font-semibold text-slate-800">{stats.customerName}</td>
                                        <td className="px-4 py-3 text-center text-slate-600 font-mono text-sm">{stats.customerPhone || '-'}</td>
                                        <td className="px-4 py-3 text-center text-slate-500 font-medium">
                                            <span className="bg-slate-100 px-2 py-0.5 rounded-full text-xs font-bold">{stats.salesCount}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-black text-slate-700">{formatNumber(stats.totalSalesAmount)} ₫</td>
                                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatNumber(stats.totalAmountPaid)} ₫</td>
                                        <td className="px-4 py-3 text-right font-black text-red-600">{formatNumber(stats.totalDebt)} ₫</td>
                                        <td className="px-4 py-3 text-center">
                                            <button 
                                                onClick={() => setSelectedCustomerForItems(stats)}
                                                className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                                                title="Xem các mặt hàng đã mua"
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-medium">
                                            Không tìm thấy khách hàng nào phù hợp.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 && (
                        <Pagination 
                            currentPage={currentPage}
                            pageSize={pageSize}
                            totalItems={processedData.length}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={setPageSize}
                        />
                    )}
                </div>
            )}

            {/* Modal hiển thị mặt hàng đã mua */}
            {selectedCustomerForItems && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
                            <h3 className="font-bold text-slate-800 flex items-center">
                                <Package className="mr-2 text-primary" size={20} />
                                Chi Tiết Hàng Hóa Của: {selectedCustomerForItems.customerName}
                            </h3>
                            <button onClick={() => setSelectedCustomerForItems(null)} className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded-full hover:bg-slate-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 bg-slate-50/50">
                            {selectedCustomerSales.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 font-medium">Không tìm thấy đơn hàng nào.</div>
                            ) : (
                                <div className="space-y-4">
                                    {selectedCustomerSales.map(sale => (
                                        <div key={sale.id} className="bg-white border text-sm rounded-xl overflow-hidden shadow-sm">
                                            <div className="flex justify-between items-center bg-slate-100/50 p-3 border-b">
                                                <div className="font-bold flex items-center text-slate-700">
                                                    <Calendar size={14} className="mr-1.5 text-slate-500"/>
                                                    {sale.createdAt.toDate().toLocaleString('vi-VN')}
                                                </div>
                                                <div className="font-black text-primary bg-blue-50 px-2 py-0.5 rounded text-xs">
                                                    Đơn: {formatNumber(sale.finalAmount || sale.totalAmount || sale.total || 0)} ₫
                                                </div>
                                            </div>
                                            <div className="p-3">
                                                {(!sale.items || sale.items.length === 0) ? (
                                                    <div className="text-slate-400 text-xs italic">Không có chi tiết sản phẩm.</div>
                                                ) : (
                                                    <table className="w-full text-xs text-left">
                                                        <thead>
                                                            <tr className="text-slate-500 border-b">
                                                                <th className="pb-2 font-semibold">Tên sản phẩm</th>
                                                                <th className="pb-2 font-semibold text-center">SL</th>
                                                                <th className="pb-2 font-semibold text-right">Đơn giá</th>
                                                                <th className="pb-2 font-semibold text-right">Thành tiền</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {sale.items.map((item: any, idx: number) => (
                                                                <tr key={idx}>
                                                                    <td className="py-2 font-medium text-slate-700">{item.productName || 'Sản phẩm không tên'}</td>
                                                                    <td className="py-2 text-center font-bold text-slate-800">{item.quantity}</td>
                                                                    <td className="py-2 text-right text-slate-600">{formatNumber(item.price || item.sellingPrice || 0)}</td>
                                                                    <td className="py-2 text-right font-bold text-emerald-600">{formatNumber((item.price || item.sellingPrice || 0) * item.quantity)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerAnalytics;
