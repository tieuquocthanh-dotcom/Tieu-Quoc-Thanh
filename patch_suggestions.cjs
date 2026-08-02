const fs = require('fs');
const file = 'components/CreateGoodsReceipt.tsx';
let code = fs.readFileSync(file, 'utf8');

const importRegex = /import\s+{[^}]+}\s+from\s+'lucide-react';/;
code = code.replace(importRegex, (match) => {
    if (!match.includes('Sparkles')) {
        return match.replace('}', ', Sparkles }');
    }
    return match;
});

const oldProductsLogic = `  const filteredProducts = useMemo(() => products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())), [products, searchTerm]);
  const paginatedProducts = useMemo(() => filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredProducts, currentPage, pageSize]);`;

const newProductsLogic = `  const filteredProducts = useMemo(() => products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())), [products, searchTerm]);
  const paginatedProducts = useMemo(() => filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredProducts, currentPage, pageSize]);

  const suggestedProducts = useMemo(() => {
      if (!selectedSupplierId) return [];
      const supplierProducts = products.filter(p => p.id in supplierPriceHistory);
      return supplierProducts.sort((a, b) => {
          const invA = Object.values(detailedInventory[a.id] || {}).reduce((s, v) => s + v, 0);
          const invB = Object.values(detailedInventory[b.id] || {}).reduce((s, v) => s + v, 0);
          return invA - invB;
      }).slice(0, 10);
  }, [selectedSupplierId, products, supplierPriceHistory, detailedInventory]);`;

code = code.replace(oldProductsLogic, newProductsLogic);

const oldUI = `                            )}
                        </div>
                        <div className={\`grid gap-2 content-start \${isFullscreen ? 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'}\`}>{loading ? <div className="col-span-full flex items-center justify-center h-40"><Loader className="animate-spin text-primary" size={32}/></div> : paginatedProducts.map(p => (<ImportProductCard key={p.id} product={p} lastSupplierPrice={supplierPriceHistory[p.id]} detailedInventory={detailedInventory} warehouses={warehouses} onAdd={addToReceipt} onUpdateImportPrice={handleUpdateProductImportPrice} onCompare={(prod) => { setSelectedPriceComparisonProduct(prod); setIsPriceComparisonOpen(true); }} onTrace={(prod) => { setSelectedLedgerProductId(prod.id); setIsLedgerModalOpen(true); }} userRole={userRole} />)) }</div>`;

const newUI = `                            )}
                        </div>
                        {suggestedProducts.length > 0 && !searchTerm && (
                            <div className="mb-2">
                                <div className="text-[10px] font-black text-slate-500 uppercase mb-1.5 flex items-center"><Sparkles size={12} className="mr-1 text-yellow-500"/> Gợi ý mặt hàng nên nhập từ NCC này (tồn kho thấp)</div>
                                <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
                                    {suggestedProducts.map(sp => {
                                        const stock = Object.values(detailedInventory[sp.id] || {}).reduce((s, v) => s + v, 0);
                                        return (
                                        <button 
                                            key={sp.id} 
                                            onClick={() => addToReceipt(sp, 1, supplierPriceHistory[sp.id] || sp.importPrice)}
                                            className="px-3 py-1.5 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg whitespace-nowrap font-black text-[11px] hover:bg-yellow-100 flex flex-col items-start transition-colors"
                                        >
                                            <span className="flex items-center"><Plus size={12} className="mr-1 opacity-50"/> {sp.name}</span>
                                            <span className="text-[9px] opacity-70 mt-0.5">Tồn: {stock} | Lần trước: {new Intl.NumberFormat('vi-VN').format(supplierPriceHistory[sp.id] || sp.importPrice)}</span>
                                        </button>
                                    )})}
                                </div>
                            </div>
                        )}
                        <div className={\`grid gap-2 content-start \${isFullscreen ? 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'}\`}>{loading ? <div className="col-span-full flex items-center justify-center h-40"><Loader className="animate-spin text-primary" size={32}/></div> : paginatedProducts.map(p => (<ImportProductCard key={p.id} product={p} lastSupplierPrice={supplierPriceHistory[p.id]} detailedInventory={detailedInventory} warehouses={warehouses} onAdd={addToReceipt} onUpdateImportPrice={handleUpdateProductImportPrice} onCompare={(prod) => { setSelectedPriceComparisonProduct(prod); setIsPriceComparisonOpen(true); }} onTrace={(prod) => { setSelectedLedgerProductId(prod.id); setIsLedgerModalOpen(true); }} userRole={userRole} />)) }</div>`;

code = code.replace(oldUI, newUI);

fs.writeFileSync(file, code);
console.log('Done');
