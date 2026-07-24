const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

code = code.replace(
    'const [isSettingsOpen, setIsSettingsOpen] = useState(false);',
    'const [isSettingsOpen, setIsSettingsOpen] = useState(false);\n  const [settingsSearch, setSettingsSearch] = useState("");'
);

// We need to inject the Search icon if not already imported
if (!code.includes('Search,')) {
    code = code.replace("import { Home, Package", "import { Search, Home, Package");
}

const originalMenuString = `<div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 p-2 animate-fade-in-down overflow-y-auto max-h-[80vh] z-50">
                                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase">Tài Chính</div>
                                <SettingsItem targetView="savings" icon={<PiggyBank size={16}/>} label="Sổ tiết kiệm" />
                                <SettingsItem targetView="accounts" icon={<Landmark size={16}/>} label="Quản Lý Tài Khoản" />
                                <SettingsItem targetView="debtManagement" icon={<Wallet size={16}/>} label="Quản Lý Công Nợ" />

                                <div className="my-1 h-px bg-slate-100"></div>
                                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase">Mua Hàng</div>
                                <SettingsItem targetView="restockPredictions" icon={<PackageSearch size={16}/>} label="Gợi Ý Nhập Hàng" />
                                <SettingsItem targetView="plannedOrders" icon={<ClipboardList size={16}/>} label="Dự kiến đặt hàng" />
                                <SettingsItem targetView="chinaImport" icon={<Plane size={16}/>} label="Nhập Hàng TQ" />
                                
                                <div className="my-1 h-px bg-slate-100"></div>
                                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase">Truy Vết & Báo Cáo</div>
                                <SettingsItem targetView="supplierPaymentHistory" icon={<CheckCheck size={16}/>} label="Truy Vết Trả Tiền NCC" />
                                <SettingsItem targetView="priceComparison" icon={<BarChart2 size={16}/>} label="So Sánh Giá Nhập" />
                                <SettingsItem targetView="inventoryLedger" icon={<History size={16}/>} label="Truy Vết Tồn Kho" />
                                <SettingsItem targetView="productAnalytics" icon={<BarChart3 size={16}/>} label="Hiệu Quả Sản Phẩm" />
                                <SettingsItem targetView="supplierAnalytics" icon={<PieChart size={16}/>} label="Nhập Hàng Theo NCC" />
                                <SettingsItem targetView="customerAnalytics" icon={<PieChart size={16}/>} label="Bán Hàng Theo Khách Hàng" />
                                
                                <div className="my-1 h-px bg-slate-100"></div>
                                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase">Hàng Hóa & Đối Tác</div>
                                <SettingsItem targetView="products" icon={<Package size={16}/>} label="Sản Phẩm" />
                                <SettingsItem targetView="quotations" icon={<FileText size={16}/>} label="Quản Lý Báo Giá" />
                                <SettingsItem targetView="customers" icon={<Contact size={16}/>} label="Khách Hàng" />
                                <SettingsItem targetView="suppliers" icon={<Users size={16}/>} label="Nhà Cung Cấp" />
                                <SettingsItem targetView="warehouses" icon={<Warehouse size={16}/>} label="Quản Lý Kho" />
                                <SettingsItem targetView="shippers" icon={<Truck size={16}/>} label="Đơn Vị Vận Chuyển" />
                                
                                <div className="my-1 h-px bg-slate-100"></div>
                                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase">Quản Lý</div>
                                <SettingsItem targetView="shipmentManagement" icon={<Send size={16}/>} label="Quản Lý Vận Đơn" />
                                <SettingsItem targetView="inventoryAlerts" icon={<AlertTriangle size={16}/>} label="Cảnh Báo Tồn Kho" />
                                <SettingsItem targetView="outsideStockAlerts" icon={<Bell size={16}/>} label="Cảnh Báo Kho Ngoài" />
                                <SettingsItem targetView="notes" icon={<StickyNote size={16}/>} label="Ghi chú hệ thống" />
                                
                                <div className="my-1 h-px bg-slate-100"></div>
                                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase">Cấu Hình</div>
                                <SettingsItem targetView="users" icon={<UserCircle size={16}/>} label="Quản Lý Người Dùng" />
                                <SettingsItem targetView="manufacturers" icon={<Building size={16}/>} label="Hãng Sản Xuất" />
                                <SettingsItem targetView="paymentMethods" icon={<CreditCard size={16}/>} label="Phương Thức TT" />
                                
                                <div className="my-1 h-px bg-slate-100"></div>
                                <button onClick={handleLogout} className="w-full text-left flex items-center space-x-3 px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50">
                                    <LogOut size={16} />
                                    <span>Đăng Xuất ({user?.email})</span>
                                </button>
                            </div>`;

