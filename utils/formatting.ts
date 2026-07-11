export const formatNumber = (num: number | string | undefined): string => {
  if (num === undefined || num === null) return '0';
  const val = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(val)) return '0';
  return val.toLocaleString('vi-VN');
};

export const parseNumber = (str: string): number => {
  if (!str) return 0;
  const val = parseFloat(str.replace(/\./g, '').replace(/,/g, '.'));
  return isNaN(val) ? 0 : val;
};

export const getLocalYYYYMMDD = (date?: Date): string => {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
