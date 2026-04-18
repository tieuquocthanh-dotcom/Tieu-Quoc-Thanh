
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, ChinaImport, ChinaImportItem, ChinaImportStatus } from '../types';
import { Plus, Trash2, Save, Search, Calculator, DollarSign, Plane, History, Loader, PlusCircle, Edit, X, Eye, Printer, FileText, Coins, RotateCcw, Check, AlertTriangle, ExternalLink, Truck, PackageCheck, AlertCircle, ShoppingCart, ListFilter } from 'lucide-react';
import { formatNumber, parseNumber } from '../utils/formatting';
import Pagination from './Pagination';
import { ProductModal } from './ProductManagement';
import ConfirmationModal from './ConfirmationModal';

const STATUS_CONFIG: Record<ChinaImportStatus, { label: string, color: string, icon: React.FC<any> }> = {
    ordered: { label: 'Lên đơn', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: FileText },
    placed: { label: 'Đặt hàng', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: ShoppingCart },
    paid: { label: 'Đã chuyển tiền', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: DollarSign },
    at_vn: { label: 'Về tới VN', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Truck },
    received_full: { label: 'Đã nhận đủ', color: 'bg-green-100 text-green-700 border-green-200', icon: PackageCheck },
    received_missing: { label: 'Nhận thiếu hàng', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle }
};

