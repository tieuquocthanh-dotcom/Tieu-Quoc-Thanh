const fs = require('fs');
let file = 'components/DebtManagement.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
    /const handleConfirmPayment = async \(dateString: string, amount: number, note: string, paymentMethodId: string\) => \{/,
    "const handleConfirmPayment = async (dateString: string, amount: number, note: string, paymentMethodId: string, bankDetails?: any) => {"
);

c = c.replace(
    /const handleConfirmBulkPayment = async \(dateString: string, amount: number, note: string, paymentMethodId: string\) => \{/,
    "const handleConfirmBulkPayment = async (dateString: string, amount: number, note: string, paymentMethodId: string, bankDetails?: any) => {"
);

fs.writeFileSync(file, c);
