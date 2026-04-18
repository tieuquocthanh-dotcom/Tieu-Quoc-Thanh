
import React, { useState, useEffect, useMemo } from 'react';
import { Product, Warehouse } from '../types';
import { X, GitCommit } from 'lucide-react';

interface InventoryTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransfer: (details: { productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number; }) => void;
  products: Product[];
  warehouses: Warehouse[];
  inventoryData: { [productId: string]: { [warehouseId: string]: number } };
  initialData?: { productId: string; fromWarehouseId?: string; toWarehouseId?: string; } | null;
}

const InventoryTransferModal: React.FC<InventoryTransferModalProps> = ({ isOpen, onClose, onTransfer, products, warehouses, inventoryData, initialData }) => {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [availableStock, setAvailableStock] = useState(0);
  const [error, setError] = useState('');

  const inputClasses = "w-full px-3 py-2 bg-slate-100 text-dark border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none placeholder-slate-400";

  useEffect(() => {
    if (isOpen) {
        setTimeout(() => {
            if (initialData) {
                setSelectedProductId(initialData.productId);
                // Thiết lập giá trị mặc định nhưng cho phép thay đổi (không khóa UI)
                setFromWarehouseId(initialData.fromWarehouseId || '');
                setToWarehouseId(initialData.toWarehouseId || '');
            } else {
                setSelectedProductId('');
                setFromWarehouseId('');
                setToWarehouseId('');
            }
            setQuantity(1);
            setError('');
        }, 0);
    }
  }, [initialData, isOpen]);


  useEffect(() => {
    setTimeout(() => {
      if (selectedProductId && fromWarehouseId) {
        const stock = inventoryData[selectedProductId]?.[fromWarehouseId] ?? 0;
        setAvailableStock(stock);
      } else {
        setAvailableStock(0);
      }
    }, 0);
  }, [selectedProductId, fromWarehouseId, inventoryData]);

  const handleQuantityChange = (newQuantity: number) => {
    setQuantity(newQuantity);
    if (newQuantity > availableStock) {
        setError(`Số lượng chuyển vượt quá tồn kho khả dụng (${availableStock}).`);
    } else {
        if (error.startsWith('Số lượng chuyển vượt quá')) {
            setError('');
        }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedProductId || !fromWarehouseId || !toWarehouseId || quantity <= 0) {
      setError('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      setError('Kho nguồn và kho đích không được trùng nhau.');
      return;
    }
    if (quantity > availableStock) {
      setError('Số lượng chuyển vượt quá tồn kho khả dụng.');
      return;
    }

    onTransfer({
      productId: selectedProductId,
      fromWarehouseId,
      toWarehouseId,
      quantity
    });
  };

  // Logic lọc kho nguồn: Phải có tồn kho > 0 VÀ không trùng kho đích (nếu đã chọn)
  // Lưu ý: Nếu kho đang được chọn làm mặc định (fromWarehouseId) thì vẫn hiển thị kể cả khi chưa check tồn (để tránh lỗi UI), nhưng validation sẽ chặn sau.
  const fromWarehouses = useMemo(() => {
    if (!selectedProductId) return [];
    return warehouses.filter(wh => {
        const stock = inventoryData[selectedProductId]?.[wh.id] ?? 0;
        const hasStock = stock > 0 || wh.id === fromWarehouseId; // Cho phép hiện kho đang chọn dù stock có thể = 0 (để user thấy và đổi)
        const isNotDest = wh.id !== toWarehouseId;
        return hasStock && isNotDest;
    });
  }, [selectedProductId, warehouses, inventoryData, toWarehouseId, fromWarehouseId]);

  // Logic lọc kho đích: Không trùng kho nguồn (nếu đã chọn)
  const toWarehouses = useMemo(() => {
    return warehouses.filter(wh => wh.id !== fromWarehouseId);
  }, [fromWarehouseId, warehouses]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg animate-fade-in-down">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-dark flex items-center"><GitCommit className="mr-3 text-primary"/> Chuyển Kho Sản Phẩm</h2>
            <button onClick={onClose} className="p-2 text-neutral hover:bg-slate-100 rounded-full"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-neutral mb-1">Sản phẩm cần chuyển</label>
                    {/* Sản phẩm luôn bị khóa vì context là chuyển SẢN PHẨM ĐÓ */}
                    <select 
                        value={selectedProductId} 
                        onChange={e => setSelectedProductId(e.target.value)} 
                        className={inputClasses} 
                        disabled
                        required
                    >
                        <option value="" disabled>-- Chọn sản phẩm --</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* FROM WAREHOUSE - Always selectable */}
                    <div>
                        <label className="block text-sm font-medium text-neutral mb-1">Từ kho (Nguồn)</label>
                        <select 
                            value={fromWarehouseId} 
                            onChange={e => setFromWarehouseId(e.target.value)} 
                            className={inputClasses} 
                            disabled={!selectedProductId} 
                            required
                        >
                            <option value="" disabled>-- Chọn kho có hàng --</option>
                            {fromWarehouses.map(w => (
                                <option key={w.id} value={w.id}>
                                    {w.name} (Tồn: {inventoryData[selectedProductId]?.[w.id] ?? 0})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* TO WAREHOUSE - Always selectable */}
                    <div>
                        <label className="block text-sm font-medium text-neutral mb-1">Đến kho (Đích)</label>
                        <select 
                            value={toWarehouseId} 
                            onChange={e => setToWarehouseId(e.target.value)} 
                            className={inputClasses} 
                            // Cho phép chọn ngay cả khi chưa chọn kho nguồn (để linh hoạt), logic lọc sẽ xử lý
                            required
                        >
                            <option value="" disabled>-- Chọn kho đích --</option>
                            {toWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-neutral mb-1">Số lượng chuyển</label>
                    <input 
                        type="number" 
                        value={quantity}
                        onChange={e => handleQuantityChange(e.target.value === '' ? 0 : Number(e.target.value))}
                        onFocus={e => e.target.select()}
                        className={inputClasses} 
                        min="1"
                        disabled={!fromWarehouseId}
                        required 
                    />
                    {fromWarehouseId && <p className="text-xs text-neutral mt-1">Tồn kho khả dụng tại nguồn: <span className="font-semibold text-dark">{availableStock}</span></p>}
                </div>
            </div>

            {error && <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          
            <div className="mt-8 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 text-neutral rounded-lg hover:bg-slate-300 transition">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition shadow">Xác nhận chuyển</button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryTransferModal;
