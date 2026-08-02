const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Import X from lucide-react if needed, but we already have quite a few.
// Check if X is imported
if (!code.includes('X, ')) {
    code = code.replace("ShoppingCart } from 'lucide-react';", "ShoppingCart, X } from 'lucide-react';");
}

// 2. Add state
const stateTarget = `    const [isOrdering, setIsOrdering] = useState(false);`;
const stateNew = `    const [isOrdering, setIsOrdering] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);`;
code = code.replace(stateTarget, stateNew);

// 3. Rename handleCreatePlannedOrder to handleConfirmOrder and create a new handleOpenConfirmModal
const handlerOld = `    const handleCreatePlannedOrder = async () => {`;
const handlerNew = `    const handleOpenConfirmModal = () => {
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
        setIsConfirmModalOpen(true);
    };

    const handleCreatePlannedOrder = async () => {`;
code = code.replace(handlerOld, handlerNew);

// 4. Update the button to call handleOpenConfirmModal
const btnOld = `onClick={handleCreatePlannedOrder}`;
const btnNew = `onClick={handleOpenConfirmModal}`;
code = code.replace(btnOld, btnNew);
// Note: there might be another onClick={handleCreatePlannedOrder} if we're not careful, but there is only one.

// 5. Add the modal at the end, right before the closing </div> of the component (or near Pagination)
const returnEndStr = `            {totalPages > 1 && (
                <div className="mt-6">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </div>
            )}
        </div>
    );
};`;

const modalStr = `            {totalPages > 1 && (
                <div className="mt-6">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </div>
            )}

            {isConfirmModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-up">
                        <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-black text-dark flex items-center">
                                <ShoppingCart className="mr-2 text-primary" size={24} />
                                Xác nhận đơn dự kiến
                            </h2>
                            <button 
                                onClick={() => setIsConfirmModalOpen(false)}
                                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                            >
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>
                        <div className="p-4 sm:p-6 max-h-[60vh] overflow-y-auto">
                            <p className="text-sm font-medium text-slate-500 mb-4">
                                Bạn đang tạo đơn hàng dự kiến từ nhà cung cấp: <strong className="text-dark">{suppliers.find(s => s.id === selectedSupplier)?.name}</strong>
                            </p>
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-2 border-b border-slate-200 font-bold text-slate-600">Sản phẩm</th>
                                        <th className="px-4 py-2 border-b border-slate-200 font-bold text-slate-600 text-right">Số lượng đặt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(selectedItems).map(([productId, qty]) => {
                                        if (!qty) return null;
                                        const p = products.find(p => p.id === productId);
                                        return (
                                            <tr key={productId} className="border-b border-slate-100 last:border-0">
                                                <td className="px-4 py-3 font-medium text-dark">{p?.name || productId}</td>
                                                <td className="px-4 py-3 text-right font-black text-primary">{qty}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsConfirmModalOpen(false)}
                                className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                                disabled={isOrdering}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => {
                                    handleCreatePlannedOrder().then(() => setIsConfirmModalOpen(false));
                                }}
                                disabled={isOrdering}
                                className="px-6 py-2.5 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 flex items-center transition-colors disabled:opacity-50"
                            >
                                {isOrdering ? <Loader className="animate-spin mr-2" size={18} /> : null}
                                Xác nhận đặt hàng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};`;
if (code.includes(returnEndStr)) {
    code = code.replace(returnEndStr, modalStr);
} else {
    console.log("Could not find the end of the component!");
}

fs.writeFileSync(file, code);
console.log('Done modal');
