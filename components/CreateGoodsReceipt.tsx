
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, writeBatch, doc, serverTimestamp, query, orderBy, increment, setDoc, Timestamp, where, addDoc, limit, getDocs, updateDoc, deleteDoc, runTransaction, collectionGroup, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { Product, Supplier, GoodsReceiptItem, Warehouse, PaymentMethod, Manufacturer, GoodsReceipt, PlannedOrder, ChinaImport } from '../types';
import { Archive, Plus, Minus, X, CheckCircle, Loader, XCircle, Search, Users, Package, CreditCard, History, Calendar, ArrowUpCircle, ArrowDownCircle, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, FileCheck2, PlusCircle, Wallet, Download, TrendingUp, TrendingDown, AlertCircle, AlertTriangle, Info, ExternalLink, Tag, ClipboardList, Maximize2, Minimize2, Banknote, FileText, Eye, Trash2, Save, Edit, Plane, Truck , Sparkles } from 'lucide-react';
import { formatNumber, parseNumber, getLocalYYYYMMDD } from '../utils/formatting';
import GoodsReceiptDetailModal from './GoodsReceiptDetailModal';
import GoodsReceiptEditModal from './GoodsReceiptEditModal';
import PriceComparisonModal from './PriceComparisonModal';
import InventoryLedger from './InventoryLedger';
import StockStatusBadge from './StockStatusBadge';
import { ProductModal } from './ProductManagement';
import { SupplierModal } from './SupplierManagement';
import { SupplierBankSelector } from './SupplierBankSelector';
import { User } from 'firebase/auth';

