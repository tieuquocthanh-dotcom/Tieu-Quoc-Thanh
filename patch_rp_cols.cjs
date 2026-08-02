const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

const thOld = `<th className="px-4 py-3">Sản phẩm</th>
                                <th className="px-4 py-3 text-right">Tồn Kho</th>
                                <th className="px-4 py-3 text-right">Tốc độ bán<br/>({config.daysToAnalyze} ngày)</th>
                                <th className="px-4 py-3 text-center">Tình Trạng</th>
                                <th className="px-4 py-3 text-right">Còn Bán Được</th>
                                <th className="px-4 py-3 text-right bg-primary/5 text-primary">SL Cần Nhập<br/>(Cho {config.daysToStock} ngày)</th>`;

const thNew = `<th className="px-4 py-3">Sản phẩm</th>
                                <th className="px-4 py-3 text-right">Tồn Kho</th>
                                <th className="px-4 py-3 text-right">Tổng Thực Còn<br/>(Tiền Hàng)</th>
                                <th className="px-4 py-3 text-right">Tốc độ bán<br/>({config.daysToAnalyze} ngày)</th>
                                <th className="px-4 py-3 text-center">Tình Trạng</th>
                                <th className="px-4 py-3 text-right">Còn Bán Được</th>
                                <th className="px-4 py-3 text-right bg-primary/5 text-primary">SL Cần Nhập<br/>(Cho {config.daysToStock} ngày)</th>
                                <th className="px-4 py-3 text-right bg-primary/5 text-primary">Tiền Dự Kiến</th>`;

code = code.replace(thOld, thNew);

const trLoading = `<tr><td colSpan={6} className="p-8 text-center"><Loader className="animate-spin text-primary mx-auto" size={24}/></td></tr>`;
const trLoadingNew = `<tr><td colSpan={8} className="p-8 text-center"><Loader className="animate-spin text-primary mx-auto" size={24}/></td></tr>`;
code = code.replace(trLoading, trLoadingNew);

const trEmpty = `<tr><td colSpan={6} className="p-8 text-center text-slate-400 font-medium">Không tìm thấy sản phẩm nào.</td></tr>`;
const trEmptyNew = `<tr><td colSpan={8} className="p-8 text-center text-slate-400 font-medium">Không tìm thấy sản phẩm nào.</td></tr>`;
code = code.replace(trEmpty, trEmptyNew);

fs.writeFileSync(file, code);
console.log('Done TH');
