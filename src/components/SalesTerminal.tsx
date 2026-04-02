
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, Timestamp, doc, getDoc, updateDoc, increment, collectionGroup } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, Customer, Sale, SaleItem, Warehouse, PaymentMethod, Shipper } from '../types';
import { ShoppingCart, Search, Plus, Minus, Trash2, User, Warehouse as WarehouseIcon, CreditCard, Truck, Save, X, Loader, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import { notifyError, notifySuccess } from '../utils/errorHandler';
import SearchableSelect from './SearchableSelect';

interface SalesTerminalProps {
  userRole: 'admin' | 'staff' | null;
  user: any;
}

const SalesTerminal: React.FC<SalesTerminalProps> = ({ userRole, user }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [inventory, setInventory] = useState<Map<string, number>>(new Map());
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);
  const [cart, setCart] = useState<SaleItem[]>([]);
  
  // Sale settings
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
  const [selectedShipperId, setSelectedShipperId] = useState('');
  const [shippingFee, setShippingFee] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'paid' | 'debt'>('paid');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [warehouseStocks, setWarehouseStocks] = useState<Record<string, Map<string, number>>>({});

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

    const unsubCustomers = onSnapshot(query(collection(db, 'customers'), orderBy('name')), (snapshot) => {
      setCustomers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });

    const unsubWarehouses = onSnapshot(query(collection(db, 'warehouses'), orderBy('name')), (snapshot) => {
      const ws = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse));
      setWarehouses(ws);
      
      // Filter warehouses to match user's requested list
      const targetNames = ['Ngoài CH', 'Trong CH', 'Trên lầu', 'Lên Lầu'];
      const filtered = ws.filter(w => targetNames.some(name => w.name.trim().toLowerCase() === name.toLowerCase()));
      
      if (filtered.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(filtered[0].id);
      } else if (ws.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(ws[0].id);
      }
    });

    const unsubPayments = onSnapshot(query(collection(db, 'paymentMethods'), orderBy('name')), (snapshot) => {
      const ps = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod));
      setPaymentMethods(ps);
      if (ps.length > 0 && !selectedPaymentMethodId) setSelectedPaymentMethodId(ps[0].id);
    });

    const unsubShippers = onSnapshot(query(collection(db, 'shippers'), orderBy('name')), (snapshot) => {
      setShippers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shipper)));
    });

    setLoading(false);
    return () => {
      unsubProducts();
      unsubCustomers();
      unsubWarehouses();
      unsubPayments();
      unsubShippers();
    };
  }, []);

  // Fetch ALL inventory using collectionGroup for robust display
  useEffect(() => {
    if (warehouses.length === 0) return;

    const unsubInventory = onSnapshot(collectionGroup(db, 'inventory'), (snapshot) => {
      const newWarehouseStocks: Record<string, Map<string, number>> = {};
      const currentWarehouseInv = new Map<string, number>();
      
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
        
        if (warehouseId && productId) {
          const warehouse = warehouses.find(w => w.id === warehouseId);
          if (warehouse) {
            const wName = warehouse.name.trim();
            if (!newWarehouseStocks[wName]) newWarehouseStocks[wName] = new Map();
            newWarehouseStocks[wName].set(productId, stockValue);
            
            if (warehouseId === selectedWarehouseId) {
              currentWarehouseInv.set(productId, stockValue);
            }
          }
        }
      });
      
      setWarehouseStocks(newWarehouseStocks);
      setInventory(currentWarehouseInv);
    });

    return () => unsubInventory();
  }, [warehouses, selectedWarehouseId]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    return products
      .filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             p.id.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        
        // Only show products that exist in the selected warehouse or have some stock info
        // Actually, the user said "hiện ra sản phẩm của kho nào đã chọn", 
        // which might mean filtering out products with 0 stock in the selected warehouse.
        const stock = inventory.get(p.id) || 0;
        return stock > 0;
      })
      .slice(0, 15);
  }, [products, searchTerm, inventory]);

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      setCart(cart.map(item => 
        item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        price: product.sellingPrice,
        unit: product.unit,
        importPrice: product.importPrice,
        isCombo: product.isCombo
      }]);
    }
    setSearchTerm('');
    notifySuccess(`Đã thêm ${product.name}`);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const totalAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + shippingFee - discount;
  }, [cart, shippingFee, discount]);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      notifyError("Giỏ hàng trống!");
      return;
    }
    if (!selectedWarehouseId) {
      notifyError("Vui lòng chọn kho xuất hàng.");
      return;
    }

    setIsSubmitting(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomerId);
      const warehouse = warehouses.find(w => w.id === selectedWarehouseId);
      const paymentMethod = paymentMethods.find(p => p.id === selectedPaymentMethodId);
      const shipper = shippers.find(s => s.id === selectedShipperId);

      const saleData: Partial<Sale> = {
        items: cart,
        total: totalAmount,
        discount,
        shippingFee,
        customerId: selectedCustomerId || undefined,
        customerName: customer?.name || 'Khách vãng lai',
        warehouseId: selectedWarehouseId,
        warehouseName: warehouse?.name || '',
        paymentMethodId: selectedPaymentMethodId || undefined,
        paymentMethodName: paymentMethod?.name || '',
        shipperId: selectedShipperId || undefined,
        shipperName: shipper?.name || '',
        status,
        shippingStatus: selectedShipperId ? 'pending' : 'none',
        note,
        createdAt: Timestamp.fromDate(new Date(customDate)),
        createdBy: user?.uid,
        creatorName: user?.displayName || user?.email
      };

      const saleRef = await addDoc(collection(db, 'sales'), saleData);
      
      // Update customer debt if status is 'debt'
      if (status === 'debt' && selectedCustomerId) {
        const customerRef = doc(db, 'customers', selectedCustomerId);
        await updateDoc(customerRef, {
          debt: increment(totalAmount)
        });
      }
      
      // Update inventory (Simple implementation)
      for (const item of cart) {
        const invRef = doc(db, `warehouses/${selectedWarehouseId}/inventory`, item.productId);
        await updateDoc(invRef, {
          stock: increment(-item.quantity)
        });
      }

      notifySuccess("Đã lưu đơn hàng thành công!");
      setCart([]);
      setNote('');
      setShippingFee(0);
      setDiscount(0);
    } catch (err) {
      console.error("Checkout error:", err);
      notifyError("Có lỗi xảy ra khi thanh toán.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-blue-700 tracking-tight flex items-center">
            <ShoppingCart className="mr-3 text-blue-600" size={32} />
            Hệ Thống Bán Hàng
          </h1>
          <p className="text-slate-600 font-bold text-sm mt-1">Lập hóa đơn bán lẻ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 bg-blue-50 border-b border-blue-100" ref={productSearchRef}>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" size={18} />
                <input
                  type="text"
                  placeholder="Tìm sản phẩm (Tên hoặc ID)..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setIsProductDropdownOpen(true);
                  }}
                  onFocus={() => setIsProductDropdownOpen(true)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-blue-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-bold text-slate-800 transition-all outline-none"
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
                        filteredProducts.map(product => {
                          const stock = inventory.get(product.id) || 0;
                          const isLowStock = stock <= product.warningThreshold;
                          
                          // Helper to get stock by name (case-insensitive and trimmed)
                          const getStockByName = (name: string) => {
                            const key = Object.keys(warehouseStocks).find(k => k.toLowerCase() === name.toLowerCase());
                            return key ? (warehouseStocks[key].get(product.id) || 0) : 0;
                          };

                          const ngoaiCHStock = getStockByName('Ngoài CH');
                          const trongCHStock = getStockByName('Trong CH');
                          const trenLauStock = getStockByName('Trên lầu') || getStockByName('Lên Lầu');

                          return (
                            <button
                              key={product.id}
                              onClick={() => {
                                addToCart(product);
                                setIsProductDropdownOpen(false);
                              }}
                              disabled={stock <= 0}
                              className={`w-full p-3 rounded-lg text-left flex items-center justify-between mb-1 last:mb-0 transition-all ${
                                stock <= 0 
                                ? 'opacity-50 cursor-not-allowed bg-slate-50' 
                                : 'hover:bg-blue-50 active:bg-blue-100'
                              }`}
                            >
                              <div className="flex items-center flex-1 min-w-0">
                                <div className={`p-2 rounded-md mr-3 ${stock <= 0 ? 'bg-slate-200 text-slate-400' : 'bg-blue-100 text-blue-600'}`}>
                                  <Package size={16} />
                                </div>
                                <div className="flex-1 min-w-0 pr-4">
                                  <p className="font-bold text-slate-800 text-sm truncate">
                                    {product.name}
                                    {product.unit && <span className="ml-2 text-[10px] text-slate-400 font-medium">({product.unit})</span>}
                                  </p>
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                                    <span className="text-[10px] text-slate-500 font-medium">Ngoài: <span className="text-blue-600 font-bold">{ngoaiCHStock}</span></span>
                                    <span className="text-[10px] text-slate-500 font-medium">Trong: <span className="text-blue-600 font-bold">{trongCHStock}</span></span>
                                    <span className="text-[10px] text-slate-500 font-medium">Lầu: <span className="text-blue-600 font-bold">{trenLauStock}</span></span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-blue-600 text-sm">{formatNumber(product.sellingPrice)} ₫</p>
                                <p className={`text-[10px] font-bold uppercase tracking-wider ${isLowStock ? 'text-red-500' : 'text-slate-400'}`}>
                                  Tồn ({warehouses.find(w => w.id === selectedWarehouseId)?.name}): {stock}
                                </p>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto custom-scrollbar">
              {filteredProducts.length === 0 && searchTerm ? (
                <div className="col-span-full py-20 text-center">
                  <Package className="mx-auto text-slate-200 mb-4" size={48} />
                  <p className="text-slate-400 font-medium text-sm italic">Không tìm thấy sản phẩm nào</p>
                </div>
              ) : filteredProducts.length === 0 && !searchTerm ? (
                <div className="col-span-full py-20 text-center">
                  <Search className="mx-auto text-slate-200 mb-4" size={48} />
                  <p className="text-slate-400 font-medium text-sm italic">Nhập tên sản phẩm để tìm kiếm</p>
                </div>
              ) : (
                filteredProducts.map(product => {
                  const stock = inventory.get(product.id) || 0;
                  const isLowStock = stock <= product.warningThreshold;
                  
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={stock <= 0}
                      className={`p-4 rounded-xl border transition-all text-left flex items-start group relative overflow-hidden ${
                        stock <= 0 
                        ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed' 
                        : 'bg-white border-slate-100 hover:border-blue-500 hover:shadow-md active:scale-[0.98]'
                      }`}
                    >
                      <div className={`p-3 rounded-lg mr-4 transition-colors ${
                        stock <= 0 ? 'bg-slate-200 text-slate-400' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                      }`}>
                        <Package size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate mb-1">{product.name}</p>
                        <div className="flex justify-between items-end">
                          <p className="font-bold text-blue-600 text-base">{formatNumber(product.sellingPrice)} ₫</p>
                          <div className="text-right">
                            <p className={`text-[10px] font-bold uppercase tracking-wider ${isLowStock ? 'text-red-500' : 'text-slate-400'}`}>
                              Tồn: {stock}
                            </p>
                          </div>
                        </div>
                      </div>
                      {stock <= 0 && (
                        <div className="absolute inset-0 bg-slate-900/5 flex items-center justify-center backdrop-blur-[1px]">
                          <span className="bg-red-500 text-white text-[10px] font-bold uppercase px-3 py-1 rounded-full tracking-wider shadow-sm">Hết hàng</span>
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Cart & Checkout */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-[750px]">
            <div className="p-6 border-b border-blue-600 flex justify-between items-center bg-blue-600 text-white">
              <h2 className="font-bold flex items-center text-lg">
                <ShoppingCart className="mr-3 text-white" size={20} />
                Giỏ Hàng
              </h2>
              <span className="bg-white text-blue-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                {cart.reduce((sum, item) => sum + item.quantity, 0)} Món
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* Order Info Section */}
              <div className="space-y-4 pb-6 border-b border-slate-100">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Kho xuất hàng</label>
                    <SearchableSelect
                      options={warehouses
                        .filter(w => ['Ngoài CH', 'Trong CH', 'Trên lầu', 'Lên Lầu'].some(name => w.name.trim().toLowerCase() === name.toLowerCase()))
                        .map(w => ({ id: w.id, name: w.name }))}
                      value={selectedWarehouseId}
                      onChange={setSelectedWarehouseId}
                      placeholder="Chọn kho..."
                      icon={<WarehouseIcon size={14} />}
                      showSearch={false}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Khách hàng</label>
                    <SearchableSelect
                      options={[
                        { id: '', name: 'Khách vãng lai' }, 
                        ...customers.map(c => ({ id: c.id, name: c.name, phone: c.phone, debt: c.debt }))
                      ]}
                      value={selectedCustomerId}
                      onChange={setSelectedCustomerId}
                      placeholder="Chọn khách hàng..."
                      icon={<User size={14} />}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Thanh toán</label>
                      <SearchableSelect
                        options={paymentMethods.map(p => ({ id: p.id, name: p.name }))}
                        value={selectedPaymentMethodId}
                        onChange={setSelectedPaymentMethodId}
                        placeholder="Chọn thanh toán..."
                        icon={<CreditCard size={14} />}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Vận chuyển</label>
                      <SearchableSelect
                        options={[{ id: '', name: 'Không vận chuyển' }, ...shippers.map(s => ({ id: s.id, name: s.name }))]}
                        value={selectedShipperId}
                        onChange={setSelectedShipperId}
                        placeholder="Chọn vận chuyển..."
                        icon={<Truck size={14} />}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Phí ship</label>
                      <input
                        type="number"
                        value={shippingFee}
                        onChange={(e) => setShippingFee(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Giảm giá</label>
                      <input
                        type="number"
                        value={discount}
                        onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Ngày bán</label>
                      <input
                        type="date"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Trạng thái</label>
                      <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button
                          onClick={() => setStatus('paid')}
                          className={`flex-1 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${status === 'paid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                        >
                          Đã trả
                        </button>
                        <button
                          onClick={() => setStatus('debt')}
                          className={`flex-1 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${status === 'debt' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}
                        >
                          Ghi nợ
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {cart.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-300 space-y-4 opacity-50">
                  <ShoppingCart size={48} />
                  <p className="font-medium text-sm italic">Giỏ hàng đang trống</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Chi tiết mặt hàng</h3>
                  {cart.map(item => (
                    <div key={item.productId} className="bg-slate-50 rounded-xl p-4 border border-slate-100 group animate-fade-in">
                      <div className="flex justify-between items-start mb-3">
                        <p className="text-slate-800 font-bold text-sm flex-1 mr-2">{item.productName}</p>
                        <button 
                          onClick={() => removeFromCart(item.productId)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center bg-white rounded-lg p-1 border border-slate-200">
                          <button 
                            onClick={() => updateQuantity(item.productId, -1)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <div className="flex flex-col items-center px-2">
                            <span className="w-10 text-center text-slate-800 font-bold text-sm">{item.quantity}</span>
                            {item.unit && <span className="text-[9px] text-slate-400 font-medium">{item.unit}</span>}
                          </div>
                          <button 
                            onClick={() => updateQuantity(item.productId, 1)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <p className="text-blue-600 font-bold text-sm">{formatNumber(item.price * item.quantity)} ₫</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-slate-500 font-medium text-sm">
                  <span>Tạm tính:</span>
                  <span>{formatNumber(cart.reduce((sum, item) => sum + (item.price * item.quantity), 0))} ₫</span>
                </div>
                {shippingFee > 0 && (
                  <div className="flex justify-between text-slate-500 font-medium text-sm">
                    <span>Phí vận chuyển:</span>
                    <span className="text-blue-600">+{formatNumber(shippingFee)} ₫</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-slate-500 font-medium text-sm">
                    <span>Giảm giá:</span>
                    <span className="text-red-600">-{formatNumber(discount)} ₫</span>
                  </div>
                )}
                <div className="flex justify-between items-end pt-2 border-t border-slate-200">
                  <span className="text-slate-900 font-bold text-lg">Tổng cộng:</span>
                  <span className="text-3xl font-bold text-blue-600 tracking-tight">{formatNumber(totalAmount)} ₫</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isSubmitting || cart.length === 0}
                className="w-full py-4 bg-blue-600 text-white font-bold uppercase tracking-wider text-base rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group"
              >
                {isSubmitting ? (
                  <Loader className="animate-spin mr-3" size={20} />
                ) : (
                  <Save className="mr-3 group-hover:scale-110 transition-transform" size={20} />
                )}
                {isSubmitting ? 'ĐANG XỬ LÝ...' : 'THANH TOÁN'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesTerminal;
