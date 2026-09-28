/**
 * Bộ xử lý nén ảnh Siêu Nhẹ (Ultra-Light Image Compression Engine)
 * Dùng chung cho cả Bán Hàng (Ảnh giao hàng) và Nhập Hàng (Ảnh nhập hàng / Hóa đơn).
 *
 * Đặc điểm tối ưu:
 * 1. Tự động ưu tiên định dạng WebP (nhẹ hơn JPEG 35% - 45% cùng độ nét), tự động fallback về JPEG trên trình duyệt cũ.
 * 2. Thu nhỏ kích thước đa bước (Multi-step high-quality downscaling) giúp giữ nguyên độ sắc nét của chữ trên hóa đơn/kiện hàng dù kích thước ảnh nhỏ.
 * 3. Trọng lượng mục tiêu siêu nhẹ: trung bình chỉ ~25KB - 45KB / ảnh (giảm ~98% - 99% so với ảnh gốc 3MB - 8MB từ điện thoại).
 * 4. Giúp tốc độ gửi ảnh lên Server (Firestore) nhanh tức thì cả khi sóng 3G/4G yếu và tiết kiệm tối đa dung lượng lưu trữ.
 */

export type ImageCompressionPreset = 'ultra_light' | 'high_clarity';

export interface SingleCompressionStats {
  dataUrl: string;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
  format: 'webp' | 'jpeg';
}

export interface BatchCompressionStats {
  images: string[];
  originalTotalBytes: number;
  compressedTotalBytes: number;
  savedPercentage: number;
  summaryText: string;
}

const STORAGE_PRESET_KEY = 'pos_image_compression_preset';

export const getSavedCompressionPreset = (): ImageCompressionPreset => {
  try {
    const saved = localStorage.getItem(STORAGE_PRESET_KEY);
    if (saved === 'high_clarity' || saved === 'ultra_light') return saved;
  } catch {
    // ignore
  }
  return 'ultra_light';
};

export const setSavedCompressionPreset = (preset: ImageCompressionPreset): void => {
  try {
    localStorage.setItem(STORAGE_PRESET_KEY, preset);
  } catch {
    // ignore
  }
};

/**
 * Ước tính dung lượng thực tế (Bytes) của một chuỗi Data URL Base64
 */
export const getDataUrlByteSize = (dataUrl: string): number => {
  if (!dataUrl) return 0;
  const commaIdx = dataUrl.indexOf(',');
  const base64Length = commaIdx >= 0 ? dataUrl.length - (commaIdx + 1) : dataUrl.length;
  return Math.max(0, Math.round((base64Length * 3) / 4));
};

/**
 * Trả về dung lượng KB của 1 ảnh Data URL
 */
export const getDataUrlKB = (dataUrl: string): number => {
  return Math.max(1, Math.round(getDataUrlByteSize(dataUrl) / 1024));
};

/**
 * Tính tổng dung lượng KB của danh sách ảnh
 */
export const getImagesTotalKB = (images: string[]): number => {
  if (!images || images.length === 0) return 0;
  const totalBytes = images.reduce((sum, img) => sum + getDataUrlByteSize(img), 0);
  return Math.max(1, Math.round(totalBytes / 1024));
};

/**
 * Định dạng dung lượng dễ đọc (VD: "32 KB", "4.2 MB")
 */
