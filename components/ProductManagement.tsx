
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, writeBatch, getDocs, collectionGroup, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, Manufacturer, ComboItem } from '../types';
import { PlusCircle, Edit, Trash2, XCircle, Loader, Package, Search, Upload, Download, List, Activity, ArrowUp, ArrowDown, ArrowUpDown, Plus, X, Tag } from 'lucide-react';
import Pagination from './Pagination';
import { formatNumber, parseNumber } from '../utils/formatting';
import ConfirmationModal from './ConfirmationModal';
import { ManufacturerModal } from './ManufacturerManagement';
import ProductLifecycle from './ProductLifecycle';

declare var XLSX: any;

type SortKey = 'name' | 'importPrice' | 'sellingPrice' | 'profit' | 'warningThreshold';
type SortDirection = 'asc' | 'desc';

export const ProductModal: React.FC<{
  product: Partial<Product> | null;
  manufacturers: Manufacturer[];
  allProductsForCombo: Product[];
  onClose: () => void;
  onSave: (product: Omit<Product, 'id' | 'createdAt' | 'manufacturerName'>) => void;
  existingNames: string[];
}> = ({ product, manufacturers, allProductsForCombo, onClose, onSave, existingNames }) => {
  const [name, setName] = useState(product?.name || '');
  const [importPrice, setImportPrice] = useState(product?.importPrice ?? 0);
  const [sellingPrice, setSellingPrice] = useState(product?.sellingPrice ?? 0);
  const [warningThreshold, setWarningThreshold] = useState(product?.warningThreshold ?? 0);
  const [outsideStockWarningThreshold, setOutsideStockWarningThreshold] = useState(product?.outsideStockWarningThreshold ?? 0);
  const [manufacturerId, setManufacturerId] = useState(product?.manufacturerId || '');
  
  // Combo states
  const [isCombo, setIsCombo] = useState(product?.isCombo || false);
  const [comboItems, setComboItems] = useState<ComboItem[]>(product?.comboItems || []);
  const [comboSearch, setComboSearch] = useState('');
  const [showComboDropdown, setShowComboDropdown] = useState(false);
  const comboDropdownRef = useRef<HTMLDivElement>(null);

  const [errors, setErrors] = useState<{name?: string, manufacturer?: string, combo?: string}>({});
  const [isManuModalOpen, setIsManuModalOpen] = useState(false);
  
  const inputClasses = "w-full px-3 py-2 bg-slate-100 text-dark border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none placeholder-slate-400";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        if (comboDropdownRef.current && !comboDropdownRef.current.contains(e.target as Node)) {
            setShowComboDropdown(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredItemsForCombo = useMemo(() => {
      const lower = comboSearch.toLowerCase();
      // Không cho phép chọn chính nó hoặc các combo khác để tránh vòng lặp (hoặc tùy quy trình)
      return allProductsForCombo.filter(p => 
          !p.isCombo && 
          p.id !== product?.id && 
          p.name.toLowerCase().includes(lower)
      ).slice(0, 10);
  }, [allProductsForCombo, comboSearch, product?.id]);

  const addComboItem = (p: Product) => {
      if (comboItems.find(i => i.productId === p.id)) return;
      setComboItems([...comboItems, { productId: p.id, productName: p.name, quantity: 1 }]);
      setComboSearch('');
      setShowComboDropdown(false);
  };

  const removeComboItem = (id: string) => {
      setComboItems(comboItems.filter(i => i.productId !== id));
  };

  const updateComboItemQty = (id: string, q: number) => {
      setComboItems(comboItems.map(i => i.productId === id ? { ...i, quantity: Math.max(1, q) } : i));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let currentErrors: any = {};
    if (!manufacturerId) currentErrors.manufacturer = 'Vui lòng chọn một hãng sản xuất.';
    
    const isDuplicate = existingNames.some(existingName => existingName.toLowerCase() === name.trim().toLowerCase());
    if (isDuplicate) currentErrors.name = `Sản phẩm với tên "${name.trim()}" đã tồn tại.`;

    if (isCombo && comboItems.length === 0) currentErrors.combo = "Combo phải có ít nhất 1 sản phẩm thành phần.";

    if(Object.keys(currentErrors).length > 0){
        setErrors(currentErrors);
        return;
    }

    // Fixed typo: changed iSCombo to isCombo
    onSave({ 
      name: name.trim(), 
      importPrice: Number(importPrice), 
      sellingPrice: Number(sellingPrice), 
      warningThreshold: Number(warningThreshold),
      outsideStockWarningThreshold: Number(outsideStockWarningThreshold),
      manufacturerId,
      isCombo,
      comboItems: isCombo ? comboItems : []
    });
    onClose();
  };

  const handleCreateManufacturer = async (data: { name: string }) => {
    try {
        const docRef = await addDoc(collection(db, 'manufacturers'), { ...data, createdAt: serverTimestamp() });
        setManufacturerId(docRef.id);
        setErrors(prev => ({...prev, manufacturer: undefined}));
        setIsManuModalOpen(false);
    } catch (err) { console.error(err); }
  };

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] animate-fade-in p-4">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-2xl animate-fade-in-down overflow-y-auto max-h-[95vh]">
        <h2 className="text-2xl font-black text-dark mb-6 uppercase tracking-tighter">{product?.id ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Tên sản phẩm</label>
              <input type="text" value={name} onChange={e => { setName(e.target.value); setErrors(p => ({...p, name: undefined}))}} className={inputClasses} required />
               {errors.name && <p className="text-red-500 text-xs mt-1 font-bold">{errors.name}</p>}
            </div>

            <div className="md:col-span-2 flex items-center p-3 bg-blue-50 border-2 border-blue-100 rounded-xl mb-2">
                <input 
                    type="checkbox" 
                    id="is-combo-check" 
                    checked={isCombo} 
                    onChange={e => setIsCombo(e.target.checked)} 
                    className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-0 mr-3 cursor-pointer"
                />
                <label htmlFor="is-combo-check" className="text-sm font-black text-blue-800 uppercase cursor-pointer select-none">Sản phẩm này là COMBO (Gồm nhiều món lẻ)</label>
            </div>

            {isCombo && (
                <div className="md:col-span-2 space-y-3 p-4 border-2 border-dashed border-blue-200 rounded-xl bg-slate-50">
                    <label className="block text-xs font-black uppercase text-blue-600 mb-1">Thiết lập thành phần Combo</label>
                    <div className="relative" ref={comboDropdownRef}>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                <input 
                                    type="text" 
                                    placeholder="Tìm sản phẩm thành phần..." 
                                    value={comboSearch}
                                    onChange={e => { setComboSearch(e.target.value); setShowComboDropdown(true); }}
                                    onFocus={() => setShowComboDropdown(true)}
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 placeholder-slate-400"
                                />
                            </div>
                        </div>
                        {showComboDropdown && comboSearch && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                                {filteredItemsForCombo.map(p => (
                                    <button 
                                        key={p.id} 
                                        type="button"
                                        onClick={() => addComboItem(p)}
                                        className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-slate-50 text-sm flex justify-between"
                                    >
                                        <span className="font-bold text-slate-900">{p.name}</span>
                                        <span className="text-slate-400 text-xs">{p.manufacturerName}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-2">
                        {comboItems.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">Chưa chọn thành phần nào.</p>
                        ) : (
                            comboItems.map(item => (
                                <div key={item.productId} className="flex items-center justify-between bg-white p-2 rounded-lg border shadow-sm">
                                    <span className="text-sm font-bold text-slate-700 truncate flex-1 mr-2">{item.productName}</span>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center bg-slate-100 rounded-lg px-2">
                                            <span className="text-[10px] font-black mr-2 uppercase text-slate-400">SL:</span>
                                            <input 
                                                type="number" 
                                                value={item.quantity} 
                                                onChange={e => updateComboItemQty(item.productId, parseInt(e.target.value) || 1)}
                                                className="w-12 py-1 bg-transparent text-center font-black text-primary border-none focus:ring-0"
                                                min="1"
                                            />
                                        </div>
                                        <button type="button" onClick={() => removeComboItem(item.productId)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><X size={16}/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {errors.combo && <p className="text-red-500 text-xs font-bold">{errors.combo}</p>}
                </div>
            )}

            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Hãng sản xuất</label>
              <div className="flex space-x-2">
                  <select value={manufacturerId} onChange={e => { setManufacturerId(e.target.value); setErrors(prev => ({...prev, manufacturer: undefined})); }} className={`${inputClasses} flex-1`} required >
                    <option value="" disabled>-- Chọn hãng --</option>
                    {manufacturers.map(m => ( <option key={m.id} value={m.id}>{m.name}</option> ))}
                  </select>
                  <button type="button" onClick={() => setIsManuModalOpen(true)} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"><Plus size={20} /></button>
              </div>
               {errors.manufacturer && <p className="text-red-500 text-xs mt-1 font-bold">{errors.manufacturer}</p>}
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Ngưỡng CB (Tổng Tồn)</label>
              <input type="number" value={warningThreshold} onChange={e => setWarningThreshold(Number(e.target.value))} className={inputClasses} required min="0" />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Giá nhập dự kiến (₫)</label>
              <input type="text" inputMode="numeric" value={formatNumber(importPrice)} onChange={e => setImportPrice(parseNumber(e.target.value))} onFocus={e => e.target.select()} className={`${inputClasses} font-black text-slate-600`} required />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Giá bán niêm yết (₫)</label>
              <input type="text" inputMode="numeric" value={formatNumber(sellingPrice)} onChange={e => setSellingPrice(parseNumber(e.target.value))} onFocus={e => e.target.select()} className={`${inputClasses} font-black text-primary`} required />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Ngưỡng CB (Ngoài CH)</label>
              <input type="number" value={outsideStockWarningThreshold} onChange={e => setOutsideStockWarningThreshold(Number(e.target.value))} className={inputClasses} required min="0" />
            </div>
          </div>

          <div className="mt-8 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-6 py-2 bg-slate-200 text-neutral rounded-xl font-black text-xs uppercase hover:bg-slate-300 transition">Hủy</button>
            <button type="submit" className="px-8 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase hover:bg-primary-hover transition shadow-lg">{product?.id ? 'Lưu thay đổi' : 'Thêm sản phẩm'}</button>
          </div>
        </form>
      </div>
    </div>
    
    {isManuModalOpen && (
        <ManufacturerModal 
            manufacturer={null} 
            onClose={() => setIsManuModalOpen(false)} 
            onSave={handleCreateManufacturer}
            existingNames={manufacturers.map(m => m.name)}
        />
    )}
    </>
  );
};

const ProductManagement: React.FC<{ userRole: 'admin' | 'staff' | null }> = ({ userRole }) => {
  const [activeTab, setActiveTab] = useState<'list' | 'lifecycle'>('list');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedManufacturerId, setSelectedManufacturerId] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: SortDirection }>({ key: 'name', direction: 'asc' });
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubManufacturers = onSnapshot(query(collection(db, "manufacturers"), orderBy("name")), (snapshot) => {
        const manuData: Manufacturer[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Manufacturer));
        setManufacturers(manuData);

        const unsubProducts = onSnapshot(query(collection(db, "products"), orderBy("name")), (prodSnapshot) => {
            const productsData = prodSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Omit<Product, 'manufacturerName'>));
            setAllProducts(productsData.map(p => ({
                ...p,
                manufacturerName: manuData.find(m => m.id === p.manufacturerId)?.name || "Không rõ",
            } as Product)));
            setLoading(false);
        });
        return () => unsubProducts();
    });
    return () => unsubManufacturers();
  }, []);

  const sortedAndFilteredProducts = useMemo(() => {
      let result = allProducts;
      if (selectedManufacturerId !== 'all') result = result.filter(p => p.manufacturerId === selectedManufacturerId);
      if (searchTerm) result = result.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const sorted = [...result].sort((a, b) => {
        let valA = sortConfig.key === 'profit' ? (a.sellingPrice || 0) - (a.importPrice || 0) : a[sortConfig.key as keyof Product];
        let valB = sortConfig.key === 'profit' ? (b.sellingPrice || 0) - (b.importPrice || 0) : b[sortConfig.key as keyof Product];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
      return sorted;
  }, [allProducts, searchTerm, selectedManufacturerId, sortConfig]);

  const paginatedProducts = useMemo(() => sortedAndFilteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize), [sortedAndFilteredProducts, currentPage, pageSize]);
  const toggleSort = (key: SortKey) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  const handleSaveProduct = async (productData: any) => {
    try {
      if (editingProduct?.id) await updateDoc(doc(db, 'products', editingProduct.id), productData);
      else await addDoc(collection(db, 'products'), { ...productData, createdAt: serverTimestamp() });
      setIsModalOpen(false);
    } catch (err) { alert("Lỗi khi lưu sản phẩm."); }
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    try {
      const batch = writeBatch(db);
      const inventorySnapshot = await getDocs(collection(db, 'products', productToDelete.id, 'inventory'));
      inventorySnapshot.forEach((inventoryDoc) => batch.delete(inventoryDoc.ref));
      batch.delete(doc(db, 'products', productToDelete.id));
      await batch.commit();
      setProductToDelete(null);
    } catch (err) { alert("Lỗi khi xóa sản phẩm."); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4 flex-shrink-0">
        <h1 className="text-3xl font-black text-dark uppercase tracking-tighter">Quản Lý Sản Phẩm</h1>
        <div className="bg-slate-100 p-1 rounded-xl flex space-x-1 border border-slate-200 shadow-inner">
            <button onClick={() => setActiveTab('list')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center ${activeTab === 'list' ? 'bg-white text-primary shadow' : 'text-neutral'}`}><List size={16} className="mr-2"/> Danh Sách</button>
            <button onClick={() => setActiveTab('lifecycle')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center ${activeTab === 'lifecycle' ? 'bg-white text-primary shadow' : 'text-neutral'}`}><Activity size={16} className="mr-2"/> Tiến Trình</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {activeTab === 'list' ? (
            <div className="h-full overflow-y-auto pr-2">
                <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                            <input type="text" placeholder="Tìm theo tên..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full sm:w-48 pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold text-sm"/>
                        </div>
                        <select value={selectedManufacturerId} onChange={e => setSelectedManufacturerId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-xl bg-black text-white text-xs font-black uppercase outline-none"><option value="all">Tất cả hãng</option>{manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                        <button onClick={() => { setEditingProduct(null); setIsModalOpen(true); }} className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-xl font-black uppercase text-xs shadow-lg transform active:scale-95 transition-all"><PlusCircle size={20} /><span>Thêm Mới</span></button>
                    </div>
                </div>

                {isModalOpen && <ProductModal product={editingProduct} manufacturers={manufacturers} allProductsForCombo={allProducts} onClose={() => setIsModalOpen(false)} onSave={handleSaveProduct} existingNames={allProducts.filter(p => p.id !== editingProduct?.id).map(p => p.name)} />}
                
                <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={handleConfirmDelete} title="Xác nhận Xóa Sản Phẩm" message={<>Bạn có chắc muốn xóa sản phẩm <strong>"{productToDelete?.name}"</strong>?</>} />

                <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-100 overflow-hidden">
                    {loading ? (
                    <div className="p-10 flex justify-center items-center"><Loader className="animate-spin text-primary" size={32} /></div>
                    ) : (
                    <>
                        <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-800 text-white">
                            <tr>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-700" onClick={() => toggleSort('name')}>Tên Sản Phẩm</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest">Loại</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest">Hãng</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Giá Vốn</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Giá Bán</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Lợi Nhuận</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Hành Động</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                            {paginatedProducts.map((product) => {
                                const profit = (product.sellingPrice || 0) - (product.importPrice || 0);
                                return (
                                <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-bold text-dark text-sm uppercase">{product.name}</td>
                                <td className="p-4">
                                    {product.isCombo ? (
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-black uppercase border border-blue-200">Combo</span>
                                    ) : (
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-black uppercase border border-slate-200">Lẻ</span>
                                    )}
                                </td>
                                <td className="p-4 text-xs font-bold text-neutral">{product.manufacturerName}</td>
                                <td className="p-4 text-slate-500 font-black text-right text-sm">{formatNumber(product.importPrice)} ₫</td>
                                <td className="p-4 text-dark font-black text-right text-sm">{formatNumber(product.sellingPrice)} ₫</td>
                                <td className={`p-4 font-black text-right text-sm ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatNumber(profit)} ₫</td>
                                <td className="p-4">
                                    <div className="flex justify-center space-x-1">
                                    <button onClick={() => { setEditingProduct(product); setIsModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"><Edit size={18} /></button>
                                    <button onClick={() => { setProductToDelete(product); setIsConfirmModalOpen(true); }} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"><Trash2 size={18} /></button>
                                    </div>
                                </td>
                                </tr>
                            )})}
                            </tbody>
                        </table>
                        </div>
                        <Pagination currentPage={currentPage} pageSize={pageSize} totalItems={sortedAndFilteredProducts.length} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
                    </>
                    )}
                </div>
            </div>
        ) : (
            <div className="h-full overflow-y-auto bg-slate-50"><ProductLifecycle userRole={userRole} /></div>
        )}
      </div>
    </div>
  );
};

export default ProductManagement;
