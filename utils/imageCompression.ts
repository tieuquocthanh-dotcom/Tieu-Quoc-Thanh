/**
 * Nén ảnh chụp giao hàng (từ Camera hoặc File) sang định dạng JPEG sắc nét, dung lượng nhẹ (~60KB - 130KB)
 * giúp lưu trữ mượt mà trên Firestore và tải trang cực nhanh trên cả điện thoại lẫn máy tính.
 */
export const compressImageFile = (
  file: File | Blob,
  maxDimension: number = 1280,
  initialQuality: number = 0.78
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh.'));
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        reject(new Error('Dữ liệu ảnh trống.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Định dạng ảnh không hợp lệ.'));
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          // Vẽ nền trắng phòng trường hợp ảnh PNG trong suốt
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          let quality = initialQuality;
          let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

          // Nếu chuỗi base64 vẫn lớn hơn ~145KB, giảm nhẹ chất lượng để đảm bảo tối ưu bộ nhớ Firestore
          while (compressedDataUrl.length > 145000 && quality > 0.45) {
            quality -= 0.1;
            compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          // Nếu vẫn còn lớn, thu nhỏ kích thước xuống 960px
          if (compressedDataUrl.length > 155000) {
            const scale = 960 / Math.max(width, height);
            if (scale < 1) {
              const smallCanvas = document.createElement('canvas');
              smallCanvas.width = Math.round(width * scale);
              smallCanvas.height = Math.round(height * scale);
              const sCtx = smallCanvas.getContext('2d');
              if (sCtx) {
                sCtx.fillStyle = '#FFFFFF';
                sCtx.fillRect(0, 0, smallCanvas.width, smallCanvas.height);
                sCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
                compressedDataUrl = smallCanvas.toDataURL('image/jpeg', 0.68);
              }
            }
          }

          resolve(compressedDataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
};

export const compressMultipleImages = async (
  files: FileList | File[]
): Promise<string[]> => {
  const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
  const results: string[] = [];
  for (const file of fileArray) {
    const compressed = await compressImageFile(file);
    results.push(compressed);
  }
  return results;
};
