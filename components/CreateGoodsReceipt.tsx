
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, writeBatch, doc, serverTimestamp, query, orderBy, increment, setDoc, Timestamp, where, addDoc, limit, getDocs, updateDoc, deleteDoc, runTransaction, collectionGroup } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { Product, Supplier, GoodsReceiptItem, Warehouse, PaymentMethod, Manufacturer, GoodsReceipt, PlannedOrder, ChinaImport } from '../types';
import { Archive, Plus, Minus, X, CheckCircle, Loader, XCircle, Search, Users, Package, CreditCard, History, Calendar, ArrowUpCircle, ArrowDownCircle, ChevronLeft, ChevronRight, FileCheck2, PlusCircle, Wallet, Download, TrendingUp, TrendingDown, AlertCircle, AlertTriangle, Info, ExternalLink, Tag, ClipboardList, Maximize2, Minimize2, Banknote, FileText, Eye, Trash2, Save, Edit, Plane, Truck } from 'lucide-react';
import { formatNumber, parseNumber } from '../utils/formatting';
import GoodsReceiptDetailModal from './GoodsReceiptDetailModal';
import GoodsReceiptEditModal from './GoodsReceiptEditModal';
import { ProductModal } from './ProductManagement';
import { SupplierModal } from './SupplierManagement';
import { User } from 'firebase/auth';

// Add missing getTodayString helper function
const getTodayString = () => new Date().toISOString().split('T')[0];

const NumericInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    className?: string;
    placeholder?: string;
    onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
    onBlur?: () => void;
    isCurrency?: boolean;
}> = ({ value, onChange, className, placeholder, onFocus, onBlur, isCurrency = true }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [localValue, setLocalValue] = useState("");

    useEffect(() => {
        if (!isFocused) {
            setLocalValue(isCurrency ? formatNumber(value) : value.toString());
        }
    }, [value, isFocused, isCurrency]);

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
                onFocus?.(e);
            }}
            onBlur={() => {
                setIsFocused(false);
                setLocalValue(isCurrency ? formatNumber(value) : value.toString());
                onBlur?.();
            }}
            onChange={handleChange}
        />
    );
};

