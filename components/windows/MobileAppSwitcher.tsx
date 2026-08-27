import React from 'react';
import { Layers, X, Plus, Sparkles, Check, Trash2 } from 'lucide-react';
import { WindowState } from '../../types/window';
import { getAppIcon } from './StartMenu';

export interface MobileAppSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  windows: WindowState[];
  activeWindowId: string | null;
  onFocusWindow: (id: string) => void;
  onCloseWindow: (id: string) => void;
  onCloseAllWindows: () => void;
  onOpenStartMenu: () => void;
}

export const MobileAppSwitcher: React.FC<MobileAppSwitcherProps> = ({
  isOpen,
  onClose,
  windows,
  activeWindowId,
  onFocusWindow,
  onCloseWindow,
  onCloseAllWindows,
  onOpenStartMenu,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-xl flex flex-col animate-fade-in text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center">
            <Layers size={18} />
          </div>
          <div>
            <h2 className="text-base font-black tracking-wide text-white">Ứng dụng đang mở</h2>
            <p className="text-[11px] text-slate-400">
              {windows.length > 0 ? `${windows.length} ứng dụng đang chạy` : 'Không có ứng dụng nào'}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 flex items-center justify-center transition-all"
        >
          <X size={18} />
        </button>
      </div>

      {/* App Cards List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {windows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <Layers size={32} />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-300">Chưa có ứng dụng nào mở</div>
              <div className="text-xs text-slate-500">Bấm nút bên dưới để chọn và mở tính năng</div>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenStartMenu();
              }}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 active:scale-95 rounded-xl text-xs font-bold text-white shadow-lg shadow-primary/30 flex items-center space-x-2"
            >
              <Plus size={16} />
              <span>Mở tính năng mới</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {windows.map((win) => {
              const isActive = win.id === activeWindowId && !win.isMinimized;

              return (
                <div
                  key={win.id}
                  onClick={() => {
                    onFocusWindow(win.id);
                    onClose();
                  }}
                  className={`group relative rounded-2xl p-4 transition-all active:scale-[0.98] cursor-pointer border ${
                    isActive
                      ? 'bg-gradient-to-r from-slate-900 to-slate-800 border-primary ring-2 ring-primary/40 shadow-xl'
                      : 'bg-slate-900/90 hover:bg-slate-850 border-slate-800 hover:border-slate-700 shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0 pr-2">
                      <div className="p-3 rounded-xl bg-slate-800 text-primary border border-slate-700 shrink-0 shadow-inner">
                        {getAppIcon(win.view, 24)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-black text-slate-100 truncate">
                          {win.title}
                        </div>
                        <div className="text-xs flex items-center space-x-1.5 mt-0.5">
                          <span className={`inline-block w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                          <span className={isActive ? 'text-emerald-400 font-semibold text-[11px]' : 'text-slate-400 text-[11px]'}>
                            {isActive ? 'Đang hiển thị' : (win.isMinimized ? 'Đang chạy ngầm' : 'Mở')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Close button for card */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseWindow(win.id);
                      }}
                      title="Đóng ứng dụng này"
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-red-500/20 active:bg-red-500 hover:text-red-300 text-slate-400 flex items-center justify-center transition-colors shrink-0"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between space-x-3">
        <button
          onClick={() => {
            onClose();
            onOpenStartMenu();
          }}
          className="flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 active:scale-95 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-primary/20"
        >
          <Plus size={16} />
          <span>Mở thêm tính năng khác</span>
        </button>

        {windows.length > 0 && (
          <button
            onClick={() => {
              onCloseAllWindows();
              onClose();
            }}
            className="py-3 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-400 border border-red-500/20 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors"
          >
            <Trash2 size={15} />
            <span>Đóng tất cả</span>
          </button>
        )}
      </div>
    </div>
  );
};
export default MobileAppSwitcher;
