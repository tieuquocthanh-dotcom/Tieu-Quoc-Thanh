import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from 'firebase/auth';
import { View } from '../../types';
import { AppDefinition, WindowState } from '../../types/window';
import WindowFrame from './WindowFrame';
import Taskbar from './Taskbar';
import StartMenu, { getAppIcon } from './StartMenu';
import DesktopIcons from './DesktopIcons';

// App components
import Dashboard from '../Dashboard';
import ProductManagement from '../ProductManagement';
import SalesTerminal from '../SalesTerminal';
import GoodsReceipt from '../GoodsReceipt';
import ManufacturerManagement from '../ManufacturerManagement';
import SupplierManagement from '../SupplierManagement';
import WarehouseManagement from '../WarehouseManagement';
import CustomerManagement from '../CustomerManagement';
import ShippingManagement from '../ShippingManagement';
import PaymentMethodManagement from '../PaymentMethodManagement';
import AccountManagement from '../AccountManagement';
import InventoryMatrix from '../InventoryMatrix';
import ShipmentManagement from '../ShipmentManagement';
import InventoryAlerts from '../InventoryAlerts';
import OutsideStockAlerts from '../OutsideStockAlerts';
import DebtManagement from '../DebtManagement';
import UserManagement from '../UserManagement';
import QuotationManagement from '../QuotationManagement';
import ChinaImportManagement from '../ChinaImportManagement';
import ProductAnalytics from '../ProductAnalytics';
import SupplierAnalytics from '../SupplierAnalytics';
import CustomerAnalytics from '../CustomerAnalytics';
import InventoryLedger from '../InventoryLedger';
import PriceComparison from '../PriceComparison';
import SupplierPaymentHistory from '../SupplierPaymentHistory';
import PlannedOrderManagement from '../PlannedOrderManagement';
import NoteManagement from '../NoteManagement';
import SavingsManagement from '../SavingsManagement';
import RestockPredictions from '../RestockPredictions';
import MobileAppSwitcher from './MobileAppSwitcher';

interface WindowManagerProps {
  user: User | null;
  userRole: 'admin' | 'staff' | null;
  onLogout: () => void;
  currentDateTime: Date;
  onRefresh: () => void;
  isRefreshing: boolean;
  viewMode: 'windows' | 'classic';
  onToggleViewMode: () => void;
  unreadSalesCount: number;
  unreadReceiptsCount: number;
  initialView?: View;
}

