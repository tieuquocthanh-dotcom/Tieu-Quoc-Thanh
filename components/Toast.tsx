import React, { useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

export interface ToastProps {
    message: string;
    type: 'error' | 'success';
    onClose: () => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration }) => {
    useEffect(() => {
        const time = duration !== undefined ? duration : (type === 'success' ? 1000 : 2500);
        const timer = setTimeout(() => onClose(), time);
        return () => clearTimeout(timer);
    }, [onClose, duration, type]);

    return (
        <div className={`fixed bottom-5 right-5 max-w-md px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 text-white font-bold text-sm sm:text-base border transition-all pointer-events-none
            ${type === 'success' ? 'bg-slate-900/95 border-emerald-500 shadow-emerald-950/40 text-slate-50' : 'bg-red-600 border-red-700 shadow-red-950/40 text-white'}`}>
            {type === 'success' ? <CheckCircle className="text-emerald-400 flex-shrink-0" size={20} /> : <XCircle className="text-white flex-shrink-0" size={20} />}
            <span className="leading-snug">{message}</span>
        </div>
    );
};

export default Toast;
