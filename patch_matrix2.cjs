const fs = require('fs');
const file = 'components/InventoryMatrix.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { useToast }')) {
    content = content.replace("import { formatNumber, parseNumber } from '../utils/formatting';", "import { formatNumber, parseNumber } from '../utils/formatting';\nimport { useToast } from './ToastContext';");
}

if (!content.includes('const { showToast } = useToast();')) {
    content = content.replace("const InventoryMatrix: React.FC<{ user: User | null; onSwitchTab?: (view: 'create' | 'inventory' | 'history' | 'transfers') => void }> = ({ user, onSwitchTab }) => {", "const InventoryMatrix: React.FC<{ user: User | null; onSwitchTab?: (view: 'create' | 'inventory' | 'history' | 'transfers') => void }> = ({ user, onSwitchTab }) => {\n    const { showToast } = useToast();");
}

fs.writeFileSync(file, content);
console.log('Fixed InventoryMatrix');
