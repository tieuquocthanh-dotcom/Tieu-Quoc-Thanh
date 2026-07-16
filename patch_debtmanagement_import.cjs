const fs = require('fs');
let file = 'components/DebtManagement.tsx';
let content = fs.readFileSync(file, 'utf8');

// replace the internal component with an import
content = content.replace(/const SupplierBankSelector: React\.FC<\{[\s\S]*?\}\s*\);\s*\};\s*/, "import { SupplierBankSelector } from './SupplierBankSelector';\n\n");

fs.writeFileSync(file, content);
