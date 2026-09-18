import React, { useMemo } from 'react';
import { Product, ProductInvoiceExport, Manufacturer } from '../types';
import { 
    History, 
    X, 
    Eye, 
    FileOutput, 
    Calendar, 
    User, 
    Package, 
    FileText,
    ArrowUpRight
} from 'lucide-react';
import { formatNumber } from '../utils/formatting';

interface ProductExportHistoryModalProps {
    isOpen: boolean;
    product: Product | null;
    invoiceExports: ProductInvoiceExport[];
    manufacturers?: Manufacturer[];
    onClose: () => void;
    onQuickExport: (product: Product) => void;
    onViewExportDetail: (exportDoc: ProductInvoiceExport) => void;
}

export const ProductExportHistoryModal: React.FC<ProductExportHistoryModalProps> = ({
    isOpen,
    product,
    invoiceExports,
    manufacturers = [],
    onClose,
    onQuickExport,
    onViewExportDetail
}) => {
    if (!isOpen || !product) return null;

    const mfg = manufacturers.find(m => m.id === product.manufacturerId);

    // Filter all export instances that include this product
    const matchingRecords = useMemo(() => {
        const results: {
            exportDoc: ProductInvoiceExport;
            itemQuantity: number;
            itemUnitPrice?: number;
            itemNotes?: string;
        }[] = [];

        invoiceExports.forEach(exp => {
            exp.items?.forEach(it => {
                if (it.productId === product.id) {
                    results.push({
                        exportDoc: exp,
                        itemQuantity: it.quantity || 0,
                        itemUnitPrice: it.unitPrice,
                        itemNotes: it.notes
                    });
                }
            });
        });

        // Sort newest first by exportDate or createdAt
        return results.sort((a, b) => {
            const dateA = a.exportDoc.exportDate || '';
            const dateB = b.exportDoc.exportDate || '';
            return dateB.localeCompare(dateA);
        });
    }, [product, invoiceExports]);

    const totalExportedQuantity = useMemo(() => {
        return matchingRecords.reduce((sum, r) => sum + r.itemQuantity, 0);
    }, [matchingRecords]);

    const currentInvoicedStock = product.totalInvoicedStock || 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="bg-slate-900 p-4 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                            <History size={20} />
                        </div>
                        <div>
                            <h3 className="font-black uppercase text-sm">
                                Lịch Sử Các Lần Xuất Hóa Đơn
                            </h3>
                            <p className="text-[11px] text-slate-400 font-medium">
                                Theo dõi chi tiết các lần xuất hóa đơn của sản phẩm
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Product Summary Header Card */}
                <div className="p-5 bg-slate-50 border-b border-slate-200 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                                Sản phẩm kiểm tra
                            </span>
                            <h4 className="text-base font-black uppercase text-slate-900">
                                {product.name}
                            </h4>
                            {mfg && (
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Hãng sản xuất: <strong className="text-slate-700">{mfg.name}</strong>
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-2.5">
                            <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs text-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase block">Tồn HĐ hiện tại</span>
                                <span className={`text-base font-black ${
                                    currentInvoicedStock > 0 ? 'text-blue-600' : currentInvoicedStock < 0 ? 'text-rose-600' : 'text-slate-500'
                                }`}>
                                    {formatNumber(currentInvoicedStock)} <span className="text-[11px] font-medium text-slate-400">cái</span>
                                </span>
                            </div>

                            <div className="bg-white px-3.5 py-2 rounded-xl border border-indigo-100 shadow-2xs text-center">
                                <span className="text-[10px] font-black text-indigo-600 uppercase block">Tổng đã xuất HĐ</span>
                                <span className="text-base font-black text-indigo-700">
                                    {formatNumber(totalExportedQuantity)} <span className="text-[11px] font-medium text-indigo-400">cái</span>
                                </span>
                            </div>

                            <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs text-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase block">Số lần xuất</span>
                                <span className="text-base font-black text-slate-800">
                                    {matchingRecords.length} <span className="text-[11px] font-medium text-slate-400">lần</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table of Export Invoices */}
                <div className="p-5 overflow-y-auto flex-1">
                    {matchingRecords.length === 0 ? (
                        <div className="py-12 text-center flex flex-col items-center justify-center">
                            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                                <FileOutput size={26} />
                            </div>
                            <p className="text-sm font-bold text-slate-600 uppercase">
                                Chưa có lần xuất hóa đơn nào cho sản phẩm này
                            </p>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm">
                                Sản phẩm chưa từng được chọn trong bất kỳ phiếu xuất hóa đơn nào. Bạn có thể bấm nút xuất hóa đơn bên dưới để tạo lần xuất mới.
                            </p>
                        </div>
                    ) : (
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                                    <tr>
                                        <th className="py-3 px-3 text-center w-10">STT</th>
                                        <th className="py-3 px-3">Ngày xuất</th>
                                        <th className="py-3 px-3">Số HĐ / Mã phiếu</th>
                                        <th className="py-3 px-3">Người làm</th>
                                        <th className="py-3 px-3">Khách hàng / Đơn vị nhận</th>
                                        <th className="py-3 px-3 text-center">SL xuất</th>
                                        <th className="py-3 px-3 text-right">Đơn giá HĐ</th>
                                        <th className="py-3 px-3 text-center w-16">Chi tiết</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {matchingRecords.map((r, idx) => (
                                        <tr key={idx} className="hover:bg-indigo-50/40 transition">
                                            <td className="py-3 px-3 text-center font-bold text-slate-400">
                                                {idx + 1}
                                            </td>
                                            <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar size={13} className="text-indigo-500" />
                                                    <span>{r.exportDoc.exportDate || '---'}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 font-black text-indigo-700">
                                                {r.exportDoc.exportNumber || '---'}
                                            </td>
                                            <td className="py-3 px-3 font-bold text-slate-700 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <User size={13} className="text-slate-400" />
                                                    <span>{r.exportDoc.creatorName || '---'}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                                                {r.exportDoc.customerName || '---'}
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-black text-xs border border-indigo-200">
                                                    {formatNumber(r.itemQuantity)} cái
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-slate-700">
                                                {r.itemUnitPrice ? `${formatNumber(r.itemUnitPrice)} ₫` : '---'}
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <button
                                                    onClick={() => onViewExportDetail(r.exportDoc)}
                                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                                    title="Xem toàn bộ phiếu xuất này"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
                    <button
                        onClick={() => {
                            onClose();
                            onQuickExport(product);
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 transition shadow-sm"
                    >
                        <FileOutput size={16} />
                        <span>Xuất Hóa Đơn Cho SP Này Ngay</span>
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs uppercase transition"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductExportHistoryModal;
