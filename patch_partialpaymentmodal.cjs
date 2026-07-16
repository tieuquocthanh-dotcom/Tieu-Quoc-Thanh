const fs = require('fs');
let file = 'components/DebtManagement.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<PartialPaymentModal\s+isOpen=\{isPaymentModalOpen\}\s+onClose=\{[^}]+\}\s+onConfirm=\{handleConfirmPayment\}\s+data=\{paymentItem\}\s+isProcessing=\{isProcessingPayment\}\s+paymentMethods=\{paymentMethods\}\s*\/>/m;

const replacement = `<PartialPaymentModal 
                isOpen={isPaymentModalOpen} 
                onClose={() => setIsPaymentModalOpen(false)} 
                onConfirm={handleConfirmPayment} 
                data={paymentItem} 
                isProcessing={isProcessingPayment}
                paymentMethods={paymentMethods}
                supplier={paymentItem?.type === 'receipt' ? suppliers.find(s => s.id === (paymentItem.item as import('../types').GoodsReceipt).supplierId) : undefined}
            />`;

if (content.match(regex)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content);
} else {
    console.log("NOT FOUND");
}
