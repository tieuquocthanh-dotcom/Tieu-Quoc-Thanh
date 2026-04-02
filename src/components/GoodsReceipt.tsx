
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, Timestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, Supplier, Warehouse, GoodsReceipt as IGoodsReceipt, GoodsReceiptItem, PaymentMethod } from '../types';
import { Archive, Search, Plus, Minus, Trash2, Users, Warehouse as WarehouseIcon, CreditCard, Save, X, Loader, Package, FileText } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import { notifyError, notifySuccess } from '../utils/errorHandler';
import SearchableSelect from './SearchableSelect';

interface GoodsReceiptProps {
  userRole: 'admin' | 'staff' | null;
  user: any;
}

const GoodsReceipt: React.FC<GoodsReceiptProps> = ({ userRole, user }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<GoodsReceiptItem[]>([]);
  
  // Receipt settings
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'debt'>('paid');
  const [hasInvoice, setHasInvoice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snapshot) => {
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    const unsubSuppliers = onSnapshot(query(collection(db, 'suppliers'), orderBy('name')), (snapshot) => {
      setSuppliers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
    });

    const unsubWarehouses = onSnapshot(query(collection(db, 'warehouses'), orderBy('name')), (snapshot) => {
      const ws = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse));
      setWarehouses(ws);
      if (ws.length > 0 && !selectedWarehouseId) setSelectedWarehouseId(ws[0].id);
    });

    const unsubPayments = onSnapshot(query(collection(db, 'paymentMethods'), orderBy('name')), (snapshot) => {
      const ps = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod));
      setPaymentMethods(ps);
      if (ps.length > 0 && !selectedPaymentMethodId) setSelectedPaymentMethodId(ps[0].id);
    });

    setLoading(false);
    return () => {
      unsubProducts();
      unsubSuppliers();
      unsubWarehouses();
      unsubPayments();
    };
  }, []);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10);
  }, [products, searchTerm]);

  const addItem = (product: Product) => {
    const existing = items.find(item => item.productId === product.id);
    if (existing) {
      setItems(items.map(item => 
        item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setItems([...items, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        importPrice: product.importPrice,
        isCombo: product.isCombo
      }]);
    }
    setSearchTerm('');
  };

  const updateItem = (productId: string, field: keyof GoodsReceiptItem, value: any) => {
    setItems(items.map(item => {
      if (item.productId === productId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setItems(items.filter(item => item.productId !== productId));
  };

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.importPrice * item.quantity), 0);
  }, [items]);

  const handleSave = async () => {
    if (items.length === 0) {
      notifyError("Phiếu nhập trống!");
      return;
    }
    if (!selectedSupplierId || !selectedWarehouseId) {
      notifyError("Vui lòng chọn nhà cung cấp và kho nhập hàng.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supplier = suppliers.find(s => s.id === selectedSupplierId);
      const warehouse = warehouses.find(w => w.id === selectedWarehouseId);
      const paymentMethod = paymentMethods.find(p => p.id === selectedPaymentMethodId);

      const receiptData: Partial<IGoodsReceipt> = {
        items,
        total: totalAmount,
        supplierId: selectedSupplierId,
        supplierName: supplier?.name || '',
        warehouseId: selectedWarehouseId,
        warehouseName: warehouse?.name || '',
        paymentMethodId: selectedPaymentMethodId || undefined,
        paymentMethodName: paymentMethod?.name || '',
        paymentStatus,
        hasInvoice,
        createdAt: serverTimestamp() as Timestamp,
        createdBy: user?.uid,
        creatorName: user?.displayName || user?.email
      };

      await addDoc(collection(db, 'goodsReceipts'), receiptData);
      
      // Update supplier debt if status is 'debt'
      if (paymentStatus === 'debt' && selectedSupplierId) {
        const supplierRef = doc(db, 'suppliers', selectedSupplierId);
        await updateDoc(supplierRef, {
          debt: increment(totalAmount)
        });
      }
      
      // Update inventory and product import price
      for (const item of items) {
        // Update stock in specific warehouse
        const invRef = doc(db, `warehouses/${selectedWarehouseId}/inventory`, item.productId);
        await updateDoc(invRef, {
          stock: increment(item.quantity)
        }).catch(async () => {
          // If doc doesn't exist, create it
          const { setDoc } = await import('firebase/firestore');
          await setDoc(invRef, { stock: item.quantity });
        });

        // Update product's default import price if it changed
        const productRef = doc(db, 'products', item.productId);
        await updateDoc(productRef, {
          importPrice: item.importPrice
        });
      }

      notifySuccess("Đã nhập hàng thành công!");
      setItems([]);
      setHasInvoice(false);
    } catch (err) {
      console.error("Receipt error:", err);
      notifyError("Có lỗi xảy ra khi nhập hàng.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-blue-700 flex items-center">
            <Archive className="mr-3 text-blue-600" size={32} />
            Nhập Hàng Vào Kho
          </h1>
          <p className="text-slate-600 font-bold text-sm mt-1">Quản lý nhập kho và giá vốn sản phẩm</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <FileText className="text-blue-600" size={20} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left side: Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-blue-50 border-b border-blue-100" ref={productSearchRef}>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" size={18} />
                <input
                  type="text"
                  placeholder="Tìm sản phẩm để nhập kho..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setIsProductDropdownOpen(true);
                  }}
                  onFocus={() => setIsProductDropdownOpen(true)}
                  className="w-full pl-11 pr-4 py-3 bg-white border-2 border-blue-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none text-slate-800 font-bold transition-all"
                />
                
                {/* Autocomplete Dropdown */}
                {isProductDropdownOpen && searchTerm && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-80 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="overflow-y-auto p-2 custom-scrollbar">
                      {filteredProducts.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500 italic flex flex-col items-center">
                          <Package className="text-slate-300 mb-2" size={32} />
                          Không tìm thấy sản phẩm nào
                        </div>
                      ) : (
                        filteredProducts.map(product => (
                          <button
                            key={product.id}
                            onClick={() => {
                              addItem(product);
                              setIsProductDropdownOpen(false);
                            }}
                            className="w-full p-3 rounded-lg text-left flex items-center justify-between mb-1 last:mb-0 transition-all hover:bg-blue-50 active:bg-blue-100"
                          >
                            <div className="flex items-center flex-1 min-w-0">
                              <div className="p-2 rounded-md mr-3 bg-blue-100 text-blue-600">
                                <Package size={16} />
                              </div>
                              <div className="flex-1 min-w-0 pr-4">
                                <p className="font-bold text-slate-800 text-sm truncate">{product.name}</p>
                                <p className="text-xs text-slate-500">ID: {product.id.slice(0, 8)}</p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-blue-600 text-sm">{formatNumber(product.importPrice)} ₫</p>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Giá nhập cũ
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              {filteredProducts.length === 0 && searchTerm ? (
                <div className="col-span-full py-12 text-center">
                  <Package className="mx-auto text-slate-200 mb-3" size={48} />
                  <p className="text-slate-400 text-sm italic">Không tìm thấy sản phẩm nào</p>
                </div>
              ) : filteredProducts.length === 0 && !searchTerm ? (
                <div className="col-span-full py-12 text-center">
                  <Search className="mx-auto text-slate-200 mb-3" size={48} />
                  <p className="text-slate-400 text-sm italic">Nhập tên sản phẩm để tìm kiếm</p>
                </div>
              ) : (
                filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addItem(product)}
                    className="p-3 rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:bg-blue-50/30 transition-all text-left flex items-center group"
                  >
                    <div className="p-2.5 rounded-lg mr-3 bg-slate-100 text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Package size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{product.name}</p>
                      <p className="text-xs text-slate-500">Giá nhập cũ: {formatNumber(product.importPrice)} ₫</p>
                    </div>
                    <Plus className="text-slate-300 group-hover:text-blue-600 transition-colors" size={18} />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Receipt Items Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center">
                <Archive className="mr-2 text-blue-400" size={20} />
                <h2 className="font-semibold text-sm">Danh Sách Hàng Nhập ({items.length})</h2>
              </div>
              <button 
                onClick={() => setItems([])}
                className="px-3 py-1.5 bg-white/10 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition-all"
              >
                Xóa Tất Cả
              </button>
            </div>
            
            <div className="overflow-x-auto">
              {items.length === 0 ? (
                <div className="py-16 text-center text-slate-300">
                  <Archive size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium text-slate-400">Chưa có sản phẩm nào trong danh sách</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                      <th className="p-4">Sản Phẩm</th>
                      <th className="p-4 text-center">Số Lượng</th>
                      <th className="p-4 text-right">Giá Nhập (VNĐ)</th>
                      <th className="p-4 text-right">Thành Tiền</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map(item => (
                      <tr key={item.productId} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="p-4">
                          <p className="font-semibold text-slate-800 text-sm">{item.productName}</p>
                          <p className="text-xs text-slate-500">ID: {item.productId.slice(0, 8)}</p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center space-x-2">
                            <button 
                              onClick={() => updateItem(item.productId, 'quantity', Math.max(1, item.quantity - 1))}
                              className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                              <Minus size={14} />
                            </button>
                            <input 
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.productId, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-14 text-center font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg focus:border-blue-500 outline-none py-1 text-sm"
                            />
                            <button 
                              onClick={() => updateItem(item.productId, 'quantity', item.quantity + 1)}
                              className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <input 
                            type="number"
                            value={item.importPrice}
                            onChange={(e) => updateItem(item.productId, 'importPrice', parseInt(e.target.value) || 0)}
                            className="w-28 text-right font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg focus:border-blue-500 outline-none py-1 px-2 text-sm"
                          />
                        </td>
                        <td className="p-4 text-right font-bold text-slate-900">{formatNumber(item.importPrice * item.quantity)}</td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => removeItem(item.productId)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right side: Info Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center">
              <FileText className="mr-2 text-blue-600" size={20} />
              Thông Tin Phiếu
            </h2>

            <div className="space-y-5">
              {/* Supplier Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                  <Users size={14} className="mr-2" /> Nhà Cung Cấp
                </label>
                <SearchableSelect
                  options={suppliers.map(s => ({ id: s.id, name: s.name, phone: s.phone, debt: s.debt }))}
                  value={selectedSupplierId}
                  onChange={setSelectedSupplierId}
                  placeholder="Chọn nhà cung cấp..."
                  icon={<Users size={14} />}
                />
              </div>

              {/* Warehouse Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                  <WarehouseIcon size={14} className="mr-2" /> Kho Nhập Hàng
                </label>
                <SearchableSelect
                  options={warehouses.map(w => ({ id: w.id, name: w.name }))}
                  value={selectedWarehouseId}
                  onChange={setSelectedWarehouseId}
                  placeholder="Chọn kho..."
                  icon={<WarehouseIcon size={14} />}
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                  <CreditCard size={14} className="mr-2" /> Thanh Toán
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    onClick={() => setPaymentStatus('paid')}
                    className={`py-2 rounded-xl font-semibold text-xs uppercase tracking-wider border transition-all ${paymentStatus === 'paid' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-500'}`}
                  >
                    Trả Ngay
                  </button>
                  <button
                    onClick={() => setPaymentStatus('debt')}
                    className={`py-2 rounded-xl font-semibold text-xs uppercase tracking-wider border transition-all ${paymentStatus === 'debt' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-200 text-slate-500'}`}
                  >
                    Ghi Nợ
                  </button>
                </div>
                <SearchableSelect
                  options={paymentMethods.map(p => ({ id: p.id, name: p.name }))}
                  value={selectedPaymentMethodId}
                  onChange={setSelectedPaymentMethodId}
                  placeholder="Chọn thanh toán..."
                  icon={<CreditCard size={14} />}
                />
              </div>

              {/* Invoice Checkbox */}
              <label className="flex items-center cursor-pointer group p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-500 transition-all">
                <input
                  type="checkbox"
                  checked={hasInvoice}
                  onChange={(e) => setHasInvoice(e.target.checked)}
                  className="hidden"
                />
                <div className={`w-5 h-5 border rounded flex items-center justify-center mr-3 transition-all ${hasInvoice ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                  {hasInvoice && <X size={14} className="text-white rotate-45" />}
                </div>
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Có Hóa Đơn VAT</span>
              </label>
            </div>

            <div className="pt-6 border-t border-slate-100 space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-slate-500 font-medium text-sm">Tổng Tiền Nhập:</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-slate-900">{formatNumber(totalAmount)}</span>
                  <span className="ml-1 font-semibold text-sm text-slate-500">₫</span>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={isSubmitting || items.length === 0}
                className="w-full py-3.5 bg-blue-600 text-white font-bold uppercase tracking-wider text-sm rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group"
              >
                {isSubmitting ? (
                  <Loader className="animate-spin mr-2" size={18} />
                ) : (
                  <Save className="mr-2 group-hover:scale-110 transition-transform" size={18} />
                )}
                {isSubmitting ? 'ĐANG XỬ LÝ...' : 'LƯU PHIẾU NHẬP'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default GoodsReceipt;
