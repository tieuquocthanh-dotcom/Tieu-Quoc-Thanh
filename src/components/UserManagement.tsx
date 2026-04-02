
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppUser } from '../types';
import { UserPlus, Trash2, Mail, Lock, User, Loader, Save, X, Edit2, Users } from 'lucide-react';
import { notifyError, notifySuccess } from '../utils/errorHandler';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setEmail('');
    setUsername('');
    setDisplayName('');
    setPassword('');
    setRole('staff');
    setEditingUser(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !displayName || (!editingUser && !password)) {
      notifyError("Vui lòng điền đầy đủ thông tin.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingUser) {
        const userRef = doc(db, 'users', editingUser.id);
        const updateData: any = {
          email,
          username,
          displayName,
          role
        };
        if (password) updateData.password = password;
        
        await updateDoc(userRef, updateData);
        notifySuccess("Cập nhật người dùng thành công!");
      } else {
        await addDoc(collection(db, 'users'), {
          email,
          username,
          displayName,
          password,
          role,
          createdAt: serverTimestamp()
        });
        notifySuccess("Thêm người dùng thành công!");
      }
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      console.error("User save error:", err);
      notifyError("Có lỗi xảy ra khi lưu người dùng.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa người dùng này?")) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      notifySuccess("Đã xóa người dùng.");
    } catch (err) {
      notifyError("Lỗi khi xóa người dùng.");
    }
  };

  const openEdit = (user: AppUser) => {
    setEditingUser(user);
    setEmail(user.email);
    setUsername(user.username || '');
    setDisplayName(user.displayName);
    setRole(user.role);
    setPassword(''); // Don't show old password
    setShowAddModal(true);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center uppercase tracking-tight">
            <Users className="mr-3 text-blue-700" size={28} />
            Quản Lý Người Dùng
          </h1>
          <p className="text-slate-500 text-sm font-medium">Phân quyền và quản lý tài khoản hệ thống</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="btn-primary flex items-center shadow-md"
        >
          <UserPlus className="mr-2" size={18} />
          THÊM NGƯỜI DÙNG
        </button>
      </div>

      <div className="card-traditional overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-traditional">
            <thead>
              <tr>
                <th>Họ Tên</th>
                <th>Tài Khoản</th>
                <th>Email</th>
                <th className="text-center">Vai Trò</th>
                <th className="text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400 font-bold text-sm italic">
                    Chưa có người dùng nào
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td>
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center mr-3">
                          <User size={16} />
                        </div>
                        <span className="font-bold text-slate-900">{user.displayName}</span>
                      </div>
                    </td>
                    <td>
                      <span className="font-bold text-slate-600">@{user.username || 'N/A'}</span>
                    </td>
                    <td>
                      <span className="text-slate-500 font-medium">{user.email}</span>
                    </td>
                    <td className="text-center">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${user.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => openEdit(user)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all"
                          title="Sửa"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
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

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {editingUser ? 'Cập Nhật Tài Khoản' : 'Tạo Tài Khoản Mới'}
                </h3>
                <p className="text-slate-500 text-xs mt-1">Điền thông tin chi tiết tài khoản bên dưới</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Họ tên hiển thị</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-800 outline-none"
                      placeholder="VD: Nguyễn Văn A"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Email đăng nhập</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-800 outline-none"
                      placeholder="VD: user@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Tên đăng nhập (Username)</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-800 outline-none"
                      placeholder="VD: admin_01"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                    {editingUser ? 'Mật khẩu mới (Để trống nếu không đổi)' : 'Mật khẩu truy cập'}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      required={!editingUser}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-800 outline-none"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Vai trò hệ thống</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('staff')}
                      className={`py-2.5 rounded-xl font-semibold text-xs transition-all border-2 ${role === 'staff' ? 'bg-blue-50 border-blue-600 text-blue-600' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                      Nhân Viên (Staff)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('admin')}
                      className={`py-2.5 rounded-xl font-semibold text-xs transition-all border-2 ${role === 'admin' ? 'bg-red-50 border-red-500 text-red-600' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                      Quản Trị (Admin)
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSubmitting ? <Loader className="animate-spin mr-2" size={20} /> : <Save className="mr-2" size={20} />}
                  {isSubmitting ? "Đang xử lý..." : (editingUser ? "Cập Nhật Tài Khoản" : "Tạo Tài Khoản")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default UserManagement;
