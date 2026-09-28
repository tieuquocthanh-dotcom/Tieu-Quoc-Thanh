
import React, { useState, useEffect, useMemo } from 'react';
import { Sale, Product, PaymentHistoryEntry, PaymentMethod } from '../types';
import { X, User, Warehouse, CreditCard, Truck, Calendar, Hash, FileText, ShoppingCart, FileCheck2, FileX2, Printer, Trash2, Edit, Save, AlertCircle, Loader, UserCircle, Info, History, Coins, Wallet, StickyNote, Landmark, Clock, Camera, Eye, Plus, Image as ImageIcon } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import { doc, writeBatch, increment, getDoc, collection, query, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import ConfirmationModal from './ConfirmationModal';
import SalePrintPreviewModal from './SalePrintPreviewModal';
import QuickDebtPayModal from './QuickDebtPayModal';
import { DeliveryImageViewerModal } from './DeliveryImageViewerModal';
import { compressMultipleImagesWithStats, getDataUrlKB, getImagesTotalKB } from '../utils/imageCompression';
import * as XLSX from 'xlsx';

interface SaleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  userRole: 'admin' | 'staff' | null;
  paymentMethods?: PaymentMethod[];
}

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
    <div className="flex items-start py-2">
        <div className="text-primary mr-3 mt-1 flex-shrink-0">{icon}</div>
        <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="font-bold text-slate-900 leading-tight">{value}</p>
        </div>
    </div>
);

