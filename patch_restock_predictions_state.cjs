const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

const stateStart = `    const [loading, setLoading] = useState(true);`;
const newState = `    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [supplierProductsMap, setSupplierProductsMap] = useState<{[supplierId: string]: Set<string>}>({});
    const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
    const [loading, setLoading] = useState(true);`;
code = code.replace(stateStart, newState);

fs.writeFileSync(file, code);
console.log('Done state');
