const { parseNumber } = require("./utils/formatting.ts") || {};

function parseNumberMock(str) {
  if (!str) return 0;
  
  let cleanStr = str.toString().trim();
  const lastDotIdx = cleanStr.lastIndexOf('.');
  const lastCommaIdx = cleanStr.lastIndexOf(',');
  
  let val = 0;
  
  if (lastDotIdx > -1 && lastCommaIdx > -1) {
      if (lastDotIdx > lastCommaIdx) {
          val = parseFloat(cleanStr.replace(/,/g, ''));
      } else {
          val = parseFloat(cleanStr.replace(/\./g, '').replace(/,/g, '.'));
      }
  } else if (lastDotIdx > -1) {
      const charsAfterDot = cleanStr.length - lastDotIdx - 1;
      const dotCount = (cleanStr.match(/\./g) || []).length;
      if (dotCount === 1 && charsAfterDot !== 3) {
          val = parseFloat(cleanStr);
      } else {
          val = parseFloat(cleanStr.replace(/\./g, ''));
      }
  } else if (lastCommaIdx > -1) {
      const charsAfterComma = cleanStr.length - lastCommaIdx - 1;
      const commaCount = (cleanStr.match(/,/g) || []).length;
      if (commaCount === 1 && charsAfterComma !== 3) {
          val = parseFloat(cleanStr.replace(/,/g, '.'));
      } else {
          val = parseFloat(cleanStr.replace(/,/g, ''));
      }
  } else {
      val = parseFloat(cleanStr);
  }
  
  return isNaN(val) ? 0 : val;
}

console.log("parseNumberMock('0150') = ", parseNumberMock('0150'));
console.log("parseNumberMock('150.000') = ", parseNumberMock('150.000'));
