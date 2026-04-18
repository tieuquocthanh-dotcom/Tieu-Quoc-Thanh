
import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot as onDocSnapshot } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './services/firebase';
import FirebaseSetupGuide from './components/FirebaseSetupGuide';
import ProductManagement from './components/ProductManagement';
import SalesTerminal from './components/SalesTerminal';
import Dashboard from './components/Dashboard';
// import ManufacturerManagement from './components/ManufacturerManagement';
import SupplierManagement from './components/SupplierManagement';
// import WarehouseManagement from './components/WarehouseManagement';
// import CustomerManagement from './components/CustomerManagement';
// import ShippingManagement from './components/ShippingManagement';
// import PaymentMethodManagement from './components/PaymentMethodManagement';
import AccountManagement from './components/AccountManagement';
import GoodsReceipt from './components/GoodsReceipt';
import InventoryMatrix from './components/InventoryMatrix';
import ShipmentManagement from './components/ShipmentManagement';
import InventoryAlerts from './components/InventoryAlerts';
import OutsideStockAlerts from './components/OutsideStockAlerts'; 
import DebtManagement from './components/DebtManagement';
import QuotationManagement from './components/QuotationManagement';
import Login from './components/Login';
// import UserManagement from './components/UserManagement';
import LandingPage from './components/LandingPage';
import ChinaImportManagement from './components/ChinaImportManagement';
import ProductAnalytics from './components/ProductAnalytics';
// import SupplierAnalytics from './components/SupplierAnalytics';
import InventoryLedger from './components/InventoryLedger';
import PriceComparison from './components/PriceComparison';
// import SupplierPaymentHistory from './components/SupplierPaymentHistory';
import PlannedOrderManagement from './components/PlannedOrderManagement';
// import NoteManagement from './components/NoteManagement';
// import SavingsManagement from './components/SavingsManagement';
import { Home, Package, ShoppingCart, CheckCircle, Building, Users, Warehouse, Contact, Settings, Truck, CreditCard, Archive, Send, AlertTriangle, LayoutDashboard, Wallet, LogOut, UserCircle, LogIn, FileText, Plane, Bell, BarChart3, PieChart, History, BarChart2, CheckCheck, ClipboardList, Landmark, StickyNote, PiggyBank } from 'lucide-react';

type View = 'home' | 'login' | 'dashboard' | 'products' | 'sales' | 'goodsReceipt' | 'manufacturers' | 'suppliers' | 'customers' | 'warehouses' | 'shippers' | 'paymentMethods' | 'accounts' | 'setup' | 'inventoryMatrix' | 'shipmentManagement' | 'inventoryAlerts' | 'outsideStockAlerts' | 'debtManagement' | 'users' | 'quotations' | 'chinaImport' | 'productAnalytics' | 'supplierAnalytics' | 'inventoryLedger' | 'priceComparison' | 'supplierPaymentHistory' | 'plannedOrders' | 'notes' | 'savings';

