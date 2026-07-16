const fs = require('fs');
let file = 'components/CreateGoodsReceipt.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("import { Package, Truck, Calendar, Archive, PlusCircle, CheckCheck, Edit, Trash2, Tag, Loader, FileText, FileDown, Search, ArrowRight, ClipboardList, Wallet, X, Plus, Eye, CreditCard, Users } from 'lucide-react';", 
    "import { Package, Truck, Calendar, Archive, PlusCircle, CheckCheck, Edit, Trash2, Tag, Loader, FileText, FileDown, Search, ArrowRight, ClipboardList, Wallet, X, Plus, Eye, CreditCard, Users } from 'lucide-react';\nimport { SupplierBankSelector } from './SupplierBankSelector';");

// Add state
const stateToAdd = `
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");
  const [isCreatingNewBank, setIsCreatingNewBank] = useState(false);
  const [newBankDetails, setNewBankDetails] = useState({ bankName: "", accountNumber: "", accountName: "" });
`;
content = content.replace("const [paymentStatus, setPaymentStatus] = useState<'paid'|'debt'>('debt');", 
    "const [paymentStatus, setPaymentStatus] = useState<'paid'|'debt'>('debt');" + stateToAdd);

// Add to runTransaction
const transactionPatch = `
          let finalBankAccountId = null;
          let finalBankDetails = null;
          if (paymentStatus === 'paid') {
              const supplierRef = doc(db, 'suppliers', selSup.id);
              const supplierSnap = await transaction.get(supplierRef);
              if (supplierSnap.exists()) {
                  let supplierData = supplierSnap.data();
                  let accounts = supplierData.bankAccounts || [];
                  if (isCreatingNewBank && newBankDetails.bankName && newBankDetails.accountNumber) {
                      const newId = Date.now().toString();
                      const newAccount = {
                          id: newId,
                          bankName: newBankDetails.bankName,
                          accountNumber: newBankDetails.accountNumber,
                          accountName: newBankDetails.accountName
                      };
                      accounts.push(newAccount);
                      transaction.update(supplierRef, { bankAccounts: accounts });
                      finalBankAccountId = newId;
                      finalBankDetails = newAccount;
                  } else if (selectedBankAccountId) {
                      finalBankAccountId = selectedBankAccountId;
                      finalBankDetails = accounts.find((a: any) => a.id === selectedBankAccountId) || null;
                  }
              }
          }
`;

content = content.replace("          if (paymentStatus === 'paid' && selectedPaymentMethodId) {", 
    transactionPatch + "          if (paymentStatus === 'paid' && selectedPaymentMethodId) {");

// Add bank details to transaction.set
content = content.replace("supplierName: selSup.name,", "supplierName: selSup.name,\n             supplierBankAccountId: finalBankAccountId,\n             supplierBankDetails: finalBankDetails,");

// Add SupplierBankSelector to JSX
const jsxPatch = `
                                <div className="relative">
                                    <CreditCard className="absolute left-2 top-1/2 -translate-y-1/2 text-black" size={16}/>
                                    <select 
                                        value={selectedPaymentMethodId} 
                                        onChange={e => setSelectedPaymentMethodId(e.target.value)} 
                                        className="w-full pl-8 pr-1 py-2 border rounded-lg text-sm font-black focus:ring-2 focus:ring-primary focus:outline-none appearance-none" 
                                        disabled={paymentStatus === 'debt'}
                                    >
                                        <option value="">PT Thanh toán...</option>
                                        {paymentMethods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                {paymentStatus === 'paid' && selectedSupplierId && (
                                    <div className="col-span-1 sm:col-span-2 lg:col-span-1">
                                    <SupplierBankSelector 
                                        supplier={suppliers.find(s => s.id === selectedSupplierId)}
                                        selectedBankAccountId={selectedBankAccountId}
                                        onSelect={setSelectedBankAccountId}
                                        isCreatingNew={isCreatingNewBank}
                                        setIsCreatingNew={setIsCreatingNewBank}
                                        newBankDetails={newBankDetails}
                                        onNewBankChange={(field, val) => setNewBankDetails(prev => ({...prev, [field]: val}))}
                                    />
                                    </div>
                                )}
`;
content = content.replace(/<div className="relative">\s*<CreditCard className="absolute left-2 top-1\/2 -translate-y-1\/2 text-black" size=\{16\}\/>\s*<select\s*value=\{selectedPaymentMethodId\}[\s\S]*?<\/select>\s*<\/div>/, jsxPatch);

fs.writeFileSync(file, content);
