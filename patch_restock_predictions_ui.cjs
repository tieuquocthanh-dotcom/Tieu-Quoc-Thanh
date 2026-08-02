const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

const uiStart = `                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select 
                            value={filterStatus}`;
const uiNew = `                    <div className="relative">
                        <select 
                            value={selectedSupplier}
                            onChange={e => { setSelectedSupplier(e.target.value); setCurrentPage(1); }}
                            className="pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none text-sm font-bold text-slate-700 bg-white appearance-none min-w-[200px]"
                        >
                            <option value="all">Tất cả nhà cung cấp</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select 
                            value={filterStatus}`;

code = code.replace(uiStart, uiNew);
fs.writeFileSync(file, code);
console.log('Done UI');
