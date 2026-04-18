
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, GoodsReceipt } from '../types';
import { Search, Loader, TrendingDown, TrendingUp, DollarSign, History, Award, AlertCircle } from 'lucide-react';
import { formatNumber } from '../utils/formatting';

interface PriceHistoryItem {
  receiptId: string;
  date: Date;
  supplierName: string;
  price: number;
  quantity: number;
}

interface SupplierStat {
  supplierName: string;
  lastPrice: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  importCount: number;
  lastImportDate: Date;
}

const PriceComparison: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Data analysis states
  const [history, setHistory] = useState<PriceHistoryItem[]>([]);
  const [stats, setStats] = useState<{min: number, max: number, avg: number} | null>(null);
  const [supplierStats, setSupplierStats] = useState<SupplierStat[]>([]);

  // 1. Fetch Products
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    });
    
    // Click outside to close dropdown
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
        unsubscribe();
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, []);

  // 2. Analyze Data when Product changes
  useEffect(() => {
    if (!selectedProductId) {
      setTimeout(() => {
        setHistory([]);
        setStats(null);
        setSupplierStats([]);
      }, 0);
      return;
    }

    setTimeout(() => {
      setAnalyzing(true);
    }, 0);

    // Fetch recent receipts
    const q = query(collection(db, "goodsReceipts"), orderBy("createdAt", "desc"), limit(500));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawHistory: PriceHistoryItem[] = [];
      const supplierMap = new Map<string, { 
        prices: number[], 
        lastDate: Date, 
        lastPrice: number 
      }>();

      snapshot.docs.forEach(doc => {
        const data = doc.data() as GoodsReceipt;
        // Find if this receipt contains the selected product
        const item = data.items.find(i => i.productId === selectedProductId);
        
        if (item && data.createdAt) {
          const date = data.createdAt.toDate();
          const price = item.importPrice;
          
          // Add to raw history
          rawHistory.push({
            receiptId: doc.id,
            date: date,
            supplierName: data.supplierName,
            price: price,
            quantity: item.quantity
          });

          // Group for Supplier Stats
          if (!supplierMap.has(data.supplierName)) {
            supplierMap.set(data.supplierName, { prices: [], lastDate: date, lastPrice: price });
          }
          
          const supEntry = supplierMap.get(data.supplierName)!;
          supEntry.prices.push(price);
          // Update last date/price if this receipt is newer
          if (date > supEntry.lastDate) {
            supEntry.lastDate = date;
            supEntry.lastPrice = price;
          }
        }
      });

      // Process Global Stats
      if (rawHistory.length > 0) {
        const prices = rawHistory.map(h => h.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const sum = prices.reduce((a, b) => a + b, 0);
        setStats({ min, max, avg: sum / prices.length });
      } else {
        setStats(null);
      }

      // Process Supplier Stats
      const processedSuppliers: SupplierStat[] = [];
      supplierMap.forEach((data, name) => {
        const prices = data.prices;
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        
        processedSuppliers.push({
          supplierName: name,
          lastPrice: data.lastPrice,
          avgPrice: avg,
          minPrice: min,
          maxPrice: max,
          importCount: prices.length,
          lastImportDate: data.lastDate
        });
      });

      // Sort suppliers by Lowest Average Price
      processedSuppliers.sort((a, b) => a.avgPrice - b.avgPrice);

      setHistory(rawHistory);
      setSupplierStats(processedSuppliers);
      setAnalyzing(false);
    });

    return () => unsubscribe();
  }, [selectedProductId]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10);
  }, [products, searchTerm]);

  const handleSelectProduct = (product: Product) => {
      setSelectedProductId(product.id);
      setSearchTerm(product.name);
      setIsDropdownOpen(false);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-dark mb-4 flex items-center">
          <DollarSign className="mr-2 text-primary" />
          Phân Tích & So Sánh Giá Nhập
        </h2>
        
        <div className="max-w-xl relative" ref={dropdownRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
            <input 
              type="text" 
              placeholder="Gõ tên sản phẩm để so sánh..." 
              value={searchTerm} 
              onChange={e => {
                  setSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                  if (!e.target.value) setSelectedProductId('');
              }}
              onFocus={() => setIsDropdownOpen(true)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400 shadow-sm"
            />
            
            {isDropdownOpen && searchTerm && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                        <div className="px-4 py-2 text-gray-500 text-sm">Không tìm thấy sản phẩm phù hợp</div>
                    ) : (
                        filteredProducts.map(p => (
                            <button
                                key={p.id}
                                onClick={() => handleSelectProduct(p)}
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-0 group"
                            >
                                <div className="font-medium text-gray-900">{p.name}</div>
                                <div className="text-xs text-gray-500 flex justify-between">
                                    <span>Giá bán: {formatNumber(p.sellingPrice)}</span>
                                    <span>Hãng: {p.manufacturerName}</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
      </div>

      {loading ? (
         <div className="flex justify-center items-center py-10"><Loader className="animate-spin text-primary" size={32}/></div>
      ) : !selectedProductId ? (
         <div className="flex flex-col items-center justify-center py-20 text-neutral bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <Search size={48} className="mb-4 text-slate-300" />
            <p className="text-lg font-medium">Vui lòng tìm và chọn sản phẩm để bắt đầu.</p>
            <p className="text-sm">Hệ thống sẽ phân tích lịch sử nhập hàng để tìm ra nhà cung cấp tốt nhất.</p>
         </div>
      ) : analyzing ? (
        <div className="flex justify-center items-center py-20"><Loader className="animate-spin text-primary" size={32}/></div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral">
            <AlertCircle size={48} className="mb-4 text-orange-300" />
            <p>Chưa có lịch sử nhập hàng nào cho sản phẩm này.</p>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* 1. Summary Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex items-center">
                <div className="bg-green-100 p-3 rounded-full mr-3 text-green-600">
                  <TrendingDown size={24} />
                </div>
                <div>
                  <p className="text-xs text-green-800 uppercase font-bold">Giá Nhập Thấp Nhất</p>
                  <p className="text-2xl font-bold text-green-700">{formatNumber(stats.min)} ₫</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center">
                <div className="bg-blue-100 p-3 rounded-full mr-3 text-blue-600">
                  <DollarSign size={24} />
                </div>
                <div>
                  <p className="text-xs text-blue-800 uppercase font-bold">Giá Nhập Trung Bình</p>
                  <p className="text-2xl font-bold text-blue-700">{formatNumber(Math.round(stats.avg))} ₫</p>
                </div>
              </div>
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center">
                <div className="bg-red-100 p-3 rounded-full mr-3 text-red-600">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <p className="text-xs text-red-800 uppercase font-bold">Giá Nhập Cao Nhất</p>
                  <p className="text-2xl font-bold text-red-700">{formatNumber(stats.max)} ₫</p>
                </div>
              </div>
            </div>
          )}

          {/* 2. Supplier Comparison Table */}
          <div>
             <h3 className="text-lg font-bold text-dark mb-3 flex items-center">
                <Award className="mr-2 text-orange-500" size={20}/>
                Xếp Hạng Nhà Cung Cấp (Theo Giá Trung Bình)
             </h3>
             <div className="overflow-x-auto border rounded-lg">
               <table className="w-full text-left">
                 <thead className="bg-slate-50 border-b border-slate-200">
                   <tr>
                     <th className="p-3 text-sm font-semibold text-neutral">Nhà Cung Cấp</th>
                     <th className="p-3 text-sm font-semibold text-neutral text-right">Giá Thấp Nhất</th>
                     <th className="p-3 text-sm font-semibold text-neutral text-right">Giá TB</th>
                     <th className="p-3 text-sm font-semibold text-neutral text-right">Giá Cao Nhất</th>
                     <th className="p-3 text-sm font-semibold text-neutral text-right">Giá Gần Nhất</th>
                     <th className="p-3 text-sm font-semibold text-neutral text-center">Số Lần Nhập</th>
                   </tr>
                 </thead>
                 <tbody>
                    {supplierStats.map((sup, idx) => {
                      return (
                        <tr key={idx} className={`border-b last:border-b-0 hover:bg-slate-50 ${idx === 0 ? 'bg-yellow-50' : ''}`}>
                          <td className="p-3 font-medium text-dark flex items-center">
                             {idx === 0 && <Award size={16} className="text-yellow-600 mr-2" />}
                             {sup.supplierName}
                          </td>
                          <td className="p-3 text-right text-green-600 font-medium">{formatNumber(sup.minPrice)} ₫</td>
                          <td className="p-3 text-right text-blue-600 font-bold">{formatNumber(Math.round(sup.avgPrice))} ₫</td>
                          <td className="p-3 text-right text-red-600 font-medium">{formatNumber(sup.maxPrice)} ₫</td>
                          <td className="p-3 text-right text-dark">
                             {formatNumber(sup.lastPrice)} ₫
                             <div className="text-[10px] text-neutral">{sup.lastImportDate.toLocaleDateString('vi-VN')}</div>
                          </td>
                          <td className="p-3 text-center text-neutral">{sup.importCount}</td>
                        </tr>
                      )
                    })}
                 </tbody>
               </table>
             </div>
          </div>

          {/* 3. Detailed History */}
          <div>
             <h3 className="text-lg font-bold text-dark mb-3 flex items-center">
                <History className="mr-2 text-blue-500" size={20}/>
                Lịch Sử Nhập Hàng Chi Tiết
             </h3>
             <div className="overflow-x-auto border rounded-lg max-h-80 overflow-y-auto">
               <table className="w-full text-left">
                 <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                   <tr>
                     <th className="p-3 text-sm font-semibold text-neutral">Ngày Nhập</th>
                     <th className="p-3 text-sm font-semibold text-neutral">Nhà Cung Cấp</th>
                     <th className="p-3 text-sm font-semibold text-neutral text-center">Số Lượng</th>
                     <th className="p-3 text-sm font-semibold text-neutral text-right">Giá Nhập</th>
                     <th className="p-3 text-sm font-semibold text-neutral text-right">Chênh Lệch (TB)</th>
                   </tr>
                 </thead>
                 <tbody>
                    {history.map((item, idx) => {
                      const diff = stats ? item.price - stats.avg : 0;
                      const diffPercent = stats ? (diff / stats.avg) * 100 : 0;
                      const isCheaper = diff < 0;
                      
                      return (
                        <tr key={idx} className="border-b last:border-b-0 hover:bg-slate-50">
                          <td className="p-3 text-sm text-neutral">{item.date.toLocaleDateString('vi-VN')}</td>
                          <td className="p-3 text-sm font-medium text-dark">{item.supplierName}</td>
                          <td className="p-3 text-sm text-center text-neutral">{item.quantity}</td>
                          <td className="p-3 text-sm text-right font-bold text-dark">{formatNumber(item.price)} ₫</td>
                          <td className="p-3 text-sm text-right">
                             <span className={`flex items-center justify-end ${isCheaper ? 'text-green-600' : 'text-red-600'}`}>
                                {Math.abs(diffPercent).toFixed(1)}% 
                                {isCheaper ? <TrendingDown size={14} className="ml-1"/> : <TrendingUp size={14} className="ml-1"/>}
                             </span>
                          </td>
                        </tr>
                      )
                    })}
                 </tbody>
               </table>
             </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default PriceComparison;
