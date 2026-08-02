const fs = require('fs');
const file = 'components/CustomerModal.tsx';
let code = fs.readFileSync(file, 'utf8');

const compStartOld = `const CustomerModal: React.FC<CustomerModalProps> = ({ customer, onClose, onSave }) => {`;
const compStartNew = `const CustomerModal: React.FC<CustomerModalProps> = ({ customer, onClose, onSave, existingCustomers }) => {`;
code = code.replace(compStartOld, compStartNew);

const submitOld = `  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, phone, address });
  };`;
const submitNew = `  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone && existingCustomers) {
      const isDuplicatePhone = existingCustomers.some(c => c.phone === phone && c.id !== customer?.id);
      if (isDuplicatePhone) {
        alert("Số điện thoại này đã tồn tại trong hệ thống. Vui lòng sử dụng số khác hoặc tìm khách hàng đã có.");
        return;
      }
    }
    onSave({ name, phone, address });
  };`;
code = code.replace(submitOld, submitNew);

fs.writeFileSync(file, code);
console.log('Done');
