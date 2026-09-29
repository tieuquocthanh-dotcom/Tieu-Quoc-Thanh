import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
}) => {
  if (!isOpen) return null;

  const handleClose = () => {
    if (onClose) onClose();
    if (onCancel) onCancel();
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-fade-in-down"
      >
        <div className="bg-red-600 p-4 text-white flex justify-between items-center">
          <h3 className="font-black uppercase text-sm flex items-center"><AlertTriangle className="mr-2" size={20}/> {title}</h3>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng"
            className="hover:bg-white/20 p-1 rounded-full transition cursor-pointer"
          >
            <X size={20}/>
          </button>
        </div>
        <div className="p-6 text-slate-700 font-medium">
          {message}
        </div>
        <div className="p-4 bg-slate-50 flex gap-2 border-t">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs uppercase text-slate-700 transition hover:bg-slate-100 cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2 bg-red-600 text-white rounded-xl font-bold text-xs uppercase shadow-sm transition active:scale-95 hover:bg-red-700 cursor-pointer"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
