import React, { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

export interface ToastProps {
    message: string;
    type: 'error' | 'success';
    onClose: () => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration }) => {
    useEffect(() => {
        const time = duration !== undefined ? duration : (type === 'success' ? 2000 : 6000);
        const timer = setTimeout(() => onClose(), time);
        return () => clearTimeout(timer);
    }, [onClose, duration, type]);

    return (
        <div className={`fixed bottom-5 right-5 max-w-lg px-4 py-3 rounded-xl shadow-2xl flex items-start gap-3 z-[99999] text-white font-bold text-sm sm:text-base border transition-all pointer-events-auto animate-fade-in
            ${type === 'success' ? 'bg-slate-900/95 border-emerald-500 shadow-emerald-950/40 text-slate-50' : 'bg-red-600 border-red-700 shadow-red-950/40 text-white'}`}>
            {type === 'success' ? <CheckCircle className="text-emerald-400 flex-shrink-0 mt-0.5" size={20} /> : <XCircle className="text-white flex-shrink-0 mt-0.5" size={20} />}
            <div className="flex-1 whitespace-pre-line text-xs sm:text-sm font-medium leading-relaxed">
                {message}
            </div>
            <button 
                onClick={onClose} 
                className="text-white/70 hover:text-white flex-shrink-0 p-1 rounded hover:bg-black/20 transition-colors"
                title="Đóng"
            >
                <X size={16} />
            </button>
        </div>
    );
};

export default Toast;
