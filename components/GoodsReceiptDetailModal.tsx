
import React, { useState, useEffect, useMemo } from 'react';
import { GoodsReceipt, GoodsReceiptItem, PaymentHistoryEntry } from '../types';
import { X, Users, Warehouse, Calendar, Hash, FileText, ShoppingCart, FileCheck2, FileX2, CreditCard, Printer, Trash2, Edit, Save, AlertCircle, Loader, UserCircle, Info, History, Coins, StickyNote, Landmark, Clock, Building2, Camera, Image as ImageIcon, Eye } from 'lucide-react';
import { formatNumber, parseNumber } from '../utils/formatting';
import { doc, writeBatch, increment, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import ConfirmationModal from './ConfirmationModal';
import { DeliveryImageViewerModal } from './DeliveryImageViewerModal';
import { compressMultipleImagesWithStats, getDataUrlKB, getImagesTotalKB } from '../utils/imageCompression';
import * as XLSX from 'xlsx';

const toMillis = (val: any): number => {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') {
    try { return val.toMillis(); } catch (e) { /* ignore */ }
  }
  if (typeof val.toDate === 'function') {
    try { return val.toDate().getTime(); } catch (e) { /* ignore */ }
  }
  if (val instanceof Date) return val.getTime();
  if (typeof val.seconds === 'number') {
    return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000);
  }
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const formatDateSafe = (val: any): string => {
  if (!val) return 'N/A';
  if (typeof val.toDate === 'function') {
    try { return val.toDate().toLocaleString('vi-VN'); } catch (e) { /* ignore */ }
  }
  if (val instanceof Date) {
    try { return val.toLocaleString('vi-VN'); } catch (e) { /* ignore */ }
  }
  if (typeof val.seconds === 'number') {
    try {
      const d = new Date(val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000));
      return d.toLocaleString('vi-VN');
    } catch (e) { /* ignore */ }
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toLocaleString('vi-VN');
    return val;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toLocaleString('vi-VN');
  }
  return 'N/A';
};

interface GoodsReceiptDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: GoodsReceipt | null;
  userRole: 'admin' | 'staff' | null;
}

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
    <div className="flex items-start py-2">
        <div className="text-primary mr-3 mt-1 flex-shrink-0">{icon}</div>
        <div>
            <p className="text-xs text-neutral">{label}</p>
            <p className="font-semibold text-dark">{value}</p>
        </div>
    </div>
);

