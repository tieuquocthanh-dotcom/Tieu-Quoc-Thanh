import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// CẢNH BÁO QUAN TRỌNG:
// 1. Dán cấu hình Firebase của bạn vào đây.
// 2. Để lấy thông tin này, hãy làm theo các bước trong tab "Hướng Dẫn Cài Đặt" trên giao diện ứng dụng.
export const firebaseConfig = {
 apiKey: "AIzaSyC-eQ87i3jclQ4MU-IMf1hNadt-NN-VZXY",
  authDomain: "quan-ly-cua-hang-cua-ban.firebaseapp.com",
  projectId: "quan-ly-cua-hang-cua-ban",
  storageBucket: "quan-ly-cua-hang-cua-ban.firebasestorage.app",
  messagingSenderId: "721223599718",
  appId: "1:721223599718:web:f73f2eaa652d96042ecfa7"
};

// Bỏ qua kiểm tra placeholder vì người dùng xác nhận đã cấu hình xong.
// Luôn trả về true để mở khóa ứng dụng.
export const isFirebaseConfigured = true;


// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Khởi tạo Cloud Firestore và lấy tham chiếu đến dịch vụ
export const db = getFirestore(app);

// Khởi tạo Authentication và export
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
