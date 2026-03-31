import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

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

// Kiểm tra xem cấu hình có phải là placeholder không
export const isFirebaseConfigured = 
  firebaseConfig.apiKey !== "YOUR_API_KEY_HERE" && 
  firebaseConfig.projectId !== "YOUR_PROJECT_ID_HERE";


// Khởi tạo Firebase
let app: any;
try {
  if (isFirebaseConfigured) {
    app = initializeApp(firebaseConfig);
  } else {
    console.warn("Firebase is using placeholder configuration.");
    app = null;
  }
} catch (error) {
  console.error("Firebase initialization failed:", error);
  app = null;
}

// Khởi tạo Cloud Firestore với cấu hình cache mới
let db: any = null;
if (app) {
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({})
    });
  } catch (e) {
    console.warn("Firestore persistent cache failed, falling back to default", e);
    try {
      db = getFirestore(app);
    } catch (err) {
      console.error("Firestore failed completely:", err);
      db = null;
    }
  }
}
export { db };

// Khởi tạo Authentication và export
export const auth = app ? getAuth(app) : null;

// Cấu hình lưu trữ phiên đăng nhập
if (typeof window !== "undefined" && auth) {
  // Đảm bảo sử dụng LOCAL persistence để phiên đăng nhập tồn tại ngay cả khi đóng trình duyệt hoặc khởi động lại thiết bị
  setPersistence(auth, browserLocalPersistence).then(() => {
    console.log("Auth persistence set to LOCAL");
  }).catch((err) => {
    console.error("Auth persistence failed:", err);
  });
}