const newMenuString = `
<div className="absolute top-full right-0 mt-2 w-[300px] bg-white rounded-lg shadow-xl border border-slate-200 p-2 animate-fade-in-down z-50 flex flex-col max-h-[80vh]">
    <div className="px-2 pb-2 border-b border-slate-100 sticky top-0 bg-white z-10 shrink-0">
        <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
            <input 
                type="text" 
                autoFocus
                placeholder="Tìm chức năng..." 
                value={settingsSearch}
                onChange={(e) => setSettingsSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary focus:bg-white transition-colors"
            />
        </div>
    </div>
    
    <div className="overflow-y-auto pt-2 flex-1">
        {(() => {
            const sections = [
                {
                    title: "Tài Chính",
                    items: [
                        { targetView: "savings" as View, icon: <PiggyBank size={16}/>, label: "Sổ tiết kiệm" },
                        { targetView: "accounts" as View, icon: <Landmark size={16}/>, label: "Quản Lý Tài Khoản" },
                        { targetView: "debtManagement" as View, icon: <Wallet size={16}/>, label: "Quản Lý Công Nợ" }
                    ]
                },
                {
                    title: "Mua Hàng",
                    items: [
                        { targetView: "restockPredictions" as View, icon: <PackageSearch size={16}/>, label: "Gợi Ý Nhập Hàng" },
                        { targetView: "plannedOrders" as View, icon: <ClipboardList size={16}/>, label: "Dự kiến đặt hàng" },
                        { targetView: "chinaImport" as View, icon: <Plane size={16}/>, label: "Nhập Hàng TQ" }
                    ]
                },
                {
                    title: "Truy Vết & Báo Cáo",
                    items: [
                        { targetView: "supplierPaymentHistory" as View, icon: <CheckCheck size={16}/>, label: "Truy Vết Trả Tiền NCC" },
                        { targetView: "priceComparison" as View, icon: <BarChart2 size={16}/>, label: "So Sánh Giá Nhập" },
                        { targetView: "inventoryLedger" as View, icon: <History size={16}/>, label: "Truy Vết Tồn Kho" },
                        { targetView: "productAnalytics" as View, icon: <BarChart3 size={16}/>, label: "Hiệu Quả Sản Phẩm" },
                        { targetView: "supplierAnalytics" as View, icon: <PieChart size={16}/>, label: "Nhập Hàng Theo NCC" },
                        { targetView: "customerAnalytics" as View, icon: <PieChart size={16}/>, label: "Bán Hàng Theo Khách Hàng" }
                    ]
                },
                {
                    title: "Hàng Hóa & Đối Tác",
                    items: [
                        { targetView: "products" as View, icon: <Package size={16}/>, label: "Sản Phẩm" },
                        { targetView: "quotations" as View, icon: <FileText size={16}/>, label: "Quản Lý Báo Giá" },
                        { targetView: "customers" as View, icon: <Contact size={16}/>, label: "Khách Hàng" },
                        { targetView: "suppliers" as View, icon: <Users size={16}/>, label: "Nhà Cung Cấp" },
                        { targetView: "warehouses" as View, icon: <Warehouse size={16}/>, label: "Quản Lý Kho" },
                        { targetView: "shippers" as View, icon: <Truck size={16}/>, label: "Đơn Vị Vận Chuyển" }
                    ]
                },
                {
                    title: "Quản Lý",
                    items: [
                        { targetView: "shipmentManagement" as View, icon: <Send size={16}/>, label: "Quản Lý Vận Đơn" },
                        { targetView: "inventoryAlerts" as View, icon: <AlertTriangle size={16}/>, label: "Cảnh Báo Tồn Kho" },
                        { targetView: "outsideStockAlerts" as View, icon: <Bell size={16}/>, label: "Cảnh Báo Kho Ngoài" },
                        { targetView: "notes" as View, icon: <StickyNote size={16}/>, label: "Ghi chú hệ thống" }
                    ]
                },
                {
                    title: "Cấu Hình",
                    items: [
                        { targetView: "users" as View, icon: <UserCircle size={16}/>, label: "Quản Lý Người Dùng" },
                        { targetView: "manufacturers" as View, icon: <Building size={16}/>, label: "Hãng Sản Xuất" },
                        { targetView: "paymentMethods" as View, icon: <CreditCard size={16}/>, label: "Phương Thức TT" }
                    ]
                }
            ];

            const searchTerm = settingsSearch.toLowerCase();
            const filteredSections = sections.map(section => {
                const filteredItems = section.items.filter(item => item.label.toLowerCase().includes(searchTerm));
                return { ...section, items: filteredItems };
            }).filter(section => section.items.length > 0);

            if (filteredSections.length === 0) {
                return <div className="text-center py-4 text-sm text-slate-500">Không tìm thấy chức năng nào.</div>;
            }

            return (
                <>
                    {filteredSections.map((section, idx) => (
                        <div key={section.title}>
                            {idx > 0 && <div className="my-1 h-px bg-slate-100"></div>}
                            <div className="px-3 py-1.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">{section.title}</div>
                            {section.items.map(item => (
                                <SettingsItem key={item.targetView} targetView={item.targetView} icon={item.icon} label={item.label} />
                            ))}
                        </div>
                    ))}
                </>
            );
        })()}
        
        <div className="my-1 h-px bg-slate-100"></div>
        <button onClick={handleLogout} className="w-full text-left flex items-center space-x-3 px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50">
            <LogOut size={16} />
            <span className="truncate">Đăng Xuất ({user?.email})</span>
        </button>
    </div>
</div>
`;

code = code.replace(originalMenuString, newMenuString);

fs.writeFileSync('App.tsx', code);