const StatusBadge: React.FC<{ status?: ChinaImportStatus }> = ({ status }) => {
    const config = STATUS_CONFIG[status || 'ordered'];
    const Icon = config.icon;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${config.color}`}>
            <Icon size={10} className="mr-1" />
            {config.label}
        </span>
    );
};

// --- DETAIL MODAL COMPONENT ---
const ChinaImportDetailModal: React.FC<{
    importData: ChinaImport | null;
    onClose: () => void;
}> = ({ importData, onClose }) => {
    if (!importData) return null;

    const items = Array.isArray(importData.items) ? importData.items : [];
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalShippingCN_VND = importData.shippingFeeCN * importData.exchangeRate;
    const currencyExchangeFee = importData.currencyExchangeFee || 0;
    const totalExtraFeesVND = totalShippingCN_VND + importData.shippingFeeVN + importData.shippingFeeExtra + currencyExchangeFee;
    const feePerItem = totalQuantity > 0 ? totalExtraFeesVND / totalQuantity : 0;

    const handlePrint = () => { window.print(); };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in-down overflow-hidden">
                <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center print:hidden">
                    <h2 className="text-xl font-bold text-dark flex items-center">
                        <FileText className="mr-2 text-primary" /> Chi Tiết Đơn Nhập TQ
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-neutral"><X size={24} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 print:p-0">
                    <div className="mb-6 p-4 bg-slate-50 border-l-4 border-slate-800 rounded-r-lg flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-black text-slate-800 uppercase">{importData.orderName || 'Đơn hàng không tên'}</h3>
                            <p className="text-xs text-slate-500 font-bold opacity-70 mt-1">ID: #{importData.id.substring(0,8)}</p>
                        </div>
                        <StatusBadge status={importData.status} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-800 uppercase font-bold mb-2">Thông tin chung</p>
                            <p className="text-sm mb-1 text-slate-700"><span className="font-bold text-black">Ngày nhập:</span> {importData.importDate?.toDate().toLocaleDateString('vi-VN')}</p>
                            <p className="text-sm mb-1 text-slate-700"><span className="font-bold text-black">Tỷ giá:</span> <span className="font-bold text-blue-700">{formatNumber(importData.exchangeRate)} ₫</span></p>
                            <p className="text-sm italic text-slate-800 mt-2 font-medium">Note: {importData.note || 'Không có'}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-800 uppercase font-bold mb-2">Chi phí vận chuyển & Khác</p>
                            <div className="flex justify-between text-sm mb-1 text-slate-700"><span className="font-medium">Ship Nội địa:</span><span className="font-bold text-black">{formatNumber(importData.shippingFeeCN)} ¥ <span className="text-xs text-slate-500 font-normal">({formatNumber(totalShippingCN_VND)} ₫)</span></span></div>
                            <div className="flex justify-between text-sm mb-1 text-slate-700"><span className="font-medium">Ship VN:</span><span className="font-bold text-black">{formatNumber(importData.shippingFeeVN)} ₫</span></div>
                            <div className="flex justify-between text-sm mb-1 text-slate-700"><span className="font-medium">Phí khác:</span><span className="font-bold text-black">{formatNumber(importData.shippingFeeExtra)} ₫</span></div>
                            <div className="flex justify-between text-sm mb-1 text-slate-700"><span className="font-medium">Phí đổi tiền:</span><span className="font-bold text-black">{formatNumber(currencyExchangeFee)} ₫</span></div>
                            <div className="border-t border-slate-300 mt-2 pt-2 flex justify-between text-sm font-bold text-orange-700"><span>Tổng phí phụ:</span><span>{formatNumber(totalExtraFeesVND)} ₫</span></div>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-lg border-2 border-slate-800 shadow-lg text-white">
                            <p className="text-xs text-slate-400 uppercase font-bold mb-2 tracking-widest border-b border-slate-700 pb-1">Tổng cộng thanh toán</p>
                            <div className="flex justify-between text-sm mb-1"><span className="text-slate-400">Tiền hàng (¥):</span><span className="font-bold">{formatNumber((importData.totalCostCNY || 0) - importData.shippingFeeCN)} ¥</span></div>
                            <div className="flex justify-between text-sm mb-2 border-b border-slate-700 pb-1 font-black text-red-400"><span className="text-slate-400">TỔNG TỆ (HÀNG+SHIP):</span><span>{formatNumber(importData.totalCostCNY)} ¥</span></div>
                            <div className="pt-2"><div className="flex justify-between text-lg font-extrabold text-green-400 uppercase"><span>TỔNG VỀ TAY:</span><span>{formatNumber(importData.totalCostVND)} ₫</span></div></div>
                        </div>
                    </div>
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center text-sm text-blue-900">
                        <Coins size={18} className="mr-2 text-blue-700"/>
                        <span>Phí phân bổ: <strong>{formatNumber(Math.round(feePerItem))} ₫ / SP</strong></span>
                    </div>
                    <div className="overflow-x-auto border border-slate-300 rounded-lg">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-xs">
                                <tr>
                                    <th className="p-3 border-b border-slate-300">Sản phẩm</th>
                                    <th className="p-3 text-center border-b border-slate-300">SL</th>
                                    <th className="p-3 text-right border-b border-slate-300">Giá Tệ (¥)</th>
                                    <th className="p-3 text-right border-b border-slate-300">Thành tiền (¥)</th>
                                    <th className="p-3 text-right bg-green-50 text-green-900 border-b border-slate-300">Giá Vốn Thực Tế (₫)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {items.map((item, index) => {
                                    const actualPriceVND = (item.priceCNY * importData.exchangeRate) + feePerItem;
                                    return (
                                        <tr key={index} className="hover:bg-slate-50">
                                            <td className="p-3 font-bold text-slate-800">{item.productName}</td>
                                            <td className="p-3 text-center text-blue-600 font-black">{item.quantity}</td>
                                            <td className="p-3 text-right text-black">{formatNumber(item.priceCNY)}</td>
                                            <td className="p-3 text-right font-bold text-red-600">{formatNumber(item.totalCNY)}</td>
                                            <td className="p-3 text-right bg-green-50 font-extrabold text-green-800 text-base">{formatNumber(Math.round(actualPriceVND))}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-200 bg-white flex justify-end print:hidden">
                    <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-dark rounded-lg font-medium mr-2 transition"><Printer size={18} className="mr-2" /> In Phiếu</button>
                    <button onClick={onClose} className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition shadow">Đóng</button>
                </div>
            </div>
        </div>
    );
};

// --- EDIT MODAL COMPONENT ---
const EditImportModal: React.FC<{
    importData: ChinaImport;
    products: Product[];
    onClose: () => void;
    onSave: (id: string, data: Partial<ChinaImport>) => void;
    onDelete: (id: string) => void;
}> = ({ importData, products, onClose, onSave, onDelete }) => {
    const [orderName, setOrderName] = useState(importData.orderName || '');
    const [status, setStatus] = useState<ChinaImportStatus>(importData.status || 'ordered');
    const [exchangeRate, setExchangeRate] = useState(importData.exchangeRate.toString());
    const [shippingFeeCN, setShippingFeeCN] = useState(importData.shippingFeeCN.toString());
    const [shippingFeeVN, setShippingFeeVN] = useState(importData.shippingFeeVN.toString());
    const [shippingFeeExtra, setShippingFeeExtra] = useState(importData.shippingFeeExtra.toString());
    const [currencyExchangeFee, setCurrencyExchangeFee] = useState((importData.currencyExchangeFee || 0).toString());
    const [note, setNote] = useState(importData.note || '');
    const [cart, setCart] = useState<ChinaImportItem[]>(Array.isArray(importData.items) ? importData.items : []);
    
    // Autocomplete states for adding new items
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [quantity, setQuantity] = useState<number | string>(1);
    const [priceCNY, setPriceCNY] = useState<number | string>(0);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    // Inline Edit States for table items
    const [inlineEditingIndex, setInlineEditingIndex] = useState<number | null>(null);
    const [inlineQty, setInlineQty] = useState<number | string>(0);
    const [inlinePrice, setInlinePrice] = useState<number | string>(0);

    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const totalProductCNY = cart.reduce((sum, item) => sum + (item.totalCNY || 0), 0);
    const parsedExchangeRate = parseNumber(exchangeRate);
    const parsedShippingFeeCN = parseNumber(shippingFeeCN);
    const finalTotalCNY = totalProductCNY + parsedShippingFeeCN;
    const finalTotalVND = (finalTotalCNY * parsedExchangeRate) + parseNumber(shippingFeeVN) + parseNumber(shippingFeeExtra) + parseNumber(currencyExchangeFee);

    const filteredProducts = useMemo(() => {
        if (!searchTerm || !Array.isArray(products)) return [];
        return products.filter(p => p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10);
    }, [products, searchTerm]);

    const handleSelectProduct = (product: Product) => {
        setSelectedProductId(product.id);
        setSearchTerm(product.name);
        setIsDropdownOpen(false);
    };

    const handleAddItem = () => {
        const qtyNum = Number(quantity);
        const priceNum = Number(priceCNY);
        if (!selectedProductId || qtyNum <= 0 || priceNum <= 0) return;
        const product = products.find(p => p.id === selectedProductId);
        if (!product) return;
        
        const newItem = { productId: product.id, productName: product.name, quantity: qtyNum, priceCNY: priceNum, totalCNY: qtyNum * priceNum };
        setCart([...cart, newItem]);
        setSelectedProductId(''); setSearchTerm(''); setQuantity(1); setPriceCNY(0);
    };

    const handleStartInlineEdit = (index: number) => {
        const item = cart[index];
        setInlineEditingIndex(index);
        setInlineQty(item.quantity);
        setInlinePrice(item.priceCNY);
    };

    const handleSaveInlineEdit = (index: number) => {
        const qty = Number(inlineQty);
        const price = Number(inlinePrice);
        if (qty <= 0 || price <= 0) return;

        const newCart = [...cart];
        newCart[index] = {
            ...newCart[index],
            quantity: qty,
            priceCNY: price,
            totalCNY: qty * price
        };
        setCart(newCart);
        setInlineEditingIndex(null);
    };

    const handleSave = () => {
        onSave(importData.id, {
            orderName,
            status,
            items: cart,
            exchangeRate: parsedExchangeRate,
            shippingFeeCN: parsedShippingFeeCN,
            shippingFeeVN: parseNumber(shippingFeeVN),
            shippingFeeExtra: parseNumber(shippingFeeExtra),
            currencyExchangeFee: parseNumber(currencyExchangeFee),
            totalCostCNY: finalTotalCNY,
            totalCostVND: finalTotalVND,
            note,
        });
    };

    return (
        <>
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-fade-in-down overflow-hidden">
                <div className="p-4 bg-slate-50 text-black flex justify-between items-center border-b border-slate-200">
                    <h2 className="text-lg font-bold flex items-center uppercase tracking-tight"><Edit size={18} className="mr-2 text-blue-600"/> Chỉnh Sửa Đơn Hàng TQ</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="p-4 bg-slate-50 border rounded-lg shadow-inner">
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Tên đơn hàng gợi nhớ</label>
                            <input type="text" value={orderName} onChange={e => setOrderName(e.target.value)} placeholder="đặt tên gợi nhớ cho đơn hàng" className="w-full px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"/>
                        </div>
                        <div className="p-4 bg-slate-50 border rounded-lg shadow-inner">
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Trạng thái đơn hàng</label>
                            <select 
                                value={status} 
                                onChange={e => setStatus(e.target.value as ChinaImportStatus)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg font-black text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
                            >
                                {Object.entries(STATUS_CONFIG).map(([key, value]) => (
                                    <option key={key} value={key}>{value.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="lg:w-2/3 space-y-4">
                            <div className="p-4 rounded-lg border bg-slate-50 border-slate-200">
                                <h4 className="text-[10px] font-black uppercase text-slate-500 mb-3">Thêm sản phẩm mới vào đơn</h4>
                                <div className="flex gap-2 items-center mb-2">
                                    <div className="flex-1 relative" ref={dropdownRef}>
                                        <input type="text" placeholder="Tìm sản phẩm..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setIsDropdownOpen(true); }} onFocus={() => setIsDropdownOpen(true)} className="w-full px-3 py-2 bg-white text-black border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"/>
                                        {isDropdownOpen && searchTerm && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">
                                                {filteredProducts.map(p => <button key={p.id} onClick={() => handleSelectProduct(p)} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-slate-100 last:border-0 text-black font-medium">{p.name}</button>)}
                                            </div>
                                        )}
                                    </div>
                                    <input type="number" placeholder="SL" className="w-16 px-2 py-2 border bg-white text-black border-slate-300 rounded-lg text-sm text-center font-bold" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}/>
                                    <input type="number" placeholder="Giá ¥" className="w-24 px-2 py-2 border bg-white text-black border-slate-300 rounded-lg text-sm text-center font-bold" value={priceCNY} onChange={e => setPriceCNY(e.target.value === '' ? '' : Number(e.target.value))}/>
                                    <button onClick={handleAddItem} className="p-2.5 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition shadow-md active:scale-95"><Plus size={20}/></button>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 text-slate-500 font-black uppercase text-[10px]">
                                        <tr>
                                            <th className="p-3">Sản phẩm</th>
                                            <th className="p-3 text-center">SL</th>
                                            <th className="p-3 text-right">Giá (¥)</th>
                                            <th className="p-3 text-right">Thành tiền (¥)</th>
                                            <th className="p-3 text-center w-24">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {cart.map((item, index) => {
                                            const isEditingThis = inlineEditingIndex === index;
                                            return (
                                                <tr key={index} className={`transition-colors ${isEditingThis ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
                                                    <td className="p-3 text-slate-900 font-bold">{item.productName}</td>
                                                    <td className="p-3 text-center">
                                                        {isEditingThis ? (
                                                            <input 
                                                                type="number" 
                                                                value={inlineQty} 
                                                                onChange={e => setInlineQty(e.target.value === '' ? '' : Number(e.target.value))}
                                                                className="w-16 p-1 border-2 border-orange-400 rounded text-center font-black bg-white text-black"
                                                            />
                                                        ) : (
                                                            <span className="text-blue-600 font-black">{item.quantity}</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        {isEditingThis ? (
                                                            <input 
                                                                type="number" 
                                                                value={inlinePrice} 
                                                                onChange={e => setInlinePrice(e.target.value === '' ? '' : Number(e.target.value))}
                                                                className="w-24 p-1 border-2 border-orange-400 rounded text-right font-black bg-white text-black"
                                                            />
                                                        ) : (
                                                            <span className="text-slate-900 font-medium">{formatNumber(item.priceCNY)}</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-right font-black text-red-600">
                                                        {isEditingThis ? (
                                                            formatNumber(Number(inlineQty) * Number(inlinePrice))
                                                        ) : (
                                                            formatNumber(item.totalCNY)
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex justify-center space-x-1">
                                                            {isEditingThis ? (
                                                                <>
                                                                    <button onClick={() => handleSaveInlineEdit(index)} className="text-green-600 hover:bg-green-100 p-1.5 rounded-lg border border-green-200 shadow-sm" title="Lưu dòng này"><Check size={16}/></button>
                                                                    <button onClick={() => setInlineEditingIndex(null)} className="text-slate-500 hover:bg-slate-100 p-1.5 rounded-lg border border-slate-200 shadow-sm" title="Hủy bỏ"><RotateCcw size={16}/></button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button onClick={() => handleStartInlineEdit(index)} className="text-blue-600 hover:bg-blue-100 p-1.5 rounded-lg border border-blue-100 shadow-sm" title="Sửa dòng này"><Edit size={16}/></button>
                                                                    <button onClick={() => { const nc = [...cart]; nc.splice(index, 1); setCart(nc); }} className="text-red-500 hover:bg-red-100 p-1.5 rounded-lg border border-red-100 shadow-sm" title="Xóa"><Trash2 size={16}/></button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="lg:w-1/3 bg-slate-50 p-4 rounded-xl border border-slate-200 h-fit space-y-4 shadow-inner">
                            <h4 className="font-black text-dark text-[10px] uppercase border-b pb-2 mb-2 flex items-center"><Coins size={14} className="mr-1.5 text-orange-600"/> Chi phí & Tỷ giá</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Tỷ giá VND/CNY</label>
                                    <input type="text" inputMode="numeric" value={formatNumber(exchangeRate)} onChange={e => setExchangeRate(String(parseNumber(e.target.value)))} className="w-full p-2 border border-slate-300 rounded-lg bg-slate-900 text-white font-black text-lg focus:ring-2 focus:ring-primary outline-none shadow-inner"/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Ship N.Địa (¥)</label>
                                    <input type="text" inputMode="numeric" value={formatNumber(shippingFeeCN)} onChange={e => setShippingFeeCN(String(parseNumber(e.target.value)))} className="w-full p-2 border border-slate-300 rounded-lg bg-slate-100 text-dark font-bold outline-none"/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Ship VN (₫)</label>
                                    <input type="text" inputMode="numeric" value={formatNumber(shippingFeeVN)} onChange={e => setShippingFeeVN(String(parseNumber(e.target.value)))} className="w-full p-2 border border-slate-300 rounded-lg bg-slate-100 text-dark font-bold outline-none"/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Phí khác (₫)</label>
                                    <input type="text" inputMode="numeric" value={formatNumber(shippingFeeExtra)} onChange={e => setShippingFeeExtra(String(parseNumber(e.target.value)))} className="w-full p-2 border border-slate-300 rounded-lg bg-slate-100 text-dark font-bold outline-none"/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Phí đổi tiền (₫)</label>
                                    <input type="text" inputMode="numeric" value={formatNumber(currencyExchangeFee)} onChange={e => setCurrencyExchangeFee(String(parseNumber(e.target.value)))} className="w-full p-2 border border-slate-300 rounded-lg bg-slate-100 text-dark font-bold outline-none"/>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Ghi chú</label>
                                <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg bg-white text-black text-sm shadow-sm" rows={2}></textarea>
                            </div>
                            <div className="pt-3 border-t border-slate-300">
                                <div className="flex justify-between text-sm mb-1 text-slate-600 font-bold"><span>Tổng Tệ:</span><span className="text-red-600">{formatNumber(finalTotalCNY)} ¥</span></div>
                                <div className="flex justify-between text-base text-black font-black uppercase mt-1">
                                    <span className="text-dark">Tổng VNĐ:</span>
                                    <span className="text-green-700 text-xl">{formatNumber(finalTotalVND)} ₫</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t bg-slate-50 flex justify-between items-center shadow-inner">
                    <button onClick={() => setIsDeleteConfirmOpen(true)} className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl font-black text-xs uppercase flex items-center transition active:scale-95"><Trash2 size={16} className="mr-2"/> Xóa Đơn</button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2 bg-white border border-slate-300 rounded-xl text-slate-600 font-black text-xs uppercase hover:bg-slate-100 transition">Hủy bỏ</button>
                        <button onClick={handleSave} className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-blue-200 transition active:scale-95">Lưu Thay Đổi</button>
                    </div>
                </div>
            </div>
        </div>
        <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={() => onDelete(importData.id)} title="Xác nhận Xóa Đơn Hàng" message={<>Bạn có chắc chắn muốn xóa đơn nhập hàng Trung Quốc này?<br /><span className="font-bold text-red-600 uppercase text-[10px]">Hành động này không thể hoàn tác.</span></>} />
        </>
    );
};


const ChinaImportManagement: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [imports, setImports] = useState<ChinaImport[]>([]);
    const [manufacturers, setManufacturers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'create' | 'history' | 'products'>('create');
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState(''); 
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingImport, setEditingImport] = useState<ChinaImport | null>(null);
    const [viewingImport, setViewingImport] = useState<ChinaImport | null>(null);
    const [orderName, setOrderName] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [quantity, setQuantity] = useState<number | string>(1);
    const [priceCNY, setPriceCNY] = useState<number | string>(0);
    const [cart, setCart] = useState<ChinaImportItem[]>([]);
    const [editingListIndex, setEditingListIndex] = useState<number | null>(null);
    const [exchangeRate, setExchangeRate] = useState('3600');
    const [shippingFeeCN, setShippingFeeCN] = useState('0');
    const [shippingFeeVN, setShippingFeeVN] = useState('0');
    const [shippingFeeExtra, setShippingFeeExtra] = useState('0');
    const [currencyExchangeFee, setCurrencyExchangeFee] = useState('0');
    const [note, setNote] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ChinaImportStatus | 'all'>('all');
    const [productHistoryStartDate, setProductHistoryStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
    const [productHistoryEndDate, setProductHistoryEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [productHistorySearch, setProductHistorySearch] = useState('');
    const [indexErrorUrl, setIndexErrorUrl] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        onSnapshot(query(collection(db, "products"), orderBy("name")), (snap) => setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product))));
        
        const qHistory = query(collection(db, "chinaImports"), orderBy("importDate", "desc"));
        const unsubHistory = onSnapshot(qHistory, (snapshot) => { 
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChinaImport));
            setImports(Array.isArray(data) ? data : []); 
            setLoading(false); 
            setIndexErrorUrl(null);
        }, (err: any) => {
            console.error("Lỗi Firestore:", err);
            setLoading(false);
            if (err.code === 'failed-precondition' && err.message.includes('index')) {
                const urlRegex = /(https?:\/\/[^\s]+)/;
                const match = err.message.match(urlRegex);
                if (match && match[0]) setIndexErrorUrl(match[0]);
            }
        });

        onSnapshot(collection(db, "manufacturers"), (snapshot) => setManufacturers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const handleClickOutside = (event: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            unsubHistory();
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const totalProductCNY = cart.reduce((sum, item) => sum + (item.totalCNY || 0), 0);
    const parsedExchangeRate = parseNumber(exchangeRate);
    const parsedShippingFeeCN = parseNumber(shippingFeeCN);
    const finalTotalVND = ((totalProductCNY + parsedShippingFeeCN) * parsedExchangeRate) + parseNumber(shippingFeeVN) + parseNumber(shippingFeeExtra) + parseNumber(currencyExchangeFee);

    const filteredProducts = useMemo(() => {
        if (!searchTerm || !Array.isArray(products)) return [];
        return products.filter(p => p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 20);
    }, [products, searchTerm]);

    const lastImportPrice = useMemo(() => {
        if (!selectedProductId || !Array.isArray(imports)) return null;
        for (const imp of imports) {
            const items = Array.isArray(imp.items) ? imp.items : [];
            const item = items.find(i => i.productId === selectedProductId);
            if (item) {
                return item.priceCNY;
            }
        }
        return null;
    }, [selectedProductId, imports]);

    const flattenedProductHistory = useMemo(() => {
        if (activeTab !== 'products' || !Array.isArray(imports)) return [];
        const start = new Date(productHistoryStartDate); start.setHours(0,0,0,0);
        const end = new Date(productHistoryEndDate); end.setHours(23,59,59,999);
        const searchTermLower = productHistorySearch.toLowerCase().trim();
        return imports.filter(imp => imp.importDate && imp.importDate.toDate() >= start && imp.importDate.toDate() <= end).flatMap(imp => {
            const items = Array.isArray(imp.items) ? imp.items : [];
            const totalQty = items.reduce((a, b) => a + b.quantity, 0);
            const extraFees = (imp.shippingFeeCN * imp.exchangeRate) + imp.shippingFeeVN + imp.shippingFeeExtra + (imp.currencyExchangeFee || 0);
            const feePerItem = totalQty > 0 ? extraFees / totalQty : 0;
            return items.filter(item => !searchTermLower || (item.productName && item.productName.toLowerCase().includes(searchTermLower))).map(item => ({
                id: imp.id, date: imp.importDate?.toDate() || new Date(), orderName: imp.orderName, productName: item.productName, quantity: item.quantity, priceCNY: item.priceCNY, exchangeRate: imp.exchangeRate, feePerItem, actualPriceVND: (item.priceCNY * imp.exchangeRate) + feePerItem, originalImport: imp
            }));
        }).sort((a,b) => b.date.getTime() - a.date.getTime());
    }, [imports, activeTab, productHistoryStartDate, productHistoryEndDate, productHistorySearch]);

    const filteredHistory = useMemo(() => {
        if (!Array.isArray(imports)) return [];
        const lowerTerm = historySearchTerm.toLowerCase().trim();
        return imports.filter(imp => {
            const matchesSearch = (imp.orderName && imp.orderName.toLowerCase().includes(lowerTerm)) ||
                (imp.note && imp.note.toLowerCase().includes(lowerTerm)) ||
                (imp.items || []).some(item => item.productName && item.productName.toLowerCase().includes(lowerTerm)) ||
                imp.id.toLowerCase().includes(lowerTerm);
            
            const matchesStatus = statusFilter === 'all' || imp.status === statusFilter;
            
            return matchesSearch && matchesStatus;
        });
    }, [imports, historySearchTerm, statusFilter]);

    const paginatedHistory = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredHistory.slice(startIndex, startIndex + pageSize);
    }, [filteredHistory, currentPage, pageSize]);

    const handleSelectProduct = (product: Product) => {
        setSelectedProductId(product.id);
        setSearchTerm(product.name);
        setIsDropdownOpen(false);
    };

    const handleEditItemInList = (index: number) => {
        const item = cart[index];
        setSelectedProductId(item.productId);
        setSearchTerm(item.productName);
        setQuantity(item.quantity);
        setPriceCNY(item.priceCNY);
        setEditingListIndex(index);
    };

    const handleRemoveItem = (index: number) => {
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
        if (editingListIndex === index) setEditingListIndex(null);
    };

    const handleAddOrUpdateItem = () => {
        const qtyNum = Number(quantity); 
        const priceNum = Number(priceCNY);
        if (!selectedProductId || isNaN(qtyNum) || qtyNum <= 0 || isNaN(priceNum) || priceNum <= 0) {
            alert("Vui lòng chọn sản phẩm và nhập số lượng/giá hợp lệ.");
            return;
        }
        const product = products.find(p => p.id === selectedProductId); 
        if (!product) return;
        const newItem = { productId: product.id, productName: product.name, quantity: qtyNum, priceCNY: priceNum, totalCNY: qtyNum * priceNum };
        if (editingListIndex !== null) { 
            const uc = [...cart]; 
            uc[editingListIndex] = newItem; 
            setCart(uc); 
            setEditingListIndex(null); 
        } else {
            setCart([...cart, newItem]);
        }
        setSelectedProductId(''); setSearchTerm(''); setQuantity(1); setPriceCNY(0);
    };

    const handleSave = async () => {
        if (cart.length === 0) return alert("Chưa có SP nào.");
        setIsProcessing(true);
        try {
            await addDoc(collection(db, 'chinaImports'), { 
                orderName, 
                importDate: serverTimestamp(), 
                items: cart, 
                exchangeRate: parsedExchangeRate, 
                shippingFeeCN: parsedShippingFeeCN, 
                shippingFeeVN: parseNumber(shippingFeeVN), 
                shippingFeeExtra: parseNumber(shippingFeeExtra), 
                currencyExchangeFee: parseNumber(currencyExchangeFee), 
                totalCostCNY: totalProductCNY + parsedShippingFeeCN, 
                totalCostVND: finalTotalVND, 
                note, 
                status: 'ordered',
                createdAt: serverTimestamp() 
            });
            setCart([]); setOrderName(''); setNote(''); setShippingFeeCN('0'); setShippingFeeVN('0'); setShippingFeeExtra('0'); setCurrencyExchangeFee('0'); setActiveTab('history');
        } catch (e) { alert("Lỗi khi lưu đơn."); } finally { setIsProcessing(false); }
    };

    return (
        <div className="h-full flex flex-col">
            {isProductModalOpen && <ProductModal product={null} manufacturers={manufacturers} allProductsForCombo={products} onClose={() => setIsProductModalOpen(false)} onSave={async (d) => { const r = await addDoc(collection(db, 'products'), { ...d, createdAt: serverTimestamp() }); setSelectedProductId(r.id); setSearchTerm(d.name); setIsProductModalOpen(false); }} existingNames={products.map(p => p.name)}/>}
            {editingImport && <EditImportModal importData={editingImport} products={products} onClose={() => setEditingImport(null)} onSave={async (id, d) => { await updateDoc(doc(db, 'chinaImports', id), d); setEditingImport(null); }} onDelete={async (id) => { await deleteDoc(doc(db, 'chinaImports', id)); setEditingImport(null); }}/>}
            {viewingImport && <ChinaImportDetailModal importData={viewingImport} onClose={() => setViewingImport(null)}/>}

            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 flex-shrink-0">
                <h1 className="text-2xl font-bold text-dark flex items-center uppercase tracking-tighter"><Plane className="mr-2 text-red-600" /> Nhập Hàng Trung Quốc</h1>
                <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg overflow-x-auto">
                    <button onClick={() => setActiveTab('create')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'create' ? 'bg-white text-red-600 shadow' : 'text-neutral'}`}><Calculator size={16} className="inline-block mr-2" /> Tạo Đơn</button>
                    <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-white text-red-600 shadow' : 'text-neutral'}`}><History size={16} className="inline-block mr-2" /> Lịch Sử</button>
                    <button onClick={() => setActiveTab('products')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'products' ? 'bg-white text-red-600 shadow' : 'text-neutral'}`}><ListFilter size={16} className="inline-block mr-2" /> Chi Tiết SP</button>
                </div>
            </div>

            {indexErrorUrl && (
                <div className="bg-red-50 border-2 border-red-600 p-4 rounded-xl flex items-start shadow-lg animate-bounce mb-6">
                    <AlertTriangle className="text-red-600 mr-3 flex-shrink-0" size={24}/>
                    <div className="flex-1">
                        <p className="text-xs font-black text-red-700 uppercase mb-1">CẦN CẤU HÌNH DỮ LIỆU NHẬP HÀNG TQ</p>
                        <p className="text-xs font-bold text-red-600 mb-2">Tính năng xem lịch sử đang bị gián đoạn do thiếu chỉ mục (Index) trên Firestore.</p>
                        <a href={indexErrorUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-red-700 transition">Bấm vào đây để kích hoạt ngay <ExternalLink className="ml-1.5" size={12}/></a>
                    </div>
                </div>
            )}

            {activeTab === 'create' && (
                <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-y-auto pb-20">
                    <div className="lg:w-2/3 flex flex-col bg-white rounded-xl shadow-md h-fit">
                        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold flex items-center text-black uppercase text-sm tracking-tight">{editingListIndex !== null ? <Edit size={18} className="mr-2 text-orange-600"/> : <Plus size={18} className="mr-2 text-blue-600"/>} {editingListIndex !== null ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                                <label className="block text-[10px] font-black uppercase text-red-600 mb-1">Tên đơn hàng (Gợi nhớ)</label>
                                <input type="text" value={orderName} onChange={e => setOrderName(e.target.value)} placeholder="đặt tên gợi nhớ cho đơn hàng" className="w-full px-3 py-2 border-slate-300 rounded-lg font-bold outline-none focus:ring-2 focus:ring-red-500 text-black bg-white"/>
                            </div>
                            <div className="flex gap-2 items-center">
                                <div className="flex-1 relative" ref={dropdownRef}>
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                    <input type="text" placeholder="Tìm sản phẩm..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setIsDropdownOpen(true); }} onFocus={() => setIsDropdownOpen(true)} className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white font-medium"/>
                                    {isDropdownOpen && searchTerm && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">
                                            {filteredProducts.map(p => <button key={p.id} onClick={() => handleSelectProduct(p)} className="w-full text-left px-4 py-2 hover:bg-slate-100 text-sm border-b border-slate-100 text-black font-medium">{p.name}</button>)}
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => setIsProductModalOpen(true)} className="p-2.5 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition active:scale-95"><PlusCircle size={20}/></button>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Số lượng</label><input type="number" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-black bg-white font-black text-center"/></div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Giá nhập (¥)</label>
                                    <input type="number" value={priceCNY} onChange={e => setPriceCNY(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-black bg-white font-black text-right"/>
                                    {selectedProductId && lastImportPrice !== null && (
                                        <div className="mt-1 text-[10px] font-bold text-right">
                                            <span className="text-slate-500">Lần trước: {formatNumber(lastImportPrice)}¥</span>
                                            {Number(priceCNY) > 0 && (
                                                <span className={`ml-1 ${Number(priceCNY) > lastImportPrice ? 'text-red-600' : Number(priceCNY) < lastImportPrice ? 'text-green-600' : 'text-slate-500'}`}>
                                                    {Number(priceCNY) > lastImportPrice ? `(Mắc hơn ${formatNumber(Number(priceCNY) - lastImportPrice)}¥)` : Number(priceCNY) < lastImportPrice ? `(Rẻ hơn ${formatNumber(lastImportPrice - Number(priceCNY))}¥)` : '(Bằng giá)'}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-end"><button onClick={handleAddOrUpdateItem} className={`w-full py-2.5 text-white rounded-lg font-black text-xs uppercase shadow-md transition active:scale-95 ${editingListIndex !== null ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>{editingListIndex !== null ? 'Cập nhật' : 'Thêm SP'}</button></div>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-slate-50">
                            {cart.length > 0 ? (
                                <table className="w-full text-sm text-left">
                                    <thead className="text-[10px] font-black text-slate-400 uppercase border-b border-slate-200"><tr><th className="pb-2">Sản phẩm</th><th className="pb-2 text-center">SL</th><th className="pb-2 text-right">Giá (¥)</th><th className="pb-2 text-right">Thành tiền (¥)</th><th className="pb-2 text-center w-20">Thao tác</th></tr></thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {cart.map((item, index) => (
                                            <tr key={index} className={`hover:bg-white text-black transition-colors ${editingListIndex === index ? 'bg-orange-50 border-l-4 border-orange-400' : ''}`}>
                                                <td className="py-2.5 pr-2 font-bold">{item.productName}</td><td className="py-2.5 text-center text-blue-600 font-black">{item.quantity}</td><td className="py-2.5 text-right font-medium">{formatNumber(item.priceCNY)}</td><td className="py-2.5 text-right font-black text-red-600">{formatNumber(item.totalCNY)}</td>
                                                <td className="py-2.5 text-center"><div className="flex justify-center space-x-1"><button onClick={() => handleEditItemInList(index)} className="text-blue-600 hover:bg-blue-100 p-1.5 rounded-lg border border-blue-100 shadow-sm transition"><Edit size={14}/></button><button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:bg-red-100 p-1.5 rounded-lg border border-red-100 shadow-sm transition"><Trash2 size={14}/></button></div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : <p className="text-center text-slate-400 py-10 italic font-medium uppercase text-[10px] tracking-widest">Chưa có sản phẩm nào được thêm</p>}
                        </div>
                    </div>
                    <div className="lg:w-1/3 bg-white rounded-xl shadow-md p-6 h-fit sticky top-0 border border-slate-200">
                        <h3 className="font-black text-dark text-base uppercase mb-4 flex items-center tracking-tight"><DollarSign className="mr-2 text-green-600"/> Chi phí & Tỷ giá</h3>
                        <div className="space-y-4 mb-6">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Tỷ giá</label>
                                    <input type="text" inputMode="numeric" value={formatNumber(exchangeRate)} onChange={e => setExchangeRate(String(parseNumber(e.target.value)))} className="w-full p-2 border border-slate-300 rounded-lg text-right font-black text-sm text-blue-700 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none shadow-inner"/>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Ship N.Địa (¥)</label>
                                    <input type="text" inputMode="numeric" value={formatNumber(shippingFeeCN)} onChange={e => setShippingFeeCN(String(parseNumber(e.target.value)))} className="w-full p-2 border border-slate-300 rounded-lg text-right font-bold text-sm text-black bg-white outline-none"/>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Ship VN (₫)</label>
                                    <input type="text" inputMode="numeric" value={formatNumber(shippingFeeVN)} onChange={e => setShippingFeeVN(String(parseNumber(e.target.value)))} className="w-full p-2 border border-slate-300 rounded-lg text-right font-bold text-sm text-black bg-white outline-none"/>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 block mb-1">Phí khác (₫)</label>
                                    <input type="text" inputMode="numeric" value={formatNumber(shippingFeeExtra)} onChange={e => setShippingFeeExtra(String(parseNumber(e.target.value)))} className="w-full p-2 border border-slate-300 rounded-lg text-right font-bold text-sm text-black bg-white outline-none"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 block mb-1">Phí đổi tiền (₫)</label>
                                    <input type="text" inputMode="numeric" value={formatNumber(currencyExchangeFee)} onChange={e => setCurrencyExchangeFee(String(parseNumber(e.target.value)))} className="w-full p-2 border border-slate-300 rounded-lg text-right font-bold text-sm text-black bg-white outline-none"/>
                                </div>
                            </div>
                            <div><label className="block text-[10px] font-black uppercase text-slate-500 block mb-1">Ghi chú vận đơn</label><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-black bg-white shadow-sm" placeholder="Mã vận đơn, kho nhận..."></textarea></div>
                        </div>
                        <div className="mt-auto border-t border-slate-100 pt-4">
                            <div className="flex justify-between items-end mb-1"><span className="text-[10px] font-black uppercase text-slate-500">Tổng Tệ (¥):</span><span className="text-xl font-black text-red-600">{formatNumber(totalProductCNY + parsedShippingFeeCN)} ¥</span></div>
                            <div className="flex justify-between items-end mb-4"><span className="text-[10px] font-black uppercase text-slate-500">Tổng VNĐ:</span><span className="text-2xl font-black text-green-700">{formatNumber(finalTotalVND)} ₫</span></div>
                            <button onClick={handleSave} disabled={isProcessing} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black shadow-lg flex items-center justify-center uppercase transition active:scale-95 disabled:bg-slate-300 text-sm tracking-widest">{isProcessing ? <Loader className="animate-spin mr-2"/> : <Save className="mr-2" size={20}/>} Lưu Phiếu Nhập</button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="bg-white rounded-xl shadow-md flex flex-col flex-1 overflow-hidden border border-slate-200">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-4 items-center">
                        <div className="relative max-w-md flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                            <input type="text" placeholder="Tìm tên SP, tên đơn, ghi chú..." value={historySearchTerm} onChange={e => setHistorySearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 text-black font-medium rounded-lg outline-none focus:ring-2 focus:ring-blue-500"/>
                        </div>
                        <div className="flex items-center gap-2">
                            <ListFilter size={18} className="text-slate-400" />
                            <select 
                                value={statusFilter} 
                                onChange={e => setStatusFilter(e.target.value as any)}
                                className="px-3 py-2 bg-white border border-slate-300 text-black font-bold text-xs uppercase rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">Tất cả trạng thái</option>
                                {Object.entries(STATUS_CONFIG).map(([key, value]) => (
                                    <option key={key} value={key}>{value.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto"><div className="overflow-x-auto w-full">
                        <table className="w-full text-left min-w-[1000px]">
                            <thead className="bg-slate-100 border-b border-slate-200 sticky top-0"><tr className="text-[10px] uppercase text-slate-500 font-black"><th className="p-4">Ngày Nhập</th><th className="p-4">Tên Đơn / Sản Phẩm</th><th className="p-4 text-center">SL</th><th className="p-4 text-right text-red-600">Tổng Tệ (¥)</th><th className="p-4 text-right text-green-700">Tổng VND</th><th className="p-4 text-center">Trạng thái</th><th className="p-4 text-center">Thao tác</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedHistory.map(item => {
                                    const items = Array.isArray(item.items) ? item.items : [];
                                    return (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-sm font-bold text-slate-600 whitespace-nowrap">{item.importDate?.toDate().toLocaleDateString('vi-VN')}</td>
                                        <td className="p-4"><div className="font-black text-black uppercase mb-0.5 tracking-tight">{item.orderName || 'Đơn không tên'}</div><div className="text-[10px] text-slate-500 italic font-medium">Gồm {items.length} SP...</div></td>
                                        <td className="p-4 text-center text-blue-600 font-black">{items.reduce((a, b) => a + b.quantity, 0)}</td>
                                        <td className="p-4 text-right font-black text-red-600 text-base">{formatNumber(item.totalCostCNY)} ¥</td>
                                        <td className="p-4 text-right font-black text-green-700 text-base">{formatNumber(item.totalCostVND)} ₫</td>
                                        <td className="p-4 text-center">
                                            <StatusBadge status={item.status} />
                                        </td>
                                        <td className="p-4 text-center"><div className="flex justify-center space-x-2"><button onClick={() => setViewingImport(item)} className="p-2 text-green-600 bg-green-50 hover:bg-green-600 hover:text-white rounded-full transition shadow-sm border border-green-100"><Eye size={18}/></button><button onClick={() => setEditingImport(item)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-full transition shadow-sm border border-blue-100"><Edit size={18}/></button></div></td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div></div>
                    <Pagination currentPage={currentPage} pageSize={pageSize} totalItems={filteredHistory.length} onPageChange={setCurrentPage} onPageSizeChange={() => {}}/>
                </div>
            )}

            {activeTab === 'products' && (
                <div className="flex flex-col h-full bg-white rounded-xl shadow-md overflow-hidden border border-slate-200">
                    <div className="p-4 border-b border-slate-100 bg-slate-50"><div className="flex flex-col md:flex-row gap-4 flex-1 w-full"><div className="flex flex-col"><label className="text-[10px] font-black uppercase text-slate-500 mb-1">Từ ngày</label><input type="date" value={productHistoryStartDate} onChange={e => setProductHistoryStartDate(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-black font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500"/></div><div className="flex flex-col"><label className="text-[10px] font-black uppercase text-slate-500 mb-1">Đến ngày</label><input type="date" value={productHistoryEndDate} onChange={e => setProductHistoryEndDate(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-black font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500"/></div><div className="flex flex-col flex-1"><label className="text-[10px] font-black uppercase text-slate-500 mb-1">Tìm SP</label><div className="relative w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input type="text" placeholder="Nhập tên SP cần xem lịch sử giá..." value={productHistorySearch} onChange={e => setProductHistorySearch(e.target.value)} className="w-full pl-10 pr-4 py-1.5 border border-slate-300 rounded-lg text-sm text-black font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500"/></div></div></div></div>
                    <div className="flex-1 overflow-auto"><div className="overflow-x-auto"><table className="w-full text-left text-sm min-w-[900px]">
                        <thead className="bg-slate-100 sticky top-0 shadow-sm font-black uppercase text-[10px] text-slate-500 border-b border-slate-200"><tr><th className="p-3">Ngày Nhập</th><th className="p-3">Tên Đơn</th><th className="p-3">Sản phẩm</th><th className="p-3 text-center">SL</th><th className="p-3 text-right">Giá Tệ</th><th className="p-3 text-right bg-green-50 text-green-900 font-black">Giá Vốn Thực (₫)</th><th className="p-3 text-center">Đơn Gốc</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {flattenedProductHistory.map((item, idx) => (
                                <tr key={`${item.id}-${idx}`} className="hover:bg-blue-50 transition-colors group">
                                    <td className="p-3 text-slate-600 font-bold">{item.date.toLocaleDateString('vi-VN')}</td>
                                    <td className="p-3"><span className="px-2 py-0.5 bg-slate-100 text-black rounded text-[10px] font-black border border-slate-200 uppercase tracking-tighter">{item.orderName || '...'}</span></td>
                                    <td className="p-3 font-bold text-dark">{item.productName}</td>
                                    <td className="p-3 text-center text-blue-600 font-black">{item.quantity}</td>
                                    <td className="p-3 text-right text-black font-medium">{formatNumber(item.priceCNY)}</td>
                                    <td className="p-3 text-right font-black text-green-700 bg-green-50/30 text-base">{formatNumber(Math.round(item.actualPriceVND))}</td>
                                    <td className="p-3 text-center"><button onClick={() => setViewingImport(item.originalImport)} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-blue-600 shadow-sm transition"><Eye size={16} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table></div></div>
                </div>
            )}
        </div>
    );
};

export default ChinaImportManagement;
