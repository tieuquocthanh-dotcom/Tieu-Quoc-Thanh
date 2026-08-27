import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, X, ShoppingCart, Archive, LayoutDashboard, Wallet, PiggyBank, Landmark,
  PackageSearch, ClipboardList, Plane, CheckCheck, BarChart2, History, BarChart3,
  PieChart, Package, FileText, Contact, Users, Warehouse, Truck, Send, AlertTriangle,
  Bell, StickyNote, UserCircle, Building, CreditCard, LogOut, Grid, Sparkles, Monitor
} from 'lucide-react';
import { User } from 'firebase/auth';
import { View } from '../../types';
import { AppDefinition } from '../../types/window';

export interface StartMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenApp: (view: View) => void;
  user: User | null;
  userRole: 'admin' | 'staff' | null;
  onLogout: () => void;
  apps: AppDefinition[];
  openWindowsCount: number;
}

export const StartMenu: React.FC<StartMenuProps> = ({
  isOpen,
  onClose,
  onOpenApp,
  user,
  userRole,
  onLogout,
  apps,
  openWindowsCount
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        const startBtn = document.getElementById('win-start-button');
        if (startBtn && (startBtn === e.target || startBtn.contains(e.target as Node))) return;
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const categories = [
    { id: 'all', label: 'Tất cả' },
    { id: 'ban_hang', label: 'Bán & Mua' },
    { id: 'tai_chinh', label: 'Tài chính' },
    { id: 'kho_hang', label: 'Kho & Hàng hóa' },
    { id: 'bao_cao', label: 'Báo cáo & Phân tích' },
    { id: 'he_thong', label: 'Hệ thống' },
  ];

  const filteredApps = useMemo(() => {
    return apps.filter(app => {
      if (userRole !== 'admin' && app.adminOnly) return false;
      const matchesSearch = app.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || app.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [apps, searchTerm, selectedCategory, userRole]);

  // Quick pinned top apps
  const pinnedApps = useMemo(() => {
    const pinnedIds: View[] = ['sales', 'goodsReceipt', 'debtManagement', 'products', 'inventoryMatrix', 'accounts'];
    return apps.filter(a => pinnedIds.includes(a.id) && (userRole === 'admin' || !a.adminOnly));
  }, [apps, userRole]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      id="windows-start-menu"
      className="fixed bottom-14 left-2 sm:left-4 w-[95vw] max-w-[620px] h-[580px] max-h-[82vh] bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl z-[9999] flex flex-col overflow-hidden text-white animate-fade-in-up"
    >
      {/* Header with Search Bar */}
      <div className="p-4 border-b border-slate-800 shrink-0 bg-slate-900/60">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm ứng dụng, tính năng (Bán hàng, Nhập hàng, Công nợ...)..."
            className="w-full pl-10 pr-9 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 scrollbar-none text-xs">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Apps Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Pinned Section (if no search and viewing 'all') */}
        {!searchTerm && selectedCategory === 'all' && (
          <div>
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-400" /> Tính năng hay dùng
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {pinnedApps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => {
                    onOpenApp(app.id);
                    onClose();
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/40 hover:border-primary/50 transition-all hover:scale-105 active:scale-95 group text-center"
                >
                  <div className={`p-2.5 rounded-xl ${app.color} text-white mb-2 shadow-md group-hover:shadow-primary/20`}>
                    {getAppIcon(app.iconName, 20)}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-200 line-clamp-1 group-hover:text-primary">
                    {app.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All / Filtered Apps Section */}
        <div>
          <div className="flex items-center justify-between mb-2.5 px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Grid size={13} /> {searchTerm ? `Kết quả tìm kiếm (${filteredApps.length})` : 'Tất cả ứng dụng'}
            </span>
          </div>

          {filteredApps.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              Không tìm thấy tính năng nào khớp với "{searchTerm}".
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredApps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => {
                    onOpenApp(app.id);
                    onClose();
                  }}
                  className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/30 hover:border-slate-600 transition-all text-left group"
                >
                  <div className={`p-2 rounded-lg ${app.color} text-white shrink-0 shadow-sm`}>
                    {getAppIcon(app.iconName, 18)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-100 group-hover:text-primary truncate">
                      {app.title}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {app.categoryLabel}
                    </div>
                  </div>
                  {app.badgeCount && app.badgeCount > 0 ? (
                    <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                      {app.badgeCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer / User Profile & System Actions */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/80 shrink-0 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-black text-xs">
            {user?.displayName ? user.displayName.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'U')}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-200 truncate max-w-[180px] sm:max-w-[240px]">
              {user?.displayName || user?.email}
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold">
              {userRole === 'admin' ? 'Quản trị viên (Admin)' : 'Nhân viên (Staff)'}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            onClose();
            onLogout();
          }}
          title="Đăng xuất khỏi hệ thống"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 text-xs font-bold transition-colors"
        >
          <LogOut size={14} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );
};

// Helper for dynamic app icons
export const getAppIcon = (name: string, size = 18) => {
  switch (name) {
    case 'sales': return <ShoppingCart size={size} />;
    case 'goodsReceipt': return <Archive size={size} />;
    case 'dashboard': return <LayoutDashboard size={size} />;
    case 'debtManagement': return <Wallet size={size} />;
    case 'savings': return <PiggyBank size={size} />;
    case 'accounts': return <Landmark size={size} />;
    case 'restockPredictions': return <PackageSearch size={size} />;
    case 'plannedOrders': return <ClipboardList size={size} />;
    case 'chinaImport': return <Plane size={size} />;
    case 'supplierPaymentHistory': return <CheckCheck size={size} />;
    case 'priceComparison': return <BarChart2 size={size} />;
    case 'inventoryLedger': return <History size={size} />;
    case 'productAnalytics': return <BarChart3 size={size} />;
    case 'supplierAnalytics': case 'customerAnalytics': return <PieChart size={size} />;
    case 'products': return <Package size={size} />;
    case 'quotations': return <FileText size={size} />;
    case 'customers': return <Contact size={size} />;
    case 'suppliers': return <Users size={size} />;
    case 'warehouses': return <Warehouse size={size} />;
    case 'shippers': return <Truck size={size} />;
    case 'shipmentManagement': return <Send size={size} />;
    case 'inventoryAlerts': return <AlertTriangle size={size} />;
    case 'outsideStockAlerts': return <Bell size={size} />;
    case 'notes': return <StickyNote size={size} />;
    case 'users': return <UserCircle size={size} />;
    case 'manufacturers': return <Building size={size} />;
    case 'paymentMethods': return <CreditCard size={size} />;
    default: return <Monitor size={size} />;
  }
};

export default StartMenu;
