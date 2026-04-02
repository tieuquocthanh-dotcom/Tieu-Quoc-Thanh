
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, where, Timestamp, getDocs, collectionGroup, writeBatch } from 'firebase/firestore';
import JSZip from 'jszip';
import { db } from '../services/firebase';
import { Sale, Product, Customer, GoodsReceipt } from '../types';
import { Package, DollarSign, TrendingUp, BarChart, XCircle, Loader, ReceiptText, Users, Briefcase, Activity, ArrowUp, ArrowDown, AlertCircle, Warehouse, Wallet, Calendar, ShoppingCart, List, TableProperties, Download, ShieldCheck, Upload, ShoppingBag } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import { handleFirestoreError, OperationType } from '../utils/errorHandler';
import { setDoc, doc as firestoreDoc } from 'firebase/firestore';
import ConfirmationModal from './ConfirmationModal';

// --- HELPER COMPONENTS ---

const ProgressBar: React.FC<{ label: string; value: number; max: number; color: string; valueLabel: string }> = ({ label, value, max, color, valueLabel }) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div className="mb-3 group">
            <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-black">{label}</span>
                <span className="font-bold text-black">{valueLabel}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                    className={`h-2 rounded-full ${color} transition-all duration-500`} 
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};

const AreaChart: React.FC<{ data: { date: string; revenue: number; profit: number }[] }> = ({ data }) => {
    if (data.length === 0) return <div className="h-64 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">Chưa có dữ liệu</div>;

    const maxVal = Math.max(...data.map(d => Math.max(d.revenue, d.profit))) || 1;
    
    const getPoints = (key: 'revenue' | 'profit') => {
        return data.map((d, i) => {
            const x = (i / (data.length - 1)) * 100;
            const y = 100 - (d[key] / maxVal) * 100;
            return `${x},${y}`;
        }).join(' ');
    };

    const revenuePoints = getPoints('revenue');
    const profitPoints = getPoints('profit');

    return (
        <div className="relative h-64 w-full select-none">
            <div className="absolute inset-0 flex items-end justify-between text-[10px] text-slate-500 font-bold pb-6 px-1 pointer-events-none uppercase tracking-tighter">
                {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((d, i) => (
                    <span key={i}>{d.date.split('/')[0]}</span>
                ))}
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full pb-8 overflow-visible">
                <line x1="0" y1="25" x2="100" y2="25" stroke="#e2e8f0" strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeDasharray="4"/>
                <line x1="0" y1="50" x2="100" y2="50" stroke="#e2e8f0" strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeDasharray="4"/>
                <line x1="0" y1="75" x2="100" y2="75" stroke="#e2e8f0" strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeDasharray="4"/>
                <polygon points={`0,100 ${revenuePoints} 100,100`} fill="rgba(30, 64, 175, 0.05)" />
                <polyline points={revenuePoints} fill="none" stroke="#1e40af" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>
                <polygon points={`0,100 ${profitPoints} 100,100`} fill="rgba(5, 150, 105, 0.05)" />
                <polyline points={profitPoints} fill="none" stroke="#059669" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="absolute top-2 right-2 flex space-x-3 text-[10px] bg-white p-2 rounded-md border border-slate-200 shadow-sm font-bold text-slate-700 uppercase tracking-widest">
                <div className="flex items-center"><div className="w-3 h-1 bg-blue-700 mr-1.5 rounded-full"></div> Doanh thu</div>
                <div className="flex items-center"><div className="w-3 h-1 bg-emerald-600 mr-1.5 rounded-full"></div> Lợi nhuận</div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: string | number; color: string; subValue?: string; subLabel?: string }> = ({ icon, title, value, color, subValue, subLabel }) => (
  <div className="bg-white p-5 rounded-lg shadow-md border-l-4 border-blue-700 flex items-center space-x-4 transition-all hover:shadow-lg">
    <div className={`p-3 rounded-md text-white shadow-sm ${color}`}>
      {icon}
    </div>
    <div className="flex-1">
      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{title}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      {subValue && (
          <div className="mt-1 flex items-center text-[10px]">
              <span className={`font-bold ${subValue.startsWith('+') ? 'text-emerald-600' : 'text-slate-600'}`}>{subValue}</span>
              <span className="text-slate-400 font-bold ml-1 uppercase">{subLabel}</span>
          </div>
      )}
    </div>
  </div>
);

type DashboardTab = 'overview' | 'dailyRevenue' | 'dailyProfit';

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [inventoryRaw, setInventoryRaw] = useState<Map<string, number>>(new Map());

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isBackingUpZip, setIsBackingUpZip] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRestoringSystem, setIsRestoringSystem] = useState(false);
  const [showBackupConfirm, setShowBackupConfirm] = useState(false);
  const [showBackupZipConfirm, setShowBackupZipConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showSystemRestoreConfirm, setShowSystemRestoreConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSystemBackup = async () => {
    setIsBackingUp(true);
    try {
        const collections = [
            'products', 'sales', 'customers', 'goodsReceipts', 
            'suppliers', 'warehouses', 'paymentMethods', 'shippers', 
            'appUsers', 'chinaImports', 'plannedOrders', 'notes', 'savingsBooks'
        ];
        
        const backupData: any = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            data: {}
        };

        for (const collName of collections) {
            const snapshot = await getDocs(collection(db, collName));
            backupData.data[collName] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        }

        // Handle subcollections (inventory)
        const inventorySnapshot = await getDocs(collectionGroup(db, 'inventory'));
        backupData.data['inventory'] = inventorySnapshot.docs.map(doc => ({
            id: doc.id,
            path: doc.ref.path,
            ...doc.data()
        }));

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_quanlybanhang_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        window.dispatchEvent(new CustomEvent('app-error', { 
            detail: { message: 'Đã tải xuống bản sao lưu JSON thành công!', type: 'success' } 
        }));
    } catch (err) {
        console.error('Backup error:', err);
        handleFirestoreError(err, OperationType.GET, 'multiple_collections');
        window.dispatchEvent(new CustomEvent('app-error', { 
            detail: { message: 'Có lỗi xảy ra khi sao lưu dữ liệu.', type: 'error' } 
        }));
    } finally {
        setIsBackingUp(false);
    }
  };

  const handleZipBackup = async () => {
    setIsBackingUpZip(true);
    try {
        const zip = new JSZip();
        const collections = [
            'products', 'sales', 'customers', 'goodsReceipts', 
            'suppliers', 'warehouses', 'paymentMethods', 'shippers', 
            'appUsers', 'chinaImports', 'plannedOrders', 'notes', 'savingsBooks'
        ];

        const metadata = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            collections: collections
        };
        zip.file("metadata.json", JSON.stringify(metadata, null, 2));

        const dataFolder = zip.folder("data");
        
        for (const collName of collections) {
            const snapshot = await getDocs(collection(db, collName));
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            dataFolder?.file(`${collName}.json`, JSON.stringify(items, null, 2));
        }

        // Handle subcollections (inventory)
        const inventorySnapshot = await getDocs(collectionGroup(db, 'inventory'));
        const inventoryItems = inventorySnapshot.docs.map(doc => ({
            id: doc.id,
            path: doc.ref.path,
            ...doc.data()
        }));
        dataFolder?.file(`inventory.json`, JSON.stringify(inventoryItems, null, 2));

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_full_data_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        window.dispatchEvent(new CustomEvent('app-error', { 
            detail: { message: 'Đã tải xuống bản sao lưu ZIP thành công!', type: 'success' } 
        }));
    } catch (err) {
        console.error('ZIP Backup error:', err);
        window.dispatchEvent(new CustomEvent('app-error', { 
            detail: { message: 'Có lỗi xảy ra khi tạo file ZIP.', type: 'error' } 
        }));
    } finally {
        setIsBackingUpZip(false);
    }
  };

  const handleRestoreClick = () => {
    setShowRestoreConfirm(true);
  };

  const handleSystemRestore = async () => {
    setIsRestoringSystem(true);
    try {
        const response = await fetch('/full_backup.json');
        if (!response.ok) throw new Error('Không tìm thấy file sao lưu hệ thống.');
        
        const backupData = await response.json();
        await performRestore(backupData);
        
        window.dispatchEvent(new CustomEvent('app-error', { 
            detail: { message: 'Khôi phục dữ liệu hệ thống thành công!', type: 'success' } 
        }));
        setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
        console.error('System restore error:', err);
        window.dispatchEvent(new CustomEvent('app-error', { 
            detail: { message: 'Lỗi khôi phục hệ thống: ' + (err instanceof Error ? err.message : 'Lỗi không xác định'), type: 'error' } 
        }));
    } finally {
        setIsRestoringSystem(false);
        setShowSystemRestoreConfirm(false);
    }
  };

  const performRestore = async (backupData: any) => {
    if (!backupData.data || typeof backupData.data !== 'object') {
        throw new Error('Định dạng file sao lưu không hợp lệ.');
    }

    const batch = writeBatch(db);
    let count = 0;

    // Restore main collections
    for (const collName in backupData.data) {
        if (collName === 'inventory') continue; // Handle subcollections separately
        
        const items = backupData.data[collName];
        if (Array.isArray(items)) {
            for (const item of items) {
                const { id, ...data } = item;
                // Convert timestamp strings back to Firestore Timestamps
                Object.keys(data).forEach(key => {
                    if (data[key] && typeof data[key] === 'object' && data[key].type === 'firestore/timestamp/1.0') {
                        data[key] = new Timestamp(data[key].seconds, data[key].nanoseconds);
                    } else if ((key.endsWith('At') || key.endsWith('Date')) && typeof data[key] === 'string') {
                        data[key] = Timestamp.fromDate(new Date(data[key]));
                    }
                });

                batch.set(firestoreDoc(db, collName, id), data);
                count++;
                
                if (count % 400 === 0) {
                    await batch.commit();
                }
            }
        }
    }

    // Restore inventory subcollections
    const inventoryItems = backupData.data['inventory'];
    if (Array.isArray(inventoryItems)) {
        for (const item of inventoryItems) {
            const { id, path, ...data } = item;
            if (path) {
                batch.set(firestoreDoc(db, path), data);
                count++;
                if (count % 400 === 0) await batch.commit();
            }
        }
    }

    await batch.commit();
    return count;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    try {
        const text = await file.text();
        const backupData = JSON.parse(text);
        const count = await performRestore(backupData);

        window.dispatchEvent(new CustomEvent('app-error', { 
            detail: { message: `Khôi phục thành công ${count} bản ghi! Hệ thống sẽ tải lại.`, type: 'success' } 
        }));
        setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
        console.error('Restore error:', err);
        window.dispatchEvent(new CustomEvent('app-error', { 
            detail: { message: 'Có lỗi xảy ra khi khôi phục: ' + (err instanceof Error ? err.message : 'Lỗi không xác định'), type: 'error' } 
        }));
    } finally {
        setIsRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubProducts = onSnapshot(query(collection(db, 'products')), (snapshot) => {
        setProducts(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Product)));
    });

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const unsubSales = onSnapshot(query(collection(db, "sales"), where('createdAt', '>=', Timestamp.fromDate(sixtyDaysAgo)), orderBy('createdAt', 'desc')), (snapshot) => {
        setSales(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Sale)));
    });

    const unsubCustomers = onSnapshot(collection(db, "customers"), (snapshot) => {
        setCustomers(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Customer)));
    });

    const unsubReceipts = onSnapshot(collection(db, "goodsReceipts"), (snapshot) => {
        setGoodsReceipts(snapshot.docs.map(d => ({id: d.id, ...d.data()} as GoodsReceipt)));
    });

    const unsubInventoryRealtime = onSnapshot(collectionGroup(db, 'inventory'), (snapshot) => {
        const stockMap = new Map<string, number>();
        snapshot.forEach(doc => {
            const pid = doc.ref.parent.parent?.id;
            const qty = doc.data().stock || 0;
            if (pid) stockMap.set(pid, (stockMap.get(pid) || 0) + qty);
        });
        setInventoryRaw(stockMap);
        setLoading(false);
    });

    return () => {
        unsubProducts();
        unsubSales();
        unsubCustomers();
        unsubReceipts();
        unsubInventoryRealtime();
    }
  }, []);

  const totalInventoryValue = useMemo(() => {
      let total = 0;
      products.forEach(p => {
          const stock = inventoryRaw.get(p.id) || 0;
          total += stock * p.importPrice;
      });
      return total;
  }, [products, inventoryRaw]);

  const salesAnalysis = useMemo(() => {
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      let totalRevenue30Days = 0;
      let totalProfit30Days = 0;
      let totalRevenueMonth = 0;
      
      const dailyMap = new Map<string, {revenue: number, profit: number, orderCount: number}>();
      
      for(let i=0; i<30; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
          dailyMap.set(key, { revenue: 0, profit: 0, orderCount: 0 });
      }

      sales.forEach(sale => {
          if (!sale.createdAt) return;
          const saleDate = sale.createdAt.toDate();
          
          let saleProfit = 0;
          sale.items.forEach(item => {
             const cost = item.importPrice || 0;
             saleProfit += (item.price - cost) * item.quantity;
          });

          if (saleDate >= thirtyDaysAgo) {
              totalRevenue30Days += sale.total;
              totalProfit30Days += saleProfit;

              const dayKey = saleDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
              if (dailyMap.has(dayKey)) {
                  const current = dailyMap.get(dayKey)!;
                  current.revenue += sale.total;
                  current.profit += saleProfit;
                  current.orderCount += 1;
              }
          }

          if (saleDate >= startOfCurrentMonth) {
              totalRevenueMonth += sale.total;
          }
      });

      const chartData = Array.from(dailyMap.entries()).map(([date, val]) => ({
          date,
          revenue: val.revenue,
          profit: val.profit,
          orderCount: val.orderCount
      })).reverse();

      return {
          revenue: totalRevenue30Days,
          profit: totalProfit30Days,
          revenueMonth: totalRevenueMonth,
          chartData
      };
  }, [sales]);

  const orderStats = useMemo(() => {
      const totalOrders = sales.length;
      const pendingOrders = sales.filter(s => s.shippingStatus === 'pending').length;
      const orderOrders = sales.filter(s => s.shippingStatus === 'order').length;
      const today = new Date().toLocaleDateString('vi-VN');
      const ordersToday = sales.filter(s => s.createdAt?.toDate().toLocaleDateString('vi-VN') === today).length;
      return { totalOrders, pendingOrders, orderOrders, ordersToday };
  }, [sales]);

  const renderOverview = () => (
    <div className="animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard 
                icon={<DollarSign size={24} />} 
                title="Doanh Thu (30 ngày)" 
                value={`${formatNumber(salesAnalysis.revenue)}`}
                color="bg-blue-700"
                subValue="Tháng này"
                subLabel={formatNumber(salesAnalysis.revenueMonth)}
            />
            <StatCard 
                icon={<TrendingUp size={24} />} 
                title="Lợi Nhuận (30 ngày)" 
                value={`${formatNumber(salesAnalysis.profit)}`}
                color="bg-emerald-600"
                subValue={`${salesAnalysis.revenue > 0 ? ((salesAnalysis.profit/salesAnalysis.revenue)*100).toFixed(1) : 0}%`}
                subLabel="Tỷ suất LN"
            />
             <StatCard 
                icon={<ReceiptText size={24} />} 
                title="Đơn Hàng" 
                value={orderStats.totalOrders} 
                color="bg-indigo-600"
                subValue={`${orderStats.ordersToday}`}
                subLabel="Hôm nay"
            />
             <StatCard 
                icon={<Package size={24} />} 
                title="Giá Trị Tồn Kho" 
                value={`${formatNumber(totalInventoryValue)}`}
                color="bg-amber-500"
                subValue={`${products.length}`}
                subLabel="Sản phẩm"
            />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center">
                    <TrendingUp className="mr-2 text-blue-700" size={18} />
                    Biểu đồ doanh thu & lợi nhuận (30 ngày)
                </h3>
                <AreaChart data={salesAnalysis.chartData} />
            </div>
             <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center">
                    <ShoppingBag className="mr-2 text-blue-700" size={18} />
                    Trạng thái đơn hàng
                </h3>
                <div className="flex flex-col justify-center h-full pb-6">
                    <div className="space-y-4 mt-2">
                        <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                             <span className="flex items-center text-sm font-bold text-gray-700"><AlertCircle size={18} className="mr-3 text-yellow-600"/> Chờ giao hàng</span>
                             <span className="text-lg font-extrabold text-black">{orderStats.pendingOrders}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                             <span className="flex items-center text-sm font-bold text-gray-700"><ShoppingCart size={18} className="mr-3 text-purple-600"/> Đặt hàng</span>
                             <span className="text-lg font-extrabold text-black">{orderStats.orderOrders}</span>
                        </div>
                         <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                             <span className="flex items-center text-sm font-bold text-gray-700"><Users size={18} className="mr-3 text-blue-600"/> Khách hàng</span>
                             <span className="text-lg font-extrabold text-black">{customers.length}</span>
                        </div>
                         <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                             <span className="flex items-center text-sm font-bold text-gray-700"><Warehouse size={18} className="mr-3 text-orange-600"/> Sản phẩm</span>
                             <span className="text-lg font-extrabold text-black">{products.length}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );

  const renderDailyReport = (type: 'revenue' | 'profit') => {
    const isRevenue = type === 'revenue';
    // Sắp xếp ngày mới nhất lên đầu cho bảng
    const tableData = [...salesAnalysis.chartData].reverse();
    const maxVal = Math.max(...tableData.map(d => isRevenue ? d.revenue : d.profit)) || 1;

    return (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden animate-fade-in">
            <div className={`p-4 ${isRevenue ? 'bg-blue-600' : 'bg-green-600'} text-white flex justify-between items-center`}>
                <h3 className="font-black uppercase tracking-tight text-sm flex items-center">
                    <Calendar size={18} className="mr-2"/>
                    Báo cáo {isRevenue ? 'Doanh Thu' : 'Lợi Nhuận'} từng ngày (30 ngày)
                </h3>
                <div className="text-xs font-bold opacity-80 italic">Đơn vị: VNĐ</div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="p-4 text-xs font-black uppercase text-slate-500 tracking-widest">Ngày</th>
                            <th className="p-4 text-xs font-black uppercase text-slate-500 tracking-widest text-center">Số đơn</th>
                            <th className={`p-4 text-xs font-black uppercase tracking-widest text-right ${isRevenue ? 'text-blue-600' : 'text-green-600'}`}>
                                {isRevenue ? 'Doanh thu' : 'Lợi nhuận thực'}
                            </th>
                            <th className="p-4 text-xs font-black uppercase text-slate-500 tracking-widest w-1/3">Biểu đồ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {tableData.map((day, idx) => {
                            const value = isRevenue ? day.revenue : day.profit;
                            if (value === 0 && day.orderCount === 0) return null; // Ẩn ngày không có dữ liệu để bảng gọn hơn

                            return (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-black">{day.date}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-black text-slate-600">{day.orderCount}</span>
                                    </td>
                                    <td className={`p-4 text-right font-black ${isRevenue ? 'text-blue-700' : 'text-green-700'}`}>
                                        {formatNumber(value)} ₫
                                    </td>
                                    <td className="p-4">
                                        <ProgressBar 
                                            label="" 
                                            value={value} 
                                            max={maxVal} 
                                            color={isRevenue ? 'bg-blue-500' : 'bg-green-500'} 
                                            valueLabel={`${((value / maxVal) * 100).toFixed(0)}%`}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                        {tableData.filter(d => (isRevenue ? d.revenue : d.profit) > 0).length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-20 text-center text-slate-400 font-bold uppercase text-xs italic tracking-widest">Chưa phát sinh dữ liệu</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center uppercase tracking-tight">
            <Activity className="mr-3 text-blue-700" size={28} />
            Bảng Điều Khiển
          </h1>
          <p className="text-slate-500 text-sm font-medium">Tổng quan hoạt động kinh doanh</p>
        </div>
        
        <div className="flex items-center space-x-2 bg-white p-1 rounded-lg shadow-sm border border-slate-200">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-blue-700 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Tổng quan
          </button>
          <button 
            onClick={() => setActiveTab('dailyRevenue')}
            className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'dailyRevenue' ? 'bg-blue-700 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Doanh thu
          </button>
          <button 
            onClick={() => setActiveTab('dailyProfit')}
            className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'dailyProfit' ? 'bg-blue-700 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Lợi nhuận
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <button 
            onClick={() => setShowBackupConfirm(true)}
            disabled={isBackingUp || isBackingUpZip || isRestoring}
            className="flex items-center px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50 shadow-sm"
        >
            {isBackingUp ? <Loader size={14} className="mr-1.5 animate-spin"/> : <ShieldCheck size={14} className="mr-1.5 text-emerald-400"/>}
            {isBackingUp ? 'Đang xử lý...' : 'Sao lưu JSON'}
        </button>
        <button 
            onClick={() => setShowBackupZipConfirm(true)}
            disabled={isBackingUp || isBackingUpZip || isRestoring}
            className="flex items-center px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm"
        >
            {isBackingUpZip ? <Loader size={14} className="mr-1.5 animate-spin"/> : <Download size={14} className="mr-1.5 text-white"/>}
            {isBackingUpZip ? 'Đang nén...' : 'Sao lưu ZIP'}
        </button>
        <button 
            onClick={() => setShowSystemRestoreConfirm(true)}
            disabled={isBackingUp || isBackingUpZip || isRestoring || isRestoringSystem}
            className="flex items-center px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 shadow-sm"
        >
            {isRestoringSystem ? <Loader size={14} className="mr-1.5 animate-spin"/> : <ShieldCheck size={14} className="mr-1.5"/>}
            {isRestoringSystem ? 'Đang khôi phục...' : 'Khôi phục hệ thống'}
        </button>
        <button 
            onClick={handleRestoreClick}
            disabled={isBackingUp || isBackingUpZip || isRestoring || isRestoringSystem}
            className="flex items-center px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all bg-white text-orange-600 border border-orange-200 hover:bg-orange-50 disabled:opacity-50 shadow-sm"
        >
            {isRestoring ? <Loader size={14} className="mr-1.5 animate-spin"/> : <Upload size={14} className="mr-1.5"/>}
            {isRestoring ? 'Đang khôi phục...' : 'Khôi phục từ file'}
        </button>
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".json" 
            className="hidden" 
        />
      </div>

      {loading ? (
         <div className="flex flex-col items-center justify-center h-64 p-10 bg-white rounded-lg shadow-sm border border-slate-200">
            <Loader className="animate-spin text-blue-700 mb-4" size={40}/>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Đang tải dữ liệu...</p>
         </div>
      ) : (
        <>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'dailyRevenue' && renderDailyReport('revenue')}
            {activeTab === 'dailyProfit' && renderDailyReport('profit')}
        </>
      )}

      <ConfirmationModal 
        isOpen={showBackupConfirm}
        onClose={() => setShowBackupConfirm(false)}
        onConfirm={handleSystemBackup}
        title="Xác nhận Sao lưu JSON"
        message="Bạn có muốn tải xuống bản sao lưu toàn bộ dữ liệu hệ thống dưới dạng 1 file JSON duy nhất không?"
        confirmText="Tải xuống JSON"
        confirmColor="bg-slate-800 hover:bg-black"
      />

      <ConfirmationModal 
        isOpen={showBackupZipConfirm}
        onClose={() => setShowBackupZipConfirm(false)}
        onConfirm={handleZipBackup}
        title="Xác nhận Sao lưu ZIP"
        message="Hệ thống sẽ nén tất cả các bảng dữ liệu thành các file riêng biệt bên trong 1 file ZIP. Bạn có muốn tiếp tục không?"
        confirmText="Tải xuống ZIP"
        confirmColor="bg-blue-700 hover:bg-blue-800"
      />

      <ConfirmationModal 
        isOpen={showRestoreConfirm}
        onClose={() => setShowRestoreConfirm(false)}
        onConfirm={() => fileInputRef.current?.click()}
        title="Xác nhận Khôi phục từ file"
        message="CẢNH BÁO: Việc khôi phục dữ liệu từ file sẽ GHI ĐÈ hoặc THÊM MỚI dữ liệu hiện có. Bạn có chắc chắn muốn tiếp tục không?"
        confirmText="Tiếp tục"
        confirmColor="bg-orange-600 hover:bg-orange-700"
      />

      <ConfirmationModal 
        isOpen={showSystemRestoreConfirm}
        onClose={() => setShowSystemRestoreConfirm(false)}
        onConfirm={handleSystemRestore}
        title="Xác nhận Khôi phục từ hệ thống"
        message="Hệ thống sẽ tự động lấy dữ liệu từ các file backup có sẵn trong thư mục /data và nạp vào Firestore. Việc này sẽ ghi đè dữ liệu hiện tại. Bạn có chắc chắn muốn thực hiện không?"
        confirmText="Khôi phục ngay"
        confirmColor="bg-red-600 hover:bg-red-700"
      />
      
      <style>{`
        @keyframes fade-in {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default Dashboard;
