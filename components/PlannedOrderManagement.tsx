
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, Supplier, PlannedOrder, PlannedOrderItem, Manufacturer, PlannedOrderStatus } from '../types';
import { ClipboardList, Plus, Trash2, Search, Users, Tag, Package, Loader, X, Save, Edit, ShoppingBag, Check, RotateCcw, Printer, PlusCircle, CheckCircle2, Clock, ShoppingCart, Truck, PackageCheck, AlertCircle, ListFilter } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { ProductModal } from './ProductManagement';
import { User } from 'firebase/auth';

interface PlannedOrderManagementProps {
    user: User | null;
}

const STATUS_CONFIG: Record<PlannedOrderStatus, { label: string, color: string, icon: any }> = {
    pending: { label: 'Đang dự kiến', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock },
    ordered: { label: 'Đã đặt hàng', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle2 },
    shipped: { label: 'Đã chuyển hàng', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Truck },
    received_full: { label: 'Đã nhận đủ', color: 'bg-green-100 text-green-700 border-green-200', icon: PackageCheck },
    received_missing: { label: 'Nhận thiếu hàng', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle }
};

const StatusBadge: React.FC<{ status?: PlannedOrderStatus }> = ({ status }) => {
    const config = STATUS_CONFIG[status || 'pending'];
    const Icon = config.icon;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase border ${config.color}`}>
            <Icon size={10} className="mr-1" />
            {config.label}
        </span>
    );
};

const PlannedOrderManagement: React.FC<PlannedOrderManagementProps> = ({ user }) => {
    const [plannedOrders, setPlannedOrders] = useState<PlannedOrder[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
    const [loading, setLoading] = useState(true);

    // Tab State: 'all' or specific status
    const [filterTab, setFilterTab] = useState<PlannedOrderStatus | 'all'>('all');

    // Form States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<PlannedOrder | null>(null);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [orderStatus, setOrderStatus] = useState<PlannedOrderStatus>('pending');
    const [cart, setCart] = useState<PlannedOrderItem[]>([]);
    const [note, setNote] = useState('');

    // Inline Edit States
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineQty, setInlineQty] = useState<number>(0);

    // Add Product Area States
    const [productSearch, setProductSearch] = useState('');
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const [qty, setQty] = useState(1);
    const [selectedProductId, setSelectedProductId] = useState('');
    const productDropdownRef = useRef<HTMLDivElement>(null);

    // Quick Product Create State
    const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);

    // Confirmation Modal
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState<PlannedOrder | null>(null);

    useEffect(() => {
        setTimeout(() => {
            setLoading(true);
        }, 0);
        const unsubPlanned = onSnapshot(query(collection(db, "plannedOrders"), orderBy("createdAt", "desc")), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlannedOrder));
            setPlannedOrders(Array.isArray(data) ? data : []);
            setLoading(false);
        }, (err) => {
            console.error("Lỗi lấy đơn dự kiến:", err);
            setPlannedOrders([]);
            setLoading(false);
        });

        const unsubProducts = onSnapshot(query(collection(db, "products"), orderBy("name")), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            setProducts(Array.isArray(data) ? data : []);
        });

        const unsubSuppliers = onSnapshot(query(collection(db, "suppliers"), orderBy("name")), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
            setSuppliers(Array.isArray(data) ? data : []);
        });

        const unsubManufacturers = onSnapshot(query(collection(db, "manufacturers"), orderBy("name")), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Manufacturer));
            setManufacturers(Array.isArray(data) ? data : []);
        });

        const handleClickOutside = (e: MouseEvent) => {
            if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
                setIsProductDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            unsubPlanned();
            unsubProducts();
            unsubSuppliers();
            unsubManufacturers();
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const filteredPlannedOrders = useMemo(() => {
        if (!Array.isArray(plannedOrders)) return [];
        if (filterTab === 'all') return plannedOrders;
        return plannedOrders.filter(o => o.status === filterTab || (!o.status && filterTab === 'pending'));
    }, [plannedOrders, filterTab]);

    const filteredProducts = useMemo(() => {
        if (!productSearch || !Array.isArray(products)) return [];
        const lower = productSearch.toLowerCase();
        return products.filter(p => p.name && p.name.toLowerCase().includes(lower)).slice(0, 10);
    }, [products, productSearch]);

    const handleSelectProduct = (product: Product) => {
        setSelectedProductId(product.id);
        setProductSearch(product.name);
        setIsProductDropdownOpen(false);
    };

    const addToCart = () => {
        if (!selectedProductId || qty <= 0) return;
        const product = products.find(p => p.id === selectedProductId);
        if (!product) return;

        const existingIdx = cart.findIndex(i => i.productId === product.id);
        if (existingIdx !== -1) {
            const newCart = [...cart];
            newCart[existingIdx] = { ...newCart[existingIdx], quantity: newCart[existingIdx].quantity + qty };
            setCart(newCart);
        } else {
            setCart([...cart, { productId: product.id, productName: product.name, quantity: qty }]);
        }
        
        setProductSearch('');
        setSelectedProductId('');
        setQty(1);
    };

    const handleQuickSaveProduct = async (productData: any) => {
        try {
            const docRef = await addDoc(collection(db, 'products'), {
                ...productData,
                createdAt: serverTimestamp()
            });
            setSelectedProductId(docRef.id);
            setProductSearch(productData.name);
            setIsQuickProductModalOpen(false);
        } catch (err) {
            console.error("Lỗi khi tạo nhanh sản phẩm:", err);
            alert("Không thể tạo sản phẩm mới.");
        }
    };

    const startInlineEdit = (item: PlannedOrderItem) => {
        setInlineEditingId(item.productId);
        setInlineQty(item.quantity);
    };

    const cancelInlineEdit = () => {
        setInlineEditingId(null);
    };

    const saveInlineEdit = (productId: string) => {
        if (inlineQty <= 0) {
            removeFromCart(productId);
        } else {
            setCart(cart.map(item => item.productId === productId ? { ...item, quantity: inlineQty } : item));
        }
        setInlineEditingId(null);
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(i => i.productId !== id));
        if (inlineEditingId === id) setInlineEditingId(null);
    };

    const handleOpenCreateModal = () => {
        setEditingOrder(null);
        setSelectedSupplierId('');
        setOrderStatus('pending');
        setCart([]);
        setNote('');
        setProductSearch('');
        setSelectedProductId('');
        setQty(1);
        setInlineEditingId(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (order: PlannedOrder) => {
        setEditingOrder(order);
        setSelectedSupplierId(order.supplierId);
        setOrderStatus(order.status || 'pending');
        setCart(Array.isArray(order.items) ? [...order.items] : []);
        setNote(order.note || '');
        setProductSearch('');
        setSelectedProductId('');
        setQty(1);
        setInlineEditingId(null);
        setIsModalOpen(true);
    };

    const handleUpdateStatus = async (orderId: string, newStatus: PlannedOrderStatus) => {
        try {
            await updateDoc(doc(db, 'plannedOrders', orderId), {
                status: newStatus
            });
        } catch (e) {
            console.error(e);
            alert("Lỗi khi cập nhật trạng thái.");
        }
    };

    const handlePrint = (order: PlannedOrder) => {
        const dateStr = order.createdAt?.toDate().toLocaleDateString('vi-VN');
        const items = Array.isArray(order.items) ? order.items : [];
        const statusLabel = STATUS_CONFIG[order.status || 'pending'].label;
        const printContent = `
          <html>
            <head>
                <title>In Đơn Dự Kiến - ${order.supplierName}</title>
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #000; }
                    .header { text-align: right; font-style: italic; margin-bottom: 10px; font-size: 0.9rem; }
                    .title { text-align: center; margin-bottom: 5px; text-transform: uppercase; font-size: 1.5rem; font-weight: bold; }
                    .status { text-align: center; font-size: 0.9rem; font-weight: bold; color: #555; margin-bottom: 10px; }
                    .supplier { text-align: center; font-size: 1.8rem; font-weight: bold; margin: 10px 0 30px 0; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th { border-bottom: 2px solid #000; padding: 10px 5px; text-align: left; font-weight: bold; }
                    td { border-bottom: 1px solid #ddd; padding: 10px 5px; }
                    .text-center { text-align: center; }
                    .note { margin-top: 30px; font-style: italic; border-top: 1px dashed #aaa; padding-top: 10px; }
                    .footer { margin-top: 80px; display: flex; justify-content: space-between; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">Ngày lập dự kiến: ${dateStr}</div>
                <div class="title">Phiếu Dự Kiến Đặt Hàng</div>
                <div class="status">Trạng thái hiện tại: ${statusLabel}</div>
                <div class="supplier">${order.supplierName}</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 10%">STT</th>
                            <th style="width: 70%">Tên sản phẩm</th>
                            <th style="width: 20%" class="text-center">Số lượng</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${item.productName}</td>
                                <td class="text-center">${item.quantity}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${order.note ? `<div class="note"><b>Ghi chú:</b> ${order.note}</div>` : ''}
                <div class="footer">
                    <div>Người lập dự kiến: ${order.creatorName || '...'}</div>
                    <div style="margin-right: 50px;">Xác nhận Nhà cung cấp</div>
                </div>
            </body>
          </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    const handleSaveOrder = async () => {
        if (!selectedSupplierId || cart.length === 0) {
            alert("Vui lòng chọn Nhà cung cấp và ít nhất 1 sản phẩm.");
            return;
        }

        const supplier = suppliers.find(s => s.id === selectedSupplierId);
        const orderData = {
            supplierId: selectedSupplierId,
            supplierName: supplier?.name || 'N/A',
            items: cart,
            note: note,
            status: orderStatus,
            updatedAt: serverTimestamp(),
            updatedBy: user?.uid || null,
            updatedByName: user?.displayName || user?.email || 'N/A'
        };

        try {
            if (editingOrder) {
                await updateDoc(doc(db, 'plannedOrders', editingOrder.id), orderData);
                alert("Đã cập nhật đơn dự kiến.");
            } else {
                await addDoc(collection(db, 'plannedOrders'), {
                    ...orderData,
                    createdAt: serverTimestamp(),
                    createdBy: user?.uid || null,
                    creatorName: user?.displayName || user?.email || 'N/A'
                });
                alert("Đã lưu đơn dự kiến đặt hàng.");
            }
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            alert("Lỗi khi lưu đơn.");
        }
    };

    const handleDeleteOrder = async () => {
        if (!orderToDelete) return;
        try {
            await deleteDoc(doc(db, 'plannedOrders', orderToDelete.id));
            setIsDeleteModalOpen(false);
            setOrderToDelete(null);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <ConfirmationModal 
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteOrder}
                title="Xóa dự kiến đặt hàng"
                message={<>Bạn có chắc muốn xóa dự kiến cho <strong>{orderToDelete?.supplierName}</strong>? Thao tác này sẽ xóa vĩnh viễn đơn hàng khỏi danh sách.</>}
            />

            {/* Quick Create Product Modal */}
            {isQuickProductModalOpen && (
                <ProductModal 
                    product={null}
                    manufacturers={manufacturers}
                    allProductsForCombo={products}
                    onClose={() => setIsQuickProductModalOpen(false)}
                    onSave={handleQuickSaveProduct}
                    existingNames={products.map(p => p.name)}
                />
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-dark flex items-center">
                        <ClipboardList className="mr-3 text-primary" size={32}/>
                        Dự Kiến Đặt Hàng
                    </h1>
                    <div className="flex bg-slate-100 p-1 rounded-lg mt-4 w-fit border border-slate-200 shadow-inner overflow-x-auto">
                        <button onClick={() => setFilterTab('all')} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all whitespace-nowrap ${filterTab === 'all' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>Tất cả</button>
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                            <button 
                                key={key}
                                onClick={() => setFilterTab(key as PlannedOrderStatus)} 
                                className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center ${filterTab === key ? `bg-white shadow-sm ${config.color.split(' ')[1]}` : 'text-slate-500'}`}
                            >
                                <config.icon size={12} className="mr-1.5"/>
                                {config.label}
                            </button>
                        ))}
                    </div>
                </div>
                <button 
                    onClick={handleOpenCreateModal}
                    className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-xl font-black shadow-lg transition flex items-center transform active:scale-95 uppercase text-xs tracking-tighter"
                >
                    <Plus size={20} className="mr-2"/> Tạo Dự Kiến Mới
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader className="animate-spin text-primary" size={40}/></div>
            ) : filteredPlannedOrders.length === 0 ? (
                <div className="bg-white p-20 rounded-2xl border-2 border-dashed border-slate-200 text-center flex flex-col items-center shadow-inner">
                    <Package size={64} className="text-slate-300 mb-4"/>
                    <p className="text-lg font-black text-slate-400 uppercase tracking-widest">Không có đơn hàng nào.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPlannedOrders.map(order => {
                        const items = Array.isArray(order.items) ? order.items : [];
                        return (
                        <div key={order.id} className="bg-white rounded-2xl shadow-md border-2 border-slate-100 overflow-hidden flex flex-col hover:shadow-xl transition-all duration-300">
                            <div className="p-4 border-b flex justify-between items-start bg-slate-50/50 border-slate-50">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nhà cung cấp</div>
                                        <StatusBadge status={order.status} />
                                    </div>
                                    <h3 className="font-black text-dark text-lg leading-tight uppercase tracking-tighter">{order.supplierName}</h3>
                                </div>
                                <div className="flex space-x-1 shrink-0">
                                    <button onClick={() => handlePrint(order)} className="p-2 text-primary hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200" title="In đơn"><Printer size={18}/></button>
                                    <button onClick={() => handleOpenEditModal(order)} className="p-2 text-blue-600 hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200" title="Chỉnh sửa"><Edit size={18}/></button>
                                    <button onClick={() => { setOrderToDelete(order); setIsDeleteModalOpen(true); }} className="p-2 text-red-500 hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200" title="Xóa"><Trash2 size={18}/></button>
                                </div>
                            </div>
                            <div className="p-4 flex-1">
                                <div className="space-y-2 mb-4">
                                    {items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                            <span className="font-bold text-slate-700">{item.productName}</span>
                                            <span className="font-black text-primary bg-blue-50 px-3 py-0.5 rounded-full text-xs shadow-sm">x{item.quantity}</span>
                                        </div>
                                    ))}
                                </div>
                                {order.note && (
                                    <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-xs text-yellow-800 italic rounded-r-lg">
                                        "{order.note}"
                                    </div>
                                )}
                            </div>
                            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase flex items-center">
                                        <Users size={12} className="mr-1.5"/> {order.creatorName} • {order.createdAt?.toDate().toLocaleDateString('vi-VN')}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
                                    <div className="text-[8px] font-black text-slate-400 uppercase ml-1 mr-1">Đổi trạng thái:</div>
                                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                        <button 
                                            key={key}
                                            onClick={() => handleUpdateStatus(order.id, key as PlannedOrderStatus)}
                                            className={`p-1.5 rounded transition-all shrink-0 ${order.status === key ? `${config.color} border` : 'text-slate-300 hover:bg-slate-50'}`}
                                            title={config.label}
                                        >
                                            <config.icon size={14}/>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )})}
                </div>
            )}

            {/* CREATE/EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border-4 border-slate-800">
                        <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
                            <h2 className="text-sm font-black uppercase tracking-tighter flex items-center">
                                <ClipboardList size={20} className="mr-2 text-primary"/> 
                                {editingOrder ? 'Chỉnh Sửa Dự Kiến' : 'Tạo Dự Kiến Nhập Hàng'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-white/50 hover:text-white transition"><X size={24}/></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">1. Nhà cung cấp</label>
                                    <div className="relative">
                                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                                        <select 
                                            value={selectedSupplierId} 
                                            onChange={e => setSelectedSupplierId(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none font-black text-sm text-dark appearance-none"
                                        >
                                            <option value="">-- CHỌN NHÀ CUNG CẤP --</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">2. Trạng thái đơn</label>
                                    <div className="relative">
                                        <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                                        <select 
                                            value={orderStatus} 
                                            onChange={e => setOrderStatus(e.target.value as PlannedOrderStatus)}
                                            className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none font-black text-sm text-dark appearance-none uppercase"
                                        >
                                            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                                <option key={key} value={key}>{config.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-900 p-5 rounded-2xl shadow-inner border border-slate-800">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                        3. Thêm sản phẩm & số lượng
                                    </label>
                                    <button 
                                        onClick={() => setIsQuickProductModalOpen(true)}
                                        className="text-[9px] bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded font-black uppercase flex items-center shadow-md transition-all active:scale-95"
                                    >
                                        <PlusCircle size={12} className="mr-1"/> Tạo sản phẩm mới
                                    </button>
                                </div>
                                <div className="flex gap-2 relative">
                                    <div className="flex-1 relative" ref={productDropdownRef}>
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                        <input 
                                            type="text" 
                                            placeholder="Gõ tên sản phẩm..."
                                            value={productSearch}
                                            onChange={e => { setProductSearch(e.target.value); setIsProductDropdownOpen(true); }}
                                            onFocus={() => setIsProductDropdownOpen(true)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border-2 border-slate-700 text-white rounded-xl focus:border-primary outline-none text-sm placeholder-slate-600 font-bold"
                                        />
                                        {isProductDropdownOpen && productSearch && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-800 rounded-xl shadow-2xl z-20 max-h-48 overflow-y-auto">
                                                {filteredProducts.length === 0 ? (
                                                    <div className="p-4 text-center text-xs font-black text-slate-400 uppercase">Không tìm thấy</div>
                                                ) : (
                                                    filteredProducts.map(p => (
                                                        <button key={p.id} onClick={() => handleSelectProduct(p)} className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-0 flex items-center group transition-colors">
                                                            <Tag size={14} className="mr-2 text-slate-300 group-hover:text-blue-500"/>
                                                            <span className="font-black text-xs text-slate-700 uppercase">{p.name}</span>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <input 
                                        type="number" 
                                        value={qty} 
                                        onChange={e => setQty(parseInt(e.target.value) || 0)}
                                        onFocus={e => e.target.select()}
                                        className="w-20 px-2 py-2.5 bg-slate-800 border-2 border-slate-700 text-primary rounded-xl text-center font-black text-lg outline-none focus:border-primary"
                                        min="1"
                                    />
                                    <button 
                                        onClick={addToCart}
                                        disabled={!selectedProductId}
                                        className="p-3 bg-primary hover:bg-primary-hover text-white rounded-xl transition shadow-lg shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed transform active:scale-90"
                                    >
                                        <Plus size={24} strokeWidth={3}/>
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center tracking-widest"><ShoppingCart size={14} className="mr-2 text-primary"/> Giỏ hàng dự kiến</h4>
                                {cart.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-6 opacity-20">
                                        <ShoppingCart size={40} className="mb-2"/>
                                        <p className="text-[10px] font-black uppercase">Trống</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {cart.map((item, idx) => {
                                            const isEditingThis = inlineEditingId === item.productId;
                                            
                                            return (
                                                <div key={idx} className={`p-3 rounded-xl border-2 flex justify-between items-center transition-all ${isEditingThis ? 'border-orange-500 bg-orange-50 shadow-inner' : 'border-slate-100 bg-slate-50'}`}>
                                                    <div className="flex-1 font-black text-xs text-slate-700 pr-4 uppercase leading-tight">{item.productName}</div>
                                                    
                                                    <div className="flex items-center gap-1.5">
                                                        {isEditingThis ? (
                                                            <>
                                                                <input 
                                                                    type="number" 
                                                                    value={inlineQty} 
                                                                    onChange={e => setInlineQty(parseInt(e.target.value) || 0)}
                                                                    onFocus={e => e.target.select()}
                                                                    className="w-16 py-1 px-1 border-2 border-orange-500 rounded-lg text-center font-black text-orange-700 outline-none"
                                                                    autoFocus
                                                                />
                                                                <button onClick={() => saveInlineEdit(item.productId)} className="p-2 bg-green-600 text-white rounded-lg shadow-sm"><Check size={16} strokeWidth={3}/></button>
                                                                <button onClick={cancelInlineEdit} className="p-2 bg-slate-200 text-slate-500 rounded-lg"><RotateCcw size={16}/></button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="font-black text-primary px-3 py-1 bg-white border-2 border-primary/10 rounded-lg text-sm">x{item.quantity}</div>
                                                                <button onClick={() => startInlineEdit(item)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"><Edit size={16}/></button>
                                                                <button onClick={() => removeFromCart(item.productId)} className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition"><Trash2 size={16}/></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">4. Ghi chú</label>
                                <textarea 
                                    value={note} 
                                    onChange={e => setNote(e.target.value)} 
                                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm text-black font-bold shadow-inner"
                                    rows={2}
                                    placeholder="GHI CHÚ THÊM..."
                                ></textarea>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-100 border-t-4 border-slate-800 flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-white border-2 border-slate-800 rounded-xl font-black text-xs uppercase hover:bg-slate-50 transition active:scale-95 text-black">Hủy</button>
                            <button onClick={handleSaveOrder} className="px-8 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20 hover:bg-primary-hover transition active:scale-95 flex items-center">
                                <Save size={18} className="mr-2"/> {editingOrder ? 'Cập Nhật' : 'Lưu Dự Kiến'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlannedOrderManagement;
