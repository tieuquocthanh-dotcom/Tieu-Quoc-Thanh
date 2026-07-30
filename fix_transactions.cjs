const fs = require('fs');
const file = 'components/DebtManagement.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldCode1 = `                let finalBankDetails = null;
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

                const accSnap = await transaction.get(accRef);
                if (!accSnap.exists()) throw "Account not found";`;

const newCode1 = `                const accSnap = await transaction.get(accRef);
                if (!accSnap.exists()) throw "Account not found";

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
                }`;

code = code.replace(oldCode1, newCode1);

const oldCode2 = `                                let finalBankDetails = null;
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
                const accSnap = await transaction.get(accRef);
                if (!accSnap.exists()) throw "Account not found";`;

const newCode2 = `                const accRef = doc(db, 'paymentMethods', paymentMethodId);
                const accSnap = await transaction.get(accRef);
                if (!accSnap.exists()) throw "Account not found";

                let finalBankDetails = null;
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
                }`;

code = code.replace(oldCode2, newCode2);

fs.writeFileSync(file, code);
console.log('Done');
