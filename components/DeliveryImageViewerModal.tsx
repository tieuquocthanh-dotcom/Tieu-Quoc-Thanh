import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Image as ImageIcon,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader,
  Eye,
  UploadCloud,
  CheckCircle2
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { compressMultipleImages } from '../utils/imageCompression';

interface DeliveryImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  orderId?: string;
  customerName?: string;
  saleId?: string; // Nếu truyền saleId, cho phép chụp/tải thêm hoặc xóa ảnh trực tiếp vào đơn hàng trên Firestore
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
  onImagesChange,
  readOnly = false
}) => {
  const [localImages, setLocalImages] = useState<string[]>(propImages || []);
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalImages(propImages || []);
      const validIdx = Math.min(Math.max(0, initialIndex), Math.max(0, (propImages?.length || 1) - 1));
      setCurrentIndex(validIdx);
      setZoom(1);
      setRotation(0);
      setStatusMessage(null);
    }
  }, [isOpen, propImages, initialIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && localImages.length > 1) {
        setCurrentIndex((prev) => (prev - 1 + localImages.length) % localImages.length);
        setZoom(1);
        setRotation(0);
      }
      if (e.key === 'ArrowRight' && localImages.length > 1) {
        setCurrentIndex((prev) => (prev + 1) % localImages.length);
        setZoom(1);
        setRotation(0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, localImages.length, onClose]);

  if (!isOpen) return null;

  const canModify = !readOnly && (!!saleId || !!onImagesChange);
  const currentImage = localImages[currentIndex] || null;

  const persistImages = async (updated: string[], successText: string) => {
    setLocalImages(updated);
    onImagesChange?.(updated);
    if (saleId) {
      try {
        setIsUploading(true);
        await updateDoc(doc(db, 'sales', saleId), {
          deliveryImages: updated,
          updatedAt: serverTimestamp()
        });
        setStatusMessage(successText);
        setTimeout(() => setStatusMessage(null), 2500);
      } catch (err: any) {
        console.error('Lỗi cập nhật ảnh giao hàng:', err);
        alert('Không thể lưu ảnh vào đơn hàng: ' + (err.message || err));
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const compressed = await compressMultipleImages(files);
      if (compressed.length > 0) {
        const updated = [...localImages, ...compressed];
        setCurrentIndex(updated.length - compressed.length);
        setZoom(1);
        setRotation(0);
        await persistImages(updated, `Đã tải lên +${compressed.length} ảnh giao hàng!`);
      }
    } catch (err: any) {
      console.error(err);
      alert('Lỗi xử lý ảnh: ' + (err.message || err));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteCurrent = async () => {
    if (!currentImage) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa ảnh giao hàng này?')) return;
    const updated = localImages.filter((_, idx) => idx !== currentIndex);
    const nextIdx = Math.max(0, Math.min(currentIndex, updated.length - 1));
    setCurrentIndex(nextIdx);
    setZoom(1);
    setRotation(0);
    await persistImages(updated, 'Đã xóa ảnh giao hàng!');
  };

  const handleDownload = () => {
    if (!currentImage) return;
    const link = document.createElement('a');
    link.href = currentImage;
    link.download = `anh-giao-hang-${orderId || saleId?.substring(0, 8) || 'don-hang'}-${currentIndex + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[350] flex flex-col animate-fade-in select-none"
      onClick={onClose}
    >
      {/* Hidden inputs for Camera & File Picker */}
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
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-900/95 border-b border-slate-800 text-white shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
            <Camera size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm uppercase tracking-tight truncate">
                Ảnh giao hàng {orderId ? `#${orderId}` : saleId ? `#${saleId.substring(0, 8).toUpperCase()}` : ''}
              </h3>
              {localImages.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-black shrink-0">
                  {currentIndex + 1} / {localImages.length}
                </span>
              )}
            </div>
            {customerName && (
              <p className="text-xs text-slate-400 font-bold truncate">
                Khách hàng: <span className="text-yellow-300">{customerName}</span>
              </p>
            )}
          </div>
        </div>

        {statusMessage && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/90 text-white text-xs font-black animate-fade-in">
            <CheckCircle2 size={14} />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* ACTION TOOLBAR */}
        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          {canModify && (
            <>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isUploading}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
                title="Chụp ảnh giao hàng trực tiếp bằng Camera"
              >
                {isUploading ? <Loader size={14} className="animate-spin" /> : <Camera size={14} />}
                <span>Chụp ảnh</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
                title="Chọn ảnh giao hàng từ thiết bị"
              >
                {isUploading ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
                <span>Thêm ảnh</span>
              </button>
            </>
          )}

          {currentImage && (
            <>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                title="Thu nhỏ"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black transition cursor-pointer"
                title="Đặt lại kích thước 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                title="Phóng to"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                title="Xoay ảnh 90°"
              >
                <RotateCw size={16} />
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                title="Tải ảnh này về máy"
              >
                <Download size={16} />
              </button>
              {canModify && (
                <button
                  type="button"
                  onClick={handleDeleteCurrent}
                  disabled={isUploading}
                  className="p-2 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 transition cursor-pointer"
                  title="Xóa ảnh này"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white transition cursor-pointer ml-1"
            title="Đóng (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* MAIN VIEWPORT */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {localImages.length === 0 ? (
          <div className="bg-slate-900 border-2 border-dashed border-slate-700 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Camera size={32} />
            </div>
            <div>
              <h4 className="text-base font-black text-white uppercase">
                Đơn hàng chưa có ảnh giao hàng
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Chụp ảnh lúc giao hàng hoặc tải ảnh kiện hàng / biên nhận lên để lưu trữ đối chiếu.
              </p>
            </div>
            {canModify && (
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                >
                  {isUploading ? <Loader size={16} className="animate-spin" /> : <Camera size={16} />}
                  <span>Chụp ảnh giao hàng</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
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
                onClick={() => {
                  setCurrentIndex((prev) => (prev - 1 + localImages.length) % localImages.length);
                  setZoom(1);
                  setRotation(0);
                }}
                className="absolute left-3 sm:left-6 z-20 p-3 rounded-full bg-slate-900/80 hover:bg-primary text-white border border-slate-700 shadow-xl transition cursor-pointer active:scale-95"
                title="Ảnh trước"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <div className="max-w-full max-h-full flex items-center justify-center overflow-auto">
              {currentImage && (
                <img
                  src={currentImage}
                  alt={`Ảnh giao hàng ${currentIndex + 1}`}
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transition: 'transform 0.2s ease'
                  }}
                  className="max-h-[75vh] max-w-[90vw] object-contain rounded-lg shadow-2xl border border-slate-800"
                />
              )}
            </div>

            {localImages.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setCurrentIndex((prev) => (prev + 1) % localImages.length);
                  setZoom(1);
                  setRotation(0);
                }}
                className="absolute right-3 sm:right-6 z-20 p-3 rounded-full bg-slate-900/80 hover:bg-primary text-white border border-slate-700 shadow-xl transition cursor-pointer active:scale-95"
                title="Ảnh tiếp theo"
              >
                <ChevronRight size={24} />
              </button>
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
              }}
              className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition shrink-0 cursor-pointer ${
                idx === currentIndex
                  ? 'border-emerald-400 ring-2 ring-emerald-500/40 scale-105'
                  : 'border-slate-700 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
              <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/70 text-white text-[9px] font-black">
                {idx + 1}
              </span>
            </button>
          ))}

          {canModify && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-dashed border-slate-600 hover:border-emerald-400 text-slate-400 hover:text-emerald-400 flex flex-col items-center justify-center gap-0.5 shrink-0 transition cursor-pointer"
              title="Thêm ảnh giao hàng"
            >
              {isUploading ? <Loader size={16} className="animate-spin" /> : <Plus size={18} />}
              <span className="text-[9px] font-black uppercase">Thêm</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface DeliveryImageUploadSectionProps {
  images: string[];
  onChange: (newImages: string[]) => void;
  title?: string;
  compact?: boolean;
  orderId?: string;
  customerName?: string;
}

export const DeliveryImageUploadSection: React.FC<DeliveryImageUploadSectionProps> = ({
  images,
  onChange,
  title = 'Ảnh chụp giao hàng',
  compact = false,
  orderId,
  customerName
}) => {
  const [isCompressing, setIsCompressing] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setIsCompressing(true);
    try {
      const compressed = await compressMultipleImages(files);
      if (compressed.length > 0) {
        onChange([...images, ...compressed]);
      }
    } catch (err: any) {
      console.error('Lỗi nén ảnh:', err);
      alert('Không thể xử lý ảnh: ' + (err.message || err));
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemoveImage = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(images.filter((_, idx) => idx !== index));
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
          ? 'bg-emerald-50/40 border-emerald-300'
          : 'bg-slate-50/80 border-dashed border-slate-300 hover:border-blue-400'
      } ${compact ? 'p-2.5' : 'p-3.5'}`}
    >
      <DeliveryImageViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={images}
        initialIndex={viewerIndex}
        orderId={orderId}
        customerName={customerName}
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
            <div className="flex items-center gap-1.5">
              <span className={`font-black uppercase text-slate-800 ${compact ? 'text-[11px]' : 'text-xs'}`}>
                {title}
              </span>
              {images.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                  {images.length} ảnh
                </span>
              )}
            </div>
            {!compact && (
              <p className="text-[10px] text-slate-500 font-semibold">
                Chụp ảnh trực tiếp khi giao hàng, chọn ảnh từ máy hoặc dán ảnh (Ctrl+V)
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {images.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setViewerIndex(0);
                setViewerOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 font-black text-[11px] uppercase flex items-center gap-1 transition cursor-pointer shadow-2xs"
              title="Xem phóng to tất cả ảnh giao hàng"
            >
              <Eye size={13} />
              <span>Xem ảnh ({images.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isCompressing}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs"
            title="Mở Camera chụp ảnh giao hàng"
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

      {/* Danh sách ảnh đã chọn / tải lên */}
      {images.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-emerald-200/80 flex items-center gap-2 overflow-x-auto pb-1">
          {images.map((imgUrl, idx) => (
            <div
              key={idx}
              onClick={() => {
                setViewerIndex(idx);
                setViewerOpen(true);
              }}
              className="relative group w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 border-emerald-400 shadow-xs shrink-0 cursor-pointer bg-white"
              title="Bấm để xem ảnh phóng to"
            >
              <img
                src={imgUrl}
                alt={`Ảnh giao hàng ${idx + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                <Eye
                  size={18}
                  className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
                />
              </div>
              <span className="absolute bottom-0.5 left-1 px-1 rounded bg-black/65 text-white text-[9px] font-black">
                #{idx + 1}
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
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 border-dashed border-emerald-400 hover:border-emerald-600 bg-white/70 hover:bg-white text-emerald-700 flex flex-col items-center justify-center gap-1 shrink-0 transition cursor-pointer"
            title="Thêm ảnh giao hàng"
          >
            {isCompressing ? <Loader size={16} className="animate-spin" /> : <Plus size={18} />}
            <span className="text-[9px] font-black uppercase">Thêm ảnh</span>
          </button>
        </div>
      )}
    </div>
  );
};
