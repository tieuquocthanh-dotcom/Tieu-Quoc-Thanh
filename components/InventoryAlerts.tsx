
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, collectionGroup, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, Manufacturer } from '../types';
import { Loader, XCircle, Package, AlertTriangle, Search } from 'lucide-react';

interface AlertProduct extends Product {
    totalStock: number;
}

const InventoryAlerts: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [inventoryData, setInventoryData] = useState<{[productId: string]: {[warehouseId: string]: number}}>({});
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedManufacturerId, setSelectedManufacturerId] = useState('all');

    useEffect(() => {
        setTimeout(() => {
            setLoading(true);
        }, 0);
        
        // 1. Fetch Products
        const unsubProducts = onSnapshot(query(collection(db, "products"), orderBy("name")), (snapshot) => {
            setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        }, err => {
            console.error("Error fetching products: ", err);
            setError("Lỗi tải sản phẩm.");
        });

        // 2. Fetch Manufacturers
        const unsubManufacturers = onSnapshot(query(collection(db, "manufacturers"), orderBy("name")), (snapshot) => {
            setManufacturers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Manufacturer)));
        }, err => {
            console.error("Error fetching manufacturers: ", err);
        });

        // 3. Fetch Inventory
        const unsubInventory = onSnapshot(query(collectionGroup(db, 'inventory')), (snapshot) => {
            const newInventoryData: {[productId: string]: {[warehouseId: string]: number}} = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                const productId = doc.ref.parent.parent?.id;
                if (productId && data.warehouseId && typeof data.stock === 'number') {
                    if (!newInventoryData[productId]) newInventoryData[productId] = {};
                    newInventoryData[productId][data.warehouseId] = data.stock;
                }
            });
            setInventoryData(newInventoryData);
            setLoading(false);
        }, err => {
            console.error("Error fetching inventory: ", err);
            setError("Lỗi tải dữ liệu tồn kho.");
            setLoading(false);
        });

        return () => {
            unsubProducts();
            unsubManufacturers();
            unsubInventory();
        };
    }, []);

    const alertProducts = useMemo((): AlertProduct[] => {
        const totalInventory: Record<string, number> = {};
        Object.keys(inventoryData).forEach(productId => {
            const stocks = Object.values(inventoryData[productId]) as number[];
            totalInventory[productId] = stocks.reduce((sum, stock) => sum + stock, 0);
        });
        
        return products
            .map(product => ({
                ...product,
                totalStock: totalInventory[product.id] || 0
            }))
            .filter(product => 
                product.warningThreshold > 0 && product.totalStock <= product.warningThreshold
            )
            .sort((a, b) => a.totalStock - b.totalStock); // Sắp xếp theo tồn kho tăng dần
    }, [products, inventoryData]);

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

    const StatusBadge: React.FC<{ stock: number }> = ({ stock }) => {
        if (stock <= 0) {
            return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Hết hàng</span>;
        }
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">Tồn kho thấp</span>;
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
                <h1 className="text-3xl font-bold text-dark flex items-center">
                    <AlertTriangle size={28} className="mr-3 text-orange-500"/>
                    Cảnh Báo Tổng Tồn Kho
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
                        <h3 className="text-xl font-semibold">Không có cảnh báo nào</h3>
                        <p className="mt-1">
                            {selectedManufacturerId !== 'all' || searchTerm 
                                ? 'Không tìm thấy kết quả phù hợp với bộ lọc.' 
                                : 'Tất cả sản phẩm đều có tồn kho an toàn (theo tổng kho).'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="p-4 text-sm font-semibold text-neutral">Tên Sản Phẩm</th>
                                    <th className="p-4 text-sm font-semibold text-neutral">Hãng SX</th>
                                    <th className="p-4 text-sm font-semibold text-neutral text-center">Ngưỡng Cảnh Báo (Tổng)</th>
                                    <th className="p-4 text-sm font-semibold text-neutral text-center">Tổng Tồn Kho (All)</th>
                                    <th className="p-4 text-sm font-semibold text-neutral text-center">Trạng Thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAlerts.map((product) => (
                                    <tr key={product.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
                                        <td className="p-4 font-medium text-dark">{product.name}</td>
                                        <td className="p-4 text-sm text-neutral">{product.manufacturerName}</td>
                                        <td className="p-4 text-neutral text-center">{product.warningThreshold}</td>
                                        <td className="p-4 text-dark font-bold text-center">{product.totalStock}</td>
                                        <td className="p-4 text-center">
                                            <StatusBadge stock={product.totalStock} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InventoryAlerts;
