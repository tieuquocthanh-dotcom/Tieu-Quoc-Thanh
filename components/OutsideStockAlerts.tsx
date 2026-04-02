
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, collectionGroup, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, Manufacturer } from '../types';
import { Loader, XCircle, AlertTriangle, Package, Search, Download } from 'lucide-react';
import Pagination from './Pagination';
import * as XLSX from 'xlsx';

interface AlertProduct extends Product {
    stockInOutside: number;
}

const OutsideStockAlerts: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
    const [outsideWarehouseId, setOutsideWarehouseId] = useState<string | null>(null);
    const [inventoryData, setInventoryData] = useState<{[productId: string]: number}>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedManufacturerId, setSelectedManufacturerId] = useState('all');
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                // 1. Get Warehouse ID for 'Ngoài CH'
                const warehouseQuery = query(collection(db, 'warehouses'), where('name', '==', 'Ngoài CH'));
                const warehouseSnap = await getDocs(warehouseQuery);
                
                if (warehouseSnap.empty) {
                    setError("Không tìm thấy kho có tên 'Ngoài CH'. Vui lòng tạo kho này trước.");
                    setLoading(false);
                    return;
                }
                
                const targetWarehouseId = warehouseSnap.docs[0].id;
                setOutsideWarehouseId(targetWarehouseId);

                // 2. Fetch Manufacturers
                const unsubManufacturers = onSnapshot(query(collection(db, "manufacturers"), orderBy("name")), (snapshot) => {
                    setManufacturers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Manufacturer)));
                });

                // 3. Fetch all products (to get names and thresholds)
                const unsubProducts = onSnapshot(query(collection(db, "products"), orderBy("name")), (snapshot) => {
                    setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
                });

                // 4. Fetch inventory specifically for this warehouse
                const unsubInventory = onSnapshot(query(collectionGroup(db, 'inventory'), where('warehouseId', '==', targetWarehouseId)), (snapshot) => {
                    const stockMap: {[productId: string]: number} = {};
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        const productId = doc.ref.parent.parent?.id;
                        if (productId && typeof data.stock === 'number') {
                            stockMap[productId] = data.stock;
                        }
                    });
                    setInventoryData(stockMap);
                    setLoading(false);
                }, (err) => {
                    console.error("Error fetching outside inventory:", err);
                    setError("Lỗi tải dữ liệu tồn kho. (Có thể thiếu Index trên Firebase)");
                    setLoading(false);
                });

                return () => {
                    unsubManufacturers();
                    unsubProducts();
                    unsubInventory();
                };

            } catch (err) {
                console.error("Error init:", err);
                setError("Có lỗi xảy ra khi khởi tạo.");
                setLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedManufacturerId]);

    const alertProducts = useMemo((): AlertProduct[] => {
        if (!outsideWarehouseId) return [];

        return products
            .map(product => ({
                ...product,
                stockInOutside: inventoryData[product.id] || 0
            }))
            .filter(product => {
                const threshold = product.outsideStockWarningThreshold;
                // LOGIC CẬP NHẬT: Chỉ hiển thị nếu tồn kho < ngưỡng (nhỏ hơn hẳn)
                return threshold !== undefined && threshold > 0 && product.stockInOutside < threshold;
            })
            .sort((a, b) => a.stockInOutside - b.stockInOutside); // Sort by lowest stock first
    }, [products, inventoryData, outsideWarehouseId]);

    const filteredAlerts = useMemo(() => {
        let result = alertProducts;

        // Filter by Manufacturer
        if (selectedManufacturerId !== 'all') {
            result = result.filter(p => p.manufacturerId === selectedManufacturerId);
        }

        // Filter by Search Term
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(p => p.name.toLowerCase().includes(lowerTerm));
        }

        return result;
    }, [alertProducts, searchTerm, selectedManufacturerId]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredAlerts.slice(startIndex, startIndex + pageSize);
    }, [filteredAlerts, currentPage, pageSize]);

    const handlePageChange = (newPage: number) => setCurrentPage(newPage);
    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setCurrentPage(1);
    };

    const handleExport = () => {
        const dataToExport = filteredAlerts.map(p => ({
            'Tên Sản Phẩm': p.name,
            'Hãng SX': p.manufacturerName,
            'Ngưỡng Cảnh Báo (Ngoài CH)': p.outsideStockWarningThreshold,
            'Tồn Kho Hiện Tại (Ngoài CH)': p.stockInOutside,
            'Cần Bổ Sung Tối Thiểu': (p.outsideStockWarningThreshold || 0) - p.stockInOutside
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "CanhBaoNgoaiCH");
        XLSX.writeFile(workbook, "CanhBaoKhoNgoaiCH.xlsx");
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
                <h1 className="text-3xl font-bold text-dark flex items-center">
                    <AlertTriangle size={28} className="mr-3 text-red-500"/>
                    Cảnh Báo Kho Ngoài CH
                </h1>
                <div className="flex items-center gap-3">
                    <select 
                        value={selectedManufacturerId} 
                        onChange={e => setSelectedManufacturerId(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none appearance-none bg-black text-white text-sm"
                        style={{maxWidth: '200px'}}
                    >
                        <option value="all">Tất cả hãng</option>
                        {manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                        <input 
                            type="text" 
                            placeholder="Tìm sản phẩm..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full sm:w-64 pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                    </div>
                    <button onClick={handleExport} className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                        <Download size={18} /> <span>Export</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                {loading ? (
                    <div className="p-10 flex justify-center items-center"><Loader className="animate-spin text-primary" size={32} /></div>
                ) : error ? (
                    <div className="p-10 flex flex-col justify-center items-center text-red-600">
                        <XCircle size={32} className="mb-2"/>
                        <p>{error}</p>
                    </div>
                ) : filteredAlerts.length === 0 ? (
                    <div className="p-10 text-center text-neutral">
                        <Package size={48} className="mx-auto mb-4 text-slate-300"/>
                        <h3 className="text-xl font-semibold">Kho Ngoài CH ổn định</h3>
                        <p className="mt-1">
                            {selectedManufacturerId !== 'all' || searchTerm
                                ? 'Không tìm thấy kết quả phù hợp với bộ lọc.'
                                : 'Không có sản phẩm nào có tồn kho nhỏ hơn ngưỡng cảnh báo.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-red-50 border-b border-red-200">
                                    <tr>
                                        <th className="p-4 text-sm font-semibold text-red-800">Tên Sản Phẩm</th>
                                        <th className="p-4 text-sm font-semibold text-red-800">Hãng SX</th>
                                        <th className="p-4 text-sm font-semibold text-red-800 text-center">Ngưỡng Cảnh Báo</th>
                                        <th className="p-4 text-sm font-semibold text-red-800 text-center">Tồn Kho (Ngoài CH)</th>
                                        <th className="p-4 text-sm font-semibold text-red-800 text-center">Trạng Thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((product) => (
                                        <tr key={product.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
                                            <td className="p-4 font-medium text-dark">{product.name}</td>
                                            <td className="p-4 text-sm text-neutral">{product.manufacturerName}</td>
                                            <td className="p-4 text-neutral text-center">{product.outsideStockWarningThreshold}</td>
                                            <td className="p-4 text-dark font-bold text-center text-lg">{product.stockInOutside}</td>
                                            <td className="p-4 text-center">
                                                {product.stockInOutside <= 0 ? (
                                                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-600 text-white shadow-sm">
                                                        HẾT HÀNG
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                                                        Sắp hết
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination 
                            currentPage={currentPage}
                            pageSize={pageSize}
                            totalItems={filteredAlerts.length}
                            onPageChange={handlePageChange}
                            onPageSizeChange={handlePageSizeChange}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default OutsideStockAlerts;
