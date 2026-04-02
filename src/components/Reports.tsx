
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Sale, Product, Customer } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, DollarSign, ShoppingBag, Users, Calendar, Filter, ArrowUpRight, ArrowDownRight, Package, PieChart as PieChartIcon } from 'lucide-react';
import { formatNumber } from '../utils/formatting';

const COLORS = ['#0f172a', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const Reports: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all'>('7days');

  useEffect(() => {
    const unsubSales = onSnapshot(query(collection(db, 'sales'), orderBy('createdAt', 'desc')), (snapshot) => {
      setSales(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Sale)));
    });

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });

    setLoading(false);
    return () => {
      unsubSales();
      unsubProducts();
      unsubCustomers();
    };
  }, []);

  const filteredSales = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return sales.filter(sale => {
      if (!sale.createdAt) return false;
      const saleDate = sale.createdAt instanceof Timestamp ? sale.createdAt.toDate() : new Date(sale.createdAt);
      
      if (dateRange === 'today') return saleDate >= startOfToday;
      if (dateRange === '7days') return saleDate >= sevenDaysAgo;
      if (dateRange === '30days') return saleDate >= thirtyDaysAgo;
      return true;
    });
  }, [sales, dateRange]);

  const stats = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const totalOrders = filteredSales.length;
    const totalProfit = filteredSales.reduce((sum, s) => {
      const saleCost = s.items.reduce((costSum, item) => costSum + (item.importPrice * item.quantity), 0);
      return sum + (s.total - s.shippingFee - saleCost);
    }, 0);
    
    return { totalRevenue, totalOrders, totalProfit };
  }, [filteredSales]);

  const chartData = useMemo(() => {
    const dailyData: { [key: string]: { date: string, revenue: number, profit: number } } = {};
    
    filteredSales.forEach(sale => {
      if (!sale.createdAt) return;
      const date = sale.createdAt instanceof Timestamp ? sale.createdAt.toDate() : new Date(sale.createdAt);
      const dateStr = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      
      const saleCost = sale.items.reduce((costSum, item) => costSum + (item.importPrice * item.quantity), 0);
      const profit = sale.total - sale.shippingFee - saleCost;

      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { date: dateStr, revenue: 0, profit: 0 };
      }
      dailyData[dateStr].revenue += sale.total;
      dailyData[dateStr].profit += profit;
    });

    return Object.values(dailyData).reverse();
  }, [filteredSales]);

  const topProducts = useMemo(() => {
    const productSales: { [key: string]: { name: string, quantity: number, revenue: number } } = {};
    
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { name: item.productName, quantity: 0, revenue: 0 };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].revenue += item.price * item.quantity;
      });
    });

    return Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredSales]);

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-full bg-slate-50 overflow-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center uppercase tracking-tight">
            <TrendingUp className="mr-3 text-blue-700" size={28} />
            Báo Cáo & Thống Kê
          </h1>
          <p className="text-slate-500 text-sm font-medium">Phân tích hiệu quả kinh doanh</p>
        </div>
        
        <div className="flex items-center space-x-2 bg-white p-1 rounded-lg shadow-sm border border-slate-200">
          {(['today', '7days', '30days', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${dateRange === range ? 'bg-blue-700 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {range === 'today' ? 'Hôm nay' : range === '7days' ? '7 Ngày' : range === '30days' ? '30 Ngày' : 'Tất cả'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-md text-blue-700">
              <DollarSign size={20} />
            </div>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Doanh thu</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{formatNumber(stats.totalRevenue)}</h3>
          <p className="text-slate-400 text-[10px] font-bold uppercase mt-1">Tổng tiền bán hàng</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-emerald-600">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-100 rounded-md text-emerald-700">
              <TrendingUp size={20} />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Lợi nhuận</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{formatNumber(stats.totalProfit)}</h3>
          <p className="text-slate-400 text-[10px] font-bold uppercase mt-1">Lợi nhuận ròng</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-amber-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-100 rounded-md text-amber-700">
              <ShoppingBag size={20} />
            </div>
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Đơn hàng</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{stats.totalOrders}</h3>
          <p className="text-slate-400 text-[10px] font-bold uppercase mt-1">Số lượng hóa đơn</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center">
            <Calendar className="mr-2 text-blue-700" size={18} />
            Biểu đồ doanh thu & lợi nhuận
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e40af" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#1e40af" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                  tickFormatter={(value) => `${value / 1000000}M`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  formatter={(value: number) => [formatNumber(value), '']}
                />
                <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#1e40af" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="profit" name="Lợi nhuận" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center">
            <Package className="mr-2 text-blue-700" size={18} />
            Sản phẩm bán chạy
          </h3>
          <div className="space-y-4">
            {topProducts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-300">
                <Package size={48} className="mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-[10px]">Chưa có dữ liệu</p>
              </div>
            ) : (
              topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-100">
                  <div className="flex items-center flex-1">
                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-md flex items-center justify-center font-bold text-xs mr-3 border border-blue-200">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 uppercase text-xs tracking-tight">{product.name}</p>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="bg-blue-700 h-full rounded-full" 
                          style={{ width: `${(product.revenue / (topProducts[0]?.revenue || 1)) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div className="ml-6 text-right">
                    <p className="font-bold text-slate-800 text-xs">{formatNumber(product.revenue)}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{product.quantity} SP</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Inventory Value */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center">
            <PieChartIcon className="mr-2 text-blue-700" size={18} />
            Giá trị tồn kho
          </h3>
          <div className="flex flex-col items-center">
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Giá trị vốn', value: products.reduce((sum, p) => sum + (p.importPrice * 10), 0) },
                      { name: 'Lợi nhuận dự kiến', value: products.reduce((sum, p) => sum + ((p.sellingPrice - p.importPrice) * 10), 0) }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#1e40af" />
                    <Cell fill="#3b82f6" />
                  </Pie>
                  <Tooltip formatter={(value: number) => formatNumber(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2 w-full">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-md border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tổng vốn tồn kho</span>
                <span className="font-bold text-slate-800">{formatNumber(products.reduce((sum, p) => sum + (p.importPrice * 10), 0))}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-md border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Giá trị bán ra</span>
                <span className="font-bold text-blue-700">{formatNumber(products.reduce((sum, p) => sum + (p.sellingPrice * 10), 0))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Customers */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md border border-slate-200 overflow-hidden">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6">Khách hàng thân thiết</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                  <th className="py-3 px-4">Khách hàng</th>
                  <th className="py-3 px-4 text-center">Đơn hàng</th>
                  <th className="py-3 px-4 text-right">Tổng chi tiêu</th>
                  <th className="py-3 px-4 text-right">Lần cuối</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.slice(0, 5).map((customer, index) => {
                  const customerSales = sales.filter(s => s.customerId === customer.id);
                  const totalSpent = customerSales.reduce((sum, s) => sum + s.total, 0);
                  return (
                    <tr key={index} className="hover:bg-slate-50 transition-all">
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-md flex items-center justify-center font-bold text-xs mr-3 border border-blue-200">
                            {customer.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 uppercase text-xs tracking-tight">{customer.name}</p>
                            <p className="text-[9px] text-slate-400 font-bold tracking-widest">{customer.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-600">{customerSales.length}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800">{formatNumber(totalSpent)}</td>
                      <td className="py-3 px-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {customerSales[0]?.createdAt instanceof Timestamp ? customerSales[0].createdAt.toDate().toLocaleDateString('vi-VN') : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
