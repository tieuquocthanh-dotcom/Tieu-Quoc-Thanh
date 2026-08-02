const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);`;
    
const insertStr = `    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    
    const [selectedItems, setSelectedItems] = useState<{[productId: string]: number}>({});
    const { showToast } = useToast();
    const [isOrdering, setIsOrdering] = useState(false);

    const handleCreatePlannedOrder = async () => {
        if (selectedSupplier === 'all') {
            showToast("Vui lòng chọn một nhà cung cấp cụ thể để đặt hàng.", "error");
            return;
        }
        
        const itemsToOrder = Object.entries(selectedItems).map(([productId, qty]) => {
            const p = products.find(p => p.id === productId);
            return p ? { productId, productName: p.name, quantity: qty } : null;
        }).filter(Boolean);

        if (itemsToOrder.length === 0) {
            showToast("Vui lòng chọn ít nhất một sản phẩm.", "error");
            return;
        }

        setIsOrdering(true);
        try {
            const supplier = suppliers.find(s => s.id === selectedSupplier);
            if (!supplier) throw new Error("Không tìm thấy nhà cung cấp");

            await addDoc(collection(db, 'plannedOrders'), {
                supplierId: supplier.id,
                supplierName: supplier.name,
                items: itemsToOrder,
                status: 'pending',
                createdAt: Timestamp.now()
            });

            showToast("Đã tạo đơn dự kiến đặt hàng thành công!", "success");
            setSelectedItems({});
        } catch (err: any) {
            console.error("Lỗi khi tạo đơn dự kiến:", err);
            showToast("Có lỗi xảy ra khi tạo đơn.", "error");
        } finally {
            setIsOrdering(false);
        }
    };

    const handleToggleCheck = (p: ProductPrediction, checked: boolean) => {
        setSelectedItems(prev => {
            const next = { ...prev };
            if (checked) {
                next[p.id] = p.suggestedRestockQty > 0 ? p.suggestedRestockQty : 1;
            } else {
                delete next[p.id];
            }
            return next;
        });
    };

    const handleQtyChange = (productId: string, qty: number) => {
        setSelectedItems(prev => ({
            ...prev,
            [productId]: qty
        }));
    };
`;
code = code.replace(targetStr, insertStr);

fs.writeFileSync(file, code);
console.log('Done state');
