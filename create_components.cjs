const fs = require('fs');
const components = [
  'ProductManagement', 'SalesTerminal', 'ManufacturerManagement', 'SupplierManagement',
  'WarehouseManagement', 'CustomerManagement', 'ShippingManagement', 'PaymentMethodManagement',
  'AccountManagement', 'GoodsReceipt', 'InventoryMatrix', 'ShipmentManagement',
  'InventoryAlerts', 'OutsideStockAlerts', 'DebtManagement', 'QuotationManagement',
  'Login', 'UserManagement', 'ChinaImportManagement', 'ProductAnalytics',
  'SupplierAnalytics', 'InventoryLedger', 'PriceComparison', 'SupplierPaymentHistory',
  'PlannedOrderManagement', 'NoteManagement', 'SavingsManagement', 'NotificationSystem'
];

components.forEach(c => {
  const content = `import React from 'react';

const ${c}: React.FC<any> = (props) => {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">${c}</h2>
      <p>This component is under construction.</p>
    </div>
  );
};

export default ${c};
`;
  fs.writeFileSync('src/components/' + c + '.tsx', content);
});
