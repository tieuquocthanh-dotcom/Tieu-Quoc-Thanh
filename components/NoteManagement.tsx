import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  PlusCircle,
  Edit,
  Trash2,
  StickyNote,
  Search,
  Pin,
  X,
  Camera,
  Image as ImageIcon,
  Eye,
  Plus,
  Loader,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import Pagination from './Pagination';
import ConfirmationModal from './ConfirmationModal';
import {
  DeliveryImageViewerModal,
  DeliveryImageUploadSection,
} from './DeliveryImageViewerModal';
import {
  compressMultipleImagesWithStats,
  getDataUrlKB,
  getImagesTotalKB,
} from '../utils/imageCompression';
import { User } from 'firebase/auth';

interface SystemNote {
  id: string;
  title: string;
  content: string;
  images?: string[];
  authorEmail: string;
  createdAt: any;
  updatedAt: any;
  isPinned: boolean;
}

const NoteCardImageBar: React.FC<{
  note: SystemNote;
  onOpenViewer: (initialIdx: number) => void;
}> = ({ note, onOpenViewer }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const images = note.images || [];

  const handleUploadForNote = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setStatusBanner(null);
    try {
      const batch = await compressMultipleImagesWithStats(files);
      if (batch.images.length > 0) {
        const updated = [...images, ...batch.images];
        await updateDoc(doc(db, 'notes', note.id), {
          images: updated,
          updatedAt: serverTimestamp(),
        });
        setStatusBanner({
          type: 'success',
          text: `Đã lưu +${batch.images.length} ảnh (${batch.summaryText})!`,
        });
        setTimeout(() => setStatusBanner(null), 5000);
      } else {
        setStatusBanner({
          type: 'error',
          text: 'Không đọc được file ảnh. Vui lòng thử lại!',
        });
      }
    } catch (err: any) {
      console.error('Lỗi tải ảnh cho ghi chú:', err);
      setStatusBanner({
        type: 'error',
        text: 'Lỗi tải ảnh: ' + (err.message || 'Vui lòng thử lại'),
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="mt-3 pt-2.5 border-t border-dashed border-slate-200 space-y-2">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleUploadForNote}
        className="hidden"
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleUploadForNote}
        className="hidden"
      />

      {isUploading && (
        <div className="p-2 rounded-lg bg-blue-600 text-white text-[11px] font-black flex items-center justify-center gap-2 animate-pulse shadow-xs">
          <Loader size={14} className="animate-spin shrink-0" />
          <span>Đang nén siêu nhẹ & tải ảnh lên ghi chú...</span>
        </div>
      )}

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
              <CheckCircle2 size={13} className="shrink-0" />
            ) : (
              <AlertCircle size={13} className="shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-white/80 hover:text-white p-0.5 cursor-pointer"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {images.length > 0 ? (
        <div className="p-2 rounded-xl bg-emerald-50/90 border border-emerald-300 space-y-2">
          {/* Dải ảnh thu nhỏ */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {images.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onOpenViewer(idx)}
                className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-emerald-500 shrink-0 hover:scale-105 transition cursor-pointer shadow-2xs bg-white group/thumb"
                title={`Bấm để xem ảnh ghi chú #${idx + 1}`}
              >
                <img
                  src={imgUrl}
                  alt={`Ảnh ghi chú ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 right-0 px-1 bg-black/70 text-white text-[8px] font-black">
                  {getDataUrlKB(imgUrl)}KB
                </span>
              </button>
            ))}
          </div>

          {/* Nút Xem ảnh & Thêm ảnh */}
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => onOpenViewer(0)}
              className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase flex items-center justify-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Eye size={13} />
              <span>
                Xem ảnh ({images.length}) · {getImagesTotalKB(images)}KB
              </span>
            </button>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={isUploading}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-emerald-300 transition cursor-pointer"
              title="Chụp thêm ảnh cho ghi chú này"
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
            <span>Chưa có ảnh</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={isUploading}
              className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-2xs"
              title="Mở camera chụp ảnh đính kèm vào ghi chú này"
            >
              <Camera size={11} />
              <span>Chụp ảnh</span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-2xs"
              title="Chọn ảnh từ điện thoại / máy tính đính kèm vào ghi chú này"
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

const NoteManagement: React.FC<{ user: User | null }> = ({ user }) => {
  const [data, setData] = useState<SystemNote[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<SystemNote> | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; title: string } | null>(null);

  // Full-screen image viewer modal state for notes
  const [viewingNoteId, setViewingNoteId] = useState<string | null>(null);
  const [viewingInitialIdx, setViewingInitialIdx] = useState<number>(0);

  useEffect(() => {
    const q = query(collection(db, 'notes'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setData(
        snapshot.docs.map(
          (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as SystemNote)
        )
      );
    });
  }, []);

  const openModal = (item: SystemNote | null = null) => {
    setEditingItem(item);
    setTitle(item ? item.title : '');
    setContent(item ? item.content : '');
    setImages(item?.images || []);
    setIsPinned(item ? !!item.isPinned : false);
    setError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề ghi chú.');
      return;
    }
    if (!content.trim() && images.length === 0) {
      setError('Vui lòng nhập nội dung hoặc đính kèm ít nhất 1 hình ảnh.');
      return;
    }
    try {
      if (editingItem?.id) {
        await updateDoc(doc(db, 'notes', editingItem.id), {
          title: title.trim(),
          content: content.trim(),
          images,
          isPinned,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'notes'), {
          title: title.trim(),
          content: content.trim(),
          images,
          isPinned,
          authorEmail: user?.email || 'Unknown',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
    } catch {
      setError('Có lỗi xảy ra khi lưu ghi chú.');
    }
  };

  const handleTogglePin = async (id: string, currentPinStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'notes', id), { isPinned: !currentPinStatus });
    } catch (e) {
      console.error(e);
    }
  };

  // Sort pinned first, then by date (already sorted by date from firestore)
  const sortedData = useMemo(() => {
    const pinned = data.filter((d) => d.isPinned);
    const unpinned = data.filter((d) => !d.isPinned);
    return [...pinned, ...unpinned];
  }, [data]);

  const filteredData = useMemo(
    () =>
      sortedData.filter(
        (d) =>
          (d.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (d.content || '').toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [sortedData, searchTerm]
  );

  const paginatedData = useMemo(
    () =>
      filteredData.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
      ),
    [filteredData, currentPage, pageSize]
  );

  const activeViewingNote = useMemo(
    () => (viewingNoteId ? data.find((n) => n.id === viewingNoteId) || null : null),
    [data, viewingNoteId]
  );

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Trình xem ảnh toàn màn hình cho Ghi Chú */}
      <DeliveryImageViewerModal
        isOpen={!!activeViewingNote}
        onClose={() => setViewingNoteId(null)}
        images={activeViewingNote?.images || []}
        initialIndex={viewingInitialIdx}
        orderId={activeViewingNote?.id.substring(0, 6).toUpperCase()}
        customerName={activeViewingNote?.title}
        noteId={activeViewingNote?.id}
        partnerLabel="Ghi chú"
      />

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-black text-dark flex items-center">
          <StickyNote className="mr-3 text-primary" size={32} /> Ghi Chú Hệ Thống
        </h1>
        <button
          onClick={() => openModal(null)}
          className="flex items-center px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover transition shadow cursor-pointer"
        >
          <PlusCircle size={20} className="mr-2" /> Thêm Ghi Chú
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Tìm tiêu đề hoặc nội dung..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-primary focus:border-primary"
            />
          </div>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border rounded-lg px-3 py-2 text-sm text-dark focus:ring-primary focus:border-primary"
          >
            <option value={12}>12 mục / trang</option>
            <option value={24}>24 mục / trang</option>
            <option value={60}>60 mục / trang</option>
          </select>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6 bg-slate-100">
          {paginatedData.map((d) => {
            const noteImages = d.images || [];
            return (
              <div
                key={d.id}
                className={`bg-white p-5 rounded-2xl shadow-sm border-2 transition-all relative group flex flex-col ${
                  d.isPinned
                    ? 'border-yellow-400 shadow-yellow-100'
                    : 'border-slate-200 hover:border-primary hover:shadow-md'
                }`}
              >
                <button
                  onClick={() => handleTogglePin(d.id, d.isPinned)}
                  className={`absolute top-4 right-4 p-2 rounded-full transition-colors cursor-pointer ${
                    d.isPinned
                      ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100'
                      : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'
                  }`}
                  title={d.isPinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                >
                  <Pin size={18} className={d.isPinned ? 'fill-yellow-500' : ''} />
                </button>

                <h3
                  className="font-black text-lg text-dark mb-2 pr-8 line-clamp-2"
                  title={d.title}
                >
                  {d.title}
                </h3>

                {d.content ? (
                  <p className="text-sm text-slate-600 mb-2 line-clamp-6 flex-1 whitespace-pre-wrap">
                    {d.content}
                  </p>
                ) : (
                  <p className="text-xs italic text-slate-400 mb-2 flex-1">
                    (Ghi chú hình ảnh)
                  </p>
                )}

                {/* Khu vực Chụp / Upload ảnh & Xem ảnh trực tiếp trên từng thẻ Ghi chú */}
                <NoteCardImageBar
                  note={d}
                  onOpenViewer={(initialIdx) => {
                    setViewingInitialIdx(initialIdx);
                    setViewingNoteId(d.id);
                  }}
                />

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                  <div className="flex flex-col gap-0.5">
                    <div
                      className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[140px]"
                      title={d.authorEmail}
                    >
                      {d.authorEmail}
                    </div>
                    {d.createdAt && typeof d.createdAt.toDate === 'function' && (
                      <div className="text-[10px] text-slate-500 font-medium">
                        {d.createdAt.toDate().toLocaleDateString('vi-VN')}{' '}
                        {d.createdAt
                          .toDate()
                          .toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setViewingInitialIdx(0);
                        setViewingNoteId(d.id);
                      }}
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        noteImages.length > 0
                          ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
                      }`}
                      title={
                        noteImages.length > 0
                          ? `Xem / quản lý ${noteImages.length} ảnh của ghi chú`
                          : 'Chụp / Tải ảnh cho ghi chú này'
                      }
                    >
                      <Camera size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openModal(d)}
                      className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
                      title="Sửa ghi chú"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setItemToDelete({ id: d.id, title: d.title });
                        setIsConfirmOpen(true);
                      }}
                      className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                      title="Xóa ghi chú"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {paginatedData.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400">
              <StickyNote size={64} className="mb-4 opacity-20" />
              <p className="text-lg font-bold">Chưa có ghi chú nào.</p>
            </div>
          )}
        </div>
        {filteredData.length > pageSize && (
          <div className="p-4 border-t border-slate-200">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredData.length / pageSize)}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-fade-in-down"
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-black uppercase text-dark">
                {editingItem ? 'Sửa Ghi Chú' : 'Thêm Ghi Chú Mới'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="mb-4">
                <label className="block text-sm font-black text-slate-500 uppercase mb-2">
                  Tiêu đề <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tiêu đề ghi chú..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary font-bold text-dark"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-black text-slate-500 uppercase mb-2">
                  Nội dung chi tiết
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Nhập chi tiết nội dung ghi chú..."
                  rows={6}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-dark resize-y leading-relaxed"
                />
              </div>

              {/* Khu vực Chụp / Upload ảnh & Xem ảnh trong cửa sổ Tạo mới / Chỉnh sửa Ghi chú */}
              <div className="mb-4">
                <DeliveryImageUploadSection
                  images={images}
                  onChange={setImages}
                  title="Hình ảnh đính kèm ghi chú"
                  customerName={title || editingItem?.title}
                  noteId={editingItem?.id}
                  partnerLabel="Ghi chú"
                />
              </div>

              <div className="mb-5 flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  <span className="ml-2 text-sm font-bold text-slate-700">
                    Ghim lên đầu trang
                  </span>
                </label>
              </div>

              {error && (
                <p className="text-red-500 text-sm font-bold mb-4">{error}</p>
              )}

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 bg-primary text-white font-black uppercase tracking-wider rounded-xl hover:bg-primary-hover shadow-lg transition-all cursor-pointer"
                >
                  Lưu Ghi Chú
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isConfirmOpen}
        title="Xóa Ghi Chú"
        message={`Bạn có chắc muốn xóa ghi chú "${itemToDelete?.title}"?`}
        onConfirm={async () => {
          if (itemToDelete) await deleteDoc(doc(db, 'notes', itemToDelete.id));
          setIsConfirmOpen(false);
          setItemToDelete(null);
        }}
        onClose={() => {
          setIsConfirmOpen(false);
          setItemToDelete(null);
        }}
        onCancel={() => {
          setIsConfirmOpen(false);
          setItemToDelete(null);
        }}
        confirmText="Xóa"
        cancelText="Hủy"
      />
    </div>
  );
};

export default NoteManagement;
