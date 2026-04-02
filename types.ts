
import { Timestamp } from 'firebase/firestore';

export interface Product {
  id: string;
  name: string;
  importPrice: number;
  sellingPrice: number;
  warningThreshold: number;
  outsideStockWarningThreshold: number;
  manufacturerId: string;
  manufacturerName: string;
  isSuspended: boolean;
  isCombo: boolean;
  comboItems: ComboItem[];
  createdAt: Timestamp;
  stock?: number;
  invoicedStock?: number;
  totalInvoicedStock?: number;
}

export interface ComboItem {
  productId: string;
  productName: string;
  quantity: number;
}

export interface Manufacturer {
  id: string;
  name: string;
}

export type CustomerType = 'wholesale' | 'retail';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  debt: number;
  type: CustomerType;
  createdAt: Timestamp;
}

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  balance?: number;
}

export interface Shipper {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  createdAt: Timestamp;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  email?: string;
  createdAt: Timestamp;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  importPrice?: number;
  isCombo?: boolean;
  comboItems?: ComboItem[];
}

export interface CartItem extends SaleItem {
  stock: number;
  invoicedStock: number;
  originalImportPrice: number;
  originalSellingPrice: number;
  currentImportPrice: number;
  updateImportPrice: boolean;
  updateSellingPrice: boolean;
  importPrice: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  shippingFee: number;
  amountPaid: number;
  customerId: string;
  customerName: string;
  warehouseId: string;
  warehouseName: string;
  paymentMethodId?: string;
  paymentMethodName?: string;
  createdAt: Timestamp;
  isDebt: boolean;
  isSaved?: boolean;
  shipperId?: string;
  shipperName?: string;
  shippingStatus?: string;
  paymentHistory?: PaymentHistoryEntry[];
  hasReturn?: boolean;
  status?: string;
  issueInvoice?: boolean;
  note?: string;
  creatorName?: string;
  shippingPayer?: 'sender' | 'receiver' | 'customer' | 'shop';
  paidAt?: Timestamp;
}

export interface GoodsReceiptItem {
  productId: string;
  productName: string;
  quantity: number;
  importPrice: number;
  sellingPrice?: number;
  manufacturerId?: string;
  manufacturerName?: string;
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
  createdAt: Timestamp;
  paymentStatus: 'paid' | 'debt';
  amountPaid: number;
  paymentMethodId?: string;
  paymentMethodName?: string;
  paidAt?: Timestamp;
  hasInvoice?: boolean;
  creatorName?: string;
  paymentHistory?: PaymentHistoryEntry[];
}

export interface AlertProduct extends Product {
  // Additional fields for alerts if any
}

export interface SoldItemDetail extends SaleItem {
  saleId: string;
  createdAt: Timestamp;
  customerName: string;
}

export interface User {
  id: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'staff';
}

export interface Debt {
  id: string;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  amount: number;
  type: 'customer' | 'supplier';
  createdAt: Timestamp;
}

export type NoteStatus = 'pending' | 'completed' | 'cancelled' | 'khởi tạo' | 'đã xong' | 'Có vấn đề';

export interface Note {
  id: string;
  content: string;
  createdAt: Timestamp;
  status?: NoteStatus;
  creatorName?: string;
}

export interface Savings {
  id: string;
  amount: number;
  goal?: string;
  createdAt: Timestamp;
}

export interface Quotation {
  id: string;
  customerId: string;
  customerName: string;
  items: any[];
  total: number;
  createdAt: Timestamp;
}

export type PlannedOrderStatus = 'pending' | 'ordered' | 'received' | 'cancelled' | 'shipped' | 'received_full' | 'received_missing';

export interface PlannedOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  note?: string;
}

export interface PlannedOrder {
  id: string;
  items: PlannedOrderItem[];
  total: number;
  createdAt: Timestamp;
  supplierId?: string;
  supplierName?: string;
  status?: PlannedOrderStatus;
  note?: string;
  creatorName?: string;
}

export interface Shipment {
  id: string;
  name: string;
  createdAt: Timestamp;
}

export interface Shipping {
  id: string;
  saleId: string;
  shipperId: string;
  status: string;
  createdAt: Timestamp;
}

export type ChinaImportStatus = 'pending' | 'ordered' | 'received' | 'cancelled' | 'placed' | 'paid' | 'at_vn' | 'received_full' | 'received_missing' | 'shipping';

export interface ChinaImportItem {
  productId: string;
  productName: string;
  quantity: number;
  importPrice?: number;
  priceCNY: number;
  totalCNY: number;
  note?: string;
}

export interface ChinaImport {
  id: string;
  orderName: string;
  importDate: any; // Using any to support both string and Timestamp methods as seen in errors
  trackingNumber?: string;
  exchangeRate: number;
  shippingFeeCN: number;
  shippingFeeVN: number;
  shippingFeeExtra: number;
  currencyExchangeFee: number;
  totalCostCNY: number;
  totalCostVND: number;
  note?: string;
  status: ChinaImportStatus;
  paymentMethodId?: string;
  paymentMethodName?: string;
  items: ChinaImportItem[];
  createdAt: Timestamp;
}

export interface PaymentHistoryEntry {
  id?: string;
  amount: number;
  paymentMethodId?: string;
  paymentMethodName?: string;
  createdAt?: Timestamp;
  date?: any;
  note?: string;
}

export interface PaymentLog {
  id: string;
  amount: number;
  type: 'income' | 'expense' | 'deposit' | 'transfer_in' | 'withdraw';
  category: string;
  paymentMethodId: string;
  paymentMethodName: string;
  createdAt: Timestamp;
  note?: string;
  referenceId?: string;
  relatedId?: string;
  relatedType?: string;
  creatorName?: string;
  balanceAfter?: number;
}

export interface WarehouseTransfer {
  id: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  productId?: string;
  productName?: string;
  quantity?: number;
  items: {
    productId: string;
    productName: string;
    quantity: number;
  }[];
  createdAt: Timestamp;
  note?: string;
  creatorName?: string;
}

export interface SavingsBook {
  id: string;
  name: string;
  bankName?: string;
  amount?: number;
  balance: number;
  status?: string;
  depositDate?: any;
  maturityDate?: any;
  createdAt: Timestamp;
  note?: string;
}

export interface AppUser {
  id: string;
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'staff' | 'user';
  createdAt: Timestamp;
}