const GoodsReceiptDetailModal: React.FC<GoodsReceiptDetailModalProps> = ({ isOpen, onClose, receipt, userRole }) => {
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localReceiptImages, setLocalReceiptImages] = useState<string[]>([]);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [imageViewerIdx, setImageViewerIdx] = useState(0);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [imageUploadFeedback, setImageUploadFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (receipt) {
      setLocalReceiptImages(receipt.receiptImages || receipt.deliveryImages || []);
      setImageUploadFeedback(null);
    }
  }, [receipt]);

  // Calculate effective amount paid taking into account legacy receipts or receipts with missing amountPaid
  const effectiveAmountPaid = useMemo(() => {
    if (!receipt) return 0;
    if (receipt.amountPaid !== undefined && receipt.amountPaid !== null) {
      return receipt.amountPaid;
    }
    // Fallback: If paymentStatus is 'paid', full total was paid
    return receipt.paymentStatus === 'paid' ? (receipt.total || 0) : 0;
  }, [receipt]);

  const remainingDebt = useMemo(() => {
    if (!receipt) return 0;
    return Math.max(0, (receipt.total || 0) - effectiveAmountPaid);
  }, [receipt, effectiveAmountPaid]);

  const fullPaymentHistory = useMemo((): PaymentHistoryEntry[] => {
    if (!receipt) return [];
    
    const history = receipt.paymentHistory ? [...receipt.paymentHistory] : [];
    const totalAmountInHistory = history.reduce((sum, h) => sum + (h.amount || 0), 0);
    const amountPaid = effectiveAmountPaid;

    if (amountPaid > 0 && amountPaid > totalAmountInHistory) {
        const diff = amountPaid - totalAmountInHistory;
        history.unshift({
            createdAt: receipt.createdAt,
            amount: diff,
            note: 'Thanh toán khi tạo phiếu',
            paymentMethodName: receipt.paymentMethodName || 'Tiền mặt/Mặc định',
            paymentMethodId: receipt.paymentMethodId,
            supplierBankDetails: (receipt as any).supplierBankDetails || null,
            supplierBankAccountId: (receipt as any).supplierBankAccountId || null,
        });
    }

    return history.sort((a, b) => toMillis(b.createdAt || b.date) - toMillis(a.createdAt || a.date));
  }, [receipt, effectiveAmountPaid]);

  if (!isOpen || !receipt) return null;

  const handleQuickUploadReceiptImages = async (files: FileList | null) => {
    if (!files || files.length === 0 || !receipt) return;
    setIsUploadingImages(true);
    setImageUploadFeedback(null);
    try {
      const batch = await compressMultipleImagesWithStats(files);
      if (batch.images.length > 0) {
        const updated = [...localReceiptImages, ...batch.images];
        setLocalReceiptImages(updated);
        await updateDoc(doc(db, 'goodsReceipts', receipt.id), {
          receiptImages: updated,
          deliveryImages: updated,
          updatedAt: serverTimestamp()
        });
        setImageUploadFeedback({
          type: 'success',
          message: `Tải ảnh thành công! ${batch.summaryText}. Đã lưu ${batch.images.length} ảnh mới vào phiếu nhập (Tổng: ${updated.length} ảnh · ~${getImagesTotalKB(updated)} KB).`
        });
      } else {
        setImageUploadFeedback({
          type: 'error',
          message: 'Không đọc được file ảnh đã chọn. Vui lòng thử lại!'
        });
      }
    } catch (err: any) {
      console.error("Lỗi tải ảnh nhập hàng:", err);
      setImageUploadFeedback({
        type: 'error',
        message: "Không thể tải ảnh nhập hàng: " + (err.message || err)
      });
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleRemoveReceiptImage = async (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!receipt) return;
    try {
      const updated = localReceiptImages.filter((_, i) => i !== idx);
      setLocalReceiptImages(updated);
      await updateDoc(doc(db, 'goodsReceipts', receipt.id), {
        receiptImages: updated,
        deliveryImages: updated,
        updatedAt: serverTimestamp()
      });
      setImageUploadFeedback({
        type: 'success',
        message: `Đã xóa ảnh nhập hàng #${idx + 1} thành công!`
      });
    } catch (err: any) {
      console.error("Lỗi xóa ảnh:", err);
      setImageUploadFeedback({
        type: 'error',
        message: "Không thể xóa ảnh: " + (err.message || err)
      });
    }
  };

  const handlePrint = () => {
    if (!receipt) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>In Phiếu Nhập #${receipt.id.substring(0, 8)}</title>
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
              <p class="title">PHIẾU NHẬP HÀNG</p>
              <div class="order-id">Mã phiếu: #${receipt.id.substring(0, 8).toUpperCase()}</div>
              <div style="font-size: 8pt; margin-top: 1mm;">Ngày: ${formatDateSafe(receipt.createdAt)}</div>
            </div>

            <div class="customer-info">
              <div class="info-row">
                <span>Nhà CC:</span>
                <span style="font-weight: bold;">${receipt.supplierName || 'Nhà cung cấp không tên'}</span>
              </div>
              <div class="info-row">
                <span>Hình thức:</span>
                <span>${receipt.paymentMethodName || (receipt.paymentStatus === 'debt' ? 'Ghi nợ' : 'Tiền mặt')}</span>
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
                ${(receipt.items || []).map(item => `
                  <tr>
                    <td>${item.productName}${item.isCombo ? ' (Combo)' : ''}</td>
                    <td class="text-center">${item.quantity || 0}</td>
                    <td class="text-right">${isAdmin ? formatNumber(item.importPrice || 0) : '***'}</td>
                    <td class="text-right">${isAdmin ? formatNumber((item.quantity || 0) * (item.importPrice || 0)) : '***'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="totals">
              <div class="total-row grand-total">
                <span>TỔNG CỘNG:</span>
                <span>${isAdmin ? formatNumber(receipt.total || 0) + ' VNĐ' : '***'}</span>
              </div>
              <div class="total-row">
                <span>Đã thanh toán:</span>
                <span>${isAdmin ? formatNumber(effectiveAmountPaid) : '***'}</span>
              </div>
              <div class="total-row" style="font-weight: bold;">
                <span>Còn nợ:</span>
                <span>${isAdmin ? formatNumber(remainingDebt) : '***'}</span>
              </div>
            </div>

            <div class="footer">
              <p>Phiếu nhập kho nội bộ.</p>
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

  const confirmDeleteReceipt = async () => {
    setIsProcessing(true);
    try {
        const batch = writeBatch(db);
        if (receipt.items && receipt.items.length > 0) {
            for (const item of receipt.items) {
                if (item.isCombo) {
                    const prodSnap = await getDoc(doc(db, 'products', item.productId));
                    if (prodSnap.exists()) {
                        const comboItems = prodSnap.data().comboItems || [];
                        comboItems.forEach((cItem: any) => {
                            const totalDeduct = cItem.quantity * item.quantity;
                            const invRef = doc(db, 'products', cItem.productId, 'inventory', receipt.warehouseId);
                            batch.set(invRef, { stock: increment(-totalDeduct), warehouseId: receipt.warehouseId, warehouseName: receipt.warehouseName || '' }, { merge: true });
                            if (receipt.hasInvoice) {
                                batch.update(doc(db, 'products', cItem.productId), { totalInvoicedStock: increment(-totalDeduct) });
                            }
                        });
                    }
                } else {
                    const inventoryRef = doc(db, 'products', item.productId, 'inventory', receipt.warehouseId);
                    batch.set(inventoryRef, { stock: increment(-item.quantity), warehouseId: receipt.warehouseId, warehouseName: receipt.warehouseName || '' }, { merge: true });
                    if (receipt.hasInvoice) {
                        batch.update(doc(db, 'products', item.productId), { totalInvoicedStock: increment(-item.quantity) });
                    }
                }
            }
        }
        batch.delete(doc(db, 'goodsReceipts', receipt.id));
        await batch.commit();
        alert("Đã xóa phiếu nhập và trừ lại tồn kho các món lẻ tương ứng.");
        onClose();
    } catch (error: any) {
        console.error("Error deleting receipt:", error);
        alert(`Lỗi: ${error.message}`);
    } finally {
        setIsProcessing(false);
    }
  };

  const exportDetailToExcel = () => {
    if (!receipt || !receipt.items) return;
    const dataToExport = receipt.items.map((item, index) => ({
      STT: index + 1,
      "Tên món": item.productName || 'Sản phẩm',
      "Loại": item.isCombo ? "COMBO" : "Lẻ",
      "Số lượng": item.quantity || 0,
      ...(isAdmin ? { "Đơn giá (VNĐ)": item.importPrice || 0 } : {}),
      ...(isAdmin ? { "Thành tiền (VNĐ)": (item.quantity || 0) * (item.importPrice || 0) } : {})
    }));

    // Add extra row for summary
    dataToExport.push({
      STT: "" as any,
      "Tên món": "TỔNG CỘNG" as any,
      "Loại": "" as any,
      "Số lượng": receipt.items.reduce((sum, i) => sum + (i.quantity || 0), 0),
      ...(isAdmin ? { "Đơn giá (VNĐ)": "" as any } : {}),
      ...(isAdmin ? { "Thành tiền (VNĐ)": receipt.total || 0 } : {})
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ChiTietNhapHang");
    XLSX.writeFile(wb, `Chi_Tiet_Nhap_Hang_${receipt.id.substring(0, 8)}.xlsx`);
  };

  return (
    <>
    <DeliveryImageViewerModal
      isOpen={isImageViewerOpen}
      onClose={() => setIsImageViewerOpen(false)}
      images={localReceiptImages}
      initialIndex={imageViewerIdx}
      orderId={receipt.id.substring(0, 8).toUpperCase()}
      customerName={receipt.supplierName || 'Nhà cung cấp'}
      receiptId={receipt.id}
      partnerLabel="Nhà cung cấp"
      onImagesChange={(newImgs) => setLocalReceiptImages(newImgs)}
    />
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in-down overflow-hidden border border-slate-200">
        <div className="flex justify-between items-center mb-4 pb-4 border-b">
          <h2 className="text-xl font-black text-dark flex items-center uppercase tracking-tighter">
            <FileText className="mr-3 text-primary" /> Chi Tiết Phiếu Nhập
          </h2>
          <div className="flex items-center space-x-2">
              <button
                  type="button"
                  onClick={() => {
                      setImageViewerIdx(0);
                      setIsImageViewerOpen(true);
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer ${
                      localReceiptImages.length > 0
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-slate-100 hover:bg-emerald-600 text-slate-700 hover:text-white border border-slate-300'
                  }`}
              >
                  <Camera size={14} />
                  <span>{localReceiptImages.length > 0 ? `Ảnh nhập (${localReceiptImages.length})` : '+ Chụp / Up ảnh'}</span>
              </button>
              <button onClick={handlePrint} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow-sm flex items-center">
                  <Printer size={14} className="mr-1" />
                  In đơn hàng
              </button>
              <button onClick={exportDetailToExcel} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow-sm flex items-center">
                  <Printer size={14} className="mr-1" />
                  Xuất Excel
              </button>
              <button onClick={onClose} className="p-2 text-neutral hover:bg-slate-100 rounded-full"><X size={24} /></button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border-2 border-slate-800 shadow-sm overflow-hidden">
                    <div className="bg-slate-800 p-3 text-white flex justify-between items-center">
                        <h4 className="text-xs font-black uppercase flex items-center tracking-tighter">
                            <ShoppingCart className="mr-2" size={16} /> Danh sách sản phẩm nhập
                        </h4>
                        <span className="bg-primary px-2 py-0.5 rounded-full text-[10px] font-black">{receipt.items?.length || 0} SP</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="p-3 text-[10px] font-black uppercase text-slate-500">Sản phẩm</th>
                                    <th className="p-3 text-[10px] font-black uppercase text-slate-500 text-center">SL</th>
                                    {isAdmin && <th className="p-3 text-[10px] font-black uppercase text-slate-500 text-right">Giá nhập</th>}
                                    {isAdmin && <th className="p-3 text-[10px] font-black uppercase text-slate-500 text-right">Thành tiền</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(receipt.items || []).map((item, index) => (
                                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3 font-bold text-slate-900 text-xs uppercase leading-tight">
                                            {item.productName}
                                            {item.isCombo && <span className="ml-2 px-1 py-0.5 bg-blue-100 text-blue-700 text-[8px] font-black rounded">COMBO</span>}
                                        </td>
                                        <td className="p-3 text-center font-black text-slate-900 text-sm">{item.quantity || 0}</td>
                                        {isAdmin && <td className="p-3 text-right font-bold text-slate-500 text-xs">{formatNumber(item.importPrice || 0)}</td>}
                                        {isAdmin && <td className="p-3 text-primary font-black text-right text-sm">{formatNumber((item.quantity || 0) * (item.importPrice || 0))} ₫</td>}
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
                            <div className="flex justify-between items-center pb-2 border-b border-slate-700">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Trạng thái:</span>
                                <span className={`px-2 py-0.5 text-[11px] font-black rounded-full uppercase ${
                                    remainingDebt === 0
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        : effectiveAmountPaid > 0
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}>
                                    {remainingDebt === 0 ? 'Đã thanh toán đủ' : (effectiveAmountPaid > 0 ? 'Thanh toán 1 phần' : 'Công nợ (Chưa trả)')}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Tổng cộng:</span>
                                <span className="text-lg font-black text-primary">{formatNumber(receipt.total || 0)} ₫</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Đã thanh toán:</span>
                                <span className="text-lg font-black text-green-400">{formatNumber(effectiveAmountPaid)} ₫</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Còn nợ:</span>
                                <span className={`text-xl font-black ${remainingDebt > 0 ? 'text-red-500' : 'text-green-500'}`}>{formatNumber(remainingDebt)} ₫</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* PHẦN HÌNH ẢNH CHỤP NHẬP HÀNG / HÓA ĐƠN */}
            <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-sm overflow-hidden">
                <div className="bg-emerald-50/80 p-3.5 text-slate-800 flex flex-wrap justify-between items-center gap-2 border-b-2 border-emerald-200">
                    <div className="flex items-center gap-2">
                        <Camera className="text-emerald-600" size={18} />
                        <h4 className="text-xs font-black uppercase tracking-tight text-emerald-950">
                            Hình ảnh chụp nhập hàng / Hóa đơn ({localReceiptImages.length} ảnh{localReceiptImages.length > 0 ? ` · ~${getImagesTotalKB(localReceiptImages)} KB` : ''})
                        </h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setImageViewerIdx(0);
                                setIsImageViewerOpen(true);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                            title="Mở Trình Xem Ảnh Toàn Màn Hình (Phóng to, Thu nhỏ, Xoay 90°, Tải về, Xóa, Up thêm ảnh)"
                        >
                            <Eye size={14} />
                            <span>{localReceiptImages.length > 0 ? `Xem toàn màn hình (${localReceiptImages.length})` : 'Mở trình xem ảnh'}</span>
                        </button>
                        <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition cursor-pointer shadow-xs">
                            {isUploadingImages ? <Loader size={14} className="animate-spin" /> : <Camera size={14} />}
                            <span>Chụp ảnh</span>
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => {
                                    handleQuickUploadReceiptImages(e.target.files);
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
                                    handleQuickUploadReceiptImages(e.target.files);
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
                            <span>Đang xử lý và lưu ảnh nhập hàng lên hệ thống... Vui lòng chờ giây lát!</span>
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
                    {localReceiptImages.length === 0 ? (
                        <div className="py-6 text-center text-slate-400 text-xs font-bold flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                            <Camera size={28} className="text-slate-300" />
                            <span>Phiếu nhập này chưa có ảnh chụp hàng hóa / hóa đơn. Bấm "Chụp ảnh" hoặc "Tải ảnh lên" để thêm.</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                            {localReceiptImages.map((imgUrl, idx) => (
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
                                        alt={`Ảnh nhập hàng ${idx + 1}`}
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
                                        onClick={(e) => handleRemoveReceiptImage(idx, e)}
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
                                <th className="p-3 text-[10px] font-black uppercase text-slate-500">Trả từ ngân hàng / TK</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-500">Ngân hàng nhận (NCC)</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-500">Nội dung / Ghi chú</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-500 text-right">Số tiền trả</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {fullPaymentHistory.length > 0 ? (
                                fullPaymentHistory.map((payment, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3 text-[11px] font-bold text-slate-600 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <Clock size={13} className="mr-1.5 text-slate-400 shrink-0" />
                                                {formatDateSafe((payment as any).createdAt || (payment as any).date)}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <span className="inline-flex items-center px-2 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-black uppercase tracking-tight shadow-xs">
                                                <Landmark size={12} className="mr-1 text-sky-600 shrink-0" />
                                                {payment.paymentMethodName || 'Tiền mặt'}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            {(payment as any).supplierBankDetails ? (
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 text-[10px]">{(payment as any).supplierBankDetails.bankName || 'Ngân hàng'}</span>
                                                    <span className="text-[9px] text-slate-500 font-mono font-semibold">{(payment as any).supplierBankDetails.accountNumber || ''}</span>
                                                    <span className="text-[9px] font-black uppercase text-slate-400">{(payment as any).supplierBankDetails.accountName || ''}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] italic text-slate-400">Không có</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-[11px] font-semibold text-slate-700">
                                            {payment.note || 'Thanh toán tiền hàng'}
                                        </td>
                                        <td className="p-3 text-right font-black text-red-600 text-sm whitespace-nowrap">
                                            -{formatNumber(payment.amount || 0)} ₫
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-400 text-xs italic font-medium uppercase tracking-widest">
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
                    <Info size={14} className="mr-2 text-primary"/> Thông tin phiếu nhập & Nhà cung cấp
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <DetailRow icon={<Users size={16} />} label="Nhà Cung Cấp" value={receipt.supplierName || 'N/A'} />
                    <DetailRow icon={<Calendar size={16} />} label="Ngày Nhập" value={formatDateSafe(receipt.createdAt)} />
                    <DetailRow icon={<Warehouse size={16} />} label="Kho Nhập" value={receipt.warehouseName || 'N/A'} />
                    <DetailRow icon={<FileCheck2 size={16} />} label="Hóa Đơn" value={receipt.hasInvoice ? 'Đã có HĐ đỏ' : 'Không có HĐ'} />
                    <DetailRow icon={<CreditCard size={16} />} label="Phương Thức TT" value={receipt.paymentMethodName || 'Nợ/Tiền mặt'} />
                    <DetailRow icon={<UserCircle size={16} />} label="Người Tạo" value={receipt.creatorName || 'Hệ thống'} />
                    <DetailRow icon={<Hash size={16} />} label="ID Hệ Thống" value={receipt.id} />
                </div>
            </div>
        </div>
        
        <div className="mt-6 pt-4 border-t flex items-center justify-between">
            <div className="flex space-x-2">
                {isAdmin && (
                    <button onClick={() => setIsDeleteConfirmOpen(true)} disabled={isProcessing} className="flex items-center space-x-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition border border-red-200 font-black text-xs uppercase">
                        <Trash2 size={18} /><span>Xóa phiếu</span>
                    </button>
                )}
            </div>
            <button onClick={onClose} className="px-6 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg transform active:scale-95 transition-all">Đóng</button>
        </div>
      </div>
    </div>
    <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={confirmDeleteReceipt} title="Xác nhận Xóa Phiếu Nhập" message={<>Bạn có chắc muốn xóa phiếu nhập này?<br/><span className="text-red-600 font-bold italic">Số lượng tồn kho của từng sản phẩm lẻ trong Combo sẽ bị trừ lại tự động.</span></>} />
    </>
  );
};

export default GoodsReceiptDetailModal;
