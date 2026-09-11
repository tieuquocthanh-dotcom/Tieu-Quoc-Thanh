import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import Toast from './Toast';

type ToastType = 'success' | 'error';

interface ToastContextProps {
  showToast: (message: string, type: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ message: string; type: ToastType; duration?: number } | null>(null);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message) => {
      const msgStr = String(message);
      const isError = msgStr.toLowerCase().includes('lỗi') || 
                      msgStr.toLowerCase().includes('thiếu') || 
                      msgStr.toLowerCase().includes('không') ||
                      msgStr.toLowerCase().includes('vượt quá') ||
                      msgStr.toLowerCase().includes('vui lòng');
      setToast({ message: msgStr, type: isError ? 'error' : 'success' });
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  const showToast = (message: string, type: ToastType, duration?: number) => {
    setToast({ message, type, duration });
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && <Toast message={toast.message} type={toast.type} duration={toast.duration} onClose={() => setToast(null)} />}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
