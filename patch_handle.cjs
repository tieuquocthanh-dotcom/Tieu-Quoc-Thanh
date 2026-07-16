const fs = require('fs');
let file = 'components/DebtManagement.tsx';
let c = fs.readFileSync(file, 'utf8');

const bankHandlingStr = `
                let finalBankDetails = null;
                let finalBankAccountId = null;
                if (!isSale && bankDetails) {
                    const supplierRef = doc(db, 'suppliers', (item as any).supplierId);
                    const supplierSnap = await transaction.get(supplierRef);
                    if (supplierSnap.exists()) {
                        let supplierData = supplierSnap.data();
                        let accounts = supplierData.bankAccounts || [];
                        if (bankDetails.isNew) {
                            const newId = Date.now().toString();
                            const newAccount = {
                                id: newId,
                                bankName: bankDetails.bankName,
                                accountNumber: bankDetails.accountNumber,
                                accountName: bankDetails.accountName
                            };
                            accounts.push(newAccount);
                            transaction.update(supplierRef, { bankAccounts: accounts });
                            finalBankAccountId = newId;
                            finalBankDetails = newAccount;
                        } else {
                            finalBankAccountId = bankDetails.id;
                            finalBankDetails = accounts.find((a: any) => a.id === bankDetails.id) || null;
                        }
                    }
                }
`;

c = c.replace(
    /const accSnap = await transaction\.get\(accRef\);/,
    `${bankHandlingStr}\n                const accSnap = await transaction.get(accRef);`
);

const arrayUnionInsertStr = `
                        date: ts, 
                        amount: amount, 
                        note: note || (isSale ? 'Khách trả nợ' : 'Trả nợ NCC'),
                        paymentMethodId: paymentMethodId,
                        paymentMethodName: method?.name || 'N/A',
                        supplierBankAccountId: finalBankAccountId || null,
                        supplierBankDetails: finalBankDetails || null
`;

c = c.replace(
    /date: ts,\s*amount: amount,\s*note: note \|\| \(isSale \? 'Khách trả nợ' : 'Trả nợ NCC'\),\s*paymentMethodId: paymentMethodId,\s*paymentMethodName: method\?\.name \|\| 'N\/A'/g,
    arrayUnionInsertStr
);

// We need to also add it to paymentLogs, but the replacement string will be a bit different. Let's do it manually.
fs.writeFileSync(file, c);
