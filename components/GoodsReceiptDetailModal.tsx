
import React, { useState, useEffect, useMemo } from 'react';
import { GoodsReceipt, GoodsReceiptItem, PaymentHistoryEntry } from '../types';
import { X, Users, Warehouse, Calendar, Hash, FileText, ShoppingCart, FileCheck2, FileX2, CreditCard, Printer, Trash2, Edit, Save, AlertCircle, Loader, UserCircle, Info, History, Coins, StickyNote } from 'lucide-react';
import { formatNumber, parseNumber } from '../utils/formatting';
import { doc, writeBatch, increment, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import ConfirmationModal from './ConfirmationModal';

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

  const isAdmin = userRole === 'admin';

  const fullPaymentHistory = useMemo((): PaymentHistoryEntry[] => {
    if (!receipt) return [];
    
    const history = receipt.paymentHistory ? [...receipt.paymentHistory] : [];
    const totalAmountInHistory = history.reduce((sum, h) => sum + h.amount, 0);
    const amountPaid = receipt.amountPaid || 0;

    if (amountPaid > 0 && amountPaid > totalAmountInHistory) {
        const diff = amountPaid - totalAmountInHistory;
        history.unshift({
            date: receipt.createdAt,
            amount: diff,
            note: 'Thanh toán khi tạo phiếu'
        });
    }

    return history.sort((a, b) => b.date.toMillis() - a.date.toMillis());
  }, [receipt]);

  if (!isOpen || !receipt) return null;

  const remainingDebt = Math.max(0, receipt.total - (receipt.amountPaid || 0));

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
                            batch.set(invRef, { stock: increment(-totalDeduct) }, { merge: true });
                            if (receipt.hasInvoice) {
                                batch.update(doc(db, 'products', cItem.productId), { totalInvoicedStock: increment(-totalDeduct) });
                            }
                        });
                    }
                } else {
                    const inventoryRef = doc(db, 'products', item.productId, 'inventory', receipt.warehouseId);
                    batch.set(inventoryRef, { stock: increment(-item.quantity) }, { merge: true });
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

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-down overflow-hidden border-4 border-slate-800">
        <div className="flex justify-between items-center mb-4 pb-4 border-b">
          <h2 className="text-xl font-black text-dark flex items-center uppercase tracking-tighter">
            <FileText className="mr-3 text-primary" /> Chi Tiết Phiếu Nhập
          </h2>
          <button onClick={onClose} className="p-2 text-neutral hover:bg-slate-100 rounded-full"><X size={24} /></button>
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
                                {receipt.items.map((item, index) => (
                                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3 font-bold text-slate-900 text-xs uppercase leading-tight">
                                            {item.productName}
                                            {item.isCombo && <span className="ml-2 px-1 py-0.5 bg-blue-100 text-blue-700 text-[8px] font-black rounded">COMBO</span>}
                                        </td>
                                        <td className="p-3 text-center font-black text-slate-900 text-sm">{item.quantity}</td>
                                        {isAdmin && <td className="p-3 text-right font-bold text-slate-500 text-xs">{formatNumber(item.importPrice)}</td>}
                                        {isAdmin && <td className="p-3 text-primary font-black text-right text-sm">{formatNumber(item.quantity * item.importPrice)} ₫</td>}
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
                            <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Tổng cộng:</span>
                                <span className="text-lg font-black text-primary">{formatNumber(receipt.total)} ₫</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Đã thanh toán:</span>
                                <span className="text-lg font-black text-green-400">{formatNumber(receipt.amountPaid || 0)} ₫</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Còn nợ:</span>
                                <span className={`text-xl font-black ${remainingDebt > 0 ? 'text-red-500' : 'text-green-500'}`}>{formatNumber(remainingDebt)} ₫</span>
                            </div>
                        </div>
                    </div>
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
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 text-right">Số tiền trả</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {fullPaymentHistory.length > 0 ? (
                                fullPaymentHistory.map((payment, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                        <td className="p-3 text-[11px] font-bold text-slate-600">
                                            {payment.date?.toDate().toLocaleString('vi-VN')}
                                        </td>
                                        <td className="p-3 text-[11px] font-black text-slate-800 uppercase">
                                            {payment.note || 'Thanh toán trực tiếp'}
                                        </td>
                                        <td className="p-3 text-right font-black text-red-600 text-sm">
                                            -{formatNumber(payment.amount)} ₫
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
                    <Info size={14} className="mr-2 text-primary"/> Thông tin phiếu nhập & Nhà cung cấp
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <DetailRow icon={<Users size={16} />} label="Nhà Cung Cấp" value={receipt.supplierName} />
                    <DetailRow icon={<Calendar size={16} />} label="Ngày Nhập" value={receipt.createdAt?.toDate().toLocaleString('vi-VN')} />
                    <DetailRow icon={<Warehouse size={16} />} label="Kho Nhập" value={receipt.warehouseName} />
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
