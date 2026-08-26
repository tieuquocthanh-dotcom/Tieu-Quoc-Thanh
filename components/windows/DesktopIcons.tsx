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
    <div className="absolute inset-0 p-4 sm:p-6 grid grid-flow-col grid-rows-6 auto-cols-[90px] sm:auto-cols-[104px] gap-4 sm:gap-6 pointer-events-auto select-none overflow-hidden">
      {desktopApps.map((app) => (
        <button
          key={app.id}
          onDoubleClick={() => onOpenApp(app.id)}
          onClick={() => onOpenApp(app.id)}
          className="group flex flex-col items-center justify-start p-2 rounded-xl hover:bg-slate-800/20 active:bg-slate-800/40 border border-transparent hover:border-slate-400/30 transition-all text-center focus:outline-none focus:bg-slate-800/30 focus:border-primary/50"
        >
          {/* App Icon Container */}
          <div className="relative mb-1.5">
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${app.color} text-white flex items-center justify-center shadow-lg group-hover:scale-105 group-hover:shadow-xl transition-transform duration-200 ring-1 ring-white/20`}
            >
              {getAppIcon(app.iconName, 26)}
            </div>

            {app.badgeCount && app.badgeCount > 0 ? (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-slate-900 shadow-md">
                {app.badgeCount > 99 ? '99+' : app.badgeCount}
              </span>
            ) : null}
          </div>

          {/* App Title */}
          <span className="text-xs font-semibold text-slate-800 group-hover:text-slate-950 line-clamp-2 px-1 py-0.5 rounded bg-white/70 backdrop-blur-sm shadow-xs transition-colors">
            {app.title}
          </span>
        </button>
      ))}
    </div>
  );
};
export default DesktopIcons;
