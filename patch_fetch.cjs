const fs = require('fs');
const file = 'components/InventoryLedger.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the query parts inside fetchData
content = content.replace(
    /let receiptQuery = query\(collection\(db, 'goodsReceipts'\), orderBy\('createdAt', 'desc'\), limit\(LIMIT\)\);/,
    `let constraints: any[] = [orderBy('createdAt', 'desc')];
                if (dateRange.start) {
                    const startDate = new Date(dateRange.start);
                    startDate.setHours(0, 0, 0, 0);
                    constraints.push(where('createdAt', '>=', startDate));
                }
                if (dateRange.end && selectedProductId === 'all') {
                    const endDate = new Date(dateRange.end);
                    endDate.setHours(23, 59, 59, 999);
                    constraints.push(where('createdAt', '<=', endDate));
                }
                constraints.push(limit(3000));
                
                let receiptQuery = query(collection(db, 'goodsReceipts'), ...constraints);`
);

content = content.replace(
    /let saleQuery = query\(collection\(db, 'sales'\), orderBy\('createdAt', 'desc'\), limit\(LIMIT\)\);/,
    `let saleQuery = query(collection(db, 'sales'), ...constraints);`
);

content = content.replace(
    /let transferQuery = query\(collection\(db, 'warehouseTransfers'\), orderBy\('createdAt', 'desc'\), limit\(LIMIT\)\);/,
    `let transferQuery = query(collection(db, 'warehouseTransfers'), ...constraints);`
);

content = content.replace(
    /let adjustmentQuery = query\(collection\(db, 'inventoryAdjustments'\), orderBy\('createdAt', 'desc'\), limit\(LIMIT\)\);/,
    `let adjustmentQuery = query(collection(db, 'inventoryAdjustments'), ...constraints);`
);

// Add dependencies
content = content.replace(
    /fetchData\(\);\s*\}, \[selectedProductId\]\);/,
    `fetchData();
    }, [selectedProductId, dateRange.start, dateRange.end, selectedWarehouseId]);`
);

// Add local filter for selectedWarehouseId
content = content.replace(
    /return matchesSearch && matchesDate;/,
    `let matchesWarehouse = true;
            if (selectedWarehouseId !== 'all') {
                matchesWarehouse = m.warehouseId === selectedWarehouseId;
            }
            return matchesSearch && matchesDate && matchesWarehouse;`
);

// Also need to adjust the UI to include the warehouse dropdown
// We will insert it before the product dropdown
content = content.replace(
    /<select\s*value=\{selectedProductId\}/,
    `<select 
                        value={selectedWarehouseId}
                        onChange={e => setSelectedWarehouseId(e.target.value)}
                        className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm font-bold bg-white"
                    >
                        <option value="all">Tất cả các kho</option>
                        {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                    <select
                        value={selectedProductId}`
);

fs.writeFileSync(file, content);
console.log('Patch 2 applied');
