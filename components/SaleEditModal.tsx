
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sale, Customer, PaymentMethod, Shipper, SaleItem, Product } from '../types';
import { X, Save, Edit3, ShoppingBag, Plus, Minus, Trash2, Truck, Wallet, FileCheck2, AlertCircle, Loader, Users, Coins, Search, Tag, Calendar, ChevronUp, ChevronDown, UserPlus, Check, Phone, MapPin, CheckCircle2, Clock, RotateCcw, ArrowDownLeft, ArrowUpRight, Info } from 'lucide-react';
import { doc, serverTimestamp, runTransaction, collection, addDoc, Timestamp, increment, getDoc, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { formatNumber, parseNumber, getLocalYYYYMMDD } from '../utils/formatting';
import CustomerModal from './CustomerModal';

interface SaleEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  customers: Customer[];
  paymentMethods: PaymentMethod[];
  shippers: Shipper[];
  products: Product[];
}

const getTodayString = () => getLocalYYYYMMDD();

const NumericInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    className?: string;
    placeholder?: string;
    onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
    onBlur?: () => void;
    isCurrency?: boolean;
    autoFocus?: boolean;
}> = ({ value, onChange, className, placeholder, onFocus, onBlur, isCurrency = true, autoFocus = false }) => {
    const [localValue, setLocalValue] = useState(isCurrency ? formatNumber(value) : value.toString());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    useEffect(() => {
        const parsedLocal = parseNumber(localValue);
        if (value !== parsedLocal) {
             setLocalValue(isCurrency ? formatNumber(value) : value.toString());
        }
    }, [value, isCurrency, localValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setLocalValue(raw);
        onChange(parseNumber(raw));
    };

    const handleBlur = (e?: React.FocusEvent<HTMLInputElement>) => {
        const parsed = parseNumber(localValue);
        setLocalValue(isCurrency ? formatNumber(parsed) : parsed.toString());
        if (onBlur) onBlur();
    };

    return (
        <input
            ref={inputRef}
            type="text"
            inputMode={isCurrency ? "numeric" : "decimal"}
            value={localValue}
            placeholder={placeholder}
            className={className}
            onFocus={(e) => {
                if (value === 0) setLocalValue("");
                onFocus?.(e);
            }}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={(e) => {
                if (e.key === 'Enter') handleBlur();
            }}
        />
    );
};

const SaleEditModal: React.FC<SaleEditModalProps> = ({ isOpen, onClose, sale, customers, paymentMethods, shippers, products }) => {
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [shipperId, setShipperId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  
  // Payment & Debt State
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'debt'>('paid');
  const [debtType, setDebtType] = useState<'full' | 'partial'>('full'); // 'full' = nợ 100% (amountPaid = 0), 'partial' = trả trước 1 phần
  const [customPaidAmount, setCustomPaidAmount] = useState<number>(0);

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
    setLocalCustomers(customers);
  }, [customers]);

  useEffect(() => {
    if (isOpen && sale) {
      setCustomerId(sale.customerId || '');
      setCustSearch(sale.customerName || '');
      setShipperId(sale.shipperId || '');
      setPaymentMethodId(sale.paymentMethodId || '');
      
      const origPaid = sale.amountPaid || 0;
      const origTotal = sale.total || 0;
      const isOriginallyDebt = sale.status === 'debt' || origPaid < origTotal;
      
      setPaymentStatus(isOriginallyDebt ? 'debt' : 'paid');
      if (isOriginallyDebt) {
        if (origPaid === 0) {
          setDebtType('full');
          setCustomPaidAmount(0);
        } else {
          setDebtType('partial');
          setCustomPaidAmount(origPaid);
        }
      } else {
        setDebtType('full');
        setCustomPaidAmount(origTotal);
      }

      setShippingMode((sale.shippingStatus as 'pending' | 'none' | 'order' | 'shipped') || 'none');
      setShippingFee(sale.shippingFee || 0);
      setIssueInvoice(sale.issueInvoice || false);
      setEditedItems(sale.items ? JSON.parse(JSON.stringify(sale.items)) : []);
      if (sale.createdAt) {
          setSaleDate(getLocalYYYYMMDD(sale.createdAt.toDate()));
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

    const customer = localCustomers.find(c => c.id === customerId);
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
  }, [customerId, localCustomers]);

  const newTotal = useMemo(() => {
    const itemsTotal = editedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    return itemsTotal + shippingFee;
  }, [editedItems, shippingFee]);

  // Số tiền thực thu sau khi sửa
  const effectiveAmountPaid = useMemo(() => {
    if (paymentStatus === 'paid') {
      return newTotal;
    }
    if (debtType === 'full') {
      return 0;
    }
    return Math.max(0, Math.min(newTotal, customPaidAmount));
  }, [paymentStatus, debtType, customPaidAmount, newTotal]);

  // Số tiền còn nợ sau khi sửa
  const remainingDebt = useMemo(() => {
    return Math.max(0, newTotal - effectiveAmountPaid);
  }, [newTotal, effectiveAmountPaid]);

  // Thông tin số tiền và tài khoản ban đầu
  const originalAmountPaid = sale?.amountPaid || 0;
  const originalPaymentMethodId = sale?.paymentMethodId || '';
  const originalPaymentMethodName = sale?.paymentMethodName || paymentMethods.find(p => p.id === originalPaymentMethodId)?.name || 'N/A';
  const amountDiff = effectiveAmountPaid - originalAmountPaid;

  const filteredCustomers = useMemo(() => {
      if (!custSearch) return localCustomers.slice(0, 15);
      const lower = custSearch.toLowerCase();
      return localCustomers.filter(c => (c.name || '').toLowerCase().includes(lower) || (c.phone || '').includes(lower) || (c.address || '').toLowerCase().includes(lower)).slice(0, 15);
  }, [localCustomers, custSearch]);

  const filteredProducts = useMemo(() => {
    if (!prodSearch) return [];
    const lower = prodSearch.toLowerCase();
    return products.filter(p => (p.name || '').toLowerCase().includes(lower) || (p.shortName || '').toLowerCase().includes(lower)).slice(0, 10);
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

  const handleSaveNewCustomer = async (data: { name: string; phone?: string; address?: string }) => {
    try {
      const docRef = await addDoc(collection(db, 'customers'), {
        name: data.name.trim(),
        phone: (data.phone || '').trim(),
        address: (data.address || '').trim(),
        type: 'retail',
        createdAt: serverTimestamp()
      });
      const newCust: Customer = {
        id: docRef.id,
        name: data.name.trim(),
        phone: (data.phone || '').trim(),
        address: (data.address || '').trim(),
        type: 'retail'
      };
      setLocalCustomers(prev => [newCust, ...prev]);
      setCustomerId(docRef.id);
      setCustSearch(data.name.trim());
      setIsAddCustomerModalOpen(false);
      setIsCustDropdownOpen(false);
    } catch (e: any) {
      console.error("Lỗi thêm khách hàng mới:", e);
      alert("Lỗi khi thêm khách hàng: " + (e?.message || e));
    }
  };

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

  const moveItemUp = (index: number) => {
    if (index <= 0) return;
    setEditedItems(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  const moveItemDown = (index: number) => {
    if (index >= editedItems.length - 1) return;
    setEditedItems(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  const handleSave = async () => {
    if (!sale) return;
    if (editedItems.length === 0) {
      alert("Đơn hàng không thể để trống sản phẩm.");
      return;
    }
    
    // Nếu có phát sinh thu tiền thực tế (effectiveAmountPaid > 0), bắt buộc phải có tài khoản thu
    if (effectiveAmountPaid > 0 && !paymentMethodId) {
      alert("Vui lòng chọn tài khoản thu tiền.");
      return;
    }

    setIsProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', sale.id);
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) throw "Đơn hàng không tồn tại.";
        const oldData = saleSnap.data() as Sale;
        const oldAmountPaid = oldData.amountPaid || 0;
        const oldMethodId = oldData.paymentMethodId || '';

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

        // Fetch tài khoản thanh toán liên quan
        let oldAccSnap = null;
        let newAccSnap = null;

        if (oldMethodId) {
            oldAccSnap = await transaction.get(doc(db, 'paymentMethods', oldMethodId));
        }

        if (paymentMethodId && paymentMethodId !== oldMethodId) {
            newAccSnap = await transaction.get(doc(db, 'paymentMethods', paymentMethodId));
        } else if (paymentMethodId && paymentMethodId === oldMethodId) {
            newAccSnap = oldAccSnap;
        }

        const selectedDateObj = new Date(saleDate);
        const originalDate = oldData.createdAt?.toDate() || new Date();
        selectedDateObj.setHours(originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds());
        const finalCreatedAt = Timestamp.fromDate(selectedDateObj);

        const shortId = sale.id.substring(0, 8).toUpperCase();

        // 1. Tính toán chênh lệch tồn kho & hóa đơn đỏ
        const inventoryDiffs: Record<string, number> = {};
        const invoiceDiffs: Record<string, number> = {};

        for (const oldItem of oldData.items) {
            const productData = productDocs[oldItem.productId];
            if (oldItem.isCombo && productData?.comboItems) {
                for (const cItem of productData.comboItems) {
                    const totalReturn = cItem.quantity * oldItem.quantity;
                    if (oldData.warehouseId) inventoryDiffs[cItem.productId] = (inventoryDiffs[cItem.productId] || 0) + totalReturn;
                    if (oldData.issueInvoice) invoiceDiffs[cItem.productId] = (invoiceDiffs[cItem.productId] || 0) + totalReturn;
                }
            } else {
                if (oldData.warehouseId) inventoryDiffs[oldItem.productId] = (inventoryDiffs[oldItem.productId] || 0) + oldItem.quantity;
                if (oldData.issueInvoice) invoiceDiffs[oldItem.productId] = (invoiceDiffs[oldItem.productId] || 0) + oldItem.quantity;
            }
        }

        for (const newItem of editedItems) {
            const productData = productDocs[newItem.productId];
            if (newItem.isCombo && productData?.comboItems) {
                for (const cItem of productData.comboItems) {
                    const totalDeduct = cItem.quantity * newItem.quantity;
                    if (oldData.warehouseId) inventoryDiffs[cItem.productId] = (inventoryDiffs[cItem.productId] || 0) - totalDeduct;
                    if (issueInvoice) invoiceDiffs[cItem.productId] = (invoiceDiffs[cItem.productId] || 0) - totalDeduct;
                }
            } else {
                if (oldData.warehouseId) inventoryDiffs[newItem.productId] = (inventoryDiffs[newItem.productId] || 0) - newItem.quantity;
                if (issueInvoice) invoiceDiffs[newItem.productId] = (invoiceDiffs[newItem.productId] || 0) - newItem.quantity;
            }
        }

        const whName = oldData.warehouseName || '';

        for (const [pid, diff] of Object.entries(inventoryDiffs)) {
            if (diff !== 0 && oldData.warehouseId) {
                const invRef = doc(db, 'products', pid, 'inventory', oldData.warehouseId);
                transaction.set(invRef, {
                    stock: increment(diff),
                    warehouseId: oldData.warehouseId,
                    warehouseName: whName
                }, { merge: true });
            }
        }

        for (const [pid, diff] of Object.entries(invoiceDiffs)) {
            if (diff !== 0) {
                transaction.update(doc(db, 'products', pid), { totalInvoicedStock: increment(diff) });
            }
        }

        // 2. Xử lý điều chỉnh tiền và số dư tài khoản chính xác
        const selectedMethod = paymentMethods.find(p => p.id === paymentMethodId);
        const oldMethodName = oldData.paymentMethodName || oldAccSnap?.data()?.name || 'N/A';
        const newMethodName = selectedMethod?.name || newAccSnap?.data()?.name || 'N/A';

        let newPaymentHistory = oldData.paymentHistory || [];

        // Trường hợp 1: Chuyển tài khoản thu khác
        if (oldMethodId && paymentMethodId && oldMethodId !== paymentMethodId) {
            // Rút toàn bộ tiền cũ khỏi tài khoản cũ (nếu cũ có thu tiền > 0)
            if (oldAmountPaid > 0 && oldAccSnap && oldAccSnap.exists()) {
                const oldBal = Number(oldAccSnap.data()?.balance) || 0;
                const finalOldBal = oldBal - oldAmountPaid;
                transaction.update(oldAccSnap.ref, { balance: finalOldBal });
                transaction.set(doc(collection(db, 'paymentLogs')), {
                    paymentMethodId: oldMethodId,
                    paymentMethodName: oldMethodName,
                    type: 'withdrawal',
                    amount: oldAmountPaid,
                    balanceAfter: finalOldBal,
                    note: `Rút lại tiền do đổi tài khoản thu/chuyển ghi nợ cho đơn hàng #${shortId}`,
                    relatedId: sale.id,
                    relatedType: 'sale',
                    createdAt: serverTimestamp(),
                    creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Hệ thống'
                });
            }

            // Nạp tiền mới vào tài khoản mới (nếu mới có thu tiền > 0)
            if (effectiveAmountPaid > 0 && newAccSnap && newAccSnap.exists()) {
                const newBal = Number(newAccSnap.data()?.balance) || 0;
                const finalNewBal = newBal + effectiveAmountPaid;
                transaction.update(newAccSnap.ref, { balance: finalNewBal });
                transaction.set(doc(collection(db, 'paymentLogs')), {
                    paymentMethodId: paymentMethodId,
                    paymentMethodName: newMethodName,
                    type: 'deposit',
                    amount: effectiveAmountPaid,
                    balanceAfter: finalNewBal,
                    note: `Thu tiền đơn hàng #${shortId} vào tài khoản mới ${newMethodName}`,
                    relatedId: sale.id,
                    relatedType: 'sale',
                    createdAt: serverTimestamp(),
                    creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Hệ thống'
                });
            }

            newPaymentHistory = [...newPaymentHistory, {
                date: Timestamp.now(),
                amount: effectiveAmountPaid - oldAmountPaid,
                note: `Đổi TK thu từ ${oldMethodName} sang ${newMethodName} (Đã thu: ${formatNumber(effectiveAmountPaid)} ₫)`
            }];
        } 
        // Trường hợp 2: Cùng tài khoản (hoặc ban đầu chưa có PTTT)
        else {
            const activeAccSnap = newAccSnap || oldAccSnap;
            const diffAmount = effectiveAmountPaid - oldAmountPaid;

            // Nếu giảm tiền thu (chuyển sang ghi nợ hoặc giảm tiền trả) -> Trừ lại tiền trong tài khoản
            if (diffAmount < 0) {
                const refundAmount = Math.abs(diffAmount);
                if (activeAccSnap && activeAccSnap.exists()) {
                    const curBal = Number(activeAccSnap.data()?.balance) || 0;
                    const finalBal = curBal - refundAmount;
                    transaction.update(activeAccSnap.ref, { balance: finalBal });
                    transaction.set(doc(collection(db, 'paymentLogs')), {
                        paymentMethodId: activeAccSnap.id,
                        paymentMethodName: activeAccSnap.data()?.name || oldMethodName,
                        type: 'withdrawal',
                        amount: refundAmount,
                        balanceAfter: finalBal,
                        note: effectiveAmountPaid === 0 
                            ? `Trừ lại tiền do chuyển đơn hàng #${shortId} sang Ghi nợ (sửa đơn)` 
                            : `Trừ lại ${formatNumber(refundAmount)} ₫ do giảm tiền thu đơn hàng #${shortId}`,
                        relatedId: sale.id,
                        relatedType: 'sale',
                        createdAt: serverTimestamp(),
                        creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Hệ thống'
                    });
                }
                newPaymentHistory = [...newPaymentHistory, {
                    date: Timestamp.now(),
                    amount: diffAmount,
                    note: effectiveAmountPaid === 0 
                        ? `Chuyển sang Ghi nợ (Đã trừ lại ${formatNumber(refundAmount)} ₫ trong TK ${oldMethodName})` 
                        : `Điều chỉnh giảm tiền thu ${formatNumber(refundAmount)} ₫`
                }];
            } 
            // Nếu tăng tiền thu (chuyển từ nợ sang đã thanh toán hoặc thu thêm) -> Nạp thêm tiền
            else if (diffAmount > 0) {
                if (activeAccSnap && activeAccSnap.exists()) {
                    const curBal = Number(activeAccSnap.data()?.balance) || 0;
                    const finalBal = curBal + diffAmount;
                    transaction.update(activeAccSnap.ref, { balance: finalBal });
                    transaction.set(doc(collection(db, 'paymentLogs')), {
                        paymentMethodId: activeAccSnap.id,
                        paymentMethodName: activeAccSnap.data()?.name || newMethodName,
                        type: 'deposit',
                        amount: diffAmount,
                        balanceAfter: finalBal,
                        note: oldAmountPaid === 0 
                            ? `Thu tiền cho đơn hàng #${shortId} (sửa từ ghi nợ sang đã thanh toán)` 
                            : `Thu thêm tiền cho đơn hàng #${shortId}`,
                        relatedId: sale.id,
                        relatedType: 'sale',
                        createdAt: serverTimestamp(),
                        creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Hệ thống'
                    });
                }
                newPaymentHistory = [...newPaymentHistory, {
                    date: Timestamp.now(),
                    amount: diffAmount,
                    note: oldAmountPaid === 0 
                        ? `Thanh toán đơn hàng qua ${newMethodName}` 
                        : `Thu thêm ${formatNumber(diffAmount)} ₫ qua ${newMethodName}`
                }];
            }
        }

        const selectedCustomer = localCustomers.find(c => c.id === customerId);
        const selectedShipper = shippers.find(s => s.id === shipperId);
        const newStatus = effectiveAmountPaid >= newTotal ? 'paid' : 'debt';

        transaction.update(saleRef, {
          items: editedItems,
          productIds: editedItems.map(i => i.productId),
          total: newTotal,
          shippingFee: shippingFee,
          issueInvoice: issueInvoice,
          customerId: customerId || null,
          customerName: selectedCustomer ? selectedCustomer.name : (custSearch || 'Khách vãng lai'),
          customerPhone: selectedCustomer?.phone || (sale as any).customerPhone || '',
          customerAddress: selectedCustomer?.address || (sale as any).customerAddress || '',
          paymentMethodId: effectiveAmountPaid > 0 ? (paymentMethodId || null) : (paymentMethodId || oldData.paymentMethodId || null),
          paymentMethodName: effectiveAmountPaid > 0 ? (selectedMethod?.name || null) : (selectedMethod?.name || oldData.paymentMethodName || null),
          shipperId: shipperId || null,
          shipperName: selectedShipper ? selectedShipper.name : null,
          status: newStatus,
          shippingStatus: shippingMode,
          createdAt: finalCreatedAt, 
          amountPaid: effectiveAmountPaid,
          paymentHistory: newPaymentHistory,
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
      {isAddCustomerModalOpen && (
        <CustomerModal
          customer={null}
          onClose={() => setIsAddCustomerModalOpen(false)}
          onSave={handleSaveNewCustomer}
          existingCustomers={localCustomers}
        />
      )}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl animate-fade-in-down flex flex-col max-h-[95vh] overflow-hidden border border-slate-200">
        <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900 text-white flex-shrink-0">
          <h3 className="text-lg font-black uppercase tracking-tighter flex items-center">
            <Edit3 className="mr-2 text-primary" size={20} />
            Sửa đơn hàng #{sale.id.substring(0, 8)}
          </h3>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors cursor-pointer">
            <X size={28} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm space-y-4">
                <div className="relative" ref={custDropdownRef}>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase">Khách hàng</label>
                    <button
                      type="button"
                      onClick={() => setIsAddCustomerModalOpen(true)}
                      className="text-[10px] font-black uppercase text-primary hover:text-primary-hover flex items-center gap-1 bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-md transition cursor-pointer"
                    >
                      <UserPlus size={12} />
                      <span>+ Thêm mới</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Tìm khách hàng hoặc gõ tên..."
                      value={custSearch}
                      onChange={(e) => { setCustSearch(e.target.value); setIsCustDropdownOpen(true); }}
                      onFocus={() => setIsCustDropdownOpen(true)}
                      className="w-full pl-9 pr-8 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm font-bold text-slate-900 bg-white"
                    />
                    {custSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustSearch('');
                          setCustomerId('');
                          setIsCustDropdownOpen(true);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                        title="Xóa tìm kiếm / Bỏ chọn"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {isCustDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-800 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustDropdownOpen(false);
                          setIsAddCustomerModalOpen(true);
                        }}
                        className="w-full text-left px-3 py-2.5 bg-primary/10 hover:bg-primary/20 border-b border-slate-200 font-black text-xs text-primary flex items-center gap-2 transition cursor-pointer"
                      >
                        <UserPlus size={15} />
                        <span>+ Thêm khách hàng mới</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCustomerId('');
                          setCustSearch('Khách vãng lai');
                          setIsCustDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 border-b border-slate-100 font-bold text-xs text-slate-600 flex justify-between items-center cursor-pointer"
                      >
                        <span>Khách vãng lai</span>
                        <span className="text-[10px] text-slate-400 font-normal">Không lưu SĐT</span>
                      </button>

                      {filteredCustomers.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400 font-bold">
                          Không tìm thấy khách hàng
                        </div>
                      ) : (
                        filteredCustomers.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setCustomerId(c.id);
                              setCustSearch(c.name);
                              setIsCustDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b last:border-0 text-xs transition-colors flex items-center justify-between cursor-pointer ${customerId === c.id ? 'bg-blue-50 font-black' : 'font-bold'}`}
                          >
                            <div className="flex-1 min-w-0 mr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-900 truncate">{c.name}</span>
                                {c.type === 'wholesale' && (
                                  <span className="px-1.5 py-0.2 text-[9px] font-black uppercase rounded bg-purple-100 text-purple-700 shrink-0">Sỉ</span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 flex flex-wrap gap-2 mt-0.5">
                                {c.phone && <span>SĐT: {c.phone}</span>}
                                {c.address && <span className="truncate max-w-[160px]">&bull; {c.address}</span>}
                              </div>
                            </div>
                            {customerId === c.id && <Check size={16} className="text-primary shrink-0" />}
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {/* Customer info preview badge */}
                  {customerId && (
                    <div className="mt-2 p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg flex justify-between items-center text-xs">
                      <div className="overflow-hidden pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-blue-950 truncate">
                            {localCustomers.find(c => c.id === customerId)?.name || custSearch}
                          </span>
                          {localCustomers.find(c => c.id === customerId)?.type === 'wholesale' && (
                            <span className="px-1.5 py-0.2 text-[9px] font-black uppercase rounded bg-purple-200 text-purple-800 shrink-0">Khách sỉ</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-600 truncate mt-0.5">
                          {localCustomers.find(c => c.id === customerId)?.phone && <span>SĐT: {localCustomers.find(c => c.id === customerId)?.phone}</span>}
                          {localCustomers.find(c => c.id === customerId)?.address && <span> &bull; {localCustomers.find(c => c.id === customerId)?.address}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerId('');
                          setCustSearch('');
                          setIsCustDropdownOpen(true);
                        }}
                        className="text-slate-400 hover:text-red-500 p-1 shrink-0 rounded transition cursor-pointer"
                        title="Đổi khách hàng"
                      >
                        <X size={14} />
                      </button>
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
                    {/* KHU VỰC ĐIỀU CHỈNH THANH TOÁN & GHI NỢ */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border-2 border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                                <Wallet size={14} className="text-primary" /> Trạng thái thanh toán
                            </label>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                                {paymentStatus === 'paid' ? 'Đủ tiền' : (debtType === 'full' ? 'Nợ 100%' : 'Nợ 1 phần')}
                            </span>
                        </div>

                        {/* Nút chuyển nhanh: Đã thanh toán / Ghi nợ */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-lg">
                            <button
                                type="button"
                                onClick={() => {
                                    setPaymentStatus('paid');
                                }}
                                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-black transition-all cursor-pointer ${
                                    paymentStatus === 'paid'
                                        ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/30'
                                        : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/50'
                                }`}
                            >
                                <CheckCircle2 size={15} />
                                <span>ĐÃ THANH TOÁN</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPaymentStatus('debt');
                                    // Nếu chuyển sang nợ và chưa chọn partial thì mặc định nợ 100% (customPaidAmount = 0)
                                    if (paymentStatus === 'paid') {
                                      setDebtType('full');
                                      setCustomPaidAmount(0);
                                    }
                                }}
                                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-black transition-all cursor-pointer ${
                                    paymentStatus === 'debt'
                                        ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400/30'
                                        : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/50'
                                }`}
                            >
                                <Clock size={15} />
                                <span>GHI NỢ</span>
                            </button>
                        </div>

                        {/* Tùy chọn chi tiết khi Ghi nợ */}
                        {paymentStatus === 'debt' && (
                            <div className="bg-white p-3 rounded-lg border border-amber-200/80 space-y-2.5 animate-fade-in">
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDebtType('full');
                                            setCustomPaidAmount(0);
                                        }}
                                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black border transition cursor-pointer ${
                                            debtType === 'full'
                                                ? 'bg-amber-50 border-amber-500 text-amber-900 font-black shadow-xs'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        Nợ toàn bộ (0 ₫)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDebtType('partial');
                                            if (customPaidAmount === 0 && originalAmountPaid > 0 && originalAmountPaid < newTotal) {
                                              setCustomPaidAmount(originalAmountPaid);
                                            } else if (customPaidAmount === 0) {
                                              setCustomPaidAmount(Math.round(newTotal / 2));
                                            }
                                        }}
                                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black border transition cursor-pointer ${
                                            debtType === 'partial'
                                                ? 'bg-amber-50 border-amber-500 text-amber-900 font-black shadow-xs'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        Trả trước 1 phần
                                    </button>
                                </div>

                                {debtType === 'partial' && (
                                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                                        <div className="flex justify-between items-center text-[10px] font-black text-slate-500">
                                            <span>SỐ TIỀN KHÁCH ĐÃ TRẢ:</span>
                                            <span className="text-emerald-600 font-black">{formatNumber(customPaidAmount)} ₫</span>
                                        </div>
                                        <NumericInput
                                            value={customPaidAmount}
                                            onChange={(val) => setCustomPaidAmount(Math.min(newTotal, Math.max(0, val)))}
                                            className="w-full px-3 py-2 border-2 border-amber-300 rounded-lg text-right font-black text-sm outline-none text-slate-900 bg-amber-50/40 focus:bg-white focus:border-amber-500"
                                        />
                                        <div className="flex justify-between gap-1 text-[10px] text-slate-500">
                                            <button
                                                type="button"
                                                onClick={() => setCustomPaidAmount(0)}
                                                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded font-bold cursor-pointer"
                                            >
                                                0 ₫
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCustomPaidAmount(Math.round(newTotal / 2))}
                                                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded font-bold cursor-pointer"
                                            >
                                                50% ({formatNumber(Math.round(newTotal / 2))})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCustomPaidAmount(newTotal)}
                                                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded font-bold cursor-pointer"
                                            >
                                                Đủ 100%
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tổng kết dòng tiền sau điều chỉnh */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                            <div className="flex justify-between items-center font-bold text-slate-600">
                                <span>Tổng tiền đơn:</span>
                                <span className="font-black text-slate-900">{formatNumber(newTotal)} ₫</span>
                            </div>
                            <div className="flex justify-between items-center font-bold">
                                <span className="text-slate-600">Thực thu vào tài khoản:</span>
                                <span className={`font-black ${effectiveAmountPaid > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {formatNumber(effectiveAmountPaid)} ₫
                                </span>
                            </div>
                            <div className="flex justify-between items-center font-black pt-1 border-t border-slate-100">
                                <span className="text-red-500 uppercase text-[11px]">Còn nợ khách hàng:</span>
                                <span className="text-red-600 text-sm">{formatNumber(remainingDebt)} ₫</span>
                            </div>
                        </div>

                        {/* Tài khoản thu tiền */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                                {effectiveAmountPaid > 0 ? (
                                    <span className="text-slate-700">Tài khoản thu tiền ({formatNumber(effectiveAmountPaid)} ₫) *</span>
                                ) : (
                                    <span>Tài khoản giao dịch (Không thu tiền)</span>
                                )}
                            </label>
                            <select
                                value={paymentMethodId}
                                onChange={e => setPaymentMethodId(e.target.value)}
                                className={`w-full px-3 py-2 border-2 rounded-lg font-bold text-sm outline-none text-slate-900 bg-white shadow-sm h-[40px] ${
                                    effectiveAmountPaid > 0 && !paymentMethodId ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200 focus:border-primary'
                                }`}
                            >
                                <option value="">-- {effectiveAmountPaid > 0 ? 'CHỌN TÀI KHOẢN THU' : 'CHỌN TÀI KHOẢN (TÙY CHỌN)'} --</option>
                                {paymentMethods.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} {p.balance !== undefined ? `(${formatNumber(p.balance)} ₫)` : ''}
                                    </option>
                                ))}
                            </select>
                            {effectiveAmountPaid > 0 && !paymentMethodId && (
                                <p className="text-red-500 text-[11px] mt-1 font-bold">Vui lòng chọn tài khoản để ghi nhận {formatNumber(effectiveAmountPaid)} ₫.</p>
                            )}
                        </div>

                        {/* Cảnh báo logic số dư tài khoản tự động (Smart Balance Alert) */}
                        {originalAmountPaid > 0 && effectiveAmountPaid < originalAmountPaid && (
                            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex gap-2 items-start animate-fade-in">
                                <RotateCcw size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                    <div className="font-black text-[11px] uppercase text-amber-800">Tự động hoàn / trừ lại số dư</div>
                                    <div className="text-[11px] leading-relaxed">
                                        Đơn hàng trước đó đã thu <strong>{formatNumber(originalAmountPaid)} ₫</strong> vào <strong>{originalPaymentMethodName}</strong>.
                                        Khi lưu, hệ thống sẽ <strong>tự động trừ lại {formatNumber(originalAmountPaid - effectiveAmountPaid)} ₫</strong> khỏi tài khoản này và chuyển sang ghi nợ chính xác.
                                    </div>
                                </div>
                            </div>
                        )}

                        {amountDiff > 0 && (
                            <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 text-xs flex gap-2 items-start animate-fade-in">
                                <ArrowDownLeft size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                    <div className="font-black text-[11px] uppercase text-emerald-800">Tự động nạp thêm vào tài khoản</div>
                                    <div className="text-[11px] leading-relaxed">
                                        Hệ thống sẽ <strong>nạp thêm {formatNumber(amountDiff)} ₫</strong> vào tài khoản thu được chọn.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
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
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
                    <div className="flex gap-2 relative">
                        <div className="flex-1 relative" ref={prodDropdownRef}>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                            <input 
                                type="text"
                                value={prodSearch}
                                onChange={(e) => { setProdSearch(e.target.value); setIsProdDropdownOpen(true); }}
                                onFocus={() => setIsProdDropdownOpen(true)}
                                placeholder="THÊM SẢN PHẨM MỚI..."
                                className="w-full pl-10 pr-10 py-3 bg-black border-2 border-slate-700 rounded-xl text-white font-black text-sm outline-none focus:border-primary shadow-inner placeholder-slate-600"
                            />
                            {prodSearch && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProdSearch('');
                                        setIsProdDropdownOpen(false);
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 active:scale-90 text-slate-300 hover:text-white transition"
                                    title="Xóa nội dung"
                                >
                                    <X size={14} className="stroke-[2.5]" />
                                </button>
                            )}
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
                                                        <div className="text-xs font-black text-black uppercase">
                                                            {p.name}
                                                            {p.shortName && (
                                                                <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[9px] font-black rounded border border-amber-300 inline-block">
                                                                    {p.shortName}
                                                                </span>
                                                            )}
                                                        </div>
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

                    <div className="flex-1 overflow-auto min-h-[300px]">
                        <table className="w-full text-left border-collapse min-w-[550px]">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                <tr className="text-[10px] font-black text-slate-500 uppercase">
                                    <th className="p-3 w-16 text-center">TT</th>
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
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-0.5">
                                                <button 
                                                    type="button"
                                                    onClick={() => moveItemUp(idx)}
                                                    disabled={idx === 0}
                                                    className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition"
                                                    title="Di chuyển lên trên"
                                                >
                                                    <ChevronUp size={12} strokeWidth={2.5}/>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => moveItemDown(idx)}
                                                    disabled={idx === editedItems.length - 1}
                                                    className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition"
                                                    title="Di chuyển xuống dưới"
                                                >
                                                    <ChevronDown size={12} strokeWidth={2.5}/>
                                                </button>
                                            </div>
                                        </td>
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
                            <p className={`text-sm font-black ${newTotal - (sale.total || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>Chênh lệch: {newTotal - (sale.total || 0) >= 0 ? '+' : ''}{formatNumber(newTotal - (sale.total || 0))} ₫</p>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border-t-2 border-slate-100 flex justify-end space-x-3 flex-shrink-0">
          <button onClick={onClose} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition font-black text-xs uppercase cursor-pointer" disabled={isProcessing}>Hủy bỏ</button>
          <button onClick={handleSave} disabled={isProcessing} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase shadow-lg flex items-center transition active:scale-95 disabled:bg-slate-300 cursor-pointer">
            {isProcessing ? <Loader className="animate-spin mr-2" size={18} /> : <Save size={18} className="mr-2" />}
            Xác nhận lưu đơn
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaleEditModal;
