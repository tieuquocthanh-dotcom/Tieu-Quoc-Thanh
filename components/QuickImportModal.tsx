import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, Warehouse, Supplier, PaymentMethod } from '../types';
import { X, DownloadCloud } from 'lucide-react';

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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border-4 border-slate-800 overflow-hidden">
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
                            <input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 0)} className="w-full p-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-primary" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Giá nhập</label>
                            <input type="number" value={importPrice} onChange={e => setImportPrice(parseInt(e.target.value) || 0)} className="w-full p-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-primary" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Trạng thái thanh toán</label>
                            <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as 'paid' | 'debt')} className="w-full p-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-primary">
                                <option value="paid">Đã thanh toán</option>
                                <option value="debt">Nợ</option>
                            </select>
                        </div>
                        {paymentStatus === 'paid' && (
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Phương thức</label>
                                <select value={paymentMethodId} onChange={e => setPaymentMethodId(e.target.value)} className="w-full p-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-primary">
                                    <option value="">-- CHỌN PT --</option>
                                    {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <input type="checkbox" checked={updateBasePrice} onChange={e => setUpdateBasePrice(e.target.checked)} id="updateBasePrice" />
                        <label htmlFor="updateBasePrice" className="text-xs font-bold text-slate-700">Cập nhật giá vốn gốc của sản phẩm</label>
                    </div>

                    <button 
                        onClick={() => onConfirm({ supplierId, warehouseId, quantity, importPrice, paymentStatus, paymentMethodId, updateBasePrice })} 
                        disabled={isProcessing || !supplierId || !warehouseId || quantity <= 0}
                        className="w-full py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 disabled:opacity-50"
                    >
                        {isProcessing ? 'Đang xử lý...' : 'Xác nhận nhập hàng'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickImportModal;
