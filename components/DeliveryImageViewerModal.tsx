import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Camera,
  Image as ImageIcon,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Download,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader,
  Eye,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Maximize2
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Sale, GoodsReceipt } from '../types';
import {
  compressMultipleImagesWithStats,
  getDataUrlKB,
  getImagesTotalKB,
  recompressExistingDataUrls
} from '../utils/imageCompression';

interface DeliveryImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  orderId?: string;
  customerName?: string;
  saleId?: string; // Nếu truyền saleId, tự động lưu thẳng vào đơn bán hàng trên Firestore
  receiptId?: string; // Nếu truyền receiptId, tự động lưu thẳng vào phiếu nhập hàng trên Firestore
  noteId?: string; // Nếu truyền noteId, tự động lưu thẳng vào ghi chú hệ thống trên Firestore
  partnerLabel?: string;
  onImagesChange?: (newImages: string[]) => void;
  readOnly?: boolean;
}

export const DeliveryImageViewerModal: React.FC<DeliveryImageViewerModalProps> = ({
  isOpen,
  onClose,
  images: propImages,
  initialIndex = 0,
  orderId,
  customerName,
  saleId,
  receiptId,
  noteId,
  partnerLabel,
  onImagesChange,
  readOnly = false
}) => {
  const [localImages, setLocalImages] = useState<string[]>(propImages || []);
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Đồng bộ danh sách ảnh mới nhất khi mở trình xem hoặc khi propImages thay đổi
  useEffect(() => {
    if (isOpen) {
      const imgs = propImages || [];
      setLocalImages(imgs);
      setCurrentIndex((prevIdx) => {
        if (imgs.length === 0) return 0;
        return Math.min(Math.max(0, prevIdx), imgs.length - 1);
      });
    }
  }, [propImages, isOpen]);

  // Đặt lại trạng thái hiển thị khi mở modal lần đầu hoặc đổi initialIndex
  useEffect(() => {
    if (isOpen) {
      const imgs = propImages || [];
      const validIdx = Math.min(Math.max(0, initialIndex), Math.max(0, imgs.length - 1));
      setCurrentIndex(validIdx);
      setZoom(1);
      setRotation(0);
      setConfirmDeleteIdx(null);
      setUploadStatus(null);
    }
  }, [isOpen, initialIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDeleteIdx !== null) {
          setConfirmDeleteIdx(null);
        } else {
          onClose();
        }
      }
      if (e.key === 'ArrowLeft' && localImages.length > 1) {
        setCurrentIndex((prev) => (prev - 1 + localImages.length) % localImages.length);
        setZoom(1);
        setRotation(0);
        setConfirmDeleteIdx(null);
      }
      if (e.key === 'ArrowRight' && localImages.length > 1) {
        setCurrentIndex((prev) => (prev + 1) % localImages.length);
        setZoom(1);
        setRotation(0);
        setConfirmDeleteIdx(null);
      }
      if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)));
      }
      if (e.key === '-' || e.key === '_') {
        setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, localImages.length, onClose, confirmDeleteIdx]);

  if (!isOpen) return null;

  const isReceipt = !!receiptId;
  const isNote = !!noteId;
  const docTargetId = noteId || receiptId || saleId;
  const effectivePartnerLabel = partnerLabel || (isNote ? 'Ghi chú' : isReceipt ? 'Nhà cung cấp' : 'Khách hàng');
  const docLabel = isNote ? 'Ghi chú' : isReceipt ? 'Phiếu nhập' : 'Đơn bán hàng';
  const imageLabel = isNote ? 'ảnh ghi chú' : isReceipt ? 'ảnh nhập hàng' : 'ảnh giao hàng';

  const canModify = !readOnly && (!!saleId || !!receiptId || !!noteId || !!onImagesChange);
  const currentImage = localImages[currentIndex] || null;

  const goPrevImage = () => {
    if (localImages.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + localImages.length) % localImages.length);
    setZoom(1);
    setRotation(0);
    setConfirmDeleteIdx(null);
  };

  const goNextImage = () => {
    if (localImages.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % localImages.length);
    setZoom(1);
    setRotation(0);
    setConfirmDeleteIdx(null);
  };

  const persistImages = async (updated: string[], successText: string) => {
    setLocalImages(updated);
    onImagesChange?.(updated);
    if (noteId) {
      try {
        setIsUploading(true);
        setUploadStatus(null);
        await updateDoc(doc(db, 'notes', noteId), {
          images: updated,
          updatedAt: serverTimestamp()
        });
        setUploadStatus({ type: 'success', message: successText });
      } catch (err: any) {
        console.error('Lỗi cập nhật ảnh ghi chú:', err);
        setUploadStatus({
          type: 'error',
          message: 'Lưu ảnh thất bại: ' + (err.message || 'Lỗi kết nối cơ sở dữ liệu')
        });
      } finally {
        setIsUploading(false);
      }
    } else if (receiptId) {
      try {
        setIsUploading(true);
        setUploadStatus(null);
        await updateDoc(doc(db, 'goodsReceipts', receiptId), {
          receiptImages: updated,
          deliveryImages: updated,
          updatedAt: serverTimestamp()
        });
        setUploadStatus({ type: 'success', message: successText });
      } catch (err: any) {
        console.error('Lỗi cập nhật ảnh nhập hàng:', err);
        setUploadStatus({
          type: 'error',
          message: 'Lưu ảnh thất bại: ' + (err.message || 'Lỗi kết nối cơ sở dữ liệu')
        });
      } finally {
        setIsUploading(false);
      }
    } else if (saleId) {
      try {
        setIsUploading(true);
        setUploadStatus(null);
        await updateDoc(doc(db, 'sales', saleId), {
          deliveryImages: updated,
          updatedAt: serverTimestamp()
        });
        setUploadStatus({ type: 'success', message: successText });
      } catch (err: any) {
        console.error('Lỗi cập nhật ảnh giao hàng:', err);
        setUploadStatus({
          type: 'error',
          message: 'Lưu ảnh thất bại: ' + (err.message || 'Lỗi kết nối cơ sở dữ liệu')
        });
      } finally {
        setIsUploading(false);
      }
    } else {
      setUploadStatus({ type: 'success', message: successText });
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadStatus(null);
    setConfirmDeleteIdx(null);
    try {
      const batch = await compressMultipleImagesWithStats(files);
      if (batch.images.length > 0) {
        const updated = [...localImages, ...batch.images];
        setCurrentIndex(updated.length - batch.images.length);
        setZoom(1);
        setRotation(0);
        await persistImages(
          updated,
          `Tải ảnh thành công! ${batch.summaryText}. ${docLabel} hiện có ${updated.length} ${imageLabel} (Tổng: ~${getImagesTotalKB(updated)} KB).`
        );
      } else {
        setUploadStatus({
          type: 'error',
          message: 'Không đọc được ảnh đã chọn. Vui lòng thử chụp hoặc chọn lại ảnh khác.'
        });
      }
    } catch (err: any) {
      console.error(err);
      setUploadStatus({
        type: 'error',
        message: 'Tải ảnh thất bại: ' + (err.message || 'Định dạng ảnh không hỗ trợ')
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleOptimizeExistingInViewer = async () => {
    if (localImages.length === 0) return;
    setIsUploading(true);
    setUploadStatus(null);
    try {
      const result = await recompressExistingDataUrls(localImages, 'ultra_light');
      await persistImages(
        result.images,
        `${result.summaryText} (Tổng còn ~${getImagesTotalKB(result.images)} KB)`
      );
    } catch (err: any) {
      setUploadStatus({
        type: 'error',
        message: 'Không thể tối ưu lại ảnh: ' + (err.message || 'Vui lòng thử lại')
      });
    } finally {
      setIsUploading(false);
    }
  };

  const executeDeleteCurrent = async () => {
    if (!currentImage) return;
    const targetIdx = confirmDeleteIdx !== null ? confirmDeleteIdx : currentIndex;
    setConfirmDeleteIdx(null);
    const updated = localImages.filter((_, idx) => idx !== targetIdx);
    const nextIdx = Math.max(0, Math.min(targetIdx, updated.length - 1));
    setCurrentIndex(nextIdx);
    setZoom(1);
    setRotation(0);
    await persistImages(updated, `Đã xóa ${imageLabel} #${targetIdx + 1} thành công!`);
  };

  const handleDownload = () => {
    if (!currentImage) return;
    const link = document.createElement('a');
    link.href = currentImage;
    link.download = `anh-${isNote ? 'ghi-chu' : isReceipt ? 'nhap-hang' : 'ban-hang'}-${orderId || docTargetId?.substring(0, 8) || 'don'}-${currentIndex + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleWheelZoom = (e: React.WheelEvent) => {
    if (!currentImage) return;
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2)));
    } else if (e.deltaY > 0) {
      setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(2)));
    }
  };

  const viewerContent = (
    <div
      className="fixed inset-0 bg-black/95 z-[9999] flex flex-col animate-fade-in select-none"
      onClick={onClose}
    >
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFilesSelected}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesSelected}
        className="hidden"
      />

      {/* TOP BAR */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-3 bg-slate-900/95 border-b border-slate-800 text-white shrink-0 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
            <Camera size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-black text-xs sm:text-sm uppercase tracking-tight truncate">
                {isNote ? 'Trình xem ảnh ghi chú' : isReceipt ? 'Trình xem ảnh nhập hàng' : 'Trình xem ảnh bán hàng'}{' '}
                {orderId ? `#${orderId}` : docTargetId ? `#${docTargetId.substring(0, 8).toUpperCase()}` : ''}
              </h3>
              {localImages.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-black shrink-0 shadow-xs">
                  Ảnh {currentIndex + 1} / {localImages.length}
                </span>
              )}
              {currentImage && (
                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-emerald-500/40 text-emerald-300 text-[10px] font-black shrink-0">
                  ~{getDataUrlKB(currentImage)} KB (Tổng: {getImagesTotalKB(localImages)} KB)
                </span>
              )}
            </div>
            {customerName && (
              <p className="text-xs text-slate-400 font-bold truncate mt-0.5">
                {effectivePartnerLabel}: <span className="text-yellow-300">{customerName}</span>
              </p>
            )}
          </div>
        </div>

        {/* ACTION TOOLBAR */}
        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          {canModify && localImages.some((img) => getDataUrlKB(img) > 65) && (
            <button
              type="button"
              onClick={handleOptimizeExistingInViewer}
              disabled={isUploading}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
              title="Nén nhẹ lại các ảnh cũ của đơn này để giảm dung lượng trên Server"
            >
              <span>⚡ Nén nhẹ lại</span>
            </button>
          )}
          {canModify && (
            <>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isUploading}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
                title="Chụp thêm ảnh trực tiếp bằng Camera"
              >
                {isUploading ? <Loader size={14} className="animate-spin" /> : <Camera size={14} />}
                <span>Chụp ảnh</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
                title="Up thêm ảnh từ thư viện điện thoại / máy tính"
              >
                {isUploading ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
                <span>Up thêm ảnh</span>
              </button>
            </>
          )}

          {currentImage && (
            <>
              {localImages.length > 1 && (
                <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700">
                  <button
                    type="button"
                    onClick={goPrevImage}
                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                    title="Ảnh trước (Phím mũi tên trái)"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-2 text-[11px] font-black text-slate-300">
                    {currentIndex + 1}/{localImages.length}
                  </span>
                  <button
                    type="button"
                    onClick={goNextImage}
                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                    title="Ảnh tiếp theo (Phím mũi tên phải)"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                  title="Thu nhỏ (-)"
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                  }}
                  className="px-2 py-1 rounded-lg hover:bg-slate-700 text-slate-200 text-xs font-black transition cursor-pointer"
                  title="Đặt lại kích thước 100%"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                  title="Phóng to (+)"
                >
                  <ZoomIn size={16} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-black flex items-center gap-1 transition cursor-pointer"
                title="Xoay ảnh 90°"
              >
                <RotateCw size={15} />
                <span className="hidden md:inline">Xoay 90°</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-black flex items-center gap-1 transition cursor-pointer"
                title="Tải ảnh này về máy"
              >
                <Download size={15} />
                <span className="hidden md:inline">Tải về</span>
              </button>

              {canModify && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteIdx(currentIndex)}
                  disabled={isUploading}
                  className="px-2.5 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 text-xs font-black flex items-center gap-1 transition cursor-pointer"
                  title="Xóa ảnh đang xem"
                >
                  <Trash2 size={15} />
                  <span className="hidden md:inline">Xóa ảnh</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-700 font-black text-xs flex items-center gap-1 transition cursor-pointer ml-1"
            title="Đóng trình xem ảnh (Esc)"
          >
            <X size={18} />
            <span className="hidden sm:inline">Đóng</span>
          </button>
        </div>
      </div>

      {/* INLINE CONFIRMATION FOR DELETE IMAGE (Hoạt động ổn định 100% trên mọi thiết bị & iframe) */}
      {confirmDeleteIdx !== null && currentImage && (
        <div
          className="px-4 py-3 bg-red-950/95 border-b border-red-500/50 flex flex-wrap items-center justify-center gap-3 shrink-0 animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 text-white text-xs sm:text-sm font-black">
            <AlertCircle size={18} className="text-red-400 shrink-0" />
            <span>
              Bạn có chắc chắn muốn xóa {imageLabel} #{confirmDeleteIdx + 1} này không?
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={executeDeleteCurrent}
              disabled={isUploading}
              className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase shadow-md transition active:scale-95 cursor-pointer"
            >
              Xác nhận xóa
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteIdx(null)}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black uppercase border border-slate-600 transition cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* STATUS BANNER FOR UPLOAD FEEDBACK */}
      {(isUploading || uploadStatus) && (
        <div
          className="px-4 py-2.5 flex items-center justify-center shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {isUploading ? (
            <div className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black uppercase flex items-center gap-2 shadow-lg animate-pulse">
              <Loader size={16} className="animate-spin" />
              <span>Đang nén siêu nhẹ và tải ảnh lên... Vui lòng đợi giây lát!</span>
            </div>
          ) : uploadStatus?.type === 'success' ? (
            <div className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase flex items-center gap-2 shadow-lg animate-fade-in">
              <CheckCircle2 size={16} />
              <span>{uploadStatus.message}</span>
              <button
                type="button"
                onClick={() => setUploadStatus(null)}
                className="ml-2 text-white/80 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          ) : uploadStatus?.type === 'error' ? (
            <div className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black uppercase flex items-center gap-2 shadow-lg animate-fade-in">
              <AlertCircle size={16} />
              <span>{uploadStatus.message}</span>
              <button
                type="button"
                onClick={() => setUploadStatus(null)}
                className="ml-2 text-white/80 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* MAIN VIEWPORT */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-auto p-3 sm:p-6"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheelZoom}
      >
        {localImages.length === 0 ? (
          <div className="bg-slate-900 border-2 border-dashed border-slate-700 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 text-emerald-400 flex items-center justify-center mx-auto">
              <Camera size={32} />
            </div>
            <div>
              <h4 className="text-base font-black text-white uppercase">
                {docLabel} chưa có {imageLabel}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Bấm nút bên dưới để chụp ảnh trực tiếp bằng camera điện thoại hoặc chọn ảnh từ thư viện máy.
              </p>
            </div>
            {canModify && (
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-95"
                >
                  {isUploading ? <Loader size={16} className="animate-spin" /> : <Camera size={16} />}
                  <span>Chụp ảnh ngay</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-95"
                >
                  {isUploading ? <Loader size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                  <span>Chọn ảnh từ máy</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {localImages.length > 1 && (
              <button
                type="button"
                onClick={goPrevImage}
                className="absolute left-2 sm:left-6 z-20 p-3 sm:p-3.5 rounded-full bg-slate-900/85 hover:bg-emerald-600 text-white border border-slate-700 shadow-2xl transition cursor-pointer active:scale-95"
                title="Ảnh trước (Phím mũi tên trái)"
              >
                <ChevronLeft size={26} />
              </button>
            )}

            <div className="max-w-full max-h-full flex items-center justify-center overflow-auto">
              {currentImage && (
                <img
                  src={currentImage}
                  alt={`${imageLabel} ${currentIndex + 1}`}
                  onDoubleClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transition: 'transform 0.2s ease'
                  }}
                  className="max-h-[70vh] max-w-[90vw] object-contain rounded-lg shadow-2xl border border-slate-800 cursor-zoom-in"
                  title="Nhấp đúp hoặc lăn chuột để Phóng to / Thu nhỏ"
                />
              )}
            </div>

            {localImages.length > 1 && (
              <button
                type="button"
                onClick={goNextImage}
                className="absolute right-2 sm:right-6 z-20 p-3 sm:p-3.5 rounded-full bg-slate-900/85 hover:bg-emerald-600 text-white border border-slate-700 shadow-2xl transition cursor-pointer active:scale-95"
                title="Ảnh tiếp theo (Phím mũi tên phải)"
              >
                <ChevronRight size={26} />
              </button>
            )}

            {/* FLOATING QUICK ACTION BAR TRÊN MÀN HÌNH XEM ẢNH (Tiện thao tác trên cả Điện thoại & Máy tính) */}
            {currentImage && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-2xl backdrop-blur-xs">
                {localImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goPrevImage}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-white transition cursor-pointer"
                      title="Ảnh trước"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-[11px] font-black text-emerald-400 px-1">
                      {currentIndex + 1}/{localImages.length}
                    </span>
                    <button
                      type="button"
                      onClick={goNextImage}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-white transition cursor-pointer"
                      title="Ảnh tiếp"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <div className="w-px h-4 bg-slate-700 mx-0.5" />
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-white transition cursor-pointer"
                  title="Thu nhỏ"
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                  }}
                  className="px-2 py-0.5 rounded-lg hover:bg-slate-800 text-slate-200 text-[11px] font-black transition cursor-pointer"
                  title="100%"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-white transition cursor-pointer"
                  title="Phóng to"
                >
                  <ZoomIn size={16} />
                </button>

                <div className="w-px h-4 bg-slate-700 mx-0.5" />

                <button
                  type="button"
                  onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-white transition cursor-pointer"
                  title="Xoay ngược 90°"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-white transition cursor-pointer"
                  title="Xoay 90°"
                >
                  <RotateCw size={16} />
                </button>

                <div className="w-px h-4 bg-slate-700 mx-0.5" />

                <button
                  type="button"
                  onClick={handleDownload}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-emerald-400 transition cursor-pointer"
                  title="Tải ảnh về máy"
                >
                  <Download size={16} />
                </button>

                {canModify && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteIdx(currentIndex)}
                    disabled={isUploading}
                    className="p-1.5 rounded-lg hover:bg-red-600/30 text-red-400 transition cursor-pointer"
                    title="Xóa ảnh đang xem"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* THUMBNAIL STRIP */}
      {localImages.length > 0 && (
        <div
          className="px-4 py-3 bg-slate-900/95 border-t border-slate-800 flex items-center justify-center gap-2 overflow-x-auto shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {localImages.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setCurrentIndex(idx);
                setZoom(1);
                setRotation(0);
                setConfirmDeleteIdx(null);
              }}
              className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition shrink-0 cursor-pointer ${
                idx === currentIndex
                  ? 'border-emerald-400 ring-2 ring-emerald-500/40 scale-105'
                  : 'border-slate-700 opacity-60 hover:opacity-100'
              }`}
              title={`Xem ảnh #${idx + 1} (~${getDataUrlKB(img)} KB)`}
            >
              <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
              <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/75 text-white text-[9px] font-black">
                #{idx + 1}
              </span>
            </button>
          ))}

          {canModify && (
            <>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isUploading}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-dashed border-emerald-600/70 hover:border-emerald-400 text-emerald-400 hover:bg-emerald-950/40 flex flex-col items-center justify-center gap-0.5 shrink-0 transition cursor-pointer"
                title="Chụp thêm ảnh bằng Camera"
              >
                {isUploading ? <Loader size={16} className="animate-spin" /> : <Camera size={17} />}
                <span className="text-[9px] font-black uppercase">Chụp</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-dashed border-blue-500/70 hover:border-blue-400 text-blue-400 hover:bg-blue-950/40 flex flex-col items-center justify-center gap-0.5 shrink-0 transition cursor-pointer"
                title="Up thêm ảnh từ máy"
              >
                {isUploading ? <Loader size={16} className="animate-spin" /> : <Plus size={18} />}
                <span className="text-[9px] font-black uppercase">Thêm</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(viewerContent, document.body)
    : viewerContent;
};

interface DeliveryImageUploadSectionProps {
  images: string[];
  onChange: (newImages: string[]) => void;
  title?: string;
  compact?: boolean;
  orderId?: string;
  customerName?: string;
  saleId?: string; // Nếu có saleId (khi đang sửa đơn bán đã tồn tại), tự động lưu ngay vào Firestore khi chọn ảnh!
  receiptId?: string; // Nếu có receiptId (khi đang sửa phiếu nhập đã tồn tại), tự động lưu ngay vào Firestore khi chọn ảnh!
  noteId?: string; // Nếu có noteId (khi đang sửa ghi chú đã tồn tại), tự động lưu ngay vào Firestore khi chọn ảnh!
  partnerLabel?: string;
}

export const DeliveryImageUploadSection: React.FC<DeliveryImageUploadSectionProps> = ({
  images,
  onChange,
  title = 'Ảnh chụp giao hàng',
  compact = false,
  orderId,
  customerName,
  saleId,
  receiptId,
  noteId,
  partnerLabel
}) => {
  const [isCompressing, setIsCompressing] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const syncToFirestoreIfNeeded = async (updatedImages: string[], actionText: string) => {
    onChange(updatedImages);
    if (noteId) {
      try {
        await updateDoc(doc(db, 'notes', noteId), {
          images: updatedImages,
          updatedAt: serverTimestamp()
        });
        setFeedback({
          type: 'success',
          message: `${actionText} Đã lưu trực tiếp vào ghi chú "${customerName || `#${noteId.substring(0, 6).toUpperCase()}`}" (Hiện có ${updatedImages.length} ảnh).`
        });
      } catch (err: any) {
        console.error('Lỗi tự động lưu ảnh vào ghi chú:', err);
        setFeedback({
          type: 'error',
          message: `Lỗi lưu ảnh vào cơ sở dữ liệu: ${err.message || 'Vui lòng bấm Lưu Ghi Chú'}`
        });
      }
    } else if (receiptId) {
      try {
        await updateDoc(doc(db, 'goodsReceipts', receiptId), {
          receiptImages: updatedImages,
          deliveryImages: updatedImages,
          updatedAt: serverTimestamp()
        });
        setFeedback({
          type: 'success',
          message: `${actionText} Đã lưu trực tiếp vào phiếu nhập #${orderId || receiptId.substring(0, 8).toUpperCase()} (Hiện có ${updatedImages.length} ảnh).`
        });
      } catch (err: any) {
        console.error('Lỗi tự động lưu ảnh vào phiếu nhập:', err);
        setFeedback({
          type: 'error',
          message: `Lỗi lưu ảnh vào cơ sở dữ liệu: ${err.message || 'Vui lòng bấm Lưu Thay Đổi'}`
        });
      }
    } else if (saleId) {
      try {
        await updateDoc(doc(db, 'sales', saleId), {
          deliveryImages: updatedImages,
          updatedAt: serverTimestamp()
        });
        setFeedback({
          type: 'success',
          message: `${actionText} Đã lưu trực tiếp vào đơn hàng #${orderId || saleId.substring(0, 8).toUpperCase()} (Hiện có ${updatedImages.length} ảnh).`
        });
      } catch (err: any) {
        console.error('Lỗi tự động lưu ảnh vào đơn:', err);
        setFeedback({
          type: 'error',
          message: `Lỗi lưu ảnh vào cơ sở dữ liệu: ${err.message || 'Vui lòng bấm Xác nhận lưu đơn'}`
        });
      }
    } else {
      setFeedback({
        type: 'success',
        message: `${actionText} Đã đính kèm ${updatedImages.length} ảnh (Ảnh sẽ được lưu khi bạn bấm Hoàn tất / Lưu phiếu mới).`
      });
    }
  };

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setIsCompressing(true);
    setFeedback(null);
    try {
      const batch = await compressMultipleImagesWithStats(files);
      if (batch.images.length > 0) {
        const updated = [...images, ...batch.images];
        await syncToFirestoreIfNeeded(
          updated,
          `Tải lên thành công +${batch.images.length} ảnh (${batch.summaryText})!`
        );
      } else {
        setFeedback({
          type: 'error',
          message: 'Tải ảnh thất bại: Không thể xử lý ảnh đã chọn. Vui lòng thử lại!'
        });
      }
    } catch (err: any) {
      console.error('Lỗi nén ảnh:', err);
      setFeedback({
        type: 'error',
        message: 'Tải ảnh thất bại: ' + (err.message || 'Định dạng ảnh không được hỗ trợ.')
      });
    } finally {
      setIsCompressing(false);
    }
  };

  const handleOptimizeExistingSection = async () => {
    if (images.length === 0) return;
    setIsCompressing(true);
    setFeedback(null);
    try {
      const res = await recompressExistingDataUrls(images, 'ultra_light');
      await syncToFirestoreIfNeeded(res.images, `${res.summaryText}!`);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Không thể tối ưu ảnh: ' + (err.message || 'Vui lòng thử lại')
      });
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemoveImage = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = images.filter((_, idx) => idx !== index);
    await syncToFirestoreIfNeeded(updated, `Đã xóa ảnh #${index + 1}.`);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      await handleFiles(imageFiles);
    }
  };

  return (
    <div
      onPaste={handlePaste}
      className={`rounded-xl border-2 transition-all ${
        images.length > 0
          ? 'bg-emerald-50/60 border-emerald-400 shadow-xs'
          : 'bg-slate-50/90 border-dashed border-slate-300 hover:border-blue-400'
      } ${compact ? 'p-2.5' : 'p-3.5'}`}
    >
      <DeliveryImageViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={images}
        initialIndex={viewerIndex}
        orderId={orderId}
        customerName={customerName}
        saleId={saleId}
        receiptId={receiptId}
        noteId={noteId}
        partnerLabel={partnerLabel}
        onImagesChange={onChange}
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-lg ${
              images.length > 0 ? 'bg-emerald-600 text-white' : 'bg-blue-100 text-blue-700'
            }`}
          >
            <Camera size={compact ? 14 : 16} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`font-black uppercase text-slate-800 ${compact ? 'text-[11px]' : 'text-xs'}`}>
                {title}
              </span>
              {images.length > 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center gap-1">
                  <CheckCircle2 size={11} />
                  Đã có {images.length} ảnh (~{getImagesTotalKB(images)} KB)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold">
                  Tự động nén siêu nhẹ (~30KB/ảnh)
                </span>
              )}
            </div>
            {!compact && (
              <p className="text-[10px] text-slate-500 font-semibold">
                Ảnh chụp từ điện thoại (3MB-8MB) được tự động nén WebP/JPEG siêu nhẹ (~25-45KB) trước khi gửi lên Server
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {images.some((img) => getDataUrlKB(img) > 65) && (
            <button
              type="button"
              onClick={handleOptimizeExistingSection}
              disabled={isCompressing}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] uppercase flex items-center gap-1 transition cursor-pointer shadow-xs"
              title="Nén nhẹ lại các ảnh cũ đang nặng >65KB xuống ~30KB"
            >
              <span>⚡ Giảm nhẹ ảnh</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setViewerIndex(0);
              setViewerOpen(true);
            }}
            className={`px-3 py-1.5 rounded-lg font-black text-[11px] uppercase flex items-center gap-1 transition cursor-pointer shadow-sm active:scale-95 ${
              images.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
            title="Mở trình xem & quản lý ảnh toàn màn hình"
          >
            <Maximize2 size={13} />
            <span>{images.length > 0 ? `Xem toàn màn hình (${images.length})` : 'Trình xem ảnh'}</span>
          </button>

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isCompressing}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-black text-[11px] uppercase flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs"
            title="Mở Camera chụp ảnh"
          >
            {isCompressing ? <Loader size={13} className="animate-spin" /> : <Camera size={13} />}
            <span>Chụp ảnh</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCompressing}
            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] uppercase flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs"
            title="Chọn 1 hoặc nhiều ảnh từ thiết bị"
          >
            {isCompressing ? <Loader size={13} className="animate-spin" /> : <ImageIcon size={13} />}
            <span>Tải ảnh</span>
          </button>
        </div>
      </div>

      {/* THÔNG BÁO TRẠNG THÁI RÕ RÀNG KHI ĐANG TẢI HOẶC SAU KHI TẢI XONG */}
      {isCompressing && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center gap-2 animate-pulse shadow-sm">
          <Loader size={16} className="animate-spin shrink-0" />
          <span>Đang xử lý và tải ảnh lên... Vui lòng chờ giây lát!</span>
        </div>
      )}

      {!isCompressing && feedback && (
        <div
          className={`mt-2.5 p-2.5 rounded-xl text-xs font-black flex items-start justify-between gap-2 animate-fade-in border ${
            feedback.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
              : 'bg-red-600 text-white border-red-700 shadow-sm'
          }`}
        >
          <div className="flex items-start gap-1.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-white/80 hover:text-white p-0.5 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Danh sách ảnh đã chọn / tải lên */}
      {images.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-emerald-200 flex items-center gap-2 overflow-x-auto pb-1">
          {images.map((imgUrl, idx) => (
            <div
              key={idx}
              onClick={() => {
                setViewerIndex(idx);
                setViewerOpen(true);
              }}
              className="relative group w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-xs shrink-0 cursor-pointer bg-white"
              title="Bấm để mở trình xem ảnh toàn màn hình"
            >
              <img
                src={imgUrl}
                alt={`Ảnh ${idx + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                <Eye
                  size={18}
                  className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
                />
              </div>
              <span className="absolute bottom-0.5 left-1 px-1 rounded bg-black/75 text-white text-[8px] font-black">
                #{idx + 1} · {getDataUrlKB(imgUrl)}KB
              </span>
              <button
                type="button"
                onClick={(e) => handleRemoveImage(idx, e)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md cursor-pointer"
                title="Xóa ảnh này"
              >
                <X size={12} strokeWidth={3} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCompressing}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 border-dashed border-emerald-500 hover:border-emerald-700 bg-white/80 hover:bg-white text-emerald-700 flex flex-col items-center justify-center gap-1 shrink-0 transition cursor-pointer"
            title="Thêm ảnh"
          >
            {isCompressing ? <Loader size={16} className="animate-spin" /> : <Plus size={18} />}
            <span className="text-[9px] font-black uppercase">Thêm ảnh</span>
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Thanh Quản lý & Xem ảnh giao hàng hiển thị TRỰC TIẾP trên từng Thẻ Đơn Hàng
 * (trong "Đơn hàng hôm nay" và "Lịch sử bán hàng").
 * Đồng bộ giao diện và tính năng Xem Toàn Màn Hình giống hệt phần Ghi Chú Hệ Thống!
 */
export const OrderCardDeliveryImageBar: React.FC<{
  sale: Sale;
  onOpenViewer: (initialIdx: number) => void;
}> = ({ sale, onOpenViewer }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const images = sale.deliveryImages || [];

  const handleUploadForOrder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setStatusBanner(null);
    try {
      const batch = await compressMultipleImagesWithStats(files);
      if (batch.images.length > 0) {
        const updated = [...images, ...batch.images];
        await updateDoc(doc(db, 'sales', sale.id), {
          deliveryImages: updated,
          updatedAt: serverTimestamp()
        });
        setStatusBanner({
          type: 'success',
          text: `Đã lưu +${batch.images.length} ảnh (${batch.summaryText})!`
        });
        setTimeout(() => setStatusBanner(null), 6000);
      } else {
        setStatusBanner({
          type: 'error',
          text: 'Không đọc được file ảnh. Vui lòng thử lại!'
        });
      }
    } catch (err: any) {
      console.error('Lỗi tải ảnh cho đơn:', err);
      setStatusBanner({
        type: 'error',
        text: 'Lỗi tải ảnh: ' + (err.message || 'Vui lòng thử lại')
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div
      className="pt-2 mt-1.5 border-t border-dashed border-slate-200 space-y-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleUploadForOrder}
        className="hidden"
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleUploadForOrder}
        className="hidden"
      />

      {/* Trạng thái đang tải lên */}
      {isUploading && (
        <div className="p-2 rounded-lg bg-blue-600 text-white text-[11px] font-black flex items-center justify-center gap-2 animate-pulse shadow-xs">
          <Loader size={14} className="animate-spin shrink-0" />
          <span>Đang nén siêu nhẹ & tải ảnh lên đơn #{sale.id.substring(0, 6).toUpperCase()}...</span>
        </div>
      )}

      {/* Thông báo Thành công / Thất bại rõ ràng */}
      {!isUploading && statusBanner && (
        <div
          className={`p-2 rounded-lg text-[11px] font-black flex items-center justify-between gap-1.5 animate-fade-in ${
            statusBanner.type === 'success'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-red-600 text-white shadow-xs'
          }`}
        >
          <div className="flex items-center gap-1.5">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 size={14} className="shrink-0" />
            ) : (
              <AlertCircle size={14} className="shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-white/80 hover:text-white p-0.5 cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Giao diện khi ĐÃ CÓ ẢNH vs CHƯA CÓ ẢNH (Đồng bộ với phần Ghi chú) */}
      {images.length > 0 ? (
        <div className="p-2 rounded-xl bg-emerald-50/90 border border-emerald-300 space-y-2">
          {/* Dải ảnh thu nhỏ - Bấm vào ảnh bất kỳ để mở Trình Xem Ảnh Toàn Màn Hình */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {images.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onOpenViewer(idx)}
                className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-emerald-500 shrink-0 hover:scale-105 transition cursor-pointer shadow-2xs bg-white group/thumb"
                title={`Bấm để xem toàn màn hình ảnh giao hàng #${idx + 1}`}
              >
                <img src={imgUrl} alt={`Ảnh giao ${idx + 1}`} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 right-0 px-1 bg-black/70 text-white text-[8px] font-black">
                  {getDataUrlKB(imgUrl)}KB
                </span>
              </button>
            ))}
          </div>

          {/* Nút Xem ảnh toàn màn hình & Thêm ảnh */}
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => onOpenViewer(0)}
              className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase flex items-center justify-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
              title="Mở Trình Xem Ảnh Toàn Màn Hình (Phóng to, Xoay, Tải về, Xóa, Up thêm)"
            >
              <Eye size={13} />
              <span>Xem ảnh ({images.length}) · {getImagesTotalKB(images)}KB</span>
            </button>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={isUploading}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-emerald-300 transition cursor-pointer"
              title="Chụp thêm ảnh giao hàng"
            >
              <Camera size={14} />
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-blue-600 border border-emerald-300 transition cursor-pointer"
              title="Tải thêm ảnh từ máy"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
            <Camera size={12} className="text-slate-400" />
            <span>Chưa có ảnh giao hàng</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={isUploading}
              className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-2xs"
              title="Mở camera chụp ảnh giao hàng cho đơn này"
            >
              <Camera size={11} />
              <span>Chụp ảnh</span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-2xs"
              title="Chọn ảnh giao hàng từ điện thoại / máy tính cho đơn này"
            >
              <ImageIcon size={11} />
              <span>Up ảnh</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Thanh Quản lý & Xem ảnh nhập hàng hiển thị TRỰC TIẾP trên từng Thẻ Phiếu Nhập
 * (trong "Đơn nhập hôm nay" và "Lịch sử nhập hàng").
 * Đồng bộ giao diện và tính năng Xem Toàn Màn Hình giống hệt phần Ghi Chú Hệ Thống!
 */
export const ReceiptCardDeliveryImageBar: React.FC<{
  receipt: GoodsReceipt;
  onOpenViewer: (initialIdx: number) => void;
}> = ({ receipt, onOpenViewer }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const images = receipt.receiptImages || receipt.deliveryImages || [];

  const handleUploadForReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setStatusBanner(null);
    try {
      const batch = await compressMultipleImagesWithStats(files);
      if (batch.images.length > 0) {
        const updated = [...images, ...batch.images];
        await updateDoc(doc(db, 'goodsReceipts', receipt.id), {
          receiptImages: updated,
          deliveryImages: updated,
          updatedAt: serverTimestamp()
        });
        setStatusBanner({
          type: 'success',
          text: `Đã lưu +${batch.images.length} ảnh (${batch.summaryText})!`
        });
        setTimeout(() => setStatusBanner(null), 6000);
      } else {
        setStatusBanner({
          type: 'error',
          text: 'Không đọc được file ảnh. Vui lòng thử lại!'
        });
      }
    } catch (err: any) {
      console.error('Lỗi tải ảnh cho phiếu nhập:', err);
      setStatusBanner({
        type: 'error',
        text: 'Lỗi tải ảnh: ' + (err.message || 'Vui lòng thử lại')
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div
      className="pt-2 mt-1.5 border-t border-dashed border-slate-200 space-y-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleUploadForReceipt}
        className="hidden"
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleUploadForReceipt}
        className="hidden"
      />

      {/* Trạng thái đang tải lên */}
      {isUploading && (
        <div className="p-2 rounded-lg bg-blue-600 text-white text-[11px] font-black flex items-center justify-center gap-2 animate-pulse shadow-xs">
          <Loader size={14} className="animate-spin shrink-0" />
          <span>Đang nén siêu nhẹ & tải ảnh lên phiếu #{receipt.id.substring(0, 6).toUpperCase()}...</span>
        </div>
      )}

      {/* Thông báo Thành công / Thất bại rõ ràng */}
      {!isUploading && statusBanner && (
        <div
          className={`p-2 rounded-lg text-[11px] font-black flex items-center justify-between gap-1.5 animate-fade-in ${
            statusBanner.type === 'success'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-red-600 text-white shadow-xs'
          }`}
        >
          <div className="flex items-center gap-1.5">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 size={14} className="shrink-0" />
            ) : (
              <AlertCircle size={14} className="shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-white/80 hover:text-white p-0.5 cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Giao diện khi ĐÃ CÓ ẢNH vs CHƯA CÓ ẢNH (Đồng bộ với phần Ghi chú) */}
      {images.length > 0 ? (
        <div className="p-2 rounded-xl bg-emerald-50/90 border border-emerald-300 space-y-2">
          {/* Dải ảnh thu nhỏ - Bấm vào ảnh bất kỳ để mở Trình Xem Ảnh Toàn Màn Hình */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {images.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onOpenViewer(idx)}
                className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-emerald-500 shrink-0 hover:scale-105 transition cursor-pointer shadow-2xs bg-white group/thumb"
                title={`Bấm để xem toàn màn hình ảnh nhập hàng #${idx + 1}`}
              >
                <img src={imgUrl} alt={`Ảnh nhập ${idx + 1}`} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 right-0 px-1 bg-black/70 text-white text-[8px] font-black">
                  {getDataUrlKB(imgUrl)}KB
                </span>
              </button>
            ))}
          </div>

          {/* Nút Xem ảnh toàn màn hình & Thêm ảnh */}
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => onOpenViewer(0)}
              className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase flex items-center justify-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
              title="Mở Trình Xem Ảnh Toàn Màn Hình (Phóng to, Xoay, Tải về, Xóa, Up thêm)"
            >
              <Eye size={13} />
              <span>Xem ảnh ({images.length}) · {getImagesTotalKB(images)}KB</span>
            </button>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={isUploading}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-emerald-300 transition cursor-pointer"
              title="Chụp thêm ảnh nhập hàng"
            >
              <Camera size={14} />
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-blue-600 border border-emerald-300 transition cursor-pointer"
              title="Tải thêm ảnh từ máy"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
            <Camera size={12} className="text-slate-400" />
            <span>Chưa có ảnh nhập hàng</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={isUploading}
              className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-2xs"
              title="Mở camera chụp ảnh nhập hàng cho phiếu này"
            >
              <Camera size={11} />
              <span>Chụp ảnh</span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-2xs"
              title="Chọn ảnh nhập hàng từ điện thoại / máy tính cho phiếu này"
            >
              <ImageIcon size={11} />
              <span>Up ảnh</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
