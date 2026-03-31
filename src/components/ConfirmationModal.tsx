import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  confirmColor?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Xác nhận Xóa', confirmColor = 'bg-red-600 hover:bg-red-700' }) => {
  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      console.error("Confirmation error:", error);
    } finally {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[300] animate-fade-in" role="alertdialog" aria-modal="true" aria-labelledby="dialogTitle" aria-describedby="dialogMessage">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md animate-fade-in-down">
        <div className="flex items-start">
          <div className="mr-4 flex-shrink-0">
            <div className={`mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 sm:h-10 sm:w-10 ${confirmColor.includes('red') ? 'bg-red-100' : 'bg-blue-100'}`}>
              <AlertTriangle className={`h-6 w-6 ${confirmColor.includes('red') ? 'text-red-600' : 'text-blue-600'}`} aria-hidden="true" />
            </div>
          </div>
          <div className="mt-0 text-left">
            <h3 id="dialogTitle" className="text-lg font-bold leading-6 text-dark">{title}</h3>
            <div className="mt-2">
              <div id="dialogMessage" className="text-sm text-neutral">{message}</div>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-neutral rounded-lg hover:bg-slate-300 transition"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`px-4 py-2 text-white rounded-lg transition shadow ${confirmColor}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
       <style>{`
        @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
        @keyframes fade-in-down {
          0% {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default ConfirmationModal;
