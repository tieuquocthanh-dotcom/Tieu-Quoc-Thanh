
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, writeBatch, doc, serverTimestamp, query, orderBy, where, increment, collectionGroup, addDoc, Timestamp, updateDoc, getDocs, limit, arrayUnion, runTransaction, setDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { Product, SaleItem, Customer, Warehouse, PaymentMethod, Shipper, Sale, Supplier, Manufacturer } from '../types';
import { ShoppingCart, Plus, Minus, X, CheckCircle, Loader, XCircle, Search, User, Archive, CreditCard, Truck, Info, History, PlusCircle, Package, Calendar, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, RefreshCcw, FileCheck2, AlertTriangle, Tag, List, Store, Wallet, TrendingUp, Mic, MicOff, Square, Volume2, Download, GitCommit, Save, Users, BarChart2, DollarSign, ArrowUp, ArrowDown, ArrowUpDown, Edit, ArrowRightLeft, TrendingDown, Maximize2, Minimize2, Banknote, Coins, Receipt, Percent, DownloadCloud, FileText, Trash2, Eye, RotateCcw, Clock, AlertCircle, Layers, Settings2, Home, ExternalLink, TrendingUp as ProfitIcon, WalletCards, CheckCheck, Boxes } from 'lucide-react';
import { formatNumber, parseNumber } from '../utils/formatting';
import SalesHistory from './SalesHistory';
import CustomerModal from './CustomerModal';
import SaleDetailModal from './SaleDetailModal';
import SaleEditModal from './SaleEditModal';
import ProductSalesHistory from './ProductSalesHistory';
import InventoryTransferModal from './InventoryTransferModal';
import PriceComparisonModal from './PriceComparisonModal';
import InventoryLedger from './InventoryLedger';
import { ProductModal } from './ProductManagement';
import { ShipperModal } from './ShippingManagement';
import { User as FirebaseAuthUser } from 'firebase/auth';
import { StockStatusBadge } from './StockStatusBadge';

const NumericInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    className?: string;
    placeholder?: string;
    onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
    onBlur?: () => void;
    isCurrency?: boolean;
    autoFocus?: boolean;
}> = ({ value, onChange, className, placeholder, onFocus, onBlur, isCurrency = true, autoFocus = false }) => {
    const [localValue, setLocalValue] = useState(isCurrency ? formatNumber(value) : value.toString());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    useEffect(() => {
        const parsedLocal = parseNumber(localValue);
        if (value !== parsedLocal) {
             setLocalValue(isCurrency ? formatNumber(value) : value.toString());
        }
    }, [value, isCurrency, localValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setLocalValue(raw);
        onChange(parseNumber(raw));
    };

    const handleBlur = (e?: React.FocusEvent<HTMLInputElement>) => {
        const parsed = parseNumber(localValue);
        setLocalValue(isCurrency ? formatNumber(parsed) : parsed.toString());
        if (onBlur) onBlur();
    };

    return (
        <input
            ref={inputRef}
            type="text"
            inputMode={isCurrency ? "numeric" : "decimal"}
            value={localValue}
            placeholder={placeholder}
            className={className}
            onFocus={(e) => {
                if (value === 0) setLocalValue("");
                onFocus?.(e);
            }}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={(e) => {
                if (e.key === 'Enter') handleBlur();
            }}
        />
    );
};

// --- QUICK IMPORT MODAL ---
const QuickImportModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    warehouses: Warehouse[];
    suppliers: Supplier[];
    paymentMethods: PaymentMethod[];
    onConfirm: (data: { supplierId: string, warehouseId: string, quantity: number, importPrice: number, paymentStatus: 'paid' | 'debt', paymentMethodId: string, updateBasePrice: boolean }) => void;
    isProcessing: boolean;
}> = ({ isOpen, onClose, product, warehouses, suppliers, paymentMethods, onConfirm, isProcessing }) => {
    const [supplierId, setSupplierId] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [importPrice, setImportPrice] = useState(0);
    const [paymentStatus, setPaymentStatus] = useState<'paid' | 'debt'>('debt');
    const [paymentMethodId, setPaymentMethodId] = useState('');
    const [updateBasePrice, setUpdateBasePrice] = useState(true);
    const [lastSupplierPrice, setLastSupplierPrice] = useState<number | null>(null);

    // Truy vấn giá nhập gần nhất của NCC này cho sản phẩm này
    useEffect(() => {
        if (isOpen && product && supplierId) {
            const q = query(
                collection(db, "goodsReceipts"),
                where("supplierId", "==", supplierId),
                orderBy("createdAt", "desc"),
                limit(10)
            );
            const unsubscribe = onSnapshot(q, (snapshot) => {
                let foundPrice = null;
                for (const doc of snapshot.docs) {
                    const data = doc.data();
                    const item = data.items?.find((i: any) => i.productId === product.id);
                    if (item) {
                        foundPrice = item.importPrice;
                        break;
                    }
                }
                if (foundPrice !== null) {
                    setLastSupplierPrice(foundPrice);
                    setImportPrice(foundPrice);
                } else {
                    setLastSupplierPrice(null);
                    setImportPrice(product.importPrice);
                }
            });
            return () => unsubscribe();
        } else if (isOpen && product && !supplierId) {
            setImportPrice(product.importPrice);
            setLastSupplierPrice(null);
        }
    }, [isOpen, product, supplierId]);

    useEffect(() => {
        if (isOpen && product) {
            setQuantity(1);
            setPaymentStatus('debt');
            setPaymentMethodId('');
            setUpdateBasePrice(true);
        }
    }, [isOpen, product]);

    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
                <div className="bg-green-600 p-4 text-white flex justify-between items-center">
                    <h3 className="font-black uppercase text-sm flex items-center"><DownloadCloud className="mr-2" size={20}/> Nhập hàng nhanh</h3>
                    <button onClick={onClose}><X size={24}/></button>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="bg-slate-50 p-3 rounded-xl border-2 border-slate-200">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Sản phẩm</p>
                        <p className="text-sm font-black text-slate-800 uppercase">{product.name}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Nhà cung cấp</label>
                            <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full p-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-primary">
                                <option value="">-- CHỌN NCC --</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Kho nhập</label>
                            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="w-full p-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-primary">
                                <option value="">-- CHỌN KHO --</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Số lượng</label>
                            <input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 0)} className="w-full p-2 border-2 border-slate-200 rounded-lg font-black text-center" min="1" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Giá nhập (₫)</label>
                            <NumericInput value={importPrice} onChange={setImportPrice} className="w-full p-2 border-2 border-slate-200 rounded-lg font-black text-right" />
                            {lastSupplierPrice !== null && (
                                <p className="text-[9px] text-blue-600 font-bold mt-1 uppercase">Giá cũ NCC này: {formatNumber(lastSupplierPrice)} ₫</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-500 uppercase">Thanh toán</span>
                            <div className="flex bg-white p-1 rounded-lg border border-slate-300">
                                <button 
                                    type="button"
                                    onClick={() => setPaymentStatus('debt')}
                                    className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all ${paymentStatus === 'debt' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400'}`}
                                >Ghi nợ</button>
                                <button 
                                    type="button"
                                    onClick={() => setPaymentStatus('paid')}
                                    className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all ${paymentStatus === 'paid' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-400'}`}
                                >Trả ngay</button>
                            </div>
                        </div>

                        {paymentStatus === 'paid' && (
                            <div className="animate-fade-in">
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Tài khoản chi tiền</label>
                                <select 
                                    value={paymentMethodId} 
                                    onChange={e => setPaymentMethodId(e.target.value)}
                                    className="w-full p-2 border-2 border-slate-300 rounded-lg font-bold text-xs outline-none focus:border-primary"
                                >
                                    <option value="">-- Chọn tài khoản --</option>
                                    {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="flex items-center">
                            <input 
                                type="checkbox" 
                                id="update-base-price" 
                                checked={updateBasePrice} 
                                onChange={e => setUpdateBasePrice(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-0 mr-2 cursor-pointer"
                            />
                            <label htmlFor="update-base-price" className="text-[10px] font-black text-slate-600 uppercase cursor-pointer">Cập nhật giá vốn gốc sản phẩm</label>
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-slate-50 flex gap-2 border-t">
                    <button onClick={onClose} className="flex-1 py-3 bg-white border-2 border-slate-800 rounded-xl font-black text-xs uppercase text-black transition hover:bg-slate-100">Hủy</button>
                    <button 
                        onClick={() => onConfirm({ supplierId, warehouseId, quantity, importPrice, paymentStatus, paymentMethodId, updateBasePrice })}
                        disabled={isProcessing || !supplierId || !warehouseId || quantity <= 0 || (paymentStatus === 'paid' && !paymentMethodId)}
                        className="flex-1 py-3 bg-green-600 text-white rounded-xl font-black text-xs uppercase shadow-lg transition active:scale-95 disabled:bg-slate-300 flex items-center justify-center"
                    >
                        {isProcessing ? <Loader className="animate-spin" size={18}/> : 'Xác nhận nhập'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- EDIT WAREHOUSE STOCK MODAL ---
const EditWarehouseStockModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    warehouses: Warehouse[];
    detailedInventory: Record<string, Record<string, number>>;
    initialWarehouseId?: string;
    onSave: (productId: string, stockUpdates: Record<string, number>) => Promise<void>;
    isProcessing: boolean;
}> = ({ isOpen, onClose, product, warehouses, detailedInventory, initialWarehouseId, onSave, isProcessing }) => {
    const [stocks, setStocks] = useState<Record<string, number>>({});

    useEffect(() => {
        if (isOpen && product) {
            const initialMap: Record<string, number> = {};
            const productInv = detailedInventory[product.id] || {};
            warehouses.forEach(w => {
                initialMap[w.id] = productInv[w.id] ?? 0;
            });
            setStocks(initialMap);
        }
    }, [isOpen, product, warehouses, detailedInventory]);

    if (!isOpen || !product) return null;

    const currentTotal = warehouses.reduce((sum, w) => sum + (detailedInventory[product.id]?.[w.id] ?? 0), 0);
    const newTotal = Object.values(stocks).reduce((sum, val) => sum + (Number(val) || 0), 0);
    const diff = newTotal - currentTotal;

    const handleStockChange = (whId: string, val: number) => {
        setStocks(prev => ({
            ...prev,
            [whId]: Math.max(0, val)
        }));
    };

    const handleAdjust = (whId: string, delta: number) => {
        setStocks(prev => ({
            ...prev,
            [whId]: Math.max(0, (prev[whId] || 0) + delta)
        }));
    };

    const handleResetToZero = (whId: string) => {
        setStocks(prev => ({
            ...prev,
            [whId]: 0
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave(product.id, stocks);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[250] p-4 animate-fade-in backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-down">
                {/* Header */}
                <div className="bg-slate-900 p-4 text-white flex justify-between items-center border-b border-slate-800">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                            <Boxes size={20} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-black uppercase text-sm tracking-tight truncate">Chỉnh sửa số lượng từng kho</h3>
                            <p className="text-xs text-slate-400 truncate mt-0.5">{product.name}</p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Sub-header info */}
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">Sản phẩm:</span>
                        <span className="text-xs font-black text-slate-800 uppercase truncate max-w-[200px]">{product.name}</span>
                        {product.shortName && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded border border-amber-300 shrink-0">
                                {product.shortName}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold">
                        <div>
                            <span className="text-slate-500">Tồn hiện tại: </span>
                            <span className="font-black text-slate-900">{currentTotal}</span>
                        </div>
                        <div>
                            <span className="text-slate-500">Tồn mới: </span>
                            <span className={`font-black ${newTotal !== currentTotal ? (diff > 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-900'}`}>
                                {newTotal} {diff !== 0 && `(${diff > 0 ? `+${diff}` : diff})`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Form / Warehouse list */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3">
                    {warehouses.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs font-bold">
                            Chưa có kho hàng nào được tạo trong hệ thống.
                        </div>
                    ) : (
                        warehouses.map(w => {
                            const currentStock = detailedInventory[product.id]?.[w.id] ?? 0;
                            const newStock = stocks[w.id] ?? 0;
                            const isFocused = initialWarehouseId === w.id;
                            const isChanged = newStock !== currentStock;

                            return (
                                <div 
                                    key={w.id} 
                                    className={`p-3 rounded-xl border transition-all ${isChanged ? 'bg-blue-50/60 border-blue-300 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Archive size={16} className="text-blue-600" />
                                            <span className="font-black text-sm text-slate-800 uppercase">{w.name}</span>
                                            {isFocused && (
                                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-black rounded uppercase">Đang chọn</span>
                                            )}
                                        </div>
                                        <div className="text-right text-xs">
                                            <span className="text-slate-400 font-bold">Hiện có: </span>
                                            <span className={`font-black ${currentStock > 5 ? 'text-emerald-600' : currentStock > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                {currentStock}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 relative">
                                            <input 
                                                type="number" 
                                                min="0"
                                                autoFocus={isFocused}
                                                value={newStock}
                                                onChange={(e) => handleStockChange(w.id, parseInt(e.target.value) || 0)}
                                                onFocus={(e) => e.target.select()}
                                                className="w-full pl-3 pr-8 py-2 text-center text-base font-black text-slate-900 bg-white border-2 border-slate-300 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                            />
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">
                                                Cái
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <button 
                                                type="button"
                                                onClick={() => handleAdjust(w.id, -10)}
                                                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-lg text-xs font-black transition"
                                                title="Giảm 10"
                                            >
                                                -10
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => handleAdjust(w.id, -1)}
                                                className="p-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-lg transition"
                                                title="Giảm 1"
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => handleAdjust(w.id, 1)}
                                                className="p-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-lg transition"
                                                title="Tăng 1"
                                            >
                                                <Plus size={14} />
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => handleAdjust(w.id, 10)}
                                                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-lg text-xs font-black transition"
                                                title="Tăng 10"
                                            >
                                                +10
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => handleResetToZero(w.id)}
                                                className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 rounded-lg text-xs font-black transition"
                                                title="Đặt về 0"
                                            >
                                                =0
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}

                    <div className="p-4 bg-slate-50 flex gap-2 border-t border-slate-200 mt-4 rounded-xl">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 py-2.5 bg-white border-2 border-slate-300 hover:bg-slate-100 rounded-xl font-black text-xs uppercase text-slate-700 transition"
                        >
                            Hủy
                        </button>
                        <button 
                            type="submit"
                            disabled={isProcessing}
                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase shadow-md transition active:scale-95 disabled:bg-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            {isProcessing ? <Loader className="animate-spin" size={16} /> : <><CheckCheck size={16} /> Lưu thay đổi</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface CartItem extends SaleItem {
  stock: number;
  invoicedStock: number; 
  originalImportPrice: number;
  originalSellingPrice: number;
  updateSellingPrice: boolean;
  updateImportPrice: boolean;
  currentImportPrice: number;
  isCombo?: boolean;
  comboItems?: any[];
}

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const Toast: React.FC<{ message: string; type: 'error' | 'success'; onClose: () => void }> = ({ message, type, onClose }) => {
    useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
    return (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[200] flex items-center p-4 rounded-2xl shadow-2xl border-2 animate-fade-in-down ${type === 'error' ? 'bg-red-50 border-red-600 text-red-700' : 'bg-green-50 border-green-600 text-green-700'}`}>
            {type === 'error' ? <XCircle className="mr-3" size={24} /> : <CheckCircle className="mr-3" size={24} />}
            <span className="font-black uppercase text-sm">{message}</span>
            <button onClick={onClose} className="ml-4 hover:opacity-70"><X size={18} /></button>
        </div>
    );
};

const ProductCardItem: React.FC<{ 
    product: Product; 
    detailedInventory: Record<string, Record<string, number>>; 
    warehouses: Warehouse[]; 
    shippingMode: string; 
    onAdd: (product: Product, quantity: number, price: number, importPrice: number, keepSearch?: boolean) => void; 
    onQuickImport?: (product: Product) => void; 
    onTransfer?: (product: Product) => void; 
    onEditStock?: (product: Product, targetWarehouseId?: string) => void;
    onUpdatePrice?: (productId: string, price: number) => Promise<void>; 
    onUpdateImportPrice?: (productId: string, price: number) => Promise<void>; 
    lastSoldPrice?: number; 
    isPOS?: boolean; 
    isAdmin?: boolean; 
    onCompare?: (product: Product) => void; 
}> = ({ product, detailedInventory, warehouses, shippingMode, onAdd, onQuickImport, onTransfer, onEditStock, onUpdatePrice, onUpdateImportPrice, lastSoldPrice, isPOS, isAdmin, onCompare }) => {
    const [inputQty, setInputQty] = useState(1);
    const [inputPrice, setInputPrice] = useState(lastSoldPrice !== undefined ? lastSoldPrice : product.sellingPrice);
    const [inputImportPrice, setInputImportPrice] = useState(product.importPrice);
    const [isNameExpanded, setIsNameExpanded] = useState(false);

    // CẬP NHẬT: Luôn cập nhật giá hiển thị khi lastSoldPrice thay đổi (khi chọn khách hàng khác)
    useEffect(() => { 
        setInputPrice(lastSoldPrice !== undefined ? lastSoldPrice : product.sellingPrice); 
    }, [product.sellingPrice, lastSoldPrice]);

    useEffect(() => { setInputImportPrice(product.importPrice); }, [product.importPrice]);

    const top3Warehouses = warehouses.slice(0, 3);
    const productInventory = detailedInventory[product.id] || {};
    const totalStock = Object.values(productInventory).reduce((acc, qty) => acc + (typeof qty === 'number' ? qty : 0), 0);

    return (
        <div className={`bg-white border border-slate-200/90 rounded-xl p-3 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between relative group hover:border-primary/50 ${isPOS ? 'h-full' : ''}`}>
            {product.isCombo && (
                <div className="absolute top-0 left-0 bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded-br-lg font-black z-10 uppercase shadow-2xs">COMBO</div>
            )}
            {/* Header: Product Name + Action Buttons */}
            <div className="mb-2 mt-1 flex justify-between items-center gap-1">
                <div 
                    className={`font-bold text-slate-900 leading-tight text-[12px] cursor-pointer transition-all ${isNameExpanded ? '' : 'line-clamp-2 hover:line-clamp-none'} flex-1 min-w-0 pr-1`} 
                    title={product.name}
                    onClick={() => setIsNameExpanded(!isNameExpanded)}
                >
                    {product.name}
                    {product.shortName && (
                        <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100/90 text-amber-900 text-[10px] font-bold rounded border border-amber-300 inline-block">
                            {product.shortName}
                        </span>
                    )}
                </div>

                {!product.isCombo && (
                    <div className="flex gap-1 shrink-0">
                        {onEditStock && (
                            <button 
                                onClick={() => onEditStock(product)} 
                                className="p-1.5 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-lg hover:bg-blue-600 hover:text-white transition shadow-2xs flex items-center justify-center h-6 w-6"
                                title="Chỉnh sửa số lượng từng kho"
                            >
                                <Boxes size={11}/>
                            </button>
                        )}
                        {onQuickImport && (
                            <button 
                                onClick={() => onQuickImport(product)} 
                                className="p-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-lg hover:bg-emerald-600 hover:text-white transition shadow-2xs flex items-center justify-center h-6 w-6"
                                title="Nhập hàng nhanh"
                            >
                                <DownloadCloud size={11}/>
                            </button>
                        )}
                        {onTransfer && (
                            <button 
                                onClick={() => onTransfer(product)} 
                                className="p-1.5 bg-amber-50 text-amber-700 border border-amber-200/80 rounded-lg hover:bg-amber-600 hover:text-white transition shadow-2xs flex items-center justify-center h-6 w-6"
                                title="Chuyển kho"
                            >
                                <ArrowRightLeft size={11}/>
                            </button>
                        )}
                        {isAdmin && onCompare && (
                            <button 
                                onClick={() => onCompare(product)} 
                                className="p-1.5 bg-purple-50 text-purple-700 border border-purple-200/80 rounded-lg hover:bg-purple-600 hover:text-white transition shadow-2xs flex items-center justify-center h-6 w-6"
                                title="So sánh giá nhập"
                            >
                                <TrendingDown size={11}/>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Hàng 1: Huy hiệu tình trạng tồn kho */}
            <div className="my-1">
                <StockStatusBadge stock={totalStock} className="text-[10px]" />
            </div>

            {/* Hàng 2: Chi tiết số lượng từng kho */}
            <div className="mb-2">
                <div className="flex items-center justify-between mb-1 px-0.5">
                    <span className="text-[8px] font-black uppercase text-slate-400">Tồn kho:</span>
                    {onEditStock && !product.isCombo && (
                        <button 
                            type="button"
                            onClick={() => onEditStock(product)}
                            className="text-[8px] font-black text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                            title="Nhấp để sửa số lượng các kho"
                        >
                            <Edit size={8} /> Sửa SL kho
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-1 text-[9px] font-bold bg-slate-50/80 p-1 rounded-lg border border-slate-100 text-center">
                    {top3Warehouses.map(w => {
                        const wStock = productInventory[w.id] || 0;
                        const colorClass = wStock > 5 ? 'text-emerald-600 font-bold' : wStock > 0 ? 'text-amber-600 font-bold' : 'text-slate-400 font-medium';
                        return (
                            <div 
                                key={w.id} 
                                onClick={() => !product.isCombo && onEditStock?.(product, w.id)}
                                className={`min-w-0 p-0.5 rounded transition ${!product.isCombo ? 'hover:bg-blue-50 hover:border-blue-300 border border-transparent cursor-pointer group/wh' : ''}`}
                                title={!product.isCombo ? `Nhấp để sửa tồn kho ${w.name} (${wStock})` : `${w.name}: ${wStock}`}
                            >
                                <div className="text-[8px] text-slate-400 uppercase truncate">{w.name}</div>
                                <div className={`${colorClass} flex items-center justify-center gap-0.5`}>
                                    <span>{wStock}</span>
                                    {!product.isCombo && (
                                        <Edit size={7} className="opacity-0 group-hover/wh:opacity-100 text-blue-600 transition-opacity shrink-0" />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="space-y-1 mb-2.5">
                {isAdmin && (
                    <div className="flex items-center gap-1">
                        <div className="relative flex-1">
                            <NumericInput 
                                value={inputImportPrice}
                                onChange={setInputImportPrice}
                                className="w-full pl-6 pr-1 py-1 text-[10px] border border-slate-200 bg-slate-50 text-slate-700 rounded-lg font-bold text-right outline-none focus:border-emerald-500 focus:bg-white shadow-2xs transition-colors"
                            />
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] text-slate-400 font-bold">VỐN</span>
                        </div>
                        <button onClick={() => onUpdateImportPrice?.(product.id, inputImportPrice)} className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition" title="Lưu giá vốn"><Save size={11}/></button>
                    </div>
                )}
                <div className="flex items-center gap-1">
                    <div className="relative flex-1">
                        <NumericInput 
                            value={inputPrice}
                            onChange={setInputPrice}
                            className={`w-full pl-6 pr-1 py-1.5 text-base border rounded-lg font-bold text-right focus:ring-2 focus:ring-primary/20 outline-none shadow-2xs transition-colors ${lastSoldPrice !== undefined ? 'bg-amber-50/80 border-amber-400 text-amber-950 focus:border-amber-500' : 'bg-slate-900 border-slate-800 text-white focus:border-primary'}`}
                        />
                        <span className={`absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold ${lastSoldPrice !== undefined ? 'text-amber-700' : 'text-slate-400'}`}>BÁN</span>
                    </div>
                    {isAdmin && (<button onClick={() => onUpdatePrice?.(product.id, inputPrice)} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition shadow-2xs" title="Lưu giá bán"><Save size={14}/></button>)}
                </div>
            </div>
            <div className="flex space-x-1.5">
                <input 
                    type="number" 
                    value={inputQty} 
                    onChange={(e) => setInputQty(parseInt(e.target.value) || 0)} 
                    onFocus={(e) => e.target.select()} 
                    className={`w-12 px-1 py-2 text-xs border bg-slate-50 text-slate-900 rounded-lg text-center font-bold outline-none focus:border-primary focus:bg-white shadow-2xs transition-colors ${shippingMode === 'shipped' && inputQty > (detailedInventory[product.id]?.[warehouses.find(w => w.name === 'Ngoài CH')?.id || ''] || 0) ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-200'}`} 
                />
                <button 
                    onClick={() => onAdd(product, inputQty, inputPrice, inputImportPrice, false)} 
                    className="flex-1 py-2 bg-primary hover:bg-primary/90 text-white text-[10px] font-bold rounded-lg shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-1 active:scale-98"
                >
                    <Plus size={13}/> THÊM
                </button>
                <button 
                    onClick={() => onAdd(product, inputQty, inputPrice, inputImportPrice, true)} 
                    className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold rounded-lg shadow-xs hover:shadow-sm transition-all flex items-center justify-center active:scale-98" 
                    title="Thêm tiếp mặt hàng này (không xóa ô tìm kiếm)"
                >
                    <Plus size={13}/>
                </button>
            </div>
        </div>
    );
};

const POSView: React.FC<{ userRole: 'admin' | 'staff' | null, user: FirebaseAuthUser | null }> = ({ userRole, user }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [detailedInventory, setDetailedInventory] = useState<Record<string, Record<string, number>>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [todaySalesSearchTerm, setTodaySalesSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pageSize = isFullscreen ? 32 : 12;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('Khách vãng lai');
  const [isCustomerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedShipperId, setSelectedShipperId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

  useEffect(() => {
    if (warehouses.length > 0 && !selectedWarehouseId) {
      const ngoaiCH = warehouses.find(w => w.name.toLowerCase().includes('ngoài ch') || w.name.toLowerCase().includes('ngoài cửa hàng'));
      if (ngoaiCH) {
        setSelectedWarehouseId(ngoaiCH.id);
      }
    }
  }, [warehouses, selectedWarehouseId]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
  const [shippingMode, setShippingMode] = useState<'shipped' | 'pending' | 'order'>('shipped');
  const [shippingPayer, setShippingPayer] = useState<'shop' | 'customer'>('customer');
  const [shippingFee, setShippingFee] = useState(0); 
  const [saleDate, setSaleDate] = useState(getTodayString()); 
  const [isDebt, setIsDebt] = useState(false);
  const [amountPaidInput, setAmountPaidInput] = useState<string>(''); // empty means full amount
  const [issueInvoice, setIssueInvoice] = useState(false); 
  const [wholesalePrices, setWholesalePrices] = useState<Record<string, number>>({});
  const [indexErrorUrl, setIndexErrorUrl] = useState<string | null>(null); 

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isShipperModalOpen, setIsShipperModalOpen] = useState(false);
  
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSaleEdit, setSelectedSaleEdit] = useState<Sale | null>(null);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [selectedLedgerProductId, setSelectedLedgerProductId] = useState<string | null>(null);

  // New states for Quick Actions
  const [isQuickImportOpen, setIsQuickImportOpen] = useState(false);
  const [selectedQuickImportProduct, setSelectedQuickImportProduct] = useState<Product | null>(null);
  const [isQuickTransferOpen, setIsQuickTransferOpen] = useState(false);
  const [selectedQuickTransferProduct, setSelectedQuickTransferProduct] = useState<Product | null>(null);
  const [isPriceComparisonOpen, setIsPriceComparisonOpen] = useState(false);
  const [selectedPriceComparisonProduct, setSelectedPriceComparisonProduct] = useState<Product | null>(null);
  const [isEditStockOpen, setIsEditStockOpen] = useState(false);
  const [selectedEditStockProduct, setSelectedEditStockProduct] = useState<Product | null>(null);
  const [selectedEditStockWarehouseId, setSelectedEditStockWarehouseId] = useState<string | undefined>(undefined);

  const handleOpenEditStock = (product: Product, targetWarehouseId?: string) => {
    setSelectedEditStockProduct(product);
    setSelectedEditStockWarehouseId(targetWarehouseId);
    setIsEditStockOpen(true);
  };

  const handleSaveWarehouseStock = async (productId: string, stockUpdates: Record<string, number>) => {
    try {
      setIsProcessing(true);
      const batch = writeBatch(db);
      for (const [whId, qty] of Object.entries(stockUpdates)) {
        const wh = warehouses.find(w => w.id === whId);
        const invRef = doc(db, 'products', productId, 'inventory', whId);
        batch.set(invRef, {
          stock: qty,
          warehouseId: whId,
          warehouseName: wh?.name || 'Kho'
        }, { merge: true });
      }
      await batch.commit();
      setToast({ message: "Cập nhật tồn kho từng kho thành công!", type: 'success' });
      setIsEditStockOpen(false);
    } catch (e: any) {
      console.error(e);
      alert("Lỗi khi cập nhật tồn kho: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    onSnapshot(query(collection(db, "products")), (snap) => setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product))));
    onSnapshot(query(collection(db, "customers"), orderBy("name")), (snap) => setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer))));
    onSnapshot(query(collection(db, "warehouses"), orderBy("name")), (snap) => setWarehouses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse))));
    onSnapshot(query(collection(db, "paymentMethods"), orderBy("name")), (snap) => setPaymentMethods(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod))));
    onSnapshot(query(collection(db, "shippers"), orderBy("name")), (snap) => setShippers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shipper))));
    onSnapshot(query(collection(db, "suppliers"), orderBy("name")), (snap) => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier))));
    onSnapshot(query(collection(db, "manufacturers"), orderBy("name")), (snap) => setManufacturers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Manufacturer))));
    onSnapshot(query(collectionGroup(db, 'inventory')), (snapshot) => { const data: Record<string, Record<string, number>> = {}; snapshot.forEach(doc => { const d = doc.data(); const pid = doc.ref.parent.parent?.id; const warehouseId = d.warehouseId || doc.id; if (pid && warehouseId) { if (!data[pid]) data[pid] = {}; data[pid][warehouseId] = d.stock || 0; } }); setDetailedInventory(data); });
    const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
    onSnapshot(query(collection(db, "sales"), where("createdAt", ">=", Timestamp.fromDate(startOfToday))), (snapshot) => { const list: Sale[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)); list.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)); setTodaySales(list); });
    setLoading(false);
  }, []);

  // CẬP NHẬT Logic: Lấy giá bán gần nhất cho khách hàng sỉ và Lấy ĐVVC đã gởi lần trước
  useEffect(() => {
    if (!selectedCustomerId) {
      setWholesalePrices({});
      setSelectedShipperId('');
      setIndexErrorUrl(null);
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomerId);

    // Truy vấn 50 đơn hàng gần nhất của khách này
    const q = query(
      collection(db, "sales"),
      where("customerId", "==", selectedCustomerId),
      orderBy("createdAt", "desc"),
      limit(50) 
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIndexErrorUrl(null);
      if (!snapshot.empty) {
        // Tự động load ĐVVC lần trước
        const lastShippedSale = snapshot.docs.find(doc => doc.data().shipperId);
        if (lastShippedSale) {
            setSelectedShipperId(lastShippedSale.data().shipperId);
        } else {
            setSelectedShipperId('');
        }

        // Tự động load PTTT lần trước
        const lastPaidSale = snapshot.docs.find(doc => doc.data().paymentMethodId);
        if (lastPaidSale) {
            setSelectedPaymentMethodId(lastPaidSale.data().paymentMethodId);
        } else {
            setSelectedPaymentMethodId('');
        }

        // Cập nhật giá bán sỉ gần nhất
        if (customer?.type === 'wholesale') {
            const prices: Record<string, number> = {};
            // Duyệt ngược từ cũ nhất đến mới nhất trong snapshot để giá đơn mới nhất ghi đè lên giá cũ
            for (let i = snapshot.docs.length - 1; i >= 0; i--) {
                const saleData = snapshot.docs[i].data() as Sale;
                saleData.items.forEach(item => {
                    prices[item.productId] = item.price;
                });
            }
            setWholesalePrices(prices);
        } else {
            setWholesalePrices({});
        }
      } else {
        setWholesalePrices({});
        setSelectedShipperId(''); // Không có lịch sử thì clear ĐVVC
      }
    }, (err: any) => {
        console.error("Lỗi lấy giá sỉ gần nhất:", err);
        if (err.code === 'failed-precondition' && err.message.includes('index')) {
            const urlRegex = /(https?:\/\/[^\s]+)/;
            const match = err.message.match(urlRegex);
            if (match && match[0]) {
                setIndexErrorUrl(match[0]);
            }
        }
    });

    return () => unsubscribe();
  }, [selectedCustomerId, customers]);

  const calculateEffectiveStock = (product: Product, warehouseId: string) => {
      if (!warehouseId) return 0;
      if (!product.isCombo) return detailedInventory[product.id]?.[warehouseId] || 0;
      if (!product.comboItems || product.comboItems.length === 0) return 0;
      const stocks = product.comboItems.map(item => {
          const itemStock = detailedInventory[item.productId]?.[warehouseId] || 0;
          return Math.floor(itemStock / item.quantity);
      });
      return Math.min(...stocks);
  };

  const addToCart = (product: Product, quantity: number, price: number, importPrice: number, keepSearch: boolean = false) => {
    if (!selectedWarehouseId) { setToast({ message: "Vui lòng chọn kho trước để kiểm soát tồn kho!", type: 'error' }); return; }
    const stockInWh = calculateEffectiveStock(product, selectedWarehouseId);
    const existing = cart.find(i => i.productId === product.id);
    if (shippingMode === 'shipped' && (existing?.quantity || 0) + quantity > stockInWh) { setToast({ message: `HẾT HÀNG! (Tồn: ${stockInWh})`, type: 'error' }); return; }
    if (quantity <= 0) return;
    setCart(prev => existing ? prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + quantity, price, currentImportPrice: importPrice } : i) : [...prev, { productId: product.id, productName: product.name, quantity, price, importPrice: product.importPrice, stock: stockInWh, invoicedStock: product.totalInvoicedStock || 0, originalImportPrice: product.importPrice, originalSellingPrice: product.sellingPrice, currentImportPrice: importPrice, updateImportPrice: false, updateSellingPrice: false, isCombo: product.isCombo, comboItems: product.comboItems }]);
    if (!keepSearch) {
        setSearchTerm('');
    }
    setToast({ message: "Đã thêm thành công!", type: 'success' });
  };

  const moveItemUp = (index: number) => {
    if (index <= 0) return;
    setCart(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  const moveItemDown = (index: number) => {
    if (index >= cart.length - 1) return;
    setCart(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  const handleCheckout = async () => {
      const actualAmountPaidInput = isDebt ? 0 : (amountPaidInput === '' ? (cart.reduce((a, b) => a + b.price * b.quantity, 0) + shippingFee) : parseInt(amountPaidInput.replace(/[^\d]/g, '') || '0'));
      console.log("handleCheckout called", { cartLength: cart.length, selectedWarehouseId, isDebt, selectedPaymentMethodId, actualAmountPaidInput });
      if (cart.length === 0 || !selectedWarehouseId || !selectedShipperId || (actualAmountPaidInput > 0 && !selectedPaymentMethodId) || (!selectedCustomerId && !customerSearchTerm.trim())) { 
          setToast({ message: "Vui lòng chọn đầy đủ Khách hàng, Kho xuất, Đơn vị vận chuyển và Phương thức thanh toán.", type: 'error' }); 
          return; 
      }
      setIsProcessing(true);
      try {
          const batch = writeBatch(db);
          const itemTotal = cart.reduce((a, b) => a + b.price * b.quantity, 0);
          const total = itemTotal + shippingFee;
          const actualAmountPaid = isDebt ? 0 : (amountPaidInput === '' ? total : parseInt(amountPaidInput.replace(/[^\d]/g, '') || '0'));
          const customerName = selectedCustomerId ? customers.find(c => c.id === selectedCustomerId)?.name : (customerSearchTerm || 'Khách vãng lai');
          const paymentMethod = paymentMethods.find(p => p.id === selectedPaymentMethodId);
          const selectedWarehouseName = warehouses.find(w => w.id === selectedWarehouseId)?.name || 'N/A';
          
          let finalCreatedAt: Timestamp;
          if (saleDate) {
              const [y, m, d] = saleDate.split('-').map(Number);
              const now = new Date();
              const selectedDateObj = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
              finalCreatedAt = Timestamp.fromDate(selectedDateObj);
          } else {
              finalCreatedAt = Timestamp.now();
          }

          const saleRef = doc(collection(db, 'sales'));
          const initialPaymentHistory = actualAmountPaid === 0 ? [] : [{ date: finalCreatedAt, amount: actualAmountPaid, note: `Thanh toán qua ${paymentMethod?.name || 'Tiền mặt'}` }];

          batch.set(saleRef, { 
            items: cart.map(i => ({ 
                productId: i.productId || '', 
                productName: i.productName || '', 
                quantity: i.quantity || 0, 
                price: i.price || 0, 
                importPrice: i.currentImportPrice || 0, 
                isCombo: i.isCombo || false 
            })), 
            productIds: cart.map(i => i.productId),
            total, 
            shippingFee,
            amountPaid: actualAmountPaid, 
            paymentHistory: initialPaymentHistory,
            customerId: selectedCustomerId || null, 
            customerName: customerName || 'Khách vãng lai', 
            warehouseId: selectedWarehouseId, 
            warehouseName: selectedWarehouseName, 
            paymentMethodId: actualAmountPaid > 0 ? (selectedPaymentMethodId || null) : null, 
            paymentMethodName: actualAmountPaid > 0 ? (paymentMethod?.name || null) : null, 
            status: (actualAmountPaid < total) ? 'debt' : 'paid', 
            shippingStatus: shippingMode || 'shipped', 
            shippingPayer: shippingPayer || 'customer', 
            shipperId: selectedShipperId || null, 
            shipperName: shippers.find(s => s.id === selectedShipperId)?.name || null, 
            issueInvoice: issueInvoice || false, 
            createdAt: finalCreatedAt, 
            creatorName: user?.displayName || user?.email || 'POS' 
          });

          if (actualAmountPaid > 0 && selectedPaymentMethodId) {
              const accountRef = doc(db, 'paymentMethods', selectedPaymentMethodId);
              batch.update(accountRef, { balance: increment(actualAmountPaid) });
              
              const currentBal = paymentMethod?.balance || 0;
              batch.set(doc(collection(db, 'paymentLogs')), { 
                paymentMethodId: selectedPaymentMethodId, 
                paymentMethodName: paymentMethod?.name || 'N/A', 
                type: 'deposit', 
                amount: actualAmountPaid, 
                balanceAfter: currentBal + actualAmountPaid, 
                note: `Đơn hàng ${customerName}`, 
                relatedId: saleRef.id, 
                relatedType: 'sale', 
                createdAt: finalCreatedAt, 
                creatorName: user?.displayName || user?.email || 'POS' 
              });
          }

          cart.forEach(i => {
              if (i.isCombo && i.comboItems) {
                  i.comboItems.forEach(cItem => {
                      const totalDeduct = cItem.quantity * i.quantity;
                      const invRef = doc(db, 'products', cItem.productId, 'inventory', selectedWarehouseId);
                      batch.set(invRef, { 
                          stock: increment(-totalDeduct),
                          warehouseId: selectedWarehouseId,
                          warehouseName: selectedWarehouseName
                      }, { merge: true });
                  });
              } else {
                  const invRef = doc(db, 'products', i.productId, 'inventory', selectedWarehouseId);
                  batch.set(invRef, { 
                      stock: increment(-i.quantity),
                      warehouseId: selectedWarehouseId,
                      warehouseName: selectedWarehouseName
                  }, { merge: true });
              }
          });

          if (issueInvoice) {
              cart.forEach(i => {
                  if (i.isCombo && i.comboItems) {
                      i.comboItems.forEach(cItem => {
                          const totalDeduct = cItem.quantity * i.quantity;
                          batch.update(doc(db, 'products', cItem.productId), { totalInvoicedStock: increment(-totalDeduct) });
                      });
                  } else {
                      batch.update(doc(db, 'products', i.productId), { totalInvoicedStock: increment(-i.quantity) });
                  }
              });
          }

          for (const i of cart) {
              if (i.updateSellingPrice || i.updateImportPrice) {
                  const pRef = doc(db, 'products', i.productId);
                  const updates: any = {};
                  if (i.updateSellingPrice) updates.sellingPrice = i.price;
                  if (i.updateImportPrice) updates.importPrice = i.currentImportPrice;
                  batch.update(pRef, updates);
              }
          }

          await batch.commit();

          setCart([]); setIsDebt(false); setAmountPaidInput(''); setIssueInvoice(false); setSelectedCustomerId(''); setCustomerSearchTerm('Khách vãng lai'); setSelectedPaymentMethodId(''); setSelectedShipperId(''); setShippingFee(0); setSaleDate(getTodayString()); setShippingMode('shipped'); setToast({ message: "Thanh toán thành công! Đã cập nhật vào danh sách hôm nay.", type: 'success' });
      } catch (e: any) { console.error(e); alert("Lỗi khi thanh toán: " + e.message); } finally { setIsProcessing(false); }
  };

  const updateCartItem = (productId: string, updates: Partial<CartItem>) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newItem = { ...item, ...updates };
        if (updates.quantity !== undefined && shippingMode === 'shipped') {
            const product = products.find(p => p.id === productId);
            if (product) {
              const stockInWh = calculateEffectiveStock(product, selectedWarehouseId);
              if (newItem.quantity > stockInWh) { setToast({ message: "Vượt quá tồn kho thực tế!", type: 'error' }); return item; }
            }
        }
        return newItem;
      }
      return item;
    }));
  };

  const handleSaveCustomer = async (data: any) => {
    try {
        const docRef = await addDoc(collection(db, 'customers'), { ...data, createdAt: serverTimestamp() });
        setSelectedCustomerId(docRef.id);
        setCustomerSearchTerm(data.name);
        setIsCustomerModalOpen(false);
        setToast({ message: "Đã thêm khách hàng!", type: 'success' });
    } catch (e) { console.error(e); setToast({ message: "Lỗi thêm khách hàng", type: 'error' }); }
  };

  const handleSaveShipper = async (data: any) => {
    try {
        const docRef = await addDoc(collection(db, 'shippers'), { ...data, createdAt: serverTimestamp() });
        setSelectedShipperId(docRef.id);
        setIsShipperModalOpen(false);
        setToast({ message: "Đã thêm ĐVVC!", type: 'success' });
    } catch (e) { console.error(e); setToast({ message: "Lỗi thêm ĐVVC", type: 'error' }); }
  };

  const handleQuickImportConfirm = async (data: { supplierId: string, warehouseId: string, quantity: number, importPrice: number, paymentStatus: 'paid' | 'debt', paymentMethodId: string, updateBasePrice: boolean }) => {
      if (!selectedQuickImportProduct) return;
      setIsProcessing(true);
      try {
          const batch = writeBatch(db);
          const supplier = suppliers.find(s => s.id === data.supplierId);
          const warehouse = warehouses.find(w => w.id === data.warehouseId);
          const method = paymentMethods.find(m => m.id === data.paymentMethodId);
          const total = data.quantity * data.importPrice;

          const receiptRef = doc(collection(db, 'goodsReceipts'));
          batch.set(receiptRef, {
              items: [{
                  productId: selectedQuickImportProduct.id,
                  productName: selectedQuickImportProduct.name,
                  quantity: data.quantity,
                  importPrice: data.importPrice,
                  isCombo: !!selectedQuickImportProduct.isCombo
              }],
              productIds: [selectedQuickImportProduct.id],
              total,
              supplierId: data.supplierId,
              supplierName: supplier?.name || 'N/A',
              warehouseId: data.warehouseId,
              warehouseName: warehouse?.name || 'N/A',
              paymentStatus: data.paymentStatus,
              paymentMethodId: data.paymentStatus === 'paid' ? data.paymentMethodId : null,
              paymentMethodName: data.paymentStatus === 'paid' ? (method?.name || null) : null,
              amountPaid: data.paymentStatus === 'paid' ? total : 0,
              paidAt: data.paymentStatus === 'paid' ? serverTimestamp() : null,
              hasInvoice: false,
              createdAt: serverTimestamp(),
              creatorName: user?.displayName || user?.email || 'POS'
          });

          const invRef = doc(db, 'products', selectedQuickImportProduct.id, 'inventory', data.warehouseId);
          batch.set(invRef, {
              stock: increment(data.quantity),
              warehouseId: data.warehouseId,
              warehouseName: warehouse?.name || 'N/A'
          }, { merge: true });

          if (data.paymentStatus === 'paid' && data.paymentMethodId) {
              const accRef = doc(db, 'paymentMethods', data.paymentMethodId);
              batch.update(accRef, { balance: increment(-total) });
              
              const currentBal = method?.balance || 0;
              const logRef = doc(collection(db, 'paymentLogs'));
              batch.set(logRef, {
                  paymentMethodId: data.paymentMethodId,
                  paymentMethodName: method?.name || 'N/A',
                  type: 'withdraw',
                  amount: total,
                  balanceAfter: currentBal - total,
                  note: `Nhập hàng nhanh (POS): ${selectedQuickImportProduct.name}`,
                  relatedId: receiptRef.id,
                  relatedType: 'receipt',
                  createdAt: serverTimestamp(),
                  creatorName: user?.displayName || user?.email || 'POS'
              });
          }

          if (data.updateBasePrice) {
              batch.update(doc(db, 'products', selectedQuickImportProduct.id), {
                  importPrice: data.importPrice
              });
          }

          await batch.commit();

          setToast({ message: "Đã nhập hàng nhanh thành công!", type: 'success' });
          setIsQuickImportOpen(false);
          setSelectedQuickImportProduct(null);
      } catch (e) { console.error(e); alert("Lỗi nhập hàng."); } finally { setIsProcessing(false); }
  };

  const handleQuickTransfer = async (details: { productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number; }) => {
    try {
      const toWarehouse = warehouses.find(w => w.id === details.toWarehouseId);
      const fromWarehouse = warehouses.find(w => w.id === details.fromWarehouseId);
      const product = products.find(p => p.id === details.productId);

      if (!toWarehouse || !fromWarehouse || !product) throw new Error("Thông tin không hợp lệ");

      await runTransaction(db, async (transaction) => {
          const fromInventoryRef = doc(db, 'products', details.productId, 'inventory', details.fromWarehouseId);
          const toInventoryRef = doc(db, 'products', details.productId, 'inventory', details.toWarehouseId);

          const fromSnap = await transaction.get(fromInventoryRef);
          const toSnap = await transaction.get(toInventoryRef);

          const stockBeforeFrom = fromSnap.exists() ? fromSnap.data().stock || 0 : 0;
          const stockBeforeTo = toSnap.exists() ? toSnap.data().stock || 0 : 0;

          if (stockBeforeFrom < details.quantity) throw new Error("Kho nguồn không đủ số lượng để chuyển");

          const stockAfterFrom = stockBeforeFrom - details.quantity;
          const stockAfterTo = stockBeforeTo + details.quantity;

          transaction.update(fromInventoryRef, { stock: stockAfterFrom });
          transaction.set(toInventoryRef, {
              stock: stockAfterTo,
              warehouseId: toWarehouse.id,
              warehouseName: toWarehouse.name
          }, { merge: true });

          const transferRef = doc(collection(db, 'warehouseTransfers'));
          transaction.set(transferRef, {
              productId: product.id, productName: product.name,
              fromWarehouseId: fromWarehouse.id, fromWarehouseName: fromWarehouse.name,
              toWarehouseId: toWarehouse.id, toWarehouseName: toWarehouse.name,
              quantity: details.quantity,
              stockBeforeFrom,
              stockAfterFrom,
              stockBeforeTo,
              stockAfterTo,
              createdAt: serverTimestamp(),
              creatorName: user?.displayName || user?.email || 'N/A'
          });
      });

      setToast({ message: "Chuyển kho thành công!", type: 'success' });
      setIsQuickTransferOpen(false);
    } catch (e: any) { 
      console.error(e);
      alert(`Lỗi chuyển kho: ${e.message}`); 
    }
  };

  const filteredProducts = useMemo(() => {
      return products.filter(p => {
          if (!searchTerm) {
              // Khi chưa tìm kiếm: chỉ hiện sản phẩm có tồn kho (nếu là giao ngay)
              return shippingMode === 'shipped' ? calculateEffectiveStock(p, selectedWarehouseId) > 0 : true;
          }
          // Khi có tìm kiếm: lọc theo tên hoặc tên viết tắt, bất kể số lượng tồn
          const lower = searchTerm.toLowerCase();
          return (p.name || '').toLowerCase().includes(lower) || (p.shortName || '').toLowerCase().includes(lower);
      });
  }, [products, searchTerm, detailedInventory, selectedWarehouseId, shippingMode]);
  const paginatedProducts = useMemo(() => filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredProducts, currentPage, pageSize]);
  const totals = useMemo(() => {
    const itemTotal = cart.reduce((a, b) => a + b.price * b.quantity, 0);
    return {
        itemTotal,
        revenue: itemTotal + shippingFee,
        profit: cart.reduce((a, b) => a + (b.price - b.currentImportPrice) * b.quantity, 0)
    };
  }, [cart, shippingFee]);

  const summaryToday = useMemo(() => {
    let revenue = 0; let profit = 0;
    todaySales.forEach(sale => {
        revenue += (sale.total || 0);
        const saleProfit = sale.items?.reduce((acc, it) => acc + (it.price - (it.importPrice || 0)) * it.quantity, 0) || 0;
        profit += saleProfit;
    });
    return { count: todaySales.length, revenue, profit };
  }, [todaySales]);

  return (
    <div className={`flex flex-col h-full gap-4 ${isFullscreen ? 'fixed top-0 left-0 right-0 bottom-12 bg-slate-100 z-40 p-4 overflow-y-auto' : ''}`}>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        
        <SaleDetailModal 
          isOpen={isDetailModalOpen} 
          onClose={() => setIsDetailModalOpen(false)} 
          sale={selectedSaleDetail} 
          userRole={userRole} 
        />
        <SaleEditModal 
          isOpen={isEditModalOpen} 
          onClose={() => setIsEditModalOpen(false)} 
          sale={selectedSaleEdit} 
          customers={customers} 
          paymentMethods={paymentMethods} 
          shippers={shippers} 
          products={products} 
        />
        {isLedgerModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[250] p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
                    <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                        <h2 className="text-xl font-black uppercase tracking-tighter flex items-center">
                            <History className="mr-2" size={24} />
                            Truy vết biến động kho
                        </h2>
                        <button onClick={() => setIsLedgerModalOpen(false)} className="hover:bg-slate-700 p-2 rounded-full transition">
                            <X size={24} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                        <InventoryLedger initialProductId={selectedLedgerProductId || 'all'} />
                    </div>
                    <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
                        <button 
                            onClick={() => setIsLedgerModalOpen(false)}
                            className="px-6 py-2 bg-slate-800 text-white rounded-xl font-black text-xs uppercase hover:bg-slate-700 transition shadow-lg"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        )}
        {isProductModalOpen && <ProductModal product={null} manufacturers={manufacturers} allProductsForCombo={products} onClose={() => setIsProductModalOpen(false)} onSave={async (d) => { await addDoc(collection(db, 'products'), { ...d, createdAt: serverTimestamp() }); setIsProductModalOpen(false); }} existingNames={products.map(p => p.name)} />}
        {isCustomerModalOpen && <CustomerModal customer={null} onClose={() => setIsCustomerModalOpen(false)} onSave={handleSaveCustomer} existingCustomers={customers} />}
        {isShipperModalOpen && <ShipperModal shipper={null} onClose={() => setIsShipperModalOpen(false)} onSave={handleSaveShipper} existingNames={shippers.map(s => s.name)} />}

        <QuickImportModal 
            isOpen={isQuickImportOpen} 
            onClose={() => setIsQuickImportOpen(false)} 
            product={selectedQuickImportProduct} 
            warehouses={warehouses} 
            suppliers={suppliers} 
            paymentMethods={paymentMethods}
            onConfirm={handleQuickImportConfirm} 
            isProcessing={isProcessing} 
        />
      
        <InventoryTransferModal 
            key={selectedQuickTransferProduct ? selectedQuickTransferProduct.id : 'closed'}
            isOpen={isQuickTransferOpen} 
            onClose={() => setIsQuickTransferOpen(false)} 
            products={products} 
            warehouses={warehouses} 
            inventoryData={detailedInventory}
            initialData={selectedQuickTransferProduct ? { 
                productId: selectedQuickTransferProduct.id, 
                fromWarehouseId: warehouses.find(w => (w.name.toLowerCase().includes('trong ch') || w.name.toLowerCase().includes('trong kho') || w.name.toLowerCase().includes('trong')) && w.id !== selectedWarehouseId)?.id || '',
                toWarehouseId: selectedWarehouseId 
            } : null}
            onTransfer={handleQuickTransfer}
        />

        <PriceComparisonModal 
            isOpen={isPriceComparisonOpen} 
            onClose={() => setIsPriceComparisonOpen(false)} 
            product={selectedPriceComparisonProduct} 
        />

        <EditWarehouseStockModal
            isOpen={isEditStockOpen}
            onClose={() => setIsEditStockOpen(false)}
            product={selectedEditStockProduct}
            warehouses={warehouses}
            detailedInventory={detailedInventory}
            initialWarehouseId={selectedEditStockWarehouseId}
            onSave={handleSaveWarehouseStock}
            isProcessing={isProcessing}
        />

        <div className={`flex flex-col lg:flex-row gap-4 flex-1`}>
            <div className={`flex flex-col ${isFullscreen ? 'lg:w-[65%]' : 'lg:w-3/5'}`}>
                <div className="bg-white p-4 rounded-2xl shadow-md flex-1 flex flex-col border-2 border-slate-200">
                    <div className="flex-1 space-y-4">
                        {indexErrorUrl && (
                            <div className="bg-red-50 border-2 border-red-600 p-4 rounded-xl flex items-start shadow-lg animate-bounce">
                                <AlertTriangle className="text-red-600 mr-3 flex-shrink-0" size={24}/>
                                <div className="flex-1">
                                    <p className="text-xs font-black text-red-700 uppercase mb-1">CẦN CẤU HÌNH CƠ SỞ DỮ LIỆU</p>
                                    <p className="text-xs font-bold text-red-600 mb-2">Để xem được giá sỉ cũ của khách hàng, bạn cần kích hoạt bộ chỉ mục (Index) trên Firebase.</p>
                                    <a 
                                        href={indexErrorUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-4 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-red-700 transition"
                                    >
                                        Bấm vào đây để kích hoạt ngay <ExternalLink className="ml-1.5" size={12}/>
                                    </a>
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-50 p-3 rounded-xl border space-y-3 shrink-0">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                                <div className="flex items-center gap-3 w-full md:w-2/3 lg:w-1/2">
                                    <h3 className="text-sm font-black uppercase flex items-center text-blue-600 whitespace-nowrap"><Info size={16} className="mr-1 hidden sm:block"/> Nghiệp vụ</h3>
                                    <div className="relative flex gap-1 flex-1 min-w-[200px]" ref={customerDropdownRef}><div className="relative flex-1"><User className="absolute left-2 top-1/2 -translate-y-1/2 text-black" size={16}/><input type="text" placeholder="Tìm khách..." value={customerSearchTerm} onChange={e => { setCustomerSearchTerm(e.target.value); setCustomerDropdownOpen(true); }} onFocus={() => { if (customerSearchTerm === 'Khách vãng lai') { setCustomerSearchTerm(''); setSelectedCustomerId(''); } setCustomerDropdownOpen(true); }} className="w-full pl-8 pr-1 py-2 border rounded-lg text-sm font-black outline-none border-blue-300 ring-2 ring-blue-50 focus:ring-blue-200 shadow-sm" />{isCustomerDropdownOpen && customerSearchTerm && (<div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto"><button onClick={() => { setSelectedCustomerId(''); setCustomerSearchTerm('Khách vãng lai'); setCustomerDropdownOpen(false); }} className="w-full text-left px-2 py-1.5 hover:bg-blue-50 text-[10px] border-b font-black text-blue-700">KHÁCH VÃNG LAI</button>{customers.filter(c => {
    const term = (customerSearchTerm || '').toLowerCase();
    return (c.name || '').toLowerCase().includes(term) || (c.phone || '').includes(term);
}).slice(0,5).map(c => (<button key={c.id} onClick={() => { setSelectedCustomerId(c.id); setCustomerSearchTerm(c.name); setCustomerDropdownOpen(false); }} className="w-full text-left px-2 py-1.5 hover:bg-blue-50 text-[10px] border-b flex justify-between font-black text-black"><span>{c.name}</span><span>{c.phone}</span></button>))}</div>)}</div><button onClick={() => setIsCustomerModalOpen(true)} className="p-2 bg-green-100 text-green-600 rounded-lg border border-green-300 hover:bg-green-600 hover:text-white transition shadow-sm"><Plus size={18}/></button></div>
                                </div>
                                <div className="flex gap-4 md:shrink-0 w-full md:w-auto justify-end">
                                    <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={shippingPayer === 'customer'} onChange={e => setShippingPayer(e.target.checked ? 'customer' : 'shop')} className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-0" /><span className="text-xs font-black uppercase text-blue-600">Khách ship</span></label>
                                    <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={issueInvoice} onChange={e => setIssueInvoice(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-0" /><span className="text-xs font-black uppercase text-blue-600">Hóa đơn</span></label>
                                    <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={isDebt} onChange={e => setIsDebt(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-0" /><span className="text-xs font-black uppercase text-red-600">Ghi nợ</span></label>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
                                <div className="relative"><Archive className="absolute left-2 top-1/2 -translate-y-1/2 text-black" size={16}/><select value={selectedWarehouseId} onChange={e => setSelectedWarehouseId(e.target.value)} className="w-full pl-8 pr-1 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary appearance-none"><option value="">Kho xuất...</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
                                <div className="relative flex gap-1"><div className="relative flex-1"><Truck className="absolute left-2 top-1/2 -translate-y-1/2 text-black" size={16}/><select value={selectedShipperId} onChange={e => setSelectedShipperId(e.target.value)} className="w-full pl-8 pr-1 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary appearance-none"><option value="">ĐVVC...</option>{shippers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><button onClick={() => setIsShipperModalOpen(true)} className="p-2 bg-blue-100 text-blue-600 rounded-lg border hover:bg-blue-600 transition"><Plus size={18}/></button></div>
                                <div className="relative"><CreditCard className="absolute left-2 top-1/2 -translate-y-1/2 text-black" size={16}/><select value={selectedPaymentMethodId} onChange={e => setSelectedPaymentMethodId(e.target.value)} className="w-full pl-8 pr-1 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary appearance-none" disabled={isDebt}><option value="">PTTT...</option>{paymentMethods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                                <div className="relative">
                                    <Banknote className="absolute left-2 top-1/2 -translate-y-1/2 text-black" size={16}/>
                                    <input 
                                        type="text" 
                                        placeholder={`Trọn gói`}
                                        value={amountPaidInput} 
                                        title={`Khách thanh toán. Mặc định là thanh toán toàn bộ: ${formatNumber(totals.revenue)}₫`}
                                        onChange={e => { setIsDebt(false); setAmountPaidInput(e.target.value ? formatNumber(parseInt(e.target.value.replace(/[^\d]/g, '') || '0')) : ''); }}
                                        className="w-full pl-8 pr-1 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary outline-none disabled:opacity-50 text-red-600 placeholder:text-slate-400" 
                                        disabled={isDebt}
                                    />
                                </div>
                                <div className="relative"><Layers className="absolute left-2 top-1/2 -translate-y-1/2 text-black" size={16}/><select value={shippingMode} onChange={e => setShippingMode(e.target.value as any)} className="w-full pl-8 pr-1 py-2 border rounded-lg text-sm font-black outline-none"><option value="shipped">Đã giao hàng</option><option value="pending">Chờ gởi</option><option value="order">Đặt hàng</option></select></div>
                                <div className="relative">
                                    <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-black" size={16}/>
                                    <input 
                                        type="date" 
                                        value={saleDate} 
                                        onChange={e => setSaleDate(e.target.value)}
                                        className="w-full pl-8 pr-1 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary outline-none" 
                                        style={{ colorScheme: 'light' }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18}/>
                                <input 
                                    ref={searchInputRef}
                                    type="text" 
                                    placeholder="GÕ TÊN SẢN PHẨM ĐỂ BÁN..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)} 
                                    className="w-full pl-11 pr-11 py-3 bg-amber-50/70 border border-amber-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white outline-none font-bold text-base text-slate-900 shadow-sm transition-all placeholder:text-slate-400" 
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm('');
                                            searchInputRef.current?.focus();
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-slate-200/80 hover:bg-slate-300 active:scale-90 text-slate-600 hover:text-slate-900 transition shadow-2xs cursor-pointer z-10"
                                        title="Xóa nội dung tìm kiếm (X)"
                                        aria-label="Xóa nội dung tìm kiếm"
                                    >
                                        <X size={15} className="stroke-[2.5]" />
                                    </button>
                                )}
                            </div>
                            {isAdmin && (
                                <button 
                                    onClick={() => setIsProductModalOpen(true)} 
                                    className="px-3.5 py-2.5 bg-emerald-600 text-white rounded-xl flex items-center hover:bg-emerald-700 transition shadow-sm font-bold text-xs uppercase"
                                    title="Tạo sản phẩm mới nhanh"
                                >
                                    <PlusCircle size={15} className="mr-1.5"/> TẠO SP
                                </button>
                            )}
                            {isFullscreen ? (
                                <button 
                                    type="button"
                                    onClick={() => setIsFullscreen(false)} 
                                    className="px-3.5 py-2.5 bg-amber-600 text-white rounded-xl flex items-center hover:bg-amber-700 transition shadow-sm font-bold text-xs uppercase"
                                    title="Thoát chế độ POS toàn màn hình (hoặc bấm phím Esc)"
                                >
                                    <Minimize2 size={15} className="mr-1.5"/> THOÁT POS
                                </button>
                            ) : (
                                <button 
                                    type="button"
                                    onClick={() => setIsFullscreen(true)} 
                                    className="px-3.5 py-2.5 bg-slate-800 text-white rounded-xl flex items-center hover:bg-slate-900 transition shadow-sm font-bold text-xs uppercase"
                                    title="Bật giao diện POS bán hàng mở rộng"
                                >
                                    <Maximize2 size={15} className="mr-1.5"/> POS
                                </button>
                            )}
                        </div>
                        <div className={`grid gap-2 content-start overflow-y-auto ${isFullscreen ? 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'}`}>
                            {loading ? (
                                <div className="col-span-full flex items-center justify-center h-40"><Loader className="animate-spin text-primary" size={32}/></div>
                            ) : (
                                paginatedProducts.map(p => (
                                    <ProductCardItem 
                                        key={p.id} 
                                        product={p} 
                                        detailedInventory={detailedInventory} 
                                        warehouses={warehouses} 
                                        shippingMode={shippingMode} 
                                        onAdd={addToCart} 
                                        onQuickImport={(prod) => { setSelectedQuickImportProduct(prod); setIsQuickImportOpen(true); }} 
                                        onTransfer={(prod) => { setSelectedQuickTransferProduct(prod); setIsQuickTransferOpen(true); }} 
                                        onEditStock={handleOpenEditStock}
                                        onUpdatePrice={async(id,pr)=>await updateDoc(doc(db,'products',id),{sellingPrice:pr})} 
                                        onUpdateImportPrice={async(id,pr)=>await updateDoc(doc(db,'products',id),{importPrice:pr})} 
                                        lastSoldPrice={wholesalePrices[p.id]} 
                                        isPOS={isFullscreen} 
                                        isAdmin={isAdmin} 
                                        onCompare={(p) => { setSelectedPriceComparisonProduct(p); setIsPriceComparisonOpen(true); }} 
                                    />
                                ))
                            )}
                        </div>
                        <div className="mt-3 flex justify-between items-center border-t border-slate-100 pt-3 shrink-0"><div className="text-[9px] font-black text-black uppercase">Trang {currentPage}</div><div className="flex space-x-1"><button onClick={() => setCurrentPage(p => Math.max(1, p-1))} className="p-1.5 bg-slate-100 rounded-lg text-black font-black"><ChevronLeft size={16}/></button><button onClick={() => setCurrentPage(p => p + 1)} className="p-1.5 bg-slate-100 rounded-lg text-black font-black"><ChevronRight size={16}/></button></div></div>
                    </div>
                </div>
            </div>
            <div className={`flex flex-col ${isFullscreen ? 'lg:w-[35%]' : 'lg:w-2/5'}`}>
                <div className="bg-white rounded-xl shadow-md flex flex-col border border-slate-200 overflow-hidden flex-shrink-0 transition-all duration-300">
                    <div className="bg-slate-900 px-4 py-3 text-white flex justify-between items-center flex-shrink-0 border-b border-slate-800">
                        <h2 className="text-sm font-bold flex items-center tracking-tight uppercase"><ShoppingCart className="mr-2" size={17}/> Giỏ hàng</h2>
                        <div className="flex gap-2">
                            {isAdmin && (
                                <span className="bg-blue-600/90 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-blue-500 shadow-2xs flex items-center">
                                    <ProfitIcon size={10} className="mr-1"/> LN: {formatNumber(totals.profit)} ₫
                                </span>
                            )}
                            <span className="bg-primary px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-blue-600">{cart.length} SP</span>
                        </div>
                    </div>
                    <div className="p-2 space-y-1.5 bg-white border-b border-slate-200 overflow-y-auto max-h-[300vh]">
                    {cart.length === 0 ? <div className="h-20 flex flex-col items-center justify-center opacity-30"><ShoppingCart size={36} className="mb-1 text-slate-600"/><p className="font-bold text-[10px] text-slate-500 uppercase">Giỏ hàng trống</p></div> : cart.map((item, idx) => {
                        const profit = (item.price - item.currentImportPrice) * item.quantity;
                        return (
                        <div key={item.productId} className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80 animate-fade-in space-y-2 shadow-2xs">
                            <div className="flex justify-between items-start gap-1">
                                <span className="font-bold text-primary text-[13px] truncate uppercase leading-tight flex-1">{idx+1}. {item.productName}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button 
                                        type="button"
                                        onClick={() => moveItemUp(idx)}
                                        disabled={idx === 0}
                                        className="p-1 rounded bg-slate-200/80 hover:bg-slate-300 text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition shadow-2xs active:scale-95"
                                        title="Di chuyển lên trên"
                                    >
                                        <ChevronUp size={13} strokeWidth={2.5}/>
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => moveItemDown(idx)}
                                        disabled={idx === cart.length - 1}
                                        className="p-1 rounded bg-slate-200/80 hover:bg-slate-300 text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition shadow-2xs active:scale-95"
                                        title="Di chuyển xuống dưới"
                                    >
                                        <ChevronDown size={13} strokeWidth={2.5}/>
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setCart(cart.filter(i => i.productId !== item.productId))} 
                                        className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                                        title="Xóa khỏi giỏ hàng"
                                    >
                                        <X size={15}/>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center space-x-1 shrink-0">
                                    <button onClick={() => updateCartItem(item.productId, { quantity: Math.max(1, item.quantity - 1) })} className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition-all"><Minus size={11}/></button>
                                    <input 
                                      type="number" 
                                      value={item.quantity} 
                                      onChange={(e) => updateCartItem(item.productId, { quantity: Math.max(1, parseInt(e.target.value) || 0) })} 
                                      onFocus={(e) => e.target.select()}
                                      className="w-14 text-center font-bold text-base text-primary bg-transparent border-none focus:ring-0 appearance-none p-0" 
                                    />
                                    <button onClick={() => updateCartItem(item.productId, { quantity: item.quantity + 1 })} className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition-all"><Plus size={11}/></button>
                                </div>

                                <div className="flex items-center gap-1 flex-1 min-w-0 max-w-[150px]">
                                    <div className="relative flex-1">
                                        <NumericInput 
                                            value={item.price} 
                                            onChange={(val) => updateCartItem(item.productId, { price: val })}
                                            className="w-full pl-6 pr-1 py-1.5 text-right font-bold text-base border border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/30 outline-none text-white bg-slate-900 shadow-2xs"
                                        />
                                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400 uppercase">Giá</span>
                                    </div>
                                    {isAdmin && (
                                        <button 
                                            onClick={() => updateCartItem(item.productId, { updateSellingPrice: !item.updateSellingPrice })}
                                            className={`p-1.5 rounded border transition-colors ${item.updateSellingPrice ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-400 border-slate-200'}`}
                                            title="Cập nhật giá bán gốc khi lưu đơn"
                                        >
                                            <Save size={14}/>
                                        </button>
                                    )}
                                </div>

                                <div className="text-right shrink-0">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase leading-none">Thành tiền</p>
                                    <p className="text-base font-bold text-slate-900 leading-none mt-1">{formatNumber(item.price * item.quantity)} ₫</p>
                                </div>
                            </div>

                            {isAdmin && (
                                <div className="pt-1 flex justify-between items-center border-t border-dashed border-slate-200">
                                    <div className="flex items-center gap-1.5 flex-1 max-w-[150px]">
                                        <div className="relative flex-1">
                                            <NumericInput 
                                                value={item.currentImportPrice} 
                                                onChange={(val) => updateCartItem(item.productId, { currentImportPrice: val })}
                                                className="w-full pl-6 pr-1 py-0.5 text-right font-bold text-[10px] border border-blue-200 rounded bg-blue-50/50 outline-none text-slate-800"
                                            />
                                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-blue-400 uppercase">Vốn</span>
                                        </div>
                                        <button 
                                            onClick={() => updateCartItem(item.productId, { updateImportPrice: !item.updateImportPrice })}
                                            className={`p-0.5 rounded border transition-colors ${item.updateImportPrice ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-300 border-slate-200'}`}
                                            title="Cập nhật giá vốn gốc khi lưu đơn"
                                        >
                                            <Save size={10}/>
                                        </button>
                                    </div>
                                    <span className={`text-[10px] font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        LN: {formatNumber(profit)} ₫
                                    </span>
                                </div>
                            )}
                        </div>
                    )})}
                    <div className="p-3 bg-white flex-shrink-0 shadow-2xs border-t border-slate-200">
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Phí vận chuyển</span>
                              <div className="relative">
                                  <NumericInput 
                                      value={shippingFee} 
                                      onChange={setShippingFee}
                                      className="w-full pl-8 pr-2 py-2 border border-slate-700 rounded-xl font-bold text-base text-right focus:ring-2 focus:ring-primary/30 outline-none text-white bg-slate-900 shadow-2xs"
                                  />
                                  <Truck size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                              </div>
                          </div>
                          <div className="text-right flex flex-col justify-end">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tổng cộng (Đơn + Ship)</span>
                              <span className="font-black text-primary leading-none text-2xl sm:text-3xl">{formatNumber(totals.revenue)}<span className="text-xs ml-0.5 font-bold">₫</span></span>
                          </div>
                        </div>
                        <button onClick={handleCheckout} disabled={isProcessing || cart.length === 0} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base shadow-md active:scale-98 disabled:bg-slate-200 disabled:text-slate-400 transition-all flex items-center justify-center uppercase tracking-wide">
                            {isProcessing ? <Loader className="animate-spin mr-2" size={20}/> : <Banknote className="mr-2" size={22}/>}
                            {(() => {
                                const btnActualPaid = isDebt ? 0 : (amountPaidInput === '' ? totals.revenue : parseInt(amountPaidInput.replace(/[^\d]/g, '') || '0'));
                                if (isDebt || btnActualPaid === 0) return 'Ghi nợ 100%';
                                if (btnActualPaid < totals.revenue) return `Trả trước ${formatNumber(btnActualPaid)} ₫`;
                                return `Hoàn tất đơn ${paymentMethods.find(p => p.id === selectedPaymentMethodId)?.name || ''}`.trim();
                            })()}
                        </button>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex-1 overflow-y-auto pb-20">
                      <div className="space-y-3">
                          <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-700 shadow-md flex justify-between items-center text-white mb-2 sticky top-0 z-10">
                              <div className="flex flex-col">
                                  <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Tổng đơn:</span><span className="text-xl font-black text-primary">{summaryToday.count}</span></div>
                                  {isAdmin && (<div className="flex items-center gap-2"><span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Lợi nhuận:</span><span className="text-xl font-black text-emerald-400">{formatNumber(summaryToday.profit)} ₫</span></div>)}
                              </div>
                              {isAdmin && (
                                  <div className="text-right">
                                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight block">Doanh thu hôm nay</span>
                                      <span className="text-2xl font-black text-yellow-400">{formatNumber(summaryToday.revenue)} ₫</span>
                                  </div>
                              )}
                          </div>
                          
                          <div className="relative mb-2">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                              <input 
                                  type="text" 
                                  placeholder="Tìm đơn hàng theo tên SP, KH, sdt..." 
                                  value={todaySalesSearchTerm} 
                                  onChange={e => setTodaySalesSearchTerm(e.target.value)} 
                                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none shadow-2xs"
                              />
                          </div>

                          {todaySales.filter(sale => {
                              const searchLower = todaySalesSearchTerm.toLowerCase();
                              if (!searchLower) return true;
                              return (
                                  (sale.customerName && sale.customerName.toLowerCase().includes(searchLower)) ||
                                  ((sale as any).customerPhone && (sale as any).customerPhone.toLowerCase().includes(searchLower)) ||
                                  (sale.items && sale.items.some(item => item.productName && item.productName.toLowerCase().includes(searchLower)))
                              );
                          }).map(sale => {
                              const totalProfit = sale.items?.reduce((acc, it) => acc + (it.price - (it.importPrice || 0)) * it.quantity, 0) || 0;
                              let shipLabel = "Đã giao"; let shipColor = "bg-blue-600 text-white";
                              if (sale.shippingStatus === 'pending') { shipLabel = "Chờ gởi"; shipColor = "bg-slate-200 text-red-600"; }
                              else if (sale.shippingStatus === 'order') { shipLabel = "Đặt hàng"; shipColor = "bg-red-600 text-white"; }
                              return (
                                <div key={sale.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all">
                                    <div className="bg-slate-900 px-3 py-2 text-white border-b border-slate-800">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <span className="text-[11px] font-bold uppercase truncate bg-white/10 px-2 py-0.5 rounded leading-none">{sale.customerName}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase shadow-2xs ${shipColor}`}>{shipLabel}</span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button onClick={() => { setSelectedSaleEdit(sale); setIsEditModalOpen(true); }} className="p-1 bg-white/20 rounded hover:bg-blue-500 transition" title="Sửa đơn"><Edit size={12}/></button>
                                                <button onClick={() => { setSelectedSaleDetail(sale); setIsDetailModalOpen(true); }} className="p-1 bg-white/20 rounded hover:bg-primary transition" title="Xem chi tiết"><Eye size={12}/></button>
                                                <button 
                                                    onClick={() => {
                                                        setSelectedLedgerProductId('all');
                                                        setIsLedgerModalOpen(true);
                                                    }} 
                                                    className="p-1 bg-white/20 rounded hover:bg-purple-500 transition" 
                                                    title="Truy vết tồn kho"
                                                >
                                                    <History size={12}/>
                                                </button>
                                                <span className="text-sm font-black text-yellow-400 ml-1">{formatNumber(sale.total)} ₫</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 items-center opacity-90 mt-1.5">
                                            {sale.shipperName && <span className="flex items-center text-[9px] font-bold bg-white/10 px-1.5 py-0.5 rounded"><Truck size={10} className="mr-1"/> {sale.shipperName}</span>}
                                            <span className="flex items-center text-[9px] font-bold bg-white/10 px-1.5 py-0.5 rounded"><CreditCard size={10} className="mr-1"/> {sale.paymentMethodName || 'Nợ/TM'}</span>
                                            {sale.status === 'debt' && <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-red-600 text-white animate-pulse">CÒN NỢ</span>}
                                            {isAdmin && <span className="px-2 py-0.5 rounded text-[12px] font-black uppercase bg-green-600 text-white shadow-sm tracking-wide">LN ĐƠN: {formatNumber(totalProfit)}</span>}
                                        </div>
                                    </div>
                                    <div className="p-2.5 space-y-2 bg-white">
                                        {sale.items?.map((it, idx) => {
                                            const itemProfit = (it.price - (it.importPrice || 0)) * it.quantity;
                                            return (
                                                <div key={idx} className="flex flex-col border-b border-slate-50 last:border-0 pb-1.5">
                                                    <div className="flex justify-between items-center mb-0.5"><div className="flex items-center gap-1.5 min-w-0"><span className="font-bold text-slate-800 text-[11px] truncate uppercase">{it.productName}</span>{isAdmin && <span className="text-[9px] font-black text-green-600 bg-green-50 px-1 rounded whitespace-nowrap">LN: {formatNumber(itemProfit)}</span>}</div><div className="text-right shrink-0"><span className="font-black text-primary text-[10px] whitespace-nowrap">{formatNumber(it.price)} x {it.quantity} = {formatNumber(it.price * it.quantity)} ₫</span></div></div>
                                                </div>
                                            );
                                        })}
                                        {(sale.shippingFee || 0) > 0 && (
                                            <div className="flex justify-between items-center pt-1 border-t border-dashed border-slate-200">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">Phí vận chuyển:</span>
                                                <span className="text-[10px] font-black text-black">{formatNumber(sale.shippingFee || 0)} ₫</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                              );
                          })}
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

const SalesTerminal: React.FC<{ 
  userRole: 'admin' | 'staff' | null, 
  user: FirebaseAuthUser | null,
  unreadCount?: number,
  onMarkAsRead?: () => void
}> = ({ userRole, user, unreadCount = 0, onMarkAsRead }) => {
    const [activeTab, setActiveTab] = useState<'pos' | 'history' | 'items'>('pos');

    // Automatically mark sales as read whenever the terminal is opened or tab changed
    useEffect(() => {
        onMarkAsRead?.();
    }, [activeTab, onMarkAsRead]);

    return (
        <div className="flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2 flex-shrink-0">
                 <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                     <h1 className="text-2xl sm:text-3xl font-black text-dark uppercase tracking-tighter">Bán hàng</h1>
                     {unreadCount > 0 && (
                         <button
                             type="button"
                             onClick={() => onMarkAsRead?.()}
                             className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-full text-xs font-bold transition shadow-sm cursor-pointer hover:scale-105"
                             title="Nhấp để xóa thông báo và đánh dấu đã xem tất cả đơn hàng mới"
                         >
                             <CheckCheck size={14} />
                             <span>{unreadCount} đơn mới &bull; Đã đọc</span>
                         </button>
                     )}
                 </div>
                 <div className="border-b border-slate-200 w-full md:w-auto overflow-x-auto"><nav className="flex space-x-2"><button onClick={() => setActiveTab('pos')} className={`flex items-center space-x-2 px-4 py-2 text-sm font-black uppercase tracking-tighter border-b-2 transition-all ${activeTab === 'pos' ? 'text-primary border-primary' : 'text-neutral border-transparent'}`}><ShoppingCart size={18} /><span className="hidden md:inline">Bán Hàng</span></button><button onClick={() => setActiveTab('history')} className={`flex items-center space-x-2 px-4 py-2 text-sm font-black uppercase tracking-tighter border-b-2 transition-all ${activeTab === 'history' ? 'text-primary border-primary' : 'text-neutral border-transparent'}`}><History size={18} /><span className="hidden md:inline">Lịch Sử</span></button><button onClick={() => setActiveTab('items')} className={`flex items-center space-x-2 px-4 py-2 text-sm font-black uppercase tracking-tighter border-b-2 transition-all ${activeTab === 'items' ? 'text-primary border-primary' : 'text-neutral border-transparent'}`}><List size={18} /><span className="hidden md:inline">Chi Tiết</span></button></nav></div>
            </div>
            <div className="mt-2">{activeTab === 'pos' && <POSView userRole={userRole} user={user} />}{activeTab === 'history' && <SalesHistory userRole={userRole} />}{activeTab === 'items' && <ProductSalesHistory userRole={userRole} />}</div>
        </div>
    );
};

export default SalesTerminal;
