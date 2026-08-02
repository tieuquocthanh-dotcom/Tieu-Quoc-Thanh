const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "import { collection, onSnapshot, query, collectionGroup, orderBy, Timestamp, where } from 'firebase/firestore';",
    "import { collection, onSnapshot, query, collectionGroup, orderBy, Timestamp, where, addDoc } from 'firebase/firestore';"
);
code = code.replace(
    "import { Loader, PackageSearch, AlertTriangle, TrendingUp, TrendingDown, Package, Clock, Filter, Users } from 'lucide-react';",
    "import { Loader, PackageSearch, AlertTriangle, TrendingUp, TrendingDown, Package, Clock, Filter, Users, ShoppingCart } from 'lucide-react';"
);
// Import useToast
if (!code.includes('useToast')) {
    code = code.replace(
        "import Pagination from './Pagination';",
        "import Pagination from './Pagination';\nimport { useToast } from '../contexts/ToastContext';"
    );
}

fs.writeFileSync(file, code);
console.log('Done imports');
