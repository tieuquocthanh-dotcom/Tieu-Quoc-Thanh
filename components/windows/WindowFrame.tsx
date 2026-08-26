import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Minus, Square, Copy, X, Maximize2 } from 'lucide-react';
import { WindowState } from '../../types/window';

interface WindowFrameProps {
  windowState: WindowState;
  isActive: boolean;
  icon: React.ReactNode;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximizeToggle: () => void;
  onUpdateState: (updates: Partial<WindowState>) => void;
  children: React.ReactNode;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({
  windowState,
  isActive,
  icon,
  onFocus,
  onClose,
  onMinimize,
  onMaximizeToggle,
  onUpdateState,
  children,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  
  const windowRef = useRef<HTMLDivElement>(null);

  // Dragging logic
  const handleTitleMouseDown = (e: React.MouseEvent) => {
    // Only drag with left click and not on control buttons
    if (e.button !== 0 || (e.target as HTMLElement).closest('.window-control-btn')) return;
    onFocus();
    
    if (windowState.isMaximized) return; // Don't drag when maximized

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - windowState.x,
      y: e.clientY - windowState.y
    });
    e.preventDefault();
  };

  const handleTitleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.window-control-btn')) return;
    onFocus();
    if (windowState.isMaximized || e.touches.length !== 1) return;

