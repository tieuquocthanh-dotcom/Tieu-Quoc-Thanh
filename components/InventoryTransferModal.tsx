import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import { Product, Warehouse } from '../types';

interface InventoryTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransfer: (details: { productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number }) => void;
  products: Product[];
  warehouses: Warehouse[];
  inventoryData: { [productId: string]: { [warehouseId: string]: number } };
  initialData?: { productId: string; fromWarehouseId: string } | null;
}

const InventoryTransferModal: React.FC<InventoryTransferModalProps> = ({ isOpen, onClose, onTransfer, products, warehouses, inventoryData, initialData }) => {
  const [productId, setProductId] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (isOpen && initialData) {
      setProductId(initialData.productId);
      setFromWarehouseId(initialData.fromWarehouseId);
    } else if (isOpen) {
      setProductId('');
      setFromWarehouseId('');
      setToWarehouseId('');
      setQuantity(1);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const maxQuantity = (productId && fromWarehouseId) ? (inventoryData[productId]?.[fromWarehouseId] || 0) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (productId && fromWarehouseId && toWarehouseId && quantity > 0 && quantity <= maxQuantity) {
      onTransfer({ productId, fromWarehouseId, toWarehouseId, quantity });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border-4 border-slate-800 overflow-hidden animate-fade-in-down">
        <div className="bg-amber-500 p-4 text-white flex justify-between items-center">
          <h3 className="font-black uppercase text-sm flex items-center"><ArrowRightLeft className="mr-2" size={20}/> Chuyển kho</h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Sản phẩm</label>
            <select value={productId} onChange={e => setProductId(e.target.value)} required className="w-full p-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-amber-500">
              <option value="">-- Chọn sản phẩm --</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Từ kho</label>
              <select value={fromWarehouseId} onChange={e => setFromWarehouseId(e.target.value)} required className="w-full p-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-amber-500">
                <option value="">-- Chọn kho --</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Đến kho</label>
              <select value={toWarehouseId} onChange={e => setToWarehouseId(e.target.value)} required className="w-full p-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-amber-500">
                <option value="">-- Chọn kho --</option>
                {warehouses.map(w => <option key={w.id} value={w.id} disabled={w.id === fromWarehouseId}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Số lượng (Tối đa: {maxQuantity})</label>
            <input 
              type="number" 
              value={quantity} 
              onChange={e => setQuantity(Number(e.target.value))} 
              min="1" 
              max={maxQuantity} 
              required 
              className="w-full p-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div className="pt-4 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-white border-2 border-slate-800 rounded-xl font-black text-xs uppercase text-black transition hover:bg-slate-100">Hủy</button>
            <button type="submit" disabled={!productId || !fromWarehouseId || !toWarehouseId || quantity <= 0 || quantity > maxQuantity} className="flex-1 py-2 bg-amber-500 text-white rounded-xl font-black text-xs uppercase shadow-lg transition active:scale-95 disabled:bg-slate-300 hover:bg-amber-600">Chuyển</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryTransferModal;
