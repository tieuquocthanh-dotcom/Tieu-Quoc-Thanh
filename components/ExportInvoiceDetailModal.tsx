import React from 'react';
import { ProductInvoiceExport } from '../types';
import { FileOutput, X, Calendar, User, Edit3 } from 'lucide-react';
import { formatNumber } from '../utils/formatting';

interface ExportInvoiceDetailModalProps {
    isOpen: boolean;
    exportDoc: ProductInvoiceExport | null;
    onClose: () => void;
    onEdit: (exportDoc: ProductInvoiceExport) => void;
}

export const ExportInvoiceDetailModal: React.FC<ExportInvoiceDetailModalProps> = ({
    isOpen,
    exportDoc,
    onClose,
    onEdit
}) => {
    if (!isOpen || !exportDoc) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
                <div className="bg-slate-900 p-4 text-white flex justify-between items-center shrink-0">
                    <h3 className="font-black uppercase text-sm flex items-center gap-2">
                        <FileOutput size={18} /> Chi Tiết Phiếu Xuất Hóa Đơn: {exportDoc.exportNumber}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                        <div>
                            <span className="text-slate-400 uppercase font-bold block text-[10px]">Ngày xuất hóa đơn</span>
                            <div className="flex items-center gap-1 mt-0.5">
                                <Calendar size={13} className="text-indigo-600" />
                                <span className="font-black text-slate-800 text-sm">{exportDoc.exportDate}</span>
                            </div>
                        </div>
                        <div>
                            <span className="text-slate-400 uppercase font-bold block text-[10px]">Người làm / Người xuất</span>
                            <div className="flex items-center gap-1 mt-0.5">
                                <User size={13} className="text-indigo-600" />
                                <span className="font-black text-slate-800 text-sm truncate block">{exportDoc.creatorName || 'Admin'}</span>
                            </div>
                        </div>
                        <div>
                            <span className="text-slate-400 uppercase font-bold block text-[10px]">Khách hàng / Đơn vị nhận</span>
                            <span className="font-black text-slate-800 text-sm truncate block mt-0.5">{exportDoc.customerName || '---'}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 uppercase font-bold block text-[10px]">Tổng SL xuất HĐ</span>
                            <span className="font-black text-indigo-600 text-sm block mt-0.5">{formatNumber(exportDoc.totalQuantity)} cái/chiếc</span>
                        </div>
                    </div>

                    {exportDoc.notes && (
                        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-xl">
                            <span className="font-bold">Ghi chú: </span>{exportDoc.notes}
                        </div>
                    )}

                    <div>
                        <h4 className="text-xs font-black uppercase text-slate-600 mb-2">Danh sách sản phẩm trong phiếu xuất:</h4>
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                                    <tr>
                                        <th className="py-2.5 px-3">Sản phẩm</th>
                                        <th className="py-2.5 px-3 text-center">Số lượng xuất</th>
                                        <th className="py-2.5 px-3 text-right">Đơn giá HĐ</th>
                                        <th className="py-2.5 px-3 text-right">Thành tiền</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {exportDoc.items?.map((it, idx) => (
                                        <tr key={idx}>
                                            <td className="py-2.5 px-3 font-bold text-slate-800">{it.productName}</td>
                                            <td className="py-2.5 px-3 text-center font-black text-indigo-600">{it.quantity} cái/chiếc</td>
                                            <td className="py-2.5 px-3 text-right font-bold text-slate-700">
                                                {it.unitPrice ? `${formatNumber(it.unitPrice)} ₫` : '---'}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-black text-emerald-600">
                                                {it.unitPrice ? `${formatNumber(it.quantity * it.unitPrice)} ₫` : '---'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                    <button
                        onClick={() => {
                            onClose();
                            onEdit(exportDoc);
                        }}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs uppercase flex items-center gap-1.5 transition shadow-2xs"
                    >
                        <Edit3 size={15} />
                        Chỉnh Sửa Phiếu Xuất Này
                    </button>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase hover:bg-slate-900 transition"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportInvoiceDetailModal;
