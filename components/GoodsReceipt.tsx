
import React, { useState } from 'react';
import { Archive, History, Table, GitCommit } from 'lucide-react';
import CreateGoodsReceipt from './CreateGoodsReceipt';
import InventoryMatrix from './InventoryMatrix';
import GoodsReceiptHistory from './GoodsReceiptHistory';
// import TransferHistory from './TransferHistory';
import { User } from 'firebase/auth';

type GoodsReceiptView = 'create' | 'inventory' | 'history' | 'transfers';

const GoodsReceiptPage: React.FC<{ userRole: 'admin' | 'staff' | null, user: User | null }> = ({ userRole, user }) => {
    const [activeTab, setActiveTab] = useState<GoodsReceiptView>('create');

    const isAdmin = userRole === 'admin';

    const TabButton: React.FC<{
        label: string;
        view: GoodsReceiptView;
        icon: React.ReactNode;
    }> = ({ label, view, icon }) => {
        const isActive = activeTab === view;
        return (
            <button
                onClick={() => setActiveTab(view)}
                className={`flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-all whitespace-nowrap ${
                    isActive
                        ? 'text-primary border-primary'
                        : 'text-neutral border-transparent hover:text-dark'
                }`}
            >
                {icon}
                <span className="hidden md:inline">{label}</span>
            </button>
        );
    };

    return (
        <div className="flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
                 <h1 className="text-3xl font-bold text-dark">Quản lý nhập kho</h1>
                 <div className="border-b border-slate-200 w-full md:w-auto overflow-x-auto">
                    <nav className="flex -mb-px space-x-1 md:space-x-2">
                        <TabButton label="Nhập Hàng" view="create" icon={<Archive size={18} />} />
                        <TabButton label="Tồn Kho" view="inventory" icon={<Table size={18} />} />
                        {isAdmin && <TabButton label="Lịch Sử Nhập" view="history" icon={<History size={18} />} />}
                        <TabButton label="Lịch Sử Chuyển" view="transfers" icon={<GitCommit size={18} />} />
                    </nav>
                 </div>
            </div>
            
            <div className="mt-2">
                {activeTab === 'create' && <CreateGoodsReceipt userRole={userRole} user={user} />}
                {activeTab === 'inventory' && <InventoryMatrix user={user} onNavigate={(tab: any) => setActiveTab(tab)} />}
                {isAdmin && activeTab === 'history' && <GoodsReceiptHistory userRole={userRole} />}
                {/* {activeTab === 'transfers' && <TransferHistory />} */}
            </div>
        </div>
    );
};


export default GoodsReceiptPage;
