
import React from 'react';
import { LayoutDashboard, ShoppingCart, Archive, Settings, Package, Users, LogIn } from 'lucide-react';
import { User } from 'firebase/auth';

interface LandingPageProps {
  onNavigate: (view: any) => void;
  user: User | null;
  userRole: 'admin' | 'staff' | null;
}

interface MenuCardProps {
  title: string;
  icon: React.ReactNode;
  description: string;
  target: string;
  colorClass: string;
  onNavigate: (view: string) => void;
}

const MenuCard: React.FC<MenuCardProps> = ({ title, icon, description, target, colorClass, onNavigate }) => (
  <button 
    onClick={() => onNavigate(target)}
    className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-slate-100 flex flex-col items-center text-center h-full group"
  >
    <div className={`p-4 rounded-full mb-4 ${colorClass} group-hover:scale-110 transition-transform`}>
      {icon}
    </div>
    <h3 className="text-xl font-bold text-dark mb-2">{title}</h3>
    <p className="text-sm text-neutral">{description}</p>
  </button>
);

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, user, userRole }) => {
  const isAdmin = userRole === 'admin';

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-4 animate-fade-in">
      <div className="text-center mb-12 max-w-2xl">
        <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-4">
             <Package size={32} className="text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-dark mb-4 tracking-tight">
          Chương Trình Quản Lý <br/> <span className="text-primary">Kho & Bán Hàng</span>
        </h1>
        <p className="text-lg text-neutral mb-6">
          Giải pháp quản lý toàn diện, đơn giản và hiệu quả cho cửa hàng của bạn.
        </p>
        
        {user ? (
            <div className="bg-green-50 text-green-700 px-4 py-2 rounded-full inline-flex items-center text-sm font-medium border border-green-200">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Xin chào, {user.displayName || user.email} ({userRole === 'admin' ? 'Quản trị' : 'Nhân viên'})
            </div>
        ) : (
            <button 
                onClick={() => onNavigate('login')}
                className="bg-primary text-white px-6 py-3 rounded-full inline-flex items-center text-base font-bold shadow-lg hover:bg-primary-hover transition-transform hover:scale-105"
            >
                <LogIn size={20} className="mr-2"/>
                Đăng nhập hệ thống
            </button>
        )}
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-6 w-full max-w-6xl`}>
        {isAdmin && (
            <MenuCard 
                title="Dashboard" 
                description="Xem báo cáo doanh thu, thống kê tồn kho và hoạt động gần đây." 
                icon={<LayoutDashboard size={32} className="text-blue-600"/>} 
                target="dashboard"
                colorClass="bg-blue-50"
                onNavigate={onNavigate}
            />
        )}
        
        <MenuCard 
          title="Bán Hàng" 
          description="Tạo đơn hàng mới, quản lý giỏ hàng và thanh toán nhanh chóng." 
          icon={<ShoppingCart size={32} className="text-green-600"/>} 
          target="sales"
          colorClass="bg-green-50"
          onNavigate={onNavigate}
        />
        <MenuCard 
          title="Nhập Hàng" 
          description="Quản lý phiếu nhập kho, nhà cung cấp và công nợ phải trả." 
          icon={<Archive size={32} className="text-orange-600"/>} 
          target="goodsReceipt"
          colorClass="bg-orange-50"
          onNavigate={onNavigate}
        />
        
        {isAdmin && (
            <MenuCard 
                title="Hệ Thống" 
                description="Quản lý sản phẩm, khách hàng, nhân viên và cấu hình cài đặt." 
                icon={<Settings size={32} className="text-purple-600"/>} 
                target="settings_menu" 
                colorClass="bg-purple-50"
                onNavigate={onNavigate}
            />
        )}
      </div>

      <div className="mt-12 text-center text-slate-400 text-sm">
        &copy; {new Date().getFullYear()} Phần mềm quản lý kho. Phiên bản 1.1.0
      </div>
      
      <style>{`
        @keyframes fade-in { 
          0% { opacity: 0; } 
          100% { opacity: 1; } 
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default LandingPage;
