const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

const theadOld = \`<thead className="bg-slate-100">\`;
const theadNew = \`<thead className="bg-slate-100 sticky top-[73px] z-20 shadow-sm ring-1 ring-slate-200">\`;

code = code.replace(theadOld, theadNew);
fs.writeFileSync(file, code);
console.log('Done thead');
