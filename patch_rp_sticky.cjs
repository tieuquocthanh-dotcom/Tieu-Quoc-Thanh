const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

const divOld = `<div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-4">`;
const divNew = `<div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-4 sticky top-0 z-30 shadow-sm">`;

code = code.replace(divOld, divNew);

const btnOld = `                        </select>
                    </div>
                </div>`;
const btnNew = `                        </select>
                    </div>
                    {selectedSupplier !== 'all' && (
                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-500">
                                Đã chọn: {Object.keys(selectedItems).length}
                            </span>
                            <button
                                onClick={handleCreatePlannedOrder}
                                disabled={isOrdering || Object.keys(selectedItems).length === 0}
                                className="px-4 py-2 bg-primary text-white rounded-xl font-bold flex items-center hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                                {isOrdering ? <Loader className="animate-spin mr-2" size={16}/> : <ShoppingCart className="mr-2" size={16}/>}
                                Đặt hàng
                            </button>
                        </div>
                    )}
                </div>`;

code = code.replace(btnOld, btnNew);
fs.writeFileSync(file, code);
console.log('Done sticky');
