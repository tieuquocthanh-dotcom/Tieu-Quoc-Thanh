const fs = require('fs');
let file = 'components/DebtManagement.tsx';
let c = fs.readFileSync(file, 'utf8');

const replacement = `                let finalBankDetails = null;
                let finalBankAccountId = null;
                if (!isReceivable && bankDetails) {
                    const firstItem = selectedItemsData.items[0];
                    if (firstItem) {
                        const supplierRef = doc(db, 'suppliers', (firstItem as any).supplierId);
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
                }

                const accRef = doc(db, 'paymentMethods', paymentMethodId);
                const accSnap = await transaction.get(accRef);`;

c = c.replace(
    /const accRef = doc\(db, 'paymentMethods', paymentMethodId\);\s*const accSnap = await transaction\.get\(accRef\);/,
    replacement
);

const arrayUnionReplaceBulk = `                            date: ts, 
                            amount: paymentForThisItem, 
                            note: note,
                            paymentMethodId: paymentMethodId,
                            paymentMethodName: method?.name || 'N/A',
                            supplierBankAccountId: finalBankAccountId || null,
                            supplierBankDetails: finalBankDetails || null`;

c = c.replace(
    /date: ts,\s*amount: paymentForThisItem,\s*note: note,\s*paymentMethodId: paymentMethodId,\s*paymentMethodName: method\?\.name \|\| 'N\/A'/g,
    arrayUnionReplaceBulk
);

// update logging for both!
// handleConfirmPayment
c = c.replace(
    /creatorName: auth\.currentUser\?\.displayName \|\| auth\.currentUser\?\.email \|\| 'N\/A'/g,
    `creatorName: auth.currentUser?.displayName || auth.currentUser?.email || 'N/A',\n                    supplierBankAccountId: finalBankAccountId || null,\n                    supplierBankDetails: finalBankDetails || null`
);


fs.writeFileSync(file, c);
