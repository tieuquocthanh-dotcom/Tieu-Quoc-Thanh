const fs = require('fs');
let code = fs.readFileSync('components/DebtManagement.tsx', 'utf-8');

code = code.replace(
    'animate-fade-in-down overflow-hidden border-4 border-slate-800">',
    'animate-fade-in-down overflow-hidden border-4 border-slate-800 flex flex-col max-h-[90vh]">'
);

code = code.replace(
    '<div className="p-6">',
    '<div className="p-6 overflow-y-auto">'
);

code = code.replace(
    '<div className="p-4 bg-slate-50 flex gap-3">',
    '<div className="p-4 bg-slate-50 flex gap-3 shrink-0">'
);

fs.writeFileSync('components/DebtManagement.tsx', code);
