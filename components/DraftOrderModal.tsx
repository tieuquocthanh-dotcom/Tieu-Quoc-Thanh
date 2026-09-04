import React, { useState, useMemo } from 'react';
import { X, Printer, Copy, Check, ShoppingCart, Truck, Warehouse, CreditCard, User, Calendar, FileText, Share2, Info } from 'lucide-react';
import { formatNumber } from '../utils/formatting';

export interface DraftOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  currentImportPrice?: number;
  isCombo?: boolean;
}

interface DraftOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: DraftOrderItem[];
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  warehouseName?: string;
  shipperName?: string;
  paymentMethodName?: string;
  shippingFee: number;
  shippingPayer: 'customer' | 'shop';
  isDebt: boolean;
  amountPaidInput?: string;
  issueInvoice?: boolean;
  saleDate?: string;
}

const DraftOrderModal: React.FC<DraftOrderModalProps> = ({
  isOpen,
  onClose,
  cart,
  customerName,
  customerPhone,
  customerAddress,
  warehouseName,
  shipperName,
  paymentMethodName,
  shippingFee,
  shippingPayer,
  isDebt,
  amountPaidInput,
  issueInvoice,
  saleDate,
}) => {
  const [copied, setCopied] = useState(false);

  // Generate a random stable temporary ID for this session
  const draftCode = useMemo(() => {
    return `TMP-${Math.floor(100000 + Math.random() * 900000)}`;
  }, [isOpen]);

  const nowFormatted = useMemo(() => {
    const now = new Date();
    const dateStr = saleDate || now.toLocaleDateString('vi-VN');
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${timeStr} - ${dateStr}`;
  }, [saleDate, isOpen]);

  const itemsTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const grandTotal = useMemo(() => {
    // If shipping is paid by customer, it adds to total. If shop pays, total is just itemsTotal
    return itemsTotal + (shippingFee || 0);
  }, [itemsTotal, shippingFee]);

  const effectiveAmountPaid = useMemo(() => {
    if (isDebt) return 0;
    if (!amountPaidInput || amountPaidInput.trim() === '') return grandTotal;
    const parsed = parseInt(amountPaidInput.replace(/[^\d]/g, '') || '0', 10);
    return Math.min(grandTotal, parsed);
  }, [isDebt, amountPaidInput, grandTotal]);

  const remainingDebt = useMemo(() => {
    if (isDebt) return grandTotal;
    return Math.max(0, grandTotal - effectiveAmountPaid);
  }, [isDebt, grandTotal, effectiveAmountPaid]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Phiếu Tạm Bán Hàng #${draftCode}</title>
          <style>
            @page { 
              size: A5 portrait; 
              margin: 8mm; 
            }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
              font-size: 9.5pt; 
              line-height: 1.35; 
              color: #1e293b; 
              margin: 0; 
              padding: 0; 
              background: #fff;
            }
            .container { 
              width: 100%; 
              max-width: 680px; 
              margin: 0 auto; 
            }
            .header { 
              text-align: center; 
              border-bottom: 2px dashed #94a3b8; 
              padding-bottom: 4mm; 
              margin-bottom: 4mm; 
            }
            .badge-draft {
              display: inline-block;
              background-color: #fef3c7;
              color: #92400e;
              border: 1px solid #f59e0b;
              font-size: 8pt;
              font-weight: 800;
              text-transform: uppercase;
              padding: 2px 8px;
              border-radius: 9999px;
              margin-bottom: 3px;
            }
            .title { 
              font-size: 14pt; 
              font-weight: 900; 
              text-transform: uppercase; 
              color: #0f172a; 
              margin: 2px 0 3px 0; 
              letter-spacing: 0.5px;
            }
            .sub-title {
              font-size: 8pt;
              color: #64748b;
              font-style: italic;
            }
            .meta-bar {
              display: flex;
              justify-content: space-between;
              font-size: 8.5pt;
              margin-top: 3mm;
              color: #334155;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 8px 12px;
              margin-bottom: 4mm;
              font-size: 8.5pt;
            }
            .info-item {
              margin-bottom: 2px;
            }
            .info-label {
              color: #64748b;
              font-size: 7.5pt;
              text-transform: uppercase;
              font-weight: 700;
            }
            .info-value {
              font-weight: 700;
              color: #0f172a;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 2mm; 
              font-size: 9pt;
            }
            th { 
              background-color: #f1f5f9; 
              border-top: 1px solid #cbd5e1;
              border-bottom: 1px solid #94a3b8; 
              text-align: left; 
              font-size: 8pt; 
              padding: 6px 4px; 
              font-weight: 800;
              text-transform: uppercase;
              color: #334155;
            }
            td { 
              padding: 6px 4px; 
              border-bottom: 1px solid #e2e8f0; 
              vertical-align: middle; 
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .totals { 
              margin-top: 3mm; 
              border-top: 1.5px solid #0f172a; 
              padding-top: 3mm; 
            }
            .total-row { 
              display: flex; 
              justify-content: space-between; 
              padding: 1.5px 0; 
              font-size: 9pt;
            }
            .grand-total { 
              font-weight: 900; 
              font-size: 11.5pt; 
              padding-top: 3px; 
              border-top: 1px dashed #64748b; 
              margin-top: 3px; 
              color: #0f172a;
            }
            .notice-box {
              margin-top: 5mm;
              background-color: #fffbeb;
              border: 1px solid #fef3c7;
              border-radius: 6px;
              padding: 6px 10px;
              font-size: 7.5pt;
              color: #92400e;
              text-align: center;
              font-style: italic;
            }
            .signatures {
              display: flex;
              justify-content: space-between;
              margin-top: 8mm;
              padding-top: 2mm;
              text-align: center;
              font-size: 8.5pt;
            }
            .signature-col {
              width: 45%;
            }
            .signature-title {
              font-weight: 700;
              text-transform: uppercase;
              font-size: 8pt;
              margin-bottom: 15mm;
            }
            .footer-print {
              margin-top: 4mm;
              text-align: center;
              font-size: 7pt;
              color: #94a3b8;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <span class="badge-draft">Phiếu Tạm Tính / Báo Giá Dự Thảo</span>
              <div class="title">PHIẾU ĐẶT HÀNG TẠM</div>
              <div class="sub-title">Dùng để đối chiếu và kiểm tra trước khi xác nhận đơn hàng</div>
              <div class="meta-bar">
                <span>Mã phiếu: <strong>#${draftCode}</strong></span>
                <span>Thời gian: <strong>${nowFormatted}</strong></span>
              </div>
            </div>

            <div class="info-grid">
              <div>
                <div class="info-item">
                  <span class="info-label">Khách hàng:</span>
                  <div class="info-value">${customerName || 'Khách vãng lai'}</div>
                </div>
                ${customerPhone ? `
                  <div class="info-item">
                    <span class="info-label">Điện thoại:</span>
                    <div class="info-value">${customerPhone}</div>
                  </div>
                ` : ''}
                ${customerAddress ? `
                  <div class="info-item">
                    <span class="info-label">Địa chỉ:</span>
                    <div class="info-value">${customerAddress}</div>
                  </div>
                ` : ''}
              </div>
              <div>
                ${warehouseName ? `
                  <div class="info-item">
                    <span class="info-label">Kho xuất:</span>
                    <div class="info-value">${warehouseName}</div>
                  </div>
                ` : ''}
                <div class="info-item">
                  <span class="info-label">Vận chuyển:</span>
                  <div class="info-value">${shipperName || 'Mặc định'} (${shippingPayer === 'customer' ? 'Khách trả ship' : 'Shop miễn ship'})</div>
                </div>
                <div class="info-item">
                  <span class="info-label">Hình thức TT:</span>
                  <div class="info-value">${isDebt ? 'Ghi nợ' : (paymentMethodName || 'Tiền mặt/CK')}</div>
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 32px" class="text-center">STT</th>
                  <th>Tên sản phẩm</th>
                  <th style="width: 50px" class="text-center">SL</th>
                  <th style="width: 90px" class="text-right">Đơn giá</th>
                  <th style="width: 100px" class="text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${cart.map((item, index) => `
                  <tr>
                    <td class="text-center" style="color: #64748b; font-weight: bold;">${index + 1}</td>
                    <td style="font-weight: 600;">
                      ${item.productName}
                      ${item.isCombo ? ' <span style="font-size:7pt;color:#2563eb;font-weight:bold;">[Combo]</span>' : ''}
                    </td>
                    <td class="text-center" style="font-weight: bold;">${item.quantity}</td>
                    <td class="text-right">${formatNumber(item.price)} ₫</td>
                    <td class="text-right" style="font-weight: 700;">${formatNumber(item.price * item.quantity)} ₫</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="totals">
              <div class="total-row">
                <span>Tổng tiền hàng (${cart.length} món):</span>
                <span style="font-weight: 600;">${formatNumber(itemsTotal)} ₫</span>
              </div>
              <div class="total-row">
                <span>Phí vận chuyển (${shippingPayer === 'customer' ? 'Khách thanh toán' : 'Shop hỗ trợ'}):</span>
                <span>${shippingFee > 0 ? `${formatNumber(shippingFee)} ₫` : '0 ₫ (Miễn phí)'}</span>
              </div>
              <div class="total-row grand-total">
                <span>TỔNG THANH TOÁN:</span>
                <span style="color: #1d4ed8;">${formatNumber(grandTotal)} ₫</span>
              </div>
              ${isDebt ? `
                <div class="total-row" style="color: #b91c1c; font-weight: 700; margin-top: 2px;">
                  <span>Hình thức:</span>
                  <span>GHI NỢ (Còn nợ: ${formatNumber(remainingDebt)} ₫)</span>
                </div>
              ` : effectiveAmountPaid < grandTotal ? `
                <div class="total-row" style="color: #047857;">
                  <span>Dự kiến trả trước:</span>
                  <span>${formatNumber(effectiveAmountPaid)} ₫</span>
                </div>
                <div class="total-row" style="color: #b91c1c; font-weight: 700;">
                  <span>Còn lại nợ:</span>
                  <span>${formatNumber(remainingDebt)} ₫</span>
                </div>
              ` : ''}
            </div>

            <div class="notice-box">
              Quý khách vui lòng kiểm tra kỹ danh sách sản phẩm, số lượng và tổng tiền trước khi xác nhận đặt hàng.
            </div>

            <div class="signatures">
              <div class="signature-col">
                <div class="signature-title">Người lập phiếu</div>
                <div>(Ký, ghi rõ họ tên)</div>
              </div>
              <div class="signature-col">
                <div class="signature-title">Khách hàng xác nhận</div>
                <div>(Ký, ghi rõ họ tên)</div>
              </div>
            </div>

            <div class="footer-print">
              In lúc ${new Date().toLocaleTimeString('vi-VN')} - Hệ thống quản lý bán hàng
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
    }, 450);
  };

  const handleCopyZalo = () => {
    let text = `📋 [PHIẾU TẠM TÍNH ĐƠN HÀNG - #${draftCode}]\n`;
    text += `👤 Khách hàng: ${customerName || 'Khách vãng lai'}\n`;
    if (customerPhone) text += `📞 Điện thoại: ${customerPhone}\n`;
    if (customerAddress) text += `📍 Địa chỉ: ${customerAddress}\n`;
    text += `🕒 Thời gian: ${nowFormatted}\n`;
    text += `------------------------------------\n`;
    
    cart.forEach((item, idx) => {
      text += `${idx + 1}. ${item.productName}\n`;
      text += `   SL: ${item.quantity}  x  ${formatNumber(item.price)} ₫ = ${formatNumber(item.price * item.quantity)} ₫\n`;
    });

    text += `------------------------------------\n`;
    text += `💵 Tiền hàng: ${formatNumber(itemsTotal)} ₫\n`;
    if (shippingFee > 0) {
      text += `🚚 Phí ship: ${formatNumber(shippingFee)} ₫ (${shippingPayer === 'customer' ? 'Khách trả' : 'Shop chịu'})\n`;
    }
    text += `👉 TỔNG CỘNG: ${formatNumber(grandTotal)} ₫\n`;
    
    if (isDebt) {
      text += `💳 Hình thức: Ghi nợ (Còn nợ: ${formatNumber(remainingDebt)} ₫)\n`;
    } else if (effectiveAmountPaid < grandTotal) {
      text += `💳 Trả trước: ${formatNumber(effectiveAmountPaid)} ₫ (Còn nợ: ${formatNumber(remainingDebt)} ₫)\n`;
    } else {
      text += `💳 Thanh toán: ${paymentMethodName || 'Tiền mặt/CK'}\n`;
    }

    text += `------------------------------------\n`;
    text += `Dạ Quý khách kiểm tra lại danh sách & số lượng giúp shop nhé! Cảm ơn Quý khách.`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(err => {
      console.error('Failed to copy', err);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header Bar */}
        <div className="bg-slate-900 px-4 sm:px-6 py-3.5 text-white flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base tracking-tight uppercase flex items-center gap-2">
                Phiếu Tạm Bán Hàng
                <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold px-2 py-0.5 rounded-full uppercase">
                  Dự thảo xem trước
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Cho khách xem trước thông tin và số lượng trước khi chốt đơn
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Printable Document Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-4">
          {/* Paper Sheet Preview */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-4">
            {/* Sheet Title & Meta */}
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 inline-block mb-1">
                  Đơn Hàng Tạm Tính
                </span>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  CHI TIẾT ĐẶT HÀNG
                </h2>
                <p className="text-xs text-slate-500">
                  Mã phiếu: <span className="font-mono font-bold text-slate-800">#{draftCode}</span>
                </p>
              </div>
              <div className="text-left sm:text-right text-xs text-slate-500">
                <p className="flex items-center gap-1 sm:justify-end">
                  <Calendar size={13} className="text-slate-400"/>
                  <span className="font-medium">{nowFormatted}</span>
                </p>
                {warehouseName && (
                  <p className="flex items-center gap-1 sm:justify-end mt-0.5">
                    <Warehouse size={13} className="text-slate-400"/>
                    <span className="font-medium text-slate-700">Kho: {warehouseName}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Customer & Delivery Information Block */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <User size={12}/> Thông tin khách hàng
                </span>
                <p className="font-black text-sm text-slate-900 uppercase">
                  {customerName || 'Khách vãng lai'}
                </p>
                {customerPhone && (
                  <p className="text-slate-700 font-medium">
                    Điện thoại: <span className="font-bold text-slate-900">{customerPhone}</span>
                  </p>
                )}
                {customerAddress && (
                  <p className="text-slate-600 line-clamp-2">
                    Địa chỉ: {customerAddress}
                  </p>
                )}
              </div>

              <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <Truck size={12}/> Giao hàng & Thanh toán
                </span>
                <p className="text-slate-700">
                  ĐVVC: <span className="font-bold text-slate-900">{shipperName || 'Giao ngay / Mặc định'}</span>
                </p>
                <p className="text-slate-700">
                  Cước ship: <span className="font-semibold text-slate-900">
                    {shippingPayer === 'customer' ? 'Khách thanh toán cước' : 'Shop miễn cước vận chuyển'}
                  </span>
                </p>
                <p className="text-slate-700 flex items-center gap-1.5 mt-1">
                  Hình thức: 
                  {isDebt ? (
                    <span className="font-black text-red-600 bg-red-100 px-2 py-0.5 rounded text-[11px] border border-red-200">
                      Ghi nợ
                    </span>
                  ) : (
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] border border-blue-200">
                      {paymentMethodName || 'Tiền mặt / Chuyển khoản'}
                    </span>
                  )}
                  {issueInvoice && (
                    <span className="font-black text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded text-[10px] border border-purple-200">
                      Xuất HĐ
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Products Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                    <th className="py-2.5 px-2.5 text-center w-8">#</th>
                    <th className="py-2.5 px-3">Tên sản phẩm</th>
                    <th className="py-2.5 px-2 text-center w-14">SL</th>
                    <th className="py-2.5 px-3 text-right w-24">Đơn giá</th>
                    <th className="py-2.5 px-3 text-right w-28">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.map((item, idx) => (
                    <tr key={item.productId || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-2.5 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {item.productName}
                        {item.isCombo && (
                          <span className="ml-1.5 text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 uppercase">
                            Combo
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center font-black text-slate-800 text-sm">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                        {formatNumber(item.price)} ₫
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        {formatNumber(item.price * item.quantity)} ₫
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Price Calculations */}
            <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Tổng tiền hàng ({cart.length} sản phẩm):</span>
                <span className="font-bold text-slate-900 text-sm">{formatNumber(itemsTotal)} ₫</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="flex items-center gap-1">
                  Phí vận chuyển 
                  <span className="text-[10px] text-slate-500">
                    ({shippingPayer === 'customer' ? 'Khách trả' : 'Shop chịu'})
                  </span>:
                </span>
                <span className="font-bold text-slate-900">
                  {shippingFee > 0 ? `${formatNumber(shippingFee)} ₫` : '0 ₫ (Miễn phí)'}
                </span>
              </div>
              
              <div className="flex justify-between items-center pt-2.5 border-t border-slate-300">
                <span className="font-black text-slate-900 uppercase text-sm sm:text-base">
                  Tổng cộng thanh toán:
                </span>
                <span className="font-black text-blue-600 text-xl sm:text-2xl">
                  {formatNumber(grandTotal)} <span className="text-sm font-bold">₫</span>
                </span>
              </div>

              {isDebt && (
                <div className="bg-red-50 p-2.5 rounded-lg border border-red-200 flex justify-between items-center text-red-700 mt-2 font-bold">
                  <span>Trạng thái dự kiến: GHI NỢ 100%</span>
                  <span className="text-sm">Nợ: {formatNumber(grandTotal)} ₫</span>
                </div>
              )}

              {!isDebt && effectiveAmountPaid < grandTotal && (
                <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-amber-800 space-y-1 mt-2">
                  <div className="flex justify-between font-bold">
                    <span>Khách trả trước:</span>
                    <span>{formatNumber(effectiveAmountPaid)} ₫</span>
                  </div>
                  <div className="flex justify-between font-black text-red-700">
                    <span>Còn ghi nợ:</span>
                    <span>{formatNumber(remainingDebt)} ₫</span>
                  </div>
                </div>
              )}
            </div>

            {/* Note box */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2 text-amber-800 text-xs">
              <Info size={16} className="text-amber-600 shrink-0 mt-0.5"/>
              <p className="leading-relaxed">
                <strong>Ghi chú:</strong> Đây là phiếu tính tạm để xác nhận lại chi tiết đơn hàng trước khi xuất kho. Thông tin có thể điều chỉnh theo thỏa thuận của Quý khách.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Action Bar */}
        <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyZalo}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
              copied 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-100' 
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800 active:scale-98'
            }`}
            title="Sao chép nội dung đơn hàng để gửi qua Zalo / Messenger cho khách"
          >
            {copied ? <Check size={16} className="text-emerald-600"/> : <Copy size={16}/>}
            <span>{copied ? 'Đã sao chép gửi Zalo!' : 'Sao chép gửi Zalo / SMS'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
            >
              <Printer size={16}/>
              <span>In phiếu tạm</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftOrderModal;
