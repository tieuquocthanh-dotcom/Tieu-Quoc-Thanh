const fs = require('fs');
let file = 'components/SupplierPaymentHistory.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
    /creatorName: string;/,
    `creatorName: string;\n    supplierBankAccountId?: string;\n    supplierBankDetails?: {\n        bankName: string;\n        accountNumber: string;\n        accountName: string;\n    };`
);

c = c.replace(
    /<th className="px-4 py-3">Tài khoản<\/th>/,
    `<th className="px-4 py-3">Tài khoản trả</th>\n                                <th className="px-4 py-3">Ngân hàng nhận</th>`
);

const renderBankDetails = `
                                        <td className="px-4 py-4">
                                            {log.supplierBankDetails ? (
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 text-xs">{log.supplierBankDetails.bankName}</span>
                                                    <span className="text-[10px] text-slate-500 font-mono">{log.supplierBankDetails.accountNumber}</span>
                                                    <span className="text-[10px] font-black uppercase text-slate-400">{log.supplierBankDetails.accountName}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] italic text-slate-400">Không có</span>
                                            )}
                                        </td>
`;

c = c.replace(
    /(\s*)<td className="px-4 py-4">(\s*)<span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-\[10px\] font-black uppercase text-slate-600">(\s*)<CreditCard size=\{12\} className="mr-1"\/> \{log\.paymentMethodName \|\| 'Không xác định'\}(\s*)<\/span>(\s*)<\/td>/,
    `$&${renderBankDetails}`
);

fs.writeFileSync(file, c);