const App: React.FC = () => {
  const [view, setView] = useState<View>(() => {
      const savedView = localStorage.getItem('currentView');
      return (savedView && savedView !== 'login') ? (savedView as View) : 'home';
  });

  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
      if (view !== 'login' && view !== 'setup') {
          localStorage.setItem('currentView', view);
      }
  }, [view]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
          setUserRole(null);
          setAuthLoading(false);
      }
    });

    if (isFirebaseConfigured && !sessionStorage.getItem('firebaseConnected')) {
      setShowSuccessToast(true);
      sessionStorage.setItem('firebaseConnected', 'true');
      setTimeout(() => {
        setShowSuccessToast(false);
      }, 5000);
    }
    
    return () => unsubscribe();
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
                  // Mặc định là staff nếu không tìm thấy dữ liệu user trong Firestore
                  // Ngoại trừ tài khoản admin chính
                  if (user.email === 'tieuquocthanh@gmail.com') {
                      setUserRole('admin');
                  } else {
                      setUserRole('staff');
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
          const lastView = localStorage.getItem('currentView') as View;
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

  const handleLogout = async () => {
      await signOut(auth);
      localStorage.removeItem('currentView');
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
      // case 'manufacturers': return <ManufacturerManagement />;
      case 'suppliers': return <SupplierManagement />;
      // case 'customers': return <CustomerManagement />;
      // case 'warehouses': return <WarehouseManagement />;
      case 'inventoryMatrix': return <InventoryMatrix user={user} />;
      case 'shipmentManagement': return <ShipmentManagement userRole={userRole} />;
      case 'inventoryAlerts': return <InventoryAlerts />;
      case 'outsideStockAlerts': return <OutsideStockAlerts />;
      case 'debtManagement': return <DebtManagement />;
      // case 'shippers': return <ShippingManagement />;
      // case 'paymentMethods': return <PaymentMethodManagement />;
      case 'accounts': return <AccountManagement />;
      // case 'users': return <UserManagement />;
      case 'quotations': return <QuotationManagement />;
      case 'chinaImport': return <ChinaImportManagement />;
      case 'productAnalytics': return <ProductAnalytics />;
      // case 'supplierAnalytics': return <SupplierAnalytics />;
      case 'inventoryLedger': return <InventoryLedger userRole={userRole} />;
      case 'priceComparison': return <PriceComparison />;
      // case 'supplierPaymentHistory': return <SupplierPaymentHistory />;
      case 'plannedOrders': return <PlannedOrderManagement user={user} />;
      // case 'notes': return <NoteManagement user={user} />;
      // case 'savings': return <SavingsManagement user={user} />;
      default: return <SalesTerminal userRole={userRole} user={user} />;
    }
  };

  const NavItem: React.FC<{
    targetView: View;
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
    onClick?: () => void;
  }> = ({ targetView, icon, label, disabled = false, onClick }) => {
    const isActive = view === targetView;
    const baseClasses = 'flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium';
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
          <div className="h-screen flex items-center justify-center bg-slate-100">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
      )
  }

  const isAdmin = userRole === 'admin';

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans">
      <header className="w-full bg-white shadow-md p-3 z-20 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-xl font-bold text-primary cursor-pointer flex items-center" onClick={() => setView('home')}>
            <Home className="mr-2"/> Kho & Bán Hàng
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
            <NavItem targetView="sales" icon={<ShoppingCart size={18} />} label="Bán Hàng" />
            <NavItem targetView="goodsReceipt" icon={<Archive size={18} />} label="Nhập Hàng" />

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
                            <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 p-2 animate-fade-in-down overflow-y-auto max-h-[80vh] z-50">
                                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase">Tài Chính</div>
                                <SettingsItem targetView="savings" icon={<PiggyBank size={16}/>} label="Sổ tiết kiệm" />
                                <SettingsItem targetView="accounts" icon={<Landmark size={16}/>} label="Quản Lý Tài Khoản" />
                                <SettingsItem targetView="debtManagement" icon={<Wallet size={16}/>} label="Quản Lý Công Nợ" />

                                <div className="my-1 h-px bg-slate-100"></div>
                                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase">Mua Hàng</div>
                                <SettingsItem targetView="plannedOrders" icon={<ClipboardList size={16}/>} label="Dự kiến đặt hàng" />
                                <SettingsItem targetView="chinaImport" icon={<Plane size={16}/>} label="Nhập Hàng TQ" />
                                
                                <div className="my-1 h-px bg-slate-100"></div>
                                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase">Truy Vết & Báo Cáo</div>
                                <SettingsItem targetView="supplierPaymentHistory" icon={<CheckCheck size={16}/>} label="Truy Vết Trả Tiền NCC" />
                                <SettingsItem targetView="priceComparison" icon={<BarChart2 size={16}/>} label="So Sánh Giá Nhập" />
                                <SettingsItem targetView="inventoryLedger" icon={<History size={16}/>} label="Truy Vết Tồn Kho" />
                                <SettingsItem targetView="productAnalytics" icon={<BarChart3 size={16}/>} label="Hiệu Quả Sản Phẩm" />
                                <SettingsItem targetView="supplierAnalytics" icon={<PieChart size={16}/>} label="Nhập Hàng Theo NCC" />
                                
                                <div className="my-1 h-px bg-slate-100"></div>
                                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase">Hàng Hóa & Đối Tác</div>
                                <SettingsItem targetView="products" icon={<Package size={16}/>} label="Sản Phẩm" />
                                <SettingsItem targetView="quotations" icon={<FileText size={16}/>} label="Quản Lý Báo Giá" />
                                <SettingsItem targetView="customers" icon={<Contact size={16}/>} label="Khách Hàng" />
                                <SettingsItem targetView="suppliers" icon={<Users size={16}/>} label="Nhà Cung Cấp" />
                                <SettingsItem targetView="warehouses" icon={<Warehouse size={16}/>} label="Quản Lý Kho" />
                                <SettingsItem targetView="shippers" icon={<Truck size={16}/>} label="Đơn Vị Vận Chuyển" />
                                
                                <div className="my-1 h-px bg-slate-100"></div>
                                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase">Quản Lý</div>
                                <SettingsItem targetView="shipmentManagement" icon={<Send size={16}/>} label="Quản Lý Vận Đơn" />
                                <SettingsItem targetView="inventoryAlerts" icon={<AlertTriangle size={16}/>} label="Cảnh Báo Tồn Kho" />
                                <SettingsItem targetView="outsideStockAlerts" icon={<Bell size={16}/>} label="Cảnh Báo Kho Ngoài" />
                                <SettingsItem targetView="notes" icon={<StickyNote size={16}/>} label="Ghi chú hệ thống" />
                                
                                <div className="my-1 h-px bg-slate-100"></div>
                                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase">Cấu Hình</div>
                                <SettingsItem targetView="users" icon={<UserCircle size={16}/>} label="Quản Lý Người Dùng" />
                                <SettingsItem targetView="manufacturers" icon={<Building size={16}/>} label="Hãng Sản Xuất" />
                                <SettingsItem targetView="paymentMethods" icon={<CreditCard size={16}/>} label="Phương Thức TT" />
                                
                                <div className="my-1 h-px bg-slate-100"></div>
                                <button onClick={handleLogout} className="w-full text-left flex items-center space-x-3 px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50">
                                    <LogOut size={16} />
                                    <span>Đăng Xuất ({user?.email})</span>
                                </button>
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