export const WindowManager: React.FC<WindowManagerProps> = ({
  user,
  userRole,
  onLogout,
  currentDateTime,
  onRefresh,
  isRefreshing,
  viewMode,
  onToggleViewMode,
  unreadSalesCount,
  unreadReceiptsCount,
  initialView = 'sales',
}) => {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isAppSwitcherOpen, setIsAppSwitcherOpen] = useState(false);
  const [maxZIndex, setMaxZIndex] = useState(10);

  // Master App Definitions
  const appDefinitions: AppDefinition[] = useMemo(() => [
    {
      id: 'sales',
      title: 'Bán Hàng & Đơn Hàng',
      category: 'ban_hang',
      categoryLabel: 'Bán hàng',
      iconName: 'sales',
      color: 'bg-emerald-600',
      badgeCount: unreadSalesCount,
      defaultSize: { width: 1180, height: 740 }
    },
    {
      id: 'goodsReceipt',
      title: 'Nhập Hàng & Lịch Sử',
      category: 'ban_hang',
      categoryLabel: 'Mua hàng',
      iconName: 'goodsReceipt',
      color: 'bg-blue-600',
      badgeCount: unreadReceiptsCount,
      defaultSize: { width: 1180, height: 740 }
    },
    {
      id: 'debtManagement',
      title: 'Quản Lý Công Nợ',
      category: 'tai_chinh',
      categoryLabel: 'Tài chính',
      iconName: 'debtManagement',
      color: 'bg-amber-600',
      adminOnly: true,
      defaultSize: { width: 1140, height: 720 }
    },
    {
      id: 'dashboard',
      title: 'Báo Cáo Dashboard',
      category: 'bao_cao',
      categoryLabel: 'Tổng quan',
      iconName: 'dashboard',
      color: 'bg-indigo-600',
      adminOnly: true,
      defaultSize: { width: 1100, height: 700 }
    },
    {
      id: 'products',
      title: 'Quản Lý Sản Phẩm',
      category: 'kho_hang',
      categoryLabel: 'Sản phẩm',
      iconName: 'products',
      color: 'bg-violet-600',
      adminOnly: true,
      defaultSize: { width: 1100, height: 700 }
    },
    {
      id: 'inventoryMatrix',
      title: 'Tồn Kho & Chuyển Kho',
      category: 'kho_hang',
      categoryLabel: 'Kho hàng',
      iconName: 'inventoryMatrix',
      color: 'bg-teal-600',
      adminOnly: true,
      defaultSize: { width: 1120, height: 720 }
    },
    {
      id: 'savings',
      title: 'Sổ Tiết Kiệm',
      category: 'tai_chinh',
      categoryLabel: 'Tài chính',
      iconName: 'savings',
      color: 'bg-pink-600',
      adminOnly: true,
      defaultSize: { width: 1040, height: 680 }
    },
    {
      id: 'accounts',
      title: 'Quản Lý Tài Khoản / Sổ Quỹ',
      category: 'tai_chinh',
      categoryLabel: 'Tài chính',
      iconName: 'accounts',
      color: 'bg-cyan-600',
      adminOnly: true,
      defaultSize: { width: 1060, height: 680 }
    },
    {
      id: 'restockPredictions',
      title: 'Gợi Ý Nhập Hàng Tự Động',
      category: 'ban_hang',
      categoryLabel: 'Mua hàng',
      iconName: 'restockPredictions',
      color: 'bg-orange-600',
      adminOnly: true,
      defaultSize: { width: 1100, height: 700 }
    },
    {
      id: 'plannedOrders',
      title: 'Dự Kiến Đặt Hàng',
      category: 'ban_hang',
      categoryLabel: 'Mua hàng',
      iconName: 'plannedOrders',
      color: 'bg-sky-600',
      adminOnly: true,
      defaultSize: { width: 1080, height: 680 }
    },
    {
      id: 'chinaImport',
      title: 'Nhập Hàng Trung Quốc',
      category: 'ban_hang',
      categoryLabel: 'Mua hàng',
      iconName: 'chinaImport',
      color: 'bg-rose-600',
      adminOnly: true,
      defaultSize: { width: 1100, height: 700 }
    },
    {
      id: 'supplierPaymentHistory',
      title: 'Truy Vết Trả Tiền NCC',
      category: 'bao_cao',
      categoryLabel: 'Báo cáo',
      iconName: 'supplierPaymentHistory',
      color: 'bg-emerald-700',
      adminOnly: true,
      defaultSize: { width: 1060, height: 680 }
    },
    {
      id: 'priceComparison',
      title: 'So Sánh Giá Nhập',
      category: 'bao_cao',
      categoryLabel: 'Báo cáo',
      iconName: 'priceComparison',
      color: 'bg-blue-700',
      adminOnly: true,
      defaultSize: { width: 1080, height: 680 }
    },
    {
      id: 'inventoryLedger',
      title: 'Truy Vết Tồn Kho',
      category: 'bao_cao',
      categoryLabel: 'Báo cáo',
      iconName: 'inventoryLedger',
      color: 'bg-slate-700',
      adminOnly: true,
      defaultSize: { width: 1080, height: 680 }
    },
    {
      id: 'productAnalytics',
      title: 'Hiệu Quả Sản Phẩm',
      category: 'bao_cao',
      categoryLabel: 'Báo cáo',
      iconName: 'productAnalytics',
      color: 'bg-purple-600',
      adminOnly: true,
      defaultSize: { width: 1080, height: 680 }
    },
    {
      id: 'supplierAnalytics',
      title: 'Nhập Hàng Theo NCC',
      category: 'bao_cao',
      categoryLabel: 'Báo cáo',
      iconName: 'supplierAnalytics',
      color: 'bg-amber-700',
      adminOnly: true,
      defaultSize: { width: 1080, height: 680 }
    },
    {
      id: 'customerAnalytics',
      title: 'Bán Hàng Theo Khách Hàng',
      category: 'bao_cao',
      categoryLabel: 'Báo cáo',
      iconName: 'customerAnalytics',
      color: 'bg-teal-700',
      adminOnly: true,
      defaultSize: { width: 1080, height: 680 }
    },
    {
      id: 'customers',
      title: 'Quản Lý Khách Hàng',
      category: 'kho_hang',
      categoryLabel: 'Đối tác',
      iconName: 'customers',
      color: 'bg-blue-500',
      adminOnly: true,
      defaultSize: { width: 1040, height: 680 }
    },
    {
      id: 'suppliers',
      title: 'Quản Lý Nhà Cung Cấp',
      category: 'kho_hang',
      categoryLabel: 'Đối tác',
      iconName: 'suppliers',
      color: 'bg-indigo-500',
      adminOnly: true,
      defaultSize: { width: 1040, height: 680 }
    },
    {
      id: 'warehouses',
      title: 'Quản Lý Kho Hàng',
      category: 'kho_hang',
      categoryLabel: 'Kho',
      iconName: 'warehouses',
      color: 'bg-teal-500',
      adminOnly: true,
      defaultSize: { width: 980, height: 640 }
    },
    {
      id: 'shippers',
      title: 'Đơn Vị Vận Chuyển',
      category: 'kho_hang',
      categoryLabel: 'Đối tác',
      iconName: 'shippers',
      color: 'bg-orange-500',
      adminOnly: true,
      defaultSize: { width: 980, height: 640 }
    },
    {
      id: 'shipmentManagement',
      title: 'Quản Lý Vận Đơn',
      category: 'kho_hang',
      categoryLabel: 'Vận chuyển',
      iconName: 'shipmentManagement',
      color: 'bg-red-500',
      adminOnly: true,
      defaultSize: { width: 1080, height: 680 }
    },
    {
      id: 'quotations',
      title: 'Quản Lý Báo Giá',
      category: 'ban_hang',
      categoryLabel: 'Bán hàng',
      iconName: 'quotations',
      color: 'bg-emerald-500',
      adminOnly: true,
      defaultSize: { width: 1080, height: 680 }
    },
    {
      id: 'inventoryAlerts',
      title: 'Cảnh Báo Tồn Kho',
      category: 'kho_hang',
      categoryLabel: 'Cảnh báo',
      iconName: 'inventoryAlerts',
      color: 'bg-amber-500',
      adminOnly: true,
      defaultSize: { width: 980, height: 640 }
    },
    {
      id: 'outsideStockAlerts',
      title: 'Cảnh Báo Kho Ngoài',
      category: 'kho_hang',
      categoryLabel: 'Cảnh báo',
      iconName: 'outsideStockAlerts',
      color: 'bg-yellow-600',
      adminOnly: true,
      defaultSize: { width: 980, height: 640 }
    },
    {
      id: 'notes',
      title: 'Ghi Chú Hệ Thống',
      category: 'he_thong',
      categoryLabel: 'Tiện ích',
      iconName: 'notes',
      color: 'bg-lime-600',
      adminOnly: true,
      defaultSize: { width: 940, height: 620 }
    },
    {
      id: 'users',
      title: 'Quản Lý Người Dùng',
      category: 'he_thong',
      categoryLabel: 'Cấu hình',
      iconName: 'users',
      color: 'bg-purple-700',
      adminOnly: true,
      defaultSize: { width: 980, height: 640 }
    },
    {
      id: 'manufacturers',
      title: 'Hãng Sản Xuất',
      category: 'he_thong',
      categoryLabel: 'Cấu hình',
      iconName: 'manufacturers',
      color: 'bg-slate-600',
      adminOnly: true,
      defaultSize: { width: 940, height: 620 }
    },
    {
      id: 'paymentMethods',
      title: 'Phương Thức Thanh Toán',
      category: 'he_thong',
      categoryLabel: 'Cấu hình',
      iconName: 'paymentMethods',
      color: 'bg-zinc-600',
      adminOnly: true,
      defaultSize: { width: 940, height: 620 }
    }
  ], [unreadSalesCount, unreadReceiptsCount]);

  // Open App as a Window
  const openApp = useCallback((view: View) => {
    const appDef = appDefinitions.find(a => a.id === view);
    if (!appDef) return;

    setWindows(prev => {
      const existing = prev.find(w => w.view === view);
      const nextZ = maxZIndex + 1;
      setMaxZIndex(nextZ);

      if (existing) {
        // Unminimize, bring to front, focus
        setActiveWindowId(existing.id);
        return prev.map(w =>
          w.id === existing.id
            ? { ...w, isMinimized: false, zIndex: nextZ }
            : w
        );
      }

      // Responsive default size & position (used when user restores/un-maximizes)
      const screenW = window.innerWidth;
      const screenH = window.innerHeight - 48; // Sub taskbar

      const isMobile = screenW < 768;
      const defaultW = Math.min(appDef.defaultSize?.width || 1200, Math.max(800, screenW - 60));
      const defaultH = Math.min(appDef.defaultSize?.height || 750, Math.max(550, screenH - 60));

      // Position when restored
      const count = prev.length;
      const posX = isMobile ? 0 : Math.max(20, (count * 30) % Math.max(50, screenW - defaultW));
      const posY = isMobile ? 0 : Math.max(20, (count * 30) % Math.max(50, screenH - defaultH));

      const newWindow: WindowState = {
        id: `${view}_${Date.now()}`,
        view,
        title: appDef.title,
        isMinimized: false,
        isMaximized: true, // Always open MAXIMIZED (full screen) by default for easiest operation
        zIndex: nextZ,
        x: posX,
        y: posY,
        width: defaultW,
        height: defaultH,
        prevPosition: { x: posX, y: posY, width: defaultW, height: defaultH },
      };

      setActiveWindowId(newWindow.id);
      return [...prev, newWindow];
    });
  }, [appDefinitions, maxZIndex]);

  // Open initial app window on first load
  useEffect(() => {
    if (windows.length === 0 && initialView && initialView !== 'home' && initialView !== 'login') {
      openApp(initialView);
    }
  }, [initialView, openApp]);

  // Focus a window
  const focusWindow = useCallback((id: string) => {
    setActiveWindowId(id);
    const nextZ = maxZIndex + 1;
    setMaxZIndex(nextZ);
    setWindows(prev =>
      prev.map(w =>
        w.id === id
          ? { ...w, isMinimized: false, zIndex: nextZ }
          : w
      )
    );
  }, [maxZIndex]);

  // Minimize a window
  const minimizeWindow = useCallback((id: string) => {
    setWindows(prev =>
      prev.map(w =>
        w.id === id ? { ...w, isMinimized: true } : w
      )
    );
    if (activeWindowId === id) {
      setActiveWindowId(null);
    }
  }, [activeWindowId]);

  // Close a window
  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
    if (activeWindowId === id) {
      setActiveWindowId(null);
    }
  }, [activeWindowId]);

  // Toggle Maximize / Restore
  const toggleMaximize = useCallback((id: string) => {
    setWindows(prev =>
      prev.map(w => {
        if (w.id !== id) return w;
        if (w.isMaximized) {
          // Restore
          return {
            ...w,
            isMaximized: false,
            x: w.prevPosition?.x ?? w.x,
            y: w.prevPosition?.y ?? w.y,
            width: w.prevPosition?.width ?? w.width,
            height: w.prevPosition?.height ?? w.height,
          };
        } else {
          // Maximize
          return {
            ...w,
            isMaximized: true,
            prevPosition: { x: w.x, y: w.y, width: w.width, height: w.height },
          };
        }
      })
    );
  }, []);

  // Update window state (x, y, width, height)
  const updateWindowState = useCallback((id: string, updates: Partial<WindowState>) => {
    setWindows(prev =>
      prev.map(w => (w.id === id ? { ...w, ...updates } : w))
    );
  }, []);

  // Tile Windows Layout
  const tileWindows = useCallback((mode: 'split' | 'grid' | 'cascade') => {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight - 48; // sub taskbar
    const visibleWindows = windows.filter(w => !w.isMinimized);

    if (visibleWindows.length === 0) return;

    if (mode === 'split') {
      // Split into Left and Right 50/50
      const halfW = Math.floor(screenW / 2);
      setWindows(prev =>
        prev.map((w, idx) => {
          if (w.isMinimized) return w;
          const isLeft = idx % 2 === 0;
          return {
            ...w,
            isMaximized: false,
            x: isLeft ? 0 : halfW,
            y: 0,
            width: halfW,
            height: screenH,
          };
        })
      );
    } else if (mode === 'grid') {
      // Grid 2x2
      const halfW = Math.floor(screenW / 2);
      const halfH = Math.floor(screenH / 2);
      setWindows(prev =>
        prev.map((w, idx) => {
          if (w.isMinimized) return w;
          const pos = idx % 4;
          const x = (pos === 0 || pos === 2) ? 0 : halfW;
          const y = (pos === 0 || pos === 1) ? 0 : halfH;
          return {
            ...w,
            isMaximized: false,
            x,
            y,
            width: halfW,
            height: halfH,
          };
        })
      );
    } else if (mode === 'cascade') {
      // Cascade
      const defaultW = Math.min(1080, screenW - 80);
      const defaultH = Math.min(680, screenH - 80);
      setWindows(prev =>
        prev.map((w, idx) => {
          if (w.isMinimized) return w;
          return {
            ...w,
            isMaximized: false,
            x: (idx * 35) % Math.max(100, screenW - defaultW),
            y: (idx * 35) % Math.max(80, screenH - defaultH),
            width: defaultW,
            height: defaultH,
          };
        })
      );
    }
  }, [windows]);

  // Show desktop (minimize all)
  const showDesktop = useCallback(() => {
    setWindows(prev => prev.map(w => ({ ...w, isMinimized: true })));
    setActiveWindowId(null);
  }, []);

  // Restore all windows
  const restoreAllWindows = useCallback(() => {
    setWindows(prev => prev.map(w => ({ ...w, isMinimized: false })));
  }, []);

  // Render view component inside Window
  const renderAppView = (view: View) => {
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
      case 'supplierPaymentHistory': return <SupplierPaymentHistory userRole={userRole} />;
      case 'plannedOrders': return <PlannedOrderManagement user={user} />;
      case 'notes': return <NoteManagement user={user} />;
      case 'savings': return <SavingsManagement user={user} />;
      case 'restockPredictions': return <RestockPredictions />;
      default: return <SalesTerminal userRole={userRole} user={user} />;
    }
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-slate-900 select-none flex flex-col">
      {/* Windows Desktop Canvas & Wallpaper */}
      <div 
        className="relative flex-1 w-full overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950"
        style={{
          backgroundImage: `radial-gradient(circle at 15% 15%, rgba(59, 130, 246, 0.15), transparent 40%), radial-gradient(circle at 85% 85%, rgba(99, 102, 241, 0.12), transparent 40%)`
        }}
      >
        {/* Desktop Shortcut Icons */}
        <DesktopIcons
          apps={appDefinitions}
          onOpenApp={openApp}
          userRole={userRole}
        />

        {/* Windows Container (All open windows) */}
        {windows.map((win) => (
          <WindowFrame
            key={win.id}
            windowState={win}
            isActive={win.id === activeWindowId && !win.isMinimized}
            icon={getAppIcon(win.view, 16)}
            onFocus={() => focusWindow(win.id)}
            onClose={() => closeWindow(win.id)}
            onMinimize={() => minimizeWindow(win.id)}
            onMaximizeToggle={() => toggleMaximize(win.id)}
            onOpenAppSwitcher={() => setIsAppSwitcherOpen(true)}
            onUpdateState={(updates) => updateWindowState(win.id, updates)}
          >
            {renderAppView(win.view)}
          </WindowFrame>
        ))}

        {/* Start Menu Pop-up */}
        <StartMenu
          isOpen={isStartMenuOpen}
          onClose={() => setIsStartMenuOpen(false)}
          onOpenApp={openApp}
          user={user}
          userRole={userRole}
          onLogout={onLogout}
          apps={appDefinitions}
          openWindowsCount={windows.length}
        />

        {/* Mobile / Quick Apps Switcher Drawer */}
        <MobileAppSwitcher
          isOpen={isAppSwitcherOpen}
          onClose={() => setIsAppSwitcherOpen(false)}
          windows={windows}
          activeWindowId={activeWindowId}
          onFocusWindow={focusWindow}
          onCloseWindow={closeWindow}
          onCloseAllWindows={() => {
            setWindows([]);
            setActiveWindowId(null);
          }}
          onOpenStartMenu={() => setIsStartMenuOpen(true)}
        />
      </div>

      {/* Windows Taskbar at the bottom */}
      <Taskbar
        windows={windows}
        activeWindowId={activeWindowId}
        isStartMenuOpen={isStartMenuOpen}
        onToggleStartMenu={() => setIsStartMenuOpen(!isStartMenuOpen)}
        onOpenAppSwitcher={() => setIsAppSwitcherOpen(true)}
        onFocusWindow={focusWindow}
        onMinimizeWindow={minimizeWindow}
        onCloseWindow={closeWindow}
        onTileWindows={tileWindows}
        onShowDesktop={showDesktop}
        onRestoreAllWindows={restoreAllWindows}
        currentDateTime={currentDateTime}
        user={user}
        userRole={userRole}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        viewMode={viewMode}
        onToggleViewMode={onToggleViewMode}
        unreadSalesCount={unreadSalesCount}
        unreadReceiptsCount={unreadReceiptsCount}
      />
    </div>
  );
};
export default WindowManager;
