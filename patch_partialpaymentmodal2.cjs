const fs = require('fs');
let file = 'components/DebtManagement.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /supplier=\{paymentItem\?.type === 'receipt' \? suppliers\.find\(s => s\.id === \(paymentItem\.item as import\('\.\.\/types'\)\.GoodsReceipt\)\.supplierId\) : undefined\}/;

const replacement = `supplier={paymentItem?.type === 'receipt' ? suppliers.find(s => s.id === (paymentItem.item as any).supplierId) : undefined}`;

if (content.match(regex)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content);
} else {
    console.log("NOT FOUND");
}