    const touch = e.touches[0];
    setIsDragging(true);
    setDragOffset({
      x: touch.clientX - windowState.x,
      y: touch.clientY - windowState.y
    });
  };

  // Resizing logic
  const handleResizeMouseDown = (direction: string, e: React.MouseEvent) => {
    if (e.button !== 0 || windowState.isMaximized) return;
    e.stopPropagation();
    e.preventDefault();
    onFocus();

    setIsResizing(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: windowState.width,
      height: windowState.height,
      posX: windowState.x,
      posY: windowState.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const parentW = window.innerWidth;
        const parentH = window.innerHeight - 48; // Leave room for taskbar
        
        let newX = e.clientX - dragOffset.x;
        let newY = e.clientY - dragOffset.y;

        // Keep title bar within visible bounds
        newX = Math.max(-windowState.width + 120, Math.min(newX, parentW - 100));
        newY = Math.max(0, Math.min(newY, parentH - 40));

        onUpdateState({ x: newX, y: newY });
      } else if (isResizing) {
        const dx = e.clientX - resizeStart.x;
        const dy = e.clientY - resizeStart.y;
        const minW = 400;
        const minH = 300;

        let newW = resizeStart.width;
        let newH = resizeStart.height;
        let newX = resizeStart.posX;
        let newY = resizeStart.posY;

        if (isResizing.includes('e')) newW = Math.max(minW, resizeStart.width + dx);
        if (isResizing.includes('s')) newH = Math.max(minH, resizeStart.height + dy);
        if (isResizing.includes('w')) {
          const possibleW = resizeStart.width - dx;
          if (possibleW >= minW) {
            newW = possibleW;
            newX = resizeStart.posX + dx;
          }
        }
        if (isResizing.includes('n')) {
          const possibleH = resizeStart.height - dy;
          if (possibleH >= minH) {
            newH = possibleH;
            newY = Math.max(0, resizeStart.posY + dy);
          }
        }

        onUpdateState({ x: newX, y: newY, width: newW, height: newH });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length === 1) {
        const touch = e.touches[0];
        const parentW = window.innerWidth;
        const parentH = window.innerHeight - 48;

        let newX = touch.clientX - dragOffset.x;
        let newY = touch.clientY - dragOffset.y;

        newX = Math.max(-windowState.width + 120, Math.min(newX, parentW - 100));
        newY = Math.max(0, Math.min(newY, parentH - 40));

        onUpdateState({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, resizeStart, windowState, onUpdateState]);

  if (windowState.isMinimized) {
    return null; // Hidden from viewport, but component is kept mounted in parent container
  }

  const isMaximized = windowState.isMaximized;

  // Maximize fills the workspace area (minus taskbar)
  const windowStyle: React.CSSProperties = isMaximized
    ? {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: 'calc(100% - 48px)', // 48px taskbar height
        zIndex: windowState.zIndex,
        borderRadius: 0,
      }
    : {
        position: 'absolute',
        top: `${windowState.y}px`,
        left: `${windowState.x}px`,
        width: `${windowState.width}px`,
        height: `${windowState.height}px`,
        zIndex: windowState.zIndex,
      };

  return (
    <div
      ref={windowRef}
      id={`window-${windowState.id}`}
      style={windowStyle}
      onClick={onFocus}
      className={`flex flex-col bg-slate-50 transition-shadow select-none ${
        isMaximized ? 'rounded-none shadow-none' : 'rounded-xl shadow-2xl border border-slate-700/20 ring-1 ring-black/10'
      } ${isActive ? 'ring-2 ring-primary/60 shadow-2xl' : 'opacity-95 shadow-lg'} overflow-hidden`}
    >
      {/* Windows Title Bar */}
      <div
        onMouseDown={handleTitleMouseDown}
        onTouchStart={handleTitleTouchStart}
        onDoubleClick={onMaximizeToggle}
        className={`h-10 px-3 flex items-center justify-between cursor-move shrink-0 border-b ${
          isActive
            ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700'
            : 'bg-slate-200 text-slate-700 border-slate-300'
        }`}
      >
        {/* Title & Icon */}
        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
          <div className="shrink-0 text-primary flex items-center justify-center p-1 bg-white/10 rounded-md">
            {icon}
          </div>
          <span className="text-xs font-bold truncate tracking-wide">
            {windowState.title}
          </span>
        </div>

        {/* Window Control Buttons (Minimize, Maximize/Restore, Close) */}
        <div className="flex items-center space-x-1 shrink-0 window-control-btn">
          {/* Minimize */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMinimize();
            }}
            title="Thu nhỏ xuống Taskbar"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/20 active:scale-95 transition-all text-slate-300 hover:text-white"
          >
            <Minus size={13} strokeWidth={2.5} />
          </button>

          {/* Maximize / Restore */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMaximizeToggle();
            }}
            title={isMaximized ? 'Khôi phục kích thước cửa sổ' : 'Phóng to toàn màn hình'}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/20 active:scale-95 transition-all text-slate-300 hover:text-white"
          >
            {isMaximized ? (
              <Copy size={12} strokeWidth={2.2} className="rotate-180" />
            ) : (
              <Square size={11} strokeWidth={2.2} />
            )}
          </button>

          {/* Close */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Đóng cửa sổ"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-600 active:scale-95 transition-all text-slate-300 hover:text-white"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Window Body (Content) */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-slate-100 flex flex-col select-text relative">
        {children}
      </div>

      {/* Resize handles (only when not maximized) */}
      {!isMaximized && (
        <>
          <div
            onMouseDown={(e) => handleResizeMouseDown('se', e)}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-20 flex items-center justify-center opacity-40 hover:opacity-100"
          >
            <div className="w-2 h-2 border-r-2 border-b-2 border-slate-500 rounded-br"></div>
          </div>
          <div
            onMouseDown={(e) => handleResizeMouseDown('e', e)}
            className="absolute top-10 right-0 w-1.5 h-[calc(100%-2.5rem)] cursor-e-resize z-10 hover:bg-primary/40"
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown('s', e)}
            className="absolute bottom-0 left-0 w-full h-1.5 cursor-s-resize z-10 hover:bg-primary/40"
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown('w', e)}
            className="absolute top-10 left-0 w-1.5 h-[calc(100%-2.5rem)] cursor-w-resize z-10 hover:bg-primary/40"
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown('n', e)}
            className="absolute top-0 left-0 w-full h-1.5 cursor-n-resize z-10 hover:bg-primary/40"
          />
        </>
      )}
    </div>
  );
};
export default WindowFrame;