const Toast: React.FC<{ message: string; type: 'error' | 'success'; onClose: () => void }> = ({ message, type, onClose }) => {
    useEffect(() => { const timer = setTimeout(onClose, 4000); return () => clearTimeout(timer); }, [onClose]);
    return (
        <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-[200] flex items-center p-5 rounded-2xl shadow-2xl border-2 animate-fade-in-down ${type === 'error' ? 'bg-red-50 border-red-600 text-red-700' : 'bg-green-50 border-green-600 text-green-700'}`}>
            {type === 'error' ? <XCircle className="mr-3" size={24} /> : <CheckCircle className="mr-3" size={24} />}
            <span className="font-black uppercase text-sm">{message}</span>
            <button onClick={onClose} className="ml-4 hover:opacity-70"><X size={18} /></button>
        </div>
    );
};

interface ReceiptItem extends GoodsReceiptItem {
  originalImportPrice: number;
  updateImportPrice: boolean;
  comboItems?: any[];
}

const ImportProductCard: React.FC<{
    product: Product;
    lastSupplierPrice?: number; 
    onAdd: (product: Product, quantity: number, importPrice: number) => void;
    onUpdateImportPrice?: (productId: string, price: number) => Promise<void>;
    userRole: 'admin' | 'staff' | null;
    allStocks: Record<string, number>;
    warehouses: Warehouse[];
}> = ({ product, lastSupplierPrice, onAdd, onUpdateImportPrice, userRole, allStocks, warehouses }) => {
    const initialPrice = lastSupplierPrice !== undefined ? lastSupplierPrice : product.importPrice;
    const [inputQty, setInputQty] = useState(1);
    const [inputImportPrice, setInputImportPrice] = useState(initialPrice);
    const [isSaving, setIsSaving] = useState(false);
    const isAdmin = userRole === 'admin';

    useEffect(() => { setInputImportPrice(initialPrice); }, [initialPrice, product.id]);

    const handleSaveBasePrice = async () => {
        if (!onUpdateImportPrice) return;
        setIsSaving(true);
        try {
            await onUpdateImportPrice(product.id, inputImportPrice);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white border-2 border-slate-200 rounded-xl p-3 hover:shadow-xl transition-all duration-200 flex flex-col justify-between relative group hover:border-primary h-full">
            {product.isCombo && (
                <div className="absolute top-0 left-0 bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded-br-lg font-black z-10 uppercase shadow-sm">COMBO</div>
            )}
            <div className="mb-2 mt-3">
                <div className="font-black text-black leading-tight line-clamp-2 text-[12px] mb-1" title={product.name}>{product.name}</div>
                <div className="text-[9px] text-neutral font-bold flex flex-row flex-wrap gap-x-2 gap-y-0.5 mt-1">
                    {warehouses.map(w => (
                        <div key={w.id} className="flex items-center gap-1">
                            <span className="truncate max-w-[50px]">{w.name}:</span>
                            <span className={`${(allStocks[w.id] || 0) <= 0 ? 'text-red-600' : 'text-primary'}`}>{allStocks[w.id] || 0}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="space-y-1 mb-3">
                <div className="flex items-center gap-1">
                    <div className="relative flex-1">
                        <NumericInput 
                            value={inputImportPrice}
                            onChange={setInputImportPrice}
                            className={`w-full pl-6 pr-1 py-1.5 text-base border-2 rounded-lg font-black text-right focus:ring-2 focus:ring-white outline-none shadow-sm transition-colors ${lastSupplierPrice !== undefined ? 'bg-blue-50 border-blue-600 text-black' : 'bg-slate-900 border-black text-white'}`}
                        />
                        <span className={`absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-black ${lastSupplierPrice !== undefined ? 'text-blue-600' : 'text-white/70'}`}>VỐN</span>
                    </div>
                    {isAdmin && (
                        <button 
                            onClick={handleSaveBasePrice} 
                            disabled={isSaving}
                            className={`p-2 rounded-lg transition-all shadow-sm flex items-center justify-center ${lastSupplierPrice !== undefined ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-800 text-white hover:bg-black'}`}
                            title="Lưu thành giá nhập gốc của sản phẩm"
                        >
                            {isSaving ? <Loader size={16} className="animate-spin"/> : <Save size={16}/>}
                        </button>
                    )}
                </div>
            </div>
            <div className="flex space-x-2">
                <input type="number" value={inputQty} onChange={(e) => setInputQty(parseInt(e.target.value) || 0)} onFocus={(e) => e.target.select()} className="w-12 px-1 py-2 text-xs border-2 bg-slate-50 text-black rounded-lg outline-none text-center font-black focus:border-primary border-slate-200" min="1" />
                <button onClick={() => { onAdd(product, inputQty, inputImportPrice); setInputQty(1); }} className="flex-1 py-2 bg-primary hover:bg-primary-hover text-white text-[10px] font-black rounded-xl shadow-lg transition transform active:scale-95 flex items-center justify-center uppercase tracking-tighter"><Plus size={14} className="mr-1"/> Nhập</button>
            </div>
        </div>
    );
}

