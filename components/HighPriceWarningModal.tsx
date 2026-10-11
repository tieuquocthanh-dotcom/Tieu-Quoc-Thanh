import React from 'react';
import { Product } from '../types';
import { AlertTriangle, TrendingUp, DollarSign, X, Check, Eye, Edit3, ArrowRight } from 'lucide-react';
import { formatNumber } from '../utils/formatting';

export interface HighPriceWarningData {
  product: Product;
  quantity: number;
  inputPrice: number;
  keepSearch?: boolean;
  supplierName: string;
  lastSupplierPrice?: number;
  cheapestOtherSupplier?: {
    supplierName: string;
    price: number;
    difference: number;
    date?: Date;
  };
  basePriceDifference?: number;
  priceIncreaseFromLast?: {
    amount: number;
    percent: number;
  };
}

interface HighPriceWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: HighPriceWarningData | null;
  onConfirmAdd: (price?: number, quantity?: number) => void;
  onAdjustPrice?: () => void;
  onOpenPriceComparison: (product: Product) => void;
}

const HighPriceWarningModal: React.FC<HighPriceWarningModalProps> = ({
  isOpen,
  onClose,
  data,
  onConfirmAdd,
  onAdjustPrice,
  onOpenPriceComparison
}) => {
  const [editPrice, setEditPrice] = React.useState<number>(0);
  const [editQty, setEditQty] = React.useState<number>(1);
  const [isCustomizing, setIsCustomizing] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (data) {
      setEditPrice(data.inputPrice);
      setEditQty(data.quantity);
      setIsCustomizing(false);
    }
  }, [data]);

  if (!isOpen || !data) return null;

  const {
    product,
    supplierName,
    lastSupplierPrice,
    cheapestOtherSupplier,
    basePriceDifference,
    priceIncreaseFromLast
  } = data;

  const handleConfirm = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const finalPrice = Number(editPrice) > 0 ? Number(editPrice) : (Number(data.inputPrice) || 0);
    const finalQty = Number(editQty) > 0 ? Number(editQty) : (Number(data.quantity) || 1);
    onConfirmAdd(finalPrice, finalQty);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[250] p-4 animate-fade-in">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border-2 border-amber-400 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 text-white flex justify-between items-center shrink-0 ${
          basePriceDifference && basePriceDifference < 0 && !priceIncreaseFromLast
            ? 'bg-gradient-to-r from-rose-600 via-amber-600 to-indigo-700'
            : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <AlertTriangle size={24} className="text-white animate-bounce-short" />
            </div>
            <div>
              <h3 className="font-black text-base uppercase tracking-tight">
                {basePriceDifference && basePriceDifference < 0 && !priceIncreaseFromLast
                  ? 'Cảnh Báo: Giá Nhập Rẻ Hơn Giá Chuẩn!'
                  : 'Cảnh Báo: Giá Nhập Khác Thường!'}
              </h3>
              <p className="text-xs text-white/90 font-medium">
                {basePriceDifference && basePriceDifference < 0 && !priceIncreaseFromLast
                  ? 'Giá nhập rẻ hơn giá chuẩn của sản phẩm - Cân nhắc cập nhật lại giá chuẩn'
                  : 'Phát hiện giá nhập có sự chênh lệch so với giá chuẩn hoặc lịch sử'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg transition"
            title="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Product & Current Input Info Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Sản phẩm cần nhập</div>
                <div className="text-sm font-black text-slate-900 uppercase mt-0.5">
                  {product.name}
                  {product.shortName && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-black rounded border border-amber-300">
                      {product.shortName}
                    </span>
                  )}
                </div>
              </div>
              <span className="px-2 py-0.5 bg-slate-200 text-slate-800 text-[10px] font-black rounded-md uppercase shrink-0">
                SL: x{editQty}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-600 font-bold">
                NCC đang nhập: <strong className="text-slate-900 uppercase">{supplierName || 'Chưa chọn'}</strong>
              </span>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold block">Giá dự kiến nhập:</span>
                <span className="text-base font-black text-rose-600">
                  {formatNumber(editPrice)} đ
                </span>
              </div>
            </div>
          </div>

          {/* Quick Price Adjust Section */}
          {isCustomizing ? (
            <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-2.5 animate-fade-in">
              <div className="text-xs font-black uppercase text-amber-950 flex items-center gap-1.5">
                <Edit3 size={14} className="text-amber-700" />
                <span>Điều chỉnh lại giá hoặc số lượng trước khi thêm</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">Giá nhập mới (đ)</label>
                  <input
                    type="number"
                    value={editPrice || ''}
                    onChange={(e) => setEditPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-2.5 py-1.5 text-xs font-black text-slate-900 bg-white border-2 border-amber-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Nhập giá..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">Số lượng</label>
                  <input
                    type="number"
                    min="1"
                    value={editQty || ''}
                    onChange={(e) => setEditQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2.5 py-1.5 text-xs font-black text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-center"
                  />
                </div>
              </div>

              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {lastSupplierPrice && lastSupplierPrice > 0 && (
                  <button
                    type="button"
                    onClick={() => setEditPrice(lastSupplierPrice)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-[10px] font-bold rounded-md transition"
                  >
                    Lấy giá lần trước: {formatNumber(lastSupplierPrice)} đ
                  </button>
                )}
                {cheapestOtherSupplier && (
                  <button
                    type="button"
                    onClick={() => setEditPrice(cheapestOtherSupplier.price)}
                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-bold rounded-md transition"
                  >
                    Lấy giá rẻ nhất ({cheapestOtherSupplier.supplierName}): {formatNumber(cheapestOtherSupplier.price)} đ
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {/* Detailed Warning Cards */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
              <span>Lý do cảnh báo giá cao</span>
            </div>

            {/* Warning 1: Increased from last time with this supplier */}
            {priceIncreaseFromLast && lastSupplierPrice && (
              <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-start gap-3">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0 mt-0.5">
                  <TrendingUp size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black uppercase text-rose-900">
                    Tăng giá so với lần nhập trước từ NCC này
                  </div>
                  <div className="text-xs text-rose-800 mt-1 space-y-0.5 font-medium">
                    <div className="flex items-center gap-2">
                      <span>Lần trước: <strong>{formatNumber(lastSupplierPrice)} đ</strong></span>
                      <ArrowRight size={12} className="text-rose-400" />
                      <span>Lần này: <strong>{formatNumber(editPrice)} đ</strong></span>
                    </div>
                    <div className="text-xs font-black text-rose-700 mt-1">
                      ➔ Tăng: +{formatNumber(priceIncreaseFromLast.amount)} đ/sp (+{priceIncreaseFromLast.percent.toFixed(1)}%)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Warning 2: Another supplier has a lower price */}
            {cheapestOtherSupplier && (
              <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-start gap-3">
                <div className="p-2 bg-amber-200 text-amber-800 rounded-lg shrink-0 mt-0.5">
                  <DollarSign size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black uppercase text-amber-950 flex items-center justify-between">
                    <span>Có Nhà cung cấp khác giá rẻ hơn!</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                      Tiết kiệm {formatNumber(cheapestOtherSupplier.difference)} đ/sp
                    </span>
                  </div>
                  <div className="text-xs text-amber-900 mt-1 font-medium">
                    NCC <strong className="uppercase underline decoration-amber-500 font-black">{cheapestOtherSupplier.supplierName}</strong> từng cung cấp với giá chỉ{' '}
                    <strong className="text-emerald-700 font-black text-sm">{formatNumber(cheapestOtherSupplier.price)} đ</strong>
                    {cheapestOtherSupplier.date && (
                      <span className="text-[10px] text-amber-700 ml-1">
                        (ngày {cheapestOtherSupplier.date.toLocaleDateString('vi-VN')})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-amber-800 mt-1 font-bold">
                    ➔ Nếu nhập {editQty} sản phẩm này, bạn tốn thêm tổng cộng: <strong className="text-rose-700 font-black">+{formatNumber(cheapestOtherSupplier.difference * editQty)} đ</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Warning 3: Price differs from product standard base import price (higher OR cheaper) */}
            {basePriceDifference !== undefined && basePriceDifference !== 0 && !priceIncreaseFromLast && (
              <div className={`p-3.5 rounded-xl border-2 flex items-start gap-3 ${
                basePriceDifference < 0
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : 'bg-orange-50 border-orange-300 text-orange-950'
              }`}>
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  basePriceDifference < 0 ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  <AlertTriangle size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-black uppercase ${
                    basePriceDifference < 0 ? 'text-rose-900' : 'text-orange-900'
                  }`}>
                    {basePriceDifference < 0 ? '📉 Giá nhập RẺ HƠN giá chuẩn của sản phẩm' : '📈 Giá nhập CAO HƠN giá chuẩn của sản phẩm'}
                  </div>
                  <div className="text-xs mt-1 space-y-0.5 font-medium">
                    <div className="flex items-center gap-2">
                      <span>Giá chuẩn SP: <strong>{formatNumber(product.importPrice)} đ</strong></span>
                      <ArrowRight size={12} className={basePriceDifference < 0 ? 'text-rose-400' : 'text-orange-400'} />
                      <span>Dự kiến nhập: <strong>{formatNumber(editPrice)} đ</strong></span>
                    </div>
                    <div className={`text-xs font-black mt-1 ${
                      basePriceDifference < 0 ? 'text-rose-700' : 'text-orange-700'
                    }`}>
                      ➔ {basePriceDifference < 0 ? 'Rẻ hơn: -' : 'Tăng thêm: +'}{formatNumber(Math.abs(basePriceDifference))} đ/sp ({product.importPrice > 0 ? ((Math.abs(basePriceDifference) / product.importPrice) * 100).toFixed(1) : 0}%)
                    </div>
                    <div className="text-[11px] text-slate-500 italic mt-0.5">
                      💡 Khi hoàn tất đơn nhập này, bạn có thể chọn cập nhật lại giá chuẩn mới hoặc tiếp tục giữ giá cũ.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenPriceComparison(product)}
            className="w-full sm:w-auto px-3 py-2 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 shadow-2xs"
          >
            <Eye size={14} className="text-blue-600" />
            <span>So sánh giá tất cả NCC</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!isCustomizing ? (
              <button
                type="button"
                onClick={() => setIsCustomizing(true)}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-white hover:bg-amber-50 text-amber-800 border-2 border-amber-400 rounded-xl text-xs font-black uppercase transition flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
              >
                <Edit3 size={14} />
                <span>Chỉnh lại giá</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black uppercase transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
            >
              <Check size={16} strokeWidth={3} />
              <span>Vẫn thêm vào đơn</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HighPriceWarningModal;
