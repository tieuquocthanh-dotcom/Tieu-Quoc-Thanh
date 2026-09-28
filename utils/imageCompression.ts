/**
 * Nén ảnh chụp giao hàng (từ Camera hoặc Thư viện ảnh trên Điện thoại / Máy tính)
 * sang định dạng JPEG sắc nét, dung lượng nhẹ (~60KB - 130KB).
 * Sử dụng URL.createObjectURL kết hợp FileReader fallback để hoạt động mượt mà
 * trên iOS Safari, Android Chrome và trình duyệt máy tính.
 */
export const compressImageFile = (
  file: File | Blob,
  maxDimension: number = 1280,
  initialQuality: number = 0.78
): Promise<string> => {
  return new Promise((resolve, reject) => {
    let objectUrl: string | null = null;

    const processImageElement = (img: HTMLImageElement) => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          reject(new Error('Không đọc được kích thước ảnh. Định dạng ảnh này có thể không được trình duyệt hỗ trợ.'));
          return;
        }

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
          reject(new Error('Trình duyệt không hỗ trợ xử lý ảnh (Canvas 2D).'));
          return;
        }

        // Vẽ nền trắng phòng trường hợp ảnh PNG trong suốt
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let quality = initialQuality;
        let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // Giảm dần chất lượng nếu chuỗi base64 lớn hơn ~140KB để lưu Firestore nhanh và ổn định
        while (compressedDataUrl.length > 140000 && quality > 0.45) {
          quality -= 0.1;
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        // Nếu ảnh vẫn lớn hơn 150KB, thu nhỏ kích thước xuống tối đa 960px
        if (compressedDataUrl.length > 150000) {
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

        if (!compressedDataUrl || !compressedDataUrl.startsWith('data:image/')) {
          reject(new Error('Không thể xuất dữ liệu ảnh sau khi nén.'));
          return;
        }

        resolve(compressedDataUrl);
      } catch (err) {
        reject(err);
      } finally {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
      }
    };

    const fallbackToFileReader = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Không thể đọc file ảnh từ thiết bị.'));
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) {
          reject(new Error('Dữ liệu file ảnh trống.'));
          return;
        }
        const img2 = new Image();
        img2.onerror = () =>
          reject(new Error('Định dạng ảnh không hỗ trợ (vui lòng chụp ảnh JPEG/PNG chuẩn).'));
        img2.onload = () => processImageElement(img2);
        img2.src = dataUrl;
      };
      reader.readAsDataURL(file);
    };

    try {
      objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onerror = () => {
        fallbackToFileReader();
      };
      img.onload = () => processImageElement(img);
      img.src = objectUrl;
    } catch {
      fallbackToFileReader();
    }
  });
};

export const compressMultipleImages = async (
  files: FileList | File[]
): Promise<string[]> => {
  // Không lọc bỏ file có file.type rỗng vì trên một số điện thoại Android/iOS, file.type có thể là ""
  const fileArray = Array.from(files);
  if (fileArray.length === 0) return [];

  const results: string[] = [];
  const errors: string[] = [];

  for (const file of fileArray) {
    try {
      const compressed = await compressImageFile(file);
      results.push(compressed);
    } catch (err: any) {
      console.error('Lỗi nén file ảnh:', file.name, err);
      errors.push(err?.message || 'Lỗi xử lý ảnh');
    }
  }

  if (results.length === 0 && errors.length > 0) {
    throw new Error(errors[0]);
  }

  return results;
};
