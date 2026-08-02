const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

const uiOld = `                    <div className="relative flex-1 max-w-[300px]" ref={supplierDropdownRef}>
                        <div className="relative">
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                            <input 
                                type="text" 
                                placeholder="Tìm nhà cung cấp..." 
                                value={supplierSearchTerm} 
                                onChange={e => { setSupplierSearchTerm(e.target.value); setIsSupplierDropdownOpen(true); }} 
                                onFocus={() => {
                                    if (supplierSearchTerm === 'Tất cả nhà cung cấp') {
                                        setSupplierSearchTerm('');
                                    }
                                    setIsSupplierDropdownOpen(true);
                                }} 
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none text-sm font-bold text-slate-700 bg-white" 
                            />`;

const uiNew = `                    <div className="relative flex-1 max-w-[300px]" ref={supplierDropdownRef}>
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Tìm nhà cung cấp..." 
                                value={supplierSearchTerm} 
                                onChange={e => { setSupplierSearchTerm(e.target.value); setIsSupplierDropdownOpen(true); }} 
                                onFocus={() => {
                                    if (supplierSearchTerm === 'Tất cả nhà cung cấp') {
                                        setSupplierSearchTerm('');
                                    }
                                    setIsSupplierDropdownOpen(true);
                                }} 
                                className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none text-sm font-medium" 
                            />`;

code = code.replace(uiOld, uiNew);
fs.writeFileSync(file, code);
console.log('Done');
