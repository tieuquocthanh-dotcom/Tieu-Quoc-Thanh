import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { Tag, ArrowUpDown, TrendingUp, TrendingDown, Check, RotateCcw, ArrowLeft, AlertCircle, CheckSquare, Square } from 'lucide-react';
import { formatNumber } from '../utils/formatting';

export interface PriceDiffItem {
  productId: string;
  productName: string;
  shortName?: string;
  standardPrice: number;     // Giá chuẩn hiện tại trong danh mục sản phẩm (product.importPrice)
  receiptPrice: number;      // Giá nhập đơn này (item.importPrice)
  quantity: number;
  difference: number;        // receiptPrice - standardPrice
  percentDiff: number;       // ((receiptPrice - standardPrice) / standardPrice) * 100
}

interface StandardPriceDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  diffItems: PriceDiffItem[];
  onConfirmWithUpdates: (selectedProductIds: string[]) => Promise<void> | void;
  onConfirmKeepOldPrices: () => Promise<void> | void;
  isProcessing?: boolean;
}

const StandardPriceDiffModal: React.FC<StandardPriceDiffModalProps> = ({
  isOpen,
  onClose,
  diffItems,
  onConfirmWithUpdates,
  onConfirmKeepOldPrices,
  isProcessing = false
}) => {
  // Mặc định chọn tất cả các sản phẩm có chênh lệch giá để cập nhật nếu người dùng bấm Đồng ý
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && diffItems.length > 0) {
      setSelectedIds(new Set(diffItems.map(item => item.productId)));
    }
  }, [isOpen, diffItems]);

  if (!isOpen || diffItems.length === 0) return null;

  const toggleItem = (productId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === diffItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(diffItems.map(i => i.productId)));
    }
  };

  const allSelected = selectedIds.size === diffItems.length;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[220] p-3 sm:p-4 animate-fade-in">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border-2 border-amber-400 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-700 p-4 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <ArrowUpDown size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg uppercase tracking-tight flex items-center gap-2">
                <span>Cập Nhật Giá Nhập Chuẩn?</span>
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs font-bold">
                  {diffItems.length} sản phẩm
                </span>
              </h3>
              <p className="text-xs text-white/90 font-medium">
                Giá nhập đơn này có sự khác biệt so với giá nhập chuẩn hiện tại
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            disabled={isProcessing}
            className="text-white/80 hover:text-white p-1 rounded-lg transition"
            title="Đóng / Quay lại"
          >
            ✕
          </button>
        </div>

        {/* Thông báo hướng dẫn */}
        <div className="p-4 bg-amber-50/80 border-b border-amber-200 text-xs text-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-900">
            <AlertCircle size={15} className="text-amber-600 shrink-0" />
            <span>Đơn nhập này vẫn sẽ lưu theo giá nhập mới vừa nhập.</span>
          </div>
          <p className="text-slate-600 pl-5">
            Bạn có muốn cập nhật lại <strong>giá nhập chuẩn (giá vốn gốc)</strong> trong danh mục sản phẩm cho các mặt hàng dưới đây không?
          </p>
        </div>

        {/* Danh sách so sánh giá */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          <div className="flex justify-between items-center px-1">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs font-bold text-primary flex items-center gap-1.5 hover:underline cursor-pointer"
            >
              {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              <span>{allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả để cập nhật'}</span>
            </button>
            <span className="text-xs text-slate-500 font-medium">
              Đã chọn: <strong className="text-primary">{selectedIds.size}</strong>/{diffItems.length} SP
            </span>
          </div>

          <div className="space-y-2">
            {diffItems.map((item, idx) => {
              const isChecked = selectedIds.has(item.productId);
              const isIncrease = item.difference > 0;

              return (
                <div
                  key={item.productId}
                  onClick={() => toggleItem(item.productId)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isChecked
                      ? 'bg-blue-50/60 border-blue-300 ring-1 ring-blue-200'
                      : 'bg-slate-50 border-slate-200 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleItem(item.productId)}
                      onClick={e => e.stopPropagation()}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-0 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm truncate uppercase">
                        {idx + 1}. {item.productName}
                        {item.shortName && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-black rounded border border-amber-300">
                            {item.shortName}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Số lượng nhập: <span className="font-bold text-slate-700">{formatNumber(item.quantity)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Chi tiết giá */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-6 sm:pl-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Giá chuẩn cũ</div>
                      <div className="text-xs font-bold text-slate-600 line-through">
                        {formatNumber(item.standardPrice)} ₫
                      </div>
                    </div>

                    <div className="text-slate-300 font-bold">➔</div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-500">Giá nhập mới</div>
                      <div className="text-sm font-black text-slate-900">
                        {formatNumber(item.receiptPrice)} ₫
                      </div>
                    </div>

                    {/* Badge chênh lệch */}
                    <div className="min-w-[95px] text-right">
                      <span className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-black uppercase ${
                        isIncrease
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        {isIncrease ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        <span>{isIncrease ? '+' : ''}{formatNumber(item.difference)} ₫</span>
                      </span>
                      <div className={`text-[10px] font-bold mt-0.5 ${isIncrease ? 'text-rose-600' : 'text-emerald-600'}`}>
                        ({isIncrease ? '+' : ''}{item.percentDiff.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-2.5 justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer order-3 sm:order-1"
          >
            <ArrowLeft size={15} />
            <span>Quay lại sửa giỏ</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await onConfirmKeepOldPrices();
            }}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl border-2 border-slate-600 bg-slate-700 hover:bg-slate-800 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer order-2 sm:order-2"
            title="Đơn này vẫn nhập giá mới, nhưng giá chuẩn sản phẩm giữ nguyên như cũ"
          >
            <RotateCcw size={15} />
            <span>Giữ giá chuẩn cũ & Lưu đơn</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              const selectedArray = Array.from(selectedIds);
              await onConfirmWithUpdates(selectedArray);
            }}
            disabled={isProcessing}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer order-1 sm:order-3"
            title="Cập nhật giá chuẩn cho các sản phẩm đã chọn và lưu đơn nhập"
          >
            <Check size={16} strokeWidth={3} />
            <span>
              {selectedIds.size > 0 
                ? `Cập nhật ${selectedIds.size} giá chuẩn & Lưu đơn` 
                : 'Lưu đơn (Không cập nhật)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StandardPriceDiffModal;
