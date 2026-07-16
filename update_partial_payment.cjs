const fs = require('fs');
let file = 'components/DebtManagement.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
    /const PartialPaymentModal: React\.FC<\{([\s\S]*?)\}> = \(\{ ([\s\S]*?) \}\) => \{/,
    "const PartialPaymentModal: React.FC<{$1    supplier?: Supplier;\n}> = ({ $2, supplier }) => {"
);

c = c.replace(
    /onConfirm: \(date: string, amount: number, note: string, paymentMethodId: string\) => void;/,
    "onConfirm: (date: string, amount: number, note: string, paymentMethodId: string, bankDetails?: any) => void;"
);

const statesStr = `
    const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
    const [isCreatingNewBank, setIsCreatingNewBank] = useState(false);
    const [newBankDetails, setNewBankDetails] = useState({ bankName: '', accountNumber: '', accountName: '' });

    const handleConfirm = () => {
        let bankData = undefined;
        if (data?.type === 'receipt') {
            if (isCreatingNewBank && newBankDetails.bankName && newBankDetails.accountNumber) {
                bankData = { isNew: true, ...newBankDetails };
            } else if (selectedBankAccountId) {
                bankData = { isNew: false, id: selectedBankAccountId };
            }
        }
        onConfirm(paymentDate, payAmount, note, selectedMethodId, bankData);
    };
`;

c = c.replace(
    /const \[note, setNote\] = useState\(''\);/,
    `const [note, setNote] = useState('');\n${statesStr}`
);

c = c.replace(
    /setNote\(''\);/,
    `setNote('');\n            setSelectedBankAccountId('');\n            setIsCreatingNewBank(false);\n            setNewBankDetails({ bankName: '', accountNumber: '', accountName: '' });`
);

c = c.replace(
    /onClick=\{\(\) => onConfirm\(paymentDate, payAmount, note, selectedMethodId\)\}/g,
    `onClick={handleConfirm}`
);

const selectorJSX = `
                        {type === 'receipt' && (
                            <SupplierBankSelector 
                                supplier={supplier}
                                selectedBankAccountId={selectedBankAccountId}
                                onSelect={setSelectedBankAccountId}
                                isCreatingNew={isCreatingNewBank}
                                setIsCreatingNew={setIsCreatingNewBank}
                                newBankDetails={newBankDetails}
                                onNewBankChange={(field, val) => setNewBankDetails(prev => ({...prev, [field]: val}))}
                            />
                        )}
`;

c = c.replace(
    /<\/select>\s*<\/div>\s*<div>\s*<label className="block text-\[10px\] font-black text-slate-500 uppercase mb-1">Số tiền thanh toán<\/label>/,
    `</select>\n                        </div>${selectorJSX}                        <div>\n                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Số tiền thanh toán</label>`
);

fs.writeFileSync(file, c);
