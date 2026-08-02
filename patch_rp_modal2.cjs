const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

const returnEndStr = `                <div className="p-4 border-t border-slate-100">
                    <Pagination 
                        currentPage={currentPage}
                        totalItems={filteredPredictions.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
                    />
                </div>
            </div>
        </div>
    );
};`;

const modalStr = `                <div className="p-4 border-t border-slate-100">
                    <Pagination 
                        currentPage={currentPage}
                        totalItems={filteredPredictions.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
                    />
                </div>
            </div>

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
    fs.writeFileSync(file, code);
    console.log('Done modal append');
} else {
    console.log("Still could not find it");
}
