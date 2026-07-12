
import React, { useState } from 'react';
import { signInWithPopup, signInWithRedirect, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { Lock, LogIn, AlertCircle, Loader, ArrowLeft, Mail, Key } from 'lucide-react';

interface LoginProps {
    onBack?: () => void;
}

type AuthMode = 'login' | 'forgot';

const Login: React.FC<LoginProps> = ({ onBack }) => {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleError = (err: any) => {
      console.error("Auth error:", err);
      let msg = "Có lỗi xảy ra.";
      if (err.code === 'auth/popup-closed-by-user') msg = "Cửa sổ đăng nhập đã bị đóng.";
      if (err.code === 'auth/cancelled-popup-request') msg = "Yêu cầu đăng nhập đã bị hủy.";
      if (err.code === 'auth/network-request-failed') msg = "Lỗi kết nối mạng.";
      if (err.code === 'auth/unauthorized-domain') msg = "LỖI TÊN MIỀN: Bạn cần thêm tên miền này vào danh sách Authorized domains.";
      if (err.code === 'auth/invalid-email') msg = "Email không hợp lệ.";
      if (err.code === 'auth/user-disabled') msg = "Tài khoản đã bị vô hiệu hóa.";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') msg = "Email hoặc mật khẩu không chính xác.";
      if (err.code === 'auth/wrong-password') msg = "Mật khẩu không chính xác.";
      if (err.code === 'auth/email-already-in-use') msg = "Email này đã được sử dụng.";
      if (err.code === 'auth/weak-password') msg = "Mật khẩu quá yếu (tối thiểu 6 ký tự).";
      
      setError(msg);
  };

  const handleGoogleLogin = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
          await signInWithRedirect(auth, googleProvider);
      } else {
          await signInWithPopup(auth, googleProvider);
      }
    } catch (err: any) {
      handleError(err);
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setMessage('');
      setLoading(true);

      try {
          if (mode === 'login') {
              await signInWithEmailAndPassword(auth, email, password);
          } else if (mode === 'forgot') {
              await sendPasswordResetEmail(auth, email);
              setMessage("Email khôi phục mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư của bạn.");
              setMode('login');
              setPassword('');
          }
      } catch (err: any) {
          handleError(err);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 relative py-12">
      {onBack && (
        <button 
            onClick={onBack}
            className="absolute top-4 left-4 flex items-center text-neutral hover:text-dark transition"
        >
            <ArrowLeft size={20} className="mr-1"/> Quay lại
        </button>
      )}
      
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100 animate-fade-in-down">
        <div className="text-center mb-6">
          <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            {mode === 'forgot' ? <Key className="text-primary" size={32} /> : <Lock className="text-primary" size={32} />}
          </div>
          <h2 className="text-2xl font-bold text-dark">
              {mode === 'login' ? 'Đăng Nhập' : 'Khôi Phục Mật Khẩu'}
          </h2>
          <p className="text-neutral mt-2 text-sm">
              {mode === 'login' ? 'Đăng nhập để truy cập hệ thống' : 
               'Nhập email để nhận liên kết khôi phục'}
          </p>
        </div>

        {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-start text-sm mb-4">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                <span>{error}</span>
            </div>
        )}
        
        {message && (
            <div className="bg-green-50 text-green-700 p-3 rounded-lg flex items-start text-sm mb-4">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                <span>{message}</span>
            </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="email" 
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        placeholder="you@example.com"
                    />
                </div>
            </div>
            
            {mode !== 'forgot' && (
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="password" 
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            placeholder="••••••••"
                        />
                    </div>
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70"
            >
                {loading ? <Loader className="animate-spin h-5 w-5" /> : (
                    mode === 'login' ? 'Đăng Nhập' : 'Gửi Yêu Cầu'
                )}
            </button>
        </form>
        
        <div className="flex items-center justify-between mt-4 text-sm">
            {mode === 'login' ? (
                <>
                    <button type="button" onClick={() => { setMode('forgot'); setError(''); setMessage(''); }} className="text-primary hover:underline font-medium mx-auto">Quên mật khẩu?</button>
                </>
            ) : (
                <button type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }} className="text-primary hover:underline font-medium mx-auto">
                    Quay lại đăng nhập
                </button>
            )}
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-slate-500">Hoặc tiếp tục với</span>
                </div>
            </div>

            <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="mt-6 w-full flex justify-center items-center py-2.5 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-bold text-dark bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 transition-all disabled:opacity-70"
            >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-5 w-5 mr-3" />
                Google
            </button>
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

