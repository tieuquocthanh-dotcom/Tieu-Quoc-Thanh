
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc, serverTimestamp, query, orderBy, where, Timestamp, writeBatch, getDoc, increment, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Sale, Shipper, Customer, PaymentMethod, Product, Warehouse } from '../types';
// Fixed: Added Info to the list of icons imported from lucide-react
import { Send, XCircle, Loader, Truck, CheckCircle, Save, Calendar, Package, Eye, Info, Edit, AlertTriangle } from 'lucide-react';
import SaleDetailModal from './SaleDetailModal';
import SaleEditModal from './SaleEditModal';
import InsufficientStockModal, { InsufficientItemInfo } from './InsufficientStockModal';

const getTodayString = () => new Date().toISOString().split('T')[0];

const ShipmentManagement: React.FC<{ userRole: 'admin' | 'staff' | null }> = ({ userRole }) => {
  const [pendingSales, setPendingSales] = useState<Sale[]>([]);
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [indexErrorUrl, setIndexErrorUrl] = useState<string | null>(null);
  
  // State lưu trữ shipper được chọn tạm thời cho từng đơn hàng: { saleId: shipperId }
  const [selectedShippers, setSelectedShippers] = useState<Record<string, string>>({});
  // State lưu trữ ngày gửi được chọn tạm thời cho từng đơn hàng: { saleId: dateString }
  const [selectedDates, setSelectedDates] = useState<Record<string, string>>({});

  // Modal state
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSaleEdit, setSelectedSaleEdit] = useState<Sale | null>(null);
  
  // Data for edit modal
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockAlertModalData, setStockAlertModalData] = useState<{
    isOpen: boolean;
    saleId: string;
    warehouseName: string;
    items: InsufficientItemInfo[];
  } | null>(null);

  useEffect(() => {
    // Fetch auxiliary data for edit modal
    const fetchAuxData = async () => {
        try {
            const [custSnap, paySnap, prodSnap, whSnap] = await Promise.all([
                getDocs(query(collection(db, "customers"), orderBy("name"))),
                getDocs(query(collection(db, "paymentMethods"), orderBy("name"))),
                getDocs(query(collection(db, "products"), orderBy("name"))),
                getDocs(query(collection(db, "warehouses"), orderBy("name")))
            ]);
            setCustomers(custSnap.docs.map(d => ({id: d.id, ...d.data()} as Customer)));
            setPaymentMethods(paySnap.docs.map(d => ({id: d.id, ...d.data()} as PaymentMethod)));
            setProducts(prodSnap.docs.map(d => ({id: d.id, ...d.data()} as Product)));
            setWarehouses(whSnap.docs.map(d => ({id: d.id, ...d.data()} as Warehouse)));
        } catch (e) { console.error(e); }
    };
    fetchAuxData();

    setLoading(true);
    setError(null);
    setIndexErrorUrl(null);
    
    // Lấy danh sách đơn hàng: Chưa giao (pending) HOẶC Đặt hàng (order)
    const q = query(
      collection(db, "sales"),
      where("shippingStatus", "in", ["pending", "order"]),
      orderBy("createdAt", "desc")
    );

    const unsubscribeSales = onSnapshot(q, (snapshot) => {
      const data: Sale[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Sale);
      });
      setPendingSales(data);
      setLoading(false);
    }, (err: any) => {
      console.error("Error fetching pending sales: ", err);
      const message = err.message || '';
      if (err.code === 'failed-precondition' && message.includes('index')) {
          const urlRegex = /(https?:\/\/[^\s]+)/;
          const match = message.match(urlRegex);
          if (match && match[0]) {
              setIndexErrorUrl(match[0]);
              setError("Lỗi truy vấn: Chức năng này yêu cầu một chỉ mục (index) trong cơ sở dữ liệu.");
          } else {
              setError("Không thể tải đơn hàng. Lỗi có thể do thiếu chỉ mục (index) trong Firestore.");
          }
      } else {
          setError("Không thể tải danh sách đơn hàng cần gửi.");
      }
      setLoading(false);
    });

    // Lấy danh sách Shipper để hiển thị trong dropdown
    const unsubscribeShippers = onSnapshot(query(collection(db, "shippers"), orderBy("name")), (snapshot) => {
        setShippers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shipper)));
    });

    return () => {
        unsubscribeSales();
        unsubscribeShippers();
    };
  }, []);

  const handleShipperChange = (saleId: string, shipperId: string) => {
      setSelectedShippers(prev => ({
          ...prev,
          [saleId]: shipperId
      }));
  };

  const handleDateChange = (saleId: string, date: string) => {
      setSelectedDates(prev => ({
          ...prev,
          [saleId]: date
      }));
  };

  const handleViewDetails = (sale: Sale) => {
      setSelectedSale(sale);
      setIsDetailModalOpen(true);
  };

  const handleEdit = (sale: Sale) => {
      setSelectedSaleEdit(sale);
      setIsEditModalOpen(true);
  };

  const handleUpdateShipment = async (sale: Sale) => {
    setUpdatingId(sale.id);
    try {
      const newShipperId = selectedShippers[sale.id] !== undefined ? selectedShippers[sale.id] : sale.shipperId;
      const dateString = selectedDates[sale.id] || getTodayString();
      const dateObj = new Date(dateString);
      const now = new Date();
      dateObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      const shippedTimestamp = Timestamp.fromDate(dateObj);

      if (!newShipperId) {
          alert("Vui lòng chọn Đơn vị vận chuyển.");
          return;
      }
      
      const selectedShipperObj = shippers.find(s => s.id === newShipperId);
      const newShipperName = selectedShipperObj ? selectedShipperObj.name : (sale.shipperName || 'Không rõ');

      const saleRef = doc(db, 'sales', sale.id);

      // Nếu đơn hàng ban đầu ở chế độ "Đặt hàng" (order): Lúc tạo đơn chưa trừ tồn kho.
      // Khi xuất kho / giao hàng, BẮT BUỘC phải kiểm tra kho xem có đủ hàng không!
      if (sale.shippingStatus === 'order') {
        const targetWhId = sale.warehouseId || (warehouses.length > 0 ? warehouses[0].id : '');
        const targetWhName = sale.warehouseName || warehouses.find(w => w.id === targetWhId)?.name || 'Kho Mặc định';

        if (!targetWhId) {
          alert("Lỗi: Không tìm thấy thông tin kho hàng để kiểm tra tồn kho xuất!");
          return;
        }

        const batch = writeBatch(db);
        const insufficientErrors: InsufficientItemInfo[] = [];

        // Kiểm tra tồn kho từng sản phẩm trong kho của đơn hàng
        for (const item of (sale.items || [])) {
          if (item.isCombo) {
            const prodDoc = await getDoc(doc(db, 'products', item.productId));
            const comboItems = prodDoc.data()?.comboItems || [];
            for (const cItem of comboItems) {
              const reqQty = (cItem.quantity || 1) * item.quantity;
              const invSnap = await getDoc(doc(db, 'products', cItem.productId, 'inventory', targetWhId));
              const curStock = invSnap.exists() ? (invSnap.data()?.stock || 0) : 0;
              if (curStock < reqQty) {
                insufficientErrors.push({
                  productId: cItem.productId,
                  productName: cItem.productName || item.productName,
                  requiredQty: reqQty,
                  currentStock: curStock,
                  missingQty: reqQty - curStock
                });
              } else {
                batch.set(doc(db, 'products', cItem.productId, 'inventory', targetWhId), {
                  stock: increment(-reqQty),
                  warehouseId: targetWhId,
                  warehouseName: targetWhName
                }, { merge: true });
                if (sale.issueInvoice) {
                  batch.update(doc(db, 'products', cItem.productId), { totalInvoicedStock: increment(-reqQty) });
                }
              }
            }
          } else {
            const invSnap = await getDoc(doc(db, 'products', item.productId, 'inventory', targetWhId));
            const curStock = invSnap.exists() ? (invSnap.data()?.stock || 0) : 0;
            if (curStock < item.quantity) {
              insufficientErrors.push({
                productId: item.productId,
                productName: item.productName,
                requiredQty: item.quantity,
                currentStock: curStock,
                missingQty: item.quantity - curStock
              });
            } else {
              batch.set(doc(db, 'products', item.productId, 'inventory', targetWhId), {
                stock: increment(-item.quantity),
                warehouseId: targetWhId,
                warehouseName: targetWhName
              }, { merge: true });
              if (sale.issueInvoice) {
                batch.update(doc(db, 'products', item.productId), { totalInvoicedStock: increment(-item.quantity) });
              }
            }
          }
        }

        if (insufficientErrors.length > 0) {
          setStockAlertModalData({
            isOpen: true,
            saleId: sale.id,
            warehouseName: targetWhName,
            items: insufficientErrors
          });
          alert(`KHÔNG ĐỦ HÀNG TRONG KHO ĐỂ XUẤT ĐƠN HÀNG #${sale.id.substring(0,8).toUpperCase()}!\n\nKho: ${targetWhName}\n\nChi tiết sản phẩm thiếu:\n` + insufficientErrors.map(i => `• ${i.productName}: Cần ${i.requiredQty}, Tồn ${i.currentStock} (Thiếu ${i.missingQty})`).join('\n') + `\n\n=> Vui lòng nhập thêm hàng vào kho trước khi xuất kho!`);
          return;
        }

        batch.update(saleRef, {
          shippingStatus: 'shipped',
          shippedAt: shippedTimestamp,
          shipperId: newShipperId,
          shipperName: newShipperName,
          warehouseId: targetWhId,
          warehouseName: targetWhName
        });

        await batch.commit();
        alert(`Đã xuất kho và cập nhật đơn #${sale.id.substring(0,8).toUpperCase()} thành công!`);
      } else {
        // Đơn "Chờ gửi" (pending) đã trừ kho từ lúc tạo đơn, chỉ cập nhật trạng thái
        await updateDoc(saleRef, {
          shippingStatus: 'shipped', 
          shippedAt: shippedTimestamp,
          shipperId: newShipperId,
          shipperName: newShipperName
        });
        alert(`Đã cập nhật trạng thái đơn #${sale.id.substring(0,8).toUpperCase()} thành công!`);
      }

    } catch (err) {
      console.error("Error updating sale status: ", err);
      alert("Đã xảy ra lỗi khi cập nhật trạng thái đơn hàng.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <SaleDetailModal 
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        sale={selectedSale}
        userRole={userRole}
      />
      <SaleEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        sale={selectedSaleEdit}
        customers={customers}
        paymentMethods={paymentMethods}
        shippers={shippers}
        products={products}
      />
      <InsufficientStockModal 
        isOpen={!!stockAlertModalData?.isOpen}
        onClose={() => setStockAlertModalData(null)}
        saleId={stockAlertModalData?.saleId || ''}
        warehouseName={stockAlertModalData?.warehouseName || ''}
        items={stockAlertModalData?.items || []}
      />

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-dark flex items-center">
          <Send size={28} className="mr-3 text-primary"/>
          Quản Lý Vận Đơn (Gửi Hàng)
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden border-2 border-slate-200">
        <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-center text-blue-700">
            <Info size={18} className="mr-2"/>
            <span className="text-sm font-bold uppercase">Lưu ý: Hệ thống đã trừ kho ngay khi bạn tạo đơn. Hành động này chỉ để xác nhận ngày gửi thực tế.</span>
        </div>
        {loading ? (
          <div className="p-10 flex justify-center items-center"><Loader className="animate-spin text-primary" size={32} /></div>
        ) : error ? (
           <div className="p-10 flex flex-col justify-center items-center text-red-600 bg-red-50 rounded-lg">
             <XCircle size={32} className="mb-2"/>
             <p className="font-bold text-center">{error}</p>
              {indexErrorUrl && (
                <div className="mt-4 text-center text-sm text-red-700">
                    <p>Firebase yêu cầu một chỉ mục tổng hợp để chạy truy vấn này.</p>
                    <a 
                        href={indexErrorUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-2 inline-block bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition"
                    >
                        Tạo chỉ mục ngay
                    </a>
                </div>
             )}
           </div>
        ) : pendingSales.length === 0 ? (
          <div className="p-10 text-center text-neutral">
            <CheckCircle size={48} className="mx-auto mb-4 text-green-400"/>
            <h3 className="text-xl font-semibold">Không còn đơn hàng chờ gửi</h3>
            <p className="mt-1">Tất cả các đơn đã được hạch toán vận chuyển xong.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-4 text-xs font-black uppercase text-slate-500">Mã / Ngày tạo</th>
                  <th className="p-4 text-xs font-black uppercase text-slate-500">Đối tác</th>
                  <th className="p-4 text-xs font-black uppercase text-slate-500">Giá trị</th>
                  <th className="p-4 text-xs font-black uppercase text-slate-500">Loại đơn</th>
                  <th className="p-4 text-xs font-black uppercase text-slate-500" style={{minWidth: '200px'}}>Đơn vị vận chuyển</th>
                  <th className="p-4 text-xs font-black uppercase text-slate-500" style={{minWidth: '160px'}}>Ngày giao hàng</th>
                  <th className="p-4 text-xs font-black uppercase text-slate-500 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pendingSales.map((sale) => {
                  const currentShipperId = selectedShippers[sale.id] !== undefined ? selectedShippers[sale.id] : (sale.shipperId || "");
                  const currentDate = selectedDates[sale.id] || getTodayString();

                  return (
                  <tr key={sale.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-neutral text-sm">
                        <div className="font-black text-dark uppercase tracking-tighter">#{sale.id.substring(0,8)}</div>
                        <div className="text-[10px] font-bold text-slate-400">{sale.createdAt?.toDate().toLocaleDateString('vi-VN')}</div>
                    </td>
                    <td className="p-4 font-black text-slate-800 uppercase text-xs">{sale.customerName || 'Khách vãng lai'}</td>
                    <td className="p-4 font-black text-primary">
                        {(sale.total || 0).toLocaleString('vi-VN')} ₫
                    </td>
                    <td className="p-4">
                        {sale.shippingStatus === 'order' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-purple-100 text-purple-700 border border-purple-200">
                                <Package size={12} className="mr-1"/> Đặt Hàng
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-yellow-50 text-yellow-700 border border-yellow-200">
                                <Truck size={12} className="mr-1"/> Chờ Gửi
                            </span>
                        )}
                    </td>
                    <td className="p-4">
                        <div className="relative">
                            <Truck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <select 
                                value={currentShipperId} 
                                onChange={(e) => handleShipperChange(sale.id, e.target.value)}
                                className="w-full pl-10 pr-3 py-2 bg-white text-dark border-2 border-slate-200 rounded-lg text-xs font-black focus:ring-2 focus:ring-primary outline-none appearance-none shadow-sm"
                            >
                                <option value="">-- Chọn ĐVVC --</option>
                                {shippers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </td>
                    <td className="p-4">
                        <input 
                            type="date" 
                            value={currentDate} 
                            onChange={(e) => handleDateChange(sale.id, e.target.value)}
                            className="w-full px-3 py-2 bg-white text-dark border-2 border-slate-200 rounded-lg text-xs font-black focus:ring-2 focus:ring-primary outline-none shadow-sm cursor-pointer"
                            style={{ colorScheme: 'light' }}
                        />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleViewDetails(sale)}
                            className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-primary hover:text-white transition shadow-sm border border-blue-100"
                            title="Xem chi tiết"
                          >
                              <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleEdit(sale)}
                            className="p-2 text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-600 hover:text-white transition shadow-sm border border-amber-100"
                            title="Chỉnh sửa đơn hàng"
                          >
                              <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleUpdateShipment(sale)}
                            disabled={updatingId === sale.id || !currentShipperId}
                            className={`flex items-center space-x-2 px-4 py-2 text-white text-xs font-black uppercase rounded-lg transition shadow-lg active:scale-95 disabled:bg-slate-200 disabled:shadow-none disabled:text-slate-400 ${sale.shippingStatus === 'order' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                          >
                            {updatingId === sale.id ? <Loader size={16} className="animate-spin"/> : <Save size={16} />}
                            <span>{sale.shippingStatus === 'order' ? 'Xuất Kho' : 'Cập nhật'}</span>
                          </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShipmentManagement;