// Add missing getTodayString helper function
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
    detailedInventory: Record<string, Record<string, number>>;
    warehouses: Warehouse[];
    onAdd: (product: Product, quantity: number, importPrice: number, keepSearch?: boolean) => void;
    onUpdateImportPrice?: (productId: string, price: number) => Promise<void>;
    onCompare?: (product: Product) => void;
    onTrace?: (product: Product) => void;
    userRole: 'admin' | 'staff' | null;
}> = ({ product, lastSupplierPrice, detailedInventory, warehouses, onAdd, onUpdateImportPrice, onCompare, onTrace, userRole }) => {
    const initialPrice = lastSupplierPrice !== undefined ? lastSupplierPrice : product.importPrice;
    const [inputQty, setInputQty] = useState(1);
    const [inputImportPrice, setInputImportPrice] = useState(initialPrice);
    const [isSaving, setIsSaving] = useState(false);
    const [isNameExpanded, setIsNameExpanded] = useState(false);
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

    // Get inventory for the first 3 warehouses
    const productInventory = detailedInventory[product.id] || {};
    const totalStock = Object.values(productInventory).reduce((sum, v) => sum + (v || 0), 0);
    const topWarehouses = warehouses.slice(0, 3);

    return (
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 hover:shadow-md transition-all duration-200 flex flex-col justify-between relative group hover:border-primary/50 h-full shadow-2xs">
            {product.isCombo && (
                <div className="absolute top-0 left-0 bg-blue-600 text-white text-[8px] px-2 py-0.5 rounded-br-lg font-bold z-10 uppercase shadow-2xs">COMBO</div>
            )}
            {/* Header: Product Name + Action Buttons */}
            <div className="mb-2 mt-1 flex justify-between items-center gap-1">
                <div 
                    className={`font-bold text-slate-900 leading-tight text-[12px] cursor-pointer transition-all ${isNameExpanded ? '' : 'line-clamp-2 hover:line-clamp-none'} flex-1 min-w-0 pr-1`}
                    title={product.name}
                    onClick={() => setIsNameExpanded(!isNameExpanded)}
                >
                    {product.name}
                    {product.shortName && (
                        <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded border border-amber-300/80 inline-block">
                            {product.shortName}
                        </span>
                    )}
                </div>

                {!product.isCombo && (
                    <div className="flex gap-1 shrink-0">
                        {isAdmin && (
                            <button 
                                onClick={handleSaveBasePrice} 
                                disabled={isSaving}
                                className={`p-1.5 rounded-lg transition-all shadow-2xs flex items-center justify-center h-6 w-6 ${lastSupplierPrice !== undefined ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-800 text-white hover:bg-slate-900'}`}
                                title="Lưu thành giá vốn gốc của sản phẩm"
                            >
                                {isSaving ? <Loader size={11} className="animate-spin"/> : <Save size={11}/>}
                            </button>
                        )}
                        <button 
                            onClick={() => onCompare?.(product)}
                            className="p-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-600 hover:text-white transition shadow-2xs border border-orange-200 flex items-center justify-center h-6 w-6"
                            title="So sánh giá nhập"
                        >
                            <TrendingUp size={11}/>
                        </button>
                        <button 
                            onClick={() => onTrace?.(product)}
                            className="p-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-600 hover:text-white transition shadow-2xs border border-purple-200 flex items-center justify-center h-6 w-6"
                            title="Truy vết tồn kho"
                        >
                            <History size={11}/>
                        </button>
                    </div>
                )}
            </div>

            {/* Hàng 1: Huy hiệu tình trạng tồn kho */}
            <div className="my-1">
                <StockStatusBadge stock={totalStock} className="text-[10px]" />
            </div>

            {/* Hàng 2: Chi tiết số lượng từng kho */}
            <div className="grid grid-cols-3 gap-1 text-[9px] font-bold mb-2 bg-slate-50/80 p-1 rounded-lg border border-slate-100 text-center">
                {topWarehouses.map(w => {
                    const wStock = productInventory[w.id] || 0;
                    const colorClass = wStock > 5 ? 'text-emerald-600 font-bold' : wStock > 0 ? 'text-amber-600 font-bold' : 'text-slate-400 font-medium';
                    return (
                        <div key={w.id} className="min-w-0" title={`${w.name}: ${wStock}`}>
                            <div className="text-[8px] text-slate-400 uppercase truncate">{w.name}</div>
                            <div className={colorClass}>{wStock}</div>
                        </div>
                    );
                })}
            </div>
            <div className="space-y-1 mb-2">
                <div className="flex items-center gap-1">
                    <div className="relative flex-1">
                        <NumericInput 
                            value={inputImportPrice}
                            onChange={setInputImportPrice}
                            className={`w-full pl-7 pr-2 py-1.5 text-sm border rounded-lg font-bold text-right focus:ring-2 focus:ring-primary/20 outline-none shadow-2xs transition-colors ${lastSupplierPrice !== undefined ? 'bg-amber-50/60 border-amber-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'}`}
                        />
                        <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold ${lastSupplierPrice !== undefined ? 'text-amber-700' : 'text-slate-400'}`}>VỐN</span>
                    </div>
                </div>
            </div>
            <div className="flex space-x-1.5">
                <input type="number" value={inputQty} onChange={(e) => setInputQty(parseInt(e.target.value) || 0)} onFocus={(e) => e.target.select()} className="w-12 px-1 py-1.5 text-xs border border-slate-200 bg-slate-50 text-slate-900 rounded-lg outline-none text-center font-bold focus:border-primary focus:bg-white transition" min="1" />
                <button onClick={() => { onAdd(product, inputQty, inputImportPrice, false); setInputQty(1); }} className="flex-1 py-1.5 bg-primary hover:bg-primary-hover text-white text-[11px] font-bold rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center uppercase tracking-tight gap-1"><Plus size={13}/> Nhập</button>
                <button onClick={() => { onAdd(product, inputQty, inputImportPrice, true); setInputQty(1); }} className="px-2.5 py-1.5 bg-slate-800 text-white text-[11px] font-bold rounded-lg shadow-sm flex items-center justify-center hover:bg-slate-900 transition active:scale-95" title="Nhập tiếp mặt hàng này (không xóa ô tìm kiếm)"><Plus size={13}/></button>
            </div>
        </div>
    );
};

const CreateGoodsReceipt: React.FC<{ userRole: 'admin' | 'staff' | null, user: User | null }> = ({ userRole, user }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [detailedInventory, setDetailedInventory] = useState<Record<string, Record<string, number>>>({});
  const [receipt, setReceipt] = useState<ReceiptItem[]>([]);
  const [todayReceipts, setTodayReceipts] = useState<GoodsReceipt[]>([]);
  
  // Nguồn dữ liệu nhập thêm
  const [plannedOrders, setPlannedOrders] = useState<PlannedOrder[]>([]);
  const [chinaImports, setChinaImports] = useState<ChinaImport[]>([]);
  const [sourceOrderDetails, setSourceOrderDetails] = useState<{type: 'planned'|'china', id: string} | null>(null);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'debt'>('paid');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [isCreatingNewBank, setIsCreatingNewBank] = useState(false);
  const [newBankDetails, setNewBankDetails] = useState({ bankName: '', accountNumber: '', accountName: '' });
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
  const [isPriceComparisonOpen, setIsPriceComparisonOpen] = useState(false);
  const [selectedPriceComparisonProduct, setSelectedPriceComparisonProduct] = useState<Product | null>(null);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [selectedLedgerProductId, setSelectedLedgerProductId] = useState<string | null>(null);
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    onSnapshot(query(collection(db, "products"), orderBy("name")), (snap) => setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product))));
    onSnapshot(query(collection(db, "suppliers"), orderBy("name")), (snap) => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier))));
    onSnapshot(query(collection(db, "warehouses"), orderBy("name")), (snap) => setWarehouses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse))));
    onSnapshot(query(collection(db, "paymentMethods"), orderBy("name")), (snap) => setPaymentMethods(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod))));
    onSnapshot(query(collection(db, "manufacturers"), orderBy("name")), (snap) => setManufacturers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    
    // Inventory listener
    onSnapshot(query(collectionGroup(db, 'inventory')), (snapshot) => { 
        const data: Record<string, Record<string, number>> = {}; 
        snapshot.forEach(doc => { 
            const d = doc.data() as { warehouseId?: string; stock: number }; 
            const pid = doc.ref.parent.parent?.id; 
            const warehouseId = d.warehouseId || doc.id;
            if (pid && warehouseId) { 
                if (!data[pid]) data[pid] = {}; 
                data[pid][warehouseId] = d.stock || 0; 
            } 
        }); 
        setDetailedInventory(data); 
    });

    // Tải các đơn nguồn
    onSnapshot(query(collection(db, "plannedOrders"), where("status", "==", "pending")), (snap) => setPlannedOrders(snap.docs.map(d => ({id: d.id, ...d.data()} as PlannedOrder))));
    
    // CẬP NHẬT: Lấy các đơn hàng Trung Quốc ở trạng thái đã thanh toán hoặc đang nhập hàng (để có thể nhập)
    onSnapshot(query(collection(db, "chinaImports"), where("status", "in", ["paid", "importing"])), (snap) => setChinaImports(snap.docs.map(d => ({id: d.id, ...d.data()} as ChinaImport))));

    const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
    onSnapshot(query(collection(db, "goodsReceipts"), where("createdAt", ">=", Timestamp.fromDate(startOfToday)), orderBy("createdAt", "desc")), (snap) => setTodayReceipts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GoodsReceipt))));
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

  const addToReceipt = (product: Product, quantity: number, importPrice: number, keepSearch: boolean = false) => {
    if (quantity <= 0) return;
    const existing = receipt.find(item => item.productId === product.id);
    if (existing) {
      setReceipt(receipt.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + quantity, importPrice } : item));
    } else {
      setReceipt([...receipt, { productId: product.id, productName: product.name, quantity, importPrice, originalImportPrice: product.importPrice, updateImportPrice: false, isCombo: !!product.isCombo, comboItems: product.comboItems || [] }]);
    }
    if (!keepSearch) {
      setSearchTerm('');
    }
    setToast({ message: "Đã thêm thành công!", type: 'success' });
  };

  const moveItemUp = (index: number) => {
    if (index <= 0) return;
    setReceipt(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  const moveItemDown = (index: number) => {
    if (index >= receipt.length - 1) return;
    setReceipt(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
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
              setSourceOrderDetails({ type: 'planned', id });
              setToast({ message: `Đã tải ${items.length} SP từ đơn dự kiến`, type: 'success' });
          }
      } else if (type === 'china') {
          const imp = chinaImports.find(o => o.id === id);
          if (imp) {
              const tqSupplier = suppliers.find(s => s.name.toLowerCase().includes('trung quốc'));
              if (tqSupplier) {
                  setSelectedSupplierId(tqSupplier.id);
                  setSupplierSearchTerm(tqSupplier.name);
              } else {
                  setSelectedSupplierId('');
                  setSupplierSearchTerm('Trung Quốc');
              }

              const cashPayment = paymentMethods.find(p => p.name.toLowerCase().includes('tiền mặt'));
              if (cashPayment) {
                  setSelectedPaymentMethodId(cashPayment.id);
                  setPaymentStatus('paid');
              } else {
                  setSelectedPaymentMethodId('');
              }

              const externalWarehouse = warehouses.find(w => w.name.toLowerCase().includes('ngoài ch') || w.name.toLowerCase().includes('ngoài cửa hàng'));
              if (externalWarehouse) {
                  setSelectedWarehouseId(externalWarehouse.id);
              }

              const items: ReceiptItem[] = imp.items.map(i => {
                  const p = products.find(prod => prod.id === i.productId);
                  const basePriceVND = Math.round(i.priceCNY * imp.exchangeRate);
                  return {
                      productId: i.productId,
                      productName: i.productName,
                      quantity: i.quantity,
                      importPrice: basePriceVND,
                      originalImportPrice: p?.importPrice || 0,
                      updateImportPrice: false,
                      isCombo: p?.isCombo || false,
                      comboItems: p?.comboItems || []
                  };
              });
              setReceipt(items);
              setSourceOrderDetails({ type: 'china', id });
              setToast({ message: `Đã tải ${items.length} SP từ đơn TQ (Giá gốc)`, type: 'success' });
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

  const handleSaveNewBank = async () => {
      if (!selectedSupplierId) {
          setToast({ message: "Vui lòng chọn nhà cung cấp trước.", type: 'error' });
          return;
      }
      if (!newBankDetails.bankName || !newBankDetails.accountNumber) {
          setToast({ message: "Vui lòng nhập tên ngân hàng và số tài khoản", type: 'error' });
          return;
      }
      try {
          const newId = Date.now().toString();
          const newAccount = { id: newId, ...newBankDetails };
          await updateDoc(doc(db, 'suppliers', selectedSupplierId), {
              bankAccounts: arrayUnion(newAccount)
          });
          setSelectedBankAccountId(newId);
          setIsCreatingNewBank(false);
          setNewBankDetails({ bankName: '', accountNumber: '', accountName: '' });
          setToast({ message: "Đã lưu tài khoản ngân hàng mới!", type: 'success' });
      } catch (e: any) {
          console.error(e);
          setToast({ message: "Lỗi khi lưu tài khoản NH: " + e.message, type: 'error' });
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
    if (receipt.length === 0 || !selectedSupplierId || !selectedWarehouseId) { 
        alert("Vui lòng chọn đầy đủ Nhà cung cấp, Kho nhập và ít nhất 1 sản phẩm."); 
        return; 
    }
    if (paymentStatus === 'paid' && !selectedPaymentMethodId) {
        alert("Vui lòng chọn Phương thức thanh toán khi thanh toán ngay, hoặc tích chọn 'Ghi nợ NCC' nếu chưa thanh toán.");
        return;
    }
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

          let finalBankAccountId = null;
          let finalBankDetails = null;
          if (paymentStatus === 'paid') {
              const supplierRef = doc(db, 'suppliers', selSup.id);
              const supplierSnap = await transaction.get(supplierRef);
              if (supplierSnap.exists()) {
                  let supplierData = supplierSnap.data();
                  let accounts = supplierData.bankAccounts || [];
                  if (isCreatingNewBank && newBankDetails.bankName && newBankDetails.accountNumber) {
                      const newId = Date.now().toString();
                      const newAccount = {
                          id: newId,
                          bankName: newBankDetails.bankName,
                          accountNumber: newBankDetails.accountNumber,
                          accountName: newBankDetails.accountName
                      };
                      accounts.push(newAccount);
                      transaction.update(supplierRef, { bankAccounts: accounts });
                      finalBankAccountId = newId;
                      finalBankDetails = newAccount;
                  } else if (selectedBankAccountId) {
                      finalBankAccountId = selectedBankAccountId;
                      finalBankDetails = accounts.find((a: any) => a.id === selectedBankAccountId) || null;
                  }
              }
          }
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
            productIds: receipt.map(i => i.productId),
            total, 
            supplierId: selSup.id, 
            supplierName: selSup.name,
             supplierBankAccountId: finalBankAccountId,
             supplierBankDetails: finalBankDetails, 
            warehouseId: selWh.id, 
            warehouseName: selWh.name, 
            paymentMethodId: selectedPaymentMethodId || null, 
            paymentMethodName: paymentMethods.find(p => p.id === selectedPaymentMethodId)?.name || null, 
            paymentStatus, 
            amountPaid: paymentStatus === 'paid' ? total : 0,
            paidAt: paymentStatus === 'paid' ? finalCreatedAt : null,
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
            if (isAdmin && (item.updateImportPrice || (item.originalImportPrice !== undefined && item.importPrice > item.originalImportPrice))) {
                transaction.update(doc(db, 'products', item.productId), { importPrice: item.importPrice });
            }
          }

          if (sourceOrderDetails) {
              if (sourceOrderDetails.type === 'planned') {
                  transaction.update(doc(db, 'plannedOrders', sourceOrderDetails.id), { status: 'completed' });
              } else if (sourceOrderDetails.type === 'china') {
                  transaction.update(doc(db, 'chinaImports', sourceOrderDetails.id), { status: 'imported' });
              }
          }
      });
      setReceipt([]); setSelectedSupplierId(''); setSupplierSearchTerm(''); setSourceOrderDetails(null);
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

  const filteredProducts = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return products.filter(p => (p.name || '').toLowerCase().includes(lower) || (p.shortName || '').toLowerCase().includes(lower));
  }, [products, searchTerm]);
  const paginatedProducts = useMemo(() => filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredProducts, currentPage, pageSize]);

  const suggestedProducts = useMemo(() => {
      if (!selectedSupplierId) return [];
      const supplierProducts = products.filter(p => p.id in supplierPriceHistory);
      return supplierProducts.sort((a, b) => {
          const invA = Object.values(detailedInventory[a.id] || {}).reduce((s, v) => s + v, 0);
          const invB = Object.values(detailedInventory[b.id] || {}).reduce((s, v) => s + v, 0);
          return invA - invB;
      }).slice(0, 10);
  }, [selectedSupplierId, products, supplierPriceHistory, detailedInventory]);

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
                                    <div className="relative ml-2 w-48">
                                        <ClipboardList className="absolute left-2 top-1/2 -translate-y-1/2 text-white" size={14}/>
                                        <select 
                                            onChange={(e) => handleImportFromSource(e.target.value)}
                                            className="w-full pl-7 pr-1 py-1.5 border border-black bg-black rounded-lg text-[10px] font-black text-white focus:ring-2 focus:ring-primary focus:outline-none appearance-none uppercase shadow-sm cursor-pointer"
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                <div className="relative flex gap-1" ref={supplierDropdownRef}><div className="relative flex-1"><Users className="absolute left-2 top-1/2 -translate-y-1/2 text-black" size={16}/><input type="text" placeholder="Tìm NCC..." value={supplierSearchTerm} onChange={e => { setSupplierSearchTerm(e.target.value); setIsSupplierDropdownOpen(true); }} onFocus={() => setIsSupplierDropdownOpen(true)} className="w-full pl-8 pr-1 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary outline-none" />{isSupplierDropdownOpen && (<div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">{suppliers.filter(s => {
    const term = (supplierSearchTerm || '').toLowerCase();
    return (s.name || '').toLowerCase().includes(term) || (s.phone || '').includes(term);
}).map(s => <button key={s.id} onClick={() => { setSelectedSupplierId(s.id); setSupplierSearchTerm(s.name); setIsSupplierDropdownOpen(false); }} className="w-full text-left px-2 py-1.5 hover:bg-blue-50 text-[10px] border-b font-black text-black">{s.name}</button>)}</div>)}</div><button onClick={() => setIsSupplierModalOpen(true)} className="p-2 bg-green-100 text-green-600 rounded-lg border hover:bg-green-600 transition shadow-sm"><Plus size={18}/></button></div>
                                <div className="relative"><Archive className="absolute left-2 top-1/2 -translate-y-1/2 text-black" size={16}/><select value={selectedWarehouseId} onChange={e => setSelectedWarehouseId(e.target.value)} className="w-full pl-8 pr-1 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary focus:outline-none appearance-none"><option value="">Kho nhập...</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
                                
                                <div className="relative">
                                    <CreditCard className="absolute left-2 top-1/2 -translate-y-1/2 text-black" size={16}/>
                                    <select 
                                        value={selectedPaymentMethodId} 
                                        onChange={e => setSelectedPaymentMethodId(e.target.value)} 
                                        className="w-full pl-8 pr-1 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary focus:outline-none appearance-none" 
                                        disabled={paymentStatus === 'debt'}
                                    >
                                        <option value="">PT Thanh toán...</option>
                                        {paymentMethods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                {paymentStatus === 'paid' && selectedSupplierId && (
                                    <div className="col-span-1 sm:col-span-2 lg:col-span-1">
                                    <SupplierBankSelector 
                                        supplier={suppliers.find(s => s.id === selectedSupplierId)}
                                        selectedBankAccountId={selectedBankAccountId}
                                        onSelect={setSelectedBankAccountId}
                                        isCreatingNew={isCreatingNewBank}
                                        setIsCreatingNew={setIsCreatingNewBank}
                                        newBankDetails={newBankDetails}
                                        onNewBankChange={(field, val) => setNewBankDetails(prev => ({...prev, [field]: val}))}
                                        onSaveNewBank={handleSaveNewBank}
                                        theme="dark"
                                    />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18}/>
                                <input 
                                    ref={searchInputRef}
                                    type="text" 
                                    placeholder="GÕ TÊN SẢN PHẨM ĐỂ NHẬP..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)} 
                                    className="w-full pl-11 pr-11 py-3 bg-blue-50/70 border border-blue-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white outline-none font-bold text-base text-slate-900 shadow-sm transition-all placeholder:text-slate-400" 
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm('');
                                            searchInputRef.current?.focus();
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-slate-200/80 hover:bg-slate-300 active:scale-90 text-slate-600 hover:text-slate-900 transition shadow-2xs cursor-pointer z-10"
                                        title="Xóa nội dung tìm kiếm (X)"
                                        aria-label="Xóa nội dung tìm kiếm"
                                    >
                                        <X size={15} className="stroke-[2.5]" />
                                    </button>
                                )}
                            </div>
                            <button 
                                onClick={() => setIsProductModalOpen(true)} 
                                className="px-3.5 py-2.5 bg-emerald-600 text-white rounded-xl flex items-center hover:bg-emerald-700 transition shadow-sm font-bold text-xs uppercase"
                                title="Tạo sản phẩm mới nhanh"
                            >
                                <PlusCircle size={15} className="mr-1.5"/> TẠO SP
                            </button>
                            {!isFullscreen && (
                                <button onClick={() => setIsFullscreen(true)} className="px-3.5 py-2.5 bg-slate-800 text-white rounded-xl flex items-center hover:bg-slate-900 transition shadow-sm font-bold text-xs uppercase">
                                    <Maximize2 size={15} className="mr-1.5"/> POS
                                </button>
                            )}
                        </div>
                        {suggestedProducts.length > 0 && !searchTerm && (
                            <div className="mb-2">
                                <div className="text-[10px] font-black text-slate-500 uppercase mb-1.5 flex items-center"><Sparkles size={12} className="mr-1 text-yellow-500"/> Gợi ý mặt hàng nên nhập từ NCC này (tồn kho thấp)</div>
                                <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
                                    {suggestedProducts.map(sp => {
                                        const stock = Object.values(detailedInventory[sp.id] || {}).reduce((s, v) => s + v, 0);
                                        return (
                                        <button 
                                            key={sp.id} 
                                            onClick={() => addToReceipt(sp, 1, supplierPriceHistory[sp.id] || sp.importPrice, false)}
                                            className="px-3 py-1.5 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg whitespace-nowrap font-black text-[11px] hover:bg-yellow-100 flex flex-col items-start transition-colors"
                                        >
                                            <span className="flex items-center">
                                                <Plus size={12} className="mr-1 opacity-50"/> 
                                                {sp.name}
                                                {sp.shortName && (
                                                    <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[9px] font-black rounded border border-amber-300 inline-block">
                                                        {sp.shortName}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-[9px] opacity-70 mt-0.5">Tồn: {stock} | Lần trước: {new Intl.NumberFormat('vi-VN').format(supplierPriceHistory[sp.id] || sp.importPrice)}</span>
                                        </button>
                                    )})}
                                </div>
                            </div>
                        )}
                        <div className={`grid gap-2 content-start ${isFullscreen ? 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'}`}>{loading ? <div className="col-span-full flex items-center justify-center h-40"><Loader className="animate-spin text-primary" size={32}/></div> : paginatedProducts.map(p => (<ImportProductCard key={p.id} product={p} lastSupplierPrice={supplierPriceHistory[p.id]} detailedInventory={detailedInventory} warehouses={warehouses} onAdd={addToReceipt} onUpdateImportPrice={handleUpdateProductImportPrice} onCompare={(prod) => { setSelectedPriceComparisonProduct(prod); setIsPriceComparisonOpen(true); }} onTrace={(prod) => { setSelectedLedgerProductId(prod.id); setIsLedgerModalOpen(true); }} userRole={userRole} />)) }</div>
                        <div className="mt-3 flex justify-between items-center border-t pt-3 shrink-0"><div className="text-[9px] font-black text-black uppercase">Trang {currentPage}</div><div className="flex space-x-1"><button onClick={() => setCurrentPage(p => Math.max(1, p-1))} className="p-1.5 bg-slate-100 rounded-lg text-black font-black"><ChevronLeft size={16}/></button><button onClick={() => setCurrentPage(p => p + 1)} className="p-1.5 bg-slate-100 rounded-lg text-black font-black"><ChevronRight size={16}/></button></div></div>
                    </div>
                </div>
            </div>
            <div className={`flex flex-col min-h-0 ${isFullscreen ? 'lg:w-[35%]' : 'lg:w-2/5'}`}>
                <div className="bg-white rounded-xl shadow-md flex-1 flex flex-col overflow-hidden border border-slate-200 overflow-y-auto">
                    <div className="bg-slate-900 px-4 py-3 text-white flex justify-between items-center flex-shrink-0 border-b border-slate-800"><h2 className="text-sm font-bold flex items-center uppercase"><Package className="mr-1.5" size={18}/> Giỏ hàng nhập</h2><span className="bg-primary px-2.5 py-0.5 rounded-full text-[10px] font-bold">{receipt.length} SP</span></div>
                    <div className="p-2 space-y-1.5 bg-white border-b border-slate-200">
                        {receipt.length === 0 ? (
                            <div className="h-20 flex flex-col items-center justify-center opacity-30">
                                <Archive size={36} className="mb-1.5 text-slate-500"/>
                                <p className="font-bold text-[10px] text-slate-500 uppercase">Trống</p>
                            </div>
                        ) : (
                            receipt.map((item, idx) => (
                                <div key={item.productId} className={`bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80 animate-fade-in shadow-2xs ${item.updateImportPrice ? 'border-blue-400 bg-blue-50/40' : ''}`}>
                                    <div className="flex justify-between items-start mb-2 gap-1">
                                        <span className="font-bold text-primary text-sm truncate uppercase leading-tight flex-1">{idx+1}. {item.productName}</span>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button 
                                                type="button"
                                                onClick={() => moveItemUp(idx)}
                                                disabled={idx === 0}
                                                className="p-1 rounded bg-slate-200/80 hover:bg-slate-300 text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition shadow-2xs active:scale-95"
                                                title="Di chuyển lên trên"
                                            >
                                                <ChevronUp size={14} strokeWidth={2.5}/>
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => moveItemDown(idx)}
                                                disabled={idx === receipt.length - 1}
                                                className="p-1 rounded bg-slate-200/80 hover:bg-slate-300 text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition shadow-2xs active:scale-95"
                                                title="Di chuyển xuống dưới"
                                            >
                                                <ChevronDown size={14} strokeWidth={2.5}/>
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => setReceipt(receipt.filter(i => i.productId !== item.productId))} 
                                                className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                                                title="Xóa khỏi đơn"
                                            >
                                                <X size={16}/>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 items-center mb-2">
                                        <div className="flex items-center space-x-1.5">
                                            <button onClick={() => setReceipt(receipt.map(i => i.productId === item.productId ? {...i, quantity: i.quantity - 1} : i).filter(i => i.quantity > 0))} className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all active:scale-95"><Minus size={12}/></button>
                                            <input 
                                                type="number" 
                                                value={item.quantity} 
                                                onChange={(e) => setReceipt(receipt.map(i => i.productId === item.productId ? {...i, quantity: Math.max(0, parseInt(e.target.value) || 0)} : i))}
                                                onFocus={(e) => e.target.select()}
                                                className="w-12 text-center font-bold text-lg text-primary bg-transparent border-none focus:ring-0 appearance-none p-0" 
                                            />
                                            <button onClick={() => setReceipt(receipt.map(i => i.productId === item.productId ? {...i, quantity: i.quantity + 1} : i))} className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all active:scale-95"><Plus size={12}/></button>
                                        </div>
                                        <div className="text-right relative">
                                            <NumericInput value={item.importPrice} onChange={(val) => setReceipt(receipt.map(i => i.productId === item.productId ? {...i, importPrice: val} : i))} className="w-full p-1.5 border border-slate-700 rounded-lg font-bold text-right focus:ring-2 focus:ring-primary/20 outline-none text-white bg-slate-900 text-sm shadow-2xs" />
                                            <p className="text-[10px] font-bold text-slate-500 mt-1">Tổng: {formatNumber(item.importPrice * item.quantity)} ₫</p>
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <div className={`flex items-center mt-1 p-1 rounded-lg border cursor-pointer transition-all ${item.updateImportPrice ? 'bg-blue-50 border-blue-300 text-blue-800 font-bold' : 'bg-white border-slate-200 text-slate-500'}`}>
                                            <input type="checkbox" id={`pos-up-imp-${item.productId}`} checked={item.updateImportPrice} onChange={e => setReceipt(receipt.map(i => i.productId === item.productId ? {...i, updateImportPrice: e.target.checked} : i))} className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-0 mr-1.5" />
                                            <label htmlFor={`pos-up-imp-${item.productId}`} className="text-[9px] font-bold uppercase flex-1 cursor-pointer">Cập nhật giá gốc</label>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-3 bg-white flex-shrink-0 shadow-sm border-b border-slate-200">
                        <div className="flex justify-between items-end mb-2.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Thanh toán nhập</span>
                            <span className="font-bold text-primary leading-none text-2xl">{formatNumber(receipt.reduce((s,i) => s + i.importPrice*i.quantity, 0))}<span className="text-xs ml-0.5 font-bold text-slate-500">₫</span></span>
                        </div>
                        <button 
                            onClick={handleConfirmReceipt} 
                            disabled={isProcessing || receipt.length === 0 || !selectedSupplierId || !selectedWarehouseId} 
                            className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-md active:scale-98 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 flex items-center justify-center uppercase tracking-tight transition-all text-white ${paymentStatus === 'debt' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary hover:bg-primary-hover'}`}
                        >
                            {isProcessing ? <Loader className="animate-spin mr-2" size={18}/> : <Archive className="mr-2" size={18}/>}
                            {paymentStatus === 'debt' ? 'Ghi nợ NCC' : 'Hoàn tất nhập'}
                        </button>
                    </div>
                    <div className="p-3 bg-slate-50 border-t border-slate-200 flex-1 overflow-y-auto pb-20">
                        <div className="space-y-3">
                            {todayReceipts.map(r => (
                                <div key={r.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all">
                                    <div className="bg-slate-900 p-2.5 text-white border-b border-slate-800">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <span className="text-[11px] font-bold uppercase truncate bg-white/15 px-2 py-0.5 rounded leading-none">{r.supplierName}</span>
                                                {r.hasInvoice && <span className="bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded font-bold uppercase shadow-2xs">HĐ ĐỎ</span>}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button onClick={() => { setSelectedReceiptEdit(r); setIsEditModalOpen(true); }} className="p-1 bg-white/15 text-white rounded hover:bg-orange-500 transition" title="Sửa đơn nhập"><Edit size={12}/></button>
                                                <button onClick={() => { setSelectedReceiptDetail(r); setIsDetailModalOpen(true); }} className="p-1 bg-white/15 text-white rounded hover:bg-primary transition" title="Xem chi tiết"><Eye size={12}/></button>
                                                <span className="text-sm font-bold text-amber-300 ml-1">{formatNumber(r.total)} ₫</span>
                                            </div>
                                        </div>
                                        
                                        {/* CẬP NHẬT: Thông tin Trạng thái, PTTT, Kho nhập */}
                                        <div className="flex flex-wrap gap-1.5 items-center opacity-90 mt-1.5">
                                            <span className="flex items-center text-[9px] font-semibold bg-white/10 px-1.5 py-0.5 rounded"><Archive size={10} className="mr-1"/> {r.warehouseName}</span>
                                            <span className="flex items-center text-[9px] font-semibold bg-white/10 px-1.5 py-0.5 rounded"><CreditCard size={10} className="mr-1"/> {r.paymentMethodName || 'Ghi nợ'}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase shadow-2xs ${r.paymentStatus === 'debt' ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-600 text-white'}`}>
                                                {r.paymentStatus === 'debt' ? 'CÒN NỢ' : 'ĐÃ TRẢ'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-2.5 space-y-2 bg-white">
                                        {r.items?.map((it, idx) => (
                                            <div key={idx} className="flex flex-col border-b border-slate-100 last:border-0 pb-1.5">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="font-bold text-slate-800 text-[11px] truncate uppercase">{it.productName}</span>
                                                        {it.isCombo && <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1 rounded uppercase">Combo</span>}
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className="font-bold text-primary text-[10px] whitespace-nowrap">
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
        <PriceComparisonModal 
            isOpen={isPriceComparisonOpen} 
            onClose={() => setIsPriceComparisonOpen(false)} 
            product={selectedPriceComparisonProduct} 
        />
        {isLedgerModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
                    <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                        <h2 className="text-xl font-bold uppercase tracking-tight flex items-center">
                            <History className="mr-2" size={22} />
                            Truy vết biến động kho
                        </h2>
                        <button onClick={() => setIsLedgerModalOpen(false)} className="hover:bg-slate-800 p-2 rounded-full transition">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                        <InventoryLedger initialProductId={selectedLedgerProductId || 'all'} />
                    </div>
                    <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
                        <button 
                            onClick={() => setIsLedgerModalOpen(false)}
                            className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase hover:bg-slate-800 transition shadow-sm"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default CreateGoodsReceipt;
