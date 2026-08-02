const fs = require('fs');
const file = 'components/SalesTerminal.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldFilter = `customers.filter(c => (c.name || '').toLowerCase().includes((customerSearchTerm || '').toLowerCase()))`;
const newFilter = `customers.filter(c => {
    const term = (customerSearchTerm || '').toLowerCase();
    return (c.name || '').toLowerCase().includes(term) || (c.phone || '').includes(term);
})`;

code = code.replace(oldFilter, newFilter);

fs.writeFileSync(file, code);
console.log('Done');
