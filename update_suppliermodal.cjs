const fs = require('fs');
let file = 'components/SupplierManagement.tsx';
let content = fs.readFileSync(file, 'utf8');

const importReplacement = `import { PlusCircle, Edit, Trash2, XCircle, Loader, Users, Search, RefreshCw, X, Plus } from 'lucide-react';
import { SupplierBankAccount } from '../types';`;
content = content.replace(/import \{ PlusCircle, Edit, Trash2, XCircle, Loader, Users, Search, RefreshCw \} from 'lucide-react';/, importReplacement);

const newSupplierModalStr = `export const SupplierModal: React.FC<{
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
        setError(\`Nhà cung cấp với tên "\${name.trim()}" đã tồn tại.\`);
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
};`;

// replace everything from `export const SupplierModal: React.FC<{` to `const SupplierManagement: React.FC = () => {`
const regex = /export const SupplierModal: React\.FC<\{[\s\S]*?const SupplierManagement: React\.FC = \(\) => \{/;
if (content.match(regex)) {
    content = content.replace(regex, newSupplierModalStr + '\n\nconst SupplierManagement: React.FC = () => {');
    fs.writeFileSync(file, content);
}
