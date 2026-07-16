import { ToastProvider } from './components/ToastContext';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'color: red; padding: 20px; font-family: sans-serif;';
    errorDiv.innerText = 'Lỗi nghiêm trọng: Không tìm thấy phần tử #root để khởi tạo ứng dụng.';
    document.body.appendChild(errorDiv);
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <ErrorBoundary>
      <ToastProvider><App /></ToastProvider>
    </ErrorBoundary>
  );
} catch (error) {
  console.error('Crash during root initialization:', error);
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: white; color: black; padding: 20px; text-align: center; font-family: sans-serif; z-index: 10000;';
  errorDiv.innerHTML = '<div><h1 style="color:red">Lỗi Khởi Động</h1><p>Ứng dụng không thể khởi động. Có thể do trình duyệt của bạn không hỗ trợ một số tính năng cần thiết.</p><p style="font-size: 10px; color: grey;">' + (error instanceof Error ? error.message : String(error)) + '</p><button onclick="window.location.reload()" style="padding: 10px 20px; background: blue; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 10px;">Thử tải lại trang</button></div>';
  document.body.appendChild(errorDiv);
}
