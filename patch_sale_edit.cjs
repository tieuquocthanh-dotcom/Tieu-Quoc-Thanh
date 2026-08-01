const fs = require('fs');
const file = 'components/SaleEditModal.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Modify the validation:
const valOld = `    if (additionalPayment > 0 && !paymentMethodId) {
      alert("Vui lòng chọn tài khoản thu tiền cho phần thanh toán thêm.");
      return;
    }`;
const valNew = `    if ((additionalPayment > 0 || sale?.amountPaid > 0) && !paymentMethodId) {
      alert("Vui lòng chọn tài khoản thu tiền.");
      return;
    }`;
code = code.replace(valOld, valNew);

// 2. Modify transaction logic to handle payment method changes:
const txnOld = `        let newAccSnap = null;
        if (additionalPayment > 0 && paymentMethodId) {
            newAccSnap = await transaction.get(doc(db, 'paymentMethods', paymentMethodId));
        }`;
const txnNew = `        let newAccSnap = null;
        let oldAccSnap = null;
        
        if (paymentMethodId) {
            newAccSnap = await transaction.get(doc(db, 'paymentMethods', paymentMethodId));
        }
        
        const isChangingPaymentMethod = oldData.paymentMethodId && paymentMethodId && oldData.paymentMethodId !== paymentMethodId;
        if (isChangingPaymentMethod && oldData.amountPaid > 0) {
            oldAccSnap = await transaction.get(doc(db, 'paymentMethods', oldData.paymentMethodId));
        }`;
code = code.replace(txnOld, txnNew);

const balOld = `        if (newAccSnap && additionalPayment > 0) {
            const snapBal = Number(newAccSnap.data()?.balance) || 0;
            const finalBal = snapBal + additionalPayment;
            transaction.update(newAccSnap.ref, { balance: finalBal });
            transaction.set(doc(collection(db, 'paymentLogs')), {
                paymentMethodId: paymentMethodId,
                paymentMethodName: paymentMethods.find(p => p.id === paymentMethodId)?.name || 'N/A',
                type: 'deposit',
                amount: additionalPayment,
                balanceAfter: finalBal,
                note: \`Thu tiền thêm cho đơn hàng #\${shortId}\`,
                relatedId: sale.id, relatedType: 'sale', createdAt: serverTimestamp(), creatorName: auth.currentUser?.displayName || 'Hệ thống'
            });
        }`;

const balNew = `        if (isChangingPaymentMethod && oldData.amountPaid > 0 && oldAccSnap && oldAccSnap.exists()) {
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
code = code.replace(balOld, balNew);

const oldHist = `        if (additionalPayment > 0) {
             newPaymentHistory = [...newPaymentHistory, {
                 date: Timestamp.now(),
                 amount: additionalPayment,
                 note: \`Thu tiền thêm qua \${selectedMethod?.name || 'N/A'} khi sửa đơn\`
             }];
        }`;
const newHist = `        if (isChangingPaymentMethod && oldData.amountPaid > 0) {
             newPaymentHistory = [...newPaymentHistory, {
                 date: Timestamp.now(),
                 amount: 0,
                 note: \`Đổi tài khoản thu từ \${oldData.paymentMethodName || 'N/A'} sang \${selectedMethod?.name || 'N/A'}\`
             }];
        }
        if (additionalPayment > 0) {
             newPaymentHistory = [...newPaymentHistory, {
                 date: Timestamp.now(),
                 amount: additionalPayment,
                 note: \`Thu tiền thêm qua \${selectedMethod?.name || 'N/A'} khi sửa đơn\`
             }];
        }`;
code = code.replace(oldHist, newHist);

const updOld = `          paymentMethodId: oldData.paymentMethodId || (additionalPayment > 0 ? paymentMethodId : null),
          paymentMethodName: oldData.paymentMethodName || (additionalPayment > 0 ? (selectedMethod?.name || null) : null),`;
const updNew = `          paymentMethodId: paymentMethodId || oldData.paymentMethodId || null,
          paymentMethodName: selectedMethod ? selectedMethod.name : (oldData.paymentMethodName || null),`;
code = code.replace(updOld, updNew);

// 3. UI logic
const uiOld = `                    {(newTotal - (sale?.amountPaid || 0)) > 0 && (
                        <>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Thanh toán thêm</label>
                                <div className="flex space-x-2">
                                    <div className="flex-1">
                                        <NumericInput value={additionalPayment} onChange={setAdditionalPayment} className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-right font-black text-sm outline-none text-slate-900 bg-white shadow-sm" />
                                    </div>
                                    <div className="flex-1">
                                        <select value={paymentMethodId} onChange={e => setPaymentMethodId(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none text-slate-900 bg-white shadow-sm h-[40px]">
                                            <option value="">-- CHỌN TÀI KHOẢN --</option>
                                            {paymentMethods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            {additionalPayment > 0 && !paymentMethodId && (
                                <p className="text-red-500 text-xs mt-1 font-bold">Vui lòng chọn tài khoản thu tiền cho phần thanh toán thêm.</p>
                            )}
                        </>
                    )}`;
const uiNew = `                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Tài khoản thu tiền</label>
                        <select value={paymentMethodId} onChange={e => setPaymentMethodId(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none text-slate-900 bg-white shadow-sm h-[40px] mb-3">
                            <option value="">-- CHỌN TÀI KHOẢN --</option>
                            {paymentMethods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    {(newTotal - (sale?.amountPaid || 0)) > 0 && (
                        <>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Thanh toán thêm</label>
                                <div className="flex space-x-2">
                                    <div className="flex-1">
                                        <NumericInput value={additionalPayment} onChange={setAdditionalPayment} className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-right font-black text-sm outline-none text-slate-900 bg-white shadow-sm" />
                                    </div>
                                </div>
                            </div>
                            {additionalPayment > 0 && !paymentMethodId && (
                                <p className="text-red-500 text-xs mt-1 font-bold">Vui lòng chọn tài khoản thu tiền cho phần thanh toán thêm.</p>
                            )}
                        </>
                    )}`;
code = code.replace(uiOld, uiNew);

fs.writeFileSync(file, code);
console.log('Done');
