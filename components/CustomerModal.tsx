import React, { useState, useEffect } from 'react';
import { X, User } from 'lucide-react';
import { Customer } from '../types';

interface CustomerModalProps {
  customer: Customer | null;
  onClose: () => void;
  onSave: (data: any) => void;
  existingCustomers?: Customer[];
}

const CustomerModal: React.FC<CustomerModalProps> = ({ customer, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone || '');
      setAddress(customer.address || '');
    }
  }, [customer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, phone, address });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border-4 border-slate-800 overflow-hidden animate-fade-in-down">
        <div className="bg-primary p-4 text-white flex justify-between items-center">
          <h3 className="font-black uppercase text-sm flex items-center"><User className="mr-2" size={20}/> {customer ? 'Sửa khách hàng' : 'Thêm khách hàng'}</h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Tên khách hàng</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Số điện thoại</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Địa chỉ</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full p-2 border-2 border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-primary" />
          </div>
          <div className="pt-4 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-white border-2 border-slate-800 rounded-xl font-black text-xs uppercase text-black transition hover:bg-slate-100">Hủy</button>
            <button type="submit" className="flex-1 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg transition active:scale-95 hover:bg-primary-hover">Lưu</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerModal;
