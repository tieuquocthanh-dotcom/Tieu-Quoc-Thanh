
import React, { useState, useEffect, useMemo } from 'react';
import { Sale, Product, PaymentHistoryEntry } from '../types';
import { X, User, Warehouse, CreditCard, Truck, Calendar, Hash, FileText, ShoppingCart, FileCheck2, FileX2, Printer, Trash2, Edit, Save, AlertCircle, Loader, UserCircle, Info, History, Coins, Wallet, StickyNote } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import { doc, writeBatch, increment, getDoc, collection, query, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import ConfirmationModal from './ConfirmationModal';

interface SaleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  userRole: 'admin' | 'staff' | null;
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

const SaleDetailModal: React.FC<SaleDetailModalProps> = ({ isOpen, onClose, sale, userRole }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const isAdmin = userRole === 'admin';

  const fullPaymentHistory = useMemo((): PaymentHistoryEntry[] => {
    if (!sale) return [];
    
    const history = sale.paymentHistory ? [...sale.paymentHistory] : [];
    const totalAmountInHistory = history.reduce((sum, h) => sum + h.amount, 0);
    const amountPaid = sale.amountPaid || 0;

    if (amountPaid > 0 && amountPaid > totalAmountInHistory) {
        const diff = amountPaid - totalAmountInHistory;
        history.unshift({
            date: sale.createdAt,
            amount: diff,
            note: 'Thanh toán khi tạo đơn'
        });
    }

    return history.sort((a, b) => (b.date?.toMillis?.() || 0) - (a.date?.toMillis?.() || 0));
  }, [sale]);

  const handlePrint = () => {
    if (!sale) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const remainingDebt = Math.max(0, (sale.total ?? 0) - (sale.amountPaid || 0));

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
                <span>${formatNumber(sale.total - (sale.shippingFee || 0))}</span>
              </div>
              ${sale.shippingFee ? `
                <div class="total-row">
                  <span>Phí vận chuyển:</span>
                  <span>${formatNumber(sale.shippingFee)}</span>
                </div>
              ` : ''}
              <div class="total-row grand-total">
                <span>TỔNG CỘNG:</span>
                <span>${formatNumber(sale.total)} VNĐ</span>
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
                            batch.set(invRef, { stock: increment(totalReturn) }, { merge: true });
                            if (sale.issueInvoice) {
                                batch.update(doc(db, 'products', cItem.productId), { totalInvoicedStock: increment(totalReturn) });
                            }
                        });
                    }
                } else {
                    const inventoryRef = doc(db, 'products', item.productId, 'inventory', sale.warehouseId);
                    batch.set(inventoryRef, { stock: increment(item.quantity) }, { merge: true });
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

  const remainingDebt = Math.max(0, (sale.total ?? 0) - (sale.amountPaid || 0));

  return (
    <>
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col animate-fade-in-down overflow-hidden border-4 border-slate-800">
            <div className="flex justify-between items-center p-4 border-b-2 border-slate-800 bg-slate-800 text-white flex-shrink-0">
                <h2 className="text-lg font-black uppercase tracking-tighter flex items-center">
                    <FileText className="mr-3 text-primary" size={20} /> Đơn hàng #{sale.id.substring(0, 8)}
                </h2>
                <button onClick={onClose} className="text-white/50 hover:text-white transition-colors"><X size={28} /></button>
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
                                    <span className="text-lg font-black text-green-400">{formatNumber(sale.amountPaid || 0)} ₫</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Còn nợ:</span>
                                    <span className={`text-xl font-black ${remainingDebt > 0 ? 'text-red-500' : 'text-green-500'}`}>{formatNumber(remainingDebt)} ₫</span>
                                </div>
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
                                    <th className="p-3 text-[10px] font-black uppercase text-slate-400">Thời gian</th>
                                    <th className="p-3 text-[10px] font-black uppercase text-slate-400">Ghi chú / Tài khoản</th>
                                    <th className="p-3 text-[10px] font-black uppercase text-slate-400 text-right">Số tiền thu</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {fullPaymentHistory.length > 0 ? (
                                    fullPaymentHistory.map((payment, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="p-3 text-[11px] font-bold text-slate-600">
                                                {payment.date?.toDate?.()?.toLocaleString('vi-VN') || 'N/A'}
                                            </td>
                                            <td className="p-3 text-[11px] font-black text-slate-800 uppercase">
                                                {payment.note || 'Thanh toán trực tiếp'}
                                            </td>
                                            <td className="p-3 text-right font-black text-green-600 text-sm">
                                                +{formatNumber(payment.amount)} ₫
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="p-8 text-center text-slate-400 text-xs italic font-medium uppercase tracking-widest">
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
                        <DetailRow icon={<User size={16} />} label="Khách Hàng" value={sale.customerName || 'Khách vãng lai'} />
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
                        onClick={handlePrint}
                        className="flex items-center space-x-2 px-6 py-3 bg-slate-800 text-white rounded-xl font-black text-xs uppercase shadow-lg hover:bg-black transition active:scale-95"
                    >
                        <Printer size={18} />
                        <span>In đơn hàng (A6)</span>
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
    </>
  );
};

export default SaleDetailModal;
