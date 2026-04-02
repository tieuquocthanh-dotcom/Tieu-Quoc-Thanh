import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
  id: string;
  name: string;
  phone?: string;
  debt?: number;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  showSearch?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Chọn...',
  icon,
  disabled = false,
  showSearch = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.id === value);

  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opt.phone && opt.phone.includes(searchTerm))
  );

  return (
    <div className="relative" ref={wrapperRef}>
      <div 
        className={`w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus-within:border-blue-500 flex items-center cursor-pointer transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="absolute left-3 text-slate-400">
          {icon}
        </div>
        <div className="flex-1 truncate">
          {selectedOption ? selectedOption.name : <span className="text-slate-400">{placeholder}</span>}
        </div>
        <ChevronDown className={`absolute right-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} size={16} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {showSearch && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Tìm kiếm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              </div>
            </div>
          )}
          <div className="overflow-y-auto p-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-sm text-slate-500 italic">Không tìm thấy kết quả</div>
            ) : (
              filteredOptions.map(opt => (
                <div
                  key={opt.id}
                  className={`px-3 py-2 text-sm rounded-lg cursor-pointer flex items-center justify-between ${
                    value === opt.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="truncate">{opt.name}</span>
                      {opt.debt !== undefined && opt.debt > 0 && (
                        <span className="text-[10px] font-bold text-red-500 ml-2">Nợ: {new Intl.NumberFormat('vi-VN').format(opt.debt)} ₫</span>
                      )}
                    </div>
                    {opt.phone && <span className="text-[10px] text-slate-400 font-medium">{opt.phone}</span>}
                  </div>
                  {value === opt.id && <Check size={14} className="text-blue-600" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
