
import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { Lock, LogIn, AlertCircle, Loader, ArrowLeft } from 'lucide-react';

interface LoginProps {
    onBack?: () => void;
}

const Login: React.FC<LoginProps> = ({ onBack }) => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      await signInWithPopup(auth, googleProvider);
      // Thành công, App.tsx sẽ tự động chuyển hướng nhờ onAuthStateChanged
    } catch (err: any) {
      console.error("Login error:", err);
      
      let msg = "Đăng nhập thất bại.";
      if (err.code === 'auth/popup-closed-by-user') msg = "Cửa sổ đăng nhập đã bị đóng.";
      if (err.code === 'auth/cancelled-popup-request') msg = "Yêu cầu đăng nhập đã bị hủy.";
      if (err.code === 'auth/network-request-failed') msg = "Lỗi kết nối mạng.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 relative">
      {onBack && (
        <button 
            onClick={onBack}
            className="absolute top-4 left-4 flex items-center text-neutral hover:text-dark transition"
        >
            <ArrowLeft size={20} className="mr-1"/> Quay lại trang chủ
        </button>
      )}
      
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100 animate-fade-in-down">
        <div className="text-center mb-8">
          <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="text-primary" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-dark">Đăng Nhập Hệ Thống</h2>
          <p className="text-neutral mt-2 text-sm">
              Bạn cần đăng nhập bằng tài khoản Google để truy cập vào hệ thống.
          </p>
        </div>

        {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-start text-sm mb-4">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span>{error}</span>
            </div>
        )}

        <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex justify-center items-center py-3 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-bold text-dark bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
            {loading ? (
                <Loader className="animate-spin h-5 w-5" />
            ) : (
                <>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-5 w-5 mr-3" />
                    Đăng nhập với Google
                </>
            )}
        </button>
        
        <div className="mt-6 text-center border-t pt-4">
            <p className="text-xs text-neutral">Chỉ những tài khoản được cấp quyền mới có thể truy cập.</p>
        </div>
      </div>
      <style>{`
        @keyframes fade-in-down {
          0% { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-down { animation: fade-in-down 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default Login;
