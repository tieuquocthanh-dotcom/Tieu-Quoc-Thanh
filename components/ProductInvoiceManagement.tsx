import React, { useState, useEffect, useMemo } from 'react';
import { 
    collection, 
    onSnapshot, 
    query, 
    orderBy, 
    doc, 
    writeBatch, 
    serverTimestamp, 
    deleteDoc, 
    increment 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, Supplier, Manufacturer, ProductInvoice, ProductInvoiceItem } from '../types';
import { 
    FileText, 
    PlusCircle, 
    Search, 
    X, 
    Calendar, 
    Building2, 
    CheckCircle, 
    AlertTriangle, 
    Trash2, 
    Edit3, 
    Layers, 
    Package, 
    Eye, 
    Download, 
    Filter, 
    Plus, 
    Minus, 
    Save, 
    Clock, 
    CheckCheck, 
    RefreshCw, 
    SlidersHorizontal,
    Info
} from 'lucide-react';
import { formatNumber, getLocalYYYYMMDD } from '../utils/formatting';
import { searchVietnameseMatch } from '../utils/vietnameseSearch';
import ConfirmationModal from './ConfirmationModal';

interface ProductInvoiceManagementProps {
    userRole: 'admin' | 'staff' | null;
    user: any;
}

export const ProductInvoiceManagement: React.FC<ProductInvoiceManagementProps> = ({ userRole, user }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
    const [invoices, setInvoices] = useState<ProductInvoice[]>([]);
    const [loading, setLoading] = useState(true);

    // Tab view: 'summary' (Tổng kết tồn hóa đơn theo SP) | 'invoices' (Danh sách phiếu nhập hóa đơn)
    const [activeTab, setActiveTab] = useState<'summary' | 'invoices'>('summary');

    // Filters for Tab 1 (Summary)
    const [summarySearchTerm, setSummarySearchTerm] = useState('');
    const [invoiceStockFilter, setInvoiceStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');

    // Filters for Tab 2 (Invoices List)
    const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
    const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedProductForQuickInvoice, setSelectedProductForQuickInvoice] = useState<Product | null>(null);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [productToAdjust, setProductToAdjust] = useState<Product | null>(null);
    const [adjustedStockValue, setAdjustedStockValue] = useState<number>(0);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<ProductInvoice | null>(null);
    const [invoiceToDelete, setInvoiceToDelete] = useState<ProductInvoice | null>(null);

    // Toast
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Subscriptions
    useEffect(() => {
        const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snap) => {
            setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
            setLoading(false);
        });

        const unsubSuppliers = onSnapshot(query(collection(db, 'suppliers'), orderBy('name')), (snap) => {
            setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
        });

        const unsubManufacturers = onSnapshot(query(collection(db, 'manufacturers'), orderBy('name')), (snap) => {
            setManufacturers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Manufacturer)));
        });

        const unsubInvoices = onSnapshot(query(collection(db, 'productInvoices'), orderBy('createdAt', 'desc')), (snap) => {
            setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductInvoice)));
        });

        return () => {
            unsubProducts();
            unsubSuppliers();
            unsubManufacturers();
            unsubInvoices();
        };
    }, []);

    // Summary calculations
    const summaryStats = useMemo(() => {
        const totalProducts = products.length;
        const productsWithStock = products.filter(p => (p.totalInvoicedStock || 0) > 0).length;
        const productsOutStock = products.filter(p => (p.totalInvoicedStock || 0) <= 0).length;
        const totalRemainingInvoicedQty = products.reduce((acc, p) => acc + (p.totalInvoicedStock || 0), 0);
        const totalInvoicesCount = invoices.length;

        return {
            totalProducts,
            productsWithStock,
            productsOutStock,
            totalRemainingInvoicedQty,
            totalInvoicesCount
        };
    }, [products, invoices]);

    // Filtered products for summary
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const stock = p.totalInvoicedStock || 0;
            if (invoiceStockFilter === 'in_stock' && stock <= 0) return false;
            if (invoiceStockFilter === 'out_of_stock' && stock > 0) return false;

            if (!summarySearchTerm.trim()) return true;
            const term = summarySearchTerm.trim();
            const matchName = searchVietnameseMatch(p.name, term);
            const mfg = manufacturers.find(m => m.id === p.manufacturerId);
            const matchMfg = mfg?.name && searchVietnameseMatch(mfg.name, term);
            return matchName || matchMfg;
        });
    }, [products, invoiceStockFilter, summarySearchTerm, manufacturers]);

    // Filtered invoices
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            if (selectedSupplierFilter !== 'all' && inv.supplierId !== selectedSupplierFilter) return false;

            if (!invoiceSearchTerm.trim()) return true;
            const term = invoiceSearchTerm.trim();
            const matchNum = inv.invoiceNumber && searchVietnameseMatch(inv.invoiceNumber, term);
            const matchSup = inv.supplierName && searchVietnameseMatch(inv.supplierName, term);
            const matchDate = inv.issueDate && inv.issueDate.includes(term);
            const matchItems = inv.items && inv.items.some(it => searchVietnameseMatch(it.productName, term));
            return matchNum || matchSup || matchDate || matchItems;
        });
    }, [invoices, selectedSupplierFilter, invoiceSearchTerm]);

    // Adjust direct invoiced stock
    const handleSaveAdjustStock = async () => {
        if (!productToAdjust) return;
        try {
            const pRef = doc(db, 'products', productToAdjust.id);
            const batch = writeBatch(db);
            batch.update(pRef, { totalInvoicedStock: Number(adjustedStockValue) || 0 });
            await batch.commit();
            showToast(`Đã điều chỉnh tồn hóa đơn sản phẩm "${productToAdjust.name}" thành ${adjustedStockValue}`);
            setIsAdjustModalOpen(false);
            setProductToAdjust(null);
        } catch (error) {
            console.error("Lỗi điều chỉnh tồn hóa đơn:", error);
            showToast("Có lỗi xảy ra khi lưu điều chỉnh tồn hóa đơn", 'error');
        }
    };

    // Delete invoice and reverse totalInvoicedStock
    const handleDeleteInvoice = async () => {
        if (!invoiceToDelete) return;
        try {
            const batch = writeBatch(db);
            // Deduct the quantities that were added by this invoice
            if (invoiceToDelete.items && invoiceToDelete.items.length > 0) {
                invoiceToDelete.items.forEach(it => {
                    if (it.productId && it.quantity) {
                        const pRef = doc(db, 'products', it.productId);
                        batch.update(pRef, { totalInvoicedStock: increment(-it.quantity) });
                    }
                });
            }
            batch.delete(doc(db, 'productInvoices', invoiceToDelete.id));
            await batch.commit();
            showToast(`Đã xóa hóa đơn số ${invoiceToDelete.invoiceNumber} và cập nhật lại số tồn`);
            setInvoiceToDelete(null);
        } catch (error) {
            console.error("Lỗi xóa hóa đơn:", error);
            showToast("Có lỗi xảy ra khi xóa hóa đơn", 'error');
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
                        <FileText size={26} />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black uppercase text-slate-800 tracking-tight flex items-center gap-2">
                            Quản Lý Hóa Đơn Sản Phẩm
                        </h1>
                        <p className="text-xs text-slate-500 font-medium">
                            Nhập hóa đơn đầu vào từ nhà cung cấp, theo dõi tồn hóa đơn từng sản phẩm và tự động trừ khi xuất bán
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => {
                            setSelectedProductForQuickInvoice(null);
                            setIsCreateModalOpen(true);
                        }}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-sm font-black uppercase flex items-center gap-2 shadow-sm transition"
                    >
                        <PlusCircle size={18} />
                        <span>Nhập Hóa Đơn Mới</span>
                    </button>
                </div>
            </div>

            {/* KPI Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Tổng lượng hóa đơn còn lại</span>
                    <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-black text-blue-600">{formatNumber(summaryStats.totalRemainingInvoicedQty)}</span>
                        <span className="text-xs font-bold text-slate-400">cái / chiếc</span>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-tight flex items-center gap-1">
                        <CheckCircle size={13} /> Sản phẩm còn hóa đơn
                    </span>
                    <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-black text-emerald-600">{formatNumber(summaryStats.productsWithStock)}</span>
                        <span className="text-xs font-bold text-slate-400">/ {summaryStats.totalProducts} SP</span>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-rose-500 uppercase tracking-tight flex items-center gap-1">
                        <AlertTriangle size={13} /> Sản phẩm hết hóa đơn
                    </span>
                    <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-black text-rose-600">{formatNumber(summaryStats.productsOutStock)}</span>
                        <span className="text-xs font-bold text-slate-400">SP cần hóa đơn</span>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-amber-600 uppercase tracking-tight flex items-center gap-1">
                        <Layers size={13} /> Tổng hóa đơn đã nhập
                    </span>
                    <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-black text-amber-500">{formatNumber(summaryStats.totalInvoicesCount)}</span>
                        <span className="text-xs font-bold text-slate-400">phiếu nhập HĐ</span>
                    </div>
                </div>
            </div>

            {/* Main Tabs Navigation */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="flex border-b border-slate-200 bg-slate-50/60 p-1.5 gap-1.5">
                    <button
                        onClick={() => setActiveTab('summary')}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs md:text-sm font-black uppercase flex items-center justify-center gap-2 transition-all ${
                            activeTab === 'summary'
                                ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/80'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                        }`}
                    >
                        <Package size={16} />
                        <span>Tổng Kết Tồn Hóa Đơn Sản Phẩm</span>
                        <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-700 font-black">
                            {products.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('invoices')}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs md:text-sm font-black uppercase flex items-center justify-center gap-2 transition-all ${
                            activeTab === 'invoices'
                                ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/80'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                        }`}
                    >
                        <FileText size={16} />
                        <span>Lịch Sử Nhập Hóa Đơn NCC</span>
                        <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700 font-black">
                            {invoices.length}
                        </span>
                    </button>
                </div>

                {/* TAB 1: SUMMARY OF INVOICE STOCK BY PRODUCT */}
                {activeTab === 'summary' && (
                    <div className="p-4 md:p-6 space-y-4">
                        {/* Search & Filters */}
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Tìm tên sản phẩm, hãng sản xuất..."
                                    value={summarySearchTerm}
                                    onChange={e => setSummarySearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                                />
                                {summarySearchTerm && (
                                    <button
                                        onClick={() => setSummarySearchTerm('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Filter Chips */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                                <button
                                    onClick={() => setInvoiceStockFilter('all')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${
                                        invoiceStockFilter === 'all'
                                            ? 'bg-slate-800 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Tất cả ({products.length})
                                </button>
                                <button
                                    onClick={() => setInvoiceStockFilter('in_stock')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${
                                        invoiceStockFilter === 'in_stock'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    }`}
                                >
                                    Còn Hóa Đơn ({summaryStats.productsWithStock})
                                </button>
                                <button
                                    onClick={() => setInvoiceStockFilter('out_of_stock')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${
                                        invoiceStockFilter === 'out_of_stock'
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                    }`}
                                >
                                    Hết / Âm Hóa Đơn ({summaryStats.productsOutStock})
                                </button>
                            </div>
                        </div>

                        {/* Summary Table */}
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-900 text-white uppercase text-[11px] tracking-wider">
                                    <tr>
                                        <th className="py-3 px-4 w-12 text-center">STT</th>
                                        <th className="py-3 px-4">Tên Sản Phẩm</th>
                                        <th className="py-3 px-4">Hãng SX</th>
                                        <th className="py-3 px-4 text-right">Giá Bán</th>
                                        <th className="py-3 px-4 text-center">Tồn Kho Hóa Đơn</th>
                                        <th className="py-3 px-4 text-center">Trạng Thái Hóa Đơn</th>
                                        <th className="py-3 px-4 text-center w-36">Thao Tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white font-medium">
                                    {filteredProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">
                                                Không tìm thấy sản phẩm nào phù hợp
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredProducts.map((p, idx) => {
                                            const invoicedQty = p.totalInvoicedStock || 0;
                                            const hasInvoicedStock = invoicedQty > 0;
                                            const isNegative = invoicedQty < 0;
                                            const mfg = manufacturers.find(m => m.id === p.manufacturerId);

                                            return (
                                                <tr key={p.id} className="hover:bg-blue-50/40 transition">
                                                    <td className="py-3 px-4 text-center text-slate-400 font-bold text-xs">{idx + 1}</td>
                                                    <td className="py-3 px-4">
                                                        <div className="font-black text-slate-900 uppercase">{p.name}</div>
                                                        {p.isCombo && (
                                                            <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Combo</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-500 font-semibold text-xs">
                                                        {mfg?.name || '---'}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-black text-slate-800">
                                                        {formatNumber(p.sellingPrice)} ₫
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className={`text-base font-black px-2.5 py-1 rounded-lg ${
                                                            hasInvoicedStock 
                                                                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' 
                                                                : isNegative 
                                                                    ? 'text-rose-700 bg-rose-50 border border-rose-200'
                                                                    : 'text-slate-400 bg-slate-100'
                                                        }`}>
                                                            {formatNumber(invoicedQty)}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        {hasInvoicedStock ? (
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                                                <CheckCircle size={12} /> Còn hóa đơn
                                                            </span>
                                                        ) : isNegative ? (
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                                                <AlertTriangle size={12} /> Xuất vượt HĐ
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                                                Hết hóa đơn
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedProductForQuickInvoice(p);
                                                                    setIsCreateModalOpen(true);
                                                                }}
                                                                className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition"
                                                                title="Nhập thêm hóa đơn cho sản phẩm này"
                                                            >
                                                                <PlusCircle size={15} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setProductToAdjust(p);
                                                                    setAdjustedStockValue(p.totalInvoicedStock || 0);
                                                                    setIsAdjustModalOpen(true);
                                                                }}
                                                                className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white rounded-lg transition"
                                                                title="Điều chỉnh số tồn hóa đơn"
                                                            >
                                                                <Edit3 size={15} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 2: INVOICES LIST (LỊCH SỬ NHẬP HÓA ĐƠN) */}
                {activeTab === 'invoices' && (
                    <div className="p-4 md:p-6 space-y-4">
                        {/* Search & Filters */}
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Tìm số HĐ, tên NCC, tên sản phẩm..."
                                    value={invoiceSearchTerm}
                                    onChange={e => setInvoiceSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                                />
                                {invoiceSearchTerm && (
                                    <button
                                        onClick={() => setInvoiceSearchTerm('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <select
                                    value={selectedSupplierFilter}
                                    onChange={e => setSelectedSupplierFilter(e.target.value)}
                                    className="p-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs outline-none focus:border-blue-500"
                                >
                                    <option value="all">-- Tất cả Nhà Cung Cấp --</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Invoices Table */}
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-900 text-white uppercase text-[11px] tracking-wider">
                                    <tr>
                                        <th className="py-3 px-4 w-12 text-center">STT</th>
                                        <th className="py-3 px-4">Số / Ký Hiệu HĐ</th>
                                        <th className="py-3 px-4">Ngày Xuất Hóa Đơn</th>
                                        <th className="py-3 px-4">Nhà Cung Cấp</th>
                                        <th className="py-3 px-4">Sản Phẩm Trong HĐ</th>
                                        <th className="py-3 px-4 text-center">Tổng SL HĐ</th>
                                        <th className="py-3 px-4">Người Nhập</th>
                                        <th className="py-3 px-4 text-center w-28">Thao Tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white font-medium">
                                    {filteredInvoices.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-8 text-center text-slate-400 font-bold">
                                                Chưa có phiếu nhập hóa đơn nào
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredInvoices.map((inv, idx) => (
                                            <tr key={inv.id} className="hover:bg-slate-50 transition">
                                                <td className="py-3 px-4 text-center text-slate-400 font-bold text-xs">{idx + 1}</td>
                                                <td className="py-3 px-4">
                                                    <span className="font-black text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                        {inv.invoiceNumber || 'KHD-' + inv.id.slice(0, 6)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-bold text-slate-800">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={13} className="text-slate-400" />
                                                        {inv.issueDate}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-black uppercase text-slate-800">
                                                    {inv.supplierName || '---'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="space-y-0.5 max-w-xs">
                                                        {inv.items?.map((it, iIdx) => (
                                                            <div key={iIdx} className="text-xs flex justify-between gap-2">
                                                                <span className="font-bold text-slate-700 truncate">{it.productName}</span>
                                                                <span className="font-black text-blue-600 shrink-0">x{it.quantity}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="font-black text-base text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                                                        {formatNumber(inv.totalQuantity)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-xs text-slate-500 font-semibold">
                                                    {inv.creatorName || 'Hệ thống'}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedInvoiceDetail(inv);
                                                                setIsDetailModalOpen(true);
                                                            }}
                                                            className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition"
                                                            title="Xem chi tiết hóa đơn"
                                                        >
                                                            <Eye size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => setInvoiceToDelete(inv)}
                                                            className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition"
                                                            title="Xóa hóa đơn và hoàn trả tồn"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL 1: CREATE NEW INVOICE ENTRY */}
            {isCreateModalOpen && (
                <CreateInvoiceModal
                    isOpen={isCreateModalOpen}
                    onClose={() => {
                        setIsCreateModalOpen(false);
                        setSelectedProductForQuickInvoice(null);
                    }}
                    initialProduct={selectedProductForQuickInvoice}
                    products={products}
                    suppliers={suppliers}
                    currentUser={user}
                    onSuccess={(msg) => showToast(msg, 'success')}
                />
            )}

            {/* MODAL 2: ADJUST INVOICED STOCK DIRECTLY */}
            {isAdjustModalOpen && productToAdjust && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
                        <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
                            <h3 className="font-black uppercase text-sm flex items-center gap-2">
                                <Edit3 size={18} /> Điều Chỉnh Tồn Hóa Đơn
                            </h3>
                            <button onClick={() => setIsAdjustModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Sản phẩm</p>
                                <p className="text-sm font-black text-slate-800 uppercase">{productToAdjust.name}</p>
                                <div className="mt-2 text-xs text-slate-500 flex justify-between">
                                    <span>Tồn hóa đơn hiện tại:</span>
                                    <span className="font-bold text-blue-600">{productToAdjust.totalInvoicedStock || 0}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase mb-1.5">
                                    Số tồn hóa đơn mới
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={adjustedStockValue}
                                    onChange={e => setAdjustedStockValue(parseInt(e.target.value) || 0)}
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl text-lg font-black text-slate-900 outline-none focus:border-blue-500"
                                />
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Nhập số lượng hóa đơn còn tồn thực tế của sản phẩm này sau khi kiểm kê.
                                </p>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setIsAdjustModalOpen(false)}
                                    className="flex-1 py-2.5 bg-white border border-slate-300 rounded-xl font-black text-xs uppercase text-slate-600 hover:bg-slate-50 transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSaveAdjustStock}
                                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase transition shadow-sm"
                                >
                                    Lưu Thay Đổi
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: INVOICE DETAIL VIEW */}
            {isDetailModalOpen && selectedInvoiceDetail && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="bg-slate-900 p-4 text-white flex justify-between items-center shrink-0">
                            <h3 className="font-black uppercase text-sm flex items-center gap-2">
                                <FileText size={18} /> Chi Tiết Hóa Đơn: {selectedInvoiceDetail.invoiceNumber}
                            </h3>
                            <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                                <div>
                                    <span className="text-slate-400 uppercase font-bold block text-[10px]">Ngày xuất hóa đơn</span>
                                    <span className="font-black text-slate-800 text-sm">{selectedInvoiceDetail.issueDate}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 uppercase font-bold block text-[10px]">Nhà cung cấp</span>
                                    <span className="font-black text-slate-800 text-sm">{selectedInvoiceDetail.supplierName || '---'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 uppercase font-bold block text-[10px]">Người nhập phiếu</span>
                                    <span className="font-bold text-slate-700">{selectedInvoiceDetail.creatorName || 'Hệ thống'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 uppercase font-bold block text-[10px]">Tổng số lượng hóa đơn</span>
                                    <span className="font-black text-emerald-600 text-sm">{formatNumber(selectedInvoiceDetail.totalQuantity)} cái/chiếc</span>
                                </div>
                            </div>

                            {selectedInvoiceDetail.notes && (
                                <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-xl">
                                    <span className="font-bold">Ghi chú: </span>{selectedInvoiceDetail.notes}
                                </div>
                            )}

                            <div>
                                <h4 className="text-xs font-black uppercase text-slate-600 mb-2">Danh sách sản phẩm trong hóa đơn:</h4>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                                            <tr>
                                                <th className="py-2.5 px-3">Sản phẩm</th>
                                                <th className="py-2.5 px-3 text-center">Số lượng</th>
                                                <th className="py-2.5 px-3 text-right">Đơn giá HĐ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {selectedInvoiceDetail.items?.map((it, idx) => (
                                                <tr key={idx}>
                                                    <td className="py-2.5 px-3 font-bold text-slate-800">{it.productName}</td>
                                                    <td className="py-2.5 px-3 text-center font-black text-blue-600">{it.quantity}</td>
                                                    <td className="py-2.5 px-3 text-right font-bold text-slate-600">
                                                        {it.unitPrice ? `${formatNumber(it.unitPrice)} ₫` : '---'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="px-5 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase hover:bg-slate-900 transition"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRM DELETE MODAL */}
            {invoiceToDelete && (
                <ConfirmationModal
                    isOpen={!!invoiceToDelete}
                    title="Xóa Hóa Đơn Nhà Cung Cấp"
                    message={`Bạn có chắc chắn muốn xóa hóa đơn "${invoiceToDelete.invoiceNumber}" không? Hệ thống sẽ tự động trừ lại số lượng ${invoiceToDelete.totalQuantity} khỏi tồn hóa đơn của các sản phẩm tương ứng.`}
                    onConfirm={handleDeleteInvoice}
                    onClose={() => setInvoiceToDelete(null)}
                />
            )}

            {/* TOAST NOTIFICATION */}
            {toast && (
                <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-white font-bold text-xs uppercase animate-bounce ${
                    toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
                }`}>
                    {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                    <span>{toast.message}</span>
                </div>
            )}
        </div>
    );
};

// SUB-COMPONENT: MODAL CREATE INVOICE
interface CreateInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialProduct: Product | null;
    products: Product[];
    suppliers: Supplier[];
    currentUser: any;
    onSuccess: (msg: string) => void;
}

const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
    isOpen,
    onClose,
    initialProduct,
    products,
    suppliers,
    currentUser,
    onSuccess
}) => {
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [issueDate, setIssueDate] = useState(getLocalYYYYMMDD());
    const [supplierId, setSupplierId] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<ProductInvoiceItem[]>(() => {
        if (initialProduct) {
            return [{
                productId: initialProduct.id,
                productName: initialProduct.name,
                quantity: 1,
                unitPrice: initialProduct.importPrice || 0
            }];
        }
        return [];
    });

    // Product search inside modal to add items
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAddItem = (product: Product) => {
        const existingIdx = items.findIndex(i => i.productId === product.id);
        if (existingIdx >= 0) {
            const updated = [...items];
            updated[existingIdx].quantity += 1;
            setItems(updated);
        } else {
            setItems([...items, {
                productId: product.id,
                productName: product.name,
                quantity: 1,
                unitPrice: product.importPrice || 0
            }]);
        }
        setProductSearchTerm('');
        setIsProductDropdownOpen(false);
    };

    const handleUpdateQuantity = (idx: number, qty: number) => {
        const val = Math.max(1, qty);
        const updated = [...items];
        updated[idx].quantity = val;
        setItems(updated);
    };

    const handleUpdateUnitPrice = (idx: number, price: number) => {
        const updated = [...items];
        updated[idx].unitPrice = price;
        setItems(updated);
    };

    const handleRemoveItem = (idx: number) => {
        setItems(items.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (items.length === 0) {
            alert("Vui lòng chọn ít nhất một sản phẩm cần nhập hóa đơn!");
            return;
        }

        const sup = suppliers.find(s => s.id === supplierId);
        const totalQuantity = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
        const totalAmount = items.reduce((sum, it) => sum + ((Number(it.unitPrice) || 0) * (Number(it.quantity) || 0)), 0);

        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            const invoiceRef = doc(collection(db, 'productInvoices'));

            const invoiceData = {
                invoiceNumber: invoiceNumber.trim() || `HD-${Date.now().toString().slice(-6)}`,
                issueDate: issueDate || getLocalYYYYMMDD(),
                supplierId: supplierId || '',
                supplierName: sup?.name || 'Nhà Cung Cấp',
                notes: notes.trim(),
                items,
                totalQuantity,
                totalAmount,
                createdAt: serverTimestamp(),
                creatorName: currentUser?.displayName || currentUser?.email || 'Admin'
            };

            batch.set(invoiceRef, invoiceData);

            // Increase totalInvoicedStock for each product in this invoice
            items.forEach(it => {
                if (it.productId && it.quantity > 0) {
                    const pRef = doc(db, 'products', it.productId);
                    batch.update(pRef, { totalInvoicedStock: increment(it.quantity) });
                }
            });

            await batch.commit();
            onSuccess(`Đã lưu hóa đơn số ${invoiceData.invoiceNumber} thành công và tăng ${totalQuantity} tồn hóa đơn!`);
            onClose();
        } catch (error) {
            console.error("Lỗi lưu hóa đơn:", error);
            alert("Có lỗi xảy ra khi lưu hóa đơn!");
        } finally {
            setIsSubmitting(false);
        }
    };

    const searchFilteredProducts = useMemo(() => {
        if (!productSearchTerm.trim()) return [];
        return products.filter(p => searchVietnameseMatch(p.name, productSearchTerm)).slice(0, 15);
    }, [products, productSearchTerm]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-blue-600 p-4 text-white flex justify-between items-center shrink-0">
                    <h3 className="font-black uppercase text-sm flex items-center gap-2">
                        <PlusCircle size={20} /> Nhập Hóa Đơn Sản Phẩm Từ NCC
                    </h3>
                    <button onClick={onClose} className="text-white/80 hover:text-white">
                        <X size={22} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-5 space-y-4 overflow-y-auto flex-1">
                        {/* Row 1: Invoice number & Issue date */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                                    Số / Ký hiệu hóa đơn
                                </label>
                                <input
                                    type="text"
                                    placeholder="VD: 0001245, 1C24TBB..."
                                    value={invoiceNumber}
                                    onChange={e => setInvoiceNumber(e.target.value)}
                                    className="w-full p-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 text-slate-800"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                                    Ngày xuất hóa đơn <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={issueDate}
                                    onChange={e => setIssueDate(e.target.value)}
                                    className="w-full p-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 text-slate-800"
                                />
                            </div>
                        </div>

                        {/* Row 2: Supplier & Notes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                                    Nhà Cung Cấp
                                </label>
                                <select
                                    value={supplierId}
                                    onChange={e => setSupplierId(e.target.value)}
                                    className="w-full p-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 text-slate-800"
                                >
                                    <option value="">-- Chọn Nhà Cung Cấp --</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                                    Ghi chú thêm
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ghi chú thuế VAT, đợt xuất..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="w-full p-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 text-slate-800"
                                />
                            </div>
                        </div>

                        {/* Search to add products */}
                        <div className="relative pt-2">
                            <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                                Thêm sản phẩm vào hóa đơn
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Gõ tên sản phẩm để thêm vào hóa đơn..."
                                    value={productSearchTerm}
                                    onChange={e => {
                                        setProductSearchTerm(e.target.value);
                                        setIsProductDropdownOpen(true);
                                    }}
                                    onFocus={() => setIsProductDropdownOpen(true)}
                                    className="w-full pl-9 pr-8 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 text-slate-800"
                                />
                                {productSearchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setProductSearchTerm('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Dropdown search results */}
                            {isProductDropdownOpen && productSearchTerm.trim() && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto divide-y divide-slate-100">
                                    {searchFilteredProducts.length === 0 ? (
                                        <div className="p-3 text-center text-xs text-slate-400 font-bold">
                                            Không tìm thấy sản phẩm nào khớp
                                        </div>
                                    ) : (
                                        searchFilteredProducts.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => handleAddItem(p)}
                                                className="w-full text-left p-2.5 hover:bg-blue-50 text-xs flex justify-between items-center transition"
                                            >
                                                <span className="font-bold uppercase text-slate-800">{p.name}</span>
                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                    Tồn HĐ hiện tại: {p.totalInvoicedStock || 0}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selected Items List */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden mt-3">
                            <div className="bg-slate-100 px-3 py-2 text-[11px] font-black uppercase text-slate-600 flex justify-between items-center">
                                <span>Danh Sách Sản Phẩm Trong Hóa Đơn ({items.length})</span>
                                <span className="text-blue-600">
                                    Tổng SL: {items.reduce((acc, it) => acc + (it.quantity || 0), 0)}
                                </span>
                            </div>

                            {items.length === 0 ? (
                                <div className="p-6 text-center text-xs text-slate-400 font-bold">
                                    Chưa có sản phẩm nào. Hãy tìm và thêm sản phẩm ở trên.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                                    {items.map((it, idx) => (
                                        <div key={idx} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-xs uppercase text-slate-900 truncate">{it.productName}</p>
                                                <span className="text-[10px] text-slate-400">Đơn vị: chiếc/cái</span>
                                            </div>

                                            {/* Quantity Controls */}
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateQuantity(idx, it.quantity - 1)}
                                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                                                >
                                                    <Minus size={13} />
                                                </button>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={it.quantity}
                                                    onChange={e => handleUpdateQuantity(idx, parseInt(e.target.value) || 1)}
                                                    className="w-14 p-1 text-center border-2 border-slate-200 rounded-lg font-black text-xs text-blue-600 outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateQuantity(idx, it.quantity + 1)}
                                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                                                >
                                                    <Plus size={13} />
                                                </button>
                                            </div>

                                            {/* Remove Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(idx)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition shrink-0"
                                                title="Xóa khỏi hóa đơn"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2.5 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 bg-white border border-slate-300 rounded-xl font-black text-xs uppercase text-slate-600 hover:bg-slate-100 transition"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || items.length === 0}
                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase transition shadow-sm disabled:bg-slate-300 flex items-center justify-center gap-2"
                        >
                            <Save size={16} />
                            <span>{isSubmitting ? 'Đang Lưu...' : 'Lưu Hóa Đơn'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductInvoiceManagement;
