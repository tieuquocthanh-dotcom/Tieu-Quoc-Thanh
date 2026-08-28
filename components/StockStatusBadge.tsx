import React from 'react';

interface StockStatusBadgeProps {
  stock: number;
  compact?: boolean;
  className?: string;
  showText?: boolean;
}

/**
 * Huy hiệu tồn kho trực quan theo mã màu:
 * 🟢 Xanh lá: Còn nhiều (> 10)
 * 🟡 Vàng cam: Sắp hết (< 5) hoặc trung bình (5-10)
 * 🔴 Đỏ: Hết hàng (<= 0)
 */
export const StockStatusBadge: React.FC<StockStatusBadgeProps> = ({
  stock,
  compact = false,
  className = '',
  showText = true,
}) => {
  if (stock > 10) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs whitespace-nowrap ${className}`}
        title={`Còn nhiều trong kho: ${stock} sản phẩm`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
        {showText && (compact ? <span>{stock}</span> : <span>Còn nhiều ({stock})</span>)}
      </span>
    );
  }

  if (stock >= 5) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/90 shadow-2xs whitespace-nowrap ${className}`}
        title={`Tồn kho trung bình: ${stock} sản phẩm`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
        {showText && (compact ? <span>{stock}</span> : <span>Còn {stock}</span>)}
      </span>
    );
  }

  if (stock > 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs whitespace-nowrap ${className}`}
        title={`Cảnh báo: Sắp hết hàng (${stock} SP)`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse shrink-0"></span>
        {showText && (compact ? <span>{stock}</span> : <span>Sắp hết ({stock})</span>)}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs whitespace-nowrap ${className}`}
      title="Hết hàng trong kho"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
      {showText && (compact ? <span>0</span> : <span>Hết hàng (0)</span>)}
    </span>
  );
};

export default StockStatusBadge;

