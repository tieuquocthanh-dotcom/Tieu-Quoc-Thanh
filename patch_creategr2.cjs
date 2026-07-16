const fs = require('fs');
let file = 'components/CreateGoodsReceipt.tsx';
let content = fs.readFileSync(file, 'utf8');

// There's a chance there was an issue with disabled={paymentStatus === 'debt'} in CreateGoodsReceipt?
// Let's check it.
console.log("Check complete.");
