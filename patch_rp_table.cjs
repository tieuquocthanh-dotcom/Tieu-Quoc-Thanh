const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

const thOld = `<tr className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                <th className="px-4 py-3">Sản phẩm</th>`;

const thNew = `<tr className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                {selectedSupplier !== 'all' && (
                                    <th className="px-4 py-3 w-10 text-center">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                            checked={paginated.length > 0 && paginated.every(p => !!selectedItems[p.id])}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setSelectedItems(prev => {
                                                    const next = { ...prev };
                                                    paginated.forEach(p => {
                                                        if (checked) {
                                                            next[p.id] = p.suggestedRestockQty > 0 ? p.suggestedRestockQty : 1;
                                                        } else {
                                                            delete next[p.id];
                                                        }
                                                    });
                                                    return next;
                                                });
                                            }}
                                        />
                                    </th>
                                )}
                                <th className="px-4 py-3">Sản phẩm</th>`;
code = code.replace(thOld, thNew);

const thEndOld = `<th className="px-4 py-3 text-right bg-primary/5 text-primary">Tiền Dự Kiến</th>
                            </tr>`;
const thEndNew = `<th className="px-4 py-3 text-right bg-primary/5 text-primary">Tiền Dự Kiến</th>
                                {selectedSupplier !== 'all' && (
                                    <th className="px-4 py-3 text-center bg-blue-50 text-blue-600">SL Đặt</th>
                                )}
                            </tr>`;
code = code.replace(thEndOld, thEndNew);

const trLoading = `<tr><td colSpan={8} className="p-8 text-center"><Loader className="animate-spin text-primary mx-auto" size={24}/></td></tr>`;
const trLoadingNew = `<tr><td colSpan={10} className="p-8 text-center"><Loader className="animate-spin text-primary mx-auto" size={24}/></td></tr>`;
code = code.replace(trLoading, trLoadingNew);

const trEmpty = `<tr><td colSpan={8} className="p-8 text-center text-slate-400 font-medium">Không tìm thấy sản phẩm nào.</td></tr>`;
const trEmptyNew = `<tr><td colSpan={10} className="p-8 text-center text-slate-400 font-medium">Không tìm thấy sản phẩm nào.</td></tr>`;
code = code.replace(trEmpty, trEmptyNew);

const tdStartOld = `<tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-4">`;
const tdStartNew = `<tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                            {selectedSupplier !== 'all' && (
                                                <td className="px-4 py-4 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                                        checked={!!selectedItems[p.id]}
                                                        onChange={(e) => handleToggleCheck(p, e.target.checked)}
                                                    />
                                                </td>
                                            )}
                                            <td className="px-4 py-4">`;
code = code.replace(tdStartOld, tdStartNew);

const tdEndOld = `                                            <td className="px-4 py-4 text-right bg-primary/5">
                                                {p.suggestedRestockQty > 0 ? (
                                                    <span className="font-black text-primary text-base">
                                                        {formatNumber(p.suggestedRestockQty * (p.importPrice || 0))}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-bold">-</span>
                                                )}
                                            </td>
                                        </tr>`;
const tdEndNew = `                                            <td className="px-4 py-4 text-right bg-primary/5">
                                                {p.suggestedRestockQty > 0 ? (
                                                    <span className="font-black text-primary text-base">
                                                        {formatNumber(p.suggestedRestockQty * (p.importPrice || 0))}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-bold">-</span>
                                                )}
                                            </td>
                                            {selectedSupplier !== 'all' && (
                                                <td className="px-4 py-4 text-center bg-blue-50/50">
                                                    <input 
                                                        type="number"
                                                        min="1"
                                                        value={selectedItems[p.id] || ''}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value);
                                                            if (!isNaN(val) && val > 0) {
                                                                handleQtyChange(p.id, val);
                                                            } else if (e.target.value === '') {
                                                                handleQtyChange(p.id, 0); // Allow temporary empty
                                                            }
                                                        }}
                                                        onBlur={(e) => {
                                                            if (!selectedItems[p.id]) {
                                                                // if empty on blur and checked, set to 1, or just remove?
                                                                // let's remove if 0
                                                                handleToggleCheck(p, false);
                                                            }
                                                        }}
                                                        disabled={!selectedItems[p.id] && selectedItems[p.id] !== 0}
                                                        className={\`w-20 px-2 py-1.5 text-center text-sm font-bold rounded-lg border \${selectedItems[p.id] !== undefined ? 'border-blue-300 focus:border-blue-500 bg-white' : 'border-transparent bg-transparent opacity-50'} outline-none transition-all\`}
                                                        placeholder="-"
                                                    />
                                                </td>
                                            )}
                                        </tr>`;
code = code.replace(tdEndOld, tdEndNew);

fs.writeFileSync(file, code);
console.log('Done table');
