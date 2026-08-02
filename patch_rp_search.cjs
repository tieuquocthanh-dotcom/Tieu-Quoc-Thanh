const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Imports
code = code.replace("import React, { useState, useEffect, useMemo } from 'react';", "import React, { useState, useEffect, useMemo, useRef } from 'react';");
code = code.replace("import { Loader, PackageSearch, AlertTriangle, TrendingUp, TrendingDown, Package, Clock, Filter } from 'lucide-react';", "import { Loader, PackageSearch, AlertTriangle, TrendingUp, TrendingDown, Package, Clock, Filter, Users } from 'lucide-react';");

// 2. States
const stateStart = `    const [filterStatus, setFilterStatus] = useState<string>('all');`;
const stateNew = `    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [supplierSearchTerm, setSupplierSearchTerm] = useState('Tất cả nhà cung cấp');
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
    const supplierDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
                setIsSupplierDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);`;
code = code.replace(stateStart, stateNew);

// 3. UI Replace
const uiOld = `                    <div className="relative">
                        <select 
                            value={selectedSupplier}
                            onChange={e => { setSelectedSupplier(e.target.value); setCurrentPage(1); }}
                            className="pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none text-sm font-bold text-slate-700 bg-white appearance-none min-w-[200px]"
                        >
                            <option value="all">Tất cả nhà cung cấp</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>`;

const uiNew = `                    <div className="relative flex-1 max-w-[300px]" ref={supplierDropdownRef}>
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
                            />
                            {isSupplierDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                                    <button 
                                        onClick={() => { setSelectedSupplier('all'); setSupplierSearchTerm('Tất cả nhà cung cấp'); setIsSupplierDropdownOpen(false); setCurrentPage(1); }} 
                                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs border-b font-black text-slate-700"
                                    >
                                        TẤT CẢ NHÀ CUNG CẤP
                                    </button>
                                    {suppliers.filter(s => {
                                        const term = (supplierSearchTerm || '').toLowerCase();
                                        return (s.name || '').toLowerCase().includes(term) || (s.phone || '').includes(term);
                                    }).map(s => (
                                        <button 
                                            key={s.id} 
                                            onClick={() => { setSelectedSupplier(s.id); setSupplierSearchTerm(s.name); setIsSupplierDropdownOpen(false); setCurrentPage(1); }} 
                                            className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs border-b font-black text-black"
                                        >
                                            {s.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>`;

code = code.replace(uiOld, uiNew);

fs.writeFileSync(file, code);
console.log('Done');
