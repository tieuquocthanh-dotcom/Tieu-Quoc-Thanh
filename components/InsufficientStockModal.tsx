import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface InsufficientItemInfo {
  productId: string;
  productName: string;
  requiredQty: number;
  currentStock: number;
  missingQty: number;
}

interface InsufficientStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleId: string;
  warehouseName: string;
  items: InsufficientItemInfo[];
}

const InsufficientStockModal: React.FC<InsufficientStockModalProps> = ({
  isOpen,
  onClose,
  saleId,
  warehouseName,
  items,
}) => {
  if (!isOpen) return null;

  const shortId = saleId ? saleId.substring(0, 8).toUpperCase() : '';

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[9999] p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border-2 border-red-500 overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="bg-red-700/80 p-1.5 rounded-lg">
              <AlertTriangle size={22} className="text-yellow-300 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-tight">Không Đủ Hàng Xuất Kho!</h3>
              <p className="text-[11px] text-red-100 font-bold">Cảnh báo thiếu hụt tồn kho thực tế</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-black/20 transition-colors"
            title="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-600 uppercase text-[10px]">Đơn hàng:</span>
              <span className="font-black text-sm text-red-700">#{shortId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-600 uppercase text-[10px]">Kho xuất hàng:</span>
              <span className="font-black text-slate-900">{warehouseName || 'Chưa xác định'}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black text-slate-700 uppercase">
                Danh sách sản phẩm thiếu hụt ({items.length}):
              </span>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {items.map((it, idx) => (
                <div key={idx} className="bg-slate-50 border border-red-200 rounded-xl p-3 shadow-xs space-y-1.5">
                  <div className="font-black text-slate-900 text-xs line-clamp-2">
                    {it.productName}
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                    <span className="text-slate-600">
                      Cần xuất: <strong className="text-slate-900 font-black">{it.requiredQty}</strong>
                    </span>
                    <span className="text-slate-600">
                      Tồn kho: <strong className="text-slate-900 font-black">{it.currentStock}</strong>
                    </span>
                    <span className="font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-md border border-red-300">
                      Thiếu: {it.missingQty}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-900 text-xs font-semibold leading-relaxed">
            ⚠️ <strong>Hướng dẫn:</strong> Số lượng hàng trong kho không đủ để xuất đơn hàng này. Vui lòng thực hiện <strong>Nhập hàng</strong> vào kho trước khi bấm xuất kho!
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase rounded-xl shadow-lg transition active:scale-95 cursor-pointer"
          >
            Đã hiểu / Đóng thông báo
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsufficientStockModal;
