
import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot as onDocSnapshot, setDoc, collection, query, where, onSnapshot, getDocs, collectionGroup, updateDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './services/firebase';
import FirebaseSetupGuide from './components/FirebaseSetupGuide';
import ProductManagement from './components/ProductManagement';
import SalesTerminal from './components/SalesTerminal';
import Dashboard from './components/Dashboard';
import ManufacturerManagement from './components/ManufacturerManagement';
import SupplierManagement from './components/SupplierManagement';
import WarehouseManagement from './components/WarehouseManagement';
import CustomerManagement from './components/CustomerManagement';
import ShippingManagement from './components/ShippingManagement';
import PaymentMethodManagement from './components/PaymentMethodManagement';
import AccountManagement from './components/AccountManagement';
import GoodsReceipt from './components/GoodsReceipt';
import InventoryMatrix from './components/InventoryMatrix';
import ShipmentManagement from './components/ShipmentManagement';
import InventoryAlerts from './components/InventoryAlerts';
import OutsideStockAlerts from './components/OutsideStockAlerts'; 
import DebtManagement from './components/DebtManagement';
import QuotationManagement from './components/QuotationManagement';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import LandingPage from './components/LandingPage';
import ChinaImportManagement from './components/ChinaImportManagement';
import ProductAnalytics from './components/ProductAnalytics';
import SupplierAnalytics from './components/SupplierAnalytics';
import CustomerAnalytics from './components/CustomerAnalytics';
import InventoryLedger from './components/InventoryLedger';
import PriceComparison from './components/PriceComparison';
import SupplierPaymentHistory from './components/SupplierPaymentHistory';
import PlannedOrderManagement from './components/PlannedOrderManagement';
import NoteManagement from './components/NoteManagement';
import SavingsManagement from './components/SavingsManagement';
import RestockPredictions from './components/RestockPredictions';
import { Search, Home, Package, ShoppingCart, CheckCircle, Building, Users, Warehouse, Contact, Settings, Truck, CreditCard, Archive, Send, AlertTriangle, LayoutDashboard, Wallet, LogOut, UserCircle, LogIn, FileText, Plane, Bell, BarChart3, PieChart, History, BarChart2, CheckCheck, ClipboardList, Landmark, StickyNote, PiggyBank, PackageSearch, Clock, RotateCw } from 'lucide-react';

type View = 'home' | 'login' | 'dashboard' | 'products' | 'sales' | 'goodsReceipt' | 'manufacturers' | 'suppliers' | 'customers' | 'warehouses' | 'shippers' | 'paymentMethods' | 'accounts' | 'setup' | 'inventoryMatrix' | 'shipmentManagement' | 'inventoryAlerts' | 'outsideStockAlerts' | 'debtManagement' | 'users' | 'quotations' | 'chinaImport' | 'productAnalytics' | 'supplierAnalytics' | 'customerAnalytics' | 'inventoryLedger' | 'priceComparison' | 'supplierPaymentHistory' | 'plannedOrders' | 'notes' | 'savings' | 'restockPredictions';

