
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product, Manufacturer } from '../types';
import { Package, Plus, Search, Edit2, Trash2, AlertTriangle, X, Save, Filter, ChevronRight, Layers } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import { notifyError, notifySuccess } from '../utils/errorHandler';

interface ProductManagementProps {
  userRole: 'admin' | 'staff' | null;
}

const ProductManagement: React.FC<ProductManagementProps> = ({ userRole }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [filterManufacturer, setFilterManufacturer] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    importPrice: 0,
    sellingPrice: 0,
    warningThreshold: 5,
    manufacturerId: '',
    unit: '',
    isCombo: false,
    isSuspended: false
  });

  useEffect(() => {
    const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snapshot) => {
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    });

    const unsubManufacturers = onSnapshot(query(collection(db, 'manufacturers'), orderBy('name')), (snapshot) => {
      setManufacturers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Manufacturer)));
    });

    return () => {
      unsubProducts();
      unsubManufacturers();
    };
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesManufacturer = filterManufacturer === 'all' || p.manufacturerId === filterManufacturer;
      return matchesSearch && matchesManufacturer;
    });
  }, [products, searchTerm, filterManufacturer]);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        importPrice: product.importPrice,
        sellingPrice: product.sellingPrice,
        warningThreshold: product.warningThreshold,
        manufacturerId: product.manufacturerId,
        unit: product.unit || '',
        isCombo: product.isCombo || false,
        isSuspended: product.isSuspended || false
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        importPrice: 0,
        sellingPrice: 0,
        warningThreshold: 5,
        manufacturerId: manufacturers[0]?.id || '',
        unit: '',
        isCombo: false,
        isSuspended: false
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.manufacturerId) {
      notifyError("Vui lòng điền đầy đủ thông tin bắt buộc.");
      return;
    }

    const manufacturer = manufacturers.find(m => m.id === formData.manufacturerId);
    const productData = {
      ...formData,
      manufacturerName: manufacturer?.name || '',
      updatedAt: serverTimestamp()
    };

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        notifySuccess("Cập nhật sản phẩm thành công!");
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: serverTimestamp()
        });
        notifySuccess("Thêm sản phẩm mới thành công!");
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving product:", err);
      notifyError("Có lỗi xảy ra khi lưu sản phẩm.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này?")) {
      try {
        await deleteDoc(doc(db, 'products', id));
        notifySuccess("Đã xóa sản phẩm.");
      } catch (err) {
        notifyError("Không thể xóa sản phẩm.");
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center uppercase tracking-tight">
            <Package className="mr-3 text-blue-700" size={28} />
            Quản Lý Sản Phẩm
          </h1>
          <p className="text-slate-500 text-sm font-medium">Danh mục hàng hóa trong kho hệ thống</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn-primary flex items-center shadow-md"
        >
          <Plus size={18} className="mr-2" />
          THÊM SẢN PHẨM
        </button>
      </div>

      <div className="card-traditional overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Tìm kiếm tên sản phẩm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-traditional pl-10"
            />
          </div>
          <div className="flex items-center">
            <select
              value={filterManufacturer}
              onChange={(e) => setFilterManufacturer(e.target.value)}
              className="input-traditional min-w-[200px]"
            >
              <option value="all">Tất cả hãng</option>
              {manufacturers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table-traditional">
            <thead>
              <tr>
                <th>Sản Phẩm</th>
                <th>Hãng</th>
                <th className="text-right">Giá Nhập</th>
                <th className="text-right">Giá Bán</th>
                <th className="text-center">Trạng Thái</th>
                <th className="text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mx-auto mb-2"></div>
                    <p className="text-slate-500 font-bold text-xs uppercase">Đang tải...</p>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400 font-bold text-sm italic">
                    Không tìm thấy sản phẩm nào
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                    <td>
                      <div className="flex items-center">
                        <div className={`p-2 rounded mr-3 ${product.isCombo ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {product.isCombo ? <Layers size={16} /> : <Package size={16} />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{product.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">ID: {product.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="font-bold text-slate-600">
                        {product.manufacturerName}
                      </span>
                    </td>
                    <td className="text-right font-bold text-slate-600">{formatNumber(product.importPrice)} ₫</td>
                    <td className="text-right font-bold text-blue-700">{formatNumber(product.sellingPrice)} ₫</td>
                    <td className="text-center">
                      {product.isSuspended ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-bold uppercase">Ngừng KD</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-bold uppercase">Đang bán</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleOpenModal(product)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all"
                          title="Sửa"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all"
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center">
                  {editingProduct ? <Edit2 className="mr-3 text-blue-600" size={24} /> : <Plus className="mr-3 text-blue-600" size={24} />}
                  {editingProduct ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}
                </h2>
                <p className="text-slate-500 text-xs mt-1">Cập nhật thông tin chi tiết sản phẩm trong hệ thống</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Tên Sản Phẩm *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium text-slate-800 transition-all outline-none"
                    placeholder="Nhập tên sản phẩm..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Hãng Sản Xuất *</label>
                  <select
                    required
                    value={formData.manufacturerId}
                    onChange={(e) => setFormData({ ...formData, manufacturerId: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium text-slate-800 transition-all outline-none appearance-none"
                  >
                    <option value="">Chọn hãng...</option>
                    {manufacturers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Đơn Vị Tính</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium text-slate-800 transition-all outline-none"
                    placeholder="VD: Cái, Bộ, Thùng..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Định mức tồn kho</label>
                  <input
                    type="number"
                    value={formData.warningThreshold}
                    onChange={(e) => setFormData({ ...formData, warningThreshold: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium text-slate-800 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Giá Nhập (VNĐ)</label>
                  <input
                    type="number"
                    value={formData.importPrice}
                    onChange={(e) => setFormData({ ...formData, importPrice: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium text-slate-800 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Giá Bán (VNĐ)</label>
                  <input
                    type="number"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium text-slate-800 transition-all outline-none"
                  />
                </div>

                <div className="flex items-center space-x-8 py-2">
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={formData.isCombo}
                      onChange={(e) => setFormData({ ...formData, isCombo: e.target.checked })}
                      className="hidden"
                    />
                    <div className={`w-5 h-5 border rounded-lg flex items-center justify-center mr-3 transition-all ${formData.isCombo ? 'bg-blue-600 border-blue-600' : 'border-slate-300 group-hover:border-blue-500'}`}>
                      {formData.isCombo && <ChevronRight size={14} className="text-white" />}
                    </div>
                    <span className="text-sm font-medium text-slate-600">Sản phẩm Combo</span>
                  </label>

                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={formData.isSuspended}
                      onChange={(e) => setFormData({ ...formData, isSuspended: e.target.checked })}
                      className="hidden"
                    />
                    <div className={`w-5 h-5 border rounded-lg flex items-center justify-center mr-3 transition-all ${formData.isSuspended ? 'bg-red-500 border-red-500' : 'border-slate-300 group-hover:border-red-500'}`}>
                      {formData.isSuspended && <ChevronRight size={14} className="text-white" />}
                    </div>
                    <span className="text-sm font-medium text-slate-600">Ngừng kinh doanh</span>
                  </label>
                </div>
              </div>

              <div className="mt-10 flex space-x-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200 transition-all active:scale-95"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-200 flex items-center justify-center active:scale-95"
                >
                  <Save size={20} className="mr-2" />
                  Lưu Sản Phẩm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`
        @keyframes scale-in {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ProductManagement;
