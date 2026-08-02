const fs = require('fs');
const file = 'components/CreateGoodsReceipt.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldFilter = `suppliers.filter(s => s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase()))`;
const newFilter = `suppliers.filter(s => {
    const term = (supplierSearchTerm || '').toLowerCase();
    return (s.name || '').toLowerCase().includes(term) || (s.phone || '').includes(term);
})`;

code = code.replace(oldFilter, newFilter);
fs.writeFileSync(file, code);
console.log('Done');
