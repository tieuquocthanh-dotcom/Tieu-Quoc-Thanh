
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoodsReceipt, Supplier, PaymentMethod, Warehouse, Product, GoodsReceiptItem } from '../types';
import { X, Save, Edit3, CreditCard, FileCheck2, Wallet, AlertCircle, Loader, Users, Package, ShoppingBag, Trash2, Minus, Plus, Coins, Banknote, Calendar } from 'lucide-react';
import { doc, serverTimestamp, runTransaction, collection, Timestamp, increment, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { formatNumber, parseNumber } from '../utils/formatting';

interface GoodsReceiptEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: GoodsReceipt | null;
  suppliers: Supplier[];
  paymentMethods: PaymentMethod[];
  warehouses: Warehouse[];
  products: Product[];
}

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

const GoodsReceiptEditModal: React.FC<GoodsReceiptEditModalProps> = ({ isOpen, onClose, receipt, suppliers, paymentMethods, warehouses, products }) => {
  const [supplierId, setSupplierId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'debt'>('paid');
  const [hasInvoice, setHasInvoice] = useState(false);
  const [receiptDate, setReceiptDate] = useState('');
  const [editedItems, setEditedItems] = useState<GoodsReceiptItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Supplier Search State
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && receipt) {
      setSupplierId(receipt.supplierId || '');
      setSupplierSearchTerm(receipt.supplierName || '');
      setPaymentMethodId(receipt.paymentMethodId || '');
      setPaymentStatus(receipt.paymentStatus || 'paid');
      setHasInvoice(receipt.hasInvoice || false);
      if (receipt.createdAt) {
        const date = receipt.createdAt.toDate();
        setReceiptDate(date.toISOString().split('T')[0]);
      }
      setEditedItems(receipt.items ? JSON.parse(JSON.stringify(receipt.items)) : []);
    }
  }, [isOpen, receipt]);

  const newTotal = useMemo(() => {
    return editedItems.reduce((acc, item) => acc + (item.importPrice * item.quantity), 0);
  }, [editedItems]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchTerm) return suppliers.slice(0, 10);
    const lower = supplierSearchTerm.toLowerCase();
    return suppliers.filter(s => (s.name || '').toLowerCase().includes(lower)).slice(0, 10);
  }, [suppliers, supplierSearchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
        setIsSupplierDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [supplierSearchTerm]);

  if (!isOpen || !receipt) return null;

  const updateItem = (index: number, updates: Partial<GoodsReceiptItem>) => {
    const newItems = [...editedItems];
    newItems[index] = { ...newItems[index], ...updates };
    setEditedItems(newItems);
  };

  const handleSave = async () => {
    if (!receipt) return;
    if (editedItems.length === 0) {
      alert("Phiếu nhập không thể để trống sản phẩm.");
      return;
    }
    if (paymentStatus === 'paid' && !paymentMethodId) {
      alert("Vui lòng chọn tài khoản chi tiền.");
      return;
    }

    setIsProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
        // --- BƯỚC 1: READS ---
        const receiptRef = doc(db, 'goodsReceipts', receipt.id);
        const receiptSnap = await transaction.get(receiptRef);
        if (!receiptSnap.exists()) throw "Receipt does not exist";
        const oldData = receiptSnap.data() as GoodsReceipt;

        // Đọc thông tin sản phẩm để xử lý Combo
        const allProductIds = new Set([
            ...oldData.items.map(i => i.productId),
            ...editedItems.map(i => i.productId)
        ]);
        const productDocs: Record<string, any> = {};
        for (const pid of allProductIds) {
            const pSnap = await transaction.get(doc(db, 'products', pid));
            if (pSnap.exists()) productDocs[pid] = pSnap.data();
        }

        // Đọc tài khoản
        let oldAccSnap = null;
        if (oldData.paymentStatus === 'paid' && oldData.paymentMethodId) {
            oldAccSnap = await transaction.get(doc(db, 'paymentMethods', oldData.paymentMethodId));
        }
        let newAccSnap = null;
        if (paymentStatus === 'paid' && paymentMethodId) {
            if (paymentMethodId === oldData.paymentMethodId && oldAccSnap) {
                newAccSnap = oldAccSnap;
            } else {
                newAccSnap = await transaction.get(doc(db, 'paymentMethods', paymentMethodId));
            }
        }

        // --- BƯỚC 2: WRITES ---
        const shortId = receipt.id.substring(0, 8).toUpperCase();
        const selectedSupplier = suppliers.find(s => s.id === supplierId);
        const partnerName = selectedSupplier?.name || oldData.supplierName;

        // 0. Xử lý ngày nhập mới
        const selectedDateObj = new Date(receiptDate);
        const oldDate = oldData.createdAt.toDate();
        selectedDateObj.setHours(oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds());
        const finalCreatedAt = Timestamp.fromDate(selectedDateObj);

        // 1. Cân bằng tồn kho (Hoàn tác cũ, áp dụng mới)
        // Reverse Old
        for (const oldItem of oldData.items) {
            const productData = productDocs[oldItem.productId];
            if (oldItem.isCombo && productData?.comboItems) {
                productData.comboItems.forEach((cItem: any) => {
                    const totalDeduct = cItem.quantity * oldItem.quantity;
                    transaction.set(doc(db, 'products', cItem.productId, 'inventory', oldData.warehouseId), {
                        stock: increment(-totalDeduct)
                    }, { merge: true });
                    if (oldData.hasInvoice) {
                        transaction.update(doc(db, 'products', cItem.productId), { totalInvoicedStock: increment(-totalDeduct) });
                    }
                });
            } else {
                transaction.set(doc(db, 'products', oldItem.productId, 'inventory', oldData.warehouseId), {
                    stock: increment(-oldItem.quantity)
                }, { merge: true });
                if (oldData.hasInvoice) {
                    transaction.update(doc(db, 'products', oldItem.productId), { totalInvoicedStock: increment(-oldItem.quantity) });
                }
            }
        }

        // Apply New
        for (const newItem of editedItems) {
            const productData = productDocs[newItem.productId];
            if (newItem.isCombo && productData?.comboItems) {
                productData.comboItems.forEach((cItem: any) => {
                    const totalAdd = cItem.quantity * newItem.quantity;
                    transaction.set(doc(db, 'products', cItem.productId, 'inventory', oldData.warehouseId), {
                        stock: increment(totalAdd)
                    }, { merge: true });
                    if (hasInvoice) {
                        transaction.update(doc(db, 'products', cItem.productId), { totalInvoicedStock: increment(totalAdd) });
                    }
                });
            } else {
                transaction.set(doc(db, 'products', newItem.productId, 'inventory', oldData.warehouseId), {
                    stock: increment(newItem.quantity)
                }, { merge: true });
                if (hasInvoice) {
                    transaction.update(doc(db, 'products', newItem.productId), { totalInvoicedStock: increment(newItem.quantity) });
                }
            }
        }

        // 2. Cân bằng tiền tệ
        // Hoàn tiền cũ nếu đã trả
        if (oldData.paymentStatus === 'paid' && oldAccSnap) {
            const curBal = oldAccSnap.data()?.balance || 0;
            const resBal = curBal + oldData.total;
            transaction.update(oldAccSnap.ref, { balance: resBal });
            transaction.set(doc(collection(db, 'paymentLogs')), {
                paymentMethodId: oldData.paymentMethodId,
                paymentMethodName: oldData.paymentMethodName || 'N/A',
                type: 'deposit',
                amount: oldData.total,
                balanceAfter: resBal,
                note: `Hoàn tiền điều chỉnh phiếu nhập #${shortId}`,
                relatedId: receipt.id, relatedType: 'receipt', createdAt: finalCreatedAt, creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Hệ thống'
            });
        }
        // Trừ tiền mới nếu là đã trả
        if (paymentStatus === 'paid' && newAccSnap) {
          const snapBal = newAccSnap.data()?.balance || 0;
          // Nếu cùng 1 tài khoản vừa được hoàn tiền ở trên
          let baseBal = snapBal;
          if (newAccSnap.id === oldData.paymentMethodId && oldData.paymentStatus === 'paid') {
            baseBal += oldData.total;
          }
          const finalBal = baseBal - newTotal;
          transaction.update(newAccSnap.ref, { balance: finalBal });
          transaction.set(doc(collection(db, 'paymentLogs')), {
            paymentMethodId: paymentMethodId,
            paymentMethodName: paymentMethods.find(p => p.id === paymentMethodId)?.name || 'N/A',
            type: 'withdraw',
            amount: newTotal,
            balanceAfter: finalBal,
            note: `Chi tiền phiếu nhập sau điều chỉnh #${shortId}`,
            relatedId: receipt.id, relatedType: 'receipt', createdAt: finalCreatedAt, creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Hệ thống'
          });
        }

        // 3. Cập nhật phiếu nhập - Đảm bảo dữ liệu sạch (không có undefined)
        const selectedPaymentMethod = paymentMethods.find(p => p.id === paymentMethodId);
        transaction.update(receiptRef, {
          items: editedItems.map(it => ({
            productId: it.productId || '',
            productName: it.productName || '',
            quantity: it.quantity || 0,
            importPrice: it.importPrice || 0,
            isCombo: !!it.isCombo
          })),
          productIds: editedItems.map(it => it.productId),
          total: newTotal,
          supplierId: supplierId || '',
          supplierName: partnerName || '',
          paymentMethodId: paymentMethodId || null,
          paymentMethodName: selectedPaymentMethod ? selectedPaymentMethod.name : null,
          paymentStatus: paymentStatus,
          hasInvoice: hasInvoice,
          createdAt: finalCreatedAt,
          amountPaid: paymentStatus === 'paid' ? newTotal : 0,
          paidAt: paymentStatus === 'paid' ? serverTimestamp() : (oldData.paymentStatus === 'paid' ? null : (oldData.paidAt || null)),
          updatedAt: serverTimestamp()
        });
      });

      alert("Cập nhật phiếu nhập thành công!");
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
            Sửa Phiếu Nhập #{receipt.id.substring(0, 8)}
          </h3>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={28} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cột trái: Thông tin NCC & Thanh toán */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-2">Thông tin Nhà cung cấp</h4>
                
                <div className="relative" ref={supplierDropdownRef}>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Nhà cung cấp</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={supplierSearchTerm}
                      onChange={(e) => {
                        setSupplierSearchTerm(e.target.value);
                        setIsSupplierDropdownOpen(true);
                      }}
                      onFocus={() => setIsSupplierDropdownOpen(true)}
                      placeholder="Tìm NCC..."
                      className="w-full pl-10 pr-3 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm font-bold text-slate-900 bg-white"
                    />
                  </div>
                  {isSupplierDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-800 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                      {filteredSuppliers.map(s => (
                        <button
                          key={s.id}
                          onClick={() => { setSupplierId(s.id); setSupplierSearchTerm(s.name); setIsSupplierDropdownOpen(false); }}
                          className="w-full text-left px-4 py-2 text-slate-900 hover:bg-blue-50 border-b last:border-0 font-bold text-xs"
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-slate-900 p-4 rounded-xl space-y-4 border-2 border-slate-800">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-700 pb-2 mb-2 flex items-center">
                        <Wallet size={14} className="mr-2 text-primary"/> Thanh toán & Hóa đơn
                    </h4>
                    
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Trạng thái thanh toán</label>
                        <select 
                            value={paymentStatus} 
                            onChange={e => setPaymentStatus(e.target.value as any)}
                            className={`w-full px-3 py-2 border-2 rounded-lg font-black text-xs uppercase outline-none focus:ring-2 focus:ring-primary ${paymentStatus === 'debt' ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-green-500 bg-green-50 text-green-800'}`}
                        >
                            <option value="paid">Đã thanh toán</option>
                            <option value="debt">Ghi nợ NCC</option>
                        </select>
                    </div>

                    {paymentStatus === 'paid' && (
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Tài khoản chi tiền</label>
                            <select 
                                value={paymentMethodId} 
                                onChange={e => setPaymentMethodId(e.target.value)}
                                className="w-full px-3 py-2 border-2 border-slate-700 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm font-bold bg-white text-slate-900"
                            >
                                <option value="">-- CHỌN TÀI KHOẢN --</option>
                                {paymentMethods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Ngày nhập hàng</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="date"
                                value={receiptDate}
                                onChange={(e) => setReceiptDate(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border-2 border-slate-700 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm font-bold bg-white text-slate-900"
                                style={{ colorScheme: 'light' }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center p-2 bg-slate-800 rounded-lg">
                        <input 
                            type="checkbox" 
                            id="edit-has-invoice" 
                            checked={hasInvoice} 
                            onChange={e => setHasInvoice(e.target.checked)} 
                            className="w-5 h-5 rounded border-slate-600 text-blue-500 focus:ring-0 mr-3 cursor-pointer"
                        />
                        <label htmlFor="edit-has-invoice" className="text-[10px] font-black text-white uppercase cursor-pointer select-none">Đã nhận hóa đơn đỏ</label>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Tổng tiền phiếu:</span>
                        <span className="text-xl font-black text-primary">{formatNumber(newTotal)} ₫</span>
                    </div>
                </div>
                
                <div className="p-3 bg-yellow-50 border-2 border-yellow-200 rounded-xl flex items-start">
                    <AlertCircle size={16} className="text-yellow-600 mr-2 shrink-0 mt-0.5" />
                    <p className="text-[9px] font-bold text-yellow-800 uppercase leading-tight">Khi thay đổi số lượng hoặc đơn giá, tồn kho thực tế tại kho "{receipt.warehouseName}" sẽ được tự động điều chỉnh cân bằng.</p>
                </div>
              </div>
            </div>

            {/* Cột phải: Danh sách sản phẩm */}
            <div className="lg:col-span-2">
                <div className="bg-white rounded-xl border-2 border-slate-800 shadow-lg overflow-hidden flex flex-col h-full">
                    <div className="bg-slate-800 p-3 text-white flex justify-between items-center">
                        <h4 className="text-xs font-black uppercase flex items-center tracking-tighter">
                            <ShoppingBag className="mr-2" size={16} /> Danh sách sản phẩm nhập
                        </h4>
                        <span className="bg-primary px-2 py-0.5 rounded-full text-[10px] font-black">{editedItems.length} SP</span>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[500px]">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                <tr className="text-[10px] font-black text-slate-500 uppercase">
                                    <th className="p-3">Sản phẩm</th>
                                    <th className="p-3 text-center w-32">Số lượng</th>
                                    <th className="p-3 text-right w-40">Giá nhập (₫)</th>
                                    <th className="p-3 text-right w-40">Thành tiền</th>
                                    <th className="p-3 text-center w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {editedItems.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3">
                                            <div className="font-bold text-xs text-slate-800 uppercase leading-tight line-clamp-2">{item.productName}</div>
                                            {item.isCombo && <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded font-black">COMBO</span>}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center justify-center space-x-1">
                                                <button 
                                                    onClick={() => updateItem(idx, { quantity: Math.max(1, item.quantity - 1) })} 
                                                    className="p-1 bg-slate-200 rounded hover:bg-slate-300 text-slate-900 border border-slate-300 shadow-sm"
                                                >
                                                    <Minus size={12} strokeWidth={3}/>
                                                </button>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={e => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                                                    className="w-12 py-1 text-center font-black text-sm border-2 border-slate-300 rounded-lg outline-none focus:border-primary text-slate-900 bg-white"
                                                />
                                                <button 
                                                    onClick={() => updateItem(idx, { quantity: item.quantity + 1 })} 
                                                    className="p-1 bg-slate-200 rounded hover:bg-slate-300 text-slate-900 border border-slate-300 shadow-sm"
                                                >
                                                    <Plus size={12} strokeWidth={3}/>
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <NumericInput
                                                value={item.importPrice}
                                                onChange={val => updateItem(idx, { importPrice: val })}
                                                className="w-full p-1.5 border-2 border-slate-300 rounded-lg text-right font-black text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-900 bg-white"
                                            />
                                        </td>
                                        <td className="p-3 text-right font-black text-sm text-primary">
                                            {formatNumber(item.importPrice * item.quantity)} ₫
                                        </td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => setEditedItems(editedItems.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-t-4 border-slate-800">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng tiền mới</p>
                            <div className="text-3xl font-black text-primary tracking-tighter">
                                {formatNumber(newTotal)} <span className="text-xs font-black italic">₫</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Chênh lệch</p>
                            <p className={`text-sm font-black ${newTotal - (receipt.total || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {newTotal - (receipt.total || 0) >= 0 ? '+' : ''}{formatNumber(newTotal - (receipt.total || 0))} ₫
                            </p>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border-t-2 border-slate-100 flex justify-end space-x-3 flex-shrink-0">
          <button onClick={onClose} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition font-black text-xs uppercase" disabled={isProcessing}>Hủy</button>
          <button 
            onClick={handleSave} 
            disabled={isProcessing}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-blue-200 flex items-center transition active:scale-95 disabled:bg-slate-300"
          >
            {isProcessing ? <Loader className="animate-spin mr-2" size={18} /> : <Save size={18} className="mr-2" />}
            {isProcessing ? 'Đang xử lý...' : 'Lưu Thay Đổi'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoodsReceiptEditModal;
