import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    collection, 
    onSnapshot, 
    query, 
    orderBy, 
    doc, 
    writeBatch, 
    serverTimestamp, 
    deleteDoc, 
    increment,
    addDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, Supplier, Manufacturer, ProductInvoice, ProductInvoiceItem, ProductInvoiceExport, ProductInvoiceExportItem } from '../types';
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
    Info,
    Users,
    History,
    FileOutput
} from 'lucide-react';
import { formatNumber, parseNumber, getLocalYYYYMMDD } from '../utils/formatting';
import { searchVietnameseMatch, removeVietnameseTones } from '../utils/vietnameseSearch';
import ConfirmationModal from './ConfirmationModal';
import { SupplierModal } from './SupplierManagement';
import Pagination from './Pagination';
import CreateExportInvoiceModal from './CreateExportInvoiceModal';
import ProductExportHistoryModal from './ProductExportHistoryModal';
import ExportInvoiceDetailModal from './ExportInvoiceDetailModal';

// Helper component for formatted numeric input
const NumericInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    className?: string;
    placeholder?: string;
}> = ({ value, onChange, className, placeholder }) => {
    const [localValue, setLocalValue] = useState(formatNumber(value));

    useEffect(() => {
        const parsed = parseNumber(localValue);
        if (value !== parsed) {
            setLocalValue(formatNumber(value));
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setLocalValue(raw);
        onChange(parseNumber(raw));
    };

    const handleBlur = () => {
        const parsed = parseNumber(localValue);
        setLocalValue(formatNumber(parsed));
    };

    return (
        <input
            type="text"
            inputMode="numeric"
            value={localValue}
            placeholder={placeholder}
            className={className}
            onFocus={() => {
                if (value === 0) setLocalValue("");
            }}
            onChange={handleChange}
            onBlur={handleBlur}
        />
    );
};

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

    // Tab view: 'summary' (Tổng kết tồn hóa đơn theo SP) | 'invoices' (Danh sách phiếu nhập hóa đơn) | 'exports' (Lịch sử xuất hóa đơn)
    const [activeTab, setActiveTab] = useState<'summary' | 'invoices' | 'exports'>('summary');

    // Filters for Tab 1 (Summary) - Default is 'in_stock' (sản phẩm còn hóa đơn)
    const [summarySearchTerm, setSummarySearchTerm] = useState('');
    const [invoiceStockFilter, setInvoiceStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('in_stock');
    const [summaryPage, setSummaryPage] = useState(1);
    const [summaryPageSize, setSummaryPageSize] = useState(20);

    // Filters for Tab 2 (Invoices List)
    const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
    const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');
    const [invoicePage, setInvoicePage] = useState(1);
    const [invoicePageSize, setInvoicePageSize] = useState(20);

    // Filters for Tab 3 (Exports List)
    const [exportSearchTerm, setExportSearchTerm] = useState('');
    const [exportPage, setExportPage] = useState(1);
    const [exportPageSize, setExportPageSize] = useState(20);

    // Modals for Import
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedProductForQuickInvoice, setSelectedProductForQuickInvoice] = useState<Product | null>(null);
    const [invoiceToEdit, setInvoiceToEdit] = useState<ProductInvoice | null>(null);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [productToAdjust, setProductToAdjust] = useState<Product | null>(null);
    const [adjustedStockValue, setAdjustedStockValue] = useState<number>(0);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<ProductInvoice | null>(null);
    const [invoiceToDelete, setInvoiceToDelete] = useState<ProductInvoice | null>(null);

    // Modals for Export
    const [invoiceExports, setInvoiceExports] = useState<ProductInvoiceExport[]>([]);
    const [isCreateExportModalOpen, setIsCreateExportModalOpen] = useState(false);
    const [selectedProductForExport, setSelectedProductForExport] = useState<Product | null>(null);
    const [exportToEdit, setExportToEdit] = useState<ProductInvoiceExport | null>(null);
    const [isExportDetailModalOpen, setIsExportDetailModalOpen] = useState(false);
    const [selectedExportDetail, setSelectedExportDetail] = useState<ProductInvoiceExport | null>(null);
    const [exportToDelete, setExportToDelete] = useState<ProductInvoiceExport | null>(null);

    // Modal to view export history of a specific product
    const [productForExportHistoryModal, setProductForExportHistoryModal] = useState<Product | null>(null);

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

        const unsubExports = onSnapshot(query(collection(db, 'productInvoiceExports'), orderBy('createdAt', 'desc')), (snap) => {
            setInvoiceExports(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductInvoiceExport)));
        });

        return () => {
            unsubProducts();
            unsubSuppliers();
            unsubManufacturers();
            unsubInvoices();
            unsubExports();
        };
    }, []);

    // Summary calculations
    const summaryStats = useMemo(() => {
        const totalProducts = products.length;
        const productsWithStock = products.filter(p => (p.totalInvoicedStock || 0) > 0).length;
        const productsOutStock = products.filter(p => (p.totalInvoicedStock || 0) <= 0).length;
        const totalRemainingInvoicedQty = products.reduce((acc, p) => acc + (p.totalInvoicedStock || 0), 0);
        const totalInvoicesCount = invoices.length;
        const totalExportsCount = invoiceExports.length;
        const totalExportedQty = invoiceExports.reduce((acc, exp) => acc + (exp.totalQuantity || 0), 0);

        return {
            totalProducts,
            productsWithStock,
            productsOutStock,
            totalRemainingInvoicedQty,
            totalInvoicesCount,
            totalExportsCount,
            totalExportedQty
        };
    }, [products, invoices, invoiceExports]);

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

    // Calculate highest invoice import price for each product from existing invoices
    const productMaxInvoicePriceMap = useMemo(() => {
        const map = new Map<string, number>();
        invoices.forEach(inv => {
            inv.items?.forEach(item => {
                if (item.productId && item.unitPrice && Number(item.unitPrice) > 0) {
                    const price = Number(item.unitPrice);
                    const currentMax = map.get(item.productId) || 0;
                    if (price > currentMax) {
                        map.set(item.productId, price);
                    }
                }
            });
        });
        return map;
    }, [invoices]);

    // Reset pagination when search/filter changes
    useEffect(() => {
        setSummaryPage(1);
    }, [summarySearchTerm, invoiceStockFilter]);

    useEffect(() => {
        setInvoicePage(1);
    }, [invoiceSearchTerm, selectedSupplierFilter]);

    // Paginated products for fast loading
    const paginatedProducts = useMemo(() => {
        const start = (summaryPage - 1) * summaryPageSize;
        return filteredProducts.slice(start, start + summaryPageSize);
    }, [filteredProducts, summaryPage, summaryPageSize]);

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

    // Paginated invoices for fast loading
    const paginatedInvoices = useMemo(() => {
        const start = (invoicePage - 1) * invoicePageSize;
        return filteredInvoices.slice(start, start + invoicePageSize);
    }, [filteredInvoices, invoicePage, invoicePageSize]);

    // Reset export page when search changes
    useEffect(() => {
        setExportPage(1);
    }, [exportSearchTerm]);

    // Filtered exports
    const filteredExports = useMemo(() => {
        return invoiceExports.filter(exp => {
            if (!exportSearchTerm.trim()) return true;
            const term = exportSearchTerm.trim();
            const matchNum = exp.exportNumber && searchVietnameseMatch(exp.exportNumber, term);
            const matchCreator = exp.creatorName && searchVietnameseMatch(exp.creatorName, term);
            const matchCustomer = exp.customerName && searchVietnameseMatch(exp.customerName, term);
            const matchDate = exp.exportDate && exp.exportDate.includes(term);
            const matchNotes = exp.notes && searchVietnameseMatch(exp.notes, term);
            const matchItems = exp.items && exp.items.some(it => searchVietnameseMatch(it.productName, term));
            return matchNum || matchCreator || matchCustomer || matchDate || matchNotes || matchItems;
        });
    }, [invoiceExports, exportSearchTerm]);

    // Paginated exports
    const paginatedExports = useMemo(() => {
        const start = (exportPage - 1) * exportPageSize;
        return filteredExports.slice(start, start + exportPageSize);
    }, [filteredExports, exportPage, exportPageSize]);

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

    // Delete export invoice and refund totalInvoicedStock
    const handleDeleteExport = async () => {
        if (!exportToDelete) return;
        try {
            const batch = writeBatch(db);
            // Refund the quantities that were deducted by this export
            if (exportToDelete.items && exportToDelete.items.length > 0) {
                exportToDelete.items.forEach(it => {
                    if (it.productId && it.quantity) {
                        const pRef = doc(db, 'products', it.productId);
                        batch.update(pRef, { totalInvoicedStock: increment(it.quantity) });
                    }
                });
            }
            batch.delete(doc(db, 'productInvoiceExports', exportToDelete.id));
            await batch.commit();
            showToast(`Đã xóa phiếu xuất hóa đơn số ${exportToDelete.exportNumber} và hoàn trả lại ${exportToDelete.totalQuantity} tồn hóa đơn`);
            setExportToDelete(null);
        } catch (error) {
            console.error("Lỗi xóa phiếu xuất hóa đơn:", error);
            showToast("Có lỗi xảy ra khi xóa phiếu xuất hóa đơn", 'error');
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
                            Nhập hóa đơn đầu vào từ NCC, xuất hóa đơn tự động trừ tồn HĐ và theo dõi lịch sử xuất nhập
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                    <button
                        onClick={() => {
                            setExportToEdit(null);
                            setSelectedProductForExport(null);
                            setIsCreateExportModalOpen(true);
                        }}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-sm font-black uppercase flex items-center gap-2 shadow-sm transition"
                    >
                        <FileOutput size={18} />
                        <span>Xuất Hóa Đơn Mới</span>
                    </button>
                    <button
                        onClick={() => {
                            setInvoiceToEdit(null);
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
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Tổng tồn HĐ còn lại</span>
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
                        <span className="text-xs font-bold text-slate-400">SP cần HĐ</span>
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

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-tight flex items-center gap-1">
                        <FileOutput size={13} /> Tổng hóa đơn đã xuất
                    </span>
                    <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-black text-indigo-600">{formatNumber(summaryStats.totalExportsCount)}</span>
                        <span className="text-xs font-bold text-slate-400">({formatNumber(summaryStats.totalExportedQty)} cái)</span>
                    </div>
                </div>
            </div>

            {/* Main Tabs Navigation */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="flex border-b border-slate-200 bg-slate-50/60 p-1.5 gap-1.5 flex-wrap sm:flex-nowrap">
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

                    <button
                        onClick={() => setActiveTab('exports')}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs md:text-sm font-black uppercase flex items-center justify-center gap-2 transition-all ${
                            activeTab === 'exports'
                                ? 'bg-white text-indigo-600 shadow-2xs border border-slate-200/80'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                        }`}
                    >
                        <FileOutput size={16} />
                        <span>Lịch Sử Xuất Hóa Đơn</span>
                        <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] bg-indigo-50 text-indigo-700 font-black">
                            {invoiceExports.length}
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
                                        <th className="py-3 px-4 text-right">Giá Nhập HĐ (Cao Nhất)</th>
                                        <th className="py-3 px-4 text-center">Tồn Kho Hóa Đơn</th>
                                        <th className="py-3 px-4 text-center">Trạng Thái Hóa Đơn</th>
                                        <th className="py-3 px-4 text-center w-36">Thao Tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white font-medium">
                                    {filteredProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-8 text-center text-slate-400 font-bold">
                                                Không tìm thấy sản phẩm nào phù hợp
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedProducts.map((p, idx) => {
                                            const globalIdx = (summaryPage - 1) * summaryPageSize + idx + 1;
                                            const invoicedQty = p.totalInvoicedStock || 0;
                                            const hasInvoicedStock = invoicedQty > 0;
                                            const isNegative = invoicedQty < 0;
                                            const mfg = manufacturers.find(m => m.id === p.manufacturerId);
                                            const maxInvoicePrice = productMaxInvoicePriceMap.get(p.id);

                                            return (
                                                <tr key={p.id} className="hover:bg-blue-50/40 transition">
                                                    <td className="py-3 px-4 text-center text-slate-400 font-bold text-xs">{globalIdx}</td>
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
                                                    <td className="py-3 px-4 text-right">
                                                        {maxInvoicePrice ? (
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-blue-700 font-black bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs">
                                                                    {formatNumber(maxInvoicePrice)} ₫
                                                                </span>
                                                                <span className="text-[9px] text-slate-400 font-semibold">HĐ cao nhất</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs italic">Chưa có giá HĐ</span>
                                                        )}
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
                                                                    setInvoiceToEdit(null);
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
                                                                    setExportToEdit(null);
                                                                    setSelectedProductForExport(p);
                                                                    setIsCreateExportModalOpen(true);
                                                                }}
                                                                className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition"
                                                                title="Xuất hóa đơn cho sản phẩm này (trừ tồn HĐ)"
                                                            >
                                                                <FileOutput size={15} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setProductForExportHistoryModal(p);
                                                                }}
                                                                className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition"
                                                                title="Xem lịch sử các lần xuất hóa đơn của sản phẩm này"
                                                            >
                                                                <History size={15} />
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

                        {/* Pagination for Summary Table */}
                        {filteredProducts.length > 0 && (
                            <Pagination
                                currentPage={summaryPage}
                                pageSize={summaryPageSize}
                                totalItems={filteredProducts.length}
                                onPageChange={setSummaryPage}
                                onPageSizeChange={setSummaryPageSize}
                            />
                        )}
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
                                        <th className="py-3 px-4 text-center">Tổng SL HĐ</th>
                                        <th className="py-3 px-4 text-right">Tổng Tiền HĐ</th>
                                        <th className="py-3 px-4">Người Nhập</th>
                                        <th className="py-3 px-4 text-center w-32">Thao Tác</th>
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
                                        paginatedInvoices.map((inv, idx) => {
                                            const globalIdx = (invoicePage - 1) * invoicePageSize + idx + 1;
                                            return (
                                                <tr key={inv.id} className="hover:bg-slate-50 transition">
                                                    <td className="py-3 px-4 text-center text-slate-400 font-bold text-xs">{globalIdx}</td>
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
                                                    <td className="py-3 px-4 text-center">
                                                        <span className="font-black text-base text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                                                            {formatNumber(inv.totalQuantity)}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-black text-slate-800">
                                                        {inv.totalAmount ? (
                                                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold text-xs">
                                                                {formatNumber(inv.totalAmount)} ₫
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs italic">---</span>
                                                        )}
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
                                                                className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition"
                                                                title="Xem chi tiết các sản phẩm trong hóa đơn"
                                                            >
                                                                <Eye size={15} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setInvoiceToEdit(inv);
                                                                    setSelectedProductForQuickInvoice(null);
                                                                    setIsCreateModalOpen(true);
                                                                }}
                                                                className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-lg transition"
                                                                title="Chỉnh sửa hóa đơn"
                                                            >
                                                                <Edit3 size={15} />
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
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination for Invoices Table */}
                        {filteredInvoices.length > 0 && (
                            <Pagination
                                currentPage={invoicePage}
                                pageSize={invoicePageSize}
                                totalItems={filteredInvoices.length}
                                onPageChange={setInvoicePage}
                                onPageSizeChange={setInvoicePageSize}
                            />
                        )}
                    </div>
                )}

                {/* TAB 3: EXPORT INVOICES HISTORY */}
                {activeTab === 'exports' && (
                    <div className="p-4 md:p-6 space-y-4">
                        {/* Filters & Actions for Tab 3 */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="relative w-full sm:w-96">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                <input
                                    type="text"
                                    placeholder="Tìm theo số HĐ, người làm, khách hàng, sản phẩm..."
                                    value={exportSearchTerm}
                                    onChange={e => setExportSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                                />
                                {exportSearchTerm && (
                                    <button
                                        onClick={() => setExportSearchTerm('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={15} />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                                <button
                                    onClick={() => {
                                        setExportToEdit(null);
                                        setSelectedProductForExport(null);
                                        setIsCreateExportModalOpen(true);
                                    }}
                                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition shadow-2xs"
                                >
                                    <FileOutput size={16} />
                                    <span>Xuất Hóa Đơn Mới</span>
                                </button>
                            </div>
                        </div>

                        {/* Export Invoices Table */}
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-900 text-white uppercase text-[11px] tracking-wider">
                                    <tr>
                                        <th className="py-3 px-4 w-12 text-center">STT</th>
                                        <th className="py-3 px-4">Số HĐ / Mã Xuất</th>
                                        <th className="py-3 px-4">Ngày Xuất</th>
                                        <th className="py-3 px-4">Người Làm / Xuất</th>
                                        <th className="py-3 px-4">Khách Hàng / Đơn Vị Nhận</th>
                                        <th className="py-3 px-4 text-center">Tổng SL Xuất</th>
                                        <th className="py-3 px-4 text-right">Tổng Tiền Xuất</th>
                                        <th className="py-3 px-4">Ghi Chú</th>
                                        <th className="py-3 px-4 text-center w-28">Thao Tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white font-medium text-xs">
                                    {paginatedExports.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <FileOutput size={32} className="text-slate-300" />
                                                    <span>{exportSearchTerm ? 'Không tìm thấy phiếu xuất hóa đơn nào phù hợp' : 'Chưa có phiếu xuất hóa đơn nào'}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedExports.map((exp, idx) => {
                                            const globalIdx = (exportPage - 1) * exportPageSize + idx + 1;
                                            return (
                                                <tr key={exp.id} className="hover:bg-indigo-50/40 transition">
                                                    <td className="py-3 px-4 text-center font-bold text-slate-400">
                                                        {globalIdx}
                                                    </td>
                                                    <td className="py-3 px-4 font-black text-indigo-700">
                                                        {exp.exportNumber || '---'}
                                                    </td>
                                                    <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar size={13} className="text-indigo-500" />
                                                            <span>{exp.exportDate || '---'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-xs">
                                                            {exp.creatorName || 'Admin'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                                                        {exp.customerName || '---'}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-black text-xs border border-indigo-200">
                                                            {formatNumber(exp.totalQuantity)} cái
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-black text-emerald-700">
                                                        {exp.totalAmount ? `${formatNumber(exp.totalAmount)} ₫` : '---'}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                                                        {exp.notes || '---'}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedExportDetail(exp);
                                                                    setIsExportDetailModalOpen(true);
                                                                }}
                                                                className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition"
                                                                title="Xem chi tiết các sản phẩm trong phiếu xuất"
                                                            >
                                                                <Eye size={15} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setExportToEdit(exp);
                                                                    setSelectedProductForExport(null);
                                                                    setIsCreateExportModalOpen(true);
                                                                }}
                                                                className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-lg transition"
                                                                title="Chỉnh sửa phiếu xuất hóa đơn"
                                                            >
                                                                <Edit3 size={15} />
                                                            </button>
                                                            <button
                                                                onClick={() => setExportToDelete(exp)}
                                                                className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition"
                                                                title="Xóa phiếu xuất và hoàn trả tồn hóa đơn"
                                                            >
                                                                <Trash2 size={15} />
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

                        {/* Pagination for Exports Table */}
                        {filteredExports.length > 0 && (
                            <Pagination
                                currentPage={exportPage}
                                pageSize={exportPageSize}
                                totalItems={filteredExports.length}
                                onPageChange={setExportPage}
                                onPageSizeChange={setExportPageSize}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* MODAL 1: CREATE OR EDIT INVOICE ENTRY */}
            {isCreateModalOpen && (
                <CreateInvoiceModal
                    isOpen={isCreateModalOpen}
                    onClose={() => {
                        setIsCreateModalOpen(false);
                        setSelectedProductForQuickInvoice(null);
                        setInvoiceToEdit(null);
                    }}
                    initialProduct={selectedProductForQuickInvoice}
                    invoiceToEdit={invoiceToEdit}
                    products={products}
                    suppliers={suppliers}
                    invoices={invoices}
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
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="bg-slate-900 p-4 text-white flex justify-between items-center shrink-0">
                            <h3 className="font-black uppercase text-sm flex items-center gap-2">
                                <FileText size={18} /> Chi Tiết Hóa Đơn: {selectedInvoiceDetail.invoiceNumber}
                            </h3>
                            <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                                <div>
                                    <span className="text-slate-400 uppercase font-bold block text-[10px]">Ngày xuất hóa đơn</span>
                                    <span className="font-black text-slate-800 text-sm">{selectedInvoiceDetail.issueDate}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 uppercase font-bold block text-[10px]">Nhà cung cấp</span>
                                    <span className="font-black text-slate-800 text-sm truncate block">{selectedInvoiceDetail.supplierName || '---'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 uppercase font-bold block text-[10px]">Tổng số lượng HĐ</span>
                                    <span className="font-black text-emerald-600 text-sm">{formatNumber(selectedInvoiceDetail.totalQuantity)} cái/chiếc</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 uppercase font-bold block text-[10px]">Tổng tiền HĐ</span>
                                    <span className="font-black text-blue-600 text-sm">
                                        {selectedInvoiceDetail.totalAmount ? `${formatNumber(selectedInvoiceDetail.totalAmount)} ₫` : '---'}
                                    </span>
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
                                                <th className="py-2.5 px-3 text-center">Số lượng HĐ</th>
                                                <th className="py-2.5 px-3 text-right">Đơn giá HĐ</th>
                                                <th className="py-2.5 px-3 text-right">Thành tiền</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {selectedInvoiceDetail.items?.map((it, idx) => (
                                                <tr key={idx}>
                                                    <td className="py-2.5 px-3 font-bold text-slate-800">{it.productName}</td>
                                                    <td className="py-2.5 px-3 text-center font-black text-blue-600">{it.quantity} cái/chiếc</td>
                                                    <td className="py-2.5 px-3 text-right font-bold text-slate-700">
                                                        {it.unitPrice ? `${formatNumber(it.unitPrice)} ₫` : '---'}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-black text-emerald-600">
                                                        {it.unitPrice ? `${formatNumber(it.quantity * it.unitPrice)} ₫` : '---'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                            <button
                                onClick={() => {
                                    const inv = selectedInvoiceDetail;
                                    setIsDetailModalOpen(false);
                                    setInvoiceToEdit(inv);
                                    setSelectedProductForQuickInvoice(null);
                                    setIsCreateModalOpen(true);
                                }}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs uppercase flex items-center gap-1.5 transition shadow-2xs"
                            >
                                <Edit3 size={15} />
                                Chỉnh Sửa Hóa Đơn Này
                            </button>
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

            {/* CONFIRM DELETE INVOICE MODAL */}
            {invoiceToDelete && (
                <ConfirmationModal
                    isOpen={!!invoiceToDelete}
                    title="Xóa Hóa Đơn Nhà Cung Cấp"
                    message={`Bạn có chắc chắn muốn xóa hóa đơn "${invoiceToDelete.invoiceNumber}" không? Hệ thống sẽ tự động trừ lại số lượng ${invoiceToDelete.totalQuantity} khỏi tồn hóa đơn của các sản phẩm tương ứng.`}
                    onConfirm={handleDeleteInvoice}
                    onClose={() => setInvoiceToDelete(null)}
                />
            )}

            {/* MODAL: CREATE OR EDIT EXPORT INVOICE */}
            {isCreateExportModalOpen && (
                <CreateExportInvoiceModal
                    isOpen={isCreateExportModalOpen}
                    onClose={() => {
                        setIsCreateExportModalOpen(false);
                        setSelectedProductForExport(null);
                        setExportToEdit(null);
                    }}
                    initialProduct={selectedProductForExport}
                    exportToEdit={exportToEdit}
                    products={products}
                    currentUser={user}
                    onSuccess={(msg) => showToast(msg, 'success')}
                />
            )}

            {/* MODAL: VIEW PRODUCT EXPORT HISTORY */}
            {productForExportHistoryModal && (
                <ProductExportHistoryModal
                    isOpen={!!productForExportHistoryModal}
                    product={productForExportHistoryModal}
                    invoiceExports={invoiceExports}
                    manufacturers={manufacturers}
                    onClose={() => setProductForExportHistoryModal(null)}
                    onQuickExport={(prod) => {
                        setExportToEdit(null);
                        setSelectedProductForExport(prod);
                        setIsCreateExportModalOpen(true);
                    }}
                    onViewExportDetail={(expDoc) => {
                        setSelectedExportDetail(expDoc);
                        setIsExportDetailModalOpen(true);
                    }}
                />
            )}

            {/* MODAL: VIEW EXPORT INVOICE DETAIL */}
            {isExportDetailModalOpen && selectedExportDetail && (
                <ExportInvoiceDetailModal
                    isOpen={isExportDetailModalOpen}
                    exportDoc={selectedExportDetail}
                    onClose={() => {
                        setIsExportDetailModalOpen(false);
                        setSelectedExportDetail(null);
                    }}
                    onEdit={(expDoc) => {
                        setIsExportDetailModalOpen(false);
                        setSelectedExportDetail(null);
                        setSelectedProductForExport(null);
                        setExportToEdit(expDoc);
                        setIsCreateExportModalOpen(true);
                    }}
                />
            )}

            {/* CONFIRM DELETE EXPORT MODAL */}
            {exportToDelete && (
                <ConfirmationModal
                    isOpen={!!exportToDelete}
                    title="Xóa Phiếu Xuất Hóa Đơn"
                    message={`Bạn có chắc chắn muốn xóa phiếu xuất hóa đơn "${exportToDelete.exportNumber}" không? Hệ thống sẽ tự động hoàn trả lại số lượng ${exportToDelete.totalQuantity} vào tồn hóa đơn của các sản phẩm tương ứng.`}
                    onConfirm={handleDeleteExport}
                    onClose={() => setExportToDelete(null)}
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

// SUB-COMPONENT: MODAL CREATE / EDIT INVOICE
interface CreateInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialProduct: Product | null;
    invoiceToEdit?: ProductInvoice | null;
    products: Product[];
    suppliers: Supplier[];
    invoices: ProductInvoice[];
    currentUser: any;
    onSuccess: (msg: string) => void;
}

const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
    isOpen,
    onClose,
    initialProduct,
    invoiceToEdit,
    products,
    suppliers,
    invoices,
    currentUser,
    onSuccess
}) => {
    // Helper: find previous invoice price for a product, prioritizing selected supplier
    const getPreviousInvoicePrice = (productId: string, currentSupplierId?: string) => {
        // 1. Try to find from this supplier's previous invoices (sorted newest to oldest)
        if (currentSupplierId) {
            for (const inv of invoices) {
                if (invoiceToEdit && inv.id === invoiceToEdit.id) continue;
                if (inv.supplierId === currentSupplierId) {
                    const matchItem = inv.items?.find(it => it.productId === productId && typeof it.unitPrice === 'number' && it.unitPrice > 0);
                    if (matchItem && matchItem.unitPrice !== undefined) {
                        return { price: matchItem.unitPrice, source: 'ncc' as const };
                    }
                }
            }
        }
        // 2. Try to find from any previous invoice
        for (const inv of invoices) {
            if (invoiceToEdit && inv.id === invoiceToEdit.id) continue;
            const matchItem = inv.items?.find(it => it.productId === productId && typeof it.unitPrice === 'number' && it.unitPrice > 0);
            if (matchItem && matchItem.unitPrice !== undefined) {
                return { price: matchItem.unitPrice, source: 'other_invoice' as const };
            }
        }
        // 3. Fallback to product importPrice
        const prod = products.find(p => p.id === productId);
        return { price: prod?.importPrice || 0, source: 'import_price' as const };
    };

    const [invoiceNumber, setInvoiceNumber] = useState(() => invoiceToEdit?.invoiceNumber || '');
    const [issueDate, setIssueDate] = useState(() => invoiceToEdit?.issueDate || getLocalYYYYMMDD());
    const [supplierId, setSupplierId] = useState(() => invoiceToEdit?.supplierId || '');
    const [supplierSearchTerm, setSupplierSearchTerm] = useState(() => invoiceToEdit?.supplierName || '');
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const supplierDropdownRef = useRef<HTMLDivElement>(null);
    const [notes, setNotes] = useState(() => invoiceToEdit?.notes || '');
    const [items, setItems] = useState<ProductInvoiceItem[]>(() => {
        if (invoiceToEdit && invoiceToEdit.items) {
            return JSON.parse(JSON.stringify(invoiceToEdit.items));
        }
        if (initialProduct) {
            const prev = getPreviousInvoicePrice(initialProduct.id);
            return [{
                productId: initialProduct.id,
                productName: initialProduct.name,
                quantity: 1,
                unitPrice: prev.price
            }];
        }
        return [];
    });

    // Close supplier dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent | TouchEvent) => {
            if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(e.target as Node)) {
                setIsSupplierDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, []);

    // When a supplier is chosen, update price of items if that supplier has previous invoice prices
    const handleSelectSupplier = (s: Supplier) => {
        setSupplierId(s.id);
        setSupplierSearchTerm(s.name);
        setIsSupplierDropdownOpen(false);

        // Auto-update prices of already selected items if this supplier has a previous price recorded
        setItems(prevItems => prevItems.map(it => {
            const prev = getPreviousInvoicePrice(it.productId, s.id);
            if (prev.source === 'ncc') {
                return { ...it, unitPrice: prev.price };
            }
            return it;
        }));
    };

    // Quick add new supplier like in goods receipt
    const handleQuickCreateSupplier = async (data: any) => {
        try {
            const docRef = await addDoc(collection(db, 'suppliers'), { ...data, createdAt: serverTimestamp() });
            setSupplierId(docRef.id);
            setSupplierSearchTerm(data.name);
            setIsSupplierModalOpen(false);
        } catch (e) {
            console.error(e);
            alert("Lỗi khi tạo nhà cung cấp.");
        }
    };

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
            const prevPriceInfo = getPreviousInvoicePrice(product.id, supplierId);
            setItems([...items, {
                productId: product.id,
                productName: product.name,
                quantity: 1,
                unitPrice: prevPriceInfo.price
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
        const val = Math.max(0, price);
        const updated = [...items];
        updated[idx].unitPrice = val;
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
        const totalAmount = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);

        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);

            if (invoiceToEdit) {
                // EDIT MODE
                // 1. Calculate stock adjustments for totalInvoicedStock
                const oldItemQtyMap = new Map<string, number>();
                (invoiceToEdit.items || []).forEach(it => {
                    if (it.productId) {
                        oldItemQtyMap.set(it.productId, (oldItemQtyMap.get(it.productId) || 0) + (Number(it.quantity) || 0));
                    }
                });

                const newItemQtyMap = new Map<string, number>();
                items.forEach(it => {
                    if (it.productId) {
                        newItemQtyMap.set(it.productId, (newItemQtyMap.get(it.productId) || 0) + (Number(it.quantity) || 0));
                    }
                });

                // Difference for all affected products
                const allProductIds = new Set<string>([...oldItemQtyMap.keys(), ...newItemQtyMap.keys()]);
                allProductIds.forEach(pId => {
                    const oldQty = oldItemQtyMap.get(pId) || 0;
                    const newQty = newItemQtyMap.get(pId) || 0;
                    const diff = newQty - oldQty;
                    if (diff !== 0) {
                        const pRef = doc(db, 'products', pId);
                        batch.update(pRef, { totalInvoicedStock: increment(diff) });
                    }
                });

                const invoiceRef = doc(db, 'productInvoices', invoiceToEdit.id);
                const updatedData = {
                    invoiceNumber: invoiceNumber.trim() || invoiceToEdit.invoiceNumber || `HD-${Date.now().toString().slice(-6)}`,
                    issueDate: issueDate || getLocalYYYYMMDD(),
                    supplierId: supplierId || '',
                    supplierName: sup?.name || supplierSearchTerm.trim() || 'Nhà Cung Cấp',
                    notes: notes.trim(),
                    items,
                    totalQuantity,
                    totalAmount,
                    updatedAt: serverTimestamp(),
                    lastEditorName: currentUser?.displayName || currentUser?.email || 'Admin'
                };

                batch.update(invoiceRef, updatedData);
                await batch.commit();
                onSuccess(`Đã cập nhật hóa đơn số ${updatedData.invoiceNumber} thành công!`);
            } else {
                // CREATE MODE
                const invoiceRef = doc(collection(db, 'productInvoices'));

                const invoiceData = {
                    invoiceNumber: invoiceNumber.trim() || `HD-${Date.now().toString().slice(-6)}`,
                    issueDate: issueDate || getLocalYYYYMMDD(),
                    supplierId: supplierId || '',
                    supplierName: sup?.name || supplierSearchTerm.trim() || 'Nhà Cung Cấp',
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
            }

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

    const selectedSupplier = suppliers.find(s => s.id === supplierId);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                <div className={`${invoiceToEdit ? 'bg-amber-600' : 'bg-blue-600'} p-4 text-white flex justify-between items-center shrink-0`}>
                    <h3 className="font-black uppercase text-sm flex items-center gap-2">
                        {invoiceToEdit ? (
                            <>
                                <Edit3 size={20} /> Chỉnh Sửa Hóa Đơn: {invoiceToEdit.invoiceNumber || 'HĐ'}
                            </>
                        ) : (
                            <>
                                <PlusCircle size={20} /> Nhập Hóa Đơn Sản Phẩm Từ NCC
                            </>
                        )}
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

                        {/* Row 2: Supplier with Search & Quick Add + Notes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                                    Nhà Cung Cấp
                                </label>
                                <div className="relative flex gap-1.5" ref={supplierDropdownRef}>
                                    <div className="relative flex-1">
                                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Tìm hoặc chọn NCC..."
                                            value={supplierSearchTerm}
                                            onChange={e => {
                                                setSupplierSearchTerm(e.target.value);
                                                setIsSupplierDropdownOpen(true);
                                            }}
                                            onFocus={() => setIsSupplierDropdownOpen(true)}
                                            className="w-full pl-9 pr-8 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 text-slate-800"
                                        />
                                        {supplierSearchTerm && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSupplierSearchTerm('');
                                                    setSupplierId('');
                                                }}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                        {isSupplierDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                                                {suppliers.filter(s => {
                                                    const q = supplierSearchTerm.trim();
                                                    if (!q) return true;
                                                    return searchVietnameseMatch(s.name, q) ||
                                                           (s.phone && s.phone.includes(q)) ||
                                                           removeVietnameseTones(s.name).toLowerCase().includes(removeVietnameseTones(q).toLowerCase());
                                                }).length === 0 ? (
                                                    <div className="p-3 text-center text-xs text-slate-400 font-bold">
                                                        Không tìm thấy NCC nào
                                                    </div>
                                                ) : (
                                                    suppliers.filter(s => {
                                                        const q = supplierSearchTerm.trim();
                                                        if (!q) return true;
                                                        return searchVietnameseMatch(s.name, q) ||
                                                               (s.phone && s.phone.includes(q)) ||
                                                               removeVietnameseTones(s.name).toLowerCase().includes(removeVietnameseTones(q).toLowerCase());
                                                    }).map(s => (
                                                        <button
                                                            key={s.id}
                                                            type="button"
                                                            onClick={() => handleSelectSupplier(s)}
                                                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-xs font-bold text-slate-800 flex justify-between items-center transition"
                                                        >
                                                            <span className="truncate">{s.name}</span>
                                                            {s.phone && <span className="text-[11px] text-slate-400 font-normal shrink-0 ml-2">{s.phone}</span>}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsSupplierModalOpen(true)}
                                        title="Tạo nhanh nhà cung cấp mới"
                                        className="px-3 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition shadow-sm shrink-0 flex items-center justify-center"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                                {selectedSupplier && (
                                    <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-2">
                                        <span>NCC đã chọn: <strong className="text-slate-700">{selectedSupplier.name}</strong></span>
                                        {selectedSupplier.phone && <span>• SĐT: {selectedSupplier.phone}</span>}
                                    </div>
                                )}
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
                                        searchFilteredProducts.map(p => {
                                            const prevPrice = getPreviousInvoicePrice(p.id, supplierId);
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => handleAddItem(p)}
                                                    className="w-full text-left p-2.5 hover:bg-blue-50 text-xs flex justify-between items-center transition"
                                                >
                                                    <div>
                                                        <span className="font-bold uppercase text-slate-800 block">{p.name}</span>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            {prevPrice.source === 'ncc' ? (
                                                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                                    Giá HĐ NCC lần trước: {formatNumber(prevPrice.price)} ₫
                                                                </span>
                                                            ) : prevPrice.source === 'other_invoice' ? (
                                                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                                                    Giá HĐ gần nhất: {formatNumber(prevPrice.price)} ₫
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400">
                                                                    Giá nhập gốc: {formatNumber(prevPrice.price)} ₫
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                        Tồn HĐ hiện tại: {p.totalInvoicedStock || 0}
                                                    </span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selected Items List */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden mt-3">
                            <div className="bg-slate-100 px-3 py-2 text-[11px] font-black uppercase text-slate-600 flex flex-wrap justify-between items-center gap-2">
                                <span>Danh Sách Sản Phẩm Trong Hóa Đơn ({items.length})</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-blue-600 font-bold">
                                        Tổng SL: {items.reduce((acc, it) => acc + (it.quantity || 0), 0)} cái
                                    </span>
                                    <span className="text-emerald-700 font-black">
                                        Tổng tiền: {formatNumber(items.reduce((acc, it) => acc + (it.quantity || 0) * (it.unitPrice || 0), 0))} ₫
                                    </span>
                                </div>
                            </div>

                            {items.length === 0 ? (
                                <div className="p-6 text-center text-xs text-slate-400 font-bold">
                                    Chưa có sản phẩm nào. Hãy tìm và thêm sản phẩm ở trên.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                                    {items.map((it, idx) => (
                                        <div key={idx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-xs uppercase text-slate-900 truncate">{it.productName}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] text-slate-400">Đơn vị: chiếc/cái</span>
                                                    {it.unitPrice && it.unitPrice > 0 ? (
                                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                            Thành tiền: {formatNumber((it.quantity || 1) * it.unitPrice)} ₫
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
                                                {/* Unit Price input with NumericInput */}
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[11px] font-black text-slate-500 uppercase whitespace-nowrap">Đơn Giá:</span>
                                                    <div className="relative w-28">
                                                        <NumericInput
                                                            value={it.unitPrice ?? 0}
                                                            onChange={(val) => handleUpdateUnitPrice(idx, val)}
                                                            placeholder="0"
                                                            className="w-full py-1 px-2 text-right border-2 border-slate-200 rounded-lg font-black text-xs text-slate-800 outline-none focus:border-blue-500"
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400">₫</span>
                                                </div>

                                                {/* Quantity Controls */}
                                                <div className="flex items-center gap-1">
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
                                                        className="w-12 p-1 text-center border-2 border-slate-200 rounded-lg font-black text-xs text-blue-600 outline-none"
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
                            className={`flex-1 py-2.5 ${invoiceToEdit ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-xl font-black text-xs uppercase transition shadow-sm disabled:bg-slate-300 flex items-center justify-center gap-2`}
                        >
                            <Save size={16} />
                            <span>{isSubmitting ? 'Đang Lưu...' : (invoiceToEdit ? 'Cập Nhật Hóa Đơn' : 'Lưu Hóa Đơn')}</span>
                        </button>
                    </div>
                </form>

                {/* Quick Add Supplier Modal like in Goods Receipt */}
                {isSupplierModalOpen && (
                    <SupplierModal
                        supplier={null}
                        onClose={() => setIsSupplierModalOpen(false)}
                        onSave={handleQuickCreateSupplier}
                        existingNames={suppliers.map(s => s.name)}
                    />
                )}
            </div>
        </div>
    );
};

export default ProductInvoiceManagement;
