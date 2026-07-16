const fs = require('fs');
const file = 'components/DebtManagement.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /<input\s+type="text" inputMode="numeric"\s+value=\{formatNumber\(payAmount\)\}\s+onChange=\{\(e\) => setPayAmount\(Math\.min\(parseNumber\(e\.target\.value\), totalAmount\)\)\}\s+onFocus=\{\(e\) => e\.target\.select\(\)\}\s+className="w-full px-4 py-3 bg-slate-900 text-white border-2 border-slate-800 rounded-xl font-black text-2xl text-right focus:border-primary outline-none shadow-inner"\s+\/>/,
    `<NumericInput 
                                value={payAmount} 
                                onChange={(val) => setPayAmount(Math.min(val, totalAmount))}
                                className="w-full px-4 py-3 bg-slate-900 text-white border-2 border-slate-800 rounded-xl font-black text-2xl text-right focus:border-primary outline-none shadow-inner"
                            />`
);

fs.writeFileSync(file, content);
