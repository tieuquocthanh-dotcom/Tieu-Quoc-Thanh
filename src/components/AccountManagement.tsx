import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { CreditCard, Plus, Edit2, Trash2, Banknote, Landmark, X, CheckCircle, Loader, Search, DollarSign } from 'lucide-react';
import { formatNumber } from '../utils/formatting';
import { notifyError, notifySuccess } from '../utils/errorHandler';

interface Account {
  id: string;
  name: string;
  type: 'bank' | 'cash';
  bankName?: string;
  accountNumber?: string;
  balance: number;
  description?: string;
  createdAt: any;
  updatedAt: any;
}

const AccountManagement: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState<Partial<Account>>({
    name: '',
    type: 'bank',
    bankName: '',
    accountNumber: '',
    balance: 0,
    description: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'accounts'), orderBy('name')), (snapshot) => {
      setAccounts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filteredAccounts = accounts.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (a.bankName && a.bankName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (a.accountNumber && a.accountNumber.includes(searchTerm))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      notifyError("Vui lòng nhập tên tài khoản.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAccount) {
        await updateDoc(doc(db, 'accounts', editingAccount.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        notifySuccess("Cập nhật tài khoản thành công!");
      } else {
        await addDoc(collection(db, 'accounts'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        notifySuccess("Thêm tài khoản mới thành công!");
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      notifyError("Lỗi khi lưu thông tin tài khoản.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa tài khoản này?")) return;
    try {
      await deleteDoc(doc(db, 'accounts', id));
      notifySuccess("Đã xóa tài khoản.");
    } catch (err) {
      notifyError("Lỗi khi xóa tài khoản.");
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'bank',
      bankName: '',
      accountNumber: '',
      balance: 0,
      description: ''
    });
    setEditingAccount(null);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 p-6 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center">
            <Landmark className="mr-3 text-primary" size={32} />
            Quản Lý Tài Khoản
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">
            Quản lý dòng tiền & Tài khoản ngân hàng
          </p>
        </div>

        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="px-6 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center hover:bg-black transition-all shadow-xl active:scale-95"
        >
          <Plus size={18} className="mr-2" />
          Thêm Tài Khoản
        </button>
      </div>

      {/* Search */}
      <div className="mb-8 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Tìm kiếm tài khoản bằng tên, ngân hàng hoặc số tài khoản..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border-4 border-slate-800 rounded-3xl shadow-xl focus:ring-0 font-black text-slate-800 uppercase tracking-tight"
        />
      </div>

      {/* Account Grid */}
      <div className="flex-1 overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAccounts.map(account => (
            <div key={account.id} className="bg-white rounded-3xl border-4 border-slate-800 shadow-xl overflow-hidden group hover:scale-[1.02] transition-all duration-300">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${account.type === 'bank' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                    {account.type === 'bank' ? <Landmark size={24} /> : <Banknote size={24} />}
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => { setEditingAccount(account); setFormData(account); setShowModal(true); }}
                      className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(account.id)}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-1">{account.name}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                  {account.type === 'bank' ? `Ngân hàng: ${account.bankName}` : 'Tài khoản tiền mặt'}
                </p>
                
                <div className="bg-slate-50 p-4 rounded-2xl mb-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Số dư hiện tại</p>
                  <p className="text-2xl font-black text-slate-800">{formatNumber(account.balance)} ₫</p>
                </div>

                {account.type === 'bank' && account.accountNumber && (
                  <div className="flex items-center text-slate-500 text-xs font-bold mb-2">
                    <CreditCard size={14} className="mr-2 text-slate-400" /> {account.accountNumber}
                  </div>
                )}

                {account.description && (
                  <p className="text-xs text-slate-500 italic line-clamp-1">{account.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border-4 border-slate-800 shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest">
                {editingAccount ? 'Cập Nhật Tài Khoản' : 'Thêm Tài Khoản Mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8">
              <div className="space-y-6 mb-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Loại Tài Khoản</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'bank' })}
                      className={`py-3 rounded-xl font-black uppercase tracking-widest text-[10px] border-2 transition-all ${formData.type === 'bank' ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                    >
                      Ngân Hàng
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'cash' })}
                      className={`py-3 rounded-xl font-black uppercase tracking-widest text-[10px] border-2 transition-all ${formData.type === 'cash' ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                    >
                      Tiền Mặt
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên Tài Khoản *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                    placeholder="Ví dụ: Tài khoản chính, Quỹ tiền mặt..."
                  />
                </div>

                {formData.type === 'bank' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên Ngân Hàng</label>
                      <input
                        type="text"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                        placeholder="Vietcombank, Techcombank..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Số Tài Khoản</label>
                      <input
                        type="text"
                        value={formData.accountNumber}
                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Số Dư Ban Đầu</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: parseInt(e.target.value) || 0 })}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0"
                    />
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mô Tả</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-primary focus:ring-0 h-20 resize-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl flex items-center justify-center disabled:opacity-50"
              >
                {isSubmitting ? <Loader className="animate-spin mr-2" size={20} /> : <CheckCircle className="mr-2" size={20} />}
                {editingAccount ? 'Cập Nhật Tài Khoản' : 'Tạo Tài Khoản Mới'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManagement;
