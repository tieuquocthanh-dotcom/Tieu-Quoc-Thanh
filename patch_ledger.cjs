const fs = require('fs');
const file = 'components/InventoryLedger.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Initial State
content = content.replace(
    "const [dateRange, setDateRange] = useState({ start: '', end: '' });",
    `const [dateRange, setDateRange] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return { start: d.toISOString().split('T')[0], end: '' };
    });
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('all');
    const [warehouses, setWarehouses] = useState<any[]>([]);`
);

// 2. Fetch Warehouses
content = content.replace(
    /const unsubProducts = onSnapshot\(query\(collection\(db, 'products'\), orderBy\('name'\)\), \(snap\) => \{\s*setProducts\(snap\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \} as Product\)\)\);\s*\}\);\s*return \(\) => unsubProducts\(\);/,
    `const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snap) => {
            setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        });
        const unsubWarehouses = onSnapshot(query(collection(db, 'warehouses'), orderBy('name')), (snap) => {
            setWarehouses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => {
            unsubProducts();
            unsubWarehouses();
        };`
);

fs.writeFileSync(file, content);
console.log('Patch 1 applied');
