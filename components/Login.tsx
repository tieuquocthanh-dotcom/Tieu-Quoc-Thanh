
import React, { useState } from 'react';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
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
  // State register
  const [isRegisterMode, setIsRegisterMode] = useState(false);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegisterMode) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        // Cấu hình ghi nhớ đăng nhập trước khi sign in
        const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistenceType);
        await signInWithEmailAndPassword(auth, email, password);
      }
      // Thành công, App.tsx sẽ tự động chuyển hướng nhờ onAuthStateChanged
    } catch (err: any) {
      console.error("Login error:", err);
      
      let msg = isRegisterMode ? "Đăng ký thất bại." : "Đăng nhập thất bại.";
      if (err.code === 'auth/invalid-email') msg = "Email không hợp lệ.";
      if (err.code === 'auth/user-not-found') msg = "Không tìm thấy tài khoản này.";
      if (err.code === 'auth/wrong-password') msg = "Mật khẩu không chính xác.";
      if (err.code === 'auth/too-many-requests') msg = "Quá nhiều lần thử sai. Vui lòng thử lại sau.";
      if (err.code === 'auth/invalid-credential') msg = "Thông tin đăng nhập không chính xác.";
      if (err.code === 'auth/network-request-failed') msg = "Lỗi kết nối mạng.";
      if (err.code === 'auth/email-already-in-use') msg = "Email này đã được sử dụng.";
      if (err.code === 'auth/weak-password') msg = "Mật khẩu quá yếu (ít nhất 6 ký tự).";
      setError(msg);
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
          <h2 className="text-2xl font-bold text-dark">{isResetMode ? 'Khôi Phục Mật Khẩu' : isRegisterMode ? 'Đăng Ký Tài Khoản' : 'Đăng Nhập Hệ Thống'}</h2>
          <p className="text-neutral mt-2 text-sm">
              {isResetMode ? 'Nhập email để nhận liên kết đặt lại mật khẩu.' : isRegisterMode ? 'Tạo tài khoản mới để truy cập hệ thống.' : 'Bạn cần đăng nhập để truy cập vào cơ sở dữ liệu.'}
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
            {!isRegisterMode && (
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
                </div>
            )}

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
                {loading ? <Loader className="animate-spin h-5 w-5" /> : <><LogIn className="h-5 w-5 mr-2" /> {isRegisterMode ? 'Đăng Ký' : 'Đăng Nhập'}</>}
            </button>

            <div className="relative mt-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Hoặc</span>
                </div>
            </div>

            <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full mt-4 flex justify-center items-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                    />
                    <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                    />
                    <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                    />
                    <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                    />
                </svg>
                Đăng nhập bằng Google
            </button>
            </form>
        )}
        
        <div className="mt-6 text-center border-t pt-4">
            <p className="text-sm text-neutral">
                {isRegisterMode ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
                <button 
                    type="button"
                    onClick={() => { setIsRegisterMode(!isRegisterMode); setError(''); }}
                    className="ml-1 text-primary hover:text-primary-hover font-medium underline"
                >
                    {isRegisterMode ? 'Đăng nhập ngay' : 'Đăng ký ngay'}
                </button>
            </p>
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
