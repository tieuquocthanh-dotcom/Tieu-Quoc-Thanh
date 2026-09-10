import React, { useState, useEffect } from 'react';
import { Sale, PaymentMethod } from '../types';
import { X, Wallet, CheckCircle2, AlertCircle, Calendar, StickyNote, Landmark, Clock, Coins } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import { doc, runTransaction, Timestamp, collection, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

interface QuickDebtPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  paymentMethods: PaymentMethod[];
  onSuccess?: () => void;
}

const QuickDebtPayModal: React.FC<QuickDebtPayModalProps> = ({
  isOpen,
  onClose,
  sale,
  paymentMethods,
  onSuccess
}) => {
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>('');
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = sale?.total || 0;
  const alreadyPaid = sale?.amountPaid || 0;
  const remainingDebt = Math.max(0, total - alreadyPaid);

  useEffect(() => {
    if (isOpen && sale) {
      setError(null);
      const remaining = Math.max(0, (sale.total || 0) - (sale.amountPaid || 0));
      setPayAmount(remaining);
      
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      setPayDate(`${yyyy}-${mm}-${dd}`);

      // Chọn phương thức mặc định: ưu tiên Tiền mặt hoặc phương thức đầu tiên
      const cashMethod = paymentMethods.find(m => m.name.toLowerCase().includes('tiền mặt'));
      if (cashMethod) {
        setSelectedMethodId(cashMethod.id);
      } else if (paymentMethods.length > 0) {
        setSelectedMethodId(paymentMethods[0].id);
      } else {
        setSelectedMethodId('');
      }

      setNote(`Thanh toán nợ đơn hàng #${sale.id.substring(0, 8).toUpperCase()}`);
    }
  }, [isOpen, sale, paymentMethods]);

  if (!isOpen || !sale) return null;

  const shortId = sale.id.substring(0, 8).toUpperCase();
  const selectedMethod = paymentMethods.find(m => m.id === selectedMethodId);
  const isFullSettlement = payAmount >= remainingDebt;
  const afterRemaining = Math.max(0, remainingDebt - payAmount);

  const handleConfirm = async () => {
    if (!selectedMethodId) {
      setError("Vui lòng chọn phương thức / tài khoản nhận tiền.");
      return;
    }
    if (payAmount <= 0) {
      setError("Số tiền thu phải lớn hơn 0.");
      return;
    }
    if (payAmount > remainingDebt) {
      setError(`Số tiền thanh toán không được vượt quá số còn nợ (${formatNumber(remainingDebt)} ₫).`);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const selectedDateObj = payDate ? new Date(payDate) : new Date();
      const now = new Date();
      selectedDateObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      const paymentTimestamp = Timestamp.fromDate(selectedDateObj);

      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', sale.id);
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) {
          throw new Error("Không tìm thấy thông tin đơn hàng trên hệ thống.");
        }

        const saleData = saleSnap.data() as Sale;
        const currentPaid = saleData.amountPaid || 0;
        const currentTotal = saleData.total || 0;
        const newPaid = currentPaid + payAmount;
        const isCompleted = newPaid >= currentTotal;

        const accRef = doc(db, 'paymentMethods', selectedMethodId);
        const accSnap = await transaction.get(accRef);
        if (!accSnap.exists()) {
          throw new Error("Không tìm thấy tài khoản thanh toán đã chọn.");
        }

        const currentAccBal = Number(accSnap.data()?.balance) || 0;
        const finalAccBal = currentAccBal + payAmount;

        const methodName = selectedMethod?.name || accSnap.data()?.name || 'Tiền mặt';
        const paymentNote = note.trim() || `Thu nợ qua ${methodName}`;

        const newPaymentHistoryEntry = {
          date: paymentTimestamp,
          amount: payAmount,
          note: paymentNote,
          paymentMethodId: selectedMethodId,
          paymentMethodName: methodName
        };

        let updatedMethodName = saleData.paymentMethodName || '';
        if (!updatedMethodName) {
          updatedMethodName = methodName;
        } else if (!updatedMethodName.toLowerCase().includes(methodName.toLowerCase())) {
          updatedMethodName = `${updatedMethodName} + ${methodName}`;
        }

        // Cập nhật Sale
        transaction.update(saleRef, {
          amountPaid: newPaid,
          status: isCompleted ? 'paid' : 'debt',
          paidAt: isCompleted ? paymentTimestamp : ((saleData as any).paidAt || null),
          paymentMethodName: updatedMethodName,
          paymentHistory: arrayUnion(newPaymentHistoryEntry)
        });

        // Cập nhật số dư tài khoản
        transaction.update(accRef, {
          balance: finalAccBal
        });

        // Ghi log thu tiền
        const logRef = doc(collection(db, 'paymentLogs'));
        transaction.set(logRef, {
          paymentMethodId: selectedMethodId,
          paymentMethodName: methodName,
          type: 'deposit',
          amount: payAmount,
          balanceAfter: finalAccBal,
          note: `Thu nợ đơn #${shortId} (${sale.customerName || 'Khách vãng lai'}): ${formatNumber(payAmount)} ₫ - ${paymentNote}`,
          relatedId: sale.id,
          relatedType: 'sale',
          createdAt: paymentTimestamp,
          createdBy: auth.currentUser?.uid || null,
          creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Thu ngân'
        });
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Có lỗi xảy ra khi ghi nhận thanh toán nợ.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl border-2 border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 text-white flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Wallet size={20} />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-tight">Thu tiền / Thanh toán nợ</h3>
              <p className="text-[11px] font-bold text-slate-400">Đơn hàng #{shortId}</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-800">
          {error && (
            <div className="p-3 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Tóm tắt tình trạng nợ đơn hàng */}
          <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-bold uppercase">Khách hàng:</span>
              <span className="font-black text-slate-900 text-sm">{sale.customerName || 'Khách vãng lai'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center">
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <div className="text-[9px] font-black uppercase text-slate-400">Tổng đơn</div>
                <div className="text-xs font-black text-slate-800 mt-0.5">{formatNumber(total)} ₫</div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <div className="text-[9px] font-black uppercase text-slate-400">Đã thu trước</div>
                <div className="text-xs font-black text-emerald-600 mt-0.5">{formatNumber(alreadyPaid)} ₫</div>
              </div>
              <div className="bg-red-50 p-2 rounded-lg border border-red-200">
                <div className="text-[9px] font-black uppercase text-red-500">Còn nợ</div>
                <div className="text-xs font-black text-red-600 mt-0.5">{formatNumber(remainingDebt)} ₫</div>
              </div>
            </div>

            {/* Hiển thị các đợt thanh toán trước nếu có */}
            {sale.paymentHistory && sale.paymentHistory.length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <div className="text-[10px] font-black uppercase text-slate-500 mb-1.5 flex items-center gap-1">
                  <Clock size={12} /> Các đợt đã thanh toán trước:
                </div>
                <div className="space-y-1">
                  {sale.paymentHistory.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-black">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-700">{p.paymentMethodName || 'Tiền mặt'}</span>
                        {p.note && <span className="text-slate-400 text-[10px]">({p.note})</span>}
                      </div>
                      <span className="font-black text-emerald-600">+{formatNumber(p.amount)} ₫</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chọn tài khoản nhận tiền */}
          <div>
            <label className="block text-[11px] font-black text-slate-600 uppercase mb-1.5 flex items-center gap-1">
              <Landmark size={14} className="text-emerald-600" /> Phương thức / Tài khoản nhận tiền:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {paymentMethods.map(m => {
                const isSelected = m.id === selectedMethodId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMethodId(m.id)}
                    className={`p-2.5 rounded-xl text-left border-2 transition active:scale-98 ${
                      isSelected 
                        ? 'border-emerald-600 bg-emerald-50/80 shadow-xs' 
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`text-xs font-black truncate ${isSelected ? 'text-emerald-800' : 'text-slate-800'}`}>
                      {m.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold truncate mt-0.5">
                      Số dư: {formatNumber(m.balance || 0)} ₫
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nhập số tiền thu đợt này */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-black text-slate-600 uppercase flex items-center gap-1">
                <Coins size={14} className="text-amber-600" /> Số tiền thu đợt này:
              </label>
              <span className="text-[11px] font-black text-red-600">
                Tối đa: {formatNumber(remainingDebt)} ₫
              </span>
            </div>
            
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={payAmount > 0 ? formatNumber(payAmount) : ''}
                placeholder="0"
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, '');
                  const val = parseInt(raw || '0', 10);
                  setPayAmount(Math.min(val, remainingDebt));
                }}
                className="w-full px-4 py-3 bg-slate-900 text-emerald-400 border-2 border-slate-800 rounded-xl font-black text-2xl text-right outline-none focus:border-emerald-500 shadow-inner"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">VNĐ</span>
            </div>

            {/* Nút chọn nhanh số tiền */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => setPayAmount(remainingDebt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition active:scale-95 border ${
                  payAmount === remainingDebt 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}
              >
                Trả hết nợ ({formatNumber(remainingDebt)} ₫)
              </button>

              {remainingDebt >= 500000 && (
                <button
                  type="button"
                  onClick={() => setPayAmount(Math.floor(remainingDebt / 2))}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition active:scale-95"
                >
                  50% ({formatNumber(Math.floor(remainingDebt / 2))} ₫)
                </button>
              )}

              {remainingDebt >= 2000000 && (
                <button
                  type="button"
                  onClick={() => setPayAmount(1000000)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition active:scale-95"
                >
                  1.000.000 ₫
                </button>
              )}

              {remainingDebt >= 3000000 && (
                <button
                  type="button"
                  onClick={() => setPayAmount(2000000)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition active:scale-95"
                >
                  2.000.000 ₫
                </button>
              )}
            </div>
          </div>

          {/* Ngày thu & Ghi chú */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-black text-slate-600 uppercase mb-1 flex items-center gap-1">
                <Calendar size={13} /> Ngày ghi nhận thu tiền:
              </label>
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500"
                style={{ colorScheme: 'light' }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-600 uppercase mb-1 flex items-center gap-1">
                <StickyNote size={13} /> Ghi chú:
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Trả nợ đợt 2..."
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Trạng thái dự kiến sau khi thu */}
          <div className={`p-3 rounded-xl border-2 flex items-center justify-between ${
            isFullSettlement 
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className={isFullSettlement ? 'text-emerald-600' : 'text-amber-600'} />
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 block">Dự kiến sau khi thu:</span>
                <span className="text-xs font-black">
                  {isFullSettlement ? 'ĐÃ HOÀN TẤT ĐƠN (Hết nợ 0 ₫)' : `CÒN NỢ LẠI: ${formatNumber(afterRemaining)} ₫`}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-500 block">Tổng đã thu:</span>
              <span className="text-xs font-black text-slate-800">{formatNumber(alreadyPaid + payAmount)} ₫</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t-2 border-slate-200 flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 py-3 bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-black text-xs uppercase transition active:scale-95"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing || payAmount <= 0 || !selectedMethodId}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase shadow-lg transition active:scale-95 disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center gap-2"
          >
            {isProcessing ? 'Đang lưu...' : `Xác nhận thu ${formatNumber(payAmount)} ₫`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickDebtPayModal;
