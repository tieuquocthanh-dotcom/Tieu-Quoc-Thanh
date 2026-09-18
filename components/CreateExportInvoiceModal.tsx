import React, { useState, useMemo } from 'react';
import { 
    doc, 
    collection, 
    writeBatch, 
    serverTimestamp, 
    increment 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, ProductInvoiceExport, ProductInvoiceExportItem } from '../types';
import { 
    FileOutput, 
    X, 
    Search, 
    Trash2, 
    Plus, 
    Minus, 
    Save, 
    AlertTriangle, 
    Calendar, 
    User, 
    Edit3 
} from 'lucide-react';
import { formatNumber, parseNumber, getLocalYYYYMMDD } from '../utils/formatting';
import { searchVietnameseMatch } from '../utils/vietnameseSearch';

// Formatted numeric input for unit prices
const NumericInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    className?: string;
    placeholder?: string;
}> = ({ value, onChange, className, placeholder }) => {
    const [localValue, setLocalValue] = useState(formatNumber(value));

    React.useEffect(() => {
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

interface CreateExportInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialProduct: Product | null;
    exportToEdit?: ProductInvoiceExport | null;
    products: Product[];
    currentUser: any;
    onSuccess: (msg: string) => void;
}

export const CreateExportInvoiceModal: React.FC<CreateExportInvoiceModalProps> = ({
    isOpen,
    onClose,
    initialProduct,
    exportToEdit,
    products,
    currentUser,
    onSuccess
}) => {
    const defaultCreator = currentUser?.displayName || currentUser?.email || 'Admin';
    const [exportNumber, setExportNumber] = useState(() => exportToEdit?.exportNumber || '');
    const [exportDate, setExportDate] = useState(() => exportToEdit?.exportDate || getLocalYYYYMMDD());
    const [creatorName, setCreatorName] = useState(() => exportToEdit?.creatorName || defaultCreator);
    const [customerName, setCustomerName] = useState(() => exportToEdit?.customerName || '');
    const [notes, setNotes] = useState(() => exportToEdit?.notes || '');

    // Initialize items with default quantity = 1 as requested
    const [items, setItems] = useState<ProductInvoiceExportItem[]>(() => {
        if (exportToEdit && exportToEdit.items) {
            return JSON.parse(JSON.stringify(exportToEdit.items));
        }
        if (initialProduct) {
            return [{
                productId: initialProduct.id,
                productName: initialProduct.name,
                quantity: 1, // Mặc định số lượng là 1
                unitPrice: initialProduct.sellingPrice || 0
            }];
        }
        return [];
    });

    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Map for fast product lookup
    const productMap = useMemo(() => {
        const map = new Map<string, Product>();
        products.forEach(p => map.set(p.id, p));
        return map;
    }, [products]);

    // Product search results
    const searchFilteredProducts = useMemo(() => {
        if (!productSearchTerm.trim()) return [];
        return products.filter(p => searchVietnameseMatch(p.name, productSearchTerm)).slice(0, 15);
    }, [products, productSearchTerm]);

    // Add item - default quantity is 1
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
                quantity: 1, // Mặc định là 1 theo yêu cầu người dùng
                unitPrice: product.sellingPrice || 0
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

    const handleUpdateItemNotes = (idx: number, itemNote: string) => {
        const updated = [...items];
        updated[idx].notes = itemNote;
        setItems(updated);
    };

    const handleRemoveItem = (idx: number) => {
        setItems(items.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (items.length === 0) {
            alert("Vui lòng chọn ít nhất một sản phẩm cần xuất hóa đơn!");
            return;
        }

        const totalQuantity = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
        const totalAmount = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
        const generatedExportNumber = exportNumber.trim() || `XHD-${Date.now().toString().slice(-6)}`;

        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);

            if (exportToEdit) {
                // EDIT MODE: Calculate difference for invoiced stock adjustment
                const oldItemQtyMap = new Map<string, number>();
                (exportToEdit.items || []).forEach(it => {
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

                // Difference: diff = newQty - oldQty.
                // Since this is EXPORT (xuất), exporting more means subtracting more from totalInvoicedStock: -diff
                const allProductIds = new Set<string>([...oldItemQtyMap.keys(), ...newItemQtyMap.keys()]);
                allProductIds.forEach(pId => {
                    const oldQty = oldItemQtyMap.get(pId) || 0;
                    const newQty = newItemQtyMap.get(pId) || 0;
                    const diff = newQty - oldQty;
                    if (diff !== 0) {
                        const pRef = doc(db, 'products', pId);
                        batch.update(pRef, { totalInvoicedStock: increment(-diff) });
                    }
                });

                const exportRef = doc(db, 'productInvoiceExports', exportToEdit.id);
                const updatedData = {
                    exportNumber: generatedExportNumber,
                    exportDate: exportDate || getLocalYYYYMMDD(),
                    creatorName: creatorName.trim() || defaultCreator,
                    customerName: customerName.trim(),
                    notes: notes.trim(),
                    items,
                    totalQuantity,
                    totalAmount,
                    updatedAt: serverTimestamp(),
                    lastEditorName: currentUser?.displayName || currentUser?.email || 'Admin'
                };

                batch.update(exportRef, updatedData);
                await batch.commit();
                onSuccess(`Đã cập nhật phiếu xuất hóa đơn số ${generatedExportNumber} thành công!`);
            } else {
                // CREATE MODE: Add new export and deduct totalInvoicedStock
                const exportRef = doc(collection(db, 'productInvoiceExports'));

                const exportData = {
                    exportNumber: generatedExportNumber,
                    exportDate: exportDate || getLocalYYYYMMDD(),
                    creatorName: creatorName.trim() || defaultCreator,
                    creatorId: currentUser?.uid || '',
                    customerName: customerName.trim(),
                    notes: notes.trim(),
                    items,
                    totalQuantity,
                    totalAmount,
                    createdAt: serverTimestamp()
                };

                batch.set(exportRef, exportData);

                // Deduct totalInvoicedStock for each exported product:
                // "mỗi lần xuất sẽ trừ lại số lượng sản phẩm đã có hóa đơn"
                items.forEach(it => {
                    if (it.productId && it.quantity > 0) {
                        const pRef = doc(db, 'products', it.productId);
                        batch.update(pRef, { totalInvoicedStock: increment(-it.quantity) });
                    }
                });

                await batch.commit();
                onSuccess(`Đã tạo phiếu xuất hóa đơn số ${generatedExportNumber} thành công và trừ ${totalQuantity} tồn hóa đơn!`);
            }

            onClose();
        } catch (error) {
            console.error("Lỗi lưu phiếu xuất hóa đơn:", error);
            alert("Có lỗi xảy ra khi lưu phiếu xuất hóa đơn!");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className={`${exportToEdit ? 'bg-amber-600' : 'bg-indigo-600'} p-4 text-white flex justify-between items-center shrink-0`}>
                    <h3 className="font-black uppercase text-sm flex items-center gap-2">
                        {exportToEdit ? (
                            <>
                                <Edit3 size={20} /> Chỉnh Sửa Phiếu Xuất Hóa Đơn: {exportToEdit.exportNumber || 'XHĐ'}
                            </>
                        ) : (
                            <>
                                <FileOutput size={20} /> Xuất Hóa Đơn Sản Phẩm
                            </>
                        )}
                    </h3>
                    <button onClick={onClose} className="text-white/80 hover:text-white">
                        <X size={22} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-5 space-y-4 overflow-y-auto flex-1">
                        {/* Notice banner */}
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900 flex items-start gap-2.5">
                            <FileOutput size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">Quy tắc trừ số lượng hóa đơn:</p>
                                <p className="text-indigo-700 text-[11px] mt-0.5">
                                    Mỗi lần xuất hóa đơn, hệ thống sẽ tự động trừ số lượng xuất tương ứng vào tồn hóa đơn của từng sản phẩm.
                                </p>
                            </div>
                        </div>

                        {/* Row 1: Ngày xuất & Người làm */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                                    <Calendar size={14} className="text-indigo-600" />
                                    Ngày xuất hóa đơn <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={exportDate}
                                    onChange={e => setExportDate(e.target.value)}
                                    className="w-full p-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 text-slate-800"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                                    <User size={14} className="text-indigo-600" />
                                    Ai là người làm (Người xuất) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Tên người làm / nhân viên xuất..."
                                    value={creatorName}
                                    onChange={e => setCreatorName(e.target.value)}
                                    className="w-full p-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 text-slate-800"
                                />
                            </div>
                        </div>

                        {/* Row 2: Số HĐ xuất & Khách hàng */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                                    Số / Ký hiệu hóa đơn xuất
                                </label>
                                <input
                                    type="text"
                                    placeholder="VD: XHD-00125, HĐBH-02..."
                                    value={exportNumber}
                                    onChange={e => setExportNumber(e.target.value)}
                                    className="w-full p-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 text-slate-800"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                                    Khách hàng / Đơn vị nhận (tùy chọn)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Tên khách hàng, công ty nhận HĐ..."
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    className="w-full p-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 text-slate-800"
                                />
                            </div>
                        </div>

                        {/* Row 3: Ghi chú */}
                        <div>
                            <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                                Ghi chú phiếu xuất
                            </label>
                            <input
                                type="text"
                                placeholder="Ghi chú đợt xuất, lý do xuất..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full p-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 text-slate-800"
                            />
                        </div>

                        {/* Product search to add items */}
                        <div className="relative pt-2">
                            <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                                Thêm sản phẩm cần xuất hóa đơn
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Gõ tên sản phẩm để thêm vào phiếu xuất hóa đơn..."
                                    value={productSearchTerm}
                                    onChange={e => {
                                        setProductSearchTerm(e.target.value);
                                        setIsProductDropdownOpen(true);
                                    }}
                                    onFocus={() => setIsProductDropdownOpen(true)}
                                    className="w-full pl-9 pr-8 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 text-slate-800"
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

                            {/* Search Results Dropdown */}
                            {isProductDropdownOpen && productSearchTerm.trim() && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto divide-y divide-slate-100">
                                    {searchFilteredProducts.length === 0 ? (
                                        <div className="p-3 text-center text-xs text-slate-400 font-bold">
                                            Không tìm thấy sản phẩm nào khớp
                                        </div>
                                    ) : (
                                        searchFilteredProducts.map(p => {
                                            const invoicedStock = p.totalInvoicedStock || 0;
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => handleAddItem(p)}
                                                    className="w-full text-left p-2.5 hover:bg-indigo-50 text-xs flex justify-between items-center transition"
                                                >
                                                    <div>
                                                        <span className="font-bold uppercase text-slate-800 block">{p.name}</span>
                                                        <span className="text-[10px] text-slate-400">
                                                            Giá bán: {formatNumber(p.sellingPrice || 0)} ₫
                                                        </span>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                        invoicedStock > 0 ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'
                                                    }`}>
                                                        Tồn HĐ hiện tại: {invoicedStock} cái
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
                                <span>Danh Sách Sản Phẩm Xuất Hóa Đơn ({items.length})</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-indigo-600 font-bold">
                                        Tổng SL xuất: {items.reduce((acc, it) => acc + (it.quantity || 0), 0)} cái
                                    </span>
                                    {items.some(it => (it.unitPrice || 0) > 0) && (
                                        <span className="text-emerald-700 font-black">
                                            Tổng tiền: {formatNumber(items.reduce((acc, it) => acc + (it.quantity || 0) * (it.unitPrice || 0), 0))} ₫
                                        </span>
                                    )}
                                </div>
                            </div>

                            {items.length === 0 ? (
                                <div className="p-6 text-center text-xs text-slate-400 font-bold">
                                    Chưa có sản phẩm nào. Hãy tìm và thêm sản phẩm ở trên (mỗi sản phẩm mặc định có số lượng là 1).
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                                    {items.map((it, idx) => {
                                        const prod = productMap.get(it.productId);
                                        const currentInvoicedStock = prod?.totalInvoicedStock || 0;
                                        const isExceeding = it.quantity > currentInvoicedStock;

                                        return (
                                            <div key={idx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-xs uppercase text-slate-900 truncate">{it.productName}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] text-slate-400">
                                                            Tồn HĐ hiện tại: <strong className={currentInvoicedStock > 0 ? 'text-blue-600' : 'text-rose-600'}>{currentInvoicedStock}</strong>
                                                        </span>
                                                        {isExceeding && (
                                                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                                                <AlertTriangle size={10} /> Xuất vượt tồn HĐ
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
                                                    {/* Unit Price input */}
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[11px] font-black text-slate-500 uppercase whitespace-nowrap">Đơn Giá:</span>
                                                        <div className="relative w-24">
                                                            <NumericInput
                                                                value={it.unitPrice ?? 0}
                                                                onChange={(val) => handleUpdateUnitPrice(idx, val)}
                                                                placeholder="0"
                                                                className="w-full py-1 px-2 text-right border-2 border-slate-200 rounded-lg font-black text-xs text-slate-800 outline-none focus:border-indigo-500"
                                                            />
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-400">₫</span>
                                                    </div>

                                                    {/* Quantity Controls - Default is 1 */}
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
                                                            className="w-12 p-1 text-center border-2 border-slate-200 rounded-lg font-black text-xs text-indigo-600 outline-none"
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
                                                        title="Xóa khỏi phiếu xuất"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
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
                            className={`flex-1 py-2.5 ${exportToEdit ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-xl font-black text-xs uppercase transition shadow-sm disabled:bg-slate-300 flex items-center justify-center gap-2`}
                        >
                            <Save size={16} />
                            <span>{isSubmitting ? 'Đang Lưu...' : (exportToEdit ? 'Cập Nhật Xuất HĐ' : 'Lưu Xuất Hóa Đơn')}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateExportInvoiceModal;
