import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { User } from 'firebase/auth';
import {
  ConsignmentItem,
  ConsignmentStatus,
  Customer,
  PaymentMethod
} from '../types';
import {
  Handshake,
  Search,
  Plus,
  Calendar,
  Clock,
  DollarSign,
  Tag,
  Phone,
  User as UserIcon,
  CreditCard,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Camera,
  Eye,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  ChevronLeft,
  X,
  Save,
  RotateCcw,
  Check,
  TrendingUp,
  Package,
  Layers,
  Sparkles,
  Copy,
  CheckCheck,
  Building,
  ArrowRight,
  Info,
  Share2,
  ArrowDownLeft,
  Banknote,
  Wallet
} from 'lucide-react';
import { DeliveryImageViewerModal } from './DeliveryImageViewerModal';
import { formatNumber, parseNumber, getLocalYYYYMMDD } from '../utils/formatting';
import { compressMultipleImagesWithStats } from '../utils/imageCompression';
import { filterAndSortCustomers } from '../utils/vietnameseSearch';
import * as XLSX from 'xlsx';

// Common categories for table tennis & sports consignments
const CONSIGNMENT_CATEGORIES = [
  'Cốt vợt',
  'Mặt vợt',
  'Combo Vợt dán sẵn',
  'Giày bóng bàn',
  'Quần áo / Đồng phục',
  'Bao vợt / Túi balo',
  'Bàn & Lưới bóng bàn',
  'Máy bắn bóng',
  'Phụ kiện & Khác'
];

// Common product conditions
const CONSIGNMENT_CONDITIONS = [
  'Mới 100% (Nguyên hộp/seal)',
  'Mới 99% (Hàng lướt / Like New)',
  'Đã dùng tốt (90 - 95%)',
  'Khá (80 - 85%, trầy viền nhẹ)',
  'Cũ (Đã qua sử dụng nhiều)',
  'Khác'
];

