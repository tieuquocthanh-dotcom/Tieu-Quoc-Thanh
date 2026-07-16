const fs = require('fs');
const file = 'components/ToastContext.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    "const showToast = (message: string, type: ToastType) => {",
    `useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message) => {
      const msgStr = String(message);
      const isError = msgStr.toLowerCase().includes('lỗi') || 
                      msgStr.toLowerCase().includes('thiếu') || 
                      msgStr.toLowerCase().includes('không') ||
                      msgStr.toLowerCase().includes('vượt quá') ||
                      msgStr.toLowerCase().includes('vui lòng');
      setToast({ message: msgStr, type: isError ? 'error' : 'success' });
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  const showToast = (message: string, type: ToastType) => {`
);

content = content.replace("import React, { createContext, useContext, useState, ReactNode } from 'react';", "import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';");

fs.writeFileSync(file, content);
console.log('Patched ToastContext');
