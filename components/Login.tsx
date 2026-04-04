
import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../services/firebase';
import { Lock, LogIn, AlertCircle, Loader, ArrowLeft } from 'lucide-react';

interface LoginProps {
    onBack?: () => void;
}

const Login: React.FC<LoginProps> = ({ onBack }) => {
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistenceType);

      const provider = new GoogleAuthProvider();
      // Force account selection to allow choosing a specific gmail account
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      await signInWithPopup(auth, provider);
      // Thành công, App.tsx sẽ tự động chuyển hướng nhờ onAuthStateChanged
    } catch (err: any) {
      console.error("Login error:", err);
      
      let msg = "Đăng nhập thất bại.";
      if (err.code === 'auth/popup-closed-by-user') msg = "Đăng nhập bị hủy.";
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
              Bạn cần đăng nhập để truy cập vào cơ sở dữ liệu.
          </p>
        </div>

        <div className="space-y-5">
            {/* Checkbox Ghi nhớ */}
            <div className="flex items-center justify-center mb-4">
                <div className="flex items-center">
                    <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-neutral cursor-pointer select-none">
                    Ghi nhớ đăng nhập
                    </label>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-start text-sm">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                <span>{error}</span>
                </div>
            )}

            <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {loading ? <Loader className="animate-spin h-5 w-5" /> : (
                    <>
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                            <path
                                fill="currentColor"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                            <path fill="none" d="M1 1h22v22H1z" />
                        </svg>
                        Đăng nhập bằng Google
                    </>
                )}
            </button>
        </div>
        
        <div className="mt-6 text-center border-t pt-4">
            <p className="text-xs text-neutral">Chỉ hỗ trợ đăng nhập bằng tài khoản Google (Gmail).</p>
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
