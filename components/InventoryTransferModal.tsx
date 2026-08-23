import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, Warehouse } from '../types';
import { X, GitCommit, ArrowRightLeft, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { formatNumber } from '../utils/formatting';

interface InventoryTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransfer: (details: { productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number; }) => void;
  products: Product[];
  warehouses: Warehouse[];
  inventoryData: { [productId: string]: { [warehouseId: string]: number } };
  initialData?: { productId: string; fromWarehouseId?: string; toWarehouseId?: string; } | null;
}

const InventoryTransferModal: React.FC<InventoryTransferModalProps> = ({ 
  isOpen, 
  onClose, 
  onTransfer, 
  products, 
  warehouses, 
  inventoryData, 
  initialData 
}) => {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');

  // Ref to track if modal just transitioned to open, preventing re-render resets
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    // Only initialize when modal opens (false -> true)
    if (isOpen && !prevIsOpenRef.current) {
      if (initialData) {
        const pId = initialData.productId || '';
        setSelectedProductId(pId);

        const productStock = inventoryData[pId] || {};
        const whsWithStock = warehouses.filter(w => (productStock[w.id] || 0) > 0);

        let initialFrom = initialData.fromWarehouseId || '';
        let initialTo = initialData.toWarehouseId || '';

        // If both provided and different, keep both
        if (initialFrom && initialTo && initialFrom !== initialTo) {
          // Keep as is
        } else if (initialTo && !initialFrom) {
          // Target is specified (e.g. Ngoài CH)
          // Find source: prefer Trong CH or warehouse with stock other than initialTo
          const trongWh = warehouses.find(w => (w.name.toLowerCase().includes('trong ch') || w.name.toLowerCase().includes('trong kho') || w.name.toLowerCase().includes('trong')) && w.id !== initialTo);
          const stockWh = whsWithStock.find(w => w.id !== initialTo);
          const otherWh = warehouses.find(w => w.id !== initialTo);
          initialFrom = trongWh ? trongWh.id : (stockWh ? stockWh.id : (otherWh ? otherWh.id : ''));
        } else if (initialFrom && !initialTo) {
          // Source is specified
          const ngoaiWh = warehouses.find(w => (w.name.toLowerCase().includes('ngoài ch') || w.name.toLowerCase().includes('ngoài cửa hàng') || w.name.toLowerCase().includes('ngoài')) && w.id !== initialFrom);
          const otherWh = warehouses.find(w => w.id !== initialFrom);
          initialTo = ngoaiWh ? ngoaiWh.id : (otherWh ? otherWh.id : '');
        } else {
          // Neither or both identical
          const trongWh = warehouses.find(w => w.name.toLowerCase().includes('trong ch') || w.name.toLowerCase().includes('trong kho') || w.name.toLowerCase().includes('trong'));
          const ngoaiWh = warehouses.find(w => w.name.toLowerCase().includes('ngoài ch') || w.name.toLowerCase().includes('ngoài cửa hàng') || w.name.toLowerCase().includes('ngoài'));
          
          if (trongWh && ngoaiWh && trongWh.id !== ngoaiWh.id) {
            initialFrom = trongWh.id;
            initialTo = ngoaiWh.id;
          } else if (warehouses.length >= 2) {
            initialFrom = warehouses[0].id;
            initialTo = warehouses[1].id;
          } else if (warehouses.length === 1) {
            initialFrom = warehouses[0].id;
            initialTo = warehouses[0].id;
          }
        }

        setFromWarehouseId(initialFrom);
        setToWarehouseId(initialTo);
      } else {
        setSelectedProductId('');
        setFromWarehouseId('');
        setToWarehouseId('');
      }
      setQuantity(1);
      setError('');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialData, warehouses, inventoryData]);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const availableStockFrom = useMemo(() => {
    if (selectedProductId && fromWarehouseId) {
      return inventoryData[selectedProductId]?.[fromWarehouseId] ?? 0;
    }
    return 0;
  }, [selectedProductId, fromWarehouseId, inventoryData]);

  const currentStockTo = useMemo(() => {
    if (selectedProductId && toWarehouseId) {
      return inventoryData[selectedProductId]?.[toWarehouseId] ?? 0;
    }
    return 0;
  }, [selectedProductId, toWarehouseId, inventoryData]);

  const handleFromWarehouseChange = (newFromId: string) => {
    setFromWarehouseId(newFromId);
    setError('');
    if (newFromId === toWarehouseId) {
      // Pick another warehouse for destination
      const otherWh = warehouses.find(w => w.id !== newFromId);
      setToWarehouseId(otherWh ? otherWh.id : '');
    }
  };

  const handleToWarehouseChange = (newToId: string) => {
    setToWarehouseId(newToId);
    setError('');
    if (newToId === fromWarehouseId) {
      // Pick another warehouse for source
      const otherWh = warehouses.find(w => w.id !== newToId);
      setFromWarehouseId(otherWh ? otherWh.id : '');
    }
  };

  const handleSwapWarehouses = () => {
    const temp = fromWarehouseId;
    setFromWarehouseId(toWarehouseId);
    setToWarehouseId(temp);
    setError('');
  };

  const handleQuantityChange = (newQuantity: number) => {
    setQuantity(newQuantity);
    if (newQuantity > availableStockFrom) {
      setError(`Số lượng chuyển (${newQuantity}) vượt quá tồn kho khả dụng tại nguồn (${availableStockFrom}).`);
    } else {
      setError('');
    }
  };

  const handleSetMaxQuantity = () => {
    if (availableStockFrom > 0) {
      setQuantity(availableStockFrom);
      setError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedProductId || !fromWarehouseId || !toWarehouseId || quantity <= 0) {
      setError('Vui lòng điền đầy đủ thông tin kho nguồn, kho đích và số lượng.');
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      setError('Kho nguồn và kho đích không được trùng nhau.');
      return;
    }
    if (quantity > availableStockFrom) {
      setError(`Kho nguồn không đủ hàng (Hiện có: ${availableStockFrom}, Cần chuyển: ${quantity}).`);
      return;
    }

    onTransfer({
      productId: selectedProductId,
      fromWarehouseId,
      toWarehouseId,
      quantity
    });
  };

  if (!isOpen) return null;

  const inputClasses = "w-full px-3 py-2.5 bg-slate-50 text-black border-2 border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm transition";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border-4 border-slate-800 animate-fade-in-down flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-orange-500 text-white p-4 flex justify-between items-center shrink-0">
          <h2 className="text-base font-black uppercase tracking-tight flex items-center">
            <GitCommit className="mr-2" size={20} />
            Chuyển kho sản phẩm
          </h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg text-white hover:bg-orange-600 transition"
            title="Đóng"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Product name card */}
          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Sản phẩm cần chuyển</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-black text-slate-900 uppercase">{selectedProduct?.name || 'Sản phẩm'}</span>
              {selectedProduct?.shortName && (
                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-black rounded border border-amber-300 inline-block">
                  {selectedProduct.shortName}
                </span>
              )}
            </div>
          </div>

          {/* Warehouses selector with Swap button */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] gap-2 items-center">
              {/* FROM WAREHOUSE */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                  Từ kho (Nguồn)
                </label>
                <select 
                  value={fromWarehouseId} 
                  onChange={e => handleFromWarehouseChange(e.target.value)} 
                  className={inputClasses}
                  required
                >
                  <option value="" disabled>-- Chọn kho xuất --</option>
                  {warehouses.map(w => {
                    const stock = inventoryData[selectedProductId]?.[w.id] ?? 0;
                    return (
                      <option key={w.id} value={w.id}>
                        {w.name} (Tồn: {stock})
                      </option>
                    );
                  })}
                </select>
                <div className="mt-1 text-right">
                  <span className="text-[11px] font-bold text-slate-500">
                    Tồn nguồn: <strong className={availableStockFrom > 0 ? "text-emerald-600 font-black" : "text-red-600 font-black"}>{availableStockFrom}</strong>
                  </span>
                </div>
              </div>

              {/* Swap Button */}
              <div className="flex justify-center pt-2 sm:pt-4">
                <button
                  type="button"
                  onClick={handleSwapWarehouses}
                  className="p-2.5 bg-slate-200 hover:bg-orange-500 hover:text-white text-slate-700 rounded-xl transition shadow-sm active:scale-95 flex items-center justify-center"
                  title="Đổi chiều chuyển kho"
                >
                  <ArrowRightLeft size={18} />
                </button>
              </div>

              {/* TO WAREHOUSE */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                  Đến kho (Đích)
                </label>
                <select 
                  value={toWarehouseId} 
                  onChange={e => handleToWarehouseChange(e.target.value)} 
                  className={inputClasses}
                  required
                >
                  <option value="" disabled>-- Chọn kho nhận --</option>
                  {warehouses.map(w => {
                    const stock = inventoryData[selectedProductId]?.[w.id] ?? 0;
                    return (
                      <option key={w.id} value={w.id}>
                        {w.name} (Hiện có: {stock})
                      </option>
                    );
                  })}
                </select>
                <div className="mt-1 text-right">
                  <span className="text-[11px] font-bold text-slate-500">
                    Hiện có: <strong className="text-blue-600 font-black">{currentStockTo}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quantity to transfer */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-black uppercase text-slate-600">
                Số lượng chuyển
              </label>
              {availableStockFrom > 0 && (
                <button
                  type="button"
                  onClick={handleSetMaxQuantity}
                  className="text-[10px] font-black uppercase text-orange-600 hover:underline"
                >
                  Chuyển tối đa ({availableStockFrom})
                </button>
              )}
            </div>
            <div className="relative">
              <input 
                type="number" 
                value={quantity === 0 ? '' : quantity}
                onChange={e => handleQuantityChange(e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0))}
                onFocus={e => e.target.select()}
                className="w-full px-4 py-3 bg-slate-900 text-white font-black text-xl text-center rounded-xl border-2 border-slate-800 focus:border-orange-500 outline-none shadow-inner"
                min="1"
                max={availableStockFrom || undefined}
                required 
              />
            </div>
          </div>

          {/* Stock Simulation Preview */}
          {fromWarehouseId && toWarehouseId && fromWarehouseId !== toWarehouseId && (
            <div className="bg-slate-50 p-3 rounded-xl border-2 border-slate-200 text-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-2">Xem trước biến động tồn kho:</span>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 block truncate">{warehouses.find(w => w.id === fromWarehouseId)?.name || 'Kho nguồn'}</span>
                  <div className="flex items-center justify-center gap-1.5 mt-1 font-black text-sm">
                    <span className="text-slate-600">{availableStockFrom}</span>
                    <ArrowRight size={14} className="text-red-500" />
                    <span className={availableStockFrom - quantity < 0 ? "text-red-600 font-bold" : "text-emerald-700"}>
                      {availableStockFrom - quantity}
                    </span>
                  </div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 block truncate">{warehouses.find(w => w.id === toWarehouseId)?.name || 'Kho đích'}</span>
                  <div className="flex items-center justify-center gap-1.5 mt-1 font-black text-sm">
                    <span className="text-slate-600">{currentStockTo}</span>
                    <ArrowRight size={14} className="text-green-500" />
                    <span className="text-blue-700">{currentStockTo + quantity}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border-2 border-red-500 rounded-xl text-red-700 text-xs flex items-start gap-2 animate-shake">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span className="font-bold">{error}</span>
            </div>
          )}
        </form>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3 shrink-0">
          <button 
            type="button" 
            onClick={onClose} 
            className="flex-1 py-3 bg-white border-2 border-slate-800 text-black rounded-xl font-black text-xs uppercase hover:bg-slate-100 transition active:scale-95"
          >
            Hủy
          </button>
          <button 
            type="button" 
            onClick={handleSubmit} 
            disabled={!selectedProductId || !fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId || quantity <= 0 || quantity > availableStockFrom}
            className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-xs uppercase shadow-lg transition active:scale-95 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center"
          >
            <CheckCircle2 size={18} className="mr-1.5" />
            Xác nhận chuyển
          </button>
        </div>
      </div>
    </div>
  );
};

export default InventoryTransferModal;
