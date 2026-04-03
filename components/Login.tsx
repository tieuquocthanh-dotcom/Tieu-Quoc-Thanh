
import React, { useState } from 'react';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../services/firebase';
import { Lock, Mail, LogIn, AlertCircle, Loader, Home, ArrowLeft, CheckSquare, Eye, EyeOff, KeyRound } from 'lucide-react';

interface LoginProps {
    onBack?: () => void;
}

const Login: React.FC<LoginProps> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // State cho hiện/ẩn pass
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  // State reset pass
  const [isResetMode, setIsResetMode] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Cấu hình ghi nhớ đăng nhập trước khi sign in
      const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistenceType);

      await signInWithEmailAndPassword(auth, email, password);
      // Thành công, App.tsx sẽ tự động chuyển hướng nhờ onAuthStateChanged
    } catch (err: any) {
      console.error("Login error:", err);
      
      let msg = "Đăng nhập thất bại.";
      if (err.code === 'auth/invalid-email') msg = "Email không hợp lệ.";
      if (err.code === 'auth/user-not-found') msg = "Không tìm thấy tài khoản này.";
      if (err.code === 'auth/wrong-password') msg = "Mật khẩu không chính xác.";
      if (err.code === 'auth/too-many-requests') msg = "Quá nhiều lần thử sai. Vui lòng thử lại sau.";
      if (err.code === 'auth/invalid-credential') msg = "Thông tin đăng nhập không chính xác.";
      if (err.code === 'auth/network-request-failed') msg = "Lỗi kết nối mạng.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google Login error:", err);
      setError("Đăng nhập bằng Google thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!email) {
          setError("Vui lòng nhập email để khôi phục mật khẩu.");
          return;
      }
      setLoading(true);
      setError('');
      setSuccessMsg('');
      
      try {
          await sendPasswordResetEmail(auth, email);
          setSuccessMsg(`Đã gửi email khôi phục mật khẩu đến ${email}. Vui lòng kiểm tra hộp thư (cả mục Spam).`);
          setIsResetMode(false); // Quay lại màn hình đăng nhập
      } catch (err: any) {
          console.error("Reset error:", err);
          let msg = "Không thể gửi email khôi phục.";
          if (err.code === 'auth/user-not-found') msg = "Email này chưa được đăng ký trong hệ thống.";
          if (err.code === 'auth/invalid-email') msg = "Địa chỉ email không hợp lệ.";
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
          <h2 className="text-2xl font-bold text-dark">{isResetMode ? 'Khôi Phục Mật Khẩu' : 'Đăng Nhập Hệ Thống'}</h2>
          <p className="text-neutral mt-2 text-sm">
              {isResetMode ? 'Nhập email để nhận liên kết đặt lại mật khẩu.' : 'Bạn cần đăng nhập để truy cập vào cơ sở dữ liệu.'}
          </p>
        </div>

        {successMsg && (
            <div className="bg-green-50 text-green-700 p-3 rounded-lg flex items-start text-sm mb-4 border border-green-200">
              <CheckSquare className="h-5 w-5 mr-2 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
        )}

        {isResetMode ? (
            // FORM RESET PASS
            <form onSubmit={handleResetPassword} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-dark mb-2">Email của bạn</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                            placeholder="user@example.com"
                        />
                    </div>
                </div>
                
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-start text-sm">
                    <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                    <span>{error}</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader className="animate-spin h-5 w-5" /> : <><KeyRound className="h-5 w-5 mr-2" /> Gửi Yêu Cầu</>}
                </button>
                
                <div className="text-center mt-4">
                    <button 
                        type="button"
                        onClick={() => { setIsResetMode(false); setError(''); }}
                        className="text-sm text-neutral hover:text-primary underline"
                    >
                        Quay lại đăng nhập
                    </button>
                </div>
            </form>
        ) : (
            // FORM ĐĂNG NHẬP
            <form onSubmit={handleLogin} className="space-y-5">
            <div>
                <label className="block text-sm font-medium text-dark mb-2">Email</label>
                <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                    placeholder="user@example.com"
                />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-dark mb-2">Mật khẩu</label>
                <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="block w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                    placeholder="••••••••"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
                </div>
            </div>

            {/* Checkbox Ghi nhớ & Quên mật khẩu */}
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-neutral cursor-pointer select-none">
                    Ghi nhớ
                    </label>
                </div>
                {/* 
                <button 
                    type="button"
                    onClick={() => { setIsResetMode(true); setError(''); }}
                    className="text-sm font-medium text-primary hover:text-primary-hover hover:underline"
                >
                    Quên mật khẩu?
                </button> 
                */}
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-start text-sm">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                <span>{error}</span>
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {loading ? <Loader className="animate-spin h-5 w-5" /> : <><LogIn className="h-5 w-5 mr-2" /> Đăng Nhập</>}
            </button>

            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-neutral">Hoặc đăng nhập với</span>
                </div>
            </div>

            <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-bold text-dark bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 mr-2" referrerPolicy="no-referrer" />
                Đăng nhập bằng Google
            </button>
            </form>
        )}
        
        <div className="mt-6 text-center border-t pt-4">
            <p className="text-xs text-neutral">Chưa có tài khoản? Vui lòng liên hệ Admin.</p>
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
