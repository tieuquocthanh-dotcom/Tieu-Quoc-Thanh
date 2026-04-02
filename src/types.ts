
import { Timestamp } from "firebase/firestore";

export interface Manufacturer {
  id: string;
  name: string;
  createdAt: Timestamp;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  debt?: number;
  note?: string;
  createdAt: Timestamp;
}

export interface Warehouse {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  description?: string;
  createdAt: Timestamp;
}

export type CustomerType = 'retail' | 'wholesale';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  email: string;
  facebook?: string;
  zalo?: string;
  debt?: number;
  type: CustomerType;
  createdAt: Timestamp;
}

export interface Shipper {
    id: string;
    name: string;
    phone: string;
    address: string;
    createdAt: Timestamp;
}

export interface PaymentMethod {
    id: string;
    name: string;
    balance?: number;
    createdAt: Timestamp;
}

export interface PaymentLog {
    id: string;
    paymentMethodId: string;
    paymentMethodName: string;
    type: 'deposit' | 'withdraw' | 'transfer_in' | 'transfer_out';
    amount: number;
    balanceAfter?: number;
    relatedId?: string;
    relatedType?: 'sale' | 'receipt';
    debtorId?: string;
    debtorName?: string;
    note: string;
    createdAt: Timestamp;
    createdBy?: string;
    creatorName?: string;
}

export interface ComboItem {
    productId: string;
    productName: string;
    quantity: number;
}

export interface Product {
  id: string;
  name: string;
  importPrice: number;
  sellingPrice: number;
  warningThreshold: number;
  outsideStockWarningThreshold?: number;
  manufacturerId: string;
  manufacturerName: string;
  totalInvoicedStock?: number;
  unit?: string;
  createdAt: Timestamp;
  // Tính năng Combo
  isCombo?: boolean;
  comboItems?: ComboItem[];
  isSuspended?: boolean;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  importPrice?: number;
  unit?: string;
  isCombo?: boolean; // Lưu vết để biết lúc trừ kho
}

export interface PaymentHistoryEntry {
  date: Timestamp;
  amount: number;
  note?: string;
  paymentMethodId?: string;
  paymentMethodName?: string;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  discount?: number;
  shippingFee: number; // Phí vận chuyển
  amountPaid?: number;
  paymentHistory?: PaymentHistoryEntry[];
  customerId?: string;
  customerName?: string;
  warehouseId: string;
  warehouseName: string;
  paymentMethodId?: string;
  paymentMethodName?: string;
  shipperId?: string;
  shipperName?: string;
  status: 'paid' | 'debt';
  paidAt?: Timestamp;
  shippingStatus: 'none' | 'pending' | 'shipped' | 'order';
  shippingPayer?: 'shop' | 'customer';
  hasReturn?: boolean;
  issueInvoice?: boolean;
  isSaved?: boolean;
  shippedAt?: Timestamp;
  note?: string;
  createdAt: Timestamp;
  createdBy?: string;
  creatorName?: string;
}

export interface GoodsReceiptItem {
  productId: string;
  productName: string;
  quantity: number;
  importPrice: number;
  isCombo?: boolean;
}

export interface GoodsReceipt {
  id: string;
  items: GoodsReceiptItem[];
  total: number;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  paymentMethodId?: string;
  paymentMethodName?: string;
  paymentStatus: 'paid' | 'debt';
  hasInvoice: boolean;
  createdAt: Timestamp;
  paidAt?: Timestamp;
  invoiceReceivedAt?: Timestamp;
  amountPaid?: number;
  paymentHistory?: PaymentHistoryEntry[];
  createdBy?: string;
  creatorName?: string;
}

export interface WarehouseTransfer {
  id: string;
  productId: string;
  productName: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  quantity: number;
  createdAt: Timestamp;
  createdBy?: string;
  creatorName?: string;
}

export interface AppUser {
  id: string;
  email: string;
  username?: string;
  displayName: string;
  role: 'admin' | 'staff';
  createdAt: Timestamp;
}

export interface ChinaImportItem {
    productId: string;
    productName: string;
    quantity: number;
    priceCNY: number;
    totalCNY: number;
}

export type ChinaImportStatus = 'ordered' | 'placed' | 'paid' | 'at_vn' | 'received_full' | 'received_missing';

export interface ChinaImport {
    id: string;
    orderName?: string;
    importDate: Timestamp;
    items: ChinaImportItem[];
    exchangeRate: number;
    shippingFeeCN: number;
    shippingFeeVN: number;
    shippingFeeExtra: number;
    currencyExchangeFee?: number;
    totalCostCNY: number;
    totalCostVND: number;
    status?: ChinaImportStatus;
    note?: string;
    trackingNumber?: string;
    createdAt: Timestamp;
    paymentMethodId?: string;
    paymentMethodName?: string;
}

export interface PlannedOrderItem {
    productId: string;
    productName: string;
    quantity: number;
}

export type PlannedOrderStatus = 'pending' | 'ordered' | 'shipped' | 'received_full' | 'received_missing';

export interface PlannedOrder {
    id: string;
    supplierId: string;
    supplierName: string;
    items: PlannedOrderItem[];
    status?: PlannedOrderStatus;
    note?: string;
    createdAt: Timestamp;
    createdBy?: string;
    creatorName?: string;
}

export type NoteStatus = 'khởi tạo' | 'đã xong' | 'Có vấn đề';

export interface Note {
  id: string;
  content: string;
  status?: NoteStatus;
  createdAt: Timestamp;
  createdBy?: string;
  creatorName?: string;
}

export interface SavingsBook {
  id: string;
  amount: number;
  depositDate: Timestamp;
  maturityDate: Timestamp;
  bankName: string;
  note: string;
  status: 'active' | 'closed';
  createdAt: Timestamp;
  createdBy?: string;
  creatorName?: string;
}

export interface InventoryItem {
  productId: string;
  productName: string;
  quantity: number;
  warehouseId: string;
  warehouseName: string;
}
