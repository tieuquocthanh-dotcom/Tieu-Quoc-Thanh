const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('Supplier, GoodsReceipt')) {
    code = code.replace("import { Product, Manufacturer, Sale } from '../types';", "import { Product, Manufacturer, Sale, Supplier, GoodsReceipt } from '../types';");
}
fs.writeFileSync(file, code);
console.log('Done deps');