const SaleDetailModal: React.FC<SaleDetailModalProps> = ({ isOpen, onClose, sale, userRole, paymentMethods: propPaymentMethods }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [isPayDebtModalOpen, setIsPayDebtModalOpen] = useState(false);
  const [localPaymentMethods, setLocalPaymentMethods] = useState<PaymentMethod[]>([]);
  const [localDeliveryImages, setLocalDeliveryImages] = useState<string[]>([]);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [imageViewerIdx, setImageViewerIdx] = useState(0);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [imageUploadFeedback, setImageUploadFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (sale) {
      setLocalDeliveryImages(sale.deliveryImages || []);
    }
  }, [sale]);

  useEffect(() => {
    if (propPaymentMethods && propPaymentMethods.length > 0) {
      setLocalPaymentMethods(propPaymentMethods);
    } else if (isOpen) {
      getDocs(query(collection(db, 'paymentMethods'))).then(snap => {
        setLocalPaymentMethods(snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod)));
      }).catch(err => console.error("Lỗi tải paymentMethods trong SaleDetailModal:", err));
    }
  }, [isOpen, propPaymentMethods]);

  const isAdmin = userRole === 'admin';

  const effectiveAmountPaid = useMemo(() => {
    if (!sale) return 0;
    if (sale.amountPaid !== undefined && sale.amountPaid !== null) {
      return sale.amountPaid;
    }
    return sale.status === 'paid' ? (sale.total ?? 0) : 0;
  }, [sale]);

  const remainingDebt = useMemo(() => {
    if (!sale) return 0;
    return Math.max(0, (sale.total ?? 0) - effectiveAmountPaid);
  }, [sale, effectiveAmountPaid]);

  const fullPaymentHistory = useMemo((): PaymentHistoryEntry[] => {
    if (!sale) return [];
    
    let history: PaymentHistoryEntry[] = sale.paymentHistory ? [...sale.paymentHistory] : [];
    const totalAmountInHistory = history.reduce((sum, h) => sum + (h.amount || 0), 0);
    const amountPaid = effectiveAmountPaid;

    if (amountPaid > 0 && amountPaid > totalAmountInHistory) {
        const diff = amountPaid - totalAmountInHistory;
        history.unshift({
            date: sale.createdAt,
            amount: diff,
            note: 'Thanh toán khi tạo đơn',
            paymentMethodName: sale.paymentMethodName || 'Tiền mặt',
            paymentMethodId: sale.paymentMethodId
        });
    }

    return history.map((entry) => {
        let name = entry.paymentMethodName;
        if (!name || name === 'N/A') {
            if (entry.paymentMethodId) {
                const found = localPaymentMethods.find(m => m.id === entry.paymentMethodId);
                if (found) name = found.name;
            }
        }
        if (!name || name === 'Tiền mặt') {
            if (entry.note) {
                const match = entry.note.match(/(?:qua|từ|vào tài khoản|vào)\s+([^()_—-]+)/i);
                if (match && match[1]?.trim()) {
                    name = match[1].trim();
                }
            }
        }
        if ((!name || name === 'Tiền mặt') && sale.paymentMethodName && sale.paymentMethodName.toLowerCase() !== 'tiền mặt') {
            if (history.length === 1 || !entry.paymentMethodId || entry.paymentMethodId === sale.paymentMethodId) {
                name = sale.paymentMethodName;
            }
        }

        return {
            ...entry,
            paymentMethodName: name || sale.paymentMethodName || 'Tiền mặt'
        };
    }).sort((a, b) => (b.date?.toMillis?.() || 0) - (a.date?.toMillis?.() || 0));
  }, [sale, effectiveAmountPaid, localPaymentMethods]);

  const handlePrint = () => {
    if (!sale) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>In Đơn Hàng #${sale.id.substring(0, 8)}</title>
          <style>
            @page { size: A6; margin: 5mm; }
            body { font-family: 'Arial', sans-serif; font-size: 9pt; line-height: 1.2; color: #000; margin: 0; padding: 0; }
            .container { width: 100%; }
            .header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 3mm; margin-bottom: 3mm; }
            .title { font-size: 13pt; font-weight: bold; text-transform: uppercase; margin: 0; }
            .order-id { font-size: 8pt; margin-top: 1mm; font-weight: bold; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 1mm; font-size: 8.5pt; }
            .customer-info { margin-bottom: 3mm; border-bottom: 1px dashed #ccc; padding-bottom: 2mm; }
            table { width: 100%; border-collapse: collapse; margin-top: 1mm; }
            th { border-bottom: 1px solid #000; text-align: left; font-size: 8pt; padding: 1mm 0; }
            td { padding: 1.5mm 0; font-size: 8.5pt; vertical-align: top; border-bottom: 1px solid #eee; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .totals { margin-top: 3mm; border-top: 1px solid #000; padding-top: 2mm; }
            .total-row { display: flex; justify-content: space-between; padding: 0.5mm 0; }
            .grand-total { font-weight: bold; font-size: 10pt; padding-top: 1mm; border-top: 1px dashed #000; margin-top: 1mm; }
            .footer { margin-top: 6mm; text-align: center; font-style: italic; font-size: 7.5pt; border-top: 1px solid #eee; padding-top: 2mm; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <p class="title">HÓA ĐƠN BÁN HÀNG</p>
              <div class="order-id">Mã đơn: #${sale.id.substring(0, 8).toUpperCase()}</div>
              <div style="font-size: 8pt; margin-top: 1mm;">Ngày: ${sale.createdAt?.toDate?.()?.toLocaleString('vi-VN') || 'N/A'}</div>
            </div>

            <div class="customer-info">
              <div class="info-row">
                <span>Khách hàng:</span>
                <span style="font-weight: bold;">${sale.customerName || 'Khách vãng lai'}</span>
              </div>
              <div class="info-row">
                <span>Hình thức:</span>
                <span>${sale.paymentMethodName || (sale.status === 'debt' ? 'Ghi nợ' : 'Tiền mặt')}</span>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 50%">Sản phẩm</th>
                  <th style="width: 10%" class="text-center">SL</th>
                  <th style="width: 20%" class="text-right">Giá</th>
                  <th style="width: 20%" class="text-right">T.Tiền</th>
                </tr>
              </thead>
              <tbody>
                ${sale.items.map(item => `
                  <tr>
                    <td>${item.productName}${item.isCombo ? ' (Combo)' : ''}</td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-right">${formatNumber(item.price)}</td>
                    <td class="text-right">${formatNumber(item.quantity * item.price)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="totals">
              <div class="total-row">
                <span>Tiền hàng:</span>
                <span>${formatNumber((sale.total || 0) - (sale.shippingFee || 0))}</span>
              </div>
              ${sale.shippingFee ? `
                <div class="total-row">
                  <span>Phí vận chuyển:</span>
                  <span>${formatNumber(sale.shippingFee)}</span>
                </div>
              ` : ''}
              <div class="total-row grand-total">
                <span>TỔNG CỘNG:</span>
                <span>${formatNumber(sale.total || 0)} VNĐ</span>
              </div>
              <div class="total-row">
                <span>Đã thanh toán:</span>
                <span>${formatNumber(sale.amountPaid || 0)}</span>
              </div>
              <div class="total-row" style="font-weight: bold;">
                <span>Còn nợ:</span>
                <span>${formatNumber(remainingDebt)}</span>
              </div>
            </div>

            <div class="footer">
              <p>Cảm ơn quý khách đã tin tưởng!</p>
              <p>Hẹn gặp lại quý khách lần sau.</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
  };

  if (!isOpen || !sale) return null;

  const handleQuickUploadDeliveryImages = async (files: FileList | null) => {
    if (!files || files.length === 0 || !sale) return;
    setIsUploadingImages(true);
    setImageUploadFeedback(null);
    try {
      const batch = await compressMultipleImagesWithStats(files);
      if (batch.images.length > 0) {
        const updated = [...localDeliveryImages, ...batch.images];
        setLocalDeliveryImages(updated);
        await updateDoc(doc(db, 'sales', sale.id), {
          deliveryImages: updated,
          updatedAt: serverTimestamp()
        });
        setImageUploadFeedback({
          type: 'success',
          message: `Tải ảnh thành công! ${batch.summaryText}. Đã lưu ${batch.images.length} ảnh mới vào đơn hàng (Tổng: ${updated.length} ảnh · ~${getImagesTotalKB(updated)} KB).`
        });
      } else {
        setImageUploadFeedback({
          type: 'error',
          message: 'Không đọc được file ảnh đã chọn. Vui lòng thử lại!'
        });
      }
    } catch (err: any) {
      console.error("Lỗi tải ảnh giao hàng:", err);
      setImageUploadFeedback({
        type: 'error',
        message: "Không thể tải ảnh giao hàng: " + (err.message || err)
      });
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleRemoveDeliveryImage = async (idxToRemove: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sale) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa ảnh giao hàng này?")) return;
    const updated = localDeliveryImages.filter((_, idx) => idx !== idxToRemove);
    setLocalDeliveryImages(updated);
    try {
      await updateDoc(doc(db, 'sales', sale.id), {
        deliveryImages: updated,
        updatedAt: serverTimestamp()
      });
      setImageUploadFeedback({
        type: 'success',
        message: 'Đã xóa ảnh giao hàng thành công!'
      });
    } catch (err: any) {
      console.error("Lỗi xóa ảnh:", err);
      setImageUploadFeedback({
        type: 'error',
        message: "Không thể xóa ảnh: " + (err.message || err)
      });
    }
  };
  
  const confirmDeleteSale = async () => {
    setIsProcessing(true);
    try {
        const batch = writeBatch(db);

        if (sale.shippingStatus !== 'order' && sale.items && sale.items.length > 0) {
            for (const item of sale.items) {
                if (item.isCombo) {
                    const prodSnap = await getDoc(doc(db, 'products', item.productId));
                    if (prodSnap.exists()) {
                        const comboItems = prodSnap.data().comboItems || [];
                        comboItems.forEach((cItem: any) => {
                            const totalReturn = cItem.quantity * item.quantity;
                            const invRef = doc(db, 'products', cItem.productId, 'inventory', sale.warehouseId);
                            batch.set(invRef, { stock: increment(totalReturn), warehouseId: sale.warehouseId, warehouseName: sale.warehouseName || '' }, { merge: true });
                            if (sale.issueInvoice) {
                                batch.update(doc(db, 'products', cItem.productId), { totalInvoicedStock: increment(totalReturn) });
                            }
                        });
                    }
                } else {
                    const inventoryRef = doc(db, 'products', item.productId, 'inventory', sale.warehouseId);
                    batch.set(inventoryRef, { stock: increment(item.quantity), warehouseId: sale.warehouseId, warehouseName: sale.warehouseName || '' }, { merge: true });
                    if (sale.issueInvoice) {
                        batch.update(doc(db, 'products', item.productId), { totalInvoicedStock: increment(item.quantity) });
                    }
                }
            }
        } else if (sale.issueInvoice && sale.items) {
             for (const item of sale.items) {
                if (item.isCombo) {
                    const prodSnap = await getDoc(doc(db, 'products', item.productId));
                    if (prodSnap.exists()) {
                        const comboItems = prodSnap.data().comboItems || [];
                        comboItems.forEach((cItem: any) => batch.update(doc(db, 'products', cItem.productId), { totalInvoicedStock: increment(cItem.quantity * item.quantity) }));
                    }
                } else {
                    batch.update(doc(db, 'products', item.productId), { totalInvoicedStock: increment(item.quantity) });
                }
             }
        }

        batch.delete(doc(db, 'sales', sale.id));
        await batch.commit();
        alert("Đã xóa đơn hàng và hoàn trả tồn kho.");
        onClose();
    } catch (error: any) {
        console.error("Error deleting sale:", error);
        alert(`Lỗi khi xóa: ${error.message}`);
    } finally {
        setIsProcessing(false);
        setIsDeleteConfirmOpen(false);
    }
  };

  const exportDetailToExcel = () => {
    if (!sale || !sale.items) return;
    const dataToExport = sale.items.map((item, index) => ({
      STT: index + 1,
      "Tên món": item.productName,
      "Loại": item.isCombo ? "COMBO" : "Lẻ",
      "Số lượng": item.quantity,
      "Đơn giá (VNĐ)": item.price,
      "Thành tiền (VNĐ)": item.quantity * item.price,
      "Phương thức thanh toán": sale.paymentMethodName || 'N/A',
      "Đơn vị vận chuyển": sale.shipperName || 'N/A',
    }));

    // Add row for shipping fee if exists
    if (sale.shippingFee && sale.shippingFee > 0) {
      dataToExport.push({
        STT: "" as any,
        "Tên món": "Phí vận chuyển:" as any,
        "Loại": "" as any,
        "Số lượng": "" as any,
        "Đơn giá (VNĐ)": "" as any,
        "Thành tiền (VNĐ)": sale.shippingFee,
        "Phương thức thanh toán": "" as any,
        "Đơn vị vận chuyển": "" as any,
      });
    }

    // Add extra row for summary
    dataToExport.push({
      STT: "" as any,
      "Tên món": "TỔNG CỘNG:" as any,
      "Loại": "" as any,
      "Số lượng": sale.items.reduce((sum, i) => sum + i.quantity, 0) as any,
      "Đơn giá (VNĐ)": "" as any,
      "Thành tiền (VNĐ)": sale.total || 0,
      "Phương thức thanh toán": "" as any,
      "Đơn vị vận chuyển": "" as any,
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ChiTietBanHang");
    XLSX.writeFile(wb, `Chi_Tiet_Ban_Hang_${sale.id.substring(0, 8)}.xlsx`);
  };

  return (
    <>
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col animate-fade-in-down overflow-hidden border border-slate-200">
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900 text-white flex-shrink-0">
                <h2 className="text-lg font-black uppercase tracking-tighter flex items-center">
                    <FileText className="mr-3 text-primary" size={20} /> Đơn hàng #{sale.id.substring(0, 8)}
                </h2>
                <div className="flex flex-row items-center space-x-2">
                    <button onClick={exportDetailToExcel} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center shadow-sm">
                        <Printer size={14} className="mr-1" /> Xuất Excel
                    </button>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors"><X size={28} /></button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white rounded-2xl border-2 border-slate-800 shadow-sm overflow-hidden">
                        <div className="bg-slate-800 p-3 text-white flex justify-between items-center">
                            <h4 className="text-xs font-black uppercase flex items-center tracking-tighter">
                                <ShoppingCart className="mr-2" size={16} /> Danh sách sản phẩm
                            </h4>
                            <span className="bg-primary px-2 py-0.5 rounded-full text-[10px] font-black">{sale.items?.length || 0} SP</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="p-3 text-[10px] font-black uppercase text-slate-500">Sản phẩm</th>
                                        <th className="p-3 text-[10px] font-black uppercase text-slate-500 text-center">SL</th>
                                        <th className="p-3 text-[10px] font-black uppercase text-slate-500 text-right">Đơn giá</th>
                                        <th className="p-3 text-[10px] font-black uppercase text-slate-500 text-right">Thành tiền</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sale.items.map((item, index) => (
                                        <tr key={index} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 font-bold text-slate-900 text-xs uppercase leading-tight">
                                                {item.productName}
                                                {item.isCombo && <span className="ml-2 px-1 py-0.5 bg-blue-100 text-blue-700 text-[8px] font-black rounded">COMBO</span>}
                                            </td>
                                            <td className="p-3 text-center font-black text-slate-900 text-sm">{item.quantity}</td>
                                            <td className="p-3 text-right font-bold text-slate-500 text-xs">{formatNumber(item.price)}</td>
                                            <td className="p-3 text-primary font-black text-right text-sm">{formatNumber(item.quantity * item.price)} ₫</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-slate-900 p-5 rounded-2xl border-2 border-slate-800 text-white shadow-lg">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-700 pb-2 mb-3 flex items-center">
                                <Coins size={14} className="mr-2 text-primary"/> Tóm tắt tài chính
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Tiền hàng:</span>
                                    <span className="text-base font-black text-white">{formatNumber((sale.total ?? 0) - (sale.shippingFee || 0))} ₫</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Phí vận chuyển:</span>
                                    <span className="text-base font-black text-blue-400">+{formatNumber(sale.shippingFee || 0)} ₫</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Tổng cộng:</span>
                                    <span className="text-lg font-black text-primary">{formatNumber(sale.total ?? 0)} ₫</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Đã thanh toán:</span>
                                    <span className="text-lg font-black text-green-400">{formatNumber(effectiveAmountPaid)} ₫</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Còn nợ:</span>
                                    <span className={`text-xl font-black ${remainingDebt > 0 ? 'text-red-500' : 'text-green-500'}`}>{formatNumber(remainingDebt)} ₫</span>
                                </div>
                                {remainingDebt > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setIsPayDebtModalOpen(true)}
                                        className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                                    >
                                        <Wallet size={16} /> Thu tiền / Trả nợ ({formatNumber(remainingDebt)} ₫)
                                    </button>
                                )}
                            </div>
                        </div>

                        {sale.note && (
                            <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-2xl flex items-start shadow-sm">
                                <StickyNote size={20} className="mr-3 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-black text-yellow-800 uppercase mb-1">Ghi chú đơn hàng:</p>
                                    <p className="text-sm font-bold text-yellow-900 leading-relaxed italic">"{sale.note}"</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-sm overflow-hidden">
                    <div className="bg-emerald-50/80 p-3.5 text-slate-800 flex flex-wrap justify-between items-center gap-2 border-b-2 border-emerald-200">
                        <div className="flex items-center gap-2">
                            <Camera className="text-emerald-600" size={18} />
                            <h4 className="text-xs font-black uppercase tracking-tight text-emerald-950">
                                Hình ảnh chụp giao hàng ({localDeliveryImages.length} ảnh{localDeliveryImages.length > 0 ? ` · ~${getImagesTotalKB(localDeliveryImages)} KB` : ''})
                            </h4>
                        </div>
                        <div className="flex items-center gap-2">
                            {localDeliveryImages.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setImageViewerIdx(0);
                                        setIsImageViewerOpen(true);
                                    }}
                                    className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                                >
                                    <Eye size={14} />
                                    <span>Xem phóng to</span>
                                </button>
                            )}
                            <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition cursor-pointer shadow-xs">
                                {isUploadingImages ? <Loader size={14} className="animate-spin" /> : <Camera size={14} />}
                                <span>Chụp ảnh</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={(e) => {
                                        handleQuickUploadDeliveryImages(e.target.files);
                                        e.target.value = '';
                                    }}
                                    className="hidden"
                                />
                            </label>
                            <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition cursor-pointer shadow-xs">
                                {isUploadingImages ? <Loader size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                                <span>Tải ảnh lên</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => {
                                        handleQuickUploadDeliveryImages(e.target.files);
                                        e.target.value = '';
                                    }}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>
                    <div className="p-4 space-y-3">
                        {isUploadingImages && (
                            <div className="p-3 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center gap-2 animate-pulse shadow-sm">
                                <Loader size={16} className="animate-spin shrink-0" />
                                <span>Đang xử lý và lưu ảnh giao hàng lên hệ thống... Vui lòng chờ giây lát!</span>
                            </div>
                        )}
                        {!isUploadingImages && imageUploadFeedback && (
                            <div className={`p-3 rounded-xl text-xs font-black flex items-center justify-between gap-2 animate-fade-in ${
                                imageUploadFeedback.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                            }`}>
                                <span>{imageUploadFeedback.message}</span>
                                <button type="button" onClick={() => setImageUploadFeedback(null)} className="text-white/80 hover:text-white p-0.5">
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        {localDeliveryImages.length === 0 ? (
                            <div className="py-6 text-center text-slate-400 text-xs font-bold flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                <Camera size={28} className="text-slate-300" />
                                <span>Đơn hàng này chưa có ảnh chụp giao hàng. Bấm "Chụp ảnh" hoặc "Tải ảnh lên" để thêm.</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                                {localDeliveryImages.map((imgUrl, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => {
                                            setImageViewerIdx(idx);
                                            setIsImageViewerOpen(true);
                                        }}
                                        className="relative group aspect-square rounded-xl overflow-hidden border-2 border-emerald-400 shadow-xs cursor-pointer bg-slate-100"
                                        title="Nhấp để xem ảnh lớn"
                                    >
                                        <img
                                            src={imgUrl}
                                            alt={`Ảnh giao hàng ${idx + 1}`}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                            <Eye size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                                        </div>
                                        <span className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-black">
                                            Ảnh #{idx + 1} · {getDataUrlKB(imgUrl)}KB
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => handleRemoveDeliveryImage(idx, e)}
                                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md cursor-pointer"
                                            title="Xóa ảnh này"
                                        >
                                            <X size={13} strokeWidth={3} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-100 p-3 text-slate-800 flex justify-between items-center border-b-2 border-slate-200">
                        <h4 className="text-xs font-black uppercase flex items-center tracking-tighter">
                            <History className="mr-2 text-primary" size={16} /> Lịch sử thanh toán từng đợt
                        </h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="p-3 text-[10px] font-black uppercase text-slate-500">Thời gian</th>
                                    <th className="p-3 text-[10px] font-black uppercase text-slate-500">Hình thức / Tài khoản thu</th>
                                    <th className="p-3 text-[10px] font-black uppercase text-slate-500">Ghi chú / Nội dung</th>
                                    <th className="p-3 text-[10px] font-black uppercase text-slate-500 text-right">Số tiền thu</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {fullPaymentHistory.length > 0 ? (
                                    fullPaymentHistory.map((payment, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 text-[11px] font-bold text-slate-600 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <Clock size={13} className="mr-1.5 text-slate-400 shrink-0" />
                                                    {payment.date?.toDate?.()?.toLocaleString('vi-VN') || (payment as any).createdAt?.toDate?.()?.toLocaleString('vi-VN') || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <span className="inline-flex items-center px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-tight shadow-xs">
                                                    <Landmark size={12} className="mr-1 text-emerald-600 shrink-0" />
                                                    {payment.paymentMethodName || 'Tiền mặt'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-[11px] font-semibold text-slate-700">
                                                {payment.note || 'Thanh toán tiền hàng'}
                                            </td>
                                            <td className="p-3 text-right font-black text-green-600 text-sm whitespace-nowrap">
                                                +{formatNumber(payment.amount)} ₫
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-400 text-xs italic font-medium uppercase tracking-widest">
                                            Chưa phát sinh giao dịch thanh toán nào
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-3 flex items-center">
                        <Info size={14} className="mr-2 text-primary"/> Thông tin vận đơn & Khách hàng
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <DetailRow 
                            icon={<User size={16} />} 
                            label={sale.partnerType === 'supplier' ? 'Nhà Cung Cấp' : 'Khách Hàng'} 
                            value={
                                <span className="flex items-center gap-1.5">
                                    {sale.customerName || 'Khách vãng lai'}
                                    {sale.partnerType === 'supplier' && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                                            NCC
                                        </span>
                                    )}
                                </span>
                            } 
                        />
                        <DetailRow icon={<Calendar size={16} />} label="Ngày Tạo Đơn" value={sale.createdAt?.toDate?.()?.toLocaleString('vi-VN') || 'N/A'} />
                        <DetailRow icon={<Warehouse size={16} />} label="Kho Xuất" value={sale.warehouseName} />
                        <DetailRow icon={<Truck size={16} />} label="ĐV Vận Chuyển" value={sale.shipperName || 'N/A'} />
                        <DetailRow icon={<FileCheck2 size={16} />} label="Loại Hóa Đơn" value={sale.issueInvoice ? 'Đã xuất HĐ đỏ' : 'Phiếu xuất kho thường'} />
                        <DetailRow icon={<UserCircle size={16} />} label="Người Tạo Đơn" value={sale.creatorName || 'POS Terminal'} />
                        <DetailRow icon={<Wallet size={16} />} label="Phương thức mặc định" value={sale.paymentMethodName || 'Nợ/Tiền mặt'} />
                        <DetailRow icon={<Hash size={16} />} label="ID Hệ Thống" value={sale.id} />
                    </div>
                </div>
            </div>
            
            <div className="p-4 bg-white border-t-2 border-slate-100 flex justify-between items-center flex-shrink-0">
                <div className="flex space-x-2">
                    {isAdmin && (
                        <button 
                            onClick={() => setIsDeleteConfirmOpen(true)} 
                            disabled={isProcessing} 
                            className="flex items-center space-x-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition border-2 border-red-200 font-black text-xs uppercase active:scale-95 disabled:opacity-50"
                        >
                            {isProcessing ? <Loader className="animate-spin" size={18}/> : <Trash2 size={18} />}
                            <span>Xóa đơn hàng</span>
                        </button>
                    )}
                </div>
                <div className="flex space-x-3">
                    <button 
                        onClick={() => setIsPrintPreviewOpen(true)}
                        className="flex items-center space-x-2 px-6 py-3 bg-slate-800 text-white rounded-xl font-black text-xs uppercase shadow-lg hover:bg-black transition active:scale-95"
                        title="Xem trước hóa đơn, sao chép gửi Zalo, SMS hoặc in ấn"
                    >
                        <Printer size={18} />
                        <span>In đơn hàng / Zalo / SMS</span>
                    </button>
                    <button onClick={onClose} className="px-8 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-blue-200 hover:bg-primary-hover transition active:scale-95">Đóng cửa sổ</button>
                </div>
            </div>
        </div>
        </div>
        
        <ConfirmationModal
            isOpen={isDeleteConfirmOpen}
            onClose={() => setIsDeleteConfirmOpen(false)}
            onConfirm={confirmDeleteSale}
            title="Xác nhận Xóa Đơn Hàng"
            message={<>Bạn có chắc chắn muốn xóa đơn hàng này? Toàn bộ số tiền đã hạch toán sẽ không bị hoàn lại tự động nếu xóa thủ công tại đây (Vui lòng điều chỉnh tài khoản nếu cần). <br/><br/><span className="text-red-600 font-bold italic text-xs uppercase tracking-tight">Tồn kho sản phẩm lẻ sẽ được cộng trả lại tự động.</span></>}
        />

        <SalePrintPreviewModal
            isOpen={isPrintPreviewOpen}
            onClose={() => setIsPrintPreviewOpen(false)}
            sale={sale}
        />

        <DeliveryImageViewerModal
            isOpen={isImageViewerOpen}
            onClose={() => setIsImageViewerOpen(false)}
            images={localDeliveryImages}
            initialIndex={imageViewerIdx}
            saleId={sale.id}
            orderId={sale.id.substring(0, 8).toUpperCase()}
            customerName={sale.customerName}
            onImagesChange={setLocalDeliveryImages}
        />

        <QuickDebtPayModal
            isOpen={isPayDebtModalOpen}
            onClose={() => setIsPayDebtModalOpen(false)}
            sale={sale}
            paymentMethods={localPaymentMethods}
            onSuccess={() => {
                setIsPayDebtModalOpen(false);
                onClose();
            }}
        />
    </>
  );
};

export default SaleDetailModal;
