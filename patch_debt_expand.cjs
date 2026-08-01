const fs = require('fs');
const file = 'components/DebtManagement.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add state for expanded rows
const stateStr = `    const [currentPage, setCurrentPage] = useState(1);`;
const newStateStr = `    const [currentPage, setCurrentPage] = useState(1);
    const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

    const toggleRowExpansion = (id: string) => {
        setExpandedRowIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };`;
code = code.replace(stateStr, newStateStr);

// 2. Add an expand button column to the table header
const thOld = `<th className="px-4 py-3 w-10"></th>
                                            <th className="px-4 py-3">Mã phiếu</th>`;
const thNew = `<th className="px-4 py-3 w-10"></th>
                                            <th className="px-4 py-3 w-10"></th>
                                            <th className="px-4 py-3">Mã phiếu</th>`;
code = code.replace(thOld, thNew);

// 3. Add expand toggle button to the row, and render an expanded row
const rowOld = `                                            const isSelected = selectedIds.has(item.id);
                                            return (
                                                <tr key={item.id} className={\`hover:bg-slate-50 transition-colors \${isSelected ? 'bg-blue-50/50' : ''}\`}>
                                                    <td className="px-4 py-3">
                                                        <button onClick={() => toggleSelection(item.id)} className="hover:scale-110 transition-transform">
                                                            {isSelected ? <CheckSquare size={20} className="text-primary"/> : <Square size={20} className="text-slate-300"/>}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-black uppercase">#{item.id.substring(0, 8)}</td>`;

const rowNew = `                                            const isSelected = selectedIds.has(item.id);
                                            const isExpanded = expandedRowIds.has(item.id);
                                            return (
                                                <React.Fragment key={item.id}>
                                                    <tr className={\`hover:bg-slate-50 transition-colors \${isSelected ? 'bg-blue-50/50' : ''}\`}>
                                                        <td className="px-4 py-3">
                                                            <button onClick={() => toggleSelection(item.id)} className="hover:scale-110 transition-transform">
                                                                {isSelected ? <CheckSquare size={20} className="text-primary"/> : <Square size={20} className="text-slate-300"/>}
                                                            </button>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <button onClick={() => toggleRowExpansion(item.id)} className="text-slate-400 hover:text-black transition">
                                                                {isExpanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                                                            </button>
                                                        </td>
                                                        <td className="px-4 py-3 font-bold text-black uppercase">#{item.id.substring(0, 8)}</td>`;
code = code.replace(rowOld, rowNew);

// 4. Close the React.Fragment and add the expanded row content
const rowEndOld = `                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}`;
const rowEndNew = `                                                        </div>
                                                    </td>
                                                </tr>
                                                {isExpanded && item.items && (
                                                    <tr className="bg-slate-50">
                                                        <td colSpan={8} className="p-0">
                                                            <div className="bg-slate-100 p-4 border-b-2 border-slate-200 shadow-inner">
                                                                <h4 className="text-xs font-black uppercase text-slate-500 mb-2">Chi tiết sản phẩm</h4>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                    {item.items.map((prod: any, idx: number) => (
                                                                        <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 flex justify-between items-center shadow-sm">
                                                                            <span className="text-[11px] font-bold text-slate-800 line-clamp-1 flex-1 pr-2" title={prod.productName}>{prod.productName}</span>
                                                                            <span className="text-[11px] font-black text-primary shrink-0">
                                                                                {prod.quantity} x {formatNumber(prod.price || prod.importPrice)} ₫
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                </React.Fragment>
                                            );
                                        })}`;
code = code.replace(rowEndOld, rowEndNew);

fs.writeFileSync(file, code);
console.log('Done');
