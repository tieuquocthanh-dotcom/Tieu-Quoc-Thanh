const fs = require('fs');
const file = 'components/InventoryMatrix.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('useToast')) {
    content = content.replace("import { formatNumber } from '../utils/formatting';", "import { formatNumber } from '../utils/formatting';\nimport { useToast } from './ToastContext';");
    content = content.replace("const InventoryMatrix: React.FC<{ userRole?: 'admin' | 'staff' | null }> = ({ userRole }) => {", "const InventoryMatrix: React.FC<{ userRole?: 'admin' | 'staff' | null }> = ({ userRole }) => {\n    const { showToast } = useToast();");
    
    // Replace alert("Cập nhật tồn kho thành công!");
    content = content.replace('alert("Cập nhật tồn kho thành công!");', 'showToast("Cập nhật tồn kho thành công!", "success");');
    
    // Replace alert("Đã xóa bản ghi tồn kho thành công!");
    content = content.replace('alert("Đã xóa bản ghi tồn kho thành công!");', 'showToast("Đã xóa bản ghi tồn kho thành công!", "success");');
    
    // Replace alert("Chuyển kho thành công!");
    content = content.replace('alert("Chuyển kho thành công!");', 'showToast("Chuyển kho thành công!", "success");');
    
    // Replace alert(`Đã dọn dẹp thành công ${totalDeleted} bản ghi tồn kho bằng 0.`);
    content = content.replace('alert(`Đã dọn dẹp thành công ${totalDeleted} bản ghi tồn kho bằng 0.`);', 'showToast(`Đã dọn dẹp thành công ${totalDeleted} bản ghi tồn kho bằng 0.`, "success");');

    // Replace some error alerts too
    content = content.replace(/alert\("Lỗi khi cập nhật tồn kho\."\);/g, 'showToast("Lỗi khi cập nhật tồn kho.", "error");');
    content = content.replace(/alert\("Lỗi khi xóa bản ghi tồn kho\. Vui lòng thử lại\."\);/g, 'showToast("Lỗi khi xóa bản ghi", "error");');
    content = content.replace(/alert\(`Lỗi khi chuyển kho: \$\{error\.message\}`\);/g, 'showToast(`Lỗi khi chuyển kho: ${error.message}`, "error");');

    fs.writeFileSync(file, content);
    console.log('Patched InventoryMatrix');
}
