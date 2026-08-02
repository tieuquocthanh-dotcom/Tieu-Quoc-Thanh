const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

const filterStart = `    const filteredPredictions = useMemo(() => {
        return predictions.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
            
            // By default, if 'all', don't show healthy/overstocked/no_sales unless searched? Let's show all but paginate.
            return matchesSearch && matchesStatus;
        });
    }, [predictions, searchTerm, filterStatus]);`;

const filterNew = `    const filteredPredictions = useMemo(() => {
        return predictions.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
            const matchesSupplier = selectedSupplier === 'all' || (supplierProductsMap[selectedSupplier] && supplierProductsMap[selectedSupplier].has(p.id));
            
            return matchesSearch && matchesStatus && matchesSupplier;
        });
    }, [predictions, searchTerm, filterStatus, selectedSupplier, supplierProductsMap]);`;

code = code.replace(filterStart, filterNew);

fs.writeFileSync(file, code);
console.log('Done filter');
