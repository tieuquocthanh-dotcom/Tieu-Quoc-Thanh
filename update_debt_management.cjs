const fs = require('fs');

const file = 'components/DebtManagement.tsx';
let content = fs.readFileSync(file, 'utf8');

const bankSelectorStr = `
const SupplierBankSelector: React.FC<{
    supplier?: Supplier;
    selectedBankAccountId: string;
    onSelect: (id: string) => void;
    newBankDetails: { bankName: string; accountNumber: string; accountName: string };
    onNewBankChange: (field: string, value: string) => void;
    isCreatingNew: boolean;
    setIsCreatingNew: (val: boolean) => void;
}> = ({ supplier, selectedBankAccountId, onSelect, newBankDetails, onNewBankChange, isCreatingNew, setIsCreatingNew }) => {
    if (!supplier) return null;
    const accounts = supplier.bankAccounts || [];

    return (
        <div className="mt-4 border-t-2 border-slate-200 pt-4">
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Thanh toán vào ngân hàng của nhà cung cấp</label>
            {!isCreatingNew ? (
                <div className="flex gap-2">
                    <select
                        value={selectedBankAccountId}
                        onChange={(e) => {
                            if (e.target.value === 'new') {
                                setIsCreatingNew(true);
                                onSelect('');
                            } else {
                                onSelect(e.target.value);
                            }
                        }}
                        className="flex-1 px-3 py-3 border-2 border-slate-800 rounded-xl font-black focus:ring-2 focus:ring-primary outline-none bg-white text-black"
                    >
                        <option value="">-- Chọn tài khoản thụ hưởng --</option>
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                                {acc.bankName} - {acc.accountNumber} - {acc.accountName}
                            </option>
                        ))}
                        <option value="new">+ Thêm tài khoản mới</option>
                    </select>
                </div>
            ) : (
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border-2 border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase">Thêm tài khoản mới</span>
                        <button onClick={() => setIsCreatingNew(false)} className="text-red-500 hover:bg-red-50 p-1 rounded"><X size={14}/></button>
                    </div>
                    <input type="text" placeholder="Tên Ngân hàng (vd: VCB, TCB...)" value={newBankDetails.bankName} onChange={e => onNewBankChange('bankName', e.target.value)} className="w-full px-3 py-2 border-2 border-slate-800 rounded-lg text-sm font-bold"/>
                    <input type="text" placeholder="Số tài khoản" value={newBankDetails.accountNumber} onChange={e => onNewBankChange('accountNumber', e.target.value)} className="w-full px-3 py-2 border-2 border-slate-800 rounded-lg text-sm font-bold"/>
                    <input type="text" placeholder="Tên chủ tài khoản" value={newBankDetails.accountName} onChange={e => onNewBankChange('accountName', e.target.value)} className="w-full px-3 py-2 border-2 border-slate-800 rounded-lg text-sm font-bold"/>
                </div>
            )}
        </div>
    );
};
`;

if (!content.includes('const SupplierBankSelector')) {
    content = content.replace("const PayBulkModal:", bankSelectorStr + "\nconst PayBulkModal:");
}

fs.writeFileSync(file, content);
