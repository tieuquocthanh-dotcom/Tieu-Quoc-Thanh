import React from 'react';
import { AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';
import { isFirebaseConfigured } from '../services/firebase';


const FirebaseSetupGuide: React.FC = () => {
  const configBlock = `
const firebaseConfig = {
  apiKey: "AIzaSyA5SMwhA4h8NW4I5qVqqtqPOI139QJgg1w",
  authDomain: "projectkhohangtest.firebaseapp.com",
  projectId: "projectkhohangtest",
  storageBucket: "projectkhohangtest.firebasestorage.app",
  messagingSenderId: "988773842246",
  appId: "1:988773842246:web:086d4e67342668f7e23947",
  measurementId: "G-73T4GZ0KN0"
};
  `;

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-lg">
      <div className="flex items-center mb-6">
        <h1 className="text-3xl font-bold text-dark mr-4">Hướng Dẫn Cài Đặt Firebase</h1>
        {isFirebaseConfigured ? (
          <div className="flex items-center space-x-2 text-green-600 bg-green-100 px-3 py-1 rounded-full">
            <CheckCircle size={20} />
            <span className="font-semibold">Đã cấu hình</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-red-600 bg-red-100 px-3 py-1 rounded-full">
            <AlertTriangle size={20} />
            <span className="font-semibold">Chưa cấu hình</span>
          </div>
        )}
      </div>

      {!isFirebaseConfigured && (
        <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-6 rounded-md" role="alert">
            <p className="font-bold">Hành Động Bắt Buộc</p>
            <p>Ứng dụng của bạn chưa được kết nối với cơ sở dữ liệu. Vui lòng làm theo các bước dưới đây để hoàn tất cài đặt và bắt đầu sử dụng.</p>
        </div>
      )}

      <p className="text-neutral mb-6">
        Để ứng dụng hoạt động, bạn cần kết nối nó với một cơ sở dữ liệu Firebase Firestore. Hãy làm theo các bước dưới đây. Quá trình này chỉ mất vài phút.
      </p>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-primary mb-2">Bước 1: Tạo dự án Firebase</h2>
          <ol className="list-decimal list-inside text-neutral space-y-1">
            <li>Truy cập <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Firebase Console</a>.</li>
            <li>Nhấp vào "Add project" (Thêm dự án) và làm theo hướng dẫn để tạo một dự án mới.</li>
          </ol>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-primary mb-2">Bước 2: Tạo ứng dụng Web và kích hoạt Firestore</h2>
          <ol className="list-decimal list-inside text-neutral space-y-1">
            <li>Trong trang tổng quan dự án của bạn, nhấp vào biểu tượng web ({'</>'}) để thêm ứng dụng web mới.</li>
            <li>Đặt tên cho ứng dụng và nhấp vào "Register app" (Đăng ký ứng dụng).</li>
            <li>Sau khi đăng ký, Firebase sẽ cung cấp cho bạn một đối tượng cấu hình (firebaseConfig). <strong>Hãy sao chép nó.</strong></li>
            <li>Từ menu bên trái, đi đến "Build" &gt; "Firestore Database".</li>
            <li>Nhấp vào "Create database" (Tạo cơ sở dữ liệu), chọn bắt đầu ở chế độ <strong>test mode</strong> (chế độ thử nghiệm), chọn vị trí và nhấp vào "Enable" (Bật).</li>
          </ol>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-primary mb-2">Bước 3: Cập nhật cấu hình trong mã nguồn</h2>
          <ol className="list-decimal list-inside text-neutral space-y-1">
            <li>Mở tệp <code className="bg-slate-200 text-sm px-1 rounded">services/firebase.ts</code> trong dự án của bạn.</li>
            <li>Tìm biến <code className="bg-slate-200 text-sm px-1 rounded">firebaseConfig</code>.</li>
            <li>Dán đối tượng cấu hình bạn đã sao chép từ Firebase vào đây, thay thế các giá trị giữ chỗ.</li>
          </ol>
          <pre className="bg-slate-800 text-white p-4 rounded-lg mt-4 overflow-x-auto text-sm">
            <code>{configBlock.trim()}</code>
          </pre>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-primary mb-2">Bước 4: Hoàn tất</h2>
          <p className="text-neutral">
            Lưu tệp và làm mới lại ứng dụng. Nếu mọi thứ được cấu hình chính xác, thông báo "Chưa cấu hình" sẽ biến mất và bạn có thể bắt đầu sử dụng các tính năng của ứng dụng.
          </p>
        </div>

        <div className="border-t pt-6">
           <h2 className="text-xl font-semibold text-orange-600 mb-3 flex items-center">
             <HelpCircle size={20} className="mr-2"/> Xử Lý Sự Cố
           </h2>
           <div className="space-y-2 text-neutral">
              <p>
                <strong>Lỗi "Missing or insufficient permissions":</strong> Lỗi này xảy ra khi Luật Bảo Mật (Security Rules) của Firestore không cho phép ứng dụng đọc/ghi dữ liệu. Đảm bảo rằng bạn đã chọn <strong>"chế độ thử nghiệm" (test mode)</strong> ở Bước 2.
              </p>
              <p>
                <strong>Lỗi yêu cầu "Index":</strong> Khi ứng dụng phát triển và có các truy vấn dữ liệu phức tạp hơn, bạn có thể thấy một lỗi trong Console (nhấn F12) yêu cầu tạo "Index". Lỗi này sẽ cung cấp một đường link. Chỉ cần nhấp vào link đó và Firebase sẽ tự động tạo chỉ mục cần thiết để tối ưu hóa hiệu suất.
              </p>
           </div>
        </div>

      </div>
    </div>
  );
};

export default FirebaseSetupGuide;