import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, getDocs, where, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Customer } from '../types';
import { PlusCircle, Edit, Trash2, XCircle, Loader, Users, Search, Contact } from 'lucide-react';
import Pagination from './Pagination';
import ConfirmationModal from './ConfirmationModal';
import CustomerModal from './CustomerModal';

const CustomerManagement: React.FC = () => {
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "customers"), orderBy("name"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Customer[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setAllCustomers(data);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching customers: ", err);
      setError("Không thể tải danh sách khách hàng.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) {
      return allCustomers;
    }
    const lowercasedFilter = searchTerm.toLowerCase();
    return allCustomers.filter(customer =>
      (customer.name && customer.name.toLowerCase().includes(lowercasedFilter)) ||
      (customer.phone && customer.phone.toLowerCase().includes(lowercasedFilter)) ||
      (customer.address && customer.address.toLowerCase().includes(lowercasedFilter))
    );
  }, [allCustomers, searchTerm]);
  
  const paginatedCustomers = useMemo(() => {
      const startIndex = (currentPage - 1) * pageSize;
      return filteredCustomers.slice(startIndex, startIndex + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };
  
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const handleDeepRename = async (customerId: string, oldName: string, newName: string) => {
    const batch = writeBatch(db);
    
    // Update Sales records
    const salesSnap = await getDocs(query(collection(db, 'sales'), where('customerId', '==', customerId)));
    salesSnap.forEach(d => {
        batch.update(d.ref, { customerName: newName });
    });

    await batch.commit();
  };

  const handleSave = async (data: Omit<Customer, 'id' | 'createdAt'>) => {
    const isDuplicate = allCustomers.some(
        c => c.name.toLowerCase() === data.name.toLowerCase() && c.id !== editingCustomer?.id
    );

    if (isDuplicate) {
        alert(`Khách hàng với tên "${data.name}" đã tồn tại.`);
        return;
    }

    try {
      if (editingCustomer?.id) {
        const oldName = editingCustomer.name;
        const docRef = doc(db, 'customers', editingCustomer.id);
        await updateDoc(docRef, data);
        
        if (oldName && oldName !== data.name) {
            await handleDeepRename(editingCustomer.id, oldName, data.name);
        }
      } else {
        await addDoc(collection(db, 'customers'), {
          ...data,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Error saving customer: ", err);
      alert("Đã xảy ra lỗi khi lưu.");
    }
    setEditingCustomer(null);
    setIsModalOpen(false);
  };

  const openDeleteConfirmModal = (id: string, name: string) => {
    setCustomerToDelete({ id, name });
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    const { id, name } = customerToDelete;

    try {
      await deleteDoc(doc(db, 'customers', id));
    } catch (err: any) {
      console.error("LỖI CHI TIẾT KHI XÓA KH: ", err);
      alert("Đã xảy ra lỗi khi xóa.");
    } finally {
        setCustomerToDelete(null);
        setIsConfirmModalOpen(false);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-dark mb-2 flex items-center">
               <Contact className="mr-3 text-primary" size={28} />
               Quản Lý Khách Hàng
            </h1>
            <p className="text-neutral text-sm">Quản lý thông tin liên hệ và lịch sử giao dịch khách hàng.</p>
          </div>
          <button
            onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition shadow"
          >
            <PlusCircle size={20} className="mr-2" />
            Thêm Khách Hàng
          </button>
        </div>

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}

        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Tìm kiếm khách hàng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center h-64"><Loader className="animate-spin text-primary" size={32} /></div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-12 text-neutral"><Contact size={48} className="mx-auto mb-4 text-slate-300" /><p className="text-lg font-medium text-slate-600">Không tìm thấy khách hàng nào</p></div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-neutral text-sm uppercase tracking-wider">
                    <th className="p-4 font-semibold border-b border-slate-200 w-1/3">Tên khách hàng</th>
                    <th className="p-4 font-semibold border-b border-slate-200 w-1/4">Số điện thoại</th>
                    <th className="p-4 font-semibold border-b border-slate-200 w-1/3">Địa chỉ</th>
                    <th className="p-4 font-semibold border-b border-slate-200 text-center w-32">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 text-dark font-medium">{customer.name}</td>
                      <td className="p-4 text-slate-600 font-mono">{customer.phone}</td>
                      <td className="p-4 text-slate-600">{customer.address}</td>
                      <td className="p-4">
                        <div className="flex justify-center space-x-2">
                          <button onClick={() => { setEditingCustomer(customer); setIsModalOpen(true); }} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition" title="Sửa"><Edit size={18} /></button>
                          <button onClick={() => openDeleteConfirmModal(customer.id, customer.name)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition" title="Xóa"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
           {!loading && filteredCustomers.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredCustomers.length}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
          )}

        </div>
      </div>

      {isModalOpen && (
        <CustomerModal
          customer={editingCustomer}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          existingCustomers={allCustomers}
        />
      )}

      {isConfirmModalOpen && (
        <ConfirmationModal
          isOpen={isConfirmModalOpen}
          title="Xác Nhận Xóa Bạn Đồng Hành"
          message={`Bạn có chắc chắn muốn xóa khách hàng "${customerToDelete?.name}" không? Hành động này không thể hoàn tác.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setIsConfirmModalOpen(false)}
          confirmText="Xóa Khách Hàng"
          cancelText="Hủy Bỏ"
        />
      )}
    </div>
  );
};

export default CustomerManagement;
