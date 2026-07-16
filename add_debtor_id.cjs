const fs = require('fs');
let file = 'components/DebtManagement.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
    /let debtorName = '';/,
    "let debtorName = '';\n        let debtorId = '';"
);

c = c.replace(
    /if \(!debtorName\) debtorName = anyItem\.customerName \|\| anyItem\.supplierName;/,
    "if (!debtorName) { debtorName = anyItem.customerName || anyItem.supplierName; debtorId = anyItem.customerId || anyItem.supplierId; }"
);

c = c.replace(
    /return \{ items: list, total, debtorName, count: list\.length \};/,
    "return { items: list, total, debtorName, debtorId, count: list.length };"
);

c = c.replace(
    /<PayBulkModal\s*isOpen=\{isPayBulkModalOpen\}/,
    "<PayBulkModal \n                supplier={activeTab === 'payables' ? suppliers.find(s => s.id === selectedItemsData.debtorId) : undefined}\n                isOpen={isPayBulkModalOpen}"
);

c = c.replace(
    /<PartialPaymentModal\s*isOpen=\{paymentItem !== null\}/,
    "<PartialPaymentModal \n                supplier={paymentItem?.type === 'receipt' ? suppliers.find(s => s.id === (paymentItem.item as GoodsReceipt).supplierId) : undefined}\n                isOpen={paymentItem !== null}"
);

fs.writeFileSync(file, c);
