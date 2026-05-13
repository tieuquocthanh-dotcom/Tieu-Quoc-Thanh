import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { UserCircle, Search, Save } from 'lucide-react';
import Pagination from './Pagination';

interface AppUser {
  id: string; // uid
  email?: string;
  role?: 'admin' | 'staff';
  displayName?: string;
}

const UserManagement: React.FC = () => {
  const [data, setData] = useState<AppUser[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    // We assume users collection stores the user information
    // If not ordered, we just fetch all
    const q = query(collection(db, "users"));
    return onSnapshot(q, (snapshot) => {
      setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
    });
  }, []);

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'staff') => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
    } catch (error: any) {
      alert("Lỗi cập nhật phân quyền: " + error.message);
    }
  };

  const filteredData = useMemo(() => data.filter(d => (d.email || d.id).toLowerCase().includes(searchTerm.toLowerCase())), [data, searchTerm]);
  const paginatedData = useMemo(() => filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredData, currentPage, pageSize]);

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-black text-dark flex items-center"><UserCircle className="mr-3 text-primary" size={32} /> Quản Lý Người Dùng & Phân Quyền</h1>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Tìm email hoặc ID..." value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-primary focus:border-primary" />
            </div>
            <select value={pageSize} onChange={e => {setPageSize(Number(e.target.value)); setCurrentPage(1);}} className="border rounded-lg px-3 py-2 text-sm text-dark focus:ring-primary focus:border-primary">
                <option value={10}>10 dòng / trang</option><option value={20}>20 dòng / trang</option><option value={50}>50 dòng / trang</option>
            </select>
        </div>
        <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Người dùng</th>
                    <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">UID</th>
                    <th className="px-6 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-wider">Phân Quyền</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
                {paginatedData.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 font-bold text-dark">{d.displayName || d.email || 'N/A'}</td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">{d.id}</td>
                        <td className="px-6 py-4 text-right">
                            <select 
                                value={d.role || 'staff'}
                                onChange={(e) => handleRoleChange(d.id, e.target.value as 'admin' | 'staff')}
                                className={`border rounded-lg px-3 py-1 text-sm font-black focus:ring-primary focus:border-primary ${d.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}
                            >
                                <option value="staff">Nhân Viên</option>
                                <option value="admin">Quản Trị (Admin)</option>
                            </select>
                        </td>
                    </tr>
                ))}
                {paginatedData.length === 0 && <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">Chưa có người dùng nào được lưu trong database. Vui lòng đăng nhập thử 1 lần bằng tài khoản Google để hệ thống ghi nhận.</td></tr>}
            </tbody>
        </table>
        {filteredData.length > pageSize && <div className="p-4 border-t border-slate-200"><Pagination currentPage={currentPage} totalPages={Math.ceil(filteredData.length / pageSize)} onPageChange={setCurrentPage} /></div>}
      </div>
    </div>
  );
};
export default UserManagement;
