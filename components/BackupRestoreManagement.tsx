import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  collectionGroup,
  getDocs,
  writeBatch,
  doc,
  Timestamp,
  query,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { db } from '../services/firebase';
import {
  Database,
  Download,
  Upload,
  Code2,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  HardDrive,
  Clock,
  Trash2,
  Eye,
  FolderCode,
  Sparkles,
  CheckSquare,
  Square,
  X,
  Info,
  RotateCcw,
  Layers,
} from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';

// Load all project source files as raw strings eagerly via Vite import.meta.glob
const sourceFilesGlob = import.meta.glob(
  [
    '/App.tsx',
    '/index.tsx',
    '/index.html',
    '/index.css',
    '/types.ts',
    '/package.json',
    '/tsconfig.json',
    '/vite.config.ts',
    '/vercel.json',
    '/metadata.json',
    '/services/**/*.{ts,tsx,json}',
    '/utils/**/*.{ts,tsx}',
    '/types/**/*.{ts,tsx}',
    '/components/**/*.{ts,tsx}',
  ],
  { query: '?raw', import: 'default', eager: true }
) as Record<string, string>;

export interface CollectionMeta {
  key: string;
  label: string;
  group: 'core' | 'transactions' | 'partners' | 'finance' | 'system';
  groupLabel: string;
  isSubcollectionGroup?: boolean;
  description: string;
}

export const BACKUP_COLLECTIONS: CollectionMeta[] = [
  // Hàng hóa & Tồn kho
  {
    key: 'products',
    label: 'Danh mục Sản phẩm',
    group: 'core',
    groupLabel: 'Hàng hóa & Tồn kho',
    description: 'Thông tin sản phẩm, giá nhập, giá bán, định mức cảnh báo, combo',
  },
  {
    key: 'inventory_subcollection',
    label: 'Tồn kho chi tiết theo Kho',
    group: 'core',
    groupLabel: 'Hàng hóa & Tồn kho',
    isSubcollectionGroup: true,
    description: 'Số lượng tồn kho thực tế của từng sản phẩm tại từng kho (products/*/inventory/*)',
  },
  {
    key: 'warehouses',
    label: 'Danh sách Kho hàng',
    group: 'core',
    groupLabel: 'Hàng hóa & Tồn kho',
    description: 'Các kho lưu trữ hàng hóa',
  },
  {
    key: 'manufacturers',
    label: 'Hãng sản xuất',
    group: 'core',
    groupLabel: 'Hàng hóa & Tồn kho',
    description: 'Thương hiệu / hãng sản xuất',
  },
  {
    key: 'product_categories',
    label: 'Loại sản phẩm',
    group: 'core',
    groupLabel: 'Hàng hóa & Tồn kho',
    description: 'Phân nhóm danh mục sản phẩm',
  },

  // Giao dịch Bán & Nhập
  {
    key: 'sales',
    label: 'Đơn Bán hàng',
    group: 'transactions',
    groupLabel: 'Bán hàng & Nhập hàng',
    description: 'Toàn bộ đơn bán hàng, lịch sử thanh toán, trạng thái giao hàng & ảnh giao hàng',
  },
  {
    key: 'goodsReceipts',
    label: 'Phiếu Nhập hàng',
    group: 'transactions',
    groupLabel: 'Bán hàng & Nhập hàng',
    description: 'Toàn bộ phiếu nhập kho, công nợ NCC, lịch sử trả nợ & ảnh phiếu nhập',
  },
  {
    key: 'quotations',
    label: 'Báo giá khách hàng',
    group: 'transactions',
    groupLabel: 'Bán hàng & Nhập hàng',
    description: 'Danh sách các bảng báo giá đã tạo',
  },
  {
    key: 'plannedOrders',
    label: 'Đơn đặt hàng dự kiến',
    group: 'transactions',
    groupLabel: 'Bán hàng & Nhập hàng',
    description: 'Kế hoạch đặt hàng nhà cung cấp',
  },
  {
    key: 'chinaImports',
    label: 'Nhập hàng Trung Quốc',
    group: 'transactions',
    groupLabel: 'Bán hàng & Nhập hàng',
    description: 'Đơn hàng nhập khẩu TQ, tỷ giá và chi phí vận chuyển',
  },
  {
    key: 'productInvoices',
    label: 'Hóa đơn SP (Đầu vào)',
    group: 'transactions',
    groupLabel: 'Bán hàng & Nhập hàng',
    description: 'Hóa đơn VAT đầu vào của sản phẩm',
  },
  {
    key: 'productInvoiceExports',
    label: 'Hóa đơn SP (Xuất ra)',
    group: 'transactions',
    groupLabel: 'Bán hàng & Nhập hàng',
    description: 'Lịch sử xuất hóa đơn sản phẩm cho khách',
  },
  {
    key: 'inventoryAdjustments',
    label: 'Lịch sử điều chỉnh tồn kho',
    group: 'transactions',
    groupLabel: 'Bán hàng & Nhập hàng',
    description: 'Nhật ký kiểm kê và chỉnh sửa tồn kho',
  },
  {
    key: 'warehouseTransfers',
    label: 'Lịch sử chuyển kho',
    group: 'transactions',
    groupLabel: 'Bán hàng & Nhập hàng',
    description: 'Nhật ký điều chuyển hàng hóa giữa các kho',
  },

  // Đối tác
  {
    key: 'customers',
    label: 'Khách hàng',
    group: 'partners',
    groupLabel: 'Đối tác & Vận chuyển',
    description: 'Danh sách khách hàng sỉ/lẻ, SĐT, địa chỉ',
  },
  {
    key: 'suppliers',
    label: 'Nhà cung cấp',
    group: 'partners',
    groupLabel: 'Đối tác & Vận chuyển',
    description: 'Danh sách nhà cung cấp và tài khoản ngân hàng NCC',
  },
  {
    key: 'shippers',
    label: 'Đơn vị vận chuyển',
    group: 'partners',
    groupLabel: 'Đối tác & Vận chuyển',
    description: 'Danh sách đối tác giao hàng / nhà xe',
  },

  // Tài chính
  {
    key: 'paymentMethods',
    label: 'Phương thức TT / Tài khoản quỹ',
    group: 'finance',
    groupLabel: 'Tài chính & Sổ quỹ',
    description: 'Danh sách tài khoản ngân hàng, tiền mặt và số dư quỹ',
  },
  {
    key: 'paymentLogs',
    label: 'Nhật ký giao dịch Sổ quỹ',
    group: 'finance',
    groupLabel: 'Tài chính & Sổ quỹ',
    description: 'Lịch sử thu chi, nạp rút, chuyển khoản nội bộ',
  },
  {
    key: 'savings',
    label: 'Sổ tiết kiệm',
    group: 'finance',
    groupLabel: 'Tài chính & Sổ quỹ',
    description: 'Danh sách các khoản gửi tiết kiệm và lãi suất',
  },

  // Hệ thống
  {
    key: 'notes',
    label: 'Ghi chú hệ thống',
    group: 'system',
    groupLabel: 'Cấu hình & Hệ thống',
    description: 'Các ghi chú công việc nội bộ',
  },
  {
    key: 'users',
    label: 'Tài khoản & Phân quyền',
    group: 'system',
    groupLabel: 'Cấu hình & Hệ thống',
    description: 'Danh sách tài khoản Admin / Nhân viên',
  },
];

