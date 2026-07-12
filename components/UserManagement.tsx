import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, setDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '../services/firebase';
import { UserCircle, Search, Save, UserPlus, X, Loader } from 'lucide-react';
import Pagination from './Pagination';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

interface AppUser {
  id: string; // uid
  email?: string;
  role?: 'admin' | 'staff';
  displayName?: string;
  provider?: string;
}

const UserManagement: React.FC = () => {
  const [data, setData] = useState<AppUser[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'staff'>('staff');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  
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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');
    setAddLoading(true);

    try {
      // Use a secondary Firebase app to create user so the current admin user is not logged out
      const apps = getApps();
      const secondaryAppName = 'SecondaryApp';
      const secondaryApp = apps.find(app => app.name === secondaryAppName) || initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
      const newUser = userCredential.user;

      // Add to Firestore
      await setDoc(doc(db, "users", newUser.uid), {
        email: newUser.email,
        displayName: newUser.email?.split('@')[0] || '',
        role: newRole,
        createdAt: new Date().toISOString(),
        provider: 'system'
      });

      // We should optionally sign out the secondary app's auth
      await secondaryAuth.signOut();

      setAddSuccess(`Đã tạo thành công người dùng: ${newUser.email}`);
      setNewEmail('');
      setNewPassword('');
      setNewRole('staff');
      setTimeout(() => {
          setShowAddModal(false);
          setAddSuccess('');
      }, 2000);
    } catch (err: any) {
      console.error(err);
      let msg = err.message;
      if (err.code === 'auth/email-already-in-use') msg = 'Email này đã được sử dụng.';
      if (err.code === 'auth/weak-password') msg = 'Mật khẩu quá yếu (tối thiểu 6 ký tự).';
      setAddError(msg);
    } finally {
      setAddLoading(false);
    }
  };

  const filteredData = useMemo(() => data.filter(d => (d.email || d.id).toLowerCase().includes(searchTerm.toLowerCase())), [data, searchTerm]);
  const paginatedData = useMemo(() => filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredData, currentPage, pageSize]);

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-black text-dark flex items-center"><UserCircle className="mr-3 text-primary" size={32} /> Quản Lý Người Dùng & Phân Quyền</h1>
        <button onClick={() => setShowAddModal(true)} className="flex items-center px-4 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition shadow-sm">
            <UserPlus size={18} className="mr-2" /> Tạo Người Dùng Mới
        </button>
      </div>

      {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in-down overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-lg text-dark flex items-center"><UserPlus size={20} className="mr-2 text-primary"/> Tạo Người Dùng</h3>
                      <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition"><X size={20} /></button>
                  </div>
                  <form onSubmit={handleAddUser} className="p-6">
                      {addError && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{addError}</div>}
                      {addSuccess && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{addSuccess}</div>}
                      
                      <div className="space-y-4">
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                              <input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none" placeholder="nguoidung@example.com" />
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">Mật khẩu</label>
                              <input required type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none" placeholder="••••••••" />
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">Phân quyền</label>
                              <select value={newRole} onChange={e => setNewRole(e.target.value as 'admin' | 'staff')} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white">
                                  <option value="staff">Nhân Viên</option>
                                  <option value="admin">Quản Trị (Admin)</option>
                              </select>
                          </div>
                      </div>

                      <div className="mt-6 flex justify-end space-x-3">
                          <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition">Hủy</button>
                          <button type="submit" disabled={addLoading} className="px-4 py-2 bg-primary text-white hover:bg-primary-dark rounded-lg font-bold transition flex items-center disabled:opacity-70">
                              {addLoading ? <Loader size={18} className="animate-spin mr-2" /> : null}
                              Tạo Mới
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

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
                    <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Nguồn gốc</th>
                    <th className="px-6 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-wider">Phân Quyền</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
                {paginatedData.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 font-bold text-dark">{d.displayName || d.email || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{d.email || 'N/A'}</td>
                        <td className="px-6 py-4 text-xs font-medium">
                            {d.provider === 'system' ? (
                                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md">Phần mềm</span>
                            ) : d.provider === 'google' ? (
                                <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md">Google</span>
                            ) : (
                                <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md">Không rõ</span>
                            )}
                        </td>
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
