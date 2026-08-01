const fs = require('fs');
const file = 'components/SaleEditModal.tsx';
let code = fs.readFileSync(file, 'utf8');

const txnOld = `        if (isChangingPaymentMethod && oldData.amountPaid > 0 && oldAccSnap && oldAccSnap.exists()) {
            // Rút tiền khỏi tài khoản cũ
            const oldSnapBal = Number(oldAccSnap.data()?.balance) || 0;
            const finalOldBal = oldSnapBal - oldData.amountPaid;
            transaction.update(oldAccSnap.ref, { balance: finalOldBal });
            transaction.set(doc(collection(db, 'paymentLogs')), {
                paymentMethodId: oldData.paymentMethodId,
                paymentMethodName: oldData.paymentMethodName || 'N/A',
                type: 'withdrawal',
                amount: oldData.amountPaid,
                balanceAfter: finalOldBal,
                note: \`Hoàn tiền do đổi tài khoản thu cho đơn hàng #\${shortId}\`,
                relatedId: sale.id, relatedType: 'sale', createdAt: serverTimestamp(), creatorName: auth.currentUser?.displayName || 'Hệ thống'
            });
            
            // Nạp tiền vào tài khoản mới
            if (newAccSnap && newAccSnap.exists()) {
                const newSnapBal = Number(newAccSnap.data()?.balance) || 0;
                const finalNewBal = newSnapBal + oldData.amountPaid;
                transaction.update(newAccSnap.ref, { balance: finalNewBal });
                transaction.set(doc(collection(db, 'paymentLogs')), {
                    paymentMethodId: paymentMethodId,
                    paymentMethodName: paymentMethods.find(p => p.id === paymentMethodId)?.name || 'N/A',
                    type: 'deposit',
                    amount: oldData.amountPaid,
                    balanceAfter: finalNewBal,
                    note: \`Chuyển tiền thu vào tài khoản mới cho đơn hàng #\${shortId}\`,
                    relatedId: sale.id, relatedType: 'sale', createdAt: serverTimestamp(), creatorName: auth.currentUser?.displayName || 'Hệ thống'
                });
            }
        }

        // Fetch fresh new account snap if it was updated above (firestore transactions handle this seamlessly though, but to be safe we'll use the updated balance conceptually. Actually, transaction.update doesn't change newAccSnap, so we calculate delta)
        if (newAccSnap && newAccSnap.exists() && additionalPayment > 0) {
            // We need to calculate balance after potentially adding oldData.amountPaid
            let currentBalForNew = Number(newAccSnap.data()?.balance) || 0;
            if (isChangingPaymentMethod && oldData.amountPaid > 0) {
                currentBalForNew += oldData.amountPaid; 
            }
            const finalBalForNew = currentBalForNew + additionalPayment;
            
            transaction.update(newAccSnap.ref, { balance: finalBalForNew }); // Will overwrite the previous update if both happened, which is fine since it's the final expected balance
            transaction.set(doc(collection(db, 'paymentLogs')), {
                paymentMethodId: paymentMethodId,
                paymentMethodName: paymentMethods.find(p => p.id === paymentMethodId)?.name || 'N/A',
                type: 'deposit',
                amount: additionalPayment,
                balanceAfter: finalBalForNew,
                note: \`Thu tiền thêm cho đơn hàng #\${shortId}\`,
                relatedId: sale.id, relatedType: 'sale', createdAt: serverTimestamp(), creatorName: auth.currentUser?.displayName || 'Hệ thống'
            });
        }`;

const txnNew = `        if (isChangingPaymentMethod && oldData.amountPaid > 0 && oldAccSnap && oldAccSnap.exists()) {
            // Rút tiền khỏi tài khoản cũ
            const oldSnapBal = Number(oldAccSnap.data()?.balance) || 0;
            const finalOldBal = oldSnapBal - oldData.amountPaid;
            transaction.update(oldAccSnap.ref, { balance: finalOldBal });
            transaction.set(doc(collection(db, 'paymentLogs')), {
                paymentMethodId: oldData.paymentMethodId,
                paymentMethodName: oldData.paymentMethodName || 'N/A',
                type: 'withdrawal',
                amount: oldData.amountPaid,
                balanceAfter: finalOldBal,
                note: \`Hoàn tiền do đổi tài khoản thu cho đơn hàng #\${shortId}\`,
                relatedId: sale.id, relatedType: 'sale', createdAt: serverTimestamp(), creatorName: auth.currentUser?.displayName || 'Hệ thống'
            });
            
            // Nạp tiền vào tài khoản mới và log
            if (newAccSnap && newAccSnap.exists()) {
                const newSnapBal = Number(newAccSnap.data()?.balance) || 0;
                let finalNewBal = newSnapBal + oldData.amountPaid;
                
                transaction.set(doc(collection(db, 'paymentLogs')), {
                    paymentMethodId: paymentMethodId,
                    paymentMethodName: paymentMethods.find(p => p.id === paymentMethodId)?.name || 'N/A',
                    type: 'deposit',
                    amount: oldData.amountPaid,
                    balanceAfter: finalNewBal,
                    note: \`Chuyển tiền thu vào tài khoản mới cho đơn hàng #\${shortId}\`,
                    relatedId: sale.id, relatedType: 'sale', createdAt: serverTimestamp(), creatorName: auth.currentUser?.displayName || 'Hệ thống'
                });
                
                if (additionalPayment > 0) {
                    finalNewBal += additionalPayment;
                    transaction.set(doc(collection(db, 'paymentLogs')), {
                        paymentMethodId: paymentMethodId,
                        paymentMethodName: paymentMethods.find(p => p.id === paymentMethodId)?.name || 'N/A',
                        type: 'deposit',
                        amount: additionalPayment,
                        balanceAfter: finalNewBal,
                        note: \`Thu tiền thêm cho đơn hàng #\${shortId}\`,
                        relatedId: sale.id, relatedType: 'sale', createdAt: serverTimestamp(), creatorName: auth.currentUser?.displayName || 'Hệ thống'
                    });
                }
                
                // Chỉ update một lần cho newAccSnap
                transaction.update(newAccSnap.ref, { balance: finalNewBal });
            }
        } else {
            // Nếu không đổi tài khoản thu, chỉ xử lý thêm phần additionalPayment (nếu có)
            if (newAccSnap && newAccSnap.exists() && additionalPayment > 0) {
                const newSnapBal = Number(newAccSnap.data()?.balance) || 0;
                const finalBalForNew = newSnapBal + additionalPayment;
                transaction.update(newAccSnap.ref, { balance: finalBalForNew });
                transaction.set(doc(collection(db, 'paymentLogs')), {
                    paymentMethodId: paymentMethodId,
                    paymentMethodName: paymentMethods.find(p => p.id === paymentMethodId)?.name || 'N/A',
                    type: 'deposit',
                    amount: additionalPayment,
                    balanceAfter: finalBalForNew,
                    note: \`Thu tiền thêm cho đơn hàng #\${shortId}\`,
                    relatedId: sale.id, relatedType: 'sale', createdAt: serverTimestamp(), creatorName: auth.currentUser?.displayName || 'Hệ thống'
                });
            }
        }`;

code = code.replace(txnOld, txnNew);
fs.writeFileSync(file, code);
console.log('Done');