const NumericInput: React.FC<{
  value: number;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}> = ({ value, onChange, className, placeholder, autoFocus = false }) => {
  const [localValue, setLocalValue] = useState(formatNumber(value));

  useEffect(() => {
    const parsedLocal = parseNumber(localValue);
    if (value !== parsedLocal) {
      setLocalValue(formatNumber(value));
    }
  }, [value, localValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);
    onChange(parseNumber(raw));
  };

  const handleBlur = () => {
    const parsed = parseNumber(localValue);
    setLocalValue(formatNumber(parsed));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={localValue}
      placeholder={placeholder}
      className={className}
      autoFocus={autoFocus}
      onFocus={() => {
        if (value === 0) setLocalValue('');
      }}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};

interface ConsignmentManagementProps {
  user?: User | null;
  userRole?: 'admin' | 'staff' | null;
}

export const ConsignmentManagement: React.FC<ConsignmentManagementProps> = ({
  user,
  userRole
}) => {
  const [items, setItems] = useState<ConsignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConsignmentStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFilterStart, setDateFilterStart] = useState<string>('');
  const [dateFilterEnd, setDateFilterEnd] = useState<string>('');

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ConsignmentItem | null>(null);

  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [itemToSell, setItemToSell] = useState<ConsignmentItem | null>(null);

  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [itemToPayout, setItemToPayout] = useState<ConsignmentItem | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [itemToPrint, setItemToPrint] = useState<ConsignmentItem | null>(null);

  // Fullscreen photo viewer
  const [viewingImageConsignmentId, setViewingImageConsignmentId] = useState<string | null>(null);
  const [viewingImageInitialIdx, setViewingImageInitialIdx] = useState<number>(0);

  // Copy notification
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Load items realtime
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'consignments'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const loaded: ConsignmentItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any)
        }));
        setItems(loaded);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching consignments:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Load customers for autocomplete
  useEffect(() => {
    const unsubCust = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    const unsubPay = onSnapshot(collection(db, 'paymentMethods'), (snap) => {
      setPaymentMethods(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => {
      unsubCust();
      unsubPay();
    };
  }, []);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Filtered list
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Status
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;

      // Category
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

      // Search term
      if (searchTerm.trim()) {
        const lower = searchTerm.toLowerCase();
        const matchCode = (item.code || '').toLowerCase().includes(lower);
        const matchName = (item.productName || '').toLowerCase().includes(lower);
        const matchCust = (item.customerName || '').toLowerCase().includes(lower);
        const matchPhone = (item.customerPhone || '').toLowerCase().includes(lower);
        const matchNote = (item.note || '').toLowerCase().includes(lower);
        if (!matchCode && !matchName && !matchCust && !matchPhone && !matchNote) return false;
      }

      // Date range (based on receivedDate or soldDate)
      if (dateFilterStart && item.receivedDate < dateFilterStart) return false;
      if (dateFilterEnd && item.receivedDate > dateFilterEnd) return false;

      return true;
    });
  }, [items, statusFilter, categoryFilter, searchTerm, dateFilterStart, dateFilterEnd]);

  // Statistics calculation
  const stats = useMemo(() => {
    let receivingCount = 0;
    let receivingValue = 0;

    let soldPendingPayoutCount = 0;
    let soldPendingPayoutValue = 0;

    let paidCount = 0;
    let paidTotal = 0;

    let totalCommissionEarned = 0;

    items.forEach((item) => {
      const ask = Number(item.askingPrice) || 0;
      const sold = Number(item.actualSellingPrice) || 0;
      const payout = Number(item.payoutAmount) || 0;

      if (item.status === 'received') {
        receivingCount++;
        receivingValue += ask;
      } else if (item.status === 'sold') {
        soldPendingPayoutCount++;
        // Money owed to customer
        soldPendingPayoutValue += Math.max(0, ask - payout);
        if (sold > 0 && ask > 0) {
          totalCommissionEarned += Math.max(0, sold - ask);
        }
      } else if (item.status === 'paid') {
        paidCount++;
        paidTotal += payout || ask;
        if (sold > 0 && ask > 0) {
          totalCommissionEarned += Math.max(0, sold - ask);
        }
      }
    });

    return {
      receivingCount,
      receivingValue,
      soldPendingPayoutCount,
      soldPendingPayoutValue,
      paidCount,
      paidTotal,
      totalCommissionEarned
    };
  }, [items]);

  // Delete item
  const handleDeleteItem = async (item: ConsignmentItem) => {
    const confirmMsg = `Bạn có chắc muốn xóa món hàng gửi bán:\n"${item.productName}" (Mã: ${item.code || item.id.substring(0, 6)}) của khách "${item.customerName}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteDoc(doc(db, 'consignments', item.id));
    } catch (err: any) {
      console.error('Lỗi khi xóa:', err);
      alert('Không thể xóa món hàng: ' + (err.message || ''));
    }
  };

  // Return to customer
  const handleReturnItem = async (item: ConsignmentItem) => {
    const returnNote = prompt('Nhập ghi chú trả lại hàng cho khách (tùy chọn):', 'Khách nhận lại hàng, không gửi bán nữa');
    if (returnNote === null) return; // User cancelled

    try {
      await updateDoc(doc(db, 'consignments', item.id), {
        status: 'returned',
        returnDate: getLocalYYYYMMDD(),
        returnNote: returnNote.trim() || 'Đã trả lại hàng cho khách',
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error('Lỗi khi trả lại hàng:', err);
      alert('Lỗi cập nhật: ' + err.message);
    }
  };

  // Re-open item back to 'received'
  const handleReopenItem = async (item: ConsignmentItem) => {
    if (!window.confirm(`Chuyển trạng thái món "${item.productName}" quay về "Đang gửi bán"?`)) return;
    try {
      await updateDoc(doc(db, 'consignments', item.id), {
        status: 'received',
        soldDate: null,
        actualSellingPrice: null,
        soldNote: null,
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      alert('Lỗi cập nhật: ' + err.message);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredItems.length === 0) {
      alert('Không có dữ liệu hàng gửi bán để xuất Excel.');
      return;
    }

    const dataToExport = filteredItems.map((item, idx) => {
      let statusStr = 'Đang gửi bán';
      if (item.status === 'sold') statusStr = 'Đã bán (Chờ trả tiền)';
      if (item.status === 'paid') statusStr = 'Đã thanh toán xong';
      if (item.status === 'returned') statusStr = 'Đã trả lại hàng';

      const ask = Number(item.askingPrice) || 0;
      const actual = Number(item.actualSellingPrice) || 0;
      const paid = Number(item.payoutAmount) || 0;
      const profit = actual > 0 ? actual - ask : 0;

      return {
        STT: idx + 1,
        'Mã nhận gửi': item.code || item.id.substring(0, 8).toUpperCase(),
        'Tên mặt hàng': item.productName,
        'Phân loại': item.category || 'Khác',
        'Tình trạng': item.condition || '',
        'Khách gửi': item.customerName,
        'SĐT khách': item.customerPhone || '',
        'STK Ngân hàng': item.customerBankDetails || '',
        'Ngày nhận gửi': item.receivedDate || '',
        'Giá khách gửi (VNĐ)': ask,
        'Giá niêm yết (VNĐ)': item.expectedSellingPrice || '',
        'Trạng thái': statusStr,
        'Ngày bán': item.soldDate || '',
        'Giá bán ra (VNĐ)': actual || '',
        'Tiền chênh/Lãi (VNĐ)': profit,
        'Ngày trả tiền khách': item.payoutDate || '',
        'Số tiền đã trả khách': paid,
        'Tài khoản chi': item.payoutPaymentMethodName || '',
        'Ghi chú': item.note || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HangGuiBan');
    XLSX.writeFile(wb, `Hang_Khach_Gui_Ban_${getLocalYYYYMMDD()}.xlsx`);
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto flex flex-col gap-5 animate-fade-in text-slate-800 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-100 shrink-0">
            <Handshake size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Khách Gởi Bán
              </h1>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                Hàng Ký Gửi
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Nhận hàng khách gửi bán, cập nhật ngày và giá bán ra, thanh toán trả lại tiền cho khách
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition-colors shadow-sm"
            title="Xuất file Excel"
          >
            <FileSpreadsheet size={16} />
            <span>Xuất Excel</span>
          </button>

          <button
            onClick={() => {
              setEditingItem(null);
              setIsAddEditModalOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-bold text-xs shadow-md shadow-primary/20 hover:shadow-lg transition-all active:scale-95"
          >
            <Plus size={18} />
            <span>+ Nhận Hàng Gửi Bán</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Đang gửi bán */}
        <div className="bg-white rounded-2xl p-4 border border-purple-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">
              Đang gửi bán
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Layers size={18} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-purple-900 tracking-tight">
              {stats.receivingCount}{' '}
              <span className="text-xs font-semibold text-slate-500">món</span>
            </div>
            <div className="text-xs font-bold text-slate-500 mt-0.5">
              Trị giá: <span className="text-purple-700 font-black">{formatNumber(stats.receivingValue)} ₫</span>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-full -mr-4 -mt-4 pointer-events-none" />
        </div>

        {/* Đã bán - Chờ trả tiền khách */}
        <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
              Đã bán - Chờ trả tiền
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Banknote size={18} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-amber-900 tracking-tight">
              {stats.soldPendingPayoutCount}{' '}
              <span className="text-xs font-semibold text-slate-500">món</span>
            </div>
            <div className="text-xs font-bold text-slate-500 mt-0.5">
              Cần trả khách: <span className="text-amber-700 font-black">{formatNumber(stats.soldPendingPayoutValue)} ₫</span>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full -mr-4 -mt-4 pointer-events-none" />
        </div>

        {/* Đã thanh toán xong */}
        <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
              Đã trả tiền khách
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-900 tracking-tight">
              {stats.paidCount}{' '}
              <span className="text-xs font-semibold text-slate-500">món</span>
            </div>
            <div className="text-xs font-bold text-slate-500 mt-0.5">
              Đã trả: <span className="text-emerald-700 font-black">{formatNumber(stats.paidTotal)} ₫</span>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full -mr-4 -mt-4 pointer-events-none" />
        </div>

        {/* Hoa hồng / Chênh lệch thu được */}
        <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">
              Hoa hồng / Chênh lệch
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-blue-900 tracking-tight">
              {formatNumber(stats.totalCommissionEarned)}{' '}
              <span className="text-xs font-semibold text-slate-500">₫</span>
            </div>
            <div className="text-xs font-bold text-slate-500 mt-0.5">
              Tiền lời thu được từ hàng ký gửi
            </div>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full -mr-4 -mt-4 pointer-events-none" />
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3">
        {/* Status filter tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({items.length})
          </button>
          <button
            onClick={() => setStatusFilter('received')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === 'received'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
            Đang gửi bán ({stats.receivingCount})
          </button>
          <button
            onClick={() => setStatusFilter('sold')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === 'sold'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Đã bán - Chờ trả tiền ({stats.soldPendingPayoutCount})
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === 'paid'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Đã thanh toán ({stats.paidCount})
          </button>
          <button
            onClick={() => setStatusFilter('returned')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === 'returned'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            Đã trả lại ({items.filter((i) => i.status === 'returned').length})
          </button>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Tìm theo tên món hàng, khách gửi, số điện thoại, mã phiếu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="sm:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white cursor-pointer"
            >
              <option value="all">-- Tất cả loại hàng --</option>
              {CONSIGNMENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-4 flex items-center gap-1.5">
            <input
              type="date"
              value={dateFilterStart}
              onChange={(e) => setDateFilterStart(e.target.value)}
              className="w-1/2 py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
              title="Từ ngày nhận"
            />
            <span className="text-slate-400 text-xs font-bold">-</span>
            <input
              type="date"
              value={dateFilterEnd}
              onChange={(e) => setDateFilterEnd(e.target.value)}
              className="w-1/2 py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
              title="Đến ngày nhận"
            />
            {(dateFilterStart || dateFilterEnd) && (
              <button
                onClick={() => {
                  setDateFilterStart('');
                  setDateFilterEnd('');
                }}
                className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100"
                title="Xóa lọc ngày"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Copied toast */}
      {copiedText && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 z-50 animate-bounce">
          <CheckCheck size={16} className="text-emerald-400" />
          <span>Đã sao chép {copiedText}!</span>
        </div>
      )}

      {/* List content */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
          <span className="text-xs font-bold">Đang tải danh sách hàng khách gửi bán...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <Handshake size={32} />
          </div>
          <h3 className="text-sm font-bold text-slate-700">Chưa có món hàng gửi bán nào</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
              ? 'Không tìm thấy kết quả phù hợp với bộ lọc hiện tại.'
              : 'Bấm nút "+ Nhận Hàng Gửi Bán" ở góc trên để tạo biên nhận nhận hàng ký gửi của khách.'}
          </p>
          {(searchTerm || statusFilter !== 'all' || categoryFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setCategoryFilter('all');
                setDateFilterStart('');
                setDateFilterEnd('');
              }}
              className="mt-3 text-xs font-bold text-primary hover:underline"
            >
              Đặt lại tất cả bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const hasImages = item.images && item.images.length > 0;
            const ask = Number(item.askingPrice) || 0;
            const actual = Number(item.actualSellingPrice) || 0;
            const paid = Number(item.payoutAmount) || 0;
            const remainingToPay = Math.max(0, ask - paid);
            const profit = actual > 0 ? actual - ask : 0;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Card Top: Image thumbnail + Basic Info */}
                <div className="p-4 flex flex-col gap-3">
                  {/* Header Row: Code + Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                        {item.code || `#${item.id.substring(0, 6).toUpperCase()}`}
                      </span>
                      {item.category && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {item.category}
                        </span>
                      )}
                    </div>

                    {/* Status Badge */}
                    {item.status === 'received' && (
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                        Đang gửi bán
                      </span>
                    )}
                    {item.status === 'sold' && (
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Đã bán (Chờ trả tiền)
                      </span>
                    )}
                    {item.status === 'paid' && (
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-emerald-600" />
                        Đã thanh toán xong
                      </span>
                    )}
                    {item.status === 'returned' && (
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                        <RotateCcw size={12} />
                        Đã trả lại hàng
                      </span>
                    )}
                  </div>

                  {/* Product title & thumbnail */}
                  <div className="flex gap-3 items-start">
                    {/* Thumbnail preview */}
                    <div
                      onClick={() => {
                        setViewingImageConsignmentId(item.id);
                        setViewingImageInitialIdx(0);
                      }}
                      className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden relative cursor-pointer group hover:opacity-90 transition-opacity"
                      title={hasImages ? `Xem ${item.images?.length} ảnh` : 'Chụp / Thêm ảnh'}
                    >
                      {hasImages ? (
                        <>
                          <img
                            src={item.images![0]}
                            alt={item.productName}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                            <Eye size={18} />
                          </div>
                          {item.images!.length > 1 && (
                            <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-md">
                              +{item.images!.length - 1}
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 text-[10px] font-semibold gap-0.5">
                          <Camera size={18} />
                          <span>+ Thêm ảnh</span>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black text-slate-900 leading-snug line-clamp-2">
                        {item.productName}
                      </h3>
                      {item.condition && (
                        <div className="text-[11px] font-semibold text-slate-500 mt-0.5 flex items-center gap-1">
                          <Tag size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{item.condition}</span>
                        </div>
                      )}
                      <div className="text-[11px] font-semibold text-slate-500 mt-0.5 flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400 shrink-0" />
                        <span>Nhận ngày: {item.receivedDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Box */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <UserIcon size={13} className="text-primary shrink-0" />
                        <span className="truncate">{item.customerName}</span>
                      </div>
                      {item.customerPhone && (
                        <a
                          href={`tel:${item.customerPhone}`}
                          className="flex items-center gap-1 text-blue-600 font-semibold hover:underline"
                        >
                          <Phone size={11} />
                          <span>{item.customerPhone}</span>
                        </a>
                      )}
                    </div>

                    {item.customerBankDetails && (
                      <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium pt-1 border-t border-slate-200/60 mt-0.5">
                        <div className="flex items-center gap-1 truncate">
                          <CreditCard size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate" title={item.customerBankDetails}>
                            {item.customerBankDetails}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopy(item.customerBankDetails!, 'STK Ngân hàng')}
                          className="p-1 text-slate-400 hover:text-primary rounded"
                          title="Sao chép STK"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Pricing Details Box */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2 rounded-xl bg-purple-50/60 border border-purple-100 flex flex-col">
                      <span className="text-[10px] font-bold text-purple-700 uppercase">
                        Giá gửi bán (Trả khách)
                      </span>
                      <span className="text-base font-black text-purple-900 mt-0.5">
                        {formatNumber(ask)} ₫
                      </span>
                      {item.expectedSellingPrice && (
                        <span className="text-[10px] text-slate-500 font-semibold">
                          Dự kiến bán: {formatNumber(item.expectedSellingPrice)} ₫
                        </span>
                      )}
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        {item.status === 'sold' || item.status === 'paid' ? 'Đã bán ra' : 'Giá bán ra'}
                      </span>
                      {actual > 0 ? (
                        <>
                          <span className="text-base font-black text-slate-900 mt-0.5">
                            {formatNumber(actual)} ₫
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600">
                            Lời: +{formatNumber(profit)} ₫
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400 mt-1 italic">
                          Chưa bán ra
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Payout status detail when sold or paid */}
                  {(item.status === 'sold' || item.status === 'paid') && (
                    <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-100 text-[11px] flex flex-col gap-0.5">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-emerald-800">
                          {item.status === 'paid' ? 'Đã thanh toán cho khách:' : 'Đã trả trước:'}
                        </span>
                        <span className="text-emerald-900 font-black">
                          {formatNumber(paid)} / {formatNumber(ask)} ₫
                        </span>
                      </div>
                      {item.status === 'sold' && remainingToPay > 0 && (
                        <div className="flex items-center justify-between text-amber-800 font-bold">
                          <span>Còn nợ khách:</span>
                          <span className="font-black text-amber-900">{formatNumber(remainingToPay)} ₫</span>
                        </div>
                      )}
                      {item.payoutDate && (
                        <div className="text-[10px] text-slate-500">
                          Ngày trả: {item.payoutDate} {item.payoutPaymentMethodName ? `(${item.payoutPaymentMethodName})` : ''}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Note if any */}
                  {item.note && (
                    <div className="text-[11px] text-slate-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100/50">
                      📝 {item.note}
                    </div>
                  )}
                </div>

                {/* Card Bottom: Action Buttons */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    {/* View/Upload photos */}
                    <button
                      onClick={() => {
                        setViewingImageConsignmentId(item.id);
                        setViewingImageInitialIdx(0);
                      }}
                      className="p-1.5 text-slate-600 hover:text-primary bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                      title={hasImages ? `Xem ${item.images?.length} ảnh` : 'Chụp / Thêm ảnh'}
                    >
                      <Camera size={15} />
                    </button>

                    {/* Print receipt */}
                    <button
                      onClick={() => {
                        setItemToPrint(item);
                        setIsPrintModalOpen(true);
                      }}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                      title="In phiếu biên nhận gửi bán"
                    >
                      <Printer size={15} />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setIsAddEditModalOpen(true);
                      }}
                      className="p-1.5 text-slate-600 hover:text-amber-600 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                      title="Chỉnh sửa thông tin"
                    >
                      <Edit size={15} />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteItem(item)}
                      className="p-1.5 text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 rounded-lg border border-slate-200 transition-colors"
                      title="Xóa món hàng"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Primary flow buttons */}
                  <div className="flex items-center gap-1.5">
                    {item.status === 'received' && (
                      <>
                        <button
                          onClick={() => handleReturnItem(item)}
                          className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold transition-colors"
                          title="Khách lấy lại hàng không bán nữa"
                        >
                          Trả lại
                        </button>
                        <button
                          onClick={() => {
                            setItemToSell(item);
                            setIsSellModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-sm transition-all active:scale-95"
                        >
                          <Check size={14} />
                          <span>Đã Bán Ra</span>
                        </button>
                      </>
                    )}

                    {item.status === 'sold' && (
                      <>
                        <button
                          onClick={() => handleReopenItem(item)}
                          className="px-2 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800"
                          title="Hủy trạng thái đã bán"
                        >
                          Hủy bán
                        </button>
                        <button
                          onClick={() => {
                            setItemToPayout(item);
                            setIsPayoutModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition-all active:scale-95"
                        >
                          <DollarSign size={14} />
                          <span>Trả Tiền Khách</span>
                        </button>
                      </>
                    )}

                    {item.status === 'paid' && (
                      <button
                        onClick={() => {
                          setItemToPayout(item);
                          setIsPayoutModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-colors"
                        title="Xem lịch sử trả tiền hoặc cập nhật thêm"
                      >
                        Lịch sử trả tiền
                      </button>
                    )}

                    {item.status === 'returned' && (
                      <button
                        onClick={() => handleReopenItem(item)}
                        className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold transition-colors"
                      >
                        Nhận lại hàng
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: NHẬN HÀNG GỬI BÁN (THÊM / SỬA) */}
      {isAddEditModalOpen && (
        <AddEditConsignmentModal
          isOpen={isAddEditModalOpen}
          onClose={() => {
            setIsAddEditModalOpen(false);
            setEditingItem(null);
          }}
          item={editingItem}
          customers={customers}
          user={user}
        />
      )}

      {/* MODAL 2: CẬP NHẬT BÁN HÀNG */}
      {isSellModalOpen && itemToSell && (
        <SellConsignmentModal
          isOpen={isSellModalOpen}
          onClose={() => {
            setIsSellModalOpen(false);
            setItemToSell(null);
          }}
          item={itemToSell}
        />
      )}

      {/* MODAL 3: TRẢ TIỀN CHO KHÁCH GỬI BÁN */}
      {isPayoutModalOpen && itemToPayout && (
        <PayoutConsignmentModal
          isOpen={isPayoutModalOpen}
          onClose={() => {
            setIsPayoutModalOpen(false);
            setItemToPayout(null);
          }}
          item={itemToPayout}
          paymentMethods={paymentMethods}
          user={user}
        />
      )}

      {/* MODAL 4: IN BIÊN NHẬN GỬI BÁN */}
      {isPrintModalOpen && itemToPrint && (
        <PrintConsignmentModal
          isOpen={isPrintModalOpen}
          onClose={() => {
            setIsPrintModalOpen(false);
            setItemToPrint(null);
          }}
          item={itemToPrint}
        />
      )}

      {/* FULLSCREEN PHOTO VIEWER MODAL */}
      <DeliveryImageViewerModal
        isOpen={!!viewingImageConsignmentId}
        onClose={() => setViewingImageConsignmentId(null)}
        images={items.find((i) => i.id === viewingImageConsignmentId)?.images || []}
        initialIndex={viewingImageInitialIdx}
        consignmentId={viewingImageConsignmentId || undefined}
        orderId={
          items.find((i) => i.id === viewingImageConsignmentId)?.code ||
          viewingImageConsignmentId?.substring(0, 8).toUpperCase()
        }
        customerName={items.find((i) => i.id === viewingImageConsignmentId)?.customerName}
        partnerLabel="Khách gửi bán"
      />
    </div>
  );
};

// ==========================================
// SUB-MODAL 1: THÊM / SỬA HÀNG GỬI BÁN
// ==========================================
interface AddEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ConsignmentItem | null;
  customers: Customer[];
  user?: User | null;
}

const AddEditConsignmentModal: React.FC<AddEditModalProps> = ({
  isOpen,
  onClose,
  item,
  customers,
  user
}) => {
  const [productName, setProductName] = useState(item?.productName || '');
  const [category, setCategory] = useState(item?.category || CONSIGNMENT_CATEGORIES[0]);
  const [condition, setCondition] = useState(item?.condition || CONSIGNMENT_CONDITIONS[1]);
  const [receivedDate, setReceivedDate] = useState(item?.receivedDate || getLocalYYYYMMDD());
  const [askingPrice, setAskingPrice] = useState<number>(item?.askingPrice || 0);
  const [expectedSellingPrice, setExpectedSellingPrice] = useState<number>(item?.expectedSellingPrice || 0);

  // Customer info
  const [customerId, setCustomerId] = useState(item?.customerId || '');
  const [customerName, setCustomerName] = useState(item?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(item?.customerPhone || '');
  const [customerBankDetails, setCustomerBankDetails] = useState(item?.customerBankDetails || '');
  const [note, setNote] = useState(item?.note || '');

  // Images state
  const [images, setImages] = useState<string[]>(item?.images || []);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Customer dropdown
  const [custSearch, setCustSearch] = useState('');
  const [isCustDropdownOpen, setIsCustDropdownOpen] = useState(false);
  const custDropdownRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (custDropdownRef.current && !custDropdownRef.current.contains(e.target as Node)) {
        setIsCustDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!custSearch.trim()) return customers.slice(0, 15);
    return filterAndSortCustomers(customers, custSearch, 15);
  }, [customers, custSearch]);

  const handleSelectCustomer = (c: Customer) => {
    setCustomerId(c.id);
    setCustomerName(c.name);
    setCustomerPhone(c.phone || '');
    if ((c as any).bankDetails) {
      setCustomerBankDetails((c as any).bankDetails);
    }
    setIsCustDropdownOpen(false);
  };

  // Image Upload handler
  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsCompressing(true);
    try {
      const compressed = await compressMultipleImagesWithStats(files);
      const dataUrls = compressed.images || [];
      setImages((prev) => [...prev, ...dataUrls]);
    } catch (err: any) {
      console.error('Lỗi nén ảnh:', err);
      alert('Không thể tải ảnh lên: ' + err.message);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemoveImage = (idxToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      alert('Vui lòng nhập tên mặt hàng gửi bán.');
      return;
    }
    if (!customerName.trim()) {
      alert('Vui lòng nhập tên khách hàng gửi bán.');
      return;
    }
    if (askingPrice <= 0) {
      alert('Vui lòng nhập giá gửi bán (số tiền cần trả lại khách).');
      return;
    }

    setIsSaving(true);
    try {
      if (item) {
        // Update existing
        await updateDoc(doc(db, 'consignments', item.id), {
          productName: productName.trim(),
          category,
          condition,
          receivedDate,
          askingPrice,
          expectedSellingPrice: expectedSellingPrice || null,
          customerId: customerId || null,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerBankDetails: customerBankDetails.trim(),
          note: note.trim(),
          images,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new
        const randCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        const code = `#GB-${randCode}`;

        await addDoc(collection(db, 'consignments'), {
          code,
          productName: productName.trim(),
          category,
          condition,
          receivedDate,
          askingPrice,
          expectedSellingPrice: expectedSellingPrice || null,
          customerId: customerId || null,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerBankDetails: customerBankDetails.trim(),
          status: 'received',
          note: note.trim(),
          images,
          payoutAmount: 0,
          creatorName: user?.displayName || user?.email || 'Admin',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi lưu hàng gửi bán:', err);
      alert('Lỗi: ' + (err.message || 'Không thể lưu thông tin'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto border border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Handshake size={24} />
            <div>
              <h2 className="text-base sm:text-lg font-black">
                {item ? 'Chỉnh Sửa Hàng Gửi Bán' : 'Nhận Hàng Khách Gởi Bán'}
              </h2>
              <p className="text-xs text-purple-100">
                {item ? `Cập nhật thông tin phiếu ${item.code || item.id}` : 'Biên nhận tiếp nhận hàng ký gửi của khách'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4 text-xs font-semibold">
          {/* Section 1: Hàng hóa */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-3">
            <div className="text-[11px] font-black uppercase text-purple-700 tracking-wider flex items-center gap-1.5">
              <Package size={14} />
              <span>1. Thông tin mặt hàng gửi bán</span>
            </div>

            <div>
              <label className="block text-slate-700 mb-1 font-bold">
                Tên mặt hàng / Sản phẩm <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Cốt vợt Butterfly Viscaria FL, Mặt Dignics 05 đen..."
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Phân loại hàng</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                >
                  {CONSIGNMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">Tình trạng hàng</label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                >
                  {CONSIGNMENT_CONDITIONS.map((cond) => (
                    <option key={cond} value={cond}>
                      {cond}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Khách hàng gửi bán */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-3">
            <div className="text-[11px] font-black uppercase text-purple-700 tracking-wider flex items-center gap-1.5">
              <UserIcon size={14} />
              <span>2. Khách hàng gửi bán</span>
            </div>

            <div className="relative" ref={custDropdownRef}>
              <label className="block text-slate-700 mb-1 font-bold">
                Tên khách hàng <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Gõ tên khách (hoặc chọn từ danh sách)..."
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setCustSearch(e.target.value);
                  setIsCustDropdownOpen(true);
                }}
                onFocus={() => {
                  setCustSearch(customerName);
                  setIsCustDropdownOpen(true);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />

              {isCustDropdownOpen && filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-30 divide-y divide-slate-100">
                  {filteredCustomers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className="p-2.5 hover:bg-purple-50 cursor-pointer flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-slate-800">{c.name}</span>
                      <span className="text-[11px] text-slate-500 font-mono">{c.phone || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Số điện thoại liên hệ</label>
                <input
                  type="text"
                  placeholder="VD: 0987654321"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  Số tài khoản nhận tiền (STK & Ngân hàng)
                </label>
                <input
                  type="text"
                  placeholder="VD: 1903xxx - Techcombank - NGUYEN VAN A"
                  value={customerBankDetails}
                  onChange={(e) => setCustomerBankDetails(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Ngày & Giá gửi bán */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-3">
            <div className="text-[11px] font-black uppercase text-purple-700 tracking-wider flex items-center gap-1.5">
              <DollarSign size={14} />
              <span>3. Ngày nhận & Giá gửi bán</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Ngày nhận gửi</label>
                <input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  Giá khách gửi bán (VNĐ) <span className="text-red-500">*</span>
                </label>
                <NumericInput
                  value={askingPrice}
                  onChange={setAskingPrice}
                  placeholder="Số tiền cần trả khách..."
                  className="w-full px-3 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Tiền trả lại khách khi bán được
                </span>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  Giá niêm yết bán ra (VNĐ)
                </label>
                <NumericInput
                  value={expectedSellingPrice}
                  onChange={setExpectedSellingPrice}
                  placeholder="Giá dự kiến bán ra..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-900 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {expectedSellingPrice > askingPrice && (
                  <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">
                    Chênh lệch: +{formatNumber(expectedSellingPrice - askingPrice)} ₫
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-slate-700 mb-1 font-bold">Ghi chú thêm (tùy chọn)</label>
              <textarea
                rows={2}
                placeholder="VD: Khách gửi kèm hộp gốc, viền hơi móp 1 góc, bao test 3 ngày..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Section 4: Hình ảnh chụp / tải lên */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-black uppercase text-purple-700 tracking-wider flex items-center gap-1.5">
                <Camera size={14} />
                <span>4. Hình ảnh sản phẩm ({images.length} ảnh)</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={cameraInputRef}
                  className="hidden"
                  onChange={(e) => handleUploadFiles(e.target.files)}
                />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => handleUploadFiles(e.target.files)}
                />

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold text-xs transition-colors"
                >
                  <Camera size={14} />
                  <span>Chụp ảnh</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold text-xs transition-colors"
                >
                  <Plus size={14} />
                  <span>Chọn ảnh từ máy</span>
                </button>
              </div>
            </div>

            {isCompressing && (
              <div className="text-center py-3 text-xs text-purple-600 font-bold flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
                <span>Đang xử lý và nén ảnh siêu nhẹ...</span>
              </div>
            )}

            {images.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
                {images.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-xl bg-slate-200 overflow-hidden border border-slate-300 group shadow-2xs"
                  >
                    <img src={imgUrl} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                      title="Xóa ảnh này"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl bg-white/60">
                Chưa có hình ảnh nào. Bấm Chụp ảnh hoặc Chọn ảnh từ máy để lưu kèm phiếu gửi.
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-200 transition-all active:scale-95 disabled:opacity-50"
            >
              <Save size={16} />
              <span>{isSaving ? 'Đang lưu...' : item ? 'Lưu thay đổi' : 'Xác nhận nhận hàng'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// SUB-MODAL 2: CẬP NHẬT BÁN HÀNG
// ==========================================
interface SellModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ConsignmentItem;
}

const SellConsignmentModal: React.FC<SellModalProps> = ({ isOpen, onClose, item }) => {
  const [soldDate, setSoldDate] = useState(getLocalYYYYMMDD());
  const [actualSellingPrice, setActualSellingPrice] = useState<number>(
    item.actualSellingPrice || item.expectedSellingPrice || item.askingPrice
  );
  const [buyerName, setBuyerName] = useState(item.buyerName || '');
  const [soldNote, setSoldNote] = useState(item.soldNote || '');
  const [isSaving, setIsSaving] = useState(false);

  const ask = Number(item.askingPrice) || 0;
  const profit = actualSellingPrice - ask;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actualSellingPrice <= 0) {
      alert('Vui lòng nhập giá bán ra thực tế.');
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'consignments', item.id), {
        status: 'sold',
        soldDate,
        actualSellingPrice,
        buyerName: buyerName.trim(),
        soldNote: soldNote.trim(),
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi cập nhật bán hàng:', err);
      alert('Lỗi: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Check size={20} />
            <h2 className="text-base font-black">Cập Nhật Bán Hàng</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 text-white">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 text-xs font-semibold">
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex flex-col gap-1">
            <span className="text-[10px] font-bold text-purple-700 uppercase">Món hàng gửi bán</span>
            <span className="text-sm font-black text-slate-900">{item.productName}</span>
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className="text-slate-600">Khách gửi: <b>{item.customerName}</b></span>
              <span className="text-purple-800 font-black">Giá gửi: {formatNumber(ask)} ₫</span>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 mb-1 font-bold">Ngày bán hàng</label>
            <input
              type="date"
              value={soldDate}
              onChange={(e) => setSoldDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-1 font-bold">
              Giá bán ra thực tế (VNĐ) <span className="text-red-500">*</span>
            </label>
            <NumericInput
              value={actualSellingPrice}
              onChange={setActualSellingPrice}
              placeholder="Giá bán cho người mua..."
              className="w-full px-3 py-2 bg-white border border-purple-300 text-purple-900 rounded-xl text-base font-black focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
          </div>

          {/* Lợi nhuận / chênh lệch preview */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <span className="text-slate-600 font-bold">Tiền chênh / Lời thu được:</span>
            <span className={`text-base font-black ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {profit >= 0 ? `+${formatNumber(profit)} ₫` : `${formatNumber(profit)} ₫`}
            </span>
          </div>

          <div>
            <label className="block text-slate-700 mb-1 font-bold">Người mua / Khách mua (tùy chọn)</label>
            <input
              type="text"
              placeholder="VD: Anh Tuấn CLB, khách vãng lai..."
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-1 font-bold">Ghi chú bán hàng</label>
            <textarea
              rows={2}
              placeholder="Ghi chú chi tiết khi bán ra..."
              value={soldNote}
              onChange={(e) => setSoldNote(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black shadow-md transition-all active:scale-95"
            >
              {isSaving ? 'Đang lưu...' : 'Xác nhận đã bán'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// SUB-MODAL 3: TRẢ TIỀN CHO KHÁCH GỬI BÁN
// ==========================================
interface PayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ConsignmentItem;
  paymentMethods: PaymentMethod[];
  user?: User | null;
}

const PayoutConsignmentModal: React.FC<PayoutModalProps> = ({
  isOpen,
  onClose,
  item,
  paymentMethods,
  user
}) => {
  const ask = Number(item.askingPrice) || 0;
  const currentPaid = Number(item.payoutAmount) || 0;
  const remaining = Math.max(0, ask - currentPaid);

  const [payoutDate, setPayoutDate] = useState(getLocalYYYYMMDD());
  const [thisPayoutAmount, setThisPayoutAmount] = useState<number>(remaining || ask);
  const [paymentMethodId, setPaymentMethodId] = useState<string>(
    paymentMethods.length > 0 ? paymentMethods[0].id : ''
  );
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedMethod = paymentMethods.find((p) => p.id === paymentMethodId);

  const handleConfirmPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (thisPayoutAmount <= 0) {
      alert('Vui lòng nhập số tiền chi trả.');
      return;
    }

    setIsSaving(true);
    try {
      const newPaidTotal = currentPaid + thisPayoutAmount;
      const isFullyPaid = newPaidTotal >= ask;

      const payoutRecord = {
        id: `pay-${Date.now()}`,
        amount: thisPayoutAmount,
        date: payoutDate,
        paymentMethodId: paymentMethodId || null,
        paymentMethodName: selectedMethod?.name || 'Tiền mặt',
        note: note.trim() || 'Thanh toán tiền hàng gửi bán',
        creatorName: user?.displayName || user?.email || 'Admin',
        createdAt: new Date().toISOString()
      };

      const existingHistory = item.payoutHistory || [];

      await updateDoc(doc(db, 'consignments', item.id), {
        payoutAmount: newPaidTotal,
        payoutDate,
        payoutPaymentMethodId: paymentMethodId || null,
        payoutPaymentMethodName: selectedMethod?.name || 'Tiền mặt',
        payoutNote: note.trim(),
        payoutHistory: [...existingHistory, payoutRecord],
        status: isFullyPaid ? 'paid' : item.status,
        updatedAt: serverTimestamp()
      });

      onClose();
    } catch (err: any) {
      console.error('Lỗi khi trả tiền cho khách:', err);
      alert('Lỗi: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign size={20} />
            <h2 className="text-base font-black">Trả Tiền Cho Khách Gửi Bán</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 text-white">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleConfirmPayout} className="p-5 flex flex-col gap-4 text-xs font-semibold">
          {/* Customer & Item info */}
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Món hàng:</span>
              <span className="font-black text-slate-900">{item.productName}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Khách nhận tiền:</span>
              <span className="font-bold text-slate-900">
                {item.customerName} {item.customerPhone ? `(${item.customerPhone})` : ''}
              </span>
            </div>
            {item.customerBankDetails && (
              <div className="p-2 rounded-lg bg-white border border-emerald-200 text-[11px] text-emerald-900 font-bold flex items-center justify-between">
                <span>STK: {item.customerBankDetails}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(item.customerBankDetails!);
                    alert('Đã sao chép STK: ' + item.customerBankDetails);
                  }}
                  className="text-emerald-700 hover:text-emerald-900 underline text-[10px]"
                >
                  Sao chép
                </button>
              </div>
            )}
          </div>

          {/* Amount Overview */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-slate-500 block">Giá gửi</span>
              <span className="font-black text-slate-900">{formatNumber(ask)} ₫</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-slate-500 block">Đã trả trước</span>
              <span className="font-black text-emerald-600">{formatNumber(currentPaid)} ₫</span>
            </div>
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-100">
              <span className="text-[10px] text-amber-700 font-bold block">Còn nợ lại</span>
              <span className="font-black text-amber-800">{formatNumber(remaining)} ₫</span>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 mb-1 font-bold">Ngày trả tiền</label>
            <input
              type="date"
              value={payoutDate}
              onChange={(e) => setPayoutDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-1 font-bold">
              Số tiền chi trả lần này (VNĐ) <span className="text-red-500">*</span>
            </label>
            <NumericInput
              value={thisPayoutAmount}
              onChange={setThisPayoutAmount}
              placeholder="Nhập số tiền trả khách..."
              className="w-full px-3 py-2 bg-white border border-emerald-300 text-emerald-900 rounded-xl text-base font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-1 font-bold">Phương thức / Tài khoản chi</label>
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 mb-1 font-bold">Ghi chú chi trả</label>
            <input
              type="text"
              placeholder="VD: Chuyển khoản thành công, trả tiền mặt tại shop..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Lịch sử trả tiền nếu có */}
          {item.payoutHistory && item.payoutHistory.length > 0 && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px]">
              <span className="font-bold text-slate-700 block mb-1">Các lần trả trước:</span>
              <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                {item.payoutHistory.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-slate-600">
                    <span>
                      {h.date} - {h.paymentMethodName || 'Tiền mặt'}:
                    </span>
                    <span className="font-bold text-slate-900">{formatNumber(h.amount)} ₫</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md transition-all active:scale-95"
            >
              {isSaving ? 'Đang lưu...' : 'Xác nhận trả tiền'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// SUB-MODAL 4: IN BIÊN NHẬN GỬI BÁN
// ==========================================
interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ConsignmentItem;
}

const PrintConsignmentModal: React.FC<PrintModalProps> = ({ isOpen, onClose, item }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full flex flex-col overflow-hidden my-auto border border-slate-200">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center space-x-2">
            <Printer size={20} />
            <h2 className="text-base font-black">Biên Nhận Hàng Khách Gởi Bán</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-sm"
            >
              <Printer size={14} />
              <span>In ngay</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white/20 text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="p-6 sm:p-8 bg-white text-slate-900 text-xs flex flex-col gap-4 font-sans print:p-0 print:m-0">
          <div className="border-b border-slate-300 pb-3 text-center">
            <h1 className="text-lg font-black uppercase tracking-wider text-slate-900">
              GIẤY BIÊN NHẬN HÀNG GỬI BÁN
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Mã biên nhận: <b className="text-slate-900">{item.code || `#${item.id.substring(0, 8).toUpperCase()}`}</b> — Ngày nhận: <b>{item.receivedDate}</b>
            </p>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-3">
            <div>
              <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">
                Bên Nhận Gửi Bán (Cửa hàng)
              </span>
              <p className="font-bold text-slate-800">CỬA HÀNG BÓNG BÀN</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Người tiếp nhận: {item.creatorName || 'Cửa hàng'}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">
                Bên Gửi Bán (Khách hàng)
              </span>
              <p className="font-black text-slate-900">{item.customerName}</p>
              {item.customerPhone && (
                <p className="text-[11px] text-slate-600 mt-0.5">SĐT: {item.customerPhone}</p>
              )}
              {item.customerBankDetails && (
                <p className="text-[11px] text-slate-600 mt-0.5">STK: {item.customerBankDetails}</p>
              )}
            </div>
          </div>

          {/* Item details table */}
          <div>
            <span className="text-[10px] uppercase font-black text-slate-400 block mb-2">
              Chi tiết mặt hàng tiếp nhận
            </span>
            <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-700 font-bold text-[11px]">
                <tr>
                  <th className="p-2.5 border-b border-slate-200">Tên mặt hàng</th>
                  <th className="p-2.5 border-b border-slate-200">Phân loại</th>
                  <th className="p-2.5 border-b border-slate-200">Tình trạng</th>
                  <th className="p-2.5 border-b border-slate-200 text-right">Giá gửi bán</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2.5 font-black text-slate-900 border-b border-slate-100">
                    {item.productName}
                  </td>
                  <td className="p-2.5 text-slate-600 border-b border-slate-100">
                    {item.category || '-'}
                  </td>
                  <td className="p-2.5 text-slate-600 border-b border-slate-100">
                    {item.condition || '-'}
                  </td>
                  <td className="p-2.5 font-black text-right text-purple-900 border-b border-slate-100">
                    {formatNumber(item.askingPrice)} ₫
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {item.note && (
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
              <b>Ghi chú thỏa thuận:</b> {item.note}
            </div>
          )}

          {/* Terms */}
          <div className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-200 pt-3">
            <p>• Cửa hàng có trách nhiệm bảo quản nguyên vẹn tình trạng sản phẩm trong thời gian nhận gửi bán.</p>
            <p>• Khi sản phẩm được bán thành công, cửa hàng sẽ liên hệ và thanh toán số tiền gửi bán cho khách hàng.</p>
            <p>• Khách hàng có quyền nhận lại sản phẩm bất cứ lúc nào khi sản phẩm chưa được bán ra.</p>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 text-center pt-4 mt-2">
            <div>
              <p className="font-bold text-slate-700">ĐẠI DIỆN CỬA HÀNG</p>
              <p className="text-[10px] text-slate-400 italic">(Ký & ghi rõ họ tên)</p>
              <div className="h-16"></div>
            </div>
            <div>
              <p className="font-bold text-slate-700">KHÁCH HÀNG GỬI BÁN</p>
              <p className="text-[10px] text-slate-400 italic">(Ký & ghi rõ họ tên)</p>
              <div className="h-16"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsignmentManagement;
