import React, { useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

const Toast: React.FC<{ message: string; type: 'error' | 'success'; onClose: () => void }> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => onClose(), 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-up z-50 text-white font-bold
            ${type === 'success' ? 'bg-slate-800 border-2 border-primary' : 'bg-red-500 border-2 border-red-700'}`}>
            {type === 'success' ? <CheckCircle className="text-primary" /> : <XCircle className="text-white" />}
            {message}
        </div>
    );
};

export default Toast;
