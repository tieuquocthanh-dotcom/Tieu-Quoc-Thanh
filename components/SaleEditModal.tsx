
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sale, Customer, PaymentMethod, Shipper, SaleItem, Product } from '../types';
import { X, Save, Edit3, ShoppingBag, Plus, Minus, Trash2, Truck, Wallet, FileCheck2, AlertCircle, Loader, Users, Coins, Search, Tag, Calendar } from 'lucide-react';
import { doc, serverTimestamp, runTransaction, collection, Timestamp, increment, getDoc, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { formatNumber, parseNumber } from '../utils/formatting';

interface SaleEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  customers: Customer[];
  paymentMethods: PaymentMethod[];
  shippers: Shipper[];
  products: Product[];
}

const getTodayString = () => new Date().toISOString().split('T')[0];

const NumericInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    className?: string;
    placeholder?: string;
}> = ({ value, onChange, className, placeholder }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [localValue, setLocalValue] = useState("");

    useEffect(() => {
        if (!isFocused) {
            setLocalValue(formatNumber(value));
        }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        setLocalValue(raw);
        onChange(Number(raw) || 0);
    };

    return (
        <input
            type="text"
            inputMode="numeric"
            value={localValue}
            placeholder={placeholder}
            className={className}
            onFocus={(e) => {
                setIsFocused(true);
                setLocalValue(value === 0 ? "" : value.toString());
                e.target.select();
            }}
            onBlur={() => {
                setIsFocused(false);
                setLocalValue(formatNumber(value));
            }}
            onChange={handleChange}
        />
    );
};

const SaleEditModal: React.FC<SaleEditModalProps> = ({ isOpen, onClose, sale, customers, paymentMethods, shippers, products }) => {
  const [customerId, setCustomerId] = useState('');
  const [shipperId, setShipperId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'debt'>('paid');
  const [shippingMode, setShippingMode] = useState<'none' | 'pending' | 'shipped' | 'order'>('none');
  const [shippingFee, setShippingFee] = useState(0);
  const [saleDate, setSaleDate] = useState(getTodayString()); 
  const [issueInvoice, setIssueInvoice] = useState(false);
  const [editedItems, setEditedItems] = useState<SaleItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [wholesalePrices, setWholesalePrices] = useState<Record<string, number>>({});

  // Search Customer State
  const [custSearch, setCustSearch] = useState('');
  const [isCustDropdownOpen, setIsCustDropdownOpen] = useState(false);
  const custDropdownRef = useRef<HTMLDivElement>(null);

  // Search Product State
  const [prodSearch, setProdSearch] = useState('');
  const [isProdDropdownOpen, setIsProdDropdownOpen] = useState(false);
  const [addQty, setAddQty] = useState(1);
  const prodDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && sale) {
      setCustomerId(sale.customerId || '');
      setCustSearch(sale.customerName || '');
      setShipperId(sale.shipperId || '');
      setPaymentMethodId(sale.paymentMethodId || '');
      setPaymentStatus(sale.status || 'paid');
      setShippingMode(sale.shippingStatus || 'none');
      setShippingFee(sale.shippingFee || 0);
      setIssueInvoice(sale.issueInvoice || false);
      setEditedItems(sale.items ? JSON.parse(JSON.stringify(sale.items)) : []);
      if (sale.createdAt) {
          setSaleDate(sale.createdAt.toDate().toISOString().split('T')[0]);
      } else {
          setSaleDate(getTodayString());
      }
    }
  }, [isOpen, sale]);

  // CẬP NHẬT: Logic lấy giá cũ cho khách sỉ trong Modal Edit
  useEffect(() => {
    if (!customerId) {
      setWholesalePrices({});
      return;
    }

    const customer = customers.find(c => c.id === customerId);
    if (customer?.type !== 'wholesale') {
      setWholesalePrices({});
      return;
    }

    const q = query(
      collection(db, "sales"),
      where("customerId", "==", customerId),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const prices: Record<string, number> = {};
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
    });

    return () => unsubscribe();
  }, [customerId, customers]);

  const newTotal = useMemo(() => {
    const itemsTotal = editedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    return itemsTotal + shippingFee;
  }, [editedItems, shippingFee]);

  const filteredCustomers = useMemo(() => {
      if (!custSearch) return customers.slice(0, 10);
      const lower = custSearch.toLowerCase();
      return customers.filter(c => (c.name || '').toLowerCase().includes(lower) || (c.phone || '').includes(lower)).slice(0, 10);
  }, [customers, custSearch]);

  const filteredProducts = useMemo(() => {
    if (!prodSearch) return [];
    const lower = prodSearch.toLowerCase();
    return products.filter(p => (p.name || '').toLowerCase().includes(lower)).slice(0, 10);
  }, [products, prodSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (custDropdownRef.current && !custDropdownRef.current.contains(e.target as Node)) {
        setIsCustDropdownOpen(false);
      }
      if (prodDropdownRef.current && !prodDropdownRef.current.contains(e.target as Node)) {
        setIsProdDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen || !sale) return null;

  const handleAddProductToEdit = (p: Product) => {
    const existingIdx = editedItems.findIndex(item => item.productId === p.id);
    const initialPrice = wholesalePrices[p.id] !== undefined ? wholesalePrices[p.id] : p.sellingPrice;

    if (existingIdx !== -1) {
      const newItems = [...editedItems];
      newItems[existingIdx].quantity += addQty;
      setEditedItems(newItems);
    } else {
      setEditedItems([...editedItems, {
        productId: p.id,
        productName: p.name,
        quantity: addQty,
        price: initialPrice,
        importPrice: p.importPrice,
        isCombo: !!p.isCombo
      }]);
    }
    setProdSearch('');
    setAddQty(1);
    setIsProdDropdownOpen(false);
  };

  const updateItem = (index: number, updates: Partial<SaleItem>) => {
    const newItems = [...editedItems];
    newItems[index] = { ...newItems[index], ...updates };
    setEditedItems(newItems);
  };

  const handleSave = async () => {
    if (!sale) return;
    if (editedItems.length === 0) {
      alert("Đơn hàng không thể để trống sản phẩm.");
      return;
    }
    setIsProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', sale.id);
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) throw "Đơn hàng không tồn tại.";
        const oldData = saleSnap.data() as Sale;

        const allProductIds = new Set([
            ...oldData.items.map(i => i.productId),
            ...editedItems.map(i => i.productId)
        ]);

        const productDocs: Record<string, any> = {};
        for (const pid of allProductIds) {
            const pSnap = await transaction.get(doc(db, 'products', pid));
            if (pSnap.exists()) {
                productDocs[pid] = pSnap.data();
            }
        }

        let oldAccSnap = null;
        if (oldData.paymentMethodId && oldData.status === 'paid') {
            oldAccSnap = await transaction.get(doc(db, 'paymentMethods', oldData.paymentMethodId));
        }

        let newAccSnap = null;
        if (paymentMethodId && paymentStatus === 'paid') {
            if (paymentMethodId === oldData.paymentMethodId && oldAccSnap) {
                newAccSnap = oldAccSnap;
            } else {
                newAccSnap = await transaction.get(doc(db, 'paymentMethods', paymentMethodId));
            }
        }

        const selectedDateObj = new Date(saleDate);
        const originalDate = oldData.createdAt?.toDate() || new Date();
        selectedDateObj.setHours(originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds());
        const finalCreatedAt = Timestamp.fromDate(selectedDateObj);

        const shortId = sale.id.substring(0, 8).toUpperCase();

        for (const oldItem of oldData.items) {
            const productData = productDocs[oldItem.productId];
            if (oldItem.isCombo && productData?.comboItems) {
                for (const cItem of productData.comboItems) {
                    const totalReturn = cItem.quantity * oldItem.quantity;
                    const invRef = doc(db, 'products', cItem.productId, 'inventory', oldData.warehouseId);
                    transaction.set(invRef, { stock: increment(totalReturn) }, { merge: true });
                    if (oldData.issueInvoice) {
                        transaction.update(doc(db, 'products', cItem.productId), { totalInvoicedStock: increment(totalReturn) });
                    }
                }
            } else {
                const invRef = doc(db, 'products', oldItem.productId, 'inventory', oldData.warehouseId);
                transaction.set(invRef, { stock: increment(oldItem.quantity) }, { merge: true });
                if (oldData.issueInvoice) {
                    transaction.update(doc(db, 'products', oldItem.productId), { totalInvoicedStock: increment(oldItem.quantity) });
                }
            }
        }

        for (const newItem of editedItems) {
            const productData = productDocs[newItem.productId];
            if (newItem.isCombo && productData?.comboItems) {
                for (const cItem of productData.comboItems) {
                    const totalDeduct = cItem.quantity * newItem.quantity;
                    const invRef = doc(db, 'products', cItem.productId, 'inventory', oldData.warehouseId);
                    transaction.set(invRef, { stock: increment(-totalDeduct) }, { merge: true });
                    if (issueInvoice) {
                        transaction.update(doc(db, 'products', cItem.productId), { totalInvoicedStock: increment(-totalDeduct) });
                    }
                }
            } else {
                const invRef = doc(db, 'products', newItem.productId, 'inventory', oldData.warehouseId);
                transaction.set(invRef, { stock: increment(-newItem.quantity) }, { merge: true });
                if (issueInvoice) {
                    transaction.update(doc(db, 'products', newItem.productId), { totalInvoicedStock: increment(-newItem.quantity) });
                }
            }
        }

        if (oldAccSnap && oldData.status === 'paid') {
            const currentBal = oldAccSnap.data()?.balance || 0;
            const resBal = currentBal - oldData.total;
            transaction.update(oldAccSnap.ref, { balance: resBal });
            transaction.set(doc(collection(db, 'paymentLogs')), {
                paymentMethodId: oldData.paymentMethodId,
                paymentMethodName: oldData.paymentMethodName || 'N/A',
                type: 'withdraw',
                amount: oldData.total,
                balanceAfter: resBal,
                note: `Hoàn tiền điều chỉnh đơn hàng #${shortId}`,
                relatedId: sale.id, relatedType: 'sale', createdAt: serverTimestamp(), creatorName: auth.currentUser?.displayName || 'Hệ thống'
            });
        }

        if (newAccSnap && paymentStatus === 'paid') {
            const snapBal = newAccSnap.data()?.balance || 0;
            let baseBal = snapBal;
            if (newAccSnap.id === oldData.paymentMethodId && oldData.status === 'paid') {
                baseBal -= oldData.total;
            }
            const finalBal = baseBal + newTotal;
            transaction.update(newAccSnap.ref, { balance: finalBal });
            transaction.set(doc(collection(db, 'paymentLogs')), {
                paymentMethodId: paymentMethodId,
                paymentMethodName: paymentMethods.find(p => p.id === paymentMethodId)?.name || 'N/A',
                type: 'deposit',
                amount: newTotal,
                balanceAfter: finalBal,
                note: `Thu tiền đơn hàng #${shortId} sau điều chỉnh`,
                relatedId: sale.id, relatedType: 'sale', createdAt: serverTimestamp(), creatorName: auth.currentUser?.displayName || 'Hệ thống'
            });
        }

        const selectedCustomer = customers.find(c => c.id === customerId);
        const selectedShipper = shippers.find(s => s.id === shipperId);
        const selectedMethod = paymentMethods.find(p => p.id === paymentMethodId);

        transaction.update(saleRef, {
          items: editedItems,
          productIds: editedItems.map(i => i.productId),
          total: newTotal,
          shippingFee: shippingFee,
          issueInvoice: issueInvoice,
          customerId: customerId || null,
          customerName: selectedCustomer ? selectedCustomer.name : (custSearch || 'Khách vãng lai'),
          paymentMethodId: paymentMethodId || null,
          paymentMethodName: selectedMethod ? selectedMethod.name : null,
          shipperId: shipperId || null,
          shipperName: selectedShipper ? selectedShipper.name : null,
          status: paymentStatus,
          shippingStatus: shippingMode,
          createdAt: finalCreatedAt, 
          amountPaid: paymentStatus === 'paid' ? newTotal : 0,
          updatedAt: serverTimestamp()
        });
      });

      alert("Cập nhật đơn hàng thành công!");
      onClose();
    } catch (error: any) {
      console.error("Lỗi cập nhật:", error);
      alert("Lỗi: " + (error.message || error));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[110] animate-fade-in p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl animate-fade-in-down flex flex-col max-h-[95vh] overflow-hidden border-4 border-slate-800">
        <div className="flex justify-between items-center p-4 border-b-2 border-slate-800 bg-slate-800 text-white flex-shrink-0">
          <h3 className="text-lg font-black uppercase tracking-tighter flex items-center">
            <Edit3 className="mr-2 text-primary" size={20} />
            Sửa đơn hàng #{sale.id.substring(0, 8)}
          </h3>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={28} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm space-y-4">
                <div className="relative" ref={custDropdownRef}>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Khách hàng</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={custSearch}
                      onChange={(e) => { setCustSearch(e.target.value); setIsCustDropdownOpen(true); }}
                      onFocus={() => setIsCustDropdownOpen(true)}
                      className="w-full pl-10 pr-3 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm font-bold text-slate-900 bg-white"
                    />
                  </div>
                  {isCustDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-800 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                      {filteredCustomers.map(c => (
                        <button key={c.id} onClick={() => { setCustomerId(c.id); setCustSearch(c.name); setIsCustDropdownOpen(false); }} className="w-full text-left px-4 py-3 bg-white hover:bg-blue-50 border-b last:border-0 font-bold text-xs text-slate-900 transition-colors">
                          <div className="flex justify-between items-center"><span>{c.name}</span><span className="text-[10px] text-slate-400">{c.phone}</span></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Ngày bán hàng</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                            <input 
                                type="date" 
                                value={saleDate} 
                                onChange={e => setSaleDate(e.target.value)} 
                                className="w-full pl-10 pr-3 py-2 border-2 border-slate-200 rounded-lg font-black text-sm outline-none focus:ring-2 focus:ring-primary text-slate-900 bg-white"
                                style={{ colorScheme: 'light' }}
                            />
                        </div>
                    </div>
                    <div className="flex items-center p-2 bg-blue-50 border-2 border-blue-100 rounded-lg">
                        <input type="checkbox" id="edit-issue-invoice" checked={issueInvoice} onChange={e => setIssueInvoice(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-0 mr-3 cursor-pointer" />
                        <label htmlFor="edit-issue-invoice" className="text-xs font-black uppercase text-blue-800 cursor-pointer">Xuất hóa đơn đỏ</label>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Thanh toán</label>
                        <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as any)} className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg font-black text-xs uppercase outline-none text-slate-900 bg-white shadow-sm">
                            <option value="paid">Đã thanh toán</option>
                            <option value="debt">Ghi nợ</option>
                        </select>
                    </div>
                    {paymentStatus === 'paid' && (
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Tài khoản thu tiền</label>
                            <select value={paymentMethodId} onChange={e => setPaymentMethodId(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none text-slate-900 bg-white shadow-sm">
                                <option value="">-- CHỌN TÀI KHOẢN --</option>
                                {paymentMethods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Đơn vị vận chuyển</label>
                        <select value={shipperId} onChange={e => setShipperId(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none text-slate-900 bg-white shadow-sm">
                            <option value="">-- CHỌN ĐVVC --</option>
                            {shippers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Trạng thái giao</label>
                        <select value={shippingMode} onChange={e => setShippingMode(e.target.value as any)} className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none text-slate-900 bg-white shadow-sm">
                            <option value="shipped">Đã giao hàng</option>
                            <option value="pending">Chờ gửi</option>
                            <option value="order">Đặt hàng</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Phí vận chuyển</label>
                        <NumericInput value={shippingFee} onChange={setShippingFee} className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-black text-lg text-right focus:border-primary outline-none text-slate-900 bg-white shadow-inner" />
                    </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 flex flex-col gap-4">
                {/* Search Product Row */}
                <div className="bg-slate-900 p-4 rounded-xl border-4 border-slate-800 shadow-lg">
                    <div className="flex gap-2 relative">
                        <div className="flex-1 relative" ref={prodDropdownRef}>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                            <input 
                                type="text"
                                value={prodSearch}
                                onChange={(e) => { setProdSearch(e.target.value); setIsProdDropdownOpen(true); }}
                                onFocus={() => setIsProdDropdownOpen(true)}
                                placeholder="THÊM SẢN PHẨM MỚI..."
                                className="w-full pl-10 pr-4 py-3 bg-black border-2 border-slate-700 rounded-xl text-white font-black text-sm outline-none focus:border-primary shadow-inner placeholder-slate-600"
                            />
                            {isProdDropdownOpen && prodSearch && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-800 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                                    {filteredProducts.length === 0 ? (
                                        <div className="p-4 text-center text-xs font-black text-slate-400 uppercase">Không tìm thấy sản phẩm</div>
                                    ) : (
                                        filteredProducts.map(p => {
                                            // CẬP NHẬT: Lấy giá cũ nếu có
                                            const lastPrice = wholesalePrices[p.id];
                                            return (
                                                <button key={p.id} onClick={() => handleAddProductToEdit(p)} className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 flex items-center group transition-colors">
                                                    <Tag size={14} className={`mr-3 ${lastPrice !== undefined ? 'text-orange-500' : 'text-slate-300'} group-hover:text-primary`} />
                                                    <div className="flex-1">
                                                        <div className="text-xs font-black text-black uppercase">{p.name}</div>
                                                        <div className="flex justify-between items-center mt-1">
                                                            <div className="text-[10px] text-slate-400">Giá niêm yết: {formatNumber(p.sellingPrice)} ₫</div>
                                                            {lastPrice !== undefined && (
                                                                <div className="text-[10px] font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">Giá cũ: {formatNumber(lastPrice)} ₫</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                        <input type="number" value={addQty} onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value) || 0))} className="w-16 px-2 py-3 bg-black border-2 border-slate-700 rounded-xl text-center font-black text-primary outline-none focus:border-primary" min="1" />
                        <button onClick={() => setIsProdDropdownOpen(true)} className="p-3 bg-primary text-white rounded-xl shadow-lg active:scale-95 transition-transform"><Plus size={24} strokeWidth={4} /></button>
                    </div>
                </div>

                <div className="bg-white rounded-xl border-2 border-slate-800 shadow-lg overflow-hidden flex flex-col flex-1">
                    <div className="bg-slate-800 p-3 text-white flex justify-between items-center">
                        <h4 className="text-xs font-black uppercase flex items-center tracking-tighter"><ShoppingBag className="mr-2" size={16} /> Chi tiết hàng hóa</h4>
                        <span className="bg-primary px-2 py-0.5 rounded-full text-[10px] font-black">{editedItems.length} SP</span>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-[300px]">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                <tr className="text-[10px] font-black text-slate-500 uppercase">
                                    <th className="p-3">Sản phẩm</th>
                                    <th className="p-3 text-center w-32">Số lượng</th>
                                    <th className="p-3 text-right w-40">Giá bán (₫)</th>
                                    <th className="p-3 text-right w-40">Thành tiền</th>
                                    <th className="p-3 text-center w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {editedItems.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3">
                                            <div className="font-bold text-xs text-slate-800 uppercase leading-tight line-clamp-2">{item.productName}</div>
                                            {item.isCombo && <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded font-black uppercase">Combo</span>}
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center space-x-1">
                                                <button onClick={() => updateItem(idx, { quantity: Math.max(1, item.quantity - 1) })} className="p-1 bg-slate-200 rounded hover:bg-slate-300 text-slate-900 border border-slate-300 shadow-sm"><Minus size={12}/></button>
                                                <input type="number" value={item.quantity} onChange={e => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} className="w-12 py-1 text-center font-black text-sm border-2 border-slate-300 rounded-lg outline-none text-slate-900 bg-white" />
                                                <button onClick={() => updateItem(idx, { quantity: item.quantity + 1 })} className="p-1 bg-slate-200 rounded hover:bg-slate-300 text-slate-900 border border-slate-300 shadow-sm"><Plus size={12}/></button>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <NumericInput value={item.price} onChange={val => updateItem(idx, { price: val })} className="w-full p-1.5 border-2 border-slate-300 rounded-lg text-right font-black text-xs outline-none focus:border-primary text-slate-900 bg-white shadow-inner" />
                                        </td>
                                        <td className="p-3 text-right font-black text-sm text-primary">{formatNumber(item.price * item.quantity)} ₫</td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => setEditedItems(editedItems.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-t-4 border-slate-800">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng tiền đơn mới</p>
                            <div className="text-3xl font-black text-primary tracking-tighter">{formatNumber(newTotal)} <span className="text-xs font-black italic">₫</span></div>
                        </div>
                        <div className="text-right">
                             <p className="text-[10px] font-black text-slate-400 uppercase">Ship: {formatNumber(shippingFee)} ₫</p>
                            <p className={`text-sm font-black ${newTotal - sale.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>Chênh lệch: {newTotal - sale.total >= 0 ? '+' : ''}{formatNumber(newTotal - sale.total)} ₫</p>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border-t-2 border-slate-100 flex justify-end space-x-3 flex-shrink-0">
          <button onClick={onClose} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition font-black text-xs uppercase" disabled={isProcessing}>Hủy bỏ</button>
          <button onClick={handleSave} disabled={isProcessing} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase shadow-lg flex items-center transition active:scale-95 disabled:bg-slate-300">
            {isProcessing ? <Loader className="animate-spin mr-2" size={18} /> : <Save size={18} className="mr-2" />}
            Xác nhận lưu đơn
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaleEditModal;
