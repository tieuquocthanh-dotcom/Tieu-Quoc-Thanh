import React, { useState, useMemo } from 'react';
import { X, Printer, Copy, Check, User, Calendar, FileText, Info, MessageSquare } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import { Sale, Customer } from '../types';

interface SalePrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  customer?: Customer | null;
}

const SalePrintPreviewModal: React.FC<SalePrintPreviewModalProps> = ({
  isOpen,
  onClose,
  sale,
  customer,
}) => {
  const [copiedZalo, setCopiedZalo] = useState(false);
  const [copiedSMS, setCopiedSMS] = useState(false);

  const orderCode = useMemo(() => {
    if (!sale?.id) return '';
    return sale.id.substring(0, 8).toUpperCase();
  }, [sale?.id]);

  const nowFormatted = useMemo(() => {
    if (!sale) return '';
    if (sale.createdAt?.toDate) {
      const d = sale.createdAt.toDate();
      const dateStr = d.toLocaleDateString('vi-VN');
      const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      return `${timeStr} - ${dateStr}`;
    }
    return new Date().toLocaleDateString('vi-VN');
  }, [sale]);

  const itemsTotal = useMemo(() => {
    if (!sale?.items) return 0;
    return sale.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [sale?.items]);

  const shippingFee = sale?.shippingFee || 0;
  const grandTotal = sale?.total ?? (itemsTotal + shippingFee);

  const effectiveAmountPaid = useMemo(() => {
    if (!sale) return 0;
    if (sale.amountPaid !== undefined && sale.amountPaid !== null) {
      return sale.amountPaid;
    }
    return sale.status === 'paid' ? grandTotal : 0;
  }, [sale, grandTotal]);

  const remainingDebt = useMemo(() => {
    return Math.max(0, grandTotal - effectiveAmountPaid);
  }, [grandTotal, effectiveAmountPaid]);

  const customerName = sale?.customerName || customer?.name || 'Khách vãng lai';

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Hóa Đơn Bán Hàng #${orderCode}</title>
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
            .badge-order {
              display: inline-block;
              background-color: #eff6ff;
              color: #1d4ed8;
              border: 1px solid #93c5fd;
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
            .meta-bar {
              display: flex;
              justify-content: space-between;
              font-size: 8.5pt;
              margin-top: 3mm;
              color: #334155;
            }
            .customer-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 9.5pt;
              margin-top: 2.5mm;
              padding-top: 2mm;
              border-top: 1px dotted #cbd5e1;
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
            .note-box {
              margin-top: 4mm;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 6px 10px;
              font-size: 8pt;
              color: #475569;
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
              <span class="badge-order">Hóa Đơn Bán Hàng</span>
              <div class="title">HÓA ĐƠN BÁN HÀNG</div>
              <div class="meta-bar">
                <span>Mã đơn: <strong>#${orderCode}</strong></span>
                <span>Thời gian: <strong>${nowFormatted}</strong></span>
              </div>
              <div class="customer-bar">
                <span>Khách hàng: <strong style="text-transform: uppercase; font-size: 10pt;">${customerName}</strong></span>
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
                ${(sale.items || []).map((item, index) => `
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
                <span>Tổng tiền hàng (${sale.items?.length || 0} sản phẩm):</span>
                <span style="font-weight: 600;">${formatNumber(itemsTotal)} ₫</span>
              </div>
              ${shippingFee > 0 ? `
                <div class="total-row">
                  <span>Phí vận chuyển (${(sale as any).shippingPayer === 'shop' ? 'Shop hỗ trợ' : 'Khách trả'}):</span>
                  <span>+${formatNumber(shippingFee)} ₫</span>
                </div>
              ` : ''}
              <div class="total-row grand-total">
                <span>TỔNG THANH TOÁN:</span>
                <span style="color: #1d4ed8;">${formatNumber(grandTotal)} ₫</span>
              </div>
              <div class="total-row" style="color: #047857; font-weight: 600;">
                <span>Đã thanh toán:</span>
                <span>${formatNumber(effectiveAmountPaid)} ₫</span>
              </div>
              ${remainingDebt > 0 ? `
                <div class="total-row" style="color: #b91c1c; font-weight: 800;">
                  <span>CÒN NỢ:</span>
                  <span>${formatNumber(remainingDebt)} ₫</span>
                </div>
              ` : ''}
            </div>

            ${sale.note ? `
              <div class="note-box">
                <strong>Ghi chú:</strong> ${sale.note}
              </div>
            ` : ''}

            <div class="signatures">
              <div class="signature-col">
                <div class="signature-title">Người lập phiếu</div>
                <div>(Ký, ghi rõ họ tên)</div>
              </div>
              <div class="signature-col">
                <div class="signature-title">Khách hàng</div>
                <div>(Ký, ghi rõ họ tên)</div>
              </div>
            </div>

            <div class="footer-print">
              Cảm ơn Quý khách đã tin tưởng & ủng hộ!<br/>
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
    let text = `📋 [HÓA ĐƠN BÁN HÀNG - #${orderCode}]\n`;
    text += `👤 Khách hàng: ${customerName}\n`;
    text += `🕒 Thời gian: ${nowFormatted}\n`;
    text += `------------------------------------\n`;

    (sale.items || []).forEach((item, idx) => {
      text += `${idx + 1}. ${item.productName}${item.isCombo ? ' [Combo]' : ''}\n`;
      text += `   SL: ${item.quantity}  x  ${formatNumber(item.price)} ₫ = ${formatNumber(item.price * item.quantity)} ₫\n`;
    });

    text += `------------------------------------\n`;
    text += `💵 Tiền hàng: ${formatNumber(itemsTotal)} ₫\n`;
    if (shippingFee > 0) {
      text += `🚚 Phí ship: ${formatNumber(shippingFee)} ₫ (${(sale as any).shippingPayer === 'shop' ? 'Shop hỗ trợ' : 'Khách trả'})\n`;
    }
    text += `👉 TỔNG CỘNG: ${formatNumber(grandTotal)} ₫\n`;
    text += `✅ Đã thanh toán: ${formatNumber(effectiveAmountPaid)} ₫\n`;
    if (remainingDebt > 0) {
      text += `⚠️ CÒN GHI NỢ: ${formatNumber(remainingDebt)} ₫\n`;
    }
    if (sale.note) {
      text += `📝 Ghi chú: ${sale.note}\n`;
    }

    text += `------------------------------------\n`;
    text += `Dạ Quý khách kiểm tra lại danh sách & số lượng giúp shop nhé! Cảm ơn Quý khách.`;

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedZalo(true);
        setTimeout(() => setCopiedZalo(false), 2500);
      })
      .catch((err) => {
        console.error('Failed to copy Zalo text', err);
      });
  };

  const handleCopySMS = () => {
    let smsText = `[HOA DON #${orderCode}] Quy khach ${customerName}, don hang ${(sale.items || []).length} SP: Tong tien: ${formatNumber(grandTotal)}d. Da thanh toan: ${formatNumber(effectiveAmountPaid)}d.`;
    if (remainingDebt > 0) {
      smsText += ` Con no: ${formatNumber(remainingDebt)}d.`;
    }
    smsText += ` Cam on Quy khach!`;

    navigator.clipboard
      .writeText(smsText)
      .then(() => {
        setCopiedSMS(true);
        setTimeout(() => setCopiedSMS(false), 2500);
      })
      .catch((err) => {
        console.error('Failed to copy SMS text', err);
      });
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
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
                Hóa Đơn Bán Hàng #{orderCode}
                {remainingDebt > 0 ? (
                  <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-400/30 font-bold px-2 py-0.5 rounded-full uppercase">
                    Còn nợ
                  </span>
                ) : (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold px-2 py-0.5 rounded-full uppercase">
                    Đã thanh toán
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                Xem trước chi tiết đơn hàng, sao chép gửi Zalo / SMS hoặc in ấn
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

        {/* Scrollable Printable Document Body - Exactly like DraftOrderModal */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-4">
          {/* Paper Sheet Preview */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-4">
            {/* Sheet Title & Meta */}
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block mb-1">
                  Hóa Đơn Bán Hàng
                </span>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  CHI TIẾT ĐƠN HÀNG
                </h2>
                <p className="text-xs text-slate-500">
                  Mã phiếu: <span className="font-mono font-bold text-slate-800">#{orderCode}</span>
                </p>
              </div>
              <div className="text-left sm:text-right text-xs text-slate-500">
                <p className="flex items-center gap-1 sm:justify-end">
                  <Calendar size={13} className="text-slate-400" />
                  <span className="font-medium">{nowFormatted}</span>
                </p>
                <p className="flex items-center gap-1.5 sm:justify-end mt-1">
                  <User size={13} className="text-primary" />
                  <span className="text-slate-600 font-semibold">Khách hàng:</span>
                  <span className="font-black text-slate-900 uppercase text-sm">{customerName}</span>
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
                  {(sale.items || []).map((item, idx) => (
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
                <span>Tổng tiền hàng ({sale.items?.length || 0} sản phẩm):</span>
                <span className="font-bold text-slate-900 text-sm">{formatNumber(itemsTotal)} ₫</span>
              </div>
              {shippingFee > 0 && (
                <div className="flex justify-between items-center text-slate-600">
                  <span className="flex items-center gap-1">
                    Phí vận chuyển
                    <span className="text-[10px] text-slate-500">
                      ({(sale as any).shippingPayer === 'shop' ? 'Shop hỗ trợ' : 'Khách trả'})
                    </span>:
                  </span>
                  <span className="font-bold text-slate-900">
                    +{formatNumber(shippingFee)} ₫
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2.5 border-t border-slate-300">
                <span className="font-black text-slate-900 uppercase text-sm sm:text-base">
                  Tổng cộng thanh toán:
                </span>
                <span className="font-black text-blue-600 text-xl sm:text-2xl">
                  {formatNumber(grandTotal)} <span className="text-sm font-bold">₫</span>
                </span>
              </div>

              <div className="flex justify-between items-center text-emerald-700 font-bold">
                <span>Đã thanh toán:</span>
                <span>{formatNumber(effectiveAmountPaid)} ₫</span>
              </div>

              {remainingDebt > 0 && (
                <div className="bg-red-50 p-2.5 rounded-lg border border-red-200 flex justify-between items-center text-red-700 font-bold">
                  <span>Còn ghi nợ:</span>
                  <span className="text-sm font-black">{formatNumber(remainingDebt)} ₫</span>
                </div>
              )}
            </div>

            {/* Note box */}
            {sale.note && (
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2 text-amber-900 text-xs">
                <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Ghi chú:</strong> {sale.note}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Bar */}
        <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-2.5 shrink-0">
          {/* Copy Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyZalo}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                copiedZalo
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-100'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800 active:scale-98'
              }`}
              title="Sao chép nội dung đơn hàng để gửi qua Zalo / Messenger cho khách"
            >
              {copiedZalo ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              <span>{copiedZalo ? 'Đã sao chép gửi Zalo!' : 'Sao chép gửi Zalo'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopySMS}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                copiedSMS
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-100'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800 active:scale-98'
              }`}
              title="Sao chép tin nhắn SMS ngắn gọn cho khách"
            >
              {copiedSMS ? <Check size={16} className="text-emerald-600" /> : <MessageSquare size={16} />}
              <span>{copiedSMS ? 'Đã sao chép SMS!' : 'Sao chép SMS'}</span>
            </button>
          </div>

          {/* Close & Print Actions */}
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
              <Printer size={16} />
              <span>In đơn hàng</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalePrintPreviewModal;
