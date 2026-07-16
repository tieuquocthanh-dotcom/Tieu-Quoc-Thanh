const fs = require('fs');

let file = 'components/DebtManagement.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
    /const PayBulkModal: React\.FC<\{([\s\S]*?)\}> = \(\{ ([\s\S]*?) \}\) => \{/,
    "const PayBulkModal: React.FC<{$1    supplier?: Supplier;\n}> = ({ $2, supplier }) => {"
);

c = c.replace(
    /onConfirm: \(date: string, amount: number, note: string, paymentMethodId: string\) => void;/,
    "onConfirm: (date: string, amount: number, note: string, paymentMethodId: string, bankDetails?: any) => void;"
);

// Add states inside PayBulkModal
const statesStr = `
    const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
    const [isCreatingNewBank, setIsCreatingNewBank] = useState(false);
    const [newBankDetails, setNewBankDetails] = useState({ bankName: '', accountNumber: '', accountName: '' });

    const handleConfirm = () => {
        let bankData = undefined;
        if (type === 'payables') {
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
    /const \[payAmount, setPayAmount\] = useState\(0\);/,
    `const [payAmount, setPayAmount] = useState(0);\n${statesStr}`
);

// Reset states on open
c = c.replace(
    /setPayAmount\(totalAmount\);/,
    `setPayAmount(totalAmount);\n            setSelectedBankAccountId('');\n            setIsCreatingNewBank(false);\n            setNewBankDetails({ bankName: '', accountNumber: '', accountName: '' });`
);

// Replace onConfirm call
c = c.replace(
    /onClick=\{\(\) => onConfirm\(paymentDate, payAmount, note, selectedMethodId\)\}/g,
    `onClick={handleConfirm}`
);

// Add Selector in render
const selectorJSX = `
                        {type === 'payables' && (
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
