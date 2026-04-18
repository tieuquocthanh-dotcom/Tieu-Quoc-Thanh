import { Timestamp } from "firebase/firestore";

export interface Product {
  id: string;
  name: string;
  manufacturerId: string;
  importPrice: number;
  sellingPrice: number;
  warningThreshold: number;
  outsideStockWarningThreshold?: number;
  totalInvoicedStock?: number;
  isCombo?: boolean;
  comboItems?: { productId: string; quantity: number }[];
  createdAt?: Timestamp;
}

export interface Warehouse {
  id: string;
  name: string;
}

export interface Manufacturer {
  id: string;
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  balance: number;
}

export interface GoodsReceipt {
  id: string;
  supplierId: string;
  supplierName?: string;
  warehouseId: string;
  warehouseName?: string;
  items: GoodsReceiptItem[];
  totalAmount: number;
  discount: number;
  finalAmount: number;
  amountPaid: number;
  paymentStatus: 'paid' | 'debt';
  paymentMethodId: string;
  paymentMethodName?: string;
  notes?: string;
  hasInvoice?: boolean;
  total?: number;
  productIds?: string[];
  paidAt?: Timestamp;
  paymentHistory?: any[];
  creatorName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GoodsReceiptItem {
  productId: string;
  productName: string;
  quantity: number;
  importPrice: number;
  totalPrice?: number;
  isCombo?: boolean;
}

export interface Sale {
  id: string;
  customerId: string;
  customerName?: string;
  warehouseId: string;
  warehouseName?: string;
  items: SaleItem[];
  totalAmount: number;
  discount: number;
  finalAmount: number;
  amountPaid: number;
  paymentStatus: 'paid' | 'debt';
  paymentMethodId: string;
  paymentMethodName?: string;
  shipperId?: string;
  shipperName?: string;
  shippingFee?: number;
  shippingStatus?: string;
  status?: string;
  issueInvoice?: boolean;
  total?: number;
  productIds?: string[];
  notes?: string;
  note?: string;
  creatorName?: string;
  paymentHistory?: any[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  importPrice: number;
  isCombo?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  type?: 'retail' | 'wholesale';
}

export interface Shipper {
  id: string;
  name: string;
  phone?: string;
}

export interface PaymentLog {
  id: string;
  paymentMethodId: string;
  amount: number;
  type: 'in' | 'out' | 'deposit' | 'withdraw' | 'transfer_in' | 'transfer_out' | 'sale' | 'receipt' | 'refund';
  referenceId: string;
  referenceType: 'sale' | 'receipt' | 'other' | 'transfer';
  createdAt: Timestamp;
  note?: string;
  relatedId?: string;
  relatedType?: string;
  creatorName?: string;
  balanceAfter?: number;
}

export interface PlannedOrder {
  id: string;
  orderName?: string;
  supplierId: string;
  supplierName: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
  }[];
  status: 'pending' | 'completed';
  createdAt: Timestamp;
}

export interface ChinaImport {
  id: string;
  orderName?: string;
  shippingFeeCN: number;
  exchangeRate: number;
  shippingFeeVN: number;
  shippingFeeExtra: number;
  currencyExchangeFee?: number;
  items: ChinaImportItem[];
  status: ChinaImportStatus;
  createdAt: Timestamp;
  importDate?: Timestamp;
  note?: string;
  totalCostCNY?: number;
  totalCostVND?: number;
}

export interface ChinaImportItem {
  productId: string;
  productName: string;
  quantity: number;
  priceCNY: number;
  totalCNY?: number;
}

export type ChinaImportStatus = 'ordered' | 'placed' | 'paid' | 'at_vn' | 'received_full' | 'received_missing';

export interface PaymentHistoryEntry {
  id: string;
  amount: number;
  paymentMethodId: string;
  paymentMethodName: string;
  createdAt: Timestamp;
  creatorName?: string;
  note?: string;
}
