const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

const hookStart = `        let unsubProducts: () => void;
        let unsubInventory: () => void;
        let unsubSales: () => void;`;

const newHookStart = `        let unsubProducts: () => void;
        let unsubInventory: () => void;
        let unsubSales: () => void;
        let unsubSuppliers: () => void;
        let unsubReceipts: () => void;`;

code = code.replace(hookStart, newHookStart);

const fetchEnd = `            unsubInventory = onSnapshot(query(collectionGroup(db, 'inventory')), (snapshot) => {`;
const newFetchEnd = `            unsubSuppliers = onSnapshot(query(collection(db, 'suppliers')), (snapshot) => {
                setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
            });

            unsubReceipts = onSnapshot(query(collection(db, 'goodsReceipts')), (snapshot) => {
                const spMap: {[supplierId: string]: Set<string>} = {};
                snapshot.forEach(doc => {
                    const data = doc.data() as GoodsReceipt;
                    if (data.supplierId && data.items) {
                        if (!spMap[data.supplierId]) spMap[data.supplierId] = new Set();
                        data.items.forEach(item => {
                            if (item.productId) spMap[data.supplierId].add(item.productId);
                        });
                    }
                });
                setSupplierProductsMap(spMap);
            });

            unsubInventory = onSnapshot(query(collectionGroup(db, 'inventory')), (snapshot) => {`;

code = code.replace(fetchEnd, newFetchEnd);

const hookCleanup = `        return () => {
            if (unsubProducts) unsubProducts();
            if (unsubInventory) unsubInventory();
            if (unsubSales) unsubSales();
        };`;

const newHookCleanup = `        return () => {
            if (unsubProducts) unsubProducts();
            if (unsubInventory) unsubInventory();
            if (unsubSales) unsubSales();
            if (unsubSuppliers) unsubSuppliers();
            if (unsubReceipts) unsubReceipts();
        };`;

code = code.replace(hookCleanup, newHookCleanup);

fs.writeFileSync(file, code);
console.log('Done fetch');
