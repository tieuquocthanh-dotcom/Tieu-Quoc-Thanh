const fs = require('fs');
let file = 'components/GoodsReceiptDetailModal.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
    /<th className="p-3 text-\[10px\] font-black uppercase text-slate-400">Ghi chú \/ Tài khoản<\/th>/,
    `<th className="p-3 text-[10px] font-black uppercase text-slate-400">Ghi chú / Tài khoản trả</th>\n                                <th className="p-3 text-[10px] font-black uppercase text-slate-400">Ngân hàng nhận</th>`
);

const bankDetailsRow = `
                                        <td className="p-3">
                                            {(payment as any).supplierBankDetails ? (
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 text-[10px]">{(payment as any).supplierBankDetails.bankName}</span>
                                                    <span className="text-[9px] text-slate-500 font-mono">{(payment as any).supplierBankDetails.accountNumber}</span>
                                                    <span className="text-[9px] font-black uppercase text-slate-400">{(payment as any).supplierBankDetails.accountName}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] italic text-slate-400">Không có</span>
                                            )}
                                        </td>
`;

c = c.replace(
    /<td className="p-3 text-\[11px\] font-black text-slate-800 uppercase">(\s*)\{payment\.note \|\| 'Thanh toán trực tiếp'\}(\s*)<\/td>/,
    `$&${bankDetailsRow}`
);

c = c.replace(
    /<td colSpan=\{3\}/,
    `<td colSpan={4}`
);

fs.writeFileSync(file, c);