const App: React.FC = () => {
  const [view, setView] = useState<View>(() => {
    try {
      const savedView = localStorage.getItem('currentView');
      return (savedView && savedView !== 'login') ? (savedView as View) : 'home';
    } catch (e) {
      console.warn('LocalStorage access failed:', e);
      return 'home';
    }
  });

  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSearch, setSettingsSearch] = useState("");
  const settingsRef = useRef<HTMLDivElement>(null);
  
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 250);
  };

  const formatDateTime = (date: Date) => {
    const weekdays = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const weekday = weekdays[date.getDay()];
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return {
      weekday,
      dateStr: `${day}/${month}/${year}`,
      timeStr: `${hours}:${minutes}:${seconds}`,
      fullStr: `${weekday}, ${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
    };
  };

  useEffect(() => {
    if (view !== 'login' && view !== 'setup') {
      try {
        localStorage.setItem('currentView', view);
      } catch (e) {
        console.warn('LocalStorage write failed:', e);
      }
    }
  }, [view]);

  useEffect(() => {
    // Safety timeout to ensure app loads even if Firebase hangs
    const timeout = setTimeout(() => {
      if (authLoading) {
        console.warn('Auth loading timeout reach, forcing load...');
        setAuthLoading(false);
      }
    }, 6000);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
          setUserRole(null);
          setAuthLoading(false);
      }
    });

    try {
      if (isFirebaseConfigured && !sessionStorage.getItem('firebaseConnected')) {
        setShowSuccessToast(true);
        sessionStorage.setItem('firebaseConnected', 'true');
        setTimeout(() => {
          setShowSuccessToast(false);
        }, 5000);
      }
    } catch (e) {
      console.warn('SessionStorage access failed:', e);
    }
    
    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Auto-heal inventory documents missing warehouseId
  useEffect(() => {
    if (user && isFirebaseConfigured) {
      getDocs(query(collectionGroup(db, 'inventory')))
        .then(snapshot => {
          snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.warehouseId) {
              updateDoc(docSnap.ref, { warehouseId: docSnap.id }).catch(() => {});
            }
          });
        })
        .catch(err => console.warn('Auto-heal inventory skipped:', err));
    }
  }, [user]);

  // Lấy vai trò người dùng từ Firestore
  useEffect(() => {
      if (user) {
          const unsubRole = onDocSnapshot(doc(db, "users", user.uid), (docSnap) => {
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  const role = data.role as 'admin' | 'staff';
                  setUserRole(role);
                  
                  // Update provider if missing or update to the actual login method
                  if (!data.provider || data.provider === 'system') {
                      const isGoogle = user.providerData.some(p => p.providerId === 'google.com');
                      if (isGoogle && data.provider !== 'google') {
                          setDoc(doc(db, "users", user.uid), { provider: 'google' }, { merge: true }).catch(console.error);
                      } else if (!isGoogle && data.provider !== 'system') {
                          setDoc(doc(db, "users", user.uid), { provider: 'system' }, { merge: true }).catch(console.error);
                      }
                  }

                  // Nếu là nhân viên mà đang ở trang cấm, đẩy về trang bán hàng
                  const adminOnlyViews: View[] = [
                      'dashboard', 'products', 'manufacturers', 'suppliers', 'customers', 
                      'warehouses', 'shippers', 'paymentMethods', 'accounts', 'inventoryMatrix', 
                      'shipmentManagement', 'inventoryAlerts', 'outsideStockAlerts', 
                      'debtManagement', 'users', 'quotations', 'chinaImport', 
                      'productAnalytics', 'supplierAnalytics', 'customerAnalytics', 'inventoryLedger', 
                      'priceComparison', 'supplierPaymentHistory', 'plannedOrders', 'notes', 'savings'
                  ];
                  
                  if (role === 'staff' && adminOnlyViews.includes(view)) {
                      setView('sales');
                  }
              } else {
                  // Không tự động tạo user mới nữa (theo yêu cầu của bạn)
                  // Chỉ có tài khoản admin gốc (tieuquocthanh@gmail.com) mới được tự động tạo nếu chưa có
                  if (user.email === 'tieuquocthanh@gmail.com') {
                      setUserRole('admin');
                      setDoc(doc(db, "users", user.uid), {
                          email: user.email,
                          displayName: user.displayName || user.email?.split('@')[0] || '',
                          role: 'admin',
                          createdAt: new Date().toISOString(),
                          provider: 'google'
                      }).catch(console.error);
                  } else {
                      // Nếu user không có trong danh sách được admin tạo, không cho phép truy cập
                      signOut(auth).then(() => {
                          alert("Tài khoản của bạn chưa được cấp quyền truy cập. Vui lòng liên hệ Admin để được tạo tài khoản.");
                      });
                  }
              }
              setAuthLoading(false);
          }, (err) => {
              console.error("Error fetching user role:", err);
              setAuthLoading(false);
          });
          return () => unsubRole();
      }
  }, [user, view]);

  useEffect(() => {
      if (user && view === 'login') {
          let lastView: View | null = null;
          try {
              lastView = localStorage.getItem('currentView') as View;
          } catch (e) {
              console.warn('LocalStorage access failed:', e);
          }
          setView(lastView && lastView !== 'login' ? lastView : 'home');
      }
  }, [user, view]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  const [unreadSalesCount, setUnreadSalesCount] = useState(0);
  const [unreadReceiptsCount, setUnreadReceiptsCount] = useState(0);

  const [lastViewedSales, setLastViewedSales] = useState(() => parseInt(localStorage.getItem('lastViewedSales') || Date.now().toString()));
  const [lastViewedReceipts, setLastViewedReceipts] = useState(() => parseInt(localStorage.getItem('lastViewedReceipts') || Date.now().toString()));

  useEffect(() => {
      if (view === 'sales') {
          const now = Date.now();
          setLastViewedSales(now);
          localStorage.setItem('lastViewedSales', now.toString());
      }
      if (view === 'goodsReceipt') {
          const now = Date.now();
          setLastViewedReceipts(now);
          localStorage.setItem('lastViewedReceipts', now.toString());
      }
  }, [view]);

  useEffect(() => {
      if (!user) return;
      const q = query(collection(db, 'sales'), where('createdAt', '>', new Date(lastViewedSales)));
      const unsub = onSnapshot(q, (snap) => setUnreadSalesCount(snap.docs.length));
      return () => unsub();
  }, [user, lastViewedSales]);

  useEffect(() => {
      if (!user) return;
      const q = query(collection(db, 'goodsReceipts'), where('createdAt', '>', new Date(lastViewedReceipts)));
      const unsub = onSnapshot(q, (snap) => setUnreadReceiptsCount(snap.docs.length));
      return () => unsub();
  }, [user, lastViewedReceipts]);

  useEffect(() => {
      const total = unreadSalesCount + unreadReceiptsCount;
      try {
          if (total > 0) {
              if (navigator && 'setAppBadge' in navigator) {
                  (navigator as any).setAppBadge(total).catch((e: any) => console.error("AppBadge Error:", e));
              }
          } else {
              if (navigator && 'clearAppBadge' in navigator) {
                  (navigator as any).clearAppBadge().catch((e: any) => console.error("AppBadge Error:", e));
              }
          }
      } catch(e) {
          console.error("AppBadge Sync Error:", e);
      }
  }, [unreadSalesCount, unreadReceiptsCount]);

  const handleLogout = async () => {
      await signOut(auth);
      try {
          localStorage.removeItem('currentView');
      } catch (e) {
          console.warn('LocalStorage remove failed:', e);
      }
      setView('home');
      setIsSettingsOpen(false);
      alert("Đã đăng xuất thành công.");
  };

  const navigateTo = (target: View | 'settings_menu') => {
      if (target === 'settings_menu') {
          setView(userRole === 'admin' ? 'products' : 'sales');
      } else {
          setView(target as View);
      }
  };

  const renderView = () => {
    if (view === 'home') return <LandingPage onNavigate={navigateTo} user={user} userRole={userRole} />;
    if (view === 'login') return <Login onBack={() => setView('home')} />;
    if (view === 'setup') return <FirebaseSetupGuide />;

    if (!user) return <Login />;

    switch (view) {
      case 'dashboard': return <Dashboard />;
      case 'products': return <ProductManagement userRole={userRole} />;
      case 'sales': return <SalesTerminal userRole={userRole} user={user} />;
      case 'goodsReceipt': return <GoodsReceipt userRole={userRole} user={user} />;
      case 'manufacturers': return <ManufacturerManagement />;
      case 'suppliers': return <SupplierManagement />;
      case 'customers': return <CustomerManagement />;
      case 'warehouses': return <WarehouseManagement />;
      case 'inventoryMatrix': return <InventoryMatrix user={user} />;
      case 'shipmentManagement': return <ShipmentManagement userRole={userRole} />;
      case 'inventoryAlerts': return <InventoryAlerts />;
      case 'outsideStockAlerts': return <OutsideStockAlerts />;
      case 'debtManagement': return <DebtManagement />;
      case 'shippers': return <ShippingManagement />;
      case 'paymentMethods': return <PaymentMethodManagement />;
      case 'accounts': return <AccountManagement />;
      case 'users': return <UserManagement />;
      case 'quotations': return <QuotationManagement />;
      case 'chinaImport': return <ChinaImportManagement />;
      case 'productAnalytics': return <ProductAnalytics />;
      case 'supplierAnalytics': return <SupplierAnalytics />;
      case 'customerAnalytics': return <CustomerAnalytics />;
      case 'inventoryLedger': return <InventoryLedger userRole={userRole} />;
      case 'priceComparison': return <PriceComparison />;
      case 'supplierPaymentHistory': return <SupplierPaymentHistory />;
      case 'plannedOrders': return <PlannedOrderManagement user={user} />;
      case 'notes': return <NoteManagement user={user} />;
      case 'savings': return <SavingsManagement user={user} />;
      case 'restockPredictions': return <RestockPredictions />;
      default: return <SalesTerminal userRole={userRole} user={user} />;
    }
  };

  const NavItem: React.FC<{
    targetView: View;
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
    onClick?: () => void;
  
    badgeCount?: number;
  }> = ({ targetView, icon, label, disabled = false, onClick, badgeCount = 0 }) => {
    const isActive = view === targetView;
    const baseClasses = 'flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium relative';
    const activeClasses = 'bg-primary text-white shadow';
    const inactiveClasses = 'text-neutral hover:bg-slate-100 hover:text-dark';
    const disabledClasses = 'text-slate-400 cursor-not-allowed';

    const handleClick = () => {
        if(onClick) onClick();
        if (!disabled) setView(targetView);
    }

    return (
      <button
        onClick={handleClick}
        className={`${baseClasses} ${disabled ? disabledClasses : (isActive ? activeClasses : inactiveClasses)}`}
        disabled={disabled}
      >
        {icon}
        <span className="hidden md:inline">{label}</span>
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border border-white shadow-sm flex items-center justify-center">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>
    );
  };
  
  const SettingsItem: React.FC<{
    targetView: View;
    icon: React.ReactNode;
    label: string;
  }> = ({ targetView, icon, label }) => {
     const isActive = view === targetView;
     return (
        <button
            onClick={() => {
                setView(targetView);
                setIsSettingsOpen(false);
            }}
            className={`w-full text-left flex items-center space-x-3 px-3 py-2 rounded-md text-sm ${isActive ? 'bg-primary text-white' : 'text-neutral hover:bg-slate-100'}`}
        >
           {icon}
           <span>{label}</span>
        </button>
     )
  }

  if (authLoading) {
      return (
          <div className="h-[100dvh] flex items-center justify-center bg-slate-100">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
      )
  }

  const isAdmin = userRole === 'admin';

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-100 font-sans">
      <header className="w-full bg-white shadow-md p-3 z-20 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex flex-col">
              <div className="text-xl font-bold text-primary cursor-pointer flex items-center hover:opacity-90 transition-opacity" onClick={() => setView('home')}>
                <Home className="mr-2"/> Kho & Bán Hàng
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                {user && (
                  <div className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1"></span>
                    <UserCircle size={12} className="mr-1 text-emerald-600"/> 
                    <span className="truncate max-w-[140px] sm:max-w-none">{user.displayName || user.email?.split('@')[0]} đang làm việc</span>
                  </div>
                )}
                {(() => {
                  const dt = formatDateTime(currentDateTime);
                  return (
                    <div className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 flex items-center tracking-tight">
                      <Clock size={11} className="mr-1 text-primary"/>
                      <span>{dt.weekday}, {dt.dateStr}</span>
                      <span className="mx-1 text-slate-300">|</span>
                      <span className="font-mono font-black text-primary">{dt.timeStr}</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            <button 
              onClick={handleRefresh}
              title="Làm mới / Tải lại hệ thống"
              className="p-1.5 text-slate-500 hover:text-primary hover:bg-slate-100 active:scale-95 rounded-lg border border-slate-200 hover:border-primary/40 transition-all shadow-sm flex items-center justify-center shrink-0 self-center"
            >
              <RotateCw size={15} className={`${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            </button>
          </div>
          
          <nav className="flex items-center space-x-1">
            {view !== 'home' && (
                <button 
                    onClick={() => setView('home')}
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg text-neutral hover:bg-slate-100 text-sm font-medium md:hidden"
                >
                    <Home size={18}/>
                </button>
            )}

            {isAdmin && <NavItem targetView="dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" />}
            <NavItem targetView="sales" icon={<ShoppingCart size={18} />} label="Bán Hàng" badgeCount={unreadSalesCount} />
            <NavItem targetView="goodsReceipt" icon={<Archive size={18} />} label="Nhập Hàng" badgeCount={unreadReceiptsCount} />

            {isAdmin && (
                <>
                    <div className="h-6 w-px bg-slate-200 mx-2"></div>
                    <div className="relative" ref={settingsRef}>
                        <button
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${isSettingsOpen ? 'bg-slate-100 text-dark' : 'text-neutral hover:bg-slate-100 hover:text-dark'}`}
                        >
                            <Settings size={18} />
                            <span className="hidden md:inline">Quản Lý & Cài Đặt</span>
                        </button>
                        {isSettingsOpen && (
                            
<div className="absolute top-full right-0 mt-2 w-[300px] bg-white rounded-lg shadow-xl border border-slate-200 p-2 animate-fade-in-down z-50 flex flex-col max-h-[80vh]">
    <div className="px-2 pb-2 border-b border-slate-100 sticky top-0 bg-white z-10 shrink-0">
        <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
            <input 
                type="text" 
                autoFocus
                placeholder="Tìm chức năng..." 
                value={settingsSearch}
                onChange={(e) => setSettingsSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary focus:bg-white transition-colors"
            />
        </div>
    </div>
    
    <div className="overflow-y-auto pt-2 flex-1">
        {(() => {
            const sections = [
                {
                    title: "Tài Chính",
                    items: [
                        { targetView: "savings" as View, icon: <PiggyBank size={16}/>, label: "Sổ tiết kiệm" },
                        { targetView: "accounts" as View, icon: <Landmark size={16}/>, label: "Quản Lý Tài Khoản" },
                        { targetView: "debtManagement" as View, icon: <Wallet size={16}/>, label: "Quản Lý Công Nợ" }
                    ]
                },
                {
                    title: "Mua Hàng",
                    items: [
                        { targetView: "restockPredictions" as View, icon: <PackageSearch size={16}/>, label: "Gợi Ý Nhập Hàng" },
                        { targetView: "plannedOrders" as View, icon: <ClipboardList size={16}/>, label: "Dự kiến đặt hàng" },
                        { targetView: "chinaImport" as View, icon: <Plane size={16}/>, label: "Nhập Hàng TQ" }
                    ]
                },
                {
                    title: "Truy Vết & Báo Cáo",
                    items: [
                        { targetView: "supplierPaymentHistory" as View, icon: <CheckCheck size={16}/>, label: "Truy Vết Trả Tiền NCC" },
                        { targetView: "priceComparison" as View, icon: <BarChart2 size={16}/>, label: "So Sánh Giá Nhập" },
                        { targetView: "inventoryLedger" as View, icon: <History size={16}/>, label: "Truy Vết Tồn Kho" },
                        { targetView: "productAnalytics" as View, icon: <BarChart3 size={16}/>, label: "Hiệu Quả Sản Phẩm" },
                        { targetView: "supplierAnalytics" as View, icon: <PieChart size={16}/>, label: "Nhập Hàng Theo NCC" },
                        { targetView: "customerAnalytics" as View, icon: <PieChart size={16}/>, label: "Bán Hàng Theo Khách Hàng" }
                    ]
                },
                {
                    title: "Hàng Hóa & Đối Tác",
                    items: [
                        { targetView: "products" as View, icon: <Package size={16}/>, label: "Sản Phẩm" },
                        { targetView: "quotations" as View, icon: <FileText size={16}/>, label: "Quản Lý Báo Giá" },
                        { targetView: "customers" as View, icon: <Contact size={16}/>, label: "Khách Hàng" },
                        { targetView: "suppliers" as View, icon: <Users size={16}/>, label: "Nhà Cung Cấp" },
                        { targetView: "warehouses" as View, icon: <Warehouse size={16}/>, label: "Quản Lý Kho" },
                        { targetView: "shippers" as View, icon: <Truck size={16}/>, label: "Đơn Vị Vận Chuyển" }
                    ]
                },
                {
                    title: "Quản Lý",
                    items: [
                        { targetView: "shipmentManagement" as View, icon: <Send size={16}/>, label: "Quản Lý Vận Đơn" },
                        { targetView: "inventoryAlerts" as View, icon: <AlertTriangle size={16}/>, label: "Cảnh Báo Tồn Kho" },
                        { targetView: "outsideStockAlerts" as View, icon: <Bell size={16}/>, label: "Cảnh Báo Kho Ngoài" },
                        { targetView: "notes" as View, icon: <StickyNote size={16}/>, label: "Ghi chú hệ thống" }
                    ]
                },
                {
                    title: "Cấu Hình",
                    items: [
                        { targetView: "users" as View, icon: <UserCircle size={16}/>, label: "Quản Lý Người Dùng" },
                        { targetView: "manufacturers" as View, icon: <Building size={16}/>, label: "Hãng Sản Xuất" },
                        { targetView: "paymentMethods" as View, icon: <CreditCard size={16}/>, label: "Phương Thức TT" }
                    ]
                }
            ];

            const searchTerm = settingsSearch.toLowerCase();
            const filteredSections = sections.map(section => {
                const filteredItems = section.items.filter(item => item.label.toLowerCase().includes(searchTerm));
                return { ...section, items: filteredItems };
            }).filter(section => section.items.length > 0);

            if (filteredSections.length === 0) {
                return <div className="text-center py-4 text-sm text-slate-500">Không tìm thấy chức năng nào.</div>;
            }

            return (
                <>
                    {filteredSections.map((section, idx) => (
                        <div key={section.title}>
                            {idx > 0 && <div className="my-1 h-px bg-slate-100"></div>}
                            <div className="px-3 py-1.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">{section.title}</div>
                            {section.items.map(item => (
                                <SettingsItem key={item.targetView} targetView={item.targetView} icon={item.icon} label={item.label} />
                            ))}
                        </div>
                    ))}
                </>
            );
        })()}
        
        <div className="my-1 h-px bg-slate-100"></div>
        <button onClick={handleLogout} className="w-full text-left flex items-center space-x-3 px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50">
            <LogOut size={16} />
            <span className="truncate">Đăng Xuất ({user?.email})</span>
        </button>
    </div>
</div>

                        )}
                    </div>
                </>
            )}

            {!isAdmin && user && (
                <button onClick={handleLogout} className="flex items-center space-x-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 text-sm font-medium">
                    <LogOut size={18} />
                    <span className="hidden md:inline">Đăng Xuất</span>
                </button>
            )}

            {!user && (
                <button 
                    onClick={() => setView('login')}
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover shadow"
                >
                    <LogIn size={18} />
                    <span>Đăng Nhập</span>
                </button>
            )}
            
          </nav>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto">
        {renderView()}
      </main>
      
      {showSuccessToast && (
        <div className="fixed top-5 right-5 bg-green-500 text-white py-3 px-5 rounded-lg shadow-lg flex items-center animate-fade-in-down z-50">
          <CheckCircle size={24} className="mr-3" />
          <div>
            <p className="font-bold">Hệ thống sẵn sàng!</p>
            <p className="text-sm">Đã kết nối thành công.</p>
          </div>
        </div>
      )}
       <style>{`
        @keyframes fade-in-down {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-down {
          animation: fade-in-down 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;
