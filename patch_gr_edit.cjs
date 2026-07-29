const fs = require('fs');
const file = 'components/GoodsReceiptEditModal.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '<div className="flex-1 overflow-y-auto min-h-[300px] max-h-[500px]">',
  '<div className="flex-1 overflow-auto min-h-[300px] max-h-[500px]">'
);

content = content.replace(
  '<table className="w-full text-left border-collapse">',
  '<table className="w-full text-left border-collapse min-w-[550px]">'
);

fs.writeFileSync(file, content);
console.log('Patched GoodsReceiptEditModal.tsx');
