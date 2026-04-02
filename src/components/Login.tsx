
import React, { useState } from 'react';
import { auth, db } from '../services/firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { LogIn, Mail, Lock, AlertCircle, Chrome, ArrowLeft, Loader, Warehouse, User } from 'lucide-react';

interface LoginProps {
  onBack?: () => void;
  onCustomLogin?: (user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onBack, onCustomLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    try {
      // 1. Try internal login first
      // Check both email and username
      const emailQuery = query(collection(db, 'users'), where('email', '==', trimmedEmail.toLowerCase()));
      const usernameQuery = query(collection(db, 'users'), where('username', '==', trimmedEmail));
      
      const [emailSnap, usernameSnap] = await Promise.all([
        getDocs(emailQuery),
        getDocs(usernameQuery)
      ]);

      const userDoc = emailSnap.docs[0] || usernameSnap.docs[0];
      
      if (userDoc) {
        const userData = userDoc.data();
        console.log("User found in Firestore:", { id: userDoc.id, email: userData.email, username: userData.username });
        if (userData.password === trimmedPassword) {
          const customUser = {
            uid: userDoc.id,
            email: userData.email,
            displayName: userData.displayName,
            role: userData.role,
            isCustom: true
          };
          localStorage.setItem('customUser', JSON.stringify(customUser));
          if (onCustomLogin) onCustomLogin(customUser);
          return;
        } else {
          console.warn("Password mismatch for user:", userDoc.id);
        }
      } else {
        console.warn("User not found in Firestore for:", trimmedEmail);
      }

      // 2. Fallback to Firebase Auth
      // Only if it looks like an email
      if (trimmedEmail.includes('@')) {
        await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      } else {
        setError("Tên đăng nhập hoặc mật khẩu không chính xác.");
      }
    } catch (err: any) {
      console.error("Login error details:", {
        code: err.code,
        message: err.message,
        email: trimmedEmail
      });
      setError("Email hoặc mật khẩu không chính xác.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google login error:", err);
      setError("Không thể đăng nhập bằng Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden transform transition-all">
        <div className="p-10">
          <div className="text-center mb-10">
            <div className="inline-flex p-4 bg-blue-600 rounded-3xl shadow-xl shadow-blue-200 mb-6 rotate-3 hover:rotate-0 transition-all duration-300">
              <Warehouse className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-black text-blue-700 tracking-tight">KHO & BÁN HÀNG</h1>
            <p className="text-slate-600 font-bold text-sm mt-2">Hệ thống quản lý kho và bán lẻ chuyên nghiệp</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center text-red-700 text-sm font-medium animate-shake">
              <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1 uppercase tracking-wider">Tên đăng nhập hoặc Email</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-xl focus:border-blue-600 outline-none transition-all font-bold text-slate-800"
                  placeholder="Nhập username hoặc email..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1 uppercase tracking-wider">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-xl focus:border-blue-600 outline-none transition-all font-bold text-slate-800"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-700 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading && <Loader className="animate-spin mr-2" size={20} />}
              {loading ? "Đang xác thực..." : "Đăng Nhập Hệ Thống"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400 font-bold uppercase">Sử dụng tài khoản được cấp trong phần Quản lý người dùng</p>
          </div>

          {onBack && (
            <button
              onClick={onBack}
              className="w-full mt-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Quay lại trang chủ
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
};

export default Login;
