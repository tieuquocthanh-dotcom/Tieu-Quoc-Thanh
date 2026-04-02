
import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot as onDocSnapshot, getDocs, collection, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './services/firebase';
import ErrorBoundary from './components/ErrorBoundary';
import { notifyError, notifySuccess } from './utils/errorHandler';
import { getDocFromServer, doc as firestoreDoc } from 'firebase/firestore';

// Lazy load components for better initial performance
const ProductManagement = lazy(() => import('./components/ProductManagement'));
const SalesTerminal = lazy(() => import('./components/SalesTerminal'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const ManufacturerManagement = lazy(() => import('./components/ManufacturerManagement'));
const SupplierManagement = lazy(() => import('./components/SupplierManagement'));
const WarehouseManagement = lazy(() => import('./components/WarehouseManagement'));
const CustomerManagement = lazy(() => import('./components/CustomerManagement'));
const ShippingManagement = lazy(() => import('./components/ShippingManagement'));
const PaymentMethodManagement = lazy(() => import('./components/PaymentMethodManagement'));
const AccountManagement = lazy(() => import('./components/AccountManagement'));
const GoodsReceipt = lazy(() => import('./components/GoodsReceipt'));
const InventoryMatrix = lazy(() => import('./components/InventoryMatrix'));
const ShipmentManagement = lazy(() => import('./components/ShipmentManagement'));
const InventoryAlerts = lazy(() => import('./components/InventoryAlerts'));
const OutsideStockAlerts = lazy(() => import('./components/OutsideStockAlerts')); 
const DebtManagement = lazy(() => import('./components/DebtManagement'));
const QuotationManagement = lazy(() => import('./components/QuotationManagement'));
const Login = lazy(() => import('./components/Login'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const ChinaImportManagement = lazy(() => import('./components/ChinaImportManagement'));
const ProductAnalytics = lazy(() => import('./components/ProductAnalytics'));
const SupplierAnalytics = lazy(() => import('./components/SupplierAnalytics'));
const InventoryLedger = lazy(() => import('./components/InventoryLedger'));
const PriceComparison = lazy(() => import('./components/PriceComparison'));
const SupplierPaymentHistory = lazy(() => import('./components/SupplierPaymentHistory'));
const PlannedOrderManagement = lazy(() => import('./components/PlannedOrderManagement'));
const NoteManagement = lazy(() => import('./components/NoteManagement'));
const SavingsManagement = lazy(() => import('./components/SavingsManagement'));
import { Home, Package, ShoppingCart, CheckCircle, Building, Users, Warehouse, Contact, Settings, Truck, CreditCard, Archive, Send, AlertTriangle, LayoutDashboard, Wallet, LogOut, UserCircle, LogIn, FileText, Plane, Bell, BarChart3, PieChart, History, BarChart2, CheckCheck, ClipboardList, Landmark, StickyNote, PiggyBank } from 'lucide-react';

type View = 'welcome' | 'login' | 'dashboard' | 'products' | 'sales' | 'goodsReceipt' | 'manufacturers' | 'suppliers' | 'customers' | 'warehouses' | 'shippers' | 'paymentMethods' | 'accounts' | 'setup' | 'inventoryMatrix' | 'shipmentManagement' | 'inventoryAlerts' | 'outsideStockAlerts' | 'debtManagement' | 'users' | 'quotations' | 'chinaImport' | 'productAnalytics' | 'supplierAnalytics' | 'inventoryLedger' | 'priceComparison' | 'supplierPaymentHistory' | 'plannedOrders' | 'notes' | 'savings';

const App: React.FC = () => {
  const [view, setView] = useState<View>(() => {
      const savedView = localStorage.getItem('currentView');
      return (savedView && savedView !== 'login') ? (savedView as View) : 'welcome';
  });

  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Check for custom login on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('customUser');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setUserRole(parsedUser.role);
      setAuthLoading(false);
    }
  }, []);

  // Test connection to Firestore on boot
  useEffect(() => {
    const testConnection = async () => {
      if (!isFirebaseConfigured) return;
      try {
        // Try to fetch a non-existent doc just to test connection
        await getDocFromServer(firestoreDoc(db, 'system', 'connection_test'));
      } catch (error: any) {
        if (error?.message?.includes('the client is offline') || error?.code === 'unavailable') {
          notifyError("Không thể kết nối với máy chủ. Vui lòng kiểm tra mạng hoặc VPN.", error?.message);
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Thêm timeout để tránh việc quay liên tục trên Safari mobile khi quay lại ứng dụng
  useEffect(() => {
    if (authLoading) {
      const timer = setTimeout(() => {
        console.warn("Auth loading timed out, forcing false");
        setAuthLoading(false);
      }, 8000); // 8 giây timeout
      return () => clearTimeout(timer);
    }
  }, [authLoading]);

  useEffect(() => {
      if (view !== 'login' && view !== 'setup') {
          localStorage.setItem('currentView', view);
      }
  }, [view]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Đảm bảo cờ hasLoggedIn luôn đúng nếu có user
        localStorage.setItem('hasLoggedIn', 'true');
      } else {
        // Check if we have a custom user logged in
        const savedUser = localStorage.getItem('customUser');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          setUserRole(parsedUser.role);
          setAuthLoading(false);
          return;
        }

        // Nếu không có user, kiểm tra xem có cờ hasLoggedIn không
        // Nếu có, có thể Safari đang chậm khôi phục session, đợi thêm 1 chút
        const wasLoggedIn = localStorage.getItem('hasLoggedIn') === 'true';
        if (wasLoggedIn) {
          setTimeout(() => {
            // Kiểm tra lại sau 1.5 giây
            if (!auth.currentUser && !localStorage.getItem('customUser')) {
              setUser(null);
              setUserRole(null);
              setAuthLoading(false);
            }
          }, 1500);
        } else {
          setUser(null);
          setUserRole(null);
          setAuthLoading(false);
        }
      }
    });

    if (isFirebaseConfigured && !sessionStorage.getItem('firebaseConnected')) {
      setShowSuccessToast(true);
      sessionStorage.setItem('firebaseConnected', 'true');
      setTimeout(() => {
        setShowSuccessToast(false);
      }, 5000);
    }
  }, []);

  // Lấy vai trò người dùng từ Firestore
  useEffect(() => {
      if (user) {
          const unsubRole = onDocSnapshot(doc(db, "users", user.uid), (docSnap) => {
              if (docSnap.exists()) {
                  const role = docSnap.data().role as 'admin' | 'staff';
                  setUserRole(role);
                  
                  // Nếu là nhân viên mà đang ở trang cấm, đẩy về trang bán hàng
                  const adminOnlyViews: View[] = [
                      'dashboard', 'products', 'manufacturers', 'suppliers', 'customers', 
                      'warehouses', 'shippers', 'paymentMethods', 'accounts', 'inventoryMatrix', 
                      'shipmentManagement', 'inventoryAlerts', 'outsideStockAlerts', 
                      'debtManagement', 'users', 'quotations', 'chinaImport', 
                      'productAnalytics', 'supplierAnalytics', 'inventoryLedger', 
                      'priceComparison', 'supplierPaymentHistory', 'plannedOrders', 'notes', 'savings'
                  ];
                  
                  if (role === 'staff' && adminOnlyViews.includes(view)) {
                      setView('sales');
                  }
              } else {
                  // Mặc định là admin nếu là email chủ sở hữu, ngược lại là staff
                  const ownerEmail = "tieuquocthanh@gmail.com";
                  if (user.email === ownerEmail) {
                      setUserRole('admin');
                  } else {
                      setUserRole('staff');
                  }
              }
              setAuthLoading(false);
          }, (err) => {
              console.error("Error fetching user role:", err);
              // Fallback for owner even on error
              const ownerEmail = "tieuquocthanh@gmail.com";
              if (user.email === ownerEmail) {
                  setUserRole('admin');
              } else {
                  setUserRole('staff');
              }
              setAuthLoading(false);
          });
          return () => unsubRole();
      }
  }, [user]);

  useEffect(() => {
      if (user && view === 'login') {
          const lastView = localStorage.getItem('currentView') as View;
          setView(lastView && lastView !== 'login' ? lastView : (userRole === 'admin' ? 'dashboard' : 'sales'));
      }
  }, [user, view, userRole]);

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

  const handleLogout = async () => {
      await signOut(auth);
      localStorage.removeItem('hasLoggedIn');
      localStorage.removeItem('currentView');
      localStorage.removeItem('customUser');
      setUser(null);
      setUserRole(null);
      setView('sales');
      setIsSettingsOpen(false);
  };

  const handleCustomLogin = (userData: any) => {
    setUser(userData);
    setUserRole(userData.role);
    setView('welcome');
  };

  const LoadingFallback = () => (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Đang tải dữ liệu...</p>
      {isOffline && (
        <p className="text-[10px] text-red-500 font-bold uppercase">Bạn đang ngoại tuyến. Vui lòng kiểm tra kết nối.</p>
      )}
    </div>
  );

  const renderView = () => {
    if (view === 'login') return (
      <Suspense fallback={<LoadingFallback />}>
        <Login onBack={() => setView('welcome')} onCustomLogin={handleCustomLogin} />
      </Suspense>
    );
    // Nếu Firebase chưa được cấu hình, hiển thị thông báo (thay vì setup guide)
    if (!isFirebaseConfigured) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center border border-red-100">
                    <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Chưa cấu hình Firebase</h1>
                    <p className="text-slate-600 mb-6">Vui lòng kiểm tra file firebase-applet-config.json để đảm bảo các thông số chính xác.</p>
                </div>
            </div>
        );
    }

    if (!user) return (
      <Suspense fallback={<LoadingFallback />}>
        <Login onCustomLogin={handleCustomLogin} />
      </Suspense>
    );

    return (
      <Suspense fallback={<LoadingFallback />}>
        {(() => {
          switch (view) {
            case 'welcome': return (
              <div className="flex flex-col items-center justify-center h-full space-y-8 bg-slate-100 p-6">
                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
                  <button onClick={() => setView('sales')} className="p-8 bg-blue-700 text-white rounded shadow-md hover:bg-blue-800 transition-all flex flex-col items-center justify-center space-y-4">
                    <ShoppingCart size={48} />
                    <span className="text-xl font-bold uppercase tracking-wider">Bán Hàng</span>
                  </button>
                  <button onClick={() => setView('goodsReceipt')} className="p-8 bg-blue-600 text-white rounded shadow-md hover:bg-blue-700 transition-all flex flex-col items-center justify-center space-y-4">
                    <Archive size={48} />
                    <span className="text-xl font-bold uppercase tracking-wider">Nhập Hàng</span>
                  </button>
                  <button onClick={() => setView('inventoryMatrix')} className="p-8 bg-blue-500 text-white rounded shadow-md hover:bg-blue-600 transition-all flex flex-col items-center justify-center space-y-4">
                    <Package size={48} />
                    <span className="text-xl font-bold uppercase tracking-wider">Tồn Kho</span>
                  </button>
                </div>

                <div className="w-full max-w-4xl bg-white p-8 rounded border border-slate-200 shadow-sm">
                  <h2 className="text-2xl font-bold text-slate-800 mb-6 border-b pb-4 uppercase tracking-tight">Lối tắt quản lý</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button onClick={() => setView('products')} className="p-4 border border-slate-200 rounded hover:bg-slate-50 flex flex-col items-center text-slate-700">
                      <Package size={24} className="mb-2 text-blue-600" />
                      <span className="text-sm font-bold">Sản phẩm</span>
                    </button>
                    <button onClick={() => setView('customers')} className="p-4 border border-slate-200 rounded hover:bg-slate-50 flex flex-col items-center text-slate-700">
                      <Contact size={24} className="mb-2 text-blue-600" />
                      <span className="text-sm font-bold">Khách hàng</span>
                    </button>
                    <button onClick={() => setView('suppliers')} className="p-4 border border-slate-200 rounded hover:bg-slate-50 flex flex-col items-center text-slate-700">
                      <Users size={24} className="mb-2 text-blue-600" />
                      <span className="text-sm font-bold">Nhà cung cấp</span>
                    </button>
                    <button onClick={() => setView('warehouses')} className="p-4 border border-slate-200 rounded hover:bg-slate-50 flex flex-col items-center text-slate-700">
                      <Warehouse size={24} className="mb-2 text-blue-600" />
                      <span className="text-sm font-bold">Kho hàng</span>
                    </button>
                  </div>
                </div>
              </div>
            );
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
            case 'chinaImport': return <ChinaImportManagement userRole={userRole} />;
            case 'productAnalytics': return <ProductAnalytics />;
            case 'supplierAnalytics': return <SupplierAnalytics />;
            case 'inventoryLedger': return <InventoryLedger userRole={userRole} />;
            case 'priceComparison': return <PriceComparison />;
            case 'supplierPaymentHistory': return <SupplierPaymentHistory />;
            case 'plannedOrders': return <PlannedOrderManagement user={user} />;
            case 'notes': return <NoteManagement user={user} />;
            case 'savings': return <SavingsManagement user={user} />;
            default: return <SalesTerminal userRole={userRole} user={user} />;
          }
        })()}
      </Suspense>
    );
  };

  const NavItem: React.FC<{
    targetView: View;
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
    onClick?: () => void;
  }> = ({ targetView, icon, label, disabled = false, onClick }) => {
    const isActive = view === targetView;
    const baseClasses = 'flex items-center space-x-2 px-4 py-2 transition-all duration-200 text-sm font-bold uppercase tracking-wide border-b-2';
    const activeClasses = 'border-white text-white bg-white/10';
    const inactiveClasses = 'border-transparent text-white/80 hover:text-white hover:bg-white/5';
    const disabledClasses = 'text-white/40 cursor-not-allowed';

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
        <span className="hidden lg:inline">{label}</span>
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
      const wasLoggedIn = localStorage.getItem('hasLoggedIn') === 'true';
      return (
          <div className="h-screen flex flex-col items-center justify-center bg-slate-100 space-y-6">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-8 w-8 bg-primary/10 rounded-full animate-pulse"></div>
                </div>
              </div>
              <div className="text-center max-w-xs px-6">
                <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] animate-pulse mb-2">
                  {wasLoggedIn ? 'Đang khôi phục phiên đăng nhập...' : 'Đang khởi tạo hệ thống...'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                  Vui lòng đợi trong giây lát. Hệ thống đang kết nối với cơ sở dữ liệu.
                </p>
                {isOffline && (
                  <p className="text-[10px] text-red-500 font-bold uppercase mt-4 bg-red-50 py-1 px-3 rounded-full inline-block border border-red-100">
                    Bạn đang ngoại tuyến
                  </p>
                )}
                <div className="mt-8">
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
                  >
                    Tải lại trang
                  </button>
                </div>
              </div>
          </div>
      )
  }

  const isAdmin = userRole === 'admin';

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-white font-sans">
        <header className="w-full bg-blue-700 shadow-lg p-3 z-20 border-b border-blue-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-black text-white cursor-pointer flex items-center tracking-tight" onClick={() => setView('welcome')}>
            <Home className="mr-2" size={24}/> KHO & BÁN HÀNG
          </div>
          
          <nav className="flex items-center space-x-1">
            {(view !== 'sales' && view !== 'dashboard' && view !== 'welcome') && (
                <button 
                    onClick={() => setView('welcome')}
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg text-white/80 hover:bg-white/10 text-sm font-medium md:hidden"
                >
                    <Home size={18}/>
                </button>
            )}

            <NavItem targetView="welcome" icon={<Home size={18} />} label="Trang Chủ" />
            {isAdmin && <NavItem targetView="dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" />}
            <NavItem targetView="sales" icon={<ShoppingCart size={18} />} label="Bán Hàng" />
            <NavItem targetView="goodsReceipt" icon={<Archive size={18} />} label="Nhập Hàng" />

            {isAdmin && (
                <>
                    <div className="h-6 w-px bg-white/20 mx-2"></div>
                    <div className="relative" ref={settingsRef}>
                        <button
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-bold ${isSettingsOpen ? 'bg-white text-blue-700 shadow-inner' : 'text-white/90 hover:bg-white/10 hover:text-white'}`}
                        >
                            <Settings size={18} />
                            <span className="hidden md:inline uppercase tracking-wider">Cài Đặt</span>
                        </button>
                        {isSettingsOpen && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 animate-fade-in-down overflow-y-auto max-h-[80vh] z-50">
                                <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tài Chính</div>
                                <SettingsItem targetView="savings" icon={<PiggyBank size={16}/>} label="Sổ tiết kiệm" />
                                <SettingsItem targetView="accounts" icon={<Landmark size={16}/>} label="Quản Lý Tài Khoản" />
                                <SettingsItem targetView="debtManagement" icon={<Wallet size={16}/>} label="Quản Lý Công Nợ" />

                                <div className="my-1 h-px bg-slate-100"></div>
                                <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mua Hàng</div>
                                <SettingsItem targetView="plannedOrders" icon={<ClipboardList size={16}/>} label="Dự kiến đặt hàng" />
                                <SettingsItem targetView="chinaImport" icon={<Plane size={16}/>} label="Nhập Hàng TQ" />
                                
                                <div className="my-1 h-px bg-slate-100"></div>
                                <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Truy Vết & Báo Cáo</div>
                                <SettingsItem targetView="supplierPaymentHistory" icon={<CheckCheck size={16}/>} label="Truy Vết Trả Tiền NCC" />
                                <SettingsItem targetView="priceComparison" icon={<BarChart2 size={16}/>} label="So Sánh Giá Nhập" />
                                <SettingsItem targetView="inventoryLedger" icon={<History size={16}/>} label="Truy Vết Tồn Kho" />
                                <SettingsItem targetView="productAnalytics" icon={<BarChart3 size={16}/>} label="Hiệu Quả Sản Phẩm" />
                                <SettingsItem targetView="supplierAnalytics" icon={<PieChart size={16}/>} label="Nhập Hàng Theo NCC" />
                                
                                <div className="my-1 h-px bg-slate-100"></div>
                                <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hàng Hóa & Đối Tác</div>
                                <SettingsItem targetView="products" icon={<Package size={16}/>} label="Sản Phẩm" />
                                <SettingsItem targetView="quotations" icon={<FileText size={16}/>} label="Quản Lý Báo Giá" />
                                <SettingsItem targetView="customers" icon={<Contact size={16}/>} label="Khách Hàng" />
                                <SettingsItem targetView="suppliers" icon={<Users size={16}/>} label="Nhà Cung Cấp" />
                                <SettingsItem targetView="warehouses" icon={<Warehouse size={16}/>} label="Quản Lý Kho" />
                                <SettingsItem targetView="shippers" icon={<Truck size={16}/>} label="Đơn Vị Vận Chuyển" />
                                
                                <div className="my-1 h-px bg-slate-100"></div>
                                <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quản Lý</div>
                                <SettingsItem targetView="shipmentManagement" icon={<Send size={16}/>} label="Quản Lý Vận Đơn" />
                                <SettingsItem targetView="inventoryAlerts" icon={<AlertTriangle size={16}/>} label="Cảnh Báo Tồn Kho" />
                                <SettingsItem targetView="outsideStockAlerts" icon={<Bell size={16}/>} label="Cảnh Báo Kho Ngoài" />
                                <SettingsItem targetView="notes" icon={<StickyNote size={16}/>} label="Ghi chú hệ thống" />
                                
                                <div className="my-1 h-px bg-slate-100"></div>
                                <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cấu Hình</div>
                                <SettingsItem targetView="users" icon={<UserCircle size={16}/>} label="Quản Lý Người Dùng" />
                                <SettingsItem targetView="manufacturers" icon={<Building size={16}/>} label="Hãng Sản Xuất" />
                                <SettingsItem targetView="paymentMethods" icon={<CreditCard size={16}/>} label="Phương Thức TT" />
                                
                                <div className="my-1 h-px bg-slate-100"></div>
                                <button onClick={handleLogout} className="w-full text-left flex items-center space-x-3 px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50 font-bold">
                                    <LogOut size={16} />
                                    <span>Đăng Xuất</span>
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}

            {!isAdmin && user && (
                <button onClick={handleLogout} className="flex items-center space-x-2 px-3 py-2 rounded-lg text-white/90 hover:bg-white/10 text-sm font-bold">
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
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
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
    </ErrorBoundary>
  );
};

export default App;
