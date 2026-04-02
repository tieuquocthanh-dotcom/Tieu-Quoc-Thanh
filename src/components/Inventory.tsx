
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, increment, addDoc, serverTimestamp, Timestamp, getDoc, setDoc, collectionGroup } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, Warehouse, InventoryItem } from '../types';
import { Package, Search, Warehouse as WarehouseIcon, ArrowRightLeft, Edit3, AlertTriangle, CheckCircle, Loader, Filter, History, ChevronRight, X } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import { notifyError, notifySuccess } from '../utils/errorHandler';

interface InventoryProps {
  userRole: 'admin' | 'staff' | null;
  user: any;
}

const Inventory: React.FC<InventoryProps> = ({ userRole, user }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [inventory, setInventory] = useState<Map<string, number>>(new Map());
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Modal states
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustNote, setAdjustNote] = useState('');
  
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferQty, setTransferQty] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snapshot) => {
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    const unsubWarehouses = onSnapshot(query(collection(db, 'warehouses'), orderBy('name')), (snapshot) => {
      const ws = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse));
      setWarehouses(ws);
      if (ws.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(ws[0].id);
        setTransferFromId(ws[0].id);
      }
    });

    setLoading(false);
    return () => {
      unsubProducts();
      unsubWarehouses();
    };
  }, []);

  useEffect(() => {
    if (!selectedWarehouseId) return;
    
    const unsubInventory = onSnapshot(collectionGroup(db, 'inventory'), (snapshot) => {
      const invMap = new Map<string, number>();
      snapshot.forEach(doc => {
        const data = doc.data();
        const stockValue = typeof data.stock === 'number' ? data.stock : (typeof data.quantity === 'number' ? data.quantity : 0);
        const pathParts = doc.ref.path.split('/');
        
        // Robust ID extraction
        let warehouseId = '';
        let productId = '';
        
        // Path patterns: 
        // warehouses/{warehouseId}/inventory/{productId}
        // products/{productId}/inventory/{warehouseId}
        if (pathParts.includes('warehouses') && pathParts.includes('inventory')) {
          const wIdx = pathParts.indexOf('warehouses');
          const iIdx = pathParts.indexOf('inventory');
          if (iIdx === wIdx + 2) {
            warehouseId = pathParts[wIdx + 1];
            productId = pathParts[iIdx + 1] || doc.id;
          }
        } else if (pathParts.includes('products') && pathParts.includes('inventory')) {
          const pIdx = pathParts.indexOf('products');
          const iIdx = pathParts.indexOf('inventory');
          if (iIdx === pIdx + 2) {
            productId = pathParts[pIdx + 1];
            warehouseId = pathParts[iIdx + 1] || doc.id;
          }
        }
        
        if (warehouseId === selectedWarehouseId && productId) {
          invMap.set(productId, stockValue);
        }
      });
      setInventory(invMap);
    });

    return () => unsubInventory();
  }, [selectedWarehouseId]);

  const filteredInventory = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase());
      const stock = inventory.get(p.id) || 0;
      const isLow = stock <= p.warningThreshold;
      
      if (filterLowStock) return matchesSearch && isLow;
      return matchesSearch;
    });
  }, [products, inventory, searchTerm, filterLowStock]);

  const handleAdjustStock = async () => {
    if (!selectedProduct || !selectedWarehouseId) return;
    setIsSubmitting(true);
    try {
      const invRef = doc(db, `warehouses/${selectedWarehouseId}/inventory`, selectedProduct.id);
      const currentStock = inventory.get(selectedProduct.id) || 0;
      const newStock = currentStock + adjustQty;

      await setDoc(invRef, { stock: newStock }, { merge: true });

      // Log adjustment
      await addDoc(collection(db, 'inventoryLogs'), {
        type: 'adjustment',
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        warehouseId: selectedWarehouseId,
        warehouseName: warehouses.find(w => w.id === selectedWarehouseId)?.name,
        oldQty: currentStock,
        newQty: newStock,
        delta: adjustQty,
        note: adjustNote,
        createdAt: serverTimestamp(),
        createdBy: user?.uid
      });

      notifySuccess(`Đã điều chỉnh kho cho ${selectedProduct.name}`);
      setShowAdjustModal(false);
      setAdjustQty(0);
      setAdjustNote('');
    } catch (err) {
      notifyError("Lỗi khi điều chỉnh kho");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferStock = async () => {
    if (!selectedProduct || !transferFromId || !transferToId || transferFromId === transferToId) {
      notifyError("Vui lòng chọn kho nguồn và kho đích khác nhau.");
      return;
    }
    
    const currentFromStock = inventory.get(selectedProduct.id) || 0;
    if (transferQty > currentFromStock) {
      notifyError("Số lượng chuyển vượt quá tồn kho hiện tại.");
      return;
    }

    setIsSubmitting(true);
    try {
      const fromRef = doc(db, `warehouses/${transferFromId}/inventory`, selectedProduct.id);
      const toRef = doc(db, `warehouses/${transferToId}/inventory`, selectedProduct.id);

      await updateDoc(fromRef, { stock: increment(-transferQty) });
      
      const toDoc = await getDoc(toRef);
      if (toDoc.exists()) {
        await updateDoc(toRef, { stock: increment(transferQty) });
      } else {
        await setDoc(toRef, { stock: transferQty });
      }

      // Log transfer
      await addDoc(collection(db, 'inventoryLogs'), {
        type: 'transfer',
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        fromWarehouseId: transferFromId,
        fromWarehouseName: warehouses.find(w => w.id === transferFromId)?.name,
        toWarehouseId: transferToId,
        toWarehouseName: warehouses.find(w => w.id === transferToId)?.name,
        quantity: transferQty,
        createdAt: serverTimestamp(),
        createdBy: user?.uid
      });

      notifySuccess("Chuyển kho thành công!");
      setShowTransferModal(false);
      setTransferQty(0);
    } catch (err) {
      notifyError("Lỗi khi chuyển kho");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center uppercase tracking-tight">
            <WarehouseIcon className="mr-3 text-blue-700" size={28} />
            Kiểm Kho
          </h1>
          <p className="text-slate-500 text-sm font-medium">Theo dõi tồn kho & Điều phối hàng hóa hệ thống</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded shadow-sm px-3 py-1.5 min-w-[200px]">
            <WarehouseIcon size={16} className="text-slate-400 mr-2" />
            <select 
              value={selectedWarehouseId} 
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="bg-transparent font-bold text-sm text-slate-700 focus:ring-0 border-none p-0 pr-8 appearance-none w-full outline-none"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => setFilterLowStock(!filterLowStock)}
            className={`px-4 py-2 rounded font-bold text-xs flex items-center transition-all border ${filterLowStock ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-red-600 hover:text-red-600'}`}
          >
            <AlertTriangle size={14} className="mr-2" />
            SẮP HẾT HÀNG
          </button>
        </div>
      </div>

      {/* Search & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Tìm sản phẩm trong kho..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-traditional pl-10"
          />
        </div>
        
        <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-center">
          <div className="p-2 bg-blue-50 text-blue-600 rounded mr-3">
            <Package size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mặt hàng</p>
            <p className="text-lg font-bold text-slate-900">{filteredInventory.length}</p>
          </div>
        </div>

        <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-center">
          <div className="p-2 bg-red-50 text-red-600 rounded mr-3">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cần nhập</p>
            <p className="text-lg font-bold text-red-600">
              {products.filter(p => (inventory.get(p.id) || 0) <= p.warningThreshold).length}
            </p>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card-traditional overflow-hidden flex flex-col flex-1">
        <div className="overflow-x-auto">
          <table className="table-traditional">
            <thead>
              <tr>
                <th>Sản Phẩm</th>
                <th>Hãng Sản Xuất</th>
                <th className="text-center">Tồn Kho</th>
                <th className="text-center">Định Mức</th>
                <th className="text-center">Trạng Thái</th>
                <th className="text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map(product => {
                const stock = inventory.get(product.id) || 0;
                const isLow = stock <= product.warningThreshold;
                
                return (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                    <td>
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded flex items-center justify-center mr-3 ${isLow ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                          <Package size={16} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{product.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">ID: {product.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="font-bold text-slate-600">
                        {product.manufacturerName}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`text-base font-bold ${isLow ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatNumber(stock)}
                      </span>
                    </td>
                    <td className="text-center font-bold text-slate-400 text-sm">
                      {formatNumber(product.warningThreshold)}
                    </td>
                    <td className="text-center">
                      {isLow ? (
                        <span className="inline-flex items-center px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold uppercase">
                          <AlertTriangle size={10} className="mr-1" /> Sắp hết
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold uppercase">
                          <CheckCircle size={10} className="mr-1" /> Ổn định
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => { setSelectedProduct(product); setShowAdjustModal(true); }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all"
                          title="Điều chỉnh kho"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button 
                          onClick={() => { setSelectedProduct(product); setShowTransferModal(true); }}
                          className="p-1.5 text-orange-600 hover:bg-orange-50 rounded transition-all"
                          title="Chuyển kho"
                        >
                          <ArrowRightLeft size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Điều Chỉnh Kho</h3>
                <p className="text-slate-500 text-xs mt-1">Cập nhật số lượng tồn kho thủ công</p>
              </div>
              <button onClick={() => setShowAdjustModal(false)} className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Sản phẩm</p>
                <p className="text-base font-bold text-slate-900">{selectedProduct.name}</p>
                <p className="text-sm font-semibold text-blue-600 mt-1">Tồn hiện tại: {inventory.get(selectedProduct.id) || 0}</p>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Số lượng thay đổi (+/-)</label>
                <input 
                  type="number"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xl text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                />
                <p className="mt-2 text-xs text-slate-400 italic ml-1">Nhập số dương để tăng, số âm để giảm.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Lý do điều chỉnh</label>
                <textarea 
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 h-24 resize-none transition-all outline-none"
                  placeholder="Ví dụ: Kiểm kho định kỳ, hàng hỏng..."
                />
              </div>

              <button
                onClick={handleAdjustStock}
                disabled={isSubmitting || adjustQty === 0}
                className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-100 flex items-center justify-center disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? <Loader className="animate-spin mr-2" size={20} /> : <CheckCircle className="mr-2" size={20} />}
                Xác Nhận Điều Chỉnh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Stock Modal */}
      {showTransferModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Chuyển Kho</h3>
                <p className="text-slate-500 text-xs mt-1">Điều phối hàng hóa giữa các kho hệ thống</p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Sản phẩm</p>
                <p className="text-base font-bold text-slate-900">{selectedProduct.name}</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Từ kho nguồn</label>
                  <select 
                    value={transferFromId}
                    onChange={(e) => setTransferFromId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none appearance-none"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-center text-slate-300">
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Đến kho đích</label>
                  <select 
                    value={transferToId}
                    onChange={(e) => setTransferToId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none appearance-none"
                  >
                    <option value="">Chọn kho đích...</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Số lượng chuyển</label>
                <input 
                  type="number"
                  value={transferQty}
                  onChange={(e) => setTransferQty(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xl text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                />
              </div>

              <button
                onClick={handleTransferStock}
                disabled={isSubmitting || transferQty <= 0 || !transferToId}
                className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-100 flex items-center justify-center disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? <Loader className="animate-spin mr-2" size={20} /> : <ArrowRightLeft className="mr-2" size={20} />}
                Xác Nhận Chuyển Kho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
