
export const notifyError = (message: string, details?: string) => {
  console.error("Error:", message, details);
  // Bạn có thể tích hợp thư viện toast như sonner hoặc react-hot-toast ở đây
};

export const notifySuccess = (message: string) => {
  console.log("Success:", message);
};
