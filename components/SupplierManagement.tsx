
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, getDocs, where, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Supplier } from '../types';
import { PlusCircle, Edit, Trash2, XCircle, Loader, Users, Search, RefreshCw, X, Plus } from 'lucide-react';
import { SupplierBankAccount } from '../types';
import Pagination from './Pagination';
import ConfirmationModal from './ConfirmationModal';

export const SupplierModal: React.FC<{
  supplier: Partial<Supplier> | null;
  onClose: () => void;
  onSave: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => void;
  existingNames: string[];
}> = ({ supplier, onClose, onSave, existingNames }) => {
  const [name, setName] = useState(supplier?.name || '');
  const [contactPerson, setContactPerson] = useState(supplier?.contactPerson || '');
  const [phone, setPhone] = useState(supplier?.phone || '');
  const [email, setEmail] = useState(supplier?.email || '');
  const [address, setAddress] = useState(supplier?.address || '');
  const [bankAccounts, setBankAccounts] = useState<SupplierBankAccount[]>(supplier?.bankAccounts || []);
  const [error, setError] = useState('');

  const inputClasses = "w-full px-3 py-2 bg-slate-100 text-dark border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none placeholder-slate-400";

  const handleAddBank = () => {
    setBankAccounts([...bankAccounts, { id: Date.now().toString(), bankName: '', accountNumber: '', accountName: '' }]);
  };

  const handleUpdateBank = (id: string, field: keyof SupplierBankAccount, value: string) => {
    setBankAccounts(bankAccounts.map(acc => acc.id === id ? { ...acc, [field]: value } : acc));
  };

  const handleRemoveBank = (id: string) => {
    setBankAccounts(bankAccounts.filter(acc => acc.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const isDuplicate = existingNames.some(
        existingName => existingName.toLowerCase() === name.trim().toLowerCase()
    );

    if (isDuplicate) {
        setError(`Nhà cung cấp với tên "${name.trim()}" đã tồn tại.`);
        return;
    }

    if (name && contactPerson) {
      onSave({ 
          name: name.trim(), 
          contactPerson, 
          phone, 
          email, 
          address,
          bankAccounts: bankAccounts.filter(acc => acc.bankName || acc.accountNumber || acc.accountName)
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border-4 border-slate-800">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{supplier?.id ? 'Chỉnh Sửa Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp Mới'}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24}/></button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Tên nhà cung cấp</label>
              <input type="text" value={name} onChange={e => { setName(e.target.value); setError(''); }} className={inputClasses} required />
              {error && <p className="text-red-500 text-xs mt-1 font-bold">{error}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Người liên lạc</label>
              <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className={inputClasses} required />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Số điện thoại</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputClasses} />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClasses} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Địa chỉ</label>
              <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className={inputClasses}></textarea>
            </div>
          </div>

          <div className="mt-6 border-t-2 border-slate-100 pt-4">
              <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-black uppercase text-slate-600">Tài khoản Ngân hàng</h3>
                  <button type="button" onClick={handleAddBank} className="flex items-center text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded">
                      <Plus size={14} className="mr-1"/> Thêm tài khoản
                  </button>
              </div>
              
              <div className="space-y-3">
                  {bankAccounts.map((acc, index) => (
                      <div key={acc.id} className="flex gap-2 items-start bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <div className="grid grid-cols-3 gap-2 flex-1">
                              <input 
                                  type="text" 
                                  placeholder="Ngân hàng (VD: VCB...)" 
                                  value={acc.bankName} 
                                  onChange={e => handleUpdateBank(acc.id, 'bankName', e.target.value)}
                                  className="px-2 py-1.5 text-sm bg-white border border-slate-300 rounded focus:ring-1 focus:ring-primary outline-none"
                              />
                              <input 
                                  type="text" 
                                  placeholder="Số tài khoản" 
                                  value={acc.accountNumber} 
                                  onChange={e => handleUpdateBank(acc.id, 'accountNumber', e.target.value)}
                                  className="px-2 py-1.5 text-sm bg-white border border-slate-300 rounded focus:ring-1 focus:ring-primary outline-none"
                              />
                              <input 
                                  type="text" 
                                  placeholder="Tên chủ tài khoản" 
                                  value={acc.accountName} 
                                  onChange={e => handleUpdateBank(acc.id, 'accountName', e.target.value)}
                                  className="px-2 py-1.5 text-sm bg-white border border-slate-300 rounded focus:ring-1 focus:ring-primary outline-none"
                              />
                          </div>
                          <button type="button" onClick={() => handleRemoveBank(acc.id)} className="text-red-500 hover:bg-red-100 p-1.5 rounded transition">
                              <Trash2 size={16}/>
                          </button>
                      </div>
                  ))}
                  {bankAccounts.length === 0 && (
                      <p className="text-[10px] text-slate-400 font-medium italic">Chưa có tài khoản ngân hàng nào. Bấm "Thêm tài khoản" để thêm mới.</p>
                  )}
              </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 pt-4 border-t-2 border-slate-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition font-black text-xs uppercase">Hủy</button>
            <button type="submit" className="px-5 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-black transition shadow-lg font-black text-xs uppercase flex items-center">
                {supplier?.id ? 'Lưu thay đổi' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SupplierManagement: React.FC = () => {
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "suppliers"), orderBy("name"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Supplier[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      setAllSuppliers(data);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching suppliers: ", err);
      setError("Không thể tải danh sách nhà cung cấp.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) {
      return allSuppliers;
    }
    const lowercasedFilter = searchTerm.toLowerCase();
    return allSuppliers.filter(supplier =>
      supplier.name.toLowerCase().includes(lowercasedFilter) ||
      supplier.contactPerson.toLowerCase().includes(lowercasedFilter) ||
      supplier.phone.toLowerCase().includes(lowercasedFilter) ||
      supplier.email.toLowerCase().includes(lowercasedFilter)
    );
  }, [allSuppliers, searchTerm]);
  
  const paginatedSuppliers = useMemo(() => {
      const startIndex = (currentPage - 1) * pageSize;
      return filteredSuppliers.slice(startIndex, startIndex + pageSize);
  }, [filteredSuppliers, currentPage, pageSize]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };
  
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const [isFixing, setIsFixing] = useState(false);

  const hasUnnamedSupplier = useMemo(() => {
    return allSuppliers.some(s => s.name === 'Nhà cung cấp không tên');
  }, [allSuppliers]);

  const handleDeepRename = async (supplierId: string, oldName: string, newName: string) => {
    const batch = writeBatch(db);
    
    // 1. Update Goods Receipts
    const receiptsSnap = await getDocs(query(collection(db, 'goodsReceipts'), where('supplierId', '==', supplierId)));
    receiptsSnap.forEach(d => {
        batch.update(d.ref, { supplierName: newName });
    });

    // 2. Update Planned Orders
    const plannedSnap = await getDocs(query(collection(db, 'plannedOrders'), where('supplierId', '==', supplierId)));
    plannedSnap.forEach(d => {
        batch.update(d.ref, { supplierName: newName });
    });

    // 3. Update China Imports
    const chinaSnap = await getDocs(query(collection(db, 'chinaImports'), where('supplierId', '==', supplierId)));
    chinaSnap.forEach(d => {
        batch.update(d.ref, { supplierName: newName });
    });

    // 4. Update Payment Logs (Optional but good)
    const logsSnap = await getDocs(query(collection(db, 'paymentLogs'), where('relatedType', '==', 'receipt')));
    logsSnap.forEach(d => {
        const data = d.data();
        if (data.note && data.note.includes(oldName)) {
            batch.update(d.ref, { note: data.note.replace(oldName, newName) });
        }
    });

    await batch.commit();
  };

  const handleFixUnnamedSupplier = async () => {
    const supplier = allSuppliers.find(s => s.name === 'Nhà cung cấp không tên');
    if (!supplier) return;

    setIsFixing(true);
    try {
        const newName = 'Vàng Bạc';
        const docRef = doc(db, 'suppliers', supplier.id);
        await updateDoc(docRef, { name: newName });
        await handleDeepRename(supplier.id, 'Nhà cung cấp không tên', newName);
        alert('Đã đổi tên "Nhà cung cấp không tên" thành "Vàng Bạc" và cập nhật toàn bộ dữ liệu liên quan!');
    } catch (err) {
        console.error(err);
        alert('Có lỗi xảy ra khi đổi tên.');
    } finally {
        setIsFixing(false);
    }
  };

  const handleSave = async (data: Omit<Supplier, 'id' | 'createdAt'>) => {
    const isDuplicate = allSuppliers.some(
        s => s.name.toLowerCase() === data.name.toLowerCase() && s.id !== editingSupplier?.id
    );
    if (isDuplicate) {
        alert(`Nhà cung cấp với tên "${data.name}" đã tồn tại.`);
        return;
    }

    try {
      if (editingSupplier?.id) {
        const oldName = editingSupplier.name;
        const docRef = doc(db, 'suppliers', editingSupplier.id);
        await updateDoc(docRef, data);
        
        if (oldName && oldName !== data.name) {
            await handleDeepRename(editingSupplier.id, oldName, data.name);
        }
      } else {
        await addDoc(collection(db, 'suppliers'), {
          ...data,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Error saving supplier: ", err);
      alert("Đã xảy ra lỗi khi lưu.");
    }
    setEditingSupplier(null);
    setIsModalOpen(false);
  };

  const openDeleteConfirmModal = (id: string, name: string) => {
    setSupplierToDelete({ id, name });
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!supplierToDelete) return;
    const { id, name } = supplierToDelete;

    try {
      await deleteDoc(doc(db, 'suppliers', id));
      alert(`Đã xóa nhà cung cấp "${name}" thành công!`);
    } catch (err: any) {
      console.error("LỖI CHI TIẾT KHI XÓA NCC: ", err);
      let errorMessage = "Đã xảy ra lỗi không xác định khi xóa.";
      if (err.code === 'permission-denied') {
          errorMessage = "Lỗi: Không có quyền xóa. Vui lòng kiểm tra lại Luật Bảo Mật (Security Rules) trên Firebase và đảm bảo bạn cho phép hành động 'delete'.";
      } else {
          errorMessage = `Đã xảy ra lỗi khi xóa "${name}". Mã lỗi: ${err.code || 'không rõ'}`;
      }
      alert(errorMessage);
    } finally {
        setSupplierToDelete(null);
    }
  };

  const openAddModal = () => {
    setEditingSupplier(null);
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  };

  const existingNamesForModal = useMemo(() => {
    return allSuppliers
      .filter(s => s.id !== editingSupplier?.id)
      .map(s => s.name);
  }, [allSuppliers, editingSupplier]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-dark">Quản Lý Nhà Cung Cấp</h1>
            {hasUnnamedSupplier && (
                <button 
                    onClick={handleFixUnnamedSupplier}
                    disabled={isFixing}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition border border-orange-200 text-xs font-bold"
                >
                    {isFixing ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    <span>Đổi "NCC không tên" thành "Vàng Bạc"</span>
                </button>
            )}
        </div>
        <div className="flex items-center space-x-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                <input
                    type="text"
                    placeholder="Tìm theo tên, người liên lạc..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64 pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
            </div>
            <button onClick={openAddModal} className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition shadow-lg shrink-0">
                <PlusCircle size={20} />
                <span>Thêm NCC</span>
            </button>
        </div>
      </div>

      {isModalOpen && <SupplierModal supplier={editingSupplier} onClose={() => setIsModalOpen(false)} onSave={handleSave} existingNames={existingNamesForModal} />}
      
       <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Xác nhận Xóa Nhà Cung Cấp"
        message={
          <>
            Bạn có thực sự muốn xóa nhà cung cấp <strong>"{supplierToDelete?.name}"</strong>?
            <br />
            Thao tác này không thể hoàn tác.
          </>
        }
      />

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center items-center"><Loader className="animate-spin text-primary" size={32} /></div>
        ) : error ? (
           <div className="p-10 flex flex-col justify-center items-center text-red-600">
             <XCircle size={32} className="mb-2"/>
             <p>{error}</p>
           </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="p-10 text-center text-neutral">
            <Users size={48} className="mx-auto mb-4 text-slate-300"/>
            <h3 className="text-xl font-semibold">
                {searchTerm ? 'Không tìm thấy kết quả' : 'Chưa có nhà cung cấp nào'}
            </h3>
            <p className="mt-1">
                {searchTerm ? 'Vui lòng thử từ khóa khác.' : 'Hãy nhấp vào nút "Thêm NCC" để bắt đầu.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 text-sm font-semibold text-neutral">Tên NCC</th>
                    <th className="p-4 text-sm font-semibold text-neutral">Người Liên Lạc</th>
                    <th className="p-4 text-sm font-semibold text-neutral">Điện Thoại</th>
                    <th className="p-4 text-sm font-semibold text-neutral">Email</th>
                    <th className="p-4 text-sm font-semibold text-neutral">Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSuppliers.map((item) => (
                    <tr key={item.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
                      <td className="p-4 font-medium text-dark">{item.name}</td>
                      <td className="p-4 text-neutral">{item.contactPerson}</td>
                      <td className="p-4 text-neutral">{item.phone}</td>
                      <td className="p-4 text-neutral">{item.email}</td>
                      <td className="p-4">
                        <div className="flex space-x-2">
                          <button onClick={() => openEditModal(item)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition"><Edit size={18} /></button>
                          <button onClick={() => openDeleteConfirmModal(item.id, item.name)} className="p-2 text-red-600 hover:bg-red-100 rounded-full transition"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={filteredSuppliers.length}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default SupplierManagement;
