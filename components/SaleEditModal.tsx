import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sale, Customer, PaymentMethod, Shipper, SaleItem, Product } from '../types';
import { 
  X, Save, Edit3, ShoppingBag, Plus, Minus, Trash2, Truck, Wallet, 
  AlertCircle, Loader, Users, Coins, Search, Tag, Calendar, 
  ChevronUp, ChevronDown, UserPlus, Check, CheckCircle2, Clock, 
  History, Info, ArrowRight, ShieldCheck, CheckCheck
} from 'lucide-react';
import { 
  doc, serverTimestamp, runTransaction, collection, addDoc, 
  Timestamp, increment, query, where, orderBy, limit, onSnapshot 
} from 'firebase/firestore';
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

export interface EditablePaymentHistoryItem {
  id?: string;
  date: any;
  amount: number;
  paymentMethodId?: string;
  paymentMethodName?: string;
  note?: string;
}

const SaleEditModal: React.FC<SaleEditModalProps> = ({ 
  isOpen, 
  onClose, 
  sale, 
  customers, 
  paymentMethods, 
  shippers, 
  products 
}) => {
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  
  // Customer & Shipping
  const [customerId, setCustomerId] = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [isCustDropdownOpen, setIsCustDropdownOpen] = useState(false);
  const custDropdownRef = useRef<HTMLDivElement>(null);

  const [shipperId, setShipperId] = useState('');
  const [shippingMode, setShippingMode] = useState<'none' | 'pending' | 'shipped' | 'order'>('none');
  const [shippingFee, setShippingFee] = useState(0);
  const [saleDate, setSaleDate] = useState(getTodayString()); 
  const [issueInvoice, setIssueInvoice] = useState(false);
  
  // Products & Items
  const [editedItems, setEditedItems] = useState<SaleItem[]>([]);
  const [prodSearch, setProdSearch] = useState('');
  const [isProdDropdownOpen, setIsProdDropdownOpen] = useState(false);
  const [addQty, setAddQty] = useState(1);
  const prodDropdownRef = useRef<HTMLDivElement>(null);
  const [wholesalePrices, setWholesalePrices] = useState<Record<string, number>>({});

  // Payment & Installments State
  const [paymentHistoryList, setPaymentHistoryList] = useState<EditablePaymentHistoryItem[]>([]);
  const [payThisTime, setPayThisTime] = useState<number>(0);
  const [payMethodId, setPayMethodId] = useState<string>('');
  const [payNote, setPayNote] = useState<string>('');
  const [payDate, setPayDate] = useState<string>(getTodayString());

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setLocalCustomers(customers);
  }, [customers]);

  useEffect(() => {
    if (isOpen && sale) {
      setCustomerId(sale.customerId || '');
      setCustSearch(sale.customerName || '');
      setShipperId(sale.shipperId || '');
      setShippingMode((sale.shippingStatus as any) || 'none');
      setShippingFee(sale.shippingFee || 0);
      setIssueInvoice(sale.issueInvoice || false);
      setEditedItems(sale.items ? JSON.parse(JSON.stringify(sale.items)) : []);
      
      if (sale.createdAt) {
        setSaleDate(getLocalYYYYMMDD(sale.createdAt.toDate()));
      } else {
        setSaleDate(getTodayString());
      }

      // Khởi tạo lịch sử thanh toán các đợt trước
      let initialHistory: EditablePaymentHistoryItem[] = [];
      if (sale.paymentHistory && sale.paymentHistory.length > 0) {
        initialHistory = sale.paymentHistory.map((p, idx) => ({
          id: `hist-${idx}-${Date.now()}`,
          date: p.date,
          amount: Number(p.amount) || 0,
          paymentMethodId: p.paymentMethodId || '',
          paymentMethodName: p.paymentMethodName || paymentMethods.find(m => m.id === p.paymentMethodId)?.name || 'Tiền mặt',
          note: p.note || `Thanh toán đợt ${idx + 1}`
        }));
      } else if (Number(sale.amountPaid) > 0) {
        initialHistory = [{
          id: `hist-0-${Date.now()}`,
          date: sale.createdAt || Timestamp.now(),
          amount: Number(sale.amountPaid),
          paymentMethodId: sale.paymentMethodId || '',
          paymentMethodName: sale.paymentMethodName || paymentMethods.find(m => m.id === sale.paymentMethodId)?.name || 'Tiền mặt',
          note: 'Thanh toán đợt 1'
        }];
      }
      setPaymentHistoryList(initialHistory);

      // Reset đợt thu mới
      setPayThisTime(0);
      setPayDate(getTodayString());
      setPayNote(`Khách thanh toán đợt ${initialHistory.length + 1}`);

      // Chọn tài khoản mặc định cho đợt thu mới: ưu tiên tài khoản đã dùng hoặc tài khoản đầu tiên
      const defaultAccId = sale.paymentMethodId || (paymentMethods.length > 0 ? paymentMethods[0].id : '');
      setPayMethodId(defaultAccId);
    }
  }, [isOpen, sale, paymentMethods]);

  // Logic lấy giá sỉ cũ cho khách sỉ
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

  // Tính tổng tiền đơn mới
  const itemsTotal = useMemo(() => {
    return editedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [editedItems]);

  const newTotal = useMemo(() => {
    return itemsTotal + (Number(shippingFee) || 0);
  }, [itemsTotal, shippingFee]);

  // Tổng số tiền đã thanh toán từ các đợt trước (trong danh sách)
  const totalAlreadyPaid = useMemo(() => {
    return paymentHistoryList.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [paymentHistoryList]);

  // Số tiền còn nợ trước khi thu đợt này
  const remainingDebtBeforeThisPay = useMemo(() => {
    return Math.max(0, newTotal - totalAlreadyPaid);
  }, [newTotal, totalAlreadyPaid]);

  // Giới hạn số tiền thanh toán đợt này không vượt quá số nợ còn lại
  const effectivePayThisTime = useMemo(() => {
    return Math.max(0, Math.min(remainingDebtBeforeThisPay, payThisTime || 0));
  }, [remainingDebtBeforeThisPay, payThisTime]);

  // Tổng tiền đã thanh toán sau khi tính cả đợt thu này
  const effectiveAmountPaid = useMemo(() => {
    return totalAlreadyPaid + effectivePayThisTime;
  }, [totalAlreadyPaid, effectivePayThisTime]);

  // Số tiền còn nợ cuối cùng sau khi lưu
  const finalRemainingDebt = useMemo(() => {
    return Math.max(0, newTotal - effectiveAmountPaid);
  }, [newTotal, effectiveAmountPaid]);

  const filteredCustomers = useMemo(() => {
    if (!custSearch) return localCustomers.slice(0, 15);
    const lower = custSearch.toLowerCase();
    return localCustomers.filter(c => 
      (c.name || '').toLowerCase().includes(lower) || 
      (c.phone || '').includes(lower) || 
      (c.address || '').toLowerCase().includes(lower)
    ).slice(0, 15);
  }, [localCustomers, custSearch]);

  const filteredProducts = useMemo(() => {
    if (!prodSearch) return [];
    const lower = prodSearch.toLowerCase();
    return products.filter(p => 
      (p.name || '').toLowerCase().includes(lower) || 
      (p.shortName || '').toLowerCase().includes(lower)
    ).slice(0, 10);
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
    } catch (err) {
      console.error(err);
      alert("Lỗi khi thêm khách hàng mới.");
    }
  };

  const handleAddProductToEdit = (prod: Product) => {
    const customer = localCustomers.find(c => c.id === customerId);
    let finalPrice = prod.sellingPrice;
    if (customer?.type === 'wholesale' && wholesalePrices[prod.id] !== undefined) {
      finalPrice = wholesalePrices[prod.id];
    }

    const existingIndex = editedItems.findIndex(i => i.productId === prod.id);
    if (existingIndex > -1) {
      const next = [...editedItems];
      next[existingIndex].quantity += addQty;
      setEditedItems(next);
    } else {
      setEditedItems(prev => [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name,
          price: finalPrice,
          quantity: addQty,
          importPrice: prod.importPrice || 0,
          isCombo: prod.isCombo || false
        }
      ]);
    }
    setProdSearch('');
    setIsProdDropdownOpen(false);
    setAddQty(1);
  };

  const updateItem = (index: number, updates: Partial<SaleItem>) => {
    setEditedItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
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

  // Xóa một đợt thanh toán khỏi danh sách lịch sử
  const handleRemoveHistoryItem = (index: number) => {
    const item = paymentHistoryList[index];
    const confirmMsg = `Bạn có chắc chắn muốn xóa Đợt ${index + 1} (${formatNumber(item.amount)} ₫)?\n\nLưu ý: Số tiền này sẽ được trừ lại khỏi tài khoản "${item.paymentMethodName || 'tương ứng'}" khi bạn bấm "Xác nhận lưu đơn".`;
    if (window.confirm(confirmMsg)) {
      setPaymentHistoryList(prev => prev.filter((_, idx) => idx !== index));
    }
  };

  // Lưu toàn bộ đơn hàng
  const handleSave = async () => {
    if (!sale) return;
    if (editedItems.length === 0) {
      alert("Đơn hàng không thể để trống sản phẩm.");
      return;
    }

    // Nếu có thu thêm tiền đợt này (effectivePayThisTime > 0), bắt buộc phải có tài khoản nhận tiền
    if (effectivePayThisTime > 0 && !payMethodId) {
      alert("Vui lòng chọn tài khoản nhận tiền cho đợt thanh toán này ở phần Thanh toán & Thu nợ bên dưới.");
      const el = document.getElementById('pay-method-select');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', sale.id);
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) throw new Error("Đơn hàng không tồn tại trên hệ thống.");
        const oldData = saleSnap.data() as Sale;

        // 1. Lấy thông tin sản phẩm và tính biến động kho
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

        const selectedDateObj = new Date(saleDate);
        const originalDate = oldData.createdAt?.toDate() || new Date();
        selectedDateObj.setHours(originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds());
        const finalCreatedAt = Timestamp.fromDate(selectedDateObj);
        const shortId = sale.id.substring(0, 8).toUpperCase();

        // 2. Tính toán hoàn kho cũ và trừ kho mới
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

        // 3. Xử lý logic tài chính đa đợt (Payment History & Account Balances)
        // Lịch sử ban đầu trong DB:
        const oldHistoryInDb = (oldData.paymentHistory && oldData.paymentHistory.length > 0)
          ? oldData.paymentHistory
          : (Number(oldData.amountPaid) > 0 ? [{
              amount: Number(oldData.amountPaid),
              date: oldData.createdAt || Timestamp.now(),
              paymentMethodId: oldData.paymentMethodId || '',
              paymentMethodName: oldData.paymentMethodName || 'Tiền mặt',
              note: 'Thanh toán đợt 1'
            }] : []);

        // Xây dựng danh sách lịch sử mới hoàn chỉnh:
        const finalPaymentHistory: any[] = paymentHistoryList.map(item => ({
          date: item.date || Timestamp.now(),
          amount: Number(item.amount) || 0,
          paymentMethodId: item.paymentMethodId || null,
          paymentMethodName: item.paymentMethodName || 'Tiền mặt',
          note: item.note || ''
        }));

        // Nếu có đợt thu mới phát sinh:
        if (effectivePayThisTime > 0) {
          const selectedMethod = paymentMethods.find(p => p.id === payMethodId);
          const payDateObj = new Date(payDate);
          const now = new Date();
          payDateObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

          finalPaymentHistory.push({
            date: Timestamp.fromDate(payDateObj),
            amount: effectivePayThisTime,
            paymentMethodId: payMethodId || null,
            paymentMethodName: selectedMethod?.name || 'Tiền mặt',
            note: payNote.trim() || `Khách thanh toán đợt ${finalPaymentHistory.length + 1}`
          });
        }

        // Tính tổng tiền theo từng tài khoản giữa CŨ và MỚI để điều chỉnh số dư và log chuẩn xác
        const oldAmountsByMethod: Record<string, { amount: number; name: string }> = {};
        for (const p of oldHistoryInDb) {
          const mId = p.paymentMethodId || oldData.paymentMethodId || 'default';
          const mName = p.paymentMethodName || oldData.paymentMethodName || 'Tiền mặt';
          if (!oldAmountsByMethod[mId]) oldAmountsByMethod[mId] = { amount: 0, name: mName };
          oldAmountsByMethod[mId].amount += (Number(p.amount) || 0);
        }

        const newAmountsByMethod: Record<string, { amount: number; name: string }> = {};
        for (const p of finalPaymentHistory) {
          const mId = p.paymentMethodId || 'default';
          const mName = p.paymentMethodName || 'Tiền mặt';
          if (!newAmountsByMethod[mId]) newAmountsByMethod[mId] = { amount: 0, name: mName };
          newAmountsByMethod[mId].amount += (Number(p.amount) || 0);
        }

        const allMethodKeys = new Set([
          ...Object.keys(oldAmountsByMethod),
          ...Object.keys(newAmountsByMethod)
        ]);

        for (const mKey of allMethodKeys) {
          if (mKey === 'default' || !mKey) continue;
          const oldAmt = oldAmountsByMethod[mKey]?.amount || 0;
          const newAmt = newAmountsByMethod[mKey]?.amount || 0;
          const diff = newAmt - oldAmt;

          if (diff !== 0) {
            const accRef = doc(db, 'paymentMethods', mKey);
            const accSnap = await transaction.get(accRef);
            if (accSnap.exists()) {
              const curBal = Number(accSnap.data()?.balance) || 0;
              const finalBal = curBal + diff;
              transaction.update(accRef, { balance: finalBal });

              const accName = accSnap.data()?.name || newAmountsByMethod[mKey]?.name || oldAmountsByMethod[mKey]?.name || 'Tài khoản';

              if (diff > 0) {
                // Thu thêm tiền vào tài khoản
                transaction.set(doc(collection(db, 'paymentLogs')), {
                  paymentMethodId: mKey,
                  paymentMethodName: accName,
                  type: 'deposit',
                  amount: diff,
                  balanceAfter: finalBal,
                  note: `Thu tiền đợt ${finalPaymentHistory.length} cho đơn hàng #${shortId}`,
                  relatedId: sale.id,
                  relatedType: 'sale',
                  createdAt: serverTimestamp(),
                  creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Hệ thống'
                });
              } else {
                // Rút / hoàn trả lại số dư do xóa đợt hoặc giảm tiền
                const refundAmt = Math.abs(diff);
                transaction.set(doc(collection(db, 'paymentLogs')), {
                  paymentMethodId: mKey,
                  paymentMethodName: accName,
                  type: 'withdrawal',
                  amount: refundAmt,
                  balanceAfter: finalBal,
                  note: `Trừ/hoàn lại ${formatNumber(refundAmt)} ₫ do điều chỉnh thanh toán đơn hàng #${shortId}`,
                  relatedId: sale.id,
                  relatedType: 'sale',
                  createdAt: serverTimestamp(),
                  creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Hệ thống'
                });
              }
            }
          }
        }

        // 4. Cập nhật thông tin đơn hàng
        const newTotalPaid = finalPaymentHistory.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const newDebt = Math.max(0, newTotal - newTotalPaid);
        const newStatus = newDebt === 0 ? 'paid' : 'debt';

        const lastPay = finalPaymentHistory[finalPaymentHistory.length - 1];
        const selectedCustomer = localCustomers.find(c => c.id === customerId);
        const selectedShipper = shippers.find(s => s.id === shipperId);

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
          paymentMethodId: lastPay?.paymentMethodId || oldData.paymentMethodId || null,
          paymentMethodName: lastPay?.paymentMethodName || oldData.paymentMethodName || null,
          shipperId: shipperId || null,
          shipperName: selectedShipper ? selectedShipper.name : null,
          status: newStatus,
          shippingStatus: shippingMode,
          createdAt: finalCreatedAt, 
          amountPaid: newTotalPaid,
          paymentHistory: finalPaymentHistory,
          updatedAt: serverTimestamp()
        });
      });

      alert("Cập nhật đơn hàng thành công!");
      onClose();
    } catch (error: any) {
      console.error("Lỗi cập nhật đơn hàng:", error);
      alert("Lỗi: " + (error.message || error));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !sale) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[110] animate-fade-in p-2 sm:p-4">
      {isAddCustomerModalOpen && (
        <CustomerModal
          customer={null}
          onClose={() => setIsAddCustomerModalOpen(false)}
          onSave={handleSaveNewCustomer}
          existingCustomers={localCustomers}
        />
      )}

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl animate-fade-in-down flex flex-col max-h-[95vh] overflow-hidden border border-slate-200">
        
        {/* HEADER MODAL */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-800 bg-slate-900 text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Edit3 className="text-primary" size={20} />
            <h3 className="text-base sm:text-lg font-black uppercase tracking-tight">
              Sửa đơn hàng #{sale.id.substring(0, 8).toUpperCase()}
            </h3>
            {finalRemainingDebt > 0 ? (
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('payment-debt-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 transition cursor-pointer"
                title="Bấm để cuộn nhanh xuống phần Thanh toán & Thu nợ"
              >
                <AlertCircle size={13} className="text-red-400 animate-pulse" />
                <span>Nợ: {formatNumber(finalRemainingDebt)} ₫ ↓</span>
              </button>
            ) : (
              <span className="hidden sm:flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span>Đã trả đủ</span>
              </span>
            )}
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-white/50 hover:text-white transition-colors cursor-pointer p-1"
          >
            <X size={24} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 space-y-8">

          {/* PHẦN 1: THÔNG TIN ĐƠN HÀNG & HÀNG HÓA */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* CỘT TRÁI: THÔNG TIN KHÁCH HÀNG & GIAO HÀNG */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm space-y-4">
                  {/* Khách hàng */}
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

                  {/* Ngày bán hàng & Xuất hóa đơn */}
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

                    <div className="flex items-center p-2.5 bg-blue-50 border-2 border-blue-100 rounded-lg">
                      <input 
                        type="checkbox" 
                        id="edit-issue-invoice" 
                        checked={issueInvoice} 
                        onChange={e => setIssueInvoice(e.target.checked)} 
                        className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-0 mr-3 cursor-pointer" 
                      />
                      <label htmlFor="edit-issue-invoice" className="text-xs font-black uppercase text-blue-800 cursor-pointer select-none">
                        Xuất hóa đơn đỏ
                      </label>
                    </div>

                    {/* Vận chuyển */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Đơn vị vận chuyển</label>
                      <select 
                        value={shipperId} 
                        onChange={e => setShipperId(e.target.value)} 
                        className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none text-slate-900 bg-white shadow-sm"
                      >
                        <option value="">-- CHỌN ĐVVC --</option>
                        {shippers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Trạng thái giao</label>
                      <select 
                        value={shippingMode} 
                        onChange={e => setShippingMode(e.target.value as any)} 
                        className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none text-slate-900 bg-white shadow-sm"
                      >
                        <option value="shipped">Đã giao hàng</option>
                        <option value="pending">Chờ gửi</option>
                        <option value="order">Đặt hàng</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Phí vận chuyển</label>
                      <NumericInput 
                        value={shippingFee} 
                        onChange={setShippingFee} 
                        className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-black text-base text-right focus:border-primary outline-none text-slate-900 bg-white shadow-inner" 
                      />
                    </div>
                  </div>

                  {/* Banner chuyển sang tab thanh toán */}
                  <div className="pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setActiveTab('payment')}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                        finalRemainingDebt > 0 
                          ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900' 
                          : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Wallet size={16} className={finalRemainingDebt > 0 ? 'text-amber-700' : 'text-emerald-700'} />
                        <span className="text-xs font-black uppercase">
                          {finalRemainingDebt > 0 ? `Còn nợ ${formatNumber(finalRemainingDebt)} ₫` : 'Đã trả đủ 100%'}
                        </span>
                      </div>
                      <span className="text-xs font-black flex items-center gap-1">
                        Sửa thanh toán <ArrowRight size={14} />
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* CỘT PHẢI: CHI TIẾT SẢN PHẨM */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                {/* Search Product Row */}
                <div className="bg-slate-900 p-3 sm:p-4 rounded-xl border border-slate-800 shadow-md">
                  <div className="flex gap-2 relative">
                    <div className="flex-1 relative" ref={prodDropdownRef}>
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
                      <input 
                        type="text"
                        value={prodSearch}
                        onChange={(e) => { setProdSearch(e.target.value); setIsProdDropdownOpen(true); }}
                        onFocus={() => setIsProdDropdownOpen(true)}
                        placeholder="THÊM SẢN PHẨM MỚI VÀO ĐƠN..."
                        className="w-full pl-9 pr-10 py-2.5 bg-black border-2 border-slate-700 rounded-xl text-white font-black text-xs sm:text-sm outline-none focus:border-primary shadow-inner placeholder-slate-500"
                      />
                      {prodSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setProdSearch('');
                            setIsProdDropdownOpen(false);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition cursor-pointer"
                          title="Xóa nội dung"
                        >
                          <X size={14} />
                        </button>
                      )}
                      {isProdDropdownOpen && prodSearch && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-800 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                          {filteredProducts.length === 0 ? (
                            <div className="p-4 text-center text-xs font-black text-slate-400 uppercase">
                              Không tìm thấy sản phẩm
                            </div>
                          ) : (
                            filteredProducts.map(p => {
                              const lastPrice = wholesalePrices[p.id];
                              return (
                                <button 
                                  key={p.id} 
                                  onClick={() => handleAddProductToEdit(p)} 
                                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-100 flex items-center group transition-colors cursor-pointer"
                                >
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
                                    <div className="flex justify-between items-center mt-0.5">
                                      <div className="text-[10px] text-slate-400">Giá niêm yết: {formatNumber(p.sellingPrice)} ₫</div>
                                      {lastPrice !== undefined && (
                                        <div className="text-[10px] font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                                          Giá cũ: {formatNumber(lastPrice)} ₫
                                        </div>
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
                    <input 
                      type="number" 
                      value={addQty} 
                      onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value) || 0))} 
                      className="w-14 sm:w-16 px-1 py-2.5 bg-black border-2 border-slate-700 rounded-xl text-center font-black text-primary outline-none focus:border-primary text-xs sm:text-sm" 
                      min="1" 
                    />
                    <button 
                      type="button"
                      onClick={() => setIsProdDropdownOpen(true)} 
                      className="p-2.5 bg-primary text-white rounded-xl shadow-lg active:scale-95 transition-transform cursor-pointer"
                    >
                      <Plus size={20} strokeWidth={3} />
                    </button>
                  </div>
                </div>

                {/* Table of items */}
                <div className="bg-white rounded-xl border-2 border-slate-800 shadow-lg overflow-hidden flex flex-col flex-1">
                  <div className="bg-slate-800 p-3 text-white flex justify-between items-center">
                    <h4 className="text-xs font-black uppercase flex items-center tracking-tighter">
                      <ShoppingBag className="mr-2 text-primary" size={16} /> Chi tiết hàng hóa
                    </h4>
                    <span className="bg-primary px-2.5 py-0.5 rounded-full text-[10px] font-black">
                      {editedItems.length} Sản phẩm
                    </span>
                  </div>

                  <div className="flex-1 overflow-auto min-h-[250px] max-h-[380px]">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <tr className="text-[10px] font-black text-slate-500 uppercase">
                          <th className="p-2.5 w-14 text-center">TT</th>
                          <th className="p-2.5">Sản phẩm</th>
                          <th className="p-2.5 text-center w-28">Số lượng</th>
                          <th className="p-2.5 text-right w-36">Giá bán (₫)</th>
                          <th className="p-2.5 text-right w-36">Thành tiền</th>
                          <th className="p-2.5 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {editedItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-0.5">
                                <button 
                                  type="button" 
                                  onClick={() => moveItemUp(idx)} 
                                  disabled={idx === 0} 
                                  className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition cursor-pointer"
                                  title="Lên"
                                >
                                  <ChevronUp size={12} strokeWidth={2.5}/>
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => moveItemDown(idx)} 
                                  disabled={idx === editedItems.length - 1} 
                                  className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition cursor-pointer"
                                  title="Xuống"
                                >
                                  <ChevronDown size={12} strokeWidth={2.5}/>
                                </button>
                              </div>
                            </td>
                            <td className="p-2">
                              <div className="font-bold text-xs text-slate-800 uppercase leading-tight line-clamp-2">
                                {item.productName}
                              </div>
                              {item.isCombo && (
                                <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded font-black uppercase">
                                  Combo
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <button 
                                  type="button"
                                  onClick={() => updateItem(idx, { quantity: Math.max(1, item.quantity - 1) })} 
                                  className="p-1 bg-slate-200 rounded hover:bg-slate-300 text-slate-900 border border-slate-300 shadow-xs cursor-pointer"
                                >
                                  <Minus size={12}/>
                                </button>
                                <input 
                                  type="number" 
                                  value={item.quantity} 
                                  onChange={e => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} 
                                  className="w-10 py-1 text-center font-black text-xs border-2 border-slate-300 rounded-lg outline-none text-slate-900 bg-white" 
                                />
                                <button 
                                  type="button"
                                  onClick={() => updateItem(idx, { quantity: item.quantity + 1 })} 
                                  className="p-1 bg-slate-200 rounded hover:bg-slate-300 text-slate-900 border border-slate-300 shadow-xs cursor-pointer"
                                >
                                  <Plus size={12}/>
                                </button>
                              </div>
                            </td>
                            <td className="p-2">
                              <NumericInput 
                                value={item.price} 
                                onChange={val => updateItem(idx, { price: val })} 
                                className="w-full p-1.5 border-2 border-slate-300 rounded-lg text-right font-black text-xs outline-none focus:border-primary text-slate-900 bg-white shadow-inner" 
                              />
                            </td>
                            <td className="p-2 text-right font-black text-xs text-primary">
                              {formatNumber(item.price * item.quantity)} ₫
                            </td>
                            <td className="p-2 text-center">
                              <button 
                                type="button"
                                onClick={() => setEditedItems(editedItems.filter((_, i) => i !== idx))} 
                                className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-slate-900 text-white flex justify-between items-center border-t-2 border-slate-800">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng tiền đơn mới</p>
                      <div className="text-2xl font-black text-primary tracking-tight">
                        {formatNumber(newTotal)} <span className="text-xs font-black italic">₫</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase">
                        Ship: {formatNumber(shippingFee)} ₫
                      </p>
                      <p className={`text-xs font-black ${newTotal - (sale.total || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        Chênh lệch: {newTotal - (sale.total || 0) >= 0 ? '+' : ''}{formatNumber(newTotal - (sale.total || 0))} ₫
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PHẦN 2: THANH TOÁN & THU NỢ (NẰM Ở DƯỚI) */}
            <div id="payment-debt-section" className="pt-4 border-t-2 border-slate-300 space-y-6">
              
              {/* TIÊU ĐỀ PHÂN ĐOẠN THANH TOÁN & THU NỢ */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-primary flex items-center justify-center shadow-xs">
                    <Wallet size={20} />
                  </div>
                  <div>
                    <h4 className="text-base font-black uppercase text-slate-900 tracking-tight flex items-center gap-2">
                      <span>Thanh toán & Thu nợ</span>
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Ghi nhận các đợt trả tiền, theo dõi công nợ và tự động phân bổ vào sổ quỹ tài khoản
                    </p>
                  </div>
                </div>

                {finalRemainingDebt > 0 ? (
                  <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-red-100 text-red-700 border border-red-200 flex items-center gap-1.5 shadow-xs animate-pulse">
                    <AlertCircle size={15} className="text-red-600" />
                    Còn nợ lại: {formatNumber(finalRemainingDebt)} ₫
                  </span>
                ) : (
                  <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shadow-xs">
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    Đã thanh toán đủ 100%
                  </span>
                )}
              </div>

              {/* TRÊN CÙNG: 3 THẺ THỐNG KÊ RÕ RÀNG */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Tổng tiền hàng */}
                <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                    <Coins size={24} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wide block">
                      Tổng tiền đơn hàng
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight block truncate">
                      {formatNumber(newTotal)} ₫
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      (Hàng: {formatNumber(itemsTotal)} ₫ + Ship: {formatNumber(shippingFee)} ₫)
                    </span>
                  </div>
                </div>

                {/* 2. Tổng đã thanh toán */}
                <div className="bg-white p-4 rounded-xl border-2 border-emerald-200 shadow-sm flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle2 size={24} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wide block">
                      Tổng đã thanh toán
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight block truncate">
                      {formatNumber(effectiveAmountPaid)} ₫
                    </span>
                    <span className="text-[10px] text-emerald-600 font-medium">
                      {effectivePayThisTime > 0 ? (
                        <>Đã thu: {formatNumber(totalAlreadyPaid)} ₫ + Đợt này: {formatNumber(effectivePayThisTime)} ₫</>
                      ) : (
                        <>Qua {paymentHistoryList.length} đợt thanh toán</>
                      )}
                    </span>
                  </div>
                </div>

                {/* 3. Còn nợ bao nhiêu */}
                <div className={`p-4 rounded-xl border-2 shadow-sm flex items-center gap-3.5 ${
                  finalRemainingDebt > 0 
                    ? 'bg-red-50/70 border-red-200' 
                    : 'bg-emerald-50/70 border-emerald-200'
                }`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    finalRemainingDebt > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {finalRemainingDebt > 0 ? <AlertCircle size={24} /> : <ShieldCheck size={24} />}
                  </div>
                  <div className="min-w-0">
                    <span className={`text-[10px] font-black uppercase tracking-wide block ${
                      finalRemainingDebt > 0 ? 'text-red-700' : 'text-emerald-800'
                    }`}>
                      {finalRemainingDebt > 0 ? 'Còn nợ lại' : 'Tình trạng công nợ'}
                    </span>
                    <span className={`text-xl sm:text-2xl font-black tracking-tight block truncate ${
                      finalRemainingDebt > 0 ? 'text-red-700' : 'text-emerald-700'
                    }`}>
                      {finalRemainingDebt > 0 ? `${formatNumber(finalRemainingDebt)} ₫` : '0 ₫ (Hết nợ)'}
                    </span>
                    <span className={`text-[10px] font-medium ${
                      finalRemainingDebt > 0 ? 'text-red-500' : 'text-emerald-600'
                    }`}>
                      {finalRemainingDebt > 0 ? 'Khách chưa thanh toán đủ' : 'Đã thanh toán đủ 100%'}
                    </span>
                  </div>
                </div>
              </div>

              {/* KHU VỰC THU TIỀN ĐỢT NÀY (NẾU CÒN NỢ) */}
              {remainingDebtBeforeThisPay > 0 ? (
                <div className="bg-white p-5 rounded-2xl border-2 border-amber-300 shadow-md space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-amber-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-xs">
                        +{paymentHistoryList.length + 1}
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase text-slate-900 tracking-tight">
                          Thu tiền đợt {paymentHistoryList.length + 1} (Ghi nhận trả nợ)
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Khách hàng đang nợ <strong>{formatNumber(remainingDebtBeforeThisPay)} ₫</strong>. Nhập số tiền thu cho đợt này bên dưới.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPayThisTime(remainingDebtBeforeThisPay)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1"
                      >
                        <CheckCheck size={14} />
                        Trả hết nợ ({formatNumber(remainingDebtBeforeThisPay)} ₫)
                      </button>

                      {remainingDebtBeforeThisPay > 0 && (
                        <button
                          type="button"
                          onClick={() => setPayThisTime(Math.round(remainingDebtBeforeThisPay / 2))}
                          className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer"
                        >
                          Trả 50% ({formatNumber(Math.round(remainingDebtBeforeThisPay / 2))} ₫)
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setPayThisTime(0)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        0 ₫ (Chưa thu đợt này)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Danh sách tài khoản nhận tiền */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 uppercase mb-1 flex items-center justify-between">
                        <span>Tài khoản nhận tiền đợt này *</span>
                        {payMethodId && (
                          <span className="text-[10px] text-slate-500 font-bold">
                            Số dư: {formatNumber(paymentMethods.find(p => p.id === payMethodId)?.balance || 0)} ₫
                          </span>
                        )}
                      </label>
                      <select
                        id="pay-method-select"
                        value={payMethodId}
                        onChange={e => setPayMethodId(e.target.value)}
                        className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-primary text-slate-900 bg-white shadow-sm"
                      >
                        <option value="">-- CHỌN TÀI KHOẢN NHẬN TIỀN --</option>
                        {paymentMethods.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.balance !== undefined ? `(Số dư: ${formatNumber(p.balance)} ₫)` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Ô nhập số tiền đợt này */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 uppercase mb-1 flex items-center justify-between">
                        <span>Số tiền khách trả đợt này</span>
                        <span className="text-[10px] text-emerald-700 font-black">
                          {effectivePayThisTime > 0 ? `+${formatNumber(effectivePayThisTime)} ₫` : 'Chưa nhập số tiền'}
                        </span>
                      </label>
                      <NumericInput
                        value={payThisTime}
                        onChange={(val) => setPayThisTime(Math.max(0, val))}
                        placeholder="Nhập số tiền khách trả lần này..."
                        className="w-full px-3 py-2 border-2 border-amber-300 rounded-xl font-black text-lg text-right outline-none focus:border-amber-500 text-slate-900 bg-amber-50/40 focus:bg-white shadow-inner"
                      />
                    </div>

                    {/* Ghi chú đợt thanh toán */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                        Ghi chú đợt thanh toán
                      </label>
                      <input
                        type="text"
                        value={payNote}
                        onChange={e => setPayNote(e.target.value)}
                        placeholder={`VD: Khách thanh toán đợt ${paymentHistoryList.length + 1}`}
                        className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-primary text-slate-900 bg-white"
                      />
                    </div>

                    {/* Ngày thanh toán */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                        Ngày thu tiền đợt này
                      </label>
                      <input
                        type="date"
                        value={payDate}
                        onChange={e => setPayDate(e.target.value)}
                        className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl font-black text-xs outline-none focus:border-primary text-slate-900 bg-white"
                        style={{ colorScheme: 'light' }}
                      />
                    </div>
                  </div>

                  {/* Preview kết quả sau khi thu */}
                  {effectivePayThisTime > 0 && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 animate-fade-in">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                        <span className="text-emerald-950 font-bold">
                          Đợt này thu: <strong className="text-emerald-700 font-black">+{formatNumber(effectivePayThisTime)} ₫</strong> vào tài khoản <strong>{paymentMethods.find(p => p.id === payMethodId)?.name || 'đã chọn'}</strong>.
                        </span>
                      </div>
                      <div className="text-slate-700">
                        {finalRemainingDebt > 0 ? (
                          <span>Sau đợt này còn nợ lại: <strong className="text-red-600 font-black">{formatNumber(finalRemainingDebt)} ₫</strong></span>
                        ) : (
                          <span className="text-emerald-700 font-black flex items-center gap-1">
                            <CheckCheck size={16} /> Đơn hàng sẽ chuyển sang "ĐÃ THANH TOÁN ĐỦ"
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Trường hợp đơn không còn nợ */
                <div className="bg-emerald-50 border-2 border-emerald-200 p-4 rounded-2xl flex items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                      <CheckCheck size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-emerald-950 uppercase">
                        Đơn hàng đã thanh toán đủ 100%
                      </h4>
                      <p className="text-xs text-emerald-800">
                        Tổng tiền đơn hàng: <strong>{formatNumber(newTotal)} ₫</strong> • Khách đã thanh toán đủ, không còn nợ.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Bạn có chắc chắn muốn xóa các đợt thanh toán và chuyển toàn bộ đơn hàng sang GHI NỢ 100%?\nSố tiền đã thu sẽ được trừ lại khỏi các tài khoản tương ứng khi lưu.")) {
                        setPaymentHistoryList([]);
                        setPayThisTime(0);
                      }
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Chuyển sang Nợ 100%
                  </button>
                </div>
              )}

              {/* PHÍA DƯỚI: DANH SÁCH CÁC THANH TOÁN (LỊCH SỬ) */}
              <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-100 px-4 py-3 border-b-2 border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-primary" />
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-tight">
                      Danh sách các lần thanh toán ({paymentHistoryList.length + (effectivePayThisTime > 0 ? 1 : 0)} đợt)
                    </h4>
                  </div>
                  <span className="text-xs font-black text-slate-600">
                    Đã thanh toán: <strong className="text-emerald-700">{formatNumber(effectiveAmountPaid)} ₫</strong>
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {/* Danh sách các đợt đã lưu trước đây */}
                  {paymentHistoryList.length === 0 && effectivePayThisTime === 0 ? (
                    <div className="p-6 text-center text-xs font-bold text-slate-400">
                      Chưa có đợt thanh toán nào được ghi nhận cho đơn hàng này. Toàn bộ là nợ 100%.
                    </div>
                  ) : (
                    paymentHistoryList.map((p, idx) => (
                      <div key={p.id || idx} className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center text-xs font-black shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-xs text-slate-900">
                                Đợt {idx + 1}: {p.paymentMethodName || 'Tiền mặt'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                • {p.date?.toDate?.()?.toLocaleString('vi-VN') || (p as any).createdAt?.toDate?.()?.toLocaleString('vi-VN') || 'Đợt trước'}
                              </span>
                            </div>
                            {p.note && (
                              <p className="text-[11px] text-slate-500 italic mt-0.5 leading-tight">
                                {p.note}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-black text-sm text-emerald-700">
                            +{formatNumber(p.amount)} ₫
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveHistoryItem(idx)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition cursor-pointer"
                            title="Xóa đợt thu này (sẽ hoàn lại số dư tài khoản khi lưu)"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Dòng xem trước (Preview) đợt thanh toán mới đang nhập ở trên */}
                  {effectivePayThisTime > 0 && (
                    <div className="p-3.5 bg-emerald-50/60 border-t-2 border-dashed border-emerald-300 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
                          {paymentHistoryList.length + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xs text-emerald-950">
                              Đợt {paymentHistoryList.length + 1} (Sắp ghi nhận): {paymentMethods.find(m => m.id === payMethodId)?.name || 'Tài khoản đã chọn'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-200 text-emerald-900">
                              Mới
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-800 italic mt-0.5 leading-tight">
                            {payNote || `Khách thanh toán đợt ${paymentHistoryList.length + 1}`} • Ngày thu: {payDate}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-xs">
                          +{formatNumber(effectivePayThisTime)} ₫
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs font-bold text-slate-600">
                  <span>Tổng cộng đã thanh toán:</span>
                  <div className="text-right">
                    <span className="text-base font-black text-emerald-700">
                      {formatNumber(effectiveAmountPaid)} ₫
                    </span>
                    <span className="text-slate-400 text-[11px] ml-1">
                      / {formatNumber(newTotal)} ₫
                    </span>
                  </div>
                </div>
              </div>

            </div>

        </div>

        {/* MODAL FOOTER (ALWAYS VISIBLE) */}
        <div className="p-3.5 sm:p-4 bg-white border-t-2 border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <div className="px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-bold uppercase text-[9px] block">Tổng đơn hàng</span>
              <span className="font-black text-xs sm:text-sm text-slate-900">{formatNumber(newTotal)} ₫</span>
            </div>

            <div className="px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-emerald-700 font-bold uppercase text-[9px] block">Đã thanh toán</span>
              <span className="font-black text-xs sm:text-sm text-emerald-700">{formatNumber(effectiveAmountPaid)} ₫</span>
            </div>

            <div className={`px-3 py-1.5 rounded-xl border ${
              finalRemainingDebt > 0 
                ? 'bg-red-50 border-red-200 text-red-700' 
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <span className="font-bold uppercase text-[9px] block">
                {finalRemainingDebt > 0 ? 'Còn nợ lại' : 'Trạng thái nợ'}
              </span>
              <span className="font-black text-xs sm:text-sm">
                {finalRemainingDebt > 0 ? `${formatNumber(finalRemainingDebt)} ₫` : '0 ₫ (Hết nợ)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 sm:px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition font-black text-xs uppercase cursor-pointer"
              disabled={isProcessing}
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isProcessing}
              className="px-5 sm:px-8 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-black text-xs uppercase shadow-md flex items-center transition active:scale-95 disabled:bg-slate-300 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader className="animate-spin mr-2" size={16} />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  <span>Xác nhận lưu đơn</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SaleEditModal;
