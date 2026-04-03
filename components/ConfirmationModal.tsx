import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border-4 border-slate-800 overflow-hidden animate-fade-in-down">
        <div className="bg-red-600 p-4 text-white flex justify-between items-center">
          <h3 className="font-black uppercase text-sm flex items-center"><AlertTriangle className="mr-2" size={20}/> {title}</h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20}/></button>
        </div>
        <div className="p-6 text-slate-700 font-medium">
          {message}
        </div>
        <div className="p-4 bg-slate-50 flex gap-2 border-t">
          <button onClick={onClose} className="flex-1 py-2 bg-white border-2 border-slate-800 rounded-xl font-black text-xs uppercase text-black transition hover:bg-slate-100">Hủy</button>
          <button onClick={onConfirm} className="flex-1 py-2 bg-red-600 text-white rounded-xl font-black text-xs uppercase shadow-lg transition active:scale-95 hover:bg-red-700">Xác nhận</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
