
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, collectionGroup, orderBy, doc, setDoc, writeBatch, increment, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, Warehouse, Manufacturer } from '../types';
import { Loader, XCircle, Package, Search, AlertTriangle, List, LayoutGrid, Edit, GitCommit, Download, Upload, Trash2, Filter, Tag, X, Plus } from 'lucide-react';
import { formatNumber, parseNumber } from '../utils/formatting';
import InventoryTransferModal from './InventoryTransferModal';
import ConfirmationModal from './ConfirmationModal';
import Pagination from './Pagination';
import { User } from 'firebase/auth';

// Khai báo biến toàn cục từ thư viện được import qua CDN
declare var XLSX: any;

interface FlatInventoryItem {
    productId: string;
    productName: string;
    manufacturerId: string;
    manufacturerName: string;
    warehouseId: string;
    warehouseName: string;
    stock: number;
    invoicedStock: number; // Tổng tồn hóa đơn (lấy từ product)
    warningThreshold: number;
    outsideStockWarningThreshold: number; // MỚI: Ngưỡng riêng cho kho Ngoài CH
    importPrice: number; // MỚI
    sellingPrice: number; // MỚI
}

// Modal component for editing stock
const EditStockModal: React.FC<{
  item: FlatInventoryItem;
  onClose: () => void;
  onSave: (newStock: number, newInvoicedStock: number) => void;
  onDelete: () => void;
}> = ({ item, onClose, onSave, onDelete }) => {
    const [stock, setStock] = useState(item.stock);
    const [invoicedStock, setInvoicedStock] = useState(item.invoicedStock);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (stock < 0) {
            alert("Số lượng tồn kho thực tế không thể nhỏ hơn 0.");
            return;
        }
        if (invoicedStock < 0) {
            alert("Số lượng tồn kho hóa đơn không thể nhỏ hơn 0.");
            return;
        }
        onSave(stock, invoicedStock);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm animate-fade-in-down">
                <h2 className="text-xl font-bold text-dark mb-4">Chỉnh Sửa Tồn Kho</h2>
                <p className="text-sm text-neutral mb-1">Sản phẩm: <span className="font-semibold text-dark">{item.productName}</span></p>
                <p className="text-sm text-neutral mb-6">Tại kho: <span className="font-semibold text-dark">{item.warehouseName}</span></p>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-neutral mb-1">Số lượng tồn thực tế (Tại kho này)</label>
                        <input
                            type="number"
                            value={stock}
                            onChange={e => setStock(Number(e.target.value))}
                            onFocus={e => e.target.select()}
                            className="w-full px-3 py-2 bg-slate-100 text-dark border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                            required
                            min="0"
                        />
                    </div>
                    <div className="mb-4">
                         <label className="block text-sm font-medium text-neutral mb-1">Số lượng tồn có HĐ (Tổng Toàn Cty)</label>
                         <div className="text-xs text-slate-500 mb-1 italic">Lưu ý: Giá trị này áp dụng cho tất cả các kho.</div>
                         <input
                            type="number"
                            value={invoicedStock}
                            onChange={e => setInvoicedStock(Number(e.target.value))}
                            onFocus={e => e.target.select()}
                            className="w-full px-3 py-2 bg-slate-100 text-dark border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                            required
                            min="0"
                        />
                    </div>
                    
                    <div className="mt-8 flex justify-between items-center">
                         <button 
                            type="button" 
                            onClick={onDelete} 
                            className="px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition flex items-center text-sm font-medium"
                            title="Xóa bản ghi tồn kho này khỏi cơ sở dữ liệu"
                        >
                            <Trash2 size={16} className="mr-1"/> Xóa bỏ
                        </button>

                        <div className="flex space-x-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 text-neutral rounded-lg hover:bg-slate-300 transition">Hủy</button>
                            <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition shadow">Lưu</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};


const InventoryMatrix: React.FC<{ user: User | null, onNavigate?: (view: any) => void }> = ({ user, onNavigate }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  // Inventory data structure: productId -> warehouseId -> { stock } (CHỈ TỒN THỰC)
  const [inventoryData, setInventoryData] = useState<{[productId: string]: {[warehouseId: string]: {stock: number}}}>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View & Modal states
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isTransferModalOpen, setTransferModalOpen] = useState(false);
  
  // Modal States for Deletion
  const [isConfirmDeleteInventoryOpen, setConfirmDeleteInventoryOpen] = useState(false);
  const [isConfirmCleanupOpen, setConfirmCleanupOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState<FlatInventoryItem | null>(null);
  const [transferInitialData, setTransferInitialData] = useState<{ productId: string; fromWarehouseId: string; } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('all');
  const [selectedManufacturerId, setSelectedManufacturerId] = useState('all');
  const [showZeroStockOnly, setShowZeroStockOnly] = useState(false);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    setLoading(true);
    setError(null);
    
    const unsubProducts = onSnapshot(query(collection(db, "products"), orderBy("name")), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, err => {
        console.error("Error fetching products: ", err);
        setError("Lỗi tải sản phẩm.");
    });

    const unsubWarehouses = onSnapshot(query(collection(db, "warehouses"), orderBy("name")), (snapshot) => {
      setWarehouses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
    }, err => {
        console.error("Error fetching warehouses: ", err);
        setError("Lỗi tải kho hàng.");
    });
    
    const unsubManufacturers = onSnapshot(query(collection(db, "manufacturers"), orderBy("name")), (snapshot) => {
      setManufacturers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Manufacturer)));
    }, err => {
        console.error("Error fetching manufacturers: ", err);
        setError("Lỗi tải hãng sản xuất.");
    });

    const unsubInventory = onSnapshot(query(collectionGroup(db, 'inventory')), (snapshot) => {
      const newInventoryData: {[productId: string]: {[warehouseId: string]: {stock: number}}} = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        const productId = doc.ref.parent.parent?.id;
        if (productId && data.warehouseId && typeof data.stock === 'number') {
          if (!newInventoryData[productId]) {
            newInventoryData[productId] = {};
          }
          newInventoryData[productId][data.warehouseId] = {
              stock: data.stock
          };
        }
      });
      setInventoryData(newInventoryData);
      setLoading(false); 
    }, err => {
        console.error("Error fetching inventory: ", err);
        setError("Lỗi tải dữ liệu tồn kho.");
        setLoading(false);
    });

    const handleClickOutside = (e: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
            setIsDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsubProducts();
      unsubWarehouses();
      unsubManufacturers();
      unsubInventory();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset page when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, selectedWarehouseId, selectedManufacturerId, viewMode, showZeroStockOnly]);

  const flatInventory = useMemo((): FlatInventoryItem[] => {
    const flatList: FlatInventoryItem[] = [];
    const manufacturerMap = new Map(manufacturers.map(m => [m.id, m.name]));
    const warehouseMap = new Map(warehouses.map(w => [w.id, w.name]));

    for (const product of products) {
        const productInventory = inventoryData[product.id];
        // Global invoiced stock from product doc
        const globalInvoicedStock = product.totalInvoicedStock || 0;

        if (productInventory) {
            for (const warehouseId in productInventory) {
                 if (Object.prototype.hasOwnProperty.call(productInventory, warehouseId)) {
                    const data = productInventory[warehouseId];
                    flatList.push({
                        productId: product.id,
                        productName: product.name,
                        manufacturerId: product.manufacturerId,
                        manufacturerName: String(manufacturerMap.get(product.manufacturerId) ?? 'Không rõ'),
                        warehouseId: warehouseId,
                        warehouseName: String(warehouseMap.get(warehouseId) ?? 'Không rõ'),
                        stock: data.stock,
                        invoicedStock: globalInvoicedStock, // Use global value
                        warningThreshold: product.warningThreshold,
                        outsideStockWarningThreshold: product.outsideStockWarningThreshold || 0, // Map field mới
                        importPrice: product.importPrice || 0,
                        sellingPrice: product.sellingPrice || 0,
                    });
                }
            }
        }
    }
    return flatList;
  }, [products, warehouses, manufacturers, inventoryData]);

  // Gợi ý sản phẩm dựa trên searchTerm
  const suggestedProducts = useMemo(() => {
      if (!searchTerm.trim()) return [];
      const lower = searchTerm.toLowerCase();
      return products.filter(p => p.name.toLowerCase().includes(lower)).slice(0, 10);
  }, [products, searchTerm]);

  const filteredInventory = useMemo(() => {
    return flatInventory.filter(item => {
        const matchesSearchTerm = item.productName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesWarehouse = selectedWarehouseId === 'all' || item.warehouseId === selectedWarehouseId;
        const matchesManufacturer = selectedManufacturerId === 'all' || item.manufacturerId === selectedManufacturerId;
        
        // Lọc tồn kho bằng 0
        const matchesZeroStock = showZeroStockOnly ? item.stock === 0 : true;

        return matchesSearchTerm && matchesWarehouse && matchesManufacturer && matchesZeroStock;
    });
  }, [flatInventory, searchTerm, selectedWarehouseId, selectedManufacturerId, showZeroStockOnly]);

  // Matrix View Preparation
  const matrixData = useMemo(() => {
      const productMap = new Map<string, {name: string, manufacturerName: string, stockByWarehouse: Map<string, number>, invoicedStock: number, importPrice: number, sellingPrice: number}>();
      
      filteredInventory.forEach(item => {
          if (!productMap.has(item.productId)) {
              productMap.set(item.productId, {
                  name: item.productName,
                  manufacturerName: item.manufacturerName,
                  stockByWarehouse: new Map(),
                  invoicedStock: item.invoicedStock,
                  importPrice: item.importPrice,
                  sellingPrice: item.sellingPrice
              });
          }
          productMap.get(item.productId)!.stockByWarehouse.set(item.warehouseId, item.stock);
      });
      
      return Array.from(productMap.entries());
  }, [filteredInventory]);

  const totalItems = viewMode === 'list' ? filteredInventory.length : matrixData.length;

  const paginatedData = useMemo(() => {
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;

      if (viewMode === 'list') {
          return filteredInventory.slice(startIndex, endIndex);
      } else {
          return matrixData.slice(startIndex, endIndex);
      }
  }, [filteredInventory, matrixData, currentPage, pageSize, viewMode]);


  const handleOpenEditModal = (item: FlatInventoryItem) => {
    setEditingItem(item);
    setEditModalOpen(true);
  };

  const handleOpenTransferModal = (item: FlatInventoryItem | null) => {
    if (item) {
        setTransferInitialData({ productId: item.productId, fromWarehouseId: item.warehouseId });
    } else {
        setTransferInitialData(null);
    }
    setTransferModalOpen(true);
  };

  const handleSelectProductFromDropdown = (name: string) => {
      setSearchTerm(name);
      setIsDropdownOpen(false);
  };

  const handleSaveStock = async (newStock: number, newInvoicedStock: number) => {
    if (!editingItem) return;
    if (newStock < 0 || newInvoicedStock < 0) {
        alert("Giá trị tồn kho không được nhỏ hơn 0.");
        return;
    }
    try {
      const batch = writeBatch(db);
      
      // 1. Update Physical Stock in Inventory subcollection
      const inventoryRef = doc(db, 'products', editingItem.productId, 'inventory', editingItem.warehouseId);
      batch.set(inventoryRef, { stock: newStock, warehouseId: editingItem.warehouseId, warehouseName: editingItem.warehouseName }, { merge: true });

      // 2. Update Global Invoiced Stock in Product document
      const productRef = doc(db, 'products', editingItem.productId);
      batch.update(productRef, { totalInvoicedStock: newInvoicedStock });

      await batch.commit();
      alert("Cập nhật tồn kho thành công!");
    } catch (error) {
      console.error("Error updating stock:", error);
      alert("Lỗi khi cập nhật tồn kho.");
    } finally {
      setEditModalOpen(false);
      setEditingItem(null);
    }
  };
  
  const handleRequestDelete = () => {
      setEditModalOpen(false);
      setConfirmDeleteInventoryOpen(true);
  };

  const handleDeleteInventoryItem = async () => {
      if (!editingItem) return;
      try {
          const inventoryRef = doc(db, 'products', editingItem.productId, 'inventory', editingItem.warehouseId);
          await deleteDoc(inventoryRef);
          
          alert("Đã xóa bản ghi tồn kho thành công!");
      } catch (error: any) {
          console.error("Error deleting inventory item:", error);
          alert("Lỗi khi xóa bản ghi tồn kho. Vui lòng thử lại.");
      } finally {
          setConfirmDeleteInventoryOpen(false);
          setEditingItem(null);
      }
  };

  const handleTransfer = async (details: { productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number; }) => {
    const { productId, fromWarehouseId, toWarehouseId, quantity } = details;
    try {
      const batch = writeBatch(db);
      
      const fromInventoryRef = doc(db, 'products', productId, 'inventory', fromWarehouseId);
      const toInventoryRef = doc(db, 'products', productId, 'inventory', toWarehouseId);

      const toWarehouse = warehouses.find(w => w.id === toWarehouseId);
      const fromWarehouse = warehouses.find(w => w.id === fromWarehouseId);
      const product = products.find(p => p.id === productId);

      if (!toWarehouse || !fromWarehouse || !product) throw new Error("Thông tin kho hoặc sản phẩm không hợp lệ");

      // Logic chuyển kho: Cập nhật số lượng
      batch.update(fromInventoryRef, { stock: increment(-quantity) });
      batch.set(toInventoryRef, {
        stock: increment(quantity),
        warehouseId: toWarehouse.id,
        warehouseName: toWarehouse.name
      }, { merge: true });

      // GHI LOG LỊCH SỬ CHUYỂN KHO
      const transferRef = doc(collection(db, 'warehouseTransfers'));
      batch.set(transferRef, {
          productId: product.id,
          productName: product.name,
          fromWarehouseId: fromWarehouse.id,
          fromWarehouseName: fromWarehouse.name,
          toWarehouseId: toWarehouse.id,
          toWarehouseName: toWarehouse.name,
          quantity: quantity,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || null,
          creatorName: user?.displayName || user?.email || 'N/A'
      });

      await batch.commit();
      alert("Chuyển kho thành công!");
      setTransferModalOpen(false);
    } catch (error) {
      console.error("Error transferring stock: ", error);
      alert("Lỗi khi chuyển kho. Vui lòng kiểm tra lại số lượng tồn.");
    }
  };

  const handleCleanupZeroStock = async () => {
      setLoading(true);
      setConfirmCleanupOpen(false);
      
      try {
          let batch = writeBatch(db);
          let count = 0;
          let totalDeleted = 0;

          for (const productId in inventoryData) {
              for (const warehouseId in inventoryData[productId]) {
                  const item = inventoryData[productId][warehouseId];
                  if (item.stock === 0) {
                      const ref = doc(db, 'products', productId, 'inventory', warehouseId);
                      batch.delete(ref);
                      count++;
                      totalDeleted++;

                      if (count >= 450) {
                          await batch.commit();
                          batch = writeBatch(db);
                          count = 0;
                      }
                  }
              }
          }

          if (count > 0) {
              await batch.commit();
          }

          if (totalDeleted === 0) {
              alert("Không có bản ghi tồn kho nào bằng 0.");
          } else {
              alert(`Đã dọn dẹp thành công ${totalDeleted} bản ghi tồn kho bằng 0.`);
          }

      } catch (error) {
          console.error("Error cleaning up zero stock:", error);
          alert("Có lỗi xảy ra khi xóa.");
      } finally {
          setLoading(false);
      }
  };

  const renderListView = () => (
    <div className="overflow-x-auto">
        <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-black text-slate-500 tracking-widest">
                <tr>
                    <th className="p-4">Sản Phẩm</th>
                    <th className="p-4">Hãng SX</th>
                    <th className="p-4">Kho</th>
                    <th className="p-4 text-right">Giá Vốn</th>
                    <th className="p-4 text-right">Giá Bán</th>
                    <th className="p-4 text-right">Tồn Thực</th>
                    <th className="p-4 text-right">Tổng Có HĐ</th>
                    <th className="p-4 text-center">Hành động</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {(paginatedData as FlatInventoryItem[]).map((item, index) => {
                    // Cảnh báo tồn kho
                    let isLowStock = false;
                    if (selectedWarehouseId === 'all') {
                        const stocks = Object.values(inventoryData[item.productId] || {}) as { stock: number }[];
                        const productTotalStock = stocks.reduce((sum, val) => sum + (val.stock || 0), 0);
                        isLowStock = item.warningThreshold > 0 && productTotalStock <= item.warningThreshold;
                    } else if (item.warehouseName === 'Ngoài CH') {
                        isLowStock = item.outsideStockWarningThreshold > 0 && item.stock < item.outsideStockWarningThreshold;
                    }

                    return (
                        <tr key={`${item.productId}-${item.warehouseId}-${index}`} className={`hover:bg-slate-50 transition-colors ${isLowStock ? 'bg-red-50' : ''}`}>
                            <td className="p-4 font-bold text-dark text-xs uppercase leading-tight">{item.productName}</td>
                            <td className="p-4 text-neutral text-xs font-medium uppercase">{item.manufacturerName}</td>
                            <td className="p-4 text-slate-600 text-xs font-black uppercase">{item.warehouseName}</td>
                            <td className="p-4 text-right font-bold text-slate-500 text-sm">{formatNumber(item.importPrice)} ₫</td>
                            <td className="p-4 text-right font-black text-primary text-sm">{formatNumber(item.sellingPrice)} ₫</td>
                            <td className={`p-4 font-black text-right text-base ${isLowStock ? 'text-red-600' : 'text-dark'}`}>
                                <div className="flex items-center justify-end">
                                    {isLowStock && <AlertTriangle size={14} className="mr-2 text-red-500 animate-pulse"/>}
                                    {item.stock}
                                </div>
                            </td>
                            <td className="p-4 font-bold text-right text-blue-700 text-sm">
                                {item.invoicedStock}
                            </td>
                            <td className="p-4">
                                <div className="flex justify-center space-x-1">
                                    <button onClick={() => handleOpenEditModal(item)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition" title="Sửa tồn kho">
                                        <Edit size={16} />
                                    </button>
                                    <button onClick={() => handleOpenTransferModal(item)} className="p-2 text-orange-600 hover:bg-orange-100 rounded-lg transition" title="Chuyển kho">
                                        <GitCommit size={16} />
                                    </button>
                                    <button 
                                        onClick={() => onNavigate?.('create')} 
                                        className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition" 
                                        title="Nhập kho"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
    </div>
  );

  const renderMatrixView = () => {
      const displayWarehouses = selectedWarehouseId === 'all' ? warehouses : warehouses.filter(w => w.id === selectedWarehouseId);
      return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-black text-slate-500">
                    <tr>
                        <th className="p-3 border border-slate-200">Sản Phẩm</th>
                        <th className="p-3 border border-slate-200 text-right w-28">Giá Vốn</th>
                        <th className="p-3 border border-slate-200 text-right w-28">Giá Bán</th>
                        <th className="p-3 text-blue-700 border border-slate-200 text-center w-24">Tổng HĐ</th>
                        <th className="p-3 text-purple-700 border border-slate-200 text-center w-24">Tổng Thực</th>
                        {displayWarehouses.map(wh => <th key={wh.id} className="p-3 border border-slate-200 text-center">{wh.name}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {(paginatedData as [string, any][]).map(([productId, productData]) => {
                        const totalPhysical = Array.from(productData.stockByWarehouse.values()).reduce((a: number, b: any) => a + (b as number), 0) as number;
                        
                        // Lấy một item đại diện để thực hiện hành động
                        const representativeItem: FlatInventoryItem = {
                            productId: productId,
                            productName: productData.name,
                            manufacturerId: '', // Không quan trọng cho modal
                            manufacturerName: productData.manufacturerName,
                            warehouseId: warehouses[0]?.id || '', // Mặc định kho đầu tiên
                            warehouseName: warehouses[0]?.name || '',
                            stock: productData.stockByWarehouse.get(warehouses[0]?.id) || 0,
                            invoicedStock: productData.invoicedStock,
                            warningThreshold: 0,
                            outsideStockWarningThreshold: 0,
                            importPrice: productData.importPrice,
                            sellingPrice: productData.sellingPrice
                        };

                        return (
                        <tr key={productId} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-bold text-dark border border-slate-200 text-xs uppercase">
                                {productData.name}
                                <p className="text-[10px] text-neutral italic font-normal">{productData.manufacturerName}</p>
                            </td>
                            <td className="p-3 text-right font-bold text-slate-500 border border-slate-200 text-sm">
                                {formatNumber(productData.importPrice)}
                            </td>
                            <td className="p-3 text-right font-black text-primary border border-slate-200 text-sm">
                                {formatNumber(productData.sellingPrice)}
                            </td>
                            <td className="p-3 font-black text-blue-700 border border-slate-200 text-center text-sm">
                                {productData.invoicedStock}
                            </td>
                            <td className="p-3 font-black text-purple-700 border border-slate-200 text-center text-base">
                                {totalPhysical}
                            </td>
                            {displayWarehouses.map(wh => {
                                const stock = productData.stockByWarehouse.get(wh.id) ?? 0;
                                const cellItem: FlatInventoryItem = {
                                    ...representativeItem,
                                    warehouseId: wh.id,
                                    warehouseName: wh.name,
                                    stock: stock
                                };
                                return (
                                    <td key={wh.id} className="p-3 text-slate-900 border border-slate-200 text-center font-black text-sm group/cell relative min-w-[120px]">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-lg">{stock}</span>
                                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleOpenEditModal(cellItem)} 
                                                    className="p-1 text-blue-600 hover:bg-blue-100 rounded transition" 
                                                    title="Sửa tồn kho"
                                                >
                                                    <Edit size={12} />
                                                </button>
                                                <button 
                                                    onClick={() => handleOpenTransferModal(cellItem)} 
                                                    className="p-1 text-orange-600 hover:bg-orange-100 rounded transition" 
                                                    title="Chuyển kho"
                                                >
                                                    <GitCommit size={12} />
                                                </button>
                                                <button 
                                                    onClick={() => onNavigate?.('create')} 
                                                    className="p-1 text-green-600 hover:bg-green-100 rounded transition" 
                                                    title="Nhập kho"
                                                >
                                                    <Plus size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    )})}
                </tbody>
            </table>
        </div>
      )
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
        {isEditModalOpen && editingItem && (
            <EditStockModal 
                item={editingItem} 
                onClose={() => setEditModalOpen(false)} 
                onSave={handleSaveStock} 
                onDelete={handleRequestDelete}
            />
        )}
        <InventoryTransferModal
            isOpen={isTransferModalOpen}
            onClose={() => setTransferModalOpen(false)}
            onTransfer={handleTransfer}
            products={products}
            warehouses={warehouses}
            inventoryData={Object.keys(inventoryData).reduce((acc, pid) => {
                acc[pid] = {};
                Object.keys(inventoryData[pid]).forEach(wid => {
                    acc[pid][wid] = inventoryData[pid][wid].stock;
                });
                return acc;
            }, {} as {[pid: string]: {[wid: string]: number}})} 
            initialData={transferInitialData}
        />
        <ConfirmationModal
            isOpen={isConfirmDeleteInventoryOpen}
            onClose={() => {
                setConfirmDeleteInventoryOpen(false);
                setEditingItem(null);
            }}
            onConfirm={handleDeleteInventoryItem}
            title="Xác nhận Xóa Tồn Kho"
            message={
                <>
                    Bạn có chắc chắn muốn xóa bản ghi tồn kho của sản phẩm <strong>"{editingItem?.productName}"</strong> tại kho <strong>"{editingItem?.warehouseName}"</strong>?
                    <br/>
                    Dữ liệu này sẽ bị xóa vĩnh viễn.
                </>
            }
        />

        <ConfirmationModal
            isOpen={isConfirmCleanupOpen}
            onClose={() => setConfirmCleanupOpen(false)}
            onConfirm={handleCleanupZeroStock}
            title="Xác nhận Dọn Dẹp Tồn Kho"
            message={
                <>
                    Bạn có chắc chắn muốn xóa tất cả các bản ghi tồn kho có <strong>số lượng bằng 0</strong>?
                    <br/>
                    Thao tác này sẽ dọn dẹp danh sách hiển thị và giúp hệ thống gọn gàng hơn.
                </>
            }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="relative md:col-span-3" ref={dropdownRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                <input 
                    type="text" 
                    placeholder="Tìm theo tên sản phẩm..." 
                    value={searchTerm} 
                    onChange={e => {
                        setSearchTerm(e.target.value);
                        setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none font-bold"
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500">
                        <X size={16}/>
                    </button>
                )}
                {isDropdownOpen && suggestedProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                        {suggestedProducts.map(p => (
                            <button 
                                key={p.id} 
                                onClick={() => handleSelectProductFromDropdown(p.name)}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-50 last:border-0 flex items-center"
                            >
                                <Tag size={14} className="mr-2 text-blue-500"/>
                                <span className="font-bold text-dark">{p.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <select 
                value={selectedWarehouseId} 
                onChange={e => setSelectedWarehouseId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none appearance-none"
            >
                <option value="all">Tất cả kho</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select 
                value={selectedManufacturerId} 
                onChange={e => setSelectedManufacturerId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none appearance-none"
            >
                <option value="all">Tất cả hãng</option>
                {manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
        </div>
        
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
             <div className="flex items-center space-x-2">
                <button 
                    onClick={() => setShowZeroStockOnly(!showZeroStockOnly)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition text-sm border ${
                        showZeroStockOnly 
                        ? 'bg-red-100 text-red-700 border-red-300 font-bold' 
                        : 'bg-white text-neutral border-slate-300 hover:bg-slate-50'
                    }`}
                >
                    <Filter size={16} /> <span>{showZeroStockOnly ? 'Đang hiện: Tồn = 0' : 'Lọc Tồn = 0'}</span>
                </button>
                 <button onClick={() => setConfirmCleanupOpen(true)} className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm">
                    <Trash2 size={16} /> <span>Xóa tồn = 0</span>
                </button>
            </div>
            <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-lg">
                <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white text-primary shadow' : 'text-neutral'}`}
                    aria-label="Chế độ danh sách"
                >
                    <List size={18} />
                </button>
                <button
                    onClick={() => setViewMode('matrix')}
                    className={`p-2 rounded-md ${viewMode === 'matrix' ? 'bg-white text-primary shadow' : 'text-neutral'}`}
                    aria-label="Chế độ lưới"
                >
                    <LayoutGrid size={18} />
                </button>
            </div>
        </div>

        <div>
            {loading ? (
                <div className="p-10 flex justify-center items-center"><Loader className="animate-spin text-primary" size={32} /></div>
            ) : error ? (
                <div className="p-10 flex flex-col justify-center items-center text-red-600">
                    <XCircle size={32} className="mb-2"/>
                    <p>{error}</p>
                </div>
            ) : filteredInventory.length === 0 ? (
                <div className="p-10 text-center text-neutral">
                    <Package size={48} className="mx-auto mb-4 text-slate-300"/>
                    <h3 className="text-xl font-semibold">Không tìm thấy sản phẩm</h3>
                    <p className="mt-1">Vui lòng thử lại với bộ lọc khác hoặc kiểm tra dữ liệu tồn kho.</p>
                </div>
            ) : (
                viewMode === 'list' ? renderListView() : renderMatrixView()
            )}
        </div>
        
        <Pagination 
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
            }}
        />

        <style>{`
            @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
            .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
             @keyframes fade-in-down {
              0% { opacity: 0; transform: translateY(-10px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; }
        `}</style>
    </div>
  );
};

export default InventoryMatrix;
