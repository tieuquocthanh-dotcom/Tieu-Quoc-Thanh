const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

code = code.replace(
    /<NavItem targetView="sales" icon=\{<ShoppingCart size=\{18\} \/>\} label="Bán Hàng" \/>/g,
    '<NavItem targetView="sales" icon={<ShoppingCart size={18} />} label="Bán Hàng" badgeCount={unreadSalesCount} />'
);

code = code.replace(
    /<NavItem targetView="goodsReceipt" icon=\{<Archive size=\{18\} \/>\} label="Nhập Hàng" \/>/g,
    '<NavItem targetView="goodsReceipt" icon={<Archive size={18} />} label="Nhập Hàng" badgeCount={unreadReceiptsCount} />'
);

fs.writeFileSync('App.tsx', code);
