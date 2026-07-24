const fs = require('fs');
let code = fs.readFileSync('components/DebtManagement.tsx', 'utf-8');

code = code.replace(
    '<div className="p-4 bg-slate-50 border-t-2 border-slate-800 flex gap-2">',
    '<div className="p-4 bg-slate-50 border-t-2 border-slate-800 flex gap-2 shrink-0">'
);

fs.writeFileSync('components/DebtManagement.tsx', code);