export const formatByteSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) {
    return kb < 10 ? `${kb.toFixed(1)} KB` : `${Math.round(kb)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

/**
 * Kiểm tra trình duyệt có hỗ trợ xuất ảnh WebP từ Canvas hay không
 */
let cachedWebPSupport: boolean | null = null;
const supportsCanvasWebP = (): boolean => {
  if (cachedWebPSupport !== null) return cachedWebPSupport;
  try {
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 2;
    testCanvas.height = 2;
    const dataUrl = testCanvas.toDataURL('image/webp', 0.75);
    cachedWebPSupport = dataUrl.startsWith('data:image/webp');
  } catch {
    cachedWebPSupport = false;
  }
  return cachedWebPSupport;
};

/**
 * Thu nhỏ ảnh theo từng bước (bước giảm 50%) giúp chữ trên hóa đơn / tem nhãn
 * không bị răng cưa hay nhòe khi thu nhỏ từ ảnh Camera 12MP-48MP xuống ~800px
 */
const drawImageSteppedDown = (
  sourceImg: HTMLImageElement | HTMLCanvasElement,
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement => {
  let curCanvas = document.createElement('canvas');
  let curW = srcWidth;
  let curH = srcHeight;

  // Nếu ảnh gốc lớn hơn gấp đôi kích thước đích, giảm từng nấc 50%
  if (curW > targetWidth * 2 || curH > targetHeight * 2) {
    curW = Math.max(targetWidth, Math.round(curW * 0.5));
    curH = Math.max(targetHeight, Math.round(curH * 0.5));
    curCanvas.width = curW;
    curCanvas.height = curH;
    const ctx = curCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, curW, curH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceImg, 0, 0, curW, curH);
    }

    while (curW > targetWidth * 2 || curH > targetHeight * 2) {
      const nextW = Math.max(targetWidth, Math.round(curW * 0.5));
      const nextH = Math.max(targetHeight, Math.round(curH * 0.5));
      const nextCanvas = document.createElement('canvas');
      nextCanvas.width = nextW;
      nextCanvas.height = nextH;
      const nextCtx = nextCanvas.getContext('2d');
      if (nextCtx) {
        nextCtx.fillStyle = '#FFFFFF';
        nextCtx.fillRect(0, 0, nextW, nextH);
        nextCtx.imageSmoothingEnabled = true;
        nextCtx.imageSmoothingQuality = 'high';
        nextCtx.drawImage(curCanvas, 0, 0, curW, curH, 0, 0, nextW, nextH);
      }
      curCanvas = nextCanvas;
      curW = nextW;
      curH = nextH;
    }

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = targetWidth;
    finalCanvas.height = targetHeight;
    const fCtx = finalCanvas.getContext('2d');
    if (fCtx) {
      fCtx.fillStyle = '#FFFFFF';
      fCtx.fillRect(0, 0, targetWidth, targetHeight);
      fCtx.imageSmoothingEnabled = true;
      fCtx.imageSmoothingQuality = 'high';
      fCtx.drawImage(curCanvas, 0, 0, curW, curH, 0, 0, targetWidth, targetHeight);
    }
    return finalCanvas;
  }

  // Trường hợp ảnh không quá lớn, vẽ trực tiếp với bộ lọc mịn cao cấp
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetWidth;
  finalCanvas.height = targetHeight;
  const fCtx = finalCanvas.getContext('2d');
  if (fCtx) {
    fCtx.fillStyle = '#FFFFFF';
    fCtx.fillRect(0, 0, targetWidth, targetHeight);
    fCtx.imageSmoothingEnabled = true;
    fCtx.imageSmoothingQuality = 'high';
    fCtx.drawImage(sourceImg, 0, 0, targetWidth, targetHeight);
  }
  return finalCanvas;
};

/**
 * Nén 1 phần tử HTMLImageElement sang chuỗi Data URL siêu nhẹ
 */
const compressHtmlImageElement = (
  img: HTMLImageElement,
  originalBytes: number,
  preset: ImageCompressionPreset = getSavedCompressionPreset()
): SingleCompressionStats => {
  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;

  if (!srcWidth || !srcHeight) {
    throw new Error('Không đọc được kích thước ảnh. Định dạng ảnh này có thể không được hỗ trợ.');
  }

  // Cấu hình theo chế độ:
  // - ultra_light (Mặc định): Kích thước tối đa 840px, dung lượng mục tiêu ~22KB - 45KB (Base64 <= 62,000 ký tự)
  // - high_clarity (Rõ chữ HĐ): Kích thước tối đa 1080px, dung lượng mục tiêu ~45KB - 75KB (Base64 <= 102,000 ký tự)
  const maxDimension = preset === 'ultra_light' ? 840 : 1080;
  const maxBase64Length = preset === 'ultra_light' ? 62000 : 102000;
  const hardCapBase64Length = preset === 'ultra_light' ? 74000 : 118000;
  const initialQuality = preset === 'ultra_light' ? 0.66 : 0.74;
  const minQuality = preset === 'ultra_light' ? 0.38 : 0.48;

  let width = srcWidth;
  let height = srcHeight;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  let currentCanvas = drawImageSteppedDown(img, srcWidth, srcHeight, width, height);
  const useWebP = supportsCanvasWebP();
  const mimeType = useWebP ? 'image/webp' : 'image/jpeg';

  let quality = initialQuality;
  let compressedDataUrl = currentCanvas.toDataURL(mimeType, quality);

  // Phòng trường hợp trình duyệt trả về PNG khi gọi image/webp
  const actualMime = compressedDataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
  if (actualMime === 'image/jpeg' && useWebP) {
    compressedDataUrl = currentCanvas.toDataURL('image/jpeg', quality);
  }

  // Bước 1: Giảm dần hệ số chất lượng nếu vượt ngưỡng mục tiêu
  while (compressedDataUrl.length > maxBase64Length && quality > minQuality) {
    quality = Math.max(minQuality, +(quality - 0.08).toFixed(2));
    compressedDataUrl = currentCanvas.toDataURL(actualMime, quality);
  }

  // Bước 2: Nếu ảnh nhiều chi tiết vẫn vượt ngưỡng, hạ kích thước xuống 680px (hoặc 860px) để đảm bảo siêu nhẹ
  if (compressedDataUrl.length > hardCapBase64Length) {
    const fallbackDim = preset === 'ultra_light' ? 660 : 860;
    const scale = fallbackDim / Math.max(width, height);
    if (scale < 1) {
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      currentCanvas = drawImageSteppedDown(currentCanvas, currentCanvas.width, currentCanvas.height, width, height);
      quality = preset === 'ultra_light' ? 0.56 : 0.64;
      compressedDataUrl = currentCanvas.toDataURL(actualMime, quality);

      while (compressedDataUrl.length > maxBase64Length && quality > 0.36) {
        quality = +(quality - 0.08).toFixed(2);
        compressedDataUrl = currentCanvas.toDataURL(actualMime, quality);
      }
    }
  }

  // Bước 3: Chốt chặn cuối cùng nếu ảnh cực kỳ phức tạp vẫn > hardCapBase64Length
  if (compressedDataUrl.length > hardCapBase64Length) {
    const emergencyDim = 540;
    const scale = emergencyDim / Math.max(width, height);
    if (scale < 1) {
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      currentCanvas = drawImageSteppedDown(currentCanvas, currentCanvas.width, currentCanvas.height, width, height);
      compressedDataUrl = currentCanvas.toDataURL(actualMime, 0.5);
    }
  }

  if (!compressedDataUrl || !compressedDataUrl.startsWith('data:image/')) {
    throw new Error('Không thể xuất dữ liệu ảnh sau khi nén.');
  }

  const compressedBytes = getDataUrlByteSize(compressedDataUrl);

  return {
    dataUrl: compressedDataUrl,
    originalBytes: originalBytes || compressedBytes,
    compressedBytes,
    width,
    height,
    format: actualMime === 'image/webp' ? 'webp' : 'jpeg'
  };
};

/**
 * Nén 1 File/Blob ảnh kèm thông số chi tiết trước và sau khi nén
 */
export const compressImageFileWithStats = (
  file: File | Blob,
  preset: ImageCompressionPreset = getSavedCompressionPreset()
): Promise<SingleCompressionStats> => {
  return new Promise((resolve, reject) => {
    let objectUrl: string | null = null;
    const originalBytes = file.size || 0;

    const handleLoadedImage = (img: HTMLImageElement) => {
      try {
        const stats = compressHtmlImageElement(img, originalBytes, preset);
        resolve(stats);
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
          reject(new Error('Định dạng ảnh không hỗ trợ (vui lòng chụp ảnh JPEG/PNG/WebP chuẩn).'));
        img2.onload = () => handleLoadedImage(img2);
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
      img.onload = () => handleLoadedImage(img);
      img.src = objectUrl;
    } catch {
      fallbackToFileReader();
    }
  });
};

/**
 * Hàm chuẩn trả về chuỗi Data URL của 1 ảnh đã nén tối ưu
 */
export const compressImageFile = async (
  file: File | Blob,
  preset: ImageCompressionPreset = getSavedCompressionPreset()
): Promise<string> => {
  const stats = await compressImageFileWithStats(file, preset);
  return stats.dataUrl;
};

/**
 * Nén nhiều ảnh cùng lúc và trả về thông tin thống kê dung lượng đã giảm
 */
export const compressMultipleImagesWithStats = async (
  files: FileList | File[],
  preset: ImageCompressionPreset = getSavedCompressionPreset()
): Promise<BatchCompressionStats> => {
  const fileArray = Array.from(files);
  if (fileArray.length === 0) {
    return {
      images: [],
      originalTotalBytes: 0,
      compressedTotalBytes: 0,
      savedPercentage: 0,
      summaryText: ''
    };
  }

  const results: string[] = [];
  const errors: string[] = [];
  let originalTotalBytes = 0;
  let compressedTotalBytes = 0;

  for (const file of fileArray) {
    try {
      const stat = await compressImageFileWithStats(file, preset);
      results.push(stat.dataUrl);
      originalTotalBytes += stat.originalBytes;
      compressedTotalBytes += stat.compressedBytes;
    } catch (err: any) {
      console.error('Lỗi nén file ảnh:', file.name, err);
      errors.push(err?.message || 'Lỗi xử lý ảnh');
    }
  }

  if (results.length === 0 && errors.length > 0) {
    throw new Error(errors[0]);
  }

  const savedPercentage =
    originalTotalBytes > compressedTotalBytes && originalTotalBytes > 0
      ? Math.min(99.5, Math.max(1, Math.round(((originalTotalBytes - compressedTotalBytes) / originalTotalBytes) * 100)))
      : 0;

  const summaryText =
    originalTotalBytes > 0
      ? `Đã nén siêu nhẹ: ${formatByteSize(originalTotalBytes)} ➔ ${formatByteSize(compressedTotalBytes)}${
          savedPercentage > 0 ? ` (Giảm ${savedPercentage}%)` : ''
        }`
      : `Dung lượng sau nén: ${formatByteSize(compressedTotalBytes)}`;

  return {
    images: results,
    originalTotalBytes,
    compressedTotalBytes,
    savedPercentage,
    summaryText
  };
};

/**
 * Nén nhiều ảnh và trả về mảng Data URL (tương thích ngược với toàn bộ các màn hình)
 */
export const compressMultipleImages = async (
  files: FileList | File[],
  preset: ImageCompressionPreset = getSavedCompressionPreset()
): Promise<string[]> => {
  const batch = await compressMultipleImagesWithStats(files, preset);
  return batch.images;
};

/**
 * Nén lại các ảnh cũ đã lưu trong đơn hàng / phiếu nhập (nếu trước đây lưu ảnh nặng > 65KB)
 */
export const recompressExistingDataUrls = async (
  dataUrls: string[],
  preset: ImageCompressionPreset = 'ultra_light'
): Promise<BatchCompressionStats> => {
  if (!dataUrls || dataUrls.length === 0) {
    return {
      images: [],
      originalTotalBytes: 0,
      compressedTotalBytes: 0,
      savedPercentage: 0,
      summaryText: ''
    };
  }

  let originalTotalBytes = 0;
  let compressedTotalBytes = 0;
  const newImages: string[] = [];

  for (const url of dataUrls) {
    const origBytes = getDataUrlByteSize(url);
    originalTotalBytes += origBytes;

    // Nếu ảnh đã nhẹ (< 42KB), giữ nguyên để không tốn CPU
    if (origBytes > 0 && origBytes <= 43000) {
      newImages.push(url);
      compressedTotalBytes += origBytes;
      continue;
    }

    try {
      const recompressed = await new Promise<SingleCompressionStats>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onerror = () => reject(new Error('Không đọc được ảnh cũ'));
        img.onload = () => {
          try {
            resolve(compressHtmlImageElement(img, origBytes, preset));
          } catch (e) {
            reject(e);
          }
        };
        img.src = url;
      });
      // Chỉ lấy ảnh mới nếu nhẹ hơn ảnh cũ
      if (recompressed.compressedBytes < origBytes) {
        newImages.push(recompressed.dataUrl);
        compressedTotalBytes += recompressed.compressedBytes;
      } else {
        newImages.push(url);
        compressedTotalBytes += origBytes;
      }
    } catch {
      newImages.push(url);
      compressedTotalBytes += origBytes;
    }
  }

  const savedPercentage =
    originalTotalBytes > compressedTotalBytes && originalTotalBytes > 0
      ? Math.max(1, Math.round(((originalTotalBytes - compressedTotalBytes) / originalTotalBytes) * 100))
      : 0;

  const summaryText = `Đã tối ưu dung lượng: ${formatByteSize(originalTotalBytes)} ➔ ${formatByteSize(compressedTotalBytes)}${
    savedPercentage > 0 ? ` (Giảm ${savedPercentage}%)` : ''
  }`;

  return {
    images: newImages,
    originalTotalBytes,
    compressedTotalBytes,
    savedPercentage,
    summaryText
  };
};
