
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, Supplier } from '../types';
import { PlusCircle, Edit, Trash2, Loader, FileText, Search, Save, Calendar, Tag, Users, Download, Upload } from 'lucide-react';
import Pagination from './Pagination';
import ConfirmationModal from './ConfirmationModal';
import { formatNumber, parseNumber } from '../utils/formatting';
import * as XLSX from 'xlsx';

interface Quotation {
    id: string;
    productId: string;
    productName: string;
    supplierId: string;
    supplierName: string;
    price: number;
    quoteDate: Timestamp;
    createdAt: Timestamp;
}

const QuotationModal: React.FC<{
    quotation: Partial<Quotation> | null;
    onClose: () => void;
    onSave: (data: any) => void;
    products: Product[];
    suppliers: Supplier[];
}> = ({ quotation, onClose, onSave, products, suppliers }) => {
    const [productId, setProductId] = useState(quotation?.productId || '');
    const [supplierId, setSupplierId] = useState(quotation?.supplierId || '');
    const [price, setPrice] = useState(quotation?.price || 0);
    const [quoteDate, setQuoteDate] = useState(
        quotation?.quoteDate ? quotation.quoteDate.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    );
    const [error, setError] = useState('');

    // Autocomplete States for Product
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const productDropdownRef = useRef<HTMLDivElement>(null);

    const inputClasses = "w-full px-3 py-2 bg-slate-100 text-dark border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none";

    // Initialize product name for search input if editing
    useEffect(() => {
        if (quotation?.productId) {
            const p = products.find(p => p.id === quotation.productId);
            if (p) setProductSearch(p.name);
        }
    }, [quotation, products]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
                setShowProductDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredProductsForSelect = useMemo(() => {
        if (!productSearch) return products.slice(0, 50); // Show some defaults
        const lower = productSearch.toLowerCase();
        return products.filter(p => p.name.toLowerCase().includes(lower)).slice(0, 50); // Limit results
    }, [products, productSearch]);

    const handleSelectProduct = (product: Product) => {
        setProductId(product.id);
        setProductSearch(product.name);
        setShowProductDropdown(false);
        setError('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!productId || !supplierId || price <= 0) {
            setError('Vui lòng điền đầy đủ thông tin và giá phải lớn hơn 0.');
            return;
        }

        const selectedProduct = products.find(p => p.id === productId);
        const selectedSupplier = suppliers.find(s => s.id === supplierId);

        if (!selectedProduct || !selectedSupplier) {
            setError('Dữ liệu sản phẩm hoặc nhà cung cấp không hợp lệ.');
            return;
        }

        const dateObj = new Date(quoteDate);
        dateObj.setHours(12, 0, 0, 0);

        onSave({
            productId,
            productName: selectedProduct.name,
            supplierId,
            supplierName: selectedSupplier.name,
            price: Number(price),
            quoteDate: Timestamp.fromDate(dateObj)
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md animate-fade-in-down overflow-visible">
                <h2 className="text-2xl font-bold text-dark mb-6">{quotation?.id ? 'Sửa Báo Giá' : 'Thêm Báo Giá Mới'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral mb-1">Ngày báo giá</label>
                        <input 
                            type="date" 
                            value={quoteDate} 
                            onChange={e => setQuoteDate(e.target.value)} 
                            className={inputClasses}
                            required 
                        />
                    </div>
                    
                    {/* Product Autocomplete Input */}
                    <div className="relative" ref={productDropdownRef}>
                        <label className="block text-sm font-medium text-neutral mb-1">Sản phẩm</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                            <input 
                                type="text"
                                value={productSearch}
                                onChange={(e) => {
                                    setProductSearch(e.target.value);
                                    setShowProductDropdown(true);
                                    if (e.target.value === '') setProductId(''); // Clear ID if text cleared
                                }}
                                onFocus={() => setShowProductDropdown(true)}
                                placeholder="Gõ tên sản phẩm..."
                                className="w-full pl-9 pr-3 py-2 bg-slate-100 text-dark border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                                required
                            />
                        </div>
                        {showProductDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                                {filteredProductsForSelect.length === 0 ? (
                                    <div className="p-3 text-sm text-neutral text-center">Không tìm thấy sản phẩm</div>
                                ) : (
                                    filteredProductsForSelect.map(p => (
                                        <div
                                            key={p.id}
                                            onClick={() => handleSelectProduct(p)}
                                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-slate-50 last:border-0"
                                        >
                                            <div className="font-medium text-dark">{p.name}</div>
                                            <div className="text-xs text-slate-500">Giá hiện tại: {formatNumber(p.sellingPrice)}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                        {!productId && productSearch && !showProductDropdown && (
                             <p className="text-xs text-red-500 mt-1">Vui lòng chọn một sản phẩm từ danh sách.</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-neutral mb-1">Nhà cung cấp</label>
                        <select 
                            value={supplierId} 
                            onChange={e => setSupplierId(e.target.value)} 
                            className={inputClasses} 
                            required
                        >
                            <option value="" disabled>-- Chọn nhà cung cấp --</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral mb-1">Giá báo (VNĐ)</label>
                        <input 
                            type="text"
                            inputMode="numeric"
                            value={formatNumber(price)} 
                            onChange={e => setPrice(parseNumber(e.target.value))} 
                            onFocus={e => e.target.select()}
                            className={inputClasses} 
                            required 
                        />
                    </div>

                    {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}

                    <div className="pt-4 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 text-neutral rounded-lg hover:bg-slate-300 transition">Hủy</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition shadow flex items-center">
                            <Save size={18} className="mr-2"/> Lưu
                        </button>
                    </div>
                </form>
            </div>
             <style>{`
                @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
                @keyframes fade-in-down {
                0% { opacity: 0; transform: translateY(-10px); }
                100% { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

const QuotationManagement: React.FC = () => {
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Quotation | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<Quotation | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filter & Pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        setLoading(true);
        const unsubQuotes = onSnapshot(query(collection(db, "quotations"), orderBy("quoteDate", "desc")), (snapshot) => {
            setQuotations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation)));
            setLoading(false);
        }, err => {
            console.error("Error fetching quotations:", err);
            setError("Lỗi tải dữ liệu báo giá.");
            setLoading(false);
        });

        const unsubProducts = onSnapshot(query(collection(db, "products"), orderBy("name")), (snapshot) => {
            setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        });

        const unsubSuppliers = onSnapshot(query(collection(db, "suppliers"), orderBy("name")), (snapshot) => {
            setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
        });

        return () => {
            unsubQuotes();
            unsubProducts();
            unsubSuppliers();
        };
    }, []);

    const filteredQuotations = useMemo(() => {
        if (!searchTerm) return quotations;
        const lowerTerm = searchTerm.toLowerCase();
        return quotations.filter(q => 
            q.productName.toLowerCase().includes(lowerTerm) || 
            q.supplierName.toLowerCase().includes(lowerTerm)
        );
    }, [quotations, searchTerm]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredQuotations.slice(startIndex, startIndex + pageSize);
    }, [filteredQuotations, currentPage, pageSize]);

    const handlePageChange = (page: number) => setCurrentPage(page);
    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setCurrentPage(1);
    };

    const handleSave = async (data: any) => {
        try {
            if (editingItem) {
                await updateDoc(doc(db, 'quotations', editingItem.id), data);
            } else {
                await addDoc(collection(db, 'quotations'), {
                    ...data,
                    createdAt: serverTimestamp()
                });
            }
            setIsModalOpen(false);
            setEditingItem(null);
        } catch (err) {
            console.error("Error saving quotation:", err);
            alert("Lỗi khi lưu báo giá.");
        }
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        try {
            await deleteDoc(doc(db, 'quotations', itemToDelete.id));
            setIsDeleteConfirmOpen(false);
            setItemToDelete(null);
        } catch (err) {
            console.error("Error deleting quotation:", err);
            alert("Lỗi khi xóa báo giá.");
        }
    };

    const handleExport = () => {
        const dataToExport = filteredQuotations.map(q => ({
            'Ngày Báo Giá': q.quoteDate ? q.quoteDate.toDate().toLocaleDateString('vi-VN') : '',
            'Tên Sản Phẩm': q.productName,
            'Nhà Cung Cấp': q.supplierName,
            'Giá Báo (VNĐ)': q.price
        }));

        if (dataToExport.length === 0) {
            alert("Không có dữ liệu để xuất.");
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "BaoGia");
        XLSX.writeFile(workbook, "DanhSachBaoGia.xlsx");
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                if (json.length === 0) {
                    alert("File Excel trống hoặc không đúng định dạng.");
                    return;
                }

                const batch = writeBatch(db);
                
                // Maps để tra cứu ID từ tên
                const productMap = new Map<string, {id: string, name: string}>();
                products.forEach(p => productMap.set(p.name.toLowerCase().trim(), {id: p.id, name: p.name}));

                const supplierMap = new Map<string, {id: string, name: string}>();
                suppliers.forEach(s => supplierMap.set(s.name.toLowerCase().trim(), {id: s.id, name: s.name}));

                let count = 0;
                let errors: string[] = [];

                json.forEach((row: any, index: number) => {
                    const productName = String(row['Tên Sản Phẩm'] || '').trim();
                    const supplierName = String(row['Nhà Cung Cấp'] || '').trim();
                    const price = parseNumber(String(row['Giá Báo (VNĐ)'] || '0'));
                    // Date handling might vary based on Excel format, assuming simple string or excel serial date
                    let quoteDate = new Date(); // Default to today if missing

                    if (!productName || !supplierName || price <= 0) {
                        errors.push(`Dòng ${index + 2}: Thiếu thông tin sản phẩm, NCC hoặc giá.`);
                        return;
                    }

                    const product = productMap.get(productName.toLowerCase());
                    const supplier = supplierMap.get(supplierName.toLowerCase());

                    if (!product) {
                        errors.push(`Dòng ${index + 2}: Không tìm thấy sản phẩm "${productName}".`);
                        return;
                    }
                    if (!supplier) {
                        errors.push(`Dòng ${index + 2}: Không tìm thấy nhà cung cấp "${supplierName}".`);
                        return;
                    }

                    const ref = doc(collection(db, 'quotations'));
                    batch.set(ref, {
                        productId: product.id,
                        productName: product.name,
                        supplierId: supplier.id,
                        supplierName: supplier.name,
                        price: price,
                        quoteDate: Timestamp.fromDate(quoteDate),
                        createdAt: serverTimestamp()
                    });
                    count++;
                });

                if (count > 0) {
                    await batch.commit();
                }

                let msg = `Đã nhập thành công ${count} dòng báo giá.`;
                if (errors.length > 0) {
                    msg += `\n\nCó ${errors.length} dòng lỗi:\n` + errors.slice(0, 5).join('\n') + (errors.length > 5 ? '\n...' : '');
                }
                alert(msg);

            } catch (error) {
                console.error("Error importing file: ", error);
                alert("Lỗi khi đọc file Excel.");
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-xl font-bold text-dark flex items-center">
                    <FileText className="mr-2 text-primary" />
                    Quản Lý Báo Giá
                </h2>
                
                <div className="flex items-center gap-3 flex-wrap w-full md:w-auto justify-end">
                    <div className="relative flex-1 md:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                        <input 
                            type="text" 
                            placeholder="Tìm SP hoặc NCC..." 
                            value={searchTerm} 
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full md:w-48 pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                    <button onClick={handleImportClick} className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow flex-shrink-0">
                        <Upload size={18} /> <span className="hidden sm:inline">Import</span>
                    </button>
                    <button onClick={handleExport} className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow flex-shrink-0">
                        <Download size={18} /> <span className="hidden sm:inline">Export</span>
                    </button>
                    <button 
                        onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                        className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition shadow flex-shrink-0"
                    >
                        <PlusCircle size={20} />
                        <span className="hidden sm:inline">Thêm Mới</span>
                    </button>
                </div>
            </div>

            {isModalOpen && (
                <QuotationModal 
                    quotation={editingItem} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={handleSave} 
                    products={products}
                    suppliers={suppliers}
                />
            )}

            <ConfirmationModal 
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleDelete}
                title="Xác nhận Xóa"
                message={<>Bạn có chắc muốn xóa báo giá của <strong>{itemToDelete?.productName}</strong> từ <strong>{itemToDelete?.supplierName}</strong>?</>}
            />

            <div className="flex-1 overflow-hidden border rounded-lg flex flex-col">
                {loading ? (
                    <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary" size={32} /></div>
                ) : error ? (
                    <div className="flex justify-center items-center h-full text-red-600">{error}</div>
                ) : filteredQuotations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-neutral">
                        <FileText size={48} className="mb-4 text-slate-300" />
                        <p>Chưa có dữ liệu báo giá nào.</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-4 text-sm font-semibold text-neutral">Ngày Báo Giá</th>
                                    <th className="p-4 text-sm font-semibold text-neutral">Sản Phẩm</th>
                                    <th className="p-4 text-sm font-semibold text-neutral">Nhà Cung Cấp</th>
                                    <th className="p-4 text-sm font-semibold text-neutral text-right">Giá Báo</th>
                                    <th className="p-4 text-sm font-semibold text-neutral text-right">Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map(item => (
                                    <tr key={item.id} className="border-b last:border-b-0 hover:bg-slate-50">
                                        <td className="p-4 text-sm text-neutral flex items-center">
                                            <Calendar size={14} className="mr-2 text-slate-400"/>
                                            {item.quoteDate?.toDate().toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="p-4 font-medium text-dark">
                                            <div className="flex items-center">
                                                <Tag size={14} className="mr-2 text-blue-500"/>
                                                {item.productName}
                                            </div>
                                        </td>
                                        <td className="p-4 text-neutral">
                                            <div className="flex items-center">
                                                <Users size={14} className="mr-2 text-orange-500"/>
                                                {item.supplierName}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-bold text-green-600">
                                            {formatNumber(item.price)} ₫
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end space-x-2">
                                                <button 
                                                    onClick={() => { setEditingItem(item); setIsModalOpen(true); }} 
                                                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => { setItemToDelete(item); setIsDeleteConfirmOpen(true); }}
                                                    className="p-2 text-red-600 hover:bg-red-100 rounded-full transition"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {filteredQuotations.length > 0 && (
                    <Pagination 
                        currentPage={currentPage}
                        pageSize={pageSize}
                        totalItems={filteredQuotations.length}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                    />
                )}
            </div>
        </div>
    );
};

export default QuotationManagement;