interface BackupDocumentRecord {
  id: string;
  productId?: string;
  warehouseId?: string;
  path?: string;
  data: Record<string, any>;
}

export interface FullDatabaseBackupPayload {
  backupFormat: 'KHO_BAN_HANG_BACKUP_V1';
  createdAt: string;
  createdBy: string;
  appVersion: string;
  totalDocuments: number;
  collectionCounts: Record<string, number>;
  collections: Record<string, BackupDocumentRecord[]>;
}

interface LocalSnapshotMeta {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  totalDocuments: number;
  sizeKB: number;
  payload: FullDatabaseBackupPayload;
}

// Recursive Firestore value serializer (preserves Timestamp with 100% precision)
function serializeFirestoreValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (
    val instanceof Timestamp ||
    (typeof val === 'object' &&
      typeof val.toDate === 'function' &&
      typeof val.seconds === 'number')
  ) {
    return {
      __datatype__: 'timestamp',
      seconds: val.seconds,
      nanoseconds: val.nanoseconds || 0,
      iso: val.toDate().toISOString(),
    };
  }
  if (val instanceof Date) {
    const ts = Timestamp.fromDate(val);
    return {
      __datatype__: 'timestamp',
      seconds: ts.seconds,
      nanoseconds: ts.nanoseconds,
      iso: val.toISOString(),
    };
  }
  if (Array.isArray(val)) {
    return val.map((item) => serializeFirestoreValue(item));
  }
  if (typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        out[k] = serializeFirestoreValue(v);
      }
    }
    return out;
  }
  return val;
}

// Recursive Firestore value deserializer (restores Timestamp objects)
function deserializeFirestoreValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object' && !Array.isArray(val)) {
    if (
      (val.__datatype__ === 'timestamp' ||
        ('seconds' in val &&
          'nanoseconds' in val &&
          Object.keys(val).length <= 3)) &&
      typeof val.seconds === 'number' &&
      typeof val.nanoseconds === 'number'
    ) {
      return new Timestamp(val.seconds, val.nanoseconds);
    }
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        out[k] = deserializeFirestoreValue(v);
      }
    }
    return out;
  }
  if (Array.isArray(val)) {
    return val.map((item) => deserializeFirestoreValue(item));
  }
  return val;
}

// IndexedDB helper for local browser snapshots
const IDB_NAME = 'KhoBanHang_LocalBackups_DB';
const IDB_STORE = 'snapshots';

function openSnapshotDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(IDB_STORE)) {
        database.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllLocalSnapshots(): Promise<LocalSnapshotMeta[]> {
  try {
    const database = await openSnapshotDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as LocalSnapshotMeta[];
        list.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function saveLocalSnapshotToIDB(snapshot: LocalSnapshotMeta): Promise<void> {
  const database = await openSnapshotDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(snapshot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteLocalSnapshotFromIDB(id: string): Promise<void> {
  const database = await openSnapshotDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function formatDateFileSlug(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}_${hh}-${mm}`;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}

const BackupRestoreManagement: React.FC<{ user: User | null }> = ({ user }) => {
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const [isScanningCounts, setIsScanningCounts] = useState(false);

  // Backup state
  const [selectedBackupKeys, setSelectedBackupKeys] = useState<string[]>(() =>
    BACKUP_COLLECTIONS.map((c) => c.key)
  );
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgressText, setBackupProgressText] = useState('');
  const [backupProgressPct, setBackupProgressPct] = useState(0);

  // Restore state
  const [parsedRestorePayload, setParsedRestorePayload] =
    useState<FullDatabaseBackupPayload | null>(null);
  const [restoreFileName, setRestoreFileName] = useState('');
  const [selectedRestoreKeys, setSelectedRestoreKeys] = useState<string[]>([]);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'overwrite'>('merge');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgressText, setRestoreProgressText] = useState('');
  const [restoreProgressPct, setRestoreProgressPct] = useState(0);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);

  // Local snapshots in IndexedDB
  const [localSnapshots, setLocalSnapshots] = useState<LocalSnapshotMeta[]>([]);
  const [snapshotToDelete, setSnapshotToDelete] =
    useState<LocalSnapshotMeta | null>(null);

  // Source code viewer modal
  const [isCodeViewerOpen, setIsCodeViewerOpen] = useState(false);
  const [selectedSourcePath, setSelectedSourcePath] = useState<string>('/App.tsx');
  const [selectedSourceContent, setSelectedSourceContent] = useState<string>('');
  const [isLoadingSourceFile, setIsLoadingSourceFile] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');

  // Status banner
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const allSourcePaths = Object.keys(sourceFilesGlob).sort();

  const scanDatabaseCounts = useCallback(async () => {
    setIsScanningCounts(true);
    try {
      const counts: Record<string, number> = {};
      await Promise.all(
        BACKUP_COLLECTIONS.map(async (col) => {
          try {
            if (col.isSubcollectionGroup) {
              const snap = await getDocs(query(collectionGroup(db, 'inventory')));
              counts[col.key] = snap.size;
            } else {
              const snap = await getDocs(collection(db, col.key));
              counts[col.key] = snap.size;
            }
          } catch {
            counts[col.key] = 0;
          }
        })
      );
      setLiveCounts(counts);
    } finally {
      setIsScanningCounts(false);
    }
  }, []);

  useEffect(() => {
    scanDatabaseCounts();
    getAllLocalSnapshots().then(setLocalSnapshots);
  }, [scanDatabaseCounts]);

  // Load source code file when previewing
  useEffect(() => {
    if (!isCodeViewerOpen || !selectedSourcePath) return;
    const rawContent = sourceFilesGlob[selectedSourcePath];
    if (typeof rawContent !== 'string') {
      setSelectedSourceContent('// Không tìm thấy nội dung file');
      return;
    }
    setIsLoadingSourceFile(false);
    setSelectedSourceContent(rawContent);
  }, [isCodeViewerOpen, selectedSourcePath]);

  const totalLiveDocuments = (Object.values(liveCounts) as number[]).reduce(
    (sum, n) => sum + (n || 0),
    0
  );

  // Build Full Database Backup Object
  const buildDatabaseBackupPayload = async (
    keysToExport: string[],
    onProgress?: (pct: number, text: string) => void
  ): Promise<FullDatabaseBackupPayload> => {
    const collectionsData: Record<string, BackupDocumentRecord[]> = {};
    const collectionCounts: Record<string, number> = {};
    let totalDocs = 0;

    for (let i = 0; i < keysToExport.length; i++) {
      const key = keysToExport[i];
      const meta = BACKUP_COLLECTIONS.find((c) => c.key === key);
      const label = meta?.label || key;
      const pct = Math.round(((i + 1) / keysToExport.length) * 85);
      onProgress?.(pct, `Đang sao lưu bảng: ${label} (${i + 1}/${keysToExport.length})...`);

      if (meta?.isSubcollectionGroup) {
        const snap = await getDocs(query(collectionGroup(db, 'inventory')));
        const records: BackupDocumentRecord[] = [];
        snap.forEach((docSnap) => {
          const parentProductId = docSnap.ref.parent.parent?.id || '';
          const rawData = docSnap.data();
          records.push({
            id: docSnap.id,
            productId: parentProductId,
            warehouseId: rawData.warehouseId || docSnap.id,
            path: docSnap.ref.path,
            data: serializeFirestoreValue(rawData),
          });
        });
        collectionsData[key] = records;
        collectionCounts[key] = records.length;
        totalDocs += records.length;
      } else {
        const snap = await getDocs(collection(db, key));
        const records: BackupDocumentRecord[] = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          data: serializeFirestoreValue(docSnap.data()),
        }));
        collectionsData[key] = records;
        collectionCounts[key] = records.length;
        totalDocs += records.length;
      }
    }

    return {
      backupFormat: 'KHO_BAN_HANG_BACKUP_V1',
      createdAt: new Date().toISOString(),
      createdBy: user?.email || 'Admin',
      appVersion: '1.2.0',
      totalDocuments: totalDocs,
      collectionCounts,
      collections: collectionsData,
    };
  };

  // Build Excel Workbook from backup payload
  const buildExcelWorkbook = (payload: FullDatabaseBackupPayload): XLSX.WorkBook => {
    const wb = XLSX.utils.book_new();

    const flattenForExcel = (obj: Record<string, any>) => {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === 'object' && v.__datatype__ === 'timestamp') {
          out[k] = v.iso ? new Date(v.iso).toLocaleString('vi-VN') : '';
        } else if (Array.isArray(v)) {
          if (
            k === 'deliveryImages' ||
            k === 'receiptImages' ||
            k === 'images'
          ) {
            out[k] = `[${v.length} hình ảnh]`;
          } else {
            out[k] = JSON.stringify(v);
          }
        } else if (v && typeof v === 'object') {
          out[k] = JSON.stringify(v);
        } else {
          out[k] = v;
        }
      }
      return out;
    };

    // Summary Sheet
    const summaryRows = BACKUP_COLLECTIONS.map((col) => ({
      'Mã Bảng': col.key,
      'Tên Bảng Dữ Liệu': col.label,
      'Nhóm': col.groupLabel,
      'Số Lượng Bản Ghi': payload.collectionCounts[col.key] ?? 0,
      'Mô Tả': col.description,
    }));
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'TONG_QUAN_BACKUP');

    // Individual sheets for non-empty collections
    for (const col of BACKUP_COLLECTIONS) {
      const records = payload.collections[col.key] || [];
      if (records.length === 0) continue;
      const rows = records.map((r) => {
        if (col.isSubcollectionGroup) {
          return {
            ID_SanPham: r.productId || '',
            ID_Kho: r.warehouseId || r.id,
            ...flattenForExcel(r.data),
          };
        }
        return {
          ID: r.id,
          ...flattenForExcel(r.data),
        };
      });
      const sheetName = col.key.slice(0, 28);
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    return wb;
  };

  // Add all source code files into a JSZip instance
  const addSourceCodeToZip = async (
    zipFolder: JSZip,
    onProgress?: (pct: number, text: string) => void
  ) => {
    const entries = Object.entries(sourceFilesGlob);
    for (let i = 0; i < entries.length; i++) {
      const [filePath, content] = entries[i];
      const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      if (i % 8 === 0) {
        onProgress?.(
          Math.min(92, Math.round(((i + 1) / entries.length) * 90)),
          `Đang đóng gói mã nguồn: ${cleanPath} (${i + 1}/${entries.length})...`
        );
      }
      if (typeof content === 'string') {
        zipFolder.file(cleanPath, content);
      }
    }

    const readmeContent = `# HƯỚNG DẪN CHẠY MÃ NGUỒN & PHỤC HỒI DỮ LIỆU (KHO & BÁN HÀNG)

## 1. Cách chạy mã nguồn (Source Code) trên máy tính
1. Cài đặt **Node.js** (phiên bản 18 trở lên) từ https://nodejs.org/
2. Giải nén thư mục mã nguồn này ra máy tính.
3. Mở Terminal / Command Prompt tại thư mục vừa giải nén và chạy lệnh:
   \`\`\`bash
   npm install
   npm run dev
   \`\`\`
4. Mở trình duyệt tại địa chỉ \`http://localhost:5173\` hoặc \`http://localhost:3000\`.
5. Để đóng gói bản Production (Triển khai lên hosting/server):
   \`\`\`bash
   npm run build
   \`\`\`

## 2. Cách Phục Hồi Dữ Liệu (Database Restore)
1. Đăng nhập vào phần mềm với tài khoản Quản trị viên (Admin).
2. Vào menu **Quản Lý & Cài Đặt** (hoặc Start Menu) -> Chọn **Sao Lưu & Phục Hồi (DB & Code)**.
3. Tại mục **Phục Hồi Dữ Liệu Từ File Backup**, bấm chọn file \`.json\` (\`database_backup_full.json\`) hoặc chọn trực tiếp file \`.zip\` này.
4. Kiểm tra danh sách các bảng dữ liệu và bấm **Bắt Đầu Phục Hồi Dữ Liệu**.
`;
    zipFolder.file('HUONG_DAN_CHAY_CODE_VA_PHUC_HOI.md', readmeContent);
  };

  // 1. Download Database JSON Only
  const handleDownloadDatabaseJSON = async () => {
    if (selectedBackupKeys.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Vui lòng chọn ít nhất 1 bảng dữ liệu để sao lưu.',
      });
      return;
    }
    setIsBackingUp(true);
    setBackupProgressPct(5);
    setBackupProgressText('Đang kết nối Firestore để trích xuất dữ liệu...');
    setStatusMessage(null);

    try {
      const payload = await buildDatabaseBackupPayload(
        selectedBackupKeys,
        (pct, text) => {
          setBackupProgressPct(pct);
          setBackupProgressText(text);
        }
      );

      setBackupProgressPct(95);
      setBackupProgressText('Đang tạo file JSON tải về máy...');

      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], {
        type: 'application/json;charset=utf-8',
      });
      const filename = `Backup_Database_KhoBanHang_${formatDateFileSlug()}.json`;
      triggerBlobDownload(blob, filename);

      setBackupProgressPct(100);
      setStatusMessage({
        type: 'success',
        text: `Đã tải xuống thành công file sao lưu Database (${payload.totalDocuments.toLocaleString('vi-VN')} bản ghi) -> ${filename}`,
      });
    } catch (error: any) {
      console.error('Database backup error:', error);
      setStatusMessage({
        type: 'error',
        text: `Lỗi khi sao lưu Database: ${error?.message || 'Không xác định'}`,
      });
    } finally {
      setIsBackingUp(false);
      setBackupProgressText('');
    }
  };

  // 2. Download Source Code ZIP Only
  const handleDownloadSourceCodeZip = async () => {
    setIsBackingUp(true);
    setBackupProgressPct(5);
    setBackupProgressText('Đang thu thập toàn bộ file mã nguồn hệ thống...');
    setStatusMessage(null);

    try {
      const zip = new JSZip();
      await addSourceCodeToZip(zip, (pct, text) => {
        setBackupProgressPct(pct);
        setBackupProgressText(text);
      });

      setBackupProgressPct(95);
      setBackupProgressText('Đang nén thành file .ZIP...');
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const filename = `Backup_SourceCode_KhoBanHang_${formatDateFileSlug()}.zip`;
      triggerBlobDownload(zipBlob, filename);

      setBackupProgressPct(100);
      setStatusMessage({
        type: 'success',
        text: `Đã tải xuống toàn bộ Mã nguồn phần mềm (${allSourcePaths.length} files) -> ${filename}`,
      });
    } catch (error: any) {
      console.error('Source code zip error:', error);
      setStatusMessage({
        type: 'error',
        text: `Lỗi khi tải mã nguồn: ${error?.message || 'Không xác định'}`,
      });
    } finally {
      setIsBackingUp(false);
      setBackupProgressText('');
    }
  };

  // 3. Download FULL Bundle (Database JSON + Excel + Source Code in 1 ZIP)
  const handleDownloadFullBundleZip = async () => {
    setIsBackingUp(true);
    setBackupProgressPct(5);
    setBackupProgressText('Bước 1/3: Đang sao lưu toàn bộ Cơ sở dữ liệu (Database)...');
    setStatusMessage(null);

    try {
      const allKeys = BACKUP_COLLECTIONS.map((c) => c.key);
      const dbPayload = await buildDatabaseBackupPayload(
        allKeys,
        (pct, text) => {
          setBackupProgressPct(Math.round(pct * 0.55));
          setBackupProgressText(`Bước 1/3: ${text}`);
        }
      );

      const zip = new JSZip();

      // Add full database backup JSON at root and inside database/
      const fullJsonStr = JSON.stringify(dbPayload, null, 2);
      zip.file('database_backup_full.json', fullJsonStr);

      const dbFolder = zip.folder('1_Database_Backup');
      dbFolder?.file('database_backup_full.json', fullJsonStr);

      // Add per-collection JSON files
      const colFolder = dbFolder?.folder('collections_json');
      for (const [colKey, records] of Object.entries(dbPayload.collections)) {
        colFolder?.file(`${colKey}.json`, JSON.stringify(records, null, 2));
      }

      // Add Excel readable file
      setBackupProgressPct(60);
      setBackupProgressText('Bước 2/3: Đang tạo bảng tổng hợp Excel (.xlsx)...');
      try {
        const wb = buildExcelWorkbook(dbPayload);
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        dbFolder?.file('database_readable.xlsx', excelBuffer);
      } catch (excelErr) {
        console.warn('Excel generation warning:', excelErr);
      }

      // Add full Source Code
      setBackupProgressPct(68);
      setBackupProgressText('Bước 3/3: Đang đóng gói toàn bộ Mã nguồn (Source Code)...');
      const codeFolder = zip.folder('2_Source_Code');
      if (codeFolder) {
        await addSourceCodeToZip(codeFolder, (pct, text) => {
          setBackupProgressPct(68 + Math.round(pct * 0.25));
          setBackupProgressText(`Bước 3/3: ${text}`);
        });
      }

      setBackupProgressPct(96);
      setBackupProgressText('Đang nén trọn bộ Database + Source Code thành file .ZIP...');
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const filename = `FullBackup_DB_va_Code_KhoBanHang_${formatDateFileSlug()}.zip`;
      triggerBlobDownload(zipBlob, filename);

      setBackupProgressPct(100);
      setStatusMessage({
        type: 'success',
        text: `Đã tải trọn bộ Database (${dbPayload.totalDocuments.toLocaleString('vi-VN')} bản ghi) + Mã nguồn (${allSourcePaths.length} files) -> ${filename}`,
      });
    } catch (error: any) {
      console.error('Full bundle backup error:', error);
      setStatusMessage({
        type: 'error',
        text: `Lỗi khi tạo gói sao lưu trọn bộ: ${error?.message || 'Không xác định'}`,
      });
    } finally {
      setIsBackingUp(false);
      setBackupProgressText('');
    }
  };

  // 4. Download Excel Only
  const handleDownloadExcelOnly = async () => {
    setIsBackingUp(true);
    setBackupProgressPct(10);
    setBackupProgressText('Đang đọc dữ liệu để xuất ra file Excel (.xlsx)...');
    setStatusMessage(null);

    try {
      const payload = await buildDatabaseBackupPayload(
        selectedBackupKeys,
        (pct, text) => {
          setBackupProgressPct(pct);
          setBackupProgressText(text);
        }
      );
      setBackupProgressPct(92);
      setBackupProgressText('Đang kết xuất các Sheet Excel...');
      const wb = buildExcelWorkbook(payload);
      XLSX.writeFile(wb, `Backup_Excel_KhoBanHang_${formatDateFileSlug()}.xlsx`);
      setBackupProgressPct(100);
      setStatusMessage({
        type: 'success',
        text: 'Đã tải xuống file Excel tổng hợp dữ liệu thành công!',
      });
    } catch (error: any) {
      setStatusMessage({
        type: 'error',
        text: `Lỗi khi xuất Excel: ${error?.message || 'Không xác định'}`,
      });
    } finally {
      setIsBackingUp(false);
      setBackupProgressText('');
    }
  };

  // 5. Save Quick Local Snapshot (IndexedDB)
  const handleCreateLocalSnapshot = async () => {
    setIsBackingUp(true);
    setBackupProgressPct(10);
    setBackupProgressText('Đang tạo Điểm Sao Lưu Nhanh trên trình duyệt...');
    setStatusMessage(null);

    try {
      const allKeys = BACKUP_COLLECTIONS.map((c) => c.key);
      const payload = await buildDatabaseBackupPayload(allKeys, (pct, text) => {
        setBackupProgressPct(pct);
        setBackupProgressText(text);
      });

      const jsonStr = JSON.stringify(payload);
      const sizeKB = Math.round(jsonStr.length / 1024);

      const snapshot: LocalSnapshotMeta = {
        id: `snap_${Date.now()}`,
        name: `Sao lưu nhanh ${new Date().toLocaleString('vi-VN')}`,
        createdAt: payload.createdAt,
        createdBy: payload.createdBy,
        totalDocuments: payload.totalDocuments,
        sizeKB,
        payload,
      };

      await saveLocalSnapshotToIDB(snapshot);
      const updated = await getAllLocalSnapshots();
      // Keep max 10 snapshots
      if (updated.length > 10) {
        for (const oldSnap of updated.slice(10)) {
          await deleteLocalSnapshotFromIDB(oldSnap.id);
        }
      }
      setLocalSnapshots(await getAllLocalSnapshots());
      setStatusMessage({
        type: 'success',
        text: `Đã lưu Điểm Sao Lưu Nhanh (${payload.totalDocuments.toLocaleString('vi-VN')} bản ghi · ${sizeKB.toLocaleString('vi-VN')} KB) ngay trên trình duyệt!`,
      });
    } catch (error: any) {
      setStatusMessage({
        type: 'error',
        text: `Không thể lưu bản sao lưu nhanh: ${error?.message || 'Lỗi bộ nhớ trình duyệt'}`,
      });
    } finally {
      setIsBackingUp(false);
      setBackupProgressText('');
    }
  };

  // Handle selecting a backup file (.json or .zip) from computer/phone
  const handleSelectRestoreFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage(null);
    setRestoreFileName(file.name);

    try {
      let jsonText = '';
      if (file.name.toLowerCase().endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        const jsonFile =
          zip.file('database_backup_full.json') ||
          zip.file('1_Database_Backup/database_backup_full.json') ||
          Object.values(zip.files).find((f) =>
            f.name.endsWith('database_backup_full.json')
          );
        if (!jsonFile) {
          throw new Error(
            'Không tìm thấy file database_backup_full.json bên trong gói .ZIP này.'
          );
        }
        jsonText = await jsonFile.async('string');
      } else {
        jsonText = await file.text();
      }

      const parsed = JSON.parse(jsonText) as FullDatabaseBackupPayload;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !parsed.collections ||
        typeof parsed.collections !== 'object'
      ) {
        throw new Error(
          'Cấu trúc file không hợp lệ. Vui lòng chọn đúng file Backup (.json hoặc .zip) được xuất từ hệ thống.'
        );
      }

      setParsedRestorePayload(parsed);
      const nonEmptyKeys = Object.keys(parsed.collections).filter(
        (k) => Array.isArray(parsed.collections[k]) && parsed.collections[k].length > 0
      );
      setSelectedRestoreKeys(
        nonEmptyKeys.length > 0 ? nonEmptyKeys : Object.keys(parsed.collections)
      );

      setStatusMessage({
        type: 'info',
        text: `Đã đọc thành công file "${file.name}" (${(parsed.totalDocuments || 0).toLocaleString('vi-VN')} bản ghi, tạo lúc ${new Date(parsed.createdAt).toLocaleString('vi-VN')}). Hãy kiểm tra bên dưới và bấm "Bắt Đầu Phục Hồi".`,
      });
    } catch (error: any) {
      setParsedRestorePayload(null);
      setStatusMessage({
        type: 'error',
        text: `Không thể đọc file sao lưu: ${error?.message || 'File không hợp lệ'}`,
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Execute Database Restore to Firestore
  const executeRestoreDatabase = async () => {
    if (!parsedRestorePayload || selectedRestoreKeys.length === 0) return;

    setIsRestoreConfirmOpen(false);
    setIsRestoring(true);
    setRestoreProgressPct(2);
    setRestoreProgressText('Đang chuẩn bị phục hồi dữ liệu lên Server Firestore...');
    setStatusMessage(null);

    try {
      let restoredDocsCount = 0;
      const totalKeys = selectedRestoreKeys.length;

      // Helper to commit operations in safe chunks of 400
      const commitOperationsInBatches = async (
        ops: Array<(batch: ReturnType<typeof writeBatch>) => void>,
        label: string,
        basePct: number,
        spanPct: number
      ) => {
        const CHUNK_SIZE = 400;
        for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
          const chunk = ops.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          chunk.forEach((op) => op(batch));
          await batch.commit();
          const subPct =
            basePct +
            Math.round(((i + chunk.length) / Math.max(1, ops.length)) * spanPct);
          setRestoreProgressPct(Math.min(98, subPct));
          setRestoreProgressText(
            `Đang phục hồi ${label}: ${Math.min(i + chunk.length, ops.length)}/${ops.length} bản ghi...`
          );
        }
      };

      for (let idx = 0; idx < totalKeys; idx++) {
        const key = selectedRestoreKeys[idx];
        const meta = BACKUP_COLLECTIONS.find((c) => c.key === key);
        const label = meta?.label || key;
        const records = parsedRestorePayload.collections[key] || [];
        const basePct = Math.round((idx / totalKeys) * 90) + 5;
        const spanPct = Math.max(2, Math.round(90 / totalKeys));

        setRestoreProgressPct(basePct);
        setRestoreProgressText(`Đang xử lý bảng: ${label} (${records.length} bản ghi)...`);

        if (meta?.isSubcollectionGroup) {
          // If overwrite mode is chosen, delete existing inventory docs not in backup
          if (restoreMode === 'overwrite') {
            const existingSnap = await getDocs(
              query(collectionGroup(db, 'inventory'))
            );
            const deleteOps: Array<(b: ReturnType<typeof writeBatch>) => void> = [];
            existingSnap.docs.forEach((d) => {
              deleteOps.push((b) => b.delete(d.ref));
            });
            if (deleteOps.length > 0) {
              await commitOperationsInBatches(
                deleteOps,
                `Làm sạch ${label}`,
                basePct,
                Math.floor(spanPct / 2)
              );
            }
          }

          const writeOps: Array<(b: ReturnType<typeof writeBatch>) => void> = [];
          for (const rec of records) {
            const pid = rec.productId;
            const wid = rec.id || rec.warehouseId;
            if (!pid || !wid) continue;
            const cleanData = deserializeFirestoreValue(rec.data);
            const ref = doc(db, 'products', pid, 'inventory', wid);
            writeOps.push((b) =>
              b.set(
                ref,
                { ...cleanData, warehouseId: rec.warehouseId || wid },
                { merge: restoreMode === 'merge' }
              )
            );
          }

          if (writeOps.length > 0) {
            await commitOperationsInBatches(writeOps, label, basePct, spanPct);
            restoredDocsCount += writeOps.length;
          }
        } else {
          // Top-level collection
          if (restoreMode === 'overwrite') {
            const existingSnap = await getDocs(collection(db, key));
            const deleteOps: Array<(b: ReturnType<typeof writeBatch>) => void> = [];
            existingSnap.docs.forEach((d) => {
              deleteOps.push((b) => b.delete(d.ref));
            });
            if (deleteOps.length > 0) {
              await commitOperationsInBatches(
                deleteOps,
                `Làm sạch ${label}`,
                basePct,
                Math.floor(spanPct / 2)
              );
            }
          }

          const writeOps: Array<(b: ReturnType<typeof writeBatch>) => void> = [];
          for (const rec of records) {
            if (!rec.id) continue;
            const cleanData = deserializeFirestoreValue(rec.data);
            const ref = doc(db, key, rec.id);
            writeOps.push((b) =>
              b.set(ref, cleanData, { merge: restoreMode === 'merge' })
            );
          }

          if (writeOps.length > 0) {
            await commitOperationsInBatches(writeOps, label, basePct, spanPct);
            restoredDocsCount += writeOps.length;
          }
        }
      }

      setRestoreProgressPct(100);
      setRestoreProgressText('Hoàn tất phục hồi dữ liệu!');
      await scanDatabaseCounts();

      setStatusMessage({
        type: 'success',
        text: `Phục hồi dữ liệu thành công! Đã khôi phục ${restoredDocsCount.toLocaleString('vi-VN')} bản ghi trên ${totalKeys} bảng dữ liệu.`,
      });
    } catch (error: any) {
      console.error('Restore database error:', error);
      setStatusMessage({
        type: 'error',
        text: `Có lỗi xảy ra khi phục hồi dữ liệu: ${error?.message || 'Không xác định'}`,
      });
    } finally {
      setIsRestoring(false);
      setRestoreProgressText('');
    }
  };

  const toggleBackupKey = (key: string) => {
    setSelectedBackupKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleRestoreKey = (key: string) => {
    setSelectedRestoreKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const filteredSourcePaths = allSourcePaths.filter((p) =>
    p.toLowerCase().includes(sourceSearch.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl border border-indigo-500/30 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black uppercase tracking-wider">
            <ShieldCheck size={15} /> An Toàn Dữ Liệu & Mã Nguồn 100%
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
            <Database className="text-sky-400 shrink-0" size={32} />
            <span>Sao Lưu & Phục Hồi Hệ Thống (Database + Source Code)</span>
          </h1>
          <p className="text-slate-300 text-sm max-w-3xl">
            Tải toàn bộ Cơ sở dữ liệu (22 bảng Firestore) và Mã nguồn phần mềm về máy tính / điện thoại để lưu trữ an toàn. Khi cần có thể phục hồi lại nguyên trạng chỉ với 1 cú nhấp chuột.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 text-center">
            <div className="text-[11px] font-bold text-slate-300 uppercase">
              Tổng Bản Ghi DB
            </div>
            <div className="text-xl font-black text-emerald-400">
              {isScanningCounts ? '...' : totalLiveDocuments.toLocaleString('vi-VN')}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 text-center">
            <div className="text-[11px] font-bold text-slate-300 uppercase">
              Files Mã Nguồn
            </div>
            <div className="text-xl font-black text-sky-400">
              {allSourcePaths.length} files
            </div>
          </div>
          <button
            type="button"
            onClick={scanDatabaseCounts}
            disabled={isScanningCounts}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 border border-white/20 transition cursor-pointer"
            title="Quét lại số lượng bản ghi hiện tại"
          >
            <RefreshCw
              size={16}
              className={isScanningCounts ? 'animate-spin text-sky-400' : ''}
            />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Status Notification Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border-2 flex items-start justify-between gap-3 shadow-sm animate-fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : statusMessage.type === 'error'
              ? 'bg-red-50 border-red-300 text-red-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          <div className="flex items-start gap-3">
            {statusMessage.type === 'success' && (
              <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={22} />
            )}
            {statusMessage.type === 'error' && (
              <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={22} />
            )}
            {statusMessage.type === 'info' && (
              <Info className="text-blue-600 shrink-0 mt-0.5" size={22} />
            )}
            <div className="text-sm font-bold leading-relaxed">
              {statusMessage.text}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Progress Bar when Backing up or Restoring */}
      {(isBackingUp || isRestoring) && (
        <div className="bg-white p-5 rounded-2xl shadow-lg border-2 border-primary space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-dark flex items-center gap-2">
              <RefreshCw size={18} className="animate-spin text-primary" />
              {isBackingUp ? backupProgressText : restoreProgressText}
            </span>
            <span className="text-sm font-black text-primary">
              {isBackingUp ? backupProgressPct : restoreProgressPct}%
            </span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-gradient-to-r from-primary via-sky-500 to-emerald-500 transition-all duration-300"
              style={{
                width: `${isBackingUp ? backupProgressPct : restoreProgressPct}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* TOP ACTION CARDS: DOWNLOAD BACKUP TO COMPUTER / PHONE */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Full Bundle ZIP (DB + Code + Excel) */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-2xl shadow-lg flex flex-col justify-between border border-emerald-400/30">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-white/20 rounded-xl">
                <FileArchive size={26} />
              </div>
              <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] uppercase rounded-full">
                Khuyên dùng
              </span>
            </div>
            <h3 className="text-lg font-black mb-1">
              Tải Trọn Bộ: DB + Code (.ZIP)
            </h3>
            <p className="text-xs text-emerald-100 leading-relaxed mb-4">
              Đóng gói toàn bộ 22 bảng Database (.json + .xlsx) VÀ toàn bộ Mã nguồn phần mềm (.tsx, .ts) vào 1 file .ZIP duy nhất để lưu trên máy.
            </p>
          </div>
          <button
            type="button"
            disabled={isBackingUp || isRestoring}
            onClick={handleDownloadFullBundleZip}
            className="w-full py-3 px-4 bg-white text-emerald-800 hover:bg-emerald-50 font-black text-xs uppercase rounded-xl shadow-md flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Download size={17} />
            <span>Tải Trọn Bộ (.ZIP)</span>
          </button>
        </div>

        {/* Card 2: Database JSON Backup */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border-2 border-slate-200 hover:border-blue-400 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <FileJson size={26} />
              </div>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 font-black text-[10px] uppercase rounded-full">
                Chuẩn Phục Hồi 100%
              </span>
            </div>
            <h3 className="text-lg font-black text-dark mb-1">
              Sao Lưu Database (.JSON)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Tải xuống toàn bộ dữ liệu ({selectedBackupKeys.length}/{BACKUP_COLLECTIONS.length} bảng đã chọn) chuẩn gốc Firestore. Dùng file này để Phục hồi lại khi gặp sự cố.
            </p>
          </div>
          <button
            type="button"
            disabled={isBackingUp || isRestoring}
            onClick={handleDownloadDatabaseJSON}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase rounded-xl shadow-md flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Download size={17} />
            <span>Tải File Database (.JSON)</span>
          </button>
        </div>

        {/* Card 3: Source Code ZIP Backup */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border-2 border-slate-200 hover:border-indigo-400 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Code2 size={26} />
              </div>
              <button
                type="button"
                onClick={() => setIsCodeViewerOpen(true)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg flex items-center gap-1 transition cursor-pointer"
              >
                <Eye size={13} /> Xem Code ({allSourcePaths.length})
              </button>
            </div>
            <h3 className="text-lg font-black text-dark mb-1">
              Sao Lưu Mã Nguồn (.ZIP)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Tải toàn bộ {allSourcePaths.length} file mã nguồn (React, TypeScript, Giao diện, Cấu hình Vite/Firebase) kèm hướng dẫn cài đặt & chạy độc lập.
            </p>
          </div>
          <button
            type="button"
            disabled={isBackingUp || isRestoring}
            onClick={handleDownloadSourceCodeZip}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase rounded-xl shadow-md flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Download size={17} />
            <span>Tải Mã Nguồn (.ZIP)</span>
          </button>
        </div>

        {/* Card 4: Excel Readable Export */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border-2 border-slate-200 hover:border-teal-400 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl">
                <FileSpreadsheet size={26} />
              </div>
              <span className="px-2.5 py-0.5 bg-teal-100 text-teal-800 font-black text-[10px] uppercase rounded-full">
                Đọc trên Excel
              </span>
            </div>
            <h3 className="text-lg font-black text-dark mb-1">
              Xuất Database Ra Excel (.XLSX)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Xuất toàn bộ các bảng dữ liệu ra 1 file Microsoft Excel nhiều Sheet để mở xem trực tiếp, kiểm산 công nợ, tồn kho, đơn hàng trên máy.
            </p>
          </div>
          <button
            type="button"
            disabled={isBackingUp || isRestoring}
            onClick={handleDownloadExcelOnly}
            className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs uppercase rounded-xl shadow-md flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Download size={17} />
            <span>Tải File Excel (.XLSX)</span>
          </button>
        </div>
      </div>

      {/* MAIN 2-COLUMN SECTION: LEFT = RESTORE FROM FILE | RIGHT = SELECT TABLES & SNAPSHOTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: RESTORE DATABASE FROM FILE */}
        <div className="lg:col-span-6 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <RotateCcw className="text-amber-400" size={22} />
              <div>
                <h2 className="font-black uppercase text-base">
                  Phục Hồi Dữ Liệu (Database Restore)
                </h2>
                <p className="text-xs text-slate-300">
                  Khôi phục lại dữ liệu từ file .JSON hoặc .ZIP đã lưu trên máy
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5 flex-1 flex flex-col">
            {/* Upload Dropzone */}
            <div className="border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 rounded-2xl p-6 text-center transition">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.zip"
                onChange={handleSelectRestoreFile}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md">
                <Upload size={24} />
              </div>
              <h3 className="font-black text-dark text-sm mb-1">
                Chọn File Backup Từ Máy Tính / Điện Thoại
              </h3>
              <p className="text-xs text-slate-600 mb-4">
                Hỗ trợ cả file <strong>.JSON</strong> (<code>Backup_Database_*.json</code>) và file trọn bộ <strong>.ZIP</strong> (<code>FullBackup_DB_va_Code_*.zip</code>)
              </p>
              <button
                type="button"
                disabled={isRestoring || isBackingUp}
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase rounded-xl shadow transition active:scale-95 cursor-pointer"
              >
                Chọn File Backup Để Phục Hồi...
              </button>
            </div>

            {/* Preview Parsed Backup File */}
            {parsedRestorePayload ? (
              <div className="border-2 border-emerald-200 bg-emerald-50/30 rounded-2xl p-4 space-y-4">
                <div className="flex items-start justify-between gap-2 border-b border-emerald-200 pb-3">
                  <div>
                    <div className="text-xs font-black uppercase text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      File Backup Hợp Lệ: {restoreFileName}
                    </div>
                    <div className="text-xs text-slate-600 mt-1 space-x-3">
                      <span>
                        Ngày tạo:{' '}
                        <strong>
                          {new Date(parsedRestorePayload.createdAt).toLocaleString(
                            'vi-VN'
                          )}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Người tạo: <strong>{parsedRestorePayload.createdBy}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Tổng bản ghi:{' '}
                        <strong className="text-emerald-700">
                          {(parsedRestorePayload.totalDocuments || 0).toLocaleString(
                            'vi-VN'
                          )}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedRestorePayload(null);
                      setRestoreFileName('');
                    }}
                    className="p-1 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                    title="Đóng file này"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Restore Mode Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase text-slate-700">
                    Chế độ phục hồi:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRestoreMode('merge')}
                      className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${
                        restoreMode === 'merge'
                          ? 'border-blue-600 bg-blue-50/70'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="font-black text-xs text-dark flex items-center justify-between">
                        <span>1. Gộp & Cập nhật (Khuyên dùng)</span>
                        {restoreMode === 'merge' && (
                          <CheckCircle2 size={15} className="text-blue-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Khôi phục các dữ liệu trong bản backup mà không xóa các đơn mới phát sinh sau thời điểm backup.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRestoreMode('overwrite')}
                      className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${
                        restoreMode === 'overwrite'
                          ? 'border-red-600 bg-red-50/70'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="font-black text-xs text-red-700 flex items-center justify-between">
                        <span>2. Khôi phục nguyên trạng 100%</span>
                        {restoreMode === 'overwrite' && (
                          <CheckCircle2 size={15} className="text-red-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Xóa dữ liệu hiện tại của bảng được chọn và nạp lại đúng 100% như thời điểm tạo file backup.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Select collections inside backup to restore */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase text-slate-700">
                      Chọn bảng cần phục hồi ({selectedRestoreKeys.length} bảng):
                    </span>
                    <div className="space-x-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedRestoreKeys(
                            Object.keys(parsedRestorePayload.collections)
                          )
                        }
                        className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        Chọn tất cả
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedRestoreKeys([])}
                        className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100">
                    {BACKUP_COLLECTIONS.map((col) => {
                      const countInFile =
                        parsedRestorePayload.collections[col.key]?.length ?? 0;
                      const isChecked = selectedRestoreKeys.includes(col.key);
                      return (
                        <label
                          key={col.key}
                          className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleRestoreKey(col.key)}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-bold text-slate-800">
                              {col.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[11px]">
                              File: {countInFile}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[11px]">
                              Hiện tại: {liveCounts[col.key] ?? 0}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isRestoring || selectedRestoreKeys.length === 0}
                  onClick={() => setIsRestoreConfirmOpen(true)}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase rounded-xl shadow-lg flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw size={18} />
                  <span>
                    Bắt Đầu Phục Hồi Dữ Liệu ({selectedRestoreKeys.length} Bảng)
                  </span>
                </button>
              </div>
            ) : (
              /* Quick Local Browser Snapshots section when no external file is open */
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-3 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive size={18} className="text-indigo-600" />
                    <h3 className="font-black text-xs uppercase text-slate-700">
                      Điểm Sao Lưu Nhanh Trên Trình Duyệt ({localSnapshots.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    disabled={isBackingUp || isRestoring}
                    onClick={handleCreateLocalSnapshot}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Sparkles size={13} />
                    <span>+ Tạo Điểm Sao Lưu Nhanh</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500">
                  Ngoài việc tải file về máy tính, bạn có thể bấm <strong>"+ Tạo Điểm Sao Lưu Nhanh"</strong> trước khi chỉnh sửa hàng loạt để có thể khôi phục tức thì ngay trên trình duyệt.
                </p>

                {localSnapshots.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs font-medium bg-white rounded-xl border border-slate-200/80">
                    Chưa có điểm sao lưu nhanh nào trên trình duyệt này.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {localSnapshots.map((snap) => (
                      <div
                        key={snap.id}
                        className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-2 hover:border-indigo-300 transition"
                      >
                        <div className="min-w-0">
                          <div className="font-black text-xs text-dark truncate">
                            {snap.name}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {new Date(snap.createdAt).toLocaleString('vi-VN')}
                            </span>
                            <span>•</span>
                            <span className="font-bold text-indigo-600">
                              {snap.totalDocuments.toLocaleString('vi-VN')} bản ghi
                            </span>
                            <span>•</span>
                            <span>{snap.sizeKB.toLocaleString('vi-VN')} KB</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setParsedRestorePayload(snap.payload);
                              setRestoreFileName(snap.name);
                              setSelectedRestoreKeys(
                                Object.keys(snap.payload.collections)
                              );
                            }}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg transition cursor-pointer"
                            title="Chọn bản sao lưu này để phục hồi"
                          >
                            Phục hồi
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const blob = new Blob(
                                [JSON.stringify(snap.payload, null, 2)],
                                { type: 'application/json;charset=utf-8' }
                              );
                              triggerBlobDownload(
                                blob,
                                `Backup_Database_${formatDateFileSlug(
                                  new Date(snap.createdAt)
                                )}.json`
                              );
                            }}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition cursor-pointer"
                            title="Tải bản sao lưu này về máy (.JSON)"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSnapshotToDelete(snap)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition cursor-pointer"
                            title="Xóa bản lưu nhanh này"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAILED DATABASE TABLES & SELECTION */}
        <div className="lg:col-span-6 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 bg-slate-800 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Layers className="text-sky-400" size={22} />
              <div>
                <h2 className="font-black uppercase text-base">
                  Chi Tiết 22 Bảng Dữ Liệu Hệ Thống
                </h2>
                <p className="text-xs text-slate-300">
                  Tích chọn các bảng muốn xuất khi tải file JSON / Excel
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedBackupKeys(BACKUP_COLLECTIONS.map((c) => c.key))
                }
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Chọn tất cả
              </button>
              <button
                type="button"
                onClick={() => setSelectedBackupKeys([])}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Bỏ chọn
              </button>
            </div>
          </div>

          <div className="p-4 overflow-y-auto max-h-[540px] divide-y divide-slate-100">
            {BACKUP_COLLECTIONS.map((col) => {
              const isSelected = selectedBackupKeys.includes(col.key);
              const count = liveCounts[col.key] ?? 0;
              return (
                <div
                  key={col.key}
                  onClick={() => toggleBackupKey(col.key)}
                  className={`p-3 flex items-center justify-between gap-3 rounded-xl transition cursor-pointer ${
                    isSelected ? 'hover:bg-blue-50/40' : 'opacity-60 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      className="mt-0.5 text-primary shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare size={18} className="text-blue-600" />
                      ) : (
                        <Square size={18} className="text-slate-400" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-dark">
                          {col.label}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {col.key}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                          {col.groupLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {col.description}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black ${
                        count > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isScanningCounts ? '...' : `${count.toLocaleString('vi-VN')} dòng`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SOURCE CODE VIEWER MODAL */}
      {isCodeViewerOpen && (
        <div
          onClick={() => setIsCodeViewerOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[220] flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 text-white rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] border border-slate-700 flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <FolderCode className="text-sky-400" size={22} />
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider">
                    Trình Quản Lý & Tải Mã Nguồn Hệ Thống ({allSourcePaths.length} Files)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Xem trực tiếp hoặc tải toàn bộ mã nguồn về máy tính dưới dạng file nén .ZIP
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadSourceCodeZip}
                  disabled={isBackingUp}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase rounded-xl flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Download size={15} />
                  <span>Tải Toàn Bộ Code (.ZIP)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCodeViewerOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0">
              {/* File Tree List */}
              <div className="md:col-span-4 border-r border-slate-800 flex flex-col min-h-0 bg-slate-900/60">
                <div className="p-3 border-b border-slate-800">
                  <input
                    type="text"
                    value={sourceSearch}
                    onChange={(e) => setSourceSearch(e.target.value)}
                    placeholder="Tìm tên file code (VD: SalesTerminal)..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filteredSourcePaths.map((path) => {
                    const isActive = path === selectedSourcePath;
                    return (
                      <button
                        key={path}
                        type="button"
                        onClick={() => setSelectedSourcePath(path)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono truncate transition cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {path.startsWith('/') ? path.slice(1) : path}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Code Content Viewer */}
              <div className="md:col-span-8 flex flex-col min-h-0 bg-slate-950">
                <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <span className="font-mono text-xs text-sky-400 font-bold">
                    {selectedSourcePath}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([selectedSourceContent], {
                        type: 'text/plain;charset=utf-8',
                      });
                      const cleanName =
                        selectedSourcePath.split('/').pop() || 'source.tsx';
                      triggerBlobDownload(blob, cleanName);
                    }}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Tải file này</span>
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  {isLoadingSourceFile ? (
                    <div className="text-slate-400 text-xs font-mono">
                      Đang tải nội dung file...
                    </div>
                  ) : (
                    <pre className="text-xs font-mono text-slate-200 whitespace-pre leading-relaxed">
                      {selectedSourceContent}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Restore Modal */}
      <ConfirmationModal
        isOpen={isRestoreConfirmOpen}
        title="Xác Nhận Phục Hồi Dữ Liệu Hệ Thống"
        message={
          <div className="space-y-2 text-sm">
            <p>
              Bạn chuẩn bị phục hồi <strong>{selectedRestoreKeys.length} bảng dữ liệu</strong> từ file sao lưu{' '}
              <strong>"{restoreFileName}"</strong>.
            </p>
            <p>
              Chế độ đã chọn:{' '}
              <strong className={restoreMode === 'overwrite' ? 'text-red-600' : 'text-blue-600'}>
                {restoreMode === 'overwrite'
                  ? 'Khôi phục nguyên trạng 100% (Xóa dữ liệu hiện tại của bảng được chọn và nạp lại từ Backup)'
                  : 'Gộp & Cập nhật an toàn (Giữ nguyên đơn mới, khôi phục & cập nhật các bản ghi từ Backup)'}
              </strong>
            </p>
            <p className="text-xs text-slate-500">
              Bạn có chắc chắn muốn tiến hành phục hồi ngay bây giờ không?
            </p>
          </div>
        }
        onConfirm={executeRestoreDatabase}
        onClose={() => setIsRestoreConfirmOpen(false)}
        onCancel={() => setIsRestoreConfirmOpen(false)}
        confirmText="Bắt Đầu Phục Hồi"
        cancelText="Hủy"
      />

      {/* Confirm Delete Local Snapshot Modal */}
      <ConfirmationModal
        isOpen={!!snapshotToDelete}
        title="Xóa Điểm Sao Lưu Nhanh"
        message={`Bạn có chắc muốn xóa bản sao lưu nhanh "${snapshotToDelete?.name}" khỏi trình duyệt?`}
        onConfirm={async () => {
          if (snapshotToDelete) {
            await deleteLocalSnapshotFromIDB(snapshotToDelete.id);
            setLocalSnapshots(await getAllLocalSnapshots());
          }
          setSnapshotToDelete(null);
        }}
        onClose={() => setSnapshotToDelete(null)}
        onCancel={() => setSnapshotToDelete(null)}
        confirmText="Xóa"
        cancelText="Hủy"
      />
    </div>
  );
};

export default BackupRestoreManagement;
