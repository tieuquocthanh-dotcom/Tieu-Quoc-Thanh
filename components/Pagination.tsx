import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, pageSize, totalItems, onPageChange, onPageSizeChange }) => {
  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="flex justify-between items-center mt-4 bg-white p-3 rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center space-x-2">
        <span className="text-sm font-bold text-slate-500 uppercase">Hiển thị</span>
        <select 
          value={pageSize} 
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="border-2 border-slate-200 rounded-lg p-1 text-sm font-black outline-none focus:border-primary"
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <span className="text-sm font-bold text-slate-500 uppercase">/ {totalItems}</span>
      </div>
      <div className="flex items-center space-x-1">
        <button 
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-black text-primary px-2">Trang {currentPage} / {totalPages || 1}</span>
        <button 
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages || totalPages === 0}
          className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
