export const formatNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
};

export const formatDate = (date: Date | any): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
};
