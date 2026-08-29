import React from 'react';
import { View } from '../../types';
import { AppDefinition } from '../../types/window';
import { getAppIcon } from './StartMenu';

export interface DesktopIconsProps {
  apps: AppDefinition[];
  onOpenApp: (view: View) => void;
  userRole: 'admin' | 'staff' | null;
}

export const DesktopIcons: React.FC<DesktopIconsProps> = ({
  apps,
  onOpenApp,
  userRole,
}) => {
  // Select priority shortcuts for the desktop workspace
  const desktopApps = apps.filter((app) => {
    if (userRole !== 'admin' && app.adminOnly) return false;
    // Show top 12 most important apps on the desktop
    const prioritized: View[] = [
      'sales',
      'goodsReceipt',
      'debtManagement',
      'dashboard',
      'products',
      'inventoryMatrix',
      'savings',
      'accounts',
      'restockPredictions',
      'customers',
      'suppliers',
      'inventoryLedger',
      'notes',
      'chinaImport'
    ];
    return prioritized.includes(app.id);
  });

  return (
    <div className="absolute inset-0 p-4 sm:p-6 grid grid-flow-col grid-rows-6 auto-cols-[90px] sm:auto-cols-[108px] gap-4 sm:gap-6 pointer-events-auto select-none overflow-hidden">
      {desktopApps.map((app) => (
        <button
          key={app.id}
          onDoubleClick={() => onOpenApp(app.id)}
          onClick={() => onOpenApp(app.id)}
          title={`Chức năng: ${app.title} (Nhấp đúp hoặc nhấp chuột để mở)`}
          className="group relative flex flex-col items-center justify-start p-2 rounded-xl hover:bg-white/10 active:bg-white/20 transition-all text-center focus:outline-none"
        >
          {/* Hover Floating Tooltip */}
          <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-200 z-50 px-2.5 py-1 bg-slate-950/95 text-white text-[11px] font-bold rounded-lg shadow-2xl border border-slate-700 whitespace-nowrap flex items-center space-x-1.5 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>{app.title}</span>
          </div>

          {/* App Icon Container */}
          <div className="relative mb-1.5">
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${app.color} text-white flex items-center justify-center shadow-lg group-hover:scale-105 group-hover:shadow-xl transition-transform duration-200 ring-1 ring-white/20`}
            >
              {getAppIcon(app.iconName, 26)}
            </div>

            {app.badgeCount && app.badgeCount > 0 ? (
              <span 
                className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-slate-900 shadow-md animate-pulse"
                title={`${app.badgeCount} đơn mới. Nhấp để mở và đánh dấu đã đọc.`}
              >
                {app.badgeCount > 99 ? '99+' : app.badgeCount}
              </span>
            ) : null}
          </div>

          {/* App Title - Clean, elegant label without any box or underline */}
          <span className="text-xs font-semibold text-white group-hover:text-amber-300 line-clamp-2 text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] transition-colors">
            {app.title}
          </span>
        </button>
      ))}
    </div>
  );
};
export default DesktopIcons;
