
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, where, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Sale, SaleItem, Customer, Product, Manufacturer } from '../types';
import { Loader, XCircle, Search, List, Package, Eye, DollarSign, TrendingUp, Building, User, Tag, X } from 'lucide-react';
import Pagination from './Pagination';
import { formatNumber } from '../utils/formatting';
import SaleDetailModal from './SaleDetailModal';

const getInitialEndDate = () => new Date().toISOString().split('T')[0];
const getInitialStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Mặc định 30 ngày gần nhất
    return date.toISOString().split('T')[0];
};

interface SoldItemDetail extends SaleItem {
    saleId: string;
    saleDate: Date;
    customerName: string;
    customerPhone?: string;
    totalAmount: number; // quantity * price
    profit: number; // Lợi nhuận của từng mặt hàng
    manufacturerId?: string; // Thêm ID hãng để lọc
}

interface ProductSalesHistoryProps {
    userRole: 'admin' | 'staff' | null;
}

const ProductSalesHistory: React.FC<ProductSalesHistoryProps> = ({ userRole }) => {
    const [sales, setSales] = useState<Sale[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [startDate, setStartDate] = useState(getInitialStartDate);
    const [endDate, setEndDate] = useState(getInitialEndDate);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [selectedManufacturerId, setSelectedManufacturerId] = useState('all');

    // Autocomplete States
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const productDropdownRef = useRef<HTMLDivElement>(null);
    const customerDropdownRef = useRef<HTMLDivElement>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Detail Modal State
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const isAdmin = userRole === 'admin';

    // Fetch Aux Data (Customers, Products, Manufacturers)
    useEffect(() => {
        const fetchAuxData = async () => {
            try {
                const [custSnap, prodSnap, manuSnap] = await Promise.all([
                    getDocs(query(collection(db, "customers"), orderBy("name"))),
                    getDocs(query(collection(db, "products"), orderBy("name"))),
                    getDocs(query(collection(db, "manufacturers"), orderBy("name")))
                ]);
                setCustomers(custSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
                setProducts(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
                setManufacturers(manuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Manufacturer)));
            } catch (e) {
                console.error("Error fetching auxiliary data", e);
            }
        };
        fetchAuxData();

        const handleClickOutside = (event: MouseEvent) => {
            if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
                setIsProductDropdownOpen(false);
            }
            if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
                setIsCustomerDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        // Kiểm tra cơ bản
        if (!startDate || !endDate) return;
        
        const start = new Date(startDate);
        const end = new Date(endDate);

        // FIX: Kiểm tra ngày hợp lệ trước khi truy vấn để tránh "Invalid time value" 
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            console.warn("Invalid date selected. Skipping fetch.");
            return;
        }

        // Đảm bảo năm hợp lệ (ví dụ không dưới 2000 hoặc quá xa tương lai) để tránh lỗi Firestore
        if (start.getFullYear() < 2000 || end.getFullYear() > 2100) return;

        setTimeout(() => {
            setLoading(true);
            setError(null);
        }, 0);

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        try {
            const startTimestamp = Timestamp.fromDate(start);
            const endTimestamp = Timestamp.fromDate(end);

            const q = query(
                collection(db, "sales"),
                where("createdAt", ">=", startTimestamp),
                where("createdAt", "<=", endTimestamp),
                orderBy("createdAt", "desc")
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
                setSales(salesData);
                setLoading(false);
            }, (err) => {
                console.error("Error fetching sales history:", err);
                setError("Không thể tải dữ liệu. Lỗi truy vấn hoặc kết nối.");
                setLoading(false);
            });

            return () => unsubscribe();
        } catch (e) {
            console.error("Error in Timestamp conversion:", e);
            setLoading(false);
        }
    }, [startDate, endDate]);

    // Gợi ý sản phẩm
    const suggestedProducts = useMemo(() => {
        if (!productSearchTerm.trim()) return [];
        const lower = productSearchTerm.toLowerCase();
        return products.filter(p => p.name.toLowerCase().includes(lower)).slice(0, 10);
    }, [products, productSearchTerm]);

    // Gợi ý khách hàng
    const suggestedCustomers = useMemo(() => {
        if (!customerSearchTerm.trim()) return [];
        const lower = customerSearchTerm.toLowerCase();
        return customers.filter(c => 
            c.name.toLowerCase().includes(lower) || 
            (c.phone && c.phone.includes(lower))
        ).slice(0, 10);
    }, [customers, customerSearchTerm]);

    const flattenedItems = useMemo(() => {
        const items: SoldItemDetail[] = [];
        const customerMap = new Map<string, Customer>(customers.map(c => [c.id, c]));
        const productMap = new Map<string, Product>(products.map(p => [p.id, p]));

        sales.forEach(sale => {
            if (!sale.items) return;
            
            let phone = '';
            if (sale.customerId) {
                const customer = customerMap.get(sale.customerId);
                if (customer) phone = customer.phone;
            }

            sale.items.forEach(item => {
                const cost = item.importPrice || 0;
                const itemProfit = (item.price - cost) * item.quantity;
                const productInfo = productMap.get(item.productId);

                items.push({
                    ...item,
                    saleId: sale.id,
                    saleDate: sale.createdAt ? sale.createdAt.toDate() : new Date(),
                    customerName: sale.customerName || 'Khách vãng lai',
                    customerPhone: phone,
                    totalAmount: item.quantity * item.price,
                    profit: itemProfit,
                    manufacturerId: productInfo?.manufacturerId
                });
            });
        });
        return items;
    }, [sales, customers, products]);

    const filteredItems = useMemo(() => {
        return flattenedItems.filter(item => {
            const matchProduct = productSearchTerm === '' || item.productName.toLowerCase().includes(productSearchTerm.toLowerCase());
            
            const lowerCustSearch = customerSearchTerm.toLowerCase();
            const matchCustomer = customerSearchTerm === '' || 
                                  item.customerName.toLowerCase().includes(lowerCustSearch) ||
                                  (item.customerPhone && item.customerPhone.includes(lowerCustSearch));
            
            const matchManufacturer = selectedManufacturerId === 'all' || item.manufacturerId === selectedManufacturerId;

            return matchProduct && matchCustomer && matchManufacturer;
        });
    }, [flattenedItems, productSearchTerm, customerSearchTerm, selectedManufacturerId]);

    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredItems.slice(startIndex, startIndex + pageSize);
    }, [filteredItems, currentPage, pageSize]);

    const handleViewSale = (saleId: string) => {
        const sale = sales.find(s => s.id === saleId);
        if (sale) {
            setSelectedSale(sale);
            setIsDetailModalOpen(true);
        }
    };

    const handleSelectProduct = (name: string) => {
        setProductSearchTerm(name);
        setIsProductDropdownOpen(false);
        setCurrentPage(1);
    };

    const handleSelectCustomer = (name: string) => {
        setCustomerSearchTerm(name);
        setIsCustomerDropdownOpen(false);
        setCurrentPage(1);
    };

    const totalRevenue = filteredItems.reduce((sum, item) => sum + item.totalAmount, 0);
    const totalProfit = filteredItems.reduce((sum, item) => sum + item.profit, 0);

    return (
        <div className="bg-white p-6 rounded-xl shadow-md flex flex-col">
            <SaleDetailModal 
                sale={selectedSale}
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                userRole={userRole}
            />

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-dark flex items-center">
                    <List className="mr-2 text-primary" size={24}/>
                    Chi Tiết Hàng Đã Bán
                </h2>
            </div>

            {/* Bộ lọc & Tổng kết */}
            <div className="mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-medium z-10">Từ:</span>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none" style={{ colorScheme: 'light' }}/>
                    </div>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-medium z-10">Đến:</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none" style={{ colorScheme: 'light' }}/>
                    </div>
                    
                    {/* Autocomplete Tìm sản phẩm */}
                    <div className="relative" ref={productDropdownRef}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                        <input 
                            type="text" 
                            placeholder="Tìm sản phẩm..." 
                            value={productSearchTerm} 
                            onChange={(e) => {
                                setProductSearchTerm(e.target.value);
                                setIsProductDropdownOpen(true);
                                setCurrentPage(1);
                            }}
                            onFocus={() => setIsProductDropdownOpen(true)}
                            className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-primary focus:outline-none font-medium" 
                        />
                        {productSearchTerm && (
                            <button onClick={() => setProductSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500">
                                <X size={14}/>
                            </button>
                        )}
                        {isProductDropdownOpen && suggestedProducts.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                                {suggestedProducts.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleSelectProduct(p.name)}
                                        className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-slate-50 last:border-0 flex items-center"
                                    >
                                        <Tag size={14} className="mr-2 text-blue-500"/>
                                        <span className="text-sm font-bold text-dark">{p.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                        <select 
                            value={selectedManufacturerId} 
                            onChange={e => {setSelectedManufacturerId(e.target.value); setCurrentPage(1);}}
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-primary focus:outline-none appearance-none bg-black text-white font-medium shadow-sm"
                        >
                            <option value="all">Tất cả hãng SX</option>
                            {manufacturers.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Autocomplete Tìm khách hàng */}
                    <div className="relative" ref={customerDropdownRef}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                        <input 
                            type="text" 
                            placeholder="Tìm khách hàng..." 
                            value={customerSearchTerm} 
                            onChange={(e) => {
                                setCustomerSearchTerm(e.target.value);
                                setIsCustomerDropdownOpen(true);
                                setCurrentPage(1);
                            }}
                            onFocus={() => setIsCustomerDropdownOpen(true)}
                            className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-primary focus:outline-none font-medium" 
                        />
                         {customerSearchTerm && (
                            <button onClick={() => setCustomerSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500">
                                <X size={14}/>
                            </button>
                        )}
                        {isCustomerDropdownOpen && suggestedCustomers.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                                {suggestedCustomers.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => handleSelectCustomer(c.name)}
                                        className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-slate-50 last:border-0"
                                    >
                                        <div className="flex items-center">
                                            <User size={14} className="mr-2 text-green-600"/>
                                            <span className="text-sm font-bold text-dark">{c.name}</span>
                                        </div>
                                        {c.phone && <div className="text-[10px] text-slate-500 ml-6">{c.phone}</div>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-4">
                    {isAdmin && (
                        <div className="flex-1 min-w-[200px] p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between shadow-sm">
                            <div className="flex items-center text-green-800">
                                <TrendingUp className="mr-2" size={20}/>
                                <span className="font-bold">Tổng Lợi Nhuận:</span>
                            </div>
                            <span className="text-2xl font-black text-green-700">{formatNumber(totalProfit)} ₫</span>
                        </div>
                    )}
                    <div className="flex-1 min-w-[200px] p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between shadow-sm">
                        <div className="flex items-center text-blue-900">
                            <DollarSign className="mr-2" size={20}/>
                            <span className="font-bold">Tổng Doanh Thu:</span>
                        </div>
                        <span className="text-2xl font-black text-blue-700">{formatNumber(totalRevenue)} ₫</span>
                    </div>
                </div>
            </div>

            {/* Bảng dữ liệu */}
            <div className="border rounded-xl bg-white shadow-inner overflow-hidden">
                {loading ? (
                    <div className="p-10 flex justify-center items-center"><Loader className="animate-spin text-primary" size={32} /></div>
                ) : error ? (
                    <div className="p-10 flex justify-center items-center text-red-600"><XCircle size={24} className="mr-2"/> {error}</div>
                ) : filteredItems.length === 0 ? (
                    <div className="p-10 flex flex-col items-center justify-center text-neutral">
                        <Package size={48} className="mb-4 text-slate-300"/>
                        <p>Không tìm thấy dữ liệu.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300">
                        <table className="w-full text-left border-separate border-spacing-0 min-w-[1000px]">
                            <thead>
                                <tr className="bg-slate-100">
                                    <th className="p-4 text-xs font-bold text-neutral uppercase tracking-wider border-b border-slate-200 sticky top-0 bg-slate-100 z-20">Ngày Bán</th>
                                    <th className="p-4 text-xs font-bold text-neutral uppercase tracking-wider border-b border-slate-200 sticky top-0 bg-slate-100 z-20">Mã Đơn</th>
                                    <th className="p-4 text-xs font-bold text-neutral uppercase tracking-wider border-b border-slate-200 sticky top-0 bg-slate-100 z-20">Khách Hàng</th>
                                    <th className="p-4 text-xs font-bold text-blue-800 uppercase tracking-wider border-b border-slate-200 sticky left-0 bg-slate-100 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Sản Phẩm</th>
                                    <th className="p-4 text-xs font-bold text-neutral uppercase tracking-wider text-center border-b border-slate-200 sticky top-0 bg-slate-100 z-20">SL</th>
                                    <th className="p-4 text-xs font-bold text-neutral uppercase tracking-wider text-right border-b border-slate-200 sticky top-0 bg-slate-100 z-20">Đơn Giá</th>
                                    <th className="p-4 text-xs font-bold text-neutral uppercase tracking-wider text-right border-b border-slate-200 sticky top-0 bg-slate-100 z-20">Thành Tiền</th>
                                    {isAdmin && (
                                        <th className="p-4 text-xs font-black text-green-800 uppercase tracking-wider text-right bg-green-100 border-b border-l border-green-200 sticky right-0 z-30 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">
                                            Lợi Nhuận
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedItems.map((item, index) => (
                                    <tr key={`${item.saleId}-${index}`} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4 text-sm text-neutral whitespace-nowrap">
                                            {item.saleDate.toLocaleDateString('vi-VN')}
                                            <div className="text-[10px] text-slate-400">{item.saleDate.toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})}</div>
                                        </td>
                                        <td className="p-4 text-sm font-mono whitespace-nowrap">
                                            <button onClick={() => handleViewSale(item.saleId)} className="text-primary hover:underline font-bold">#{item.saleId.substring(0, 6)}</button>
                                        </td>
                                        <td className="p-4 text-sm font-medium text-dark max-w-[150px] truncate">{item.customerName}</td>
                                        <td className="p-4 text-sm font-bold text-blue-800 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.05)] z-10">
                                            {item.productName}
                                        </td>
                                        <td className="p-4 text-sm text-center font-black text-dark">{item.quantity}</td>
                                        <td className="p-4 text-sm text-right text-neutral whitespace-nowrap">{formatNumber(item.price)} ₫</td>
                                        <td className="p-4 text-sm text-right font-bold text-dark whitespace-nowrap">{formatNumber(item.totalAmount)} ₫</td>
                                        {isAdmin && (
                                            <td className="p-4 text-sm text-right font-black text-green-700 bg-green-50 group-hover:bg-green-100 border-l border-green-100 sticky right-0 z-10 transition-colors shadow-[-2px_0_5px_rgba(0,0,0,0.05)] whitespace-nowrap">
                                                {formatNumber(item.profit)} ₫
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                <div className="bg-white">
                    <Pagination currentPage={currentPage} pageSize={pageSize} totalItems={filteredItems.length} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
                </div>
            </div>
            <style>{`
                .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
                .scrollbar-thin::-webkit-scrollbar-track { background: #f1f5f9; }
                .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </div>
    );
};

export default ProductSalesHistory;