const CreateGoodsReceipt: React.FC<{ userRole: 'admin' | 'staff' | null, user: User | null }> = ({ userRole, user }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [receipt, setReceipt] = useState<ReceiptItem[]>([]);
  const [todayReceipts, setTodayReceipts] = useState<GoodsReceipt[]>([]);
  
  // Nguồn dữ liệu nhập thêm
  const [plannedOrders, setPlannedOrders] = useState<PlannedOrder[]>([]);
  const [chinaImports, setChinaImports] = useState<ChinaImport[]>([]);
  const [detailedInventory, setDetailedInventory] = useState<Record<string, Record<string, number>>>({});

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'debt'>('paid');
  const [hasInvoice, setHasInvoice] = useState(false);
  const [receiptDate, setReceiptDate] = useState(getTodayString());
  const [supplierPriceHistory, setSupplierPriceHistory] = useState<Record<string, number>>({});
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = isFullscreen ? 32 : 12;
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  // Modal states
  const [selectedReceiptDetail, setSelectedReceiptDetail] = useState<GoodsReceipt | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedReceiptEdit, setSelectedReceiptEdit] = useState<GoodsReceipt | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    onSnapshot(query(collection(db, "products"), orderBy("name")), (snap) => setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product))));
    onSnapshot(query(collection(db, "suppliers"), orderBy("name")), (snap) => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier))));
    onSnapshot(query(collection(db, "warehouses"), orderBy("name")), (snap) => setWarehouses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse))));
    onSnapshot(query(collection(db, "paymentMethods"), orderBy("name")), (snap) => setPaymentMethods(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod))));
    onSnapshot(query(collection(db, "manufacturers"), orderBy("name")), (snap) => setManufacturers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    
    // Tải các đơn nguồn
    onSnapshot(query(collection(db, "plannedOrders"), where("status", "==", "pending")), (snap) => setPlannedOrders(snap.docs.map(d => ({id: d.id, ...d.data()} as PlannedOrder))));
    
    // CẬP NHẬT: Chỉ lấy các đơn hàng Trung Quốc đã thanh toán (status === 'paid') để làm nguồn nhập hàng
    onSnapshot(query(collection(db, "chinaImports"), where("status", "==", "paid")), (snap) => setChinaImports(snap.docs.map(d => ({id: d.id, ...d.data()} as ChinaImport))));

    const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
    onSnapshot(query(collection(db, "goodsReceipts"), where("createdAt", ">=", Timestamp.fromDate(startOfToday)), orderBy("createdAt", "desc")), (snap) => setTodayReceipts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GoodsReceipt))));

    // Lấy tồn kho chi tiết
    onSnapshot(collectionGroup(db, 'inventory'), (snapshot) => {
        const newDetailedInventory: Record<string, Record<string, number>> = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            const productId = doc.ref.parent.parent?.id;
            if (productId && data.warehouseId && typeof data.stock === 'number') {
                if (!newDetailedInventory[productId]) newDetailedInventory[productId] = {};
                newDetailedInventory[productId][data.warehouseId] = data.stock;
            }
        });
        setDetailedInventory(newDetailedInventory);
    });

    setLoading(false);
  }, []);

  useEffect(() => {
      if (!selectedSupplierId) { setSupplierPriceHistory({}); return; }
      return onSnapshot(query(collection(db, "goodsReceipts"), where("supplierId", "==", selectedSupplierId), orderBy("createdAt", "desc"), limit(50)), (snapshot) => {
          const historyMap: Record<string, number> = {};
          [...snapshot.docs].reverse().forEach(doc => {
              const data = doc.data() as GoodsReceipt;
              if (data.items) data.items.forEach(item => { historyMap[item.productId] = item.importPrice; });
          });
          setSupplierPriceHistory(historyMap);
      });
  }, [selectedSupplierId]);

  const addToReceipt = (product: Product, quantity: number, importPrice: number) => {
    const existing = receipt.find(item => item.productId === product.id);
    if (existing) {
      setReceipt(receipt.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + quantity, importPrice } : item));
    } else {
      setReceipt([...receipt, { productId: product.id, productName: product.name, quantity, importPrice, originalImportPrice: product.importPrice, updateImportPrice: false, isCombo: !!product.isCombo, comboItems: product.comboItems || [] }]);
    }
  };

  const handleImportFromSource = (val: string) => {
      if (!val) return;
      const [type, id] = val.split(':');
      
      if (type === 'planned') {
          const order = plannedOrders.find(o => o.id === id);
          if (order) {
              setSelectedSupplierId(order.supplierId);
              setSupplierSearchTerm(order.supplierName);
              const items: ReceiptItem[] = order.items.map(i => {
                  const p = products.find(prod => prod.id === i.productId);
                  return {
                      productId: i.productId,
                      productName: i.productName,
                      quantity: i.quantity,
                      importPrice: p?.importPrice || 0,
                      originalImportPrice: p?.importPrice || 0,
                      updateImportPrice: false,
                      isCombo: p?.isCombo || false,
                      comboItems: p?.comboItems || []
                  };
              });
              setReceipt(items);
              setToast({ message: `Đã tải ${items.length} SP từ đơn dự kiến`, type: 'success' });
          }
      } else if (type === 'china') {
          const imp = chinaImports.find(o => o.id === id);
          if (imp) {
              const totalQty = imp.items.reduce((a, b) => a + b.quantity, 0);
              const extraFeesVND = (imp.shippingFeeCN * imp.exchangeRate) + imp.shippingFeeVN + imp.shippingFeeExtra + (imp.currencyExchangeFee || 0);
              const feePerItem = totalQty > 0 ? extraFeesVND / totalQty : 0;

              const items: ReceiptItem[] = imp.items.map(i => {
                  const p = products.find(prod => prod.id === i.productId);
                  const actualPriceVND = Math.round((i.priceCNY * imp.exchangeRate) + feePerItem);
                  return {
                      productId: i.productId,
                      productName: i.productName,
                      quantity: i.quantity,
                      importPrice: actualPriceVND,
                      originalImportPrice: p?.importPrice || 0,
                      updateImportPrice: false,
                      isCombo: p?.isCombo || false,
                      comboItems: p?.comboItems || []
                  };
              });
              setReceipt(items);
              setToast({ message: `Đã tải ${items.length} SP từ đơn TQ (Đã tính phí ship)`, type: 'success' });
          }
      }
  };

  const handleUpdateProductImportPrice = async (productId: string, newPrice: number) => {
    try {
        await updateDoc(doc(db, 'products', productId), { importPrice: newPrice });
        setToast({ message: "Đã cập nhật giá vốn gốc sản phẩm!", type: 'success' });
    } catch (e) {
        console.error(e);
        setToast({ message: "Lỗi khi cập nhật giá vốn gốc.", type: 'error' });
    }
  };

  const handleQuickCreateSupplier = async (data: any) => {
    try {
        const docRef = await addDoc(collection(db, 'suppliers'), { ...data, createdAt: serverTimestamp() });
        setSelectedSupplierId(docRef.id);
        setSupplierSearchTerm(data.name);
        setIsSupplierModalOpen(false);
        setToast({ message: "Đã tạo nhà cung cấp thành công!", type: 'success' });
    } catch (e) {
        console.error(e);
        setToast({ message: "Lỗi khi tạo nhà cung cấp.", type: 'error' });
    }
  };

  const handleConfirmReceipt = async () => {
    if (receipt.length === 0 || !selectedSupplierId || !selectedWarehouseId) { alert("Thiếu thông tin."); return; };
    setIsProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
          const selSup = suppliers.find(s => s.id === selectedSupplierId)!;
          const selWh = warehouses.find(w => w.id === selectedWarehouseId)!;
          const total = receipt.reduce((sum, item) => sum + item.importPrice * item.quantity, 0);
          
          const selectedDateObj = new Date(receiptDate);
          const now = new Date();
          selectedDateObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
          const finalCreatedAt = Timestamp.fromDate(selectedDateObj);

          let currentBal = 0;
          let accountRef = null;
          if (paymentStatus === 'paid' && selectedPaymentMethodId) {
              accountRef = doc(db, 'paymentMethods', selectedPaymentMethodId);
              const accSnap = await transaction.get(accountRef);
              if (accSnap.exists()) currentBal = (accSnap.data() as any).balance || 0;
          }

          const receiptRef = doc(collection(db, 'goodsReceipts'));
          transaction.set(receiptRef, { 
            items: receipt.map(({ productId, productName, quantity, importPrice, isCombo }) => ({ 
              productId: productId || '', 
              productName: productName || '', 
              quantity: quantity || 0, 
              importPrice: importPrice || 0, 
              isCombo: !!isCombo 
            })), 
            total, 
            supplierId: selSup.id, 
            supplierName: selSup.name, 
            warehouseId: selWh.id, 
            warehouseName: selWh.name, 
            paymentMethodId: selectedPaymentMethodId || null, 
            paymentMethodName: paymentMethods.find(p => p.id === selectedPaymentMethodId)?.name || null, 
            paymentStatus, 
            hasInvoice, 
            createdAt: finalCreatedAt, 
            creatorName: user?.displayName || user?.email || 'POS' 
          });

          if (paymentStatus === 'paid' && accountRef) {
              const finalBal = currentBal - total;
              transaction.update(accountRef, { balance: finalBal });
              transaction.set(doc(collection(db, 'paymentLogs')), { 
                paymentMethodId: selectedPaymentMethodId, 
                paymentMethodName: paymentMethods.find(p => p.id === selectedPaymentMethodId)?.name || 'N/A', 
                type: 'withdraw', 
                amount: total, 
                balanceAfter: finalBal, 
                note: `Nhập hàng từ ${selSup.name}`, 
                relatedId: receiptRef.id, 
                relatedType: 'receipt', 
                createdAt: finalCreatedAt, 
                creatorName: user?.displayName || user?.email || 'POS' 
              });
          }

          for (const item of receipt) {
            if (item.isCombo && item.comboItems) {
                for (const cItem of item.comboItems) {
                    const totalAdd = cItem.quantity * item.quantity;
                    const invRef = doc(db, 'products', cItem.productId, 'inventory', selectedWarehouseId);
                    transaction.set(invRef, { stock: increment(totalAdd), warehouseId: selWh.id, warehouseName: selWh.name }, { merge: true });
                    if (hasInvoice) transaction.update(doc(db, 'products', cItem.productId), { totalInvoicedStock: increment(totalAdd) });
                }
            } else {
                const invRef = doc(db, 'products', item.productId, 'inventory', selectedWarehouseId);
                transaction.set(invRef, { stock: increment(item.quantity), warehouseId: selWh.id, warehouseName: selWh.name }, { merge: true });
                if (hasInvoice) transaction.update(doc(db, 'products', item.productId), { totalInvoicedStock: increment(item.quantity) });
            }
            if (item.updateImportPrice && isAdmin) transaction.update(doc(db, 'products', item.productId), { importPrice: item.importPrice });
          }
      });
      setReceipt([]); setSelectedSupplierId(''); setSupplierSearchTerm(''); 
      setToast({ message: `Nhập hàng thành công! (${paymentStatus === 'debt' ? 'Ghi nợ NCC' : 'Đã thanh toán'})`, type: 'success' });
    } catch (err: any) { 
        console.error(err); 
        setToast({ message: "Lỗi khi nhập hàng: " + err.message, type: 'error' });
    } finally { setIsProcessing(false); }
  };

  const handleQuickCreateProduct = async (data: any) => {
    try {
        const docRef = await addDoc(collection(db, 'products'), { ...data, createdAt: serverTimestamp() });
        const newProduct = { id: docRef.id, ...data } as Product;
        addToReceipt(newProduct, 1, newProduct.importPrice);
        setIsProductModalOpen(false);
        setToast({ message: "Đã tạo sản phẩm và thêm vào phiếu!", type: 'success' });
    } catch (e) {
        console.error(e);
        setToast({ message: "Lỗi khi tạo sản phẩm.", type: 'error' });
    }
  };

  const filteredProducts = useMemo(() => products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())), [products, searchTerm]);
  const paginatedProducts = useMemo(() => filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredProducts, currentPage, pageSize]);

  return (
    <div className={`flex flex-col h-full gap-4 ${isFullscreen ? 'fixed inset-0 bg-slate-100 z-[100] p-4 overflow-y-auto' : ''}`}>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        
        <GoodsReceiptDetailModal receipt={selectedReceiptDetail} isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} userRole={userRole} />
        <GoodsReceiptEditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} receipt={selectedReceiptEdit} suppliers={suppliers} paymentMethods={paymentMethods} warehouses={warehouses} products={products} />
        {isProductModalOpen && <ProductModal product={null} manufacturers={manufacturers} allProductsForCombo={products} onClose={() => setIsProductModalOpen(false)} onSave={handleQuickCreateProduct} existingNames={products.map(p => p.name)} />}
        {isSupplierModalOpen && <SupplierModal supplier={null} onClose={() => setIsSupplierModalOpen(false)} onSave={handleQuickCreateSupplier} existingNames={suppliers.map(s => s.name)} />}
        
        <div className={`flex flex-col lg:flex-row gap-4 flex-1 ${isFullscreen ? 'min-h-0' : ''}`}>
            <div className={`flex flex-col min-h-0 ${isFullscreen ? 'lg:w-[65%]' : 'lg:w-3/5'}`}>
                <div className="bg-white p-4 rounded-2xl shadow-md flex-1 flex flex-col border-2 border-slate-200 overflow-hidden">
                    <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black uppercase text-blue-600">Nghiệp vụ nhập</h3>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-sm">
                                        <Calendar size={14} className="text-slate-400 mr-2" />
                                        <input 
                                            type="date" 
                                            value={receiptDate} 
                                            onChange={e => setReceiptDate(e.target.value)} 
                                            className="text-xs font-black uppercase text-slate-800 outline-none border-none p-0 focus:ring-0" 
                                            style={{ colorScheme: 'light' }}
                                        />
                                    </div>
                                    <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={hasInvoice} onChange={e => setHasInvoice(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-0" /><span className="text-xs font-black uppercase text-blue-600">Có HĐ Đỏ</span></label>
                                    <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={paymentStatus === 'debt'} onChange={e => setPaymentStatus(e.target.checked ? 'debt' : 'paid')} className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-0" /><span className="text-xs font-black uppercase text-red-600">Ghi nợ NCC</span></label>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                <div className="relative flex gap-1" ref={supplierDropdownRef}><div className="relative flex-1"><Users className="absolute left-2 top-1/2 -translate-y-1/2 text-black" size={16}/><input type="text" placeholder="Tìm NCC..." value={supplierSearchTerm} onChange={e => { setSupplierSearchTerm(e.target.value); setIsSupplierDropdownOpen(true); }} onFocus={() => setIsSupplierDropdownOpen(true)} className="w-full pl-8 pr-1 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary outline-none" />{isSupplierDropdownOpen && (<div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">{suppliers.filter(s => s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase())).map(s => <button key={s.id} onClick={() => { setSelectedSupplierId(s.id); setSupplierSearchTerm(s.name); setIsSupplierDropdownOpen(false); }} className="w-full text-left px-2 py-1.5 hover:bg-blue-50 text-[10px] border-b font-black text-black">{s.name}</button>)}</div>)}</div><button onClick={() => setIsSupplierModalOpen(true)} className="p-2 bg-green-100 text-green-600 rounded-lg border hover:bg-green-600 transition shadow-sm"><Plus size={18}/></button></div>
                                <div className="relative"><Archive className="absolute left-2 top-1/2 -translate-y-1/2 text-black" size={16}/><select value={selectedWarehouseId} onChange={e => setSelectedWarehouseId(e.target.value)} className="w-full pl-8 pr-1 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary focus:outline-none appearance-none"><option value="">Kho nhập...</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
                                <div className="relative"><CreditCard className="absolute left-2 top-1/2 -translate-y-1/2 text-black" size={16}/><select value={selectedPaymentMethodId} onChange={e => setSelectedPaymentMethodId(e.target.value)} className="w-full pl-8 pr-1 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary focus:outline-none appearance-none" disabled={paymentStatus === 'debt'}><option value="">PT Thanh toán...</option>{paymentMethods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                                <div className="relative">
                                    <ClipboardList className="absolute left-2 top-1/2 -translate-y-1/2 text-white" size={16}/>
                                    <select 
                                        onChange={(e) => handleImportFromSource(e.target.value)}
                                        className="w-full pl-8 pr-1 py-2 border border-black bg-black rounded-lg text-[10px] font-black text-white focus:ring-2 focus:ring-primary focus:outline-none appearance-none uppercase shadow-lg"
                                    >
                                        <option value="" className="text-white bg-black">Nhập từ nguồn...</option>
                                        <optgroup label="Dự kiến đặt hàng" className="text-white bg-black">
                                            {plannedOrders.map(o => (
                                                <option key={o.id} value={`planned:${o.id}`} className="text-white bg-black">{o.supplierName} - {o.id.substring(0,5)}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="Nhập hàng Trung Quốc" className="text-white bg-black">
                                            {chinaImports.map(o => (
                                                <option key={o.id} value={`china:${o.id}`} className="text-white bg-black">{o.orderName || o.id.substring(0,5)}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20}/>
                                <input type="text" placeholder="GÕ TÊN SẢN PHẨM ĐỂ NHẬP..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-blue-50 border-4 border-slate-800 rounded-2xl focus:border-primary outline-none font-black text-base text-black shadow-[4px_4px_0px_#0f172a]" />
                            </div>
                            <button 
                                onClick={() => setIsProductModalOpen(true)} 
                                className="px-4 py-3 bg-green-600 text-white rounded-2xl flex items-center hover:bg-green-700 transition shadow-md font-black text-xs uppercase"
                                title="Tạo sản phẩm mới nhanh"
                            >
                                <PlusCircle size={16} className="mr-2"/> TẠO SP
                            </button>
                            {!isFullscreen && (
                                <button onClick={() => setIsFullscreen(true)} className="px-4 py-3 bg-slate-800 text-white rounded-2xl flex items-center hover:bg-black transition shadow-md font-black text-xs uppercase">
                                    <Maximize2 size={16} className="mr-2"/> POS
                                </button>
                            )}
                        </div>
                        <div className={`grid gap-2 content-start ${isFullscreen ? 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'}`}>{loading ? <div className="col-span-full flex items-center justify-center h-40"><Loader className="animate-spin text-primary" size={32}/></div> : paginatedProducts.map(p => (<ImportProductCard key={p.id} product={p} lastSupplierPrice={supplierPriceHistory[p.id]} onAdd={addToReceipt} onUpdateImportPrice={handleUpdateProductImportPrice} userRole={userRole} allStocks={detailedInventory[p.id] || {}} warehouses={warehouses} />)) }</div>
                        <div className="mt-3 flex justify-between items-center border-t pt-3 shrink-0"><div className="text-[9px] font-black text-black uppercase">Trang {currentPage}</div><div className="flex space-x-1"><button onClick={() => setCurrentPage(p => Math.max(1, p-1))} className="p-1.5 bg-slate-100 rounded-lg text-black font-black"><ChevronLeft size={16}/></button><button onClick={() => setCurrentPage(p => p + 1)} className="p-1.5 bg-slate-100 rounded-lg text-black font-black"><ChevronRight size={16}/></button></div></div>
                    </div>
                </div>
            </div>
            <div className={`flex flex-col min-h-0 ${isFullscreen ? 'lg:w-[35%]' : 'lg:w-2/5'}`}>
                <div className="bg-white rounded-2xl shadow-xl flex-1 flex flex-col overflow-hidden border-2 border-slate-800 overflow-y-auto">
                    <div className="bg-slate-800 p-3 text-white flex justify-between items-center flex-shrink-0"><h2 className="text-sm font-black flex items-center uppercase uppercase"><Package className="mr-1.5" size={18}/> Giỏ hàng nhập</h2><span className="bg-primary px-2 py-0.5 rounded-full text-[10px] font-black">{receipt.length} SP</span></div>
                    <div className="p-2 space-y-1 bg-white border-b-2 border-slate-200">
                        {receipt.length === 0 ? (
                            <div className="h-20 flex flex-col items-center justify-center opacity-20">
                                <Archive size={40} className="mb-2 text-black"/>
                                <p className="font-black text-[9px] text-black uppercase">Trống</p>
                            </div>
                        ) : (
                            receipt.map((item, idx) => (
                                <div key={item.productId} className={`bg-slate-50 p-3 rounded-xl border border-slate-200 animate-fade-in ${item.updateImportPrice ? 'border-blue-500 bg-blue-50' : ''}`}>
                                    <div className="flex justify-between items-start mb-2 gap-1">
                                        <span className="font-black text-primary text-base truncate uppercase leading-tight flex-1">{idx+1}. {item.productName}</span>
                                        <button onClick={() => setReceipt(receipt.filter(i => i.productId !== item.productId))} className="text-slate-300 hover:text-red-500 flex-shrink-0"><X size={16}/></button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 items-center mb-2">
                                        <div className="flex items-center space-x-2">
                                            <button onClick={() => setReceipt(receipt.map(i => i.productId === item.productId ? {...i, quantity: i.quantity - 1} : i).filter(i => i.quantity > 0))} className="p-1.5 bg-slate-300 text-black border rounded hover:bg-black transition-all"><Minus size={12}/></button>
                                            <input 
                                                type="number" 
                                                value={item.quantity} 
                                                onChange={(e) => setReceipt(receipt.map(i => i.productId === item.productId ? {...i, quantity: Math.max(0, parseInt(e.target.value) || 0)} : i))}
                                                onFocus={(e) => e.target.select()}
                                                className="w-12 text-center font-black text-xl text-primary bg-transparent border-none focus:ring-0 appearance-none p-0" 
                                            />
                                            <button onClick={() => setReceipt(receipt.map(i => i.productId === item.productId ? {...i, quantity: i.quantity + 1} : i))} className="p-1.5 bg-slate-300 text-black border rounded hover:bg-black transition-all"><Plus size={12}/></button>
                                        </div>
                                        <div className="text-right relative">
                                            <NumericInput value={item.importPrice} onChange={(val) => setReceipt(receipt.map(i => i.productId === item.productId ? {...i, importPrice: val} : i))} className="w-full p-1.5 border-2 border-slate-800 rounded font-black text-right focus:border-primary outline-none text-white bg-slate-900" />
                                            <p className="text-[10px] font-black text-neutral mt-1">Tổng: {formatNumber(item.importPrice * item.quantity)} ₫</p>
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <div className={`flex items-center mt-1 p-1 rounded border-2 cursor-pointer transition-all ${item.updateImportPrice ? 'bg-blue-600 text-white border-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                                            <input type="checkbox" id={`pos-up-imp-${item.productId}`} checked={item.updateImportPrice} onChange={e => setReceipt(receipt.map(i => i.productId === item.productId ? {...i, updateImportPrice: e.target.checked} : i))} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-0 mr-1.5" />
                                            <label htmlFor={`pos-up-imp-${item.productId}`} className="text-[9px] font-black uppercase flex-1">Cập nhật giá gốc</label>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-3 bg-white flex-shrink-0 shadow-sm"><div className="flex justify-between items-end border-t pt-1.5 mb-3"><span className="text-[10px] font-black text-black uppercase tracking-widest mb-1">Thanh toán nhập</span><span className="font-black text-primary leading-none text-3xl">{formatNumber(receipt.reduce((s,i) => s + i.importPrice*i.quantity, 0))}<span className="text-xs ml-0.5 font-black">₫</span></span></div><button onClick={handleConfirmReceipt} disabled={isProcessing || receipt.length === 0 || !selectedSupplierId || !selectedWarehouseId} className={`w-full py-4 bg-white border-2 rounded-2xl font-black text-lg shadow-lg active:scale-95 disabled:bg-slate-200 flex items-center justify-center uppercase ${paymentStatus === 'debt' ? 'border-red-600 text-red-600' : 'border-blue-600 text-blue-600'}`}>{isProcessing ? <Loader className="animate-spin mr-2" size={20}/> : <Archive className="mr-2" size={24}/>}{paymentStatus === 'debt' ? 'Ghi nợ NCC' : 'Hoàn tất nhập'}</button></div>
                    <div className="p-3 bg-slate-100 border-t-4 border-slate-800 flex-1 overflow-y-auto pb-20">
                        <div className="space-y-3">
                            {todayReceipts.map(r => (
                                <div key={r.id} className="bg-white border-2 border-slate-800 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-slate-800 p-2.5 text-white">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <span className="text-[11px] font-black uppercase truncate bg-white/20 px-2 py-0.5 rounded leading-none">{r.supplierName}</span>
                                                {r.hasInvoice && <span className="bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded font-black uppercase shadow-sm">HĐ ĐỎ</span>}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button onClick={() => { setSelectedReceiptEdit(r); setIsEditModalOpen(true); }} className="p-1 bg-white/20 text-white rounded hover:bg-orange-500 transition" title="Sửa đơn nhập"><Edit size={12}/></button>
                                                <button onClick={() => { setSelectedReceiptDetail(r); setIsDetailModalOpen(true); }} className="p-1 bg-white/20 text-white rounded hover:bg-primary transition" title="Xem chi tiết"><Eye size={12}/></button>
                                                <span className="text-sm font-black text-yellow-400 ml-1">{formatNumber(r.total)} ₫</span>
                                            </div>
                                        </div>
                                        
                                        {/* CẬP NHẬT: Thông tin Trạng thái, PTTT, Kho nhập */}
                                        <div className="flex flex-wrap gap-1.5 items-center opacity-90 mt-1.5">
                                            <span className="flex items-center text-[9px] font-bold bg-white/10 px-1.5 py-0.5 rounded"><Archive size={10} className="mr-1"/> {r.warehouseName}</span>
                                            <span className="flex items-center text-[9px] font-bold bg-white/10 px-1.5 py-0.5 rounded"><CreditCard size={10} className="mr-1"/> {r.paymentMethodName || 'Ghi nợ'}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase shadow-sm ${r.paymentStatus === 'debt' ? 'bg-red-600 text-white animate-pulse' : 'bg-green-600 text-white'}`}>
                                                {r.paymentStatus === 'debt' ? 'CÒN NỢ' : 'ĐÃ TRẢ'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-2.5 space-y-2 bg-white">
                                        {r.items?.map((it, idx) => (
                                            <div key={idx} className="flex flex-col border-b border-slate-50 last:border-0 pb-1.5">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="font-bold text-slate-800 text-[11px] truncate uppercase">{it.productName}</span>
                                                        {it.isCombo && <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1 rounded uppercase">Combo</span>}
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className="font-black text-primary text-[10px] whitespace-nowrap">
                                                            {formatNumber(it.importPrice)} x {it.quantity} = {formatNumber(it.importPrice * it.quantity)} ₫
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default CreateGoodsReceipt;
