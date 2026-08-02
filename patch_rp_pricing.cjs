const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add state for productPriceInfo
const stateStr = `const [supplierProductsMap, setSupplierProductsMap] = useState<{[supplierId: string]: Set<string>}>({});`;
const newStateStr = `const [supplierProductsMap, setSupplierProductsMap] = useState<{[supplierId: string]: Set<string>}>({});
    const [productPriceInfo, setProductPriceInfo] = useState<{[productId: string]: {
        lastPriceGlobal: number,
        lastDateGlobal: number,
        lastSupplierGlobal: string,
        supplierPrices: {[supplierId: string]: { price: number, date: number }}
    }}>({});`;
code = code.replace(stateStr, newStateStr);

// 2. Modify unsubReceipts
const unsubReceiptsStr = `            unsubReceipts = onSnapshot(query(collection(db, 'goodsReceipts')), (snapshot) => {
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
            });`;

const newUnsubReceiptsStr = `            unsubReceipts = onSnapshot(query(collection(db, 'goodsReceipts')), (snapshot) => {
                const spMap: {[supplierId: string]: Set<string>} = {};
                const priceInfo: {[productId: string]: {
                    lastPriceGlobal: number,
                    lastDateGlobal: number,
                    lastSupplierGlobal: string,
                    supplierPrices: {[supplierId: string]: { price: number, date: number }}
                }} = {};

                snapshot.forEach(doc => {
                    const data = doc.data() as GoodsReceipt;
                    const date = data.createdAt ? (data.createdAt as any).toMillis() : 0;
                    
                    if (data.supplierId && data.items) {
                        if (!spMap[data.supplierId]) spMap[data.supplierId] = new Set();
                        data.items.forEach(item => {
                            if (item.productId) {
                                spMap[data.supplierId].add(item.productId);
                                
                                if (!priceInfo[item.productId]) {
                                    priceInfo[item.productId] = {
                                        lastPriceGlobal: 0,
                                        lastDateGlobal: 0,
                                        lastSupplierGlobal: '',
                                        supplierPrices: {}
                                    };
                                }
                                
                                const pInfo = priceInfo[item.productId];
                                
                                // Update supplier specific last price
                                if (!pInfo.supplierPrices[data.supplierId] || pInfo.supplierPrices[data.supplierId].date < date) {
                                    pInfo.supplierPrices[data.supplierId] = { price: item.importPrice || 0, date };
                                }
                                
                                // Update global last price
                                if (date > pInfo.lastDateGlobal) {
                                    pInfo.lastPriceGlobal = item.importPrice || 0;
                                    pInfo.lastDateGlobal = date;
                                    pInfo.lastSupplierGlobal = data.supplierId;
                                }
                            }
                        });
                    }
                });
                setSupplierProductsMap(spMap);
                setProductPriceInfo(priceInfo);
            });`;
if (code.includes(unsubReceiptsStr)) {
    code = code.replace(unsubReceiptsStr, newUnsubReceiptsStr);
} else {
    console.log("Could not find unsubReceipts string");
}

// 3. Change th
const thStr = `<th className="px-4 py-3 text-right">Tổng Thực Còn<br/>(Tiền Hàng)</th>`;
const newThStr = `<th className="px-4 py-3 text-right">Giá nhập lần trước</th>`;
code = code.replace(thStr, newThStr);

// 4. Update the render loop
const renderStartStr = `                                paginated.map(p => {
                                    const statusInfo = getStatusInfo(p.status);`;

const newRenderStartStr = `                                paginated.map(p => {
                                    const statusInfo = getStatusInfo(p.status);
                                    
                                    const pInfo = productPriceInfo[p.id];
                                    let displayPrice = p.importPrice || 0;
                                    let comparisonNode = null;
                                    
                                    if (pInfo) {
                                        if (selectedSupplier !== 'all') {
                                            const supplierPrice = pInfo.supplierPrices[selectedSupplier]?.price;
                                            displayPrice = supplierPrice !== undefined ? supplierPrice : pInfo.lastPriceGlobal;
                                    
                                            let minOtherPrice = Infinity;
                                            let minOtherSupplierId = '';
                                            Object.entries(pInfo.supplierPrices).forEach(([suppId, data]) => {
                                                if (suppId !== selectedSupplier && data.price < minOtherPrice) {
                                                    minOtherPrice = data.price;
                                                    minOtherSupplierId = suppId;
                                                }
                                            });
                                    
                                            if (supplierPrice !== undefined && minOtherPrice !== Infinity) {
                                                if (supplierPrice > minOtherPrice) {
                                                    const diff = supplierPrice - minOtherPrice;
                                                    const minSupp = suppliers.find(s => s.id === minOtherSupplierId)?.name || 'Khác';
                                                    comparisonNode = (
                                                        <div className="text-[10px] font-bold text-red-500 mt-1 leading-tight">
                                                            Cao hơn {formatNumber(diff)} so với<br/>{minSupp}
                                                        </div>
                                                    );
                                                } else if (supplierPrice < minOtherPrice) {
                                                     const diff = minOtherPrice - supplierPrice;
                                                     comparisonNode = (
                                                         <div className="text-[10px] font-bold text-green-500 mt-1 leading-tight">
                                                             Rẻ hơn {formatNumber(diff)} so với NCC khác
                                                         </div>
                                                     );
                                                } else {
                                                     comparisonNode = (
                                                         <div className="text-[10px] font-bold text-slate-400 mt-1 leading-tight">
                                                             Giá ngang bằng các NCC khác
                                                         </div>
                                                     );
                                                }
                                            } else if (supplierPrice === undefined) {
                                                 comparisonNode = (
                                                     <div className="text-[10px] font-bold text-orange-500 mt-1 leading-tight">
                                                         Chưa từng nhập từ NCC này
                                                     </div>
                                                 );
                                            }
                                        } else {
                                            displayPrice = pInfo.lastPriceGlobal || displayPrice;
                                            const lastSupplierName = suppliers.find(s => s.id === pInfo.lastSupplierGlobal)?.name;
                                            comparisonNode = lastSupplierName ? (
                                                <div className="text-[10px] font-bold text-slate-400 mt-1 leading-tight">
                                                    Từ: {lastSupplierName}
                                                </div>
                                            ) : null;
                                        }
                                    }`;

if (code.includes(renderStartStr)) {
    code = code.replace(renderStartStr, newRenderStartStr);
} else {
    console.log("Could not find renderStart string");
}

const tdStr = `                                            <td className="px-4 py-4 text-right">
                                                <span className="font-black text-slate-700">
                                                    {formatNumber(p.totalStock * (p.importPrice || 0))}
                                                </span>
                                            </td>`;

const newTdStr = `                                            <td className="px-4 py-4 text-right">
                                                <div className="font-black text-slate-700">
                                                    {formatNumber(displayPrice)}
                                                </div>
                                                {comparisonNode}
                                            </td>`;

if (code.includes(tdStr)) {
    code = code.replace(tdStr, newTdStr);
} else {
    console.log("Could not find td string");
}

fs.writeFileSync(file, code);
console.log('Done pricing');
