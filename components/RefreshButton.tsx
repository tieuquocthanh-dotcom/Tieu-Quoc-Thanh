import React, { useState } from 'react';
import { RotateCw } from 'lucide-react';

interface RefreshButtonProps {
  targetView?: string;
  label?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  iconSize?: number;
  className?: string;
  title?: string;
  onRefresh?: () => void;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  targetView,
  label,
  size = 'sm',
  iconSize,
  className = '',
  title,
  onRefresh,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);

    try {
      if (targetView) {
        sessionStorage.setItem('preferredViewAfterRefresh', targetView);
      }
    } catch (err) {
      console.warn('Failed to save preferred view on refresh:', err);
    }

    if (onRefresh) {
      try {
        onRefresh();
      } catch (err) {
        console.warn('Error in custom onRefresh callback:', err);
      }
    }

    // Delay slightly to show the spinning feedback
    setTimeout(() => {
      window.location.reload();
    }, 250);
  };

  const defaultIconSize = iconSize || (size === 'xs' ? 12 : size === 'sm' ? 14 : size === 'lg' ? 18 : 16);

  const sizeClasses = {
    xs: 'p-1 rounded text-xs',
    sm: 'p-1.5 rounded-lg text-xs',
    md: 'p-2 rounded-lg text-sm',
    lg: 'p-2.5 rounded-xl text-base',
  }[size];

  const tooltipTitle = title || (label ? `Làm mới dữ liệu ${label} (Ctrl + F5)` : 'Làm mới dữ liệu (Ctrl + F5)');

  return (
    <button
      type="button"
      onClick={handleClick}
      title={tooltipTitle}
      aria-label={tooltipTitle}
      disabled={isRefreshing}
      className={`inline-flex items-center justify-center text-slate-500 hover:text-primary hover:bg-slate-100 active:scale-95 border border-slate-200 hover:border-primary/40 transition-all shadow-xs cursor-pointer group disabled:opacity-75 ${sizeClasses} ${className}`}
    >
      <RotateCw
        size={defaultIconSize}
        className={`${isRefreshing ? 'animate-spin text-primary' : 'group-hover:rotate-180 transition-transform duration-500'}`}
      />
    </button>
  );
};

export default RefreshButton;
