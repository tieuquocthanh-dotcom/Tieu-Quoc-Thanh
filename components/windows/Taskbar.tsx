import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutGrid, Layout, Grid, Maximize, Eye, RefreshCw, Clock, 
  UserCircle, ChevronUp, Layers, Check, Sparkles, Monitor, AppWindow
} from 'lucide-react';
import { User } from 'firebase/auth';
import { WindowState } from '../../types/window';
import { getAppIcon } from './StartMenu';

export interface TaskbarProps {
  windows: WindowState[];
  activeWindowId: string | null;
  isStartMenuOpen: boolean;
  onToggleStartMenu: () => void;
  onOpenAppSwitcher?: () => void;
  onFocusWindow: (id: string) => void;
  onMinimizeWindow: (id: string) => void;
  onCloseWindow: (id: string) => void;
  onTileWindows: (mode: 'split' | 'grid' | 'cascade') => void;
  onShowDesktop: () => void;
  onRestoreAllWindows: () => void;
  currentDateTime: Date;
  user: User | null;
  userRole: 'admin' | 'staff' | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  viewMode: 'windows' | 'classic';
  onToggleViewMode: () => void;
  unreadSalesCount: number;
  unreadReceiptsCount: number;
}

export const Taskbar: React.FC<TaskbarProps> = ({
  windows,
  activeWindowId,
  isStartMenuOpen,
  onToggleStartMenu,
  onOpenAppSwitcher,
  onFocusWindow,
  onMinimizeWindow,
  onCloseWindow,
  onTileWindows,
  onShowDesktop,
  onRestoreAllWindows,
  currentDateTime,
  user,
  userRole,
  onRefresh,
  isRefreshing,
  viewMode,
  onToggleViewMode,
  unreadSalesCount,
  unreadReceiptsCount
}) => {
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const layoutMenuRef = useRef<HTMLDivElement>(null);

  // Close layout menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
        setIsLayoutMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return {
      time: `${hours}:${minutes}:${seconds}`,
      date: `${day}/${month}/${year}`
    };
  };

  const dt = formatTime(currentDateTime);

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-12 bg-slate-900/95 backdrop-blur-md border-t border-slate-700/80 z-50 flex items-center justify-between px-2 text-white select-none shadow-2xl">
      {/* Left side: Start Button & Quick Actions */}
      <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
        {/* Windows Start Button */}
        <button
          id="win-start-button"
          onClick={onToggleStartMenu}
          title="Bắt đầu / Danh mục ứng dụng (Start Menu)"
          className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-95 ${
            isStartMenuOpen
              ? 'bg-primary text-white shadow-lg shadow-primary/30 ring-2 ring-primary/50'
              : 'bg-slate-800/80 hover:bg-slate-700/90 text-slate-100 hover:text-white border border-slate-700/60'
          }`}
        >
          {/* Windows 4-square logo */}
          <div className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5 shrink-0">
            <div className="bg-sky-400 rounded-tl-sm"></div>
            <div className="bg-blue-500 rounded-tr-sm"></div>
            <div className="bg-emerald-400 rounded-bl-sm"></div>
            <div className="bg-amber-400 rounded-br-sm"></div>
          </div>
          <span className="text-xs font-bold tracking-wide">Bắt đầu</span>
        </button>

        {/* Mobile / Quick Apps Switcher Button */}
        <button
          onClick={onOpenAppSwitcher}
          title="Chuyển đổi nhanh giữa các ứng dụng đang mở"
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 active:scale-95 text-white font-bold text-xs border border-indigo-400/40 shadow-sm"
        >
          <Layers size={14} className="text-indigo-200" />
          <span className="text-xs">{windows.length > 0 ? `Đang mở (${windows.length})` : 'Đang mở'}</span>
        </button>

        {/* Window Layout & Arrangement Menu */}
        <div className="relative hidden md:block" ref={layoutMenuRef}>
          <button
            onClick={() => setIsLayoutMenuOpen(!isLayoutMenuOpen)}
            title="Sắp xếp và bố cục cửa sổ (Chia đôi màn hình, Xếp 4 góc, Xếp tầng...)"
            className={`p-2 rounded-lg transition-all text-xs font-semibold flex items-center space-x-1 ${
              isLayoutMenuOpen ? 'bg-slate-700 text-white' : 'bg-slate-800/60 hover:bg-slate-700/70 text-slate-300'
            }`}
          >
            <Layout size={15} />
            <span className="hidden lg:inline text-[11px]">Bố cục</span>
          </button>

          {isLayoutMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 text-xs space-y-1 animate-fade-in-up">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Sắp xếp cửa sổ tự động
              </div>
              <button
                onClick={() => {
                  onTileWindows('split');
                  setIsLayoutMenuOpen(false);
                }}
                className="w-full text-left flex items-center space-x-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white"
              >
                <div className="w-4 h-3.5 border border-slate-400 rounded-sm flex">
                  <div className="w-1/2 border-r border-slate-400 bg-primary/30"></div>
                  <div className="w-1/2"></div>
                </div>
                <span>Chia đôi 2 bên (50 / 50)</span>
              </button>

              <button
                onClick={() => {
                  onTileWindows('grid');
                  setIsLayoutMenuOpen(false);
                }}
                className="w-full text-left flex items-center space-x-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white"
              >
                <div className="w-4 h-3.5 border border-slate-400 rounded-sm grid grid-cols-2 grid-rows-2 gap-px p-0.5">
                  <div className="bg-primary/40"></div>
                  <div className="bg-slate-500/40"></div>
                  <div className="bg-slate-500/40"></div>
                  <div className="bg-slate-500/40"></div>
                </div>
                <span>Chia 4 góc màn hình (2x2)</span>
              </button>

              <button
                onClick={() => {
                  onTileWindows('cascade');
                  setIsLayoutMenuOpen(false);
                }}
                className="w-full text-left flex items-center space-x-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white"
              >
                <Layers size={14} className="text-amber-400" />
                <span>Xếp tầng sole (Cascade)</span>
              </button>

              <div className="h-px bg-slate-800 my-1"></div>

              <button
                onClick={() => {
                  onShowDesktop();
                  setIsLayoutMenuOpen(false);
                }}
                className="w-full text-left flex items-center space-x-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white"
              >
                <Eye size={14} className="text-sky-400" />
                <span>Thu nhỏ tất cả (Desktop)</span>
              </button>

              <button
                onClick={() => {
                  onRestoreAllWindows();
                  setIsLayoutMenuOpen(false);
                }}
                className="w-full text-left flex items-center space-x-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white"
              >
                <AppWindow size={14} className="text-emerald-400" />
                <span>Hiện lại tất cả cửa sổ</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center area: Active Window Pills on Taskbar */}
      <div className="flex-1 flex items-center justify-start sm:justify-center space-x-1.5 mx-2 overflow-x-auto scrollbar-none py-1 min-w-0">
        {windows.map((win) => {
          const isActive = win.id === activeWindowId && !win.isMinimized;
          const isMin = win.isMinimized;

          return (
            <div
              key={win.id}
              onClick={() => {
                if (isActive) {
                  onMinimizeWindow(win.id);
                } else {
                  onFocusWindow(win.id);
                }
              }}
              title={`${win.title} (${isMin ? 'Đang thu nhỏ' : 'Đang mở'})`}
              className={`group relative flex items-center space-x-2 px-3 py-1.5 rounded-lg max-w-[170px] cursor-pointer transition-all active:scale-95 border ${
                isActive
                  ? 'bg-slate-800 text-white border-primary/60 shadow-md ring-1 ring-primary/40'
                  : isMin
                  ? 'bg-slate-900/60 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border-slate-800'
                  : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700/80 border-slate-700'
              }`}
            >
              <div className="shrink-0 text-primary">
                {getAppIcon(win.view, 15)}
              </div>
              <span className="text-xs font-medium truncate min-w-0">
                {win.title}
              </span>

              {/* Active / Running Indicator underline */}
              <div
                className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full transition-all ${
                  isActive
                    ? 'bg-primary shadow-sm shadow-primary'
                    : isMin
                    ? 'bg-slate-600 w-3 mx-auto'
                    : 'bg-slate-400'
                }`}
              />
            </div>
          );
        })}

        {windows.length === 0 && (
          <span className="text-[11px] text-slate-500 italic hidden sm:inline">
            Chưa có cửa sổ nào mở. Bấm "Bắt đầu" hoặc biểu tượng trên màn hình để mở tính năng.
          </span>
        )}
      </div>

      {/* Right side: System Tray & Clock */}
      <div className="flex items-center space-x-1.5 shrink-0">
        {/* Toggle Mode: Multi-Window vs Single Fullscreen */}
        <button
          onClick={onToggleViewMode}
          title={viewMode === 'windows' ? 'Chuyển sang Giao diện Đơn Toàn Màn Hình' : 'Chuyển sang Chế độ Cửa Sổ Đa Nhiệm (Windows)'}
          className="p-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 flex items-center space-x-1 text-xs"
        >
          <Monitor size={14} className="text-primary" />
          <span className="hidden xl:inline text-[10px] font-bold">
            {viewMode === 'windows' ? 'Chế độ Cửa Sổ' : 'Toàn Màn Hình'}
          </span>
        </button>

        {/* Refresh System */}
        <button
          onClick={onRefresh}
          title="Làm mới hệ thống"
          className="p-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-primary' : ''} />
        </button>

        {/* User Role Badge */}
        {user && (
          <div className="hidden md:flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/50 text-[11px]">
            <UserCircle size={13} className="text-emerald-400" />
            <span className="font-semibold text-slate-300 truncate max-w-[90px]">
              {user.displayName || user.email?.split('@')[0]}
            </span>
          </div>
        )}

        {/* Time & Date Display */}
        <div className="flex flex-col items-end px-2 py-0.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-right leading-tight">
          <span className="font-mono text-[11px] font-bold text-slate-100">{dt.time}</span>
          <span className="text-[9px] text-slate-400 font-medium">{dt.date}</span>
        </div>

        {/* Show Desktop Peek button at far right corner */}
        <button
          onClick={onShowDesktop}
          title="Thu nhỏ tất cả về màn hình chính (Show Desktop)"
          className="w-3 h-8 border-l border-slate-700 hover:bg-white/20 transition-colors shrink-0 rounded-r-sm"
        />
      </div>
    </footer>
  );
};
export default Taskbar;
